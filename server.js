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
    hostTeam: room.hostTeam || "1",
    maxPlayers: room.maxPlayers,
    training: false,
    difficulty: "human",
    createdAt: room.createdAt,
    started: room.started,
    players: room.players.map((player, index) => ({
      name: player.name,
      faction: player.faction,
      host: index === 0,
      ready: true
    }))
  };
}

function createPlayer(input, fallbackName) {
  return {
    id: crypto.randomUUID(),
    name: String(input.name || fallbackName).slice(0, 18),
    faction: String(input.faction || "Rainbow Sheep")
  };
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
    const room = {
      code,
      map: String(body.map || "Candy Meadow"),
      matchType: String(body.matchType || "1v1"),
      hostTeam: String(body.hostTeam || "1"),
      maxPlayers: Math.max(2, Math.min(6, Number(body.maxPlayers || 2))),
      createdAt: new Date().toISOString(),
      started: false,
      players: [host],
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
    room.players.push(player);
    json(res, 200, { room: publicRoom(room), playerId: player.id, playerIndex: room.players.length - 1 });
    return;
  }

  if (req.method === "POST" && action === "start") {
    await readBody(req);
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
