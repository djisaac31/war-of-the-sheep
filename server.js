const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const outputDir = path.join(__dirname, "outputs");
const publicDir = fs.existsSync(outputDir) ? outputDir : __dirname;
const rooms = new Map();
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".mp3": "audio/mpeg",
  ".txt": "text/plain; charset=utf-8",
  ".zip": "application/zip"
};

function makeRoomCode() {
  let code = "";
  do {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function publicRoom(room) {
  return {
    code: room.code,
    map: room.map,
    matchType: room.matchType || "1v1",
    maxPlayers: room.maxPlayers,
    training: false,
    difficulty: "human",
    createdAt: room.createdAt,
    started: room.started,
    alliances: (room.alliances || []).map((pair) => pair.slice()),
    allianceRequests: (room.allianceRequests || []).map((request) => ({
      fromIndex: playerIndex(room, request.fromId),
      toIndex: playerIndex(room, request.toId)
    })).filter((request) => request.fromIndex >= 0 && request.toIndex >= 0),
    players: room.players.map((player, index) => ({
      name: player.name,
      faction: player.faction,
      team: player.team || slotTeam(room.matchType || "1v1", index),
      ai: Boolean(player.ai),
      host: index === 0,
      ready: Boolean(player.ready)
    }))
  };
}

function createPlayer(input, fallbackName) {
  return {
    id: crypto.randomUUID(),
    name: String(input.name || fallbackName).slice(0, 18),
    faction: cleanFaction(input.faction),
    team: String(input.team || "allies"),
    ai: Boolean(input.ai),
    ready: Boolean(input.ready || input.ai)
  };
}

function slotTeam(type, index) {
  if (type === "ffa") return "ffa-" + index;
  const teamSize = matchTeamSizes(type);
  if (teamSize) return index < teamSize.allies ? "allies" : "rivals";
  return index === 0 ? "allies" : "rivals";
}

function matchTeamSizes(type) {
  const match = String(type || "").match(/^(\d+)v(\d+)(?:-ai)?$/);
  if (!match) return null;
  return {
    allies: Number(match[1]),
    rivals: Number(match[2]),
    total: Number(match[1]) + Number(match[2])
  };
}

function cleanTeam(value, type, index) {
  const team = String(value || "");
  if (type === "ffa") return team.startsWith("ffa-") ? team : slotTeam(type, index);
  if (team === "allies" || team === "rivals") return team;
  return slotTeam(type, index);
}

function cleanFaction(value) {
  const faction = String(value || "");
  if (faction === "Mech Sheep" || faction === "Fire Sheep" || faction === "Rainbow Sheep") return faction;
  return "Rainbow Sheep";
}

function playerIndex(room, playerId) {
  return room.players.findIndex((player) => player.id === playerId);
}

function allianceKey(a, b) {
  return [Math.min(a, b), Math.max(a, b)];
}

function hasAlliance(room, a, b) {
  const key = allianceKey(a, b);
  return (room.alliances || []).some((pair) => pair[0] === key[0] && pair[1] === key[1]);
}

function maxAllianceSize(room) {
  const count = (room.players || []).length;
  if (count <= 2) return 1;
  return Math.max(2, Math.floor(count / 2));
}

function allianceGroup(room, index, extraPair) {
  const pairs = (room.alliances || []).slice();
  if (extraPair) pairs.push(allianceKey(extraPair[0], extraPair[1]));
  const seen = new Set([index]);
  let changed = true;
  while (changed) {
    changed = false;
    pairs.forEach((pair) => {
      const a = pair[0];
      const b = pair[1];
      if (seen.has(a) && !seen.has(b)) {
        seen.add(b);
        changed = true;
      }
      if (seen.has(b) && !seen.has(a)) {
        seen.add(a);
        changed = true;
      }
    });
  }
  return seen;
}

function canAddAlliance(room, a, b) {
  if (room.matchType !== "ffa") return { ok: false, error: "Alliances are only for FFA rooms" };
  if ((room.players || []).length <= 2) return { ok: false, error: "Alliances are disabled in 1v1 and 2-player rooms" };
  const limit = maxAllianceSize(room);
  const groupA = allianceGroup(room, a, [a, b]);
  const groupB = allianceGroup(room, b, [a, b]);
  if (groupA.size > limit || groupB.size > limit) {
    return { ok: false, error: "That alliance would make one team too large for this FFA" };
  }
  return { ok: true };
}

function removeAlliance(room, a, b) {
  const key = allianceKey(a, b);
  room.alliances = (room.alliances || []).filter((pair) => pair[0] !== key[0] || pair[1] !== key[1]);
}

function removeAllianceRequests(room, aId, bId) {
  room.allianceRequests = (room.allianceRequests || []).filter((request) => {
    const sameDirection = request.fromId === aId && request.toId === bId;
    const reverseDirection = request.fromId === bId && request.toId === aId;
    return !sameDirection && !reverseDirection;
  });
}

function removePlayer(room, index) {
  const removed = room.players[index];
  room.players.splice(index, 1);
  room.alliances = (room.alliances || [])
    .filter((pair) => pair[0] !== index && pair[1] !== index)
    .map((pair) => pair.map((slot) => slot > index ? slot - 1 : slot));
  room.allianceRequests = (room.allianceRequests || []).filter((request) => {
    return request.fromId !== removed.id && request.toId !== removed.id;
  });
  room.players.forEach((player, playerIndexValue) => {
    player.team = cleanTeam(player.team, room.matchType || "1v1", playerIndexValue);
  });
}

function requireHost(body, room, res) {
  if (body.playerId !== room.players[0].id) {
    json(res, 403, { error: "Only the host can change the lobby", room: publicRoom(room) });
    return false;
  }
  return true;
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/status") {
    json(res, 200, { ok: true, multiplayer: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/rooms") {
    const body = await readBody(req);
    const code = makeRoomCode();
    const host = createPlayer(body.player || {}, "Host Shepherd");
    host.team = slotTeam(String(body.matchType || "1v1"), 0);
    host.ready = false;
    const room = {
      code,
      map: String(body.map || "Candy Meadow"),
      matchType: String(body.matchType || "1v1"),
      maxPlayers: Math.max(2, Math.min(6, Number(body.maxPlayers || 2))),
      createdAt: new Date().toISOString(),
      started: false,
      players: [host],
      alliances: [],
      allianceRequests: [],
      commands: [],
      snapshot: null
    };
    rooms.set(code, room);
    json(res, 200, { room: publicRoom(room), playerId: host.id, playerIndex: 0 });
    return;
  }

  const roomMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{5,6})(?:\/(.+))?$/);
  if (!roomMatch) {
    json(res, 404, { error: "Unknown API route" });
    return;
  }

  const code = roomMatch[1].toUpperCase();
  const action = roomMatch[2] || "";
  const room = rooms.get(code);
  if (!room) {
    json(res, 404, { error: "Room not found" });
    return;
  }

  if (req.method === "GET" && !action) {
    json(res, 200, { room: publicRoom(room) });
    return;
  }

  if (req.method === "POST" && action === "join") {
    const body = await readBody(req);
    if (room.players.length >= room.maxPlayers) {
      json(res, 409, { error: "Room is full", room: publicRoom(room) });
      return;
    }
    const player = createPlayer(body.player || {}, "Guest Shepherd");
    player.team = slotTeam(room.matchType || "1v1", room.players.length);
    player.ready = false;
    room.players.push(player);
    json(res, 200, { room: publicRoom(room), playerId: player.id, playerIndex: room.players.length - 1 });
    return;
  }

  if (req.method === "POST" && action === "ai") {
    const body = await readBody(req);
    if (!requireHost(body, room, res)) return;
    if (room.players.length >= room.maxPlayers) {
      json(res, 409, { error: "Room is full", room: publicRoom(room) });
      return;
    }
    const factionCycle = ["Mech Sheep", "Fire Sheep", "Rainbow Sheep"];
    room.players.push(createPlayer({
      name: "AI Shepherd " + room.players.length,
      faction: cleanFaction(body.faction || factionCycle[room.players.length % factionCycle.length]),
      team: String(body.team || slotTeam(room.matchType || "1v1", room.players.length)),
      ai: true,
      ready: true
    }, "AI Shepherd"));
    json(res, 200, { room: publicRoom(room) });
    return;
  }

  if (req.method === "POST" && action === "ready") {
    const body = await readBody(req);
    const index = playerIndex(room, body.playerId);
    if (index < 0 || room.players[index].ai) {
      json(res, 404, { error: "Player not found", room: publicRoom(room) });
      return;
    }
    room.players[index].ready = Boolean(body.ready);
    json(res, 200, { room: publicRoom(room) });
    return;
  }

  if (req.method === "POST" && action === "leave") {
    const body = await readBody(req);
    const index = playerIndex(room, body.playerId);
    if (index < 0) {
      json(res, 404, { error: "Player not found" });
      return;
    }
    if (index === 0 || room.players.length <= 1) {
      rooms.delete(code);
      json(res, 200, { left: true, closed: true });
      return;
    }
    removePlayer(room, index);
    json(res, 200, { left: true, room: publicRoom(room) });
    return;
  }

  if (req.method === "POST" && action === "team") {
    const body = await readBody(req);
    if (!requireHost(body, room, res)) return;
    const index = Number(body.index);
    if (!room.players[index]) {
      json(res, 404, { error: "Slot not found", room: publicRoom(room) });
      return;
    }
    room.players[index].team = cleanTeam(body.team, room.matchType || "1v1", index);
    json(res, 200, { room: publicRoom(room) });
    return;
  }

  if (req.method === "POST" && action === "faction") {
    const body = await readBody(req);
    const index = Number(body.index);
    const actorIndex = playerIndex(room, body.playerId);
    if (!room.players[index] || actorIndex < 0) {
      json(res, 404, { error: "Slot not found", room: publicRoom(room) });
      return;
    }
    const actorIsHost = actorIndex === 0;
    const targetIsSelf = actorIndex === index;
    const targetIsAi = Boolean(room.players[index].ai);
    if (!targetIsSelf && !(actorIsHost && targetIsAi)) {
      json(res, 403, { error: "You can only change your own faction. The host can change AI factions.", room: publicRoom(room) });
      return;
    }
    room.players[index].faction = cleanFaction(body.faction);
    json(res, 200, { room: publicRoom(room) });
    return;
  }

  if (req.method === "POST" && action === "alliance") {
    const body = await readBody(req);
    if (room.matchType !== "ffa") {
      json(res, 409, { error: "Alliances are only for FFA rooms", room: publicRoom(room) });
      return;
    }
    const fromIndex = playerIndex(room, body.playerId);
    const targetIndex = Number(body.targetIndex);
    if (fromIndex < 0 || !room.players[targetIndex] || fromIndex === targetIndex) {
      json(res, 404, { error: "Player not found", room: publicRoom(room) });
      return;
    }
    if (hasAlliance(room, fromIndex, targetIndex)) {
      json(res, 200, { room: publicRoom(room) });
      return;
    }
    const permission = canAddAlliance(room, fromIndex, targetIndex);
    if (!permission.ok) {
      json(res, 409, { error: permission.error, room: publicRoom(room) });
      return;
    }
    const fromId = room.players[fromIndex].id;
    const toId = room.players[targetIndex].id;
    const reverseRequest = (room.allianceRequests || []).find((request) => request.fromId === toId && request.toId === fromId);
    if (reverseRequest || room.players[targetIndex].ai) {
      const key = allianceKey(fromIndex, targetIndex);
      removeAllianceRequests(room, fromId, toId);
      room.alliances = room.alliances || [];
      room.alliances.push(key);
      json(res, 200, { room: publicRoom(room), accepted: true });
      return;
    }
    removeAllianceRequests(room, fromId, toId);
    room.allianceRequests = room.allianceRequests || [];
    room.allianceRequests.push({ fromId, toId });
    json(res, 200, { room: publicRoom(room), requested: true });
    return;
  }

  if (req.method === "POST" && action === "alliance/respond") {
    const body = await readBody(req);
    if (room.matchType !== "ffa") {
      json(res, 409, { error: "Alliances are only for FFA rooms", room: publicRoom(room) });
      return;
    }
    const toIndex = playerIndex(room, body.playerId);
    const fromIndex = Number(body.fromIndex);
    if (toIndex < 0 || !room.players[fromIndex] || toIndex === fromIndex) {
      json(res, 404, { error: "Player not found", room: publicRoom(room) });
      return;
    }
    const fromId = room.players[fromIndex].id;
    const toId = room.players[toIndex].id;
    const hasRequest = (room.allianceRequests || []).some((request) => request.fromId === fromId && request.toId === toId);
    removeAllianceRequests(room, fromId, toId);
    if (hasRequest && body.accept !== false) {
      const permission = canAddAlliance(room, fromIndex, toIndex);
      if (!permission.ok) {
        json(res, 409, { error: permission.error, room: publicRoom(room) });
        return;
      }
      const key = allianceKey(fromIndex, toIndex);
      room.alliances = room.alliances || [];
      if (!hasAlliance(room, fromIndex, toIndex)) room.alliances.push(key);
    }
    json(res, 200, { room: publicRoom(room) });
    return;
  }

  if (req.method === "POST" && action === "alliance/break") {
    const body = await readBody(req);
    const fromIndex = playerIndex(room, body.playerId);
    const targetIndex = Number(body.targetIndex);
    if (fromIndex < 0 || !room.players[targetIndex] || fromIndex === targetIndex) {
      json(res, 404, { error: "Player not found", room: publicRoom(room) });
      return;
    }
    removeAlliance(room, fromIndex, targetIndex);
    removeAllianceRequests(room, room.players[fromIndex].id, room.players[targetIndex].id);
    json(res, 200, { room: publicRoom(room) });
    return;
  }

  if (req.method === "POST" && action === "start") {
    const body = await readBody(req);
    if (body.playerId !== room.players[0].id) {
      json(res, 403, { error: "Only the host can start the game", room: publicRoom(room) });
      return;
    }
    if (room.players.length < room.maxPlayers) {
      json(res, 409, { error: "Room is not full yet", room: publicRoom(room) });
      return;
    }
    room.started = true;
    json(res, 200, { room: publicRoom(room) });
    return;
  }

  if (req.method === "POST" && action === "commands") {
    const body = await readBody(req);
    room.commands.push({
      id: room.commands.length + 1,
      at: Date.now(),
      playerIndex: Number(body.playerIndex || 0),
      command: body.command || {}
    });
    if (room.commands.length > 500) room.commands.splice(0, room.commands.length - 500);
    json(res, 200, { ok: true, nextId: room.commands.length });
    return;
  }

  if (req.method === "GET" && action === "commands") {
    const since = Number(url.searchParams.get("since") || 0);
    json(res, 200, { commands: room.commands.filter((command) => command.id > since) });
    return;
  }

  if (req.method === "PUT" && action === "snapshot") {
    const body = await readBody(req);
    room.snapshot = { at: Date.now(), data: body.snapshot || null };
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && action === "snapshot") {
    json(res, 200, { snapshot: room.snapshot });
    return;
  }

  json(res, 404, { error: "Unknown room action" });
}

function serveStatic(req, res, url) {
  let requested = decodeURIComponent(url.pathname);
  if (requested === "/") requested = "/index.html";
  const filePath = path.normalize(path.join(publicDir, requested));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else {
      serveStatic(req, res, url);
    }
  } catch (error) {
    json(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, HOST, () => {
  const localUrl = HOST === "0.0.0.0" ? `http://127.0.0.1:${PORT}/` : `http://${HOST}:${PORT}/`;
  console.log(`War of the Sheep server running at ${localUrl}`);
});
