(function () {
  const canvas = document.querySelector("#game-canvas");
  const ctx = canvas.getContext("2d");
  const fogCanvas = document.createElement("canvas");
  const fctx = fogCanvas.getContext("2d");
  const mini = document.querySelector("#minimap");
  const mctx = mini.getContext("2d");
  const toast = document.querySelector("#toast");
  const ui = {
    lollipops: document.querySelector("#lollipops"),
    marshmallows: document.querySelector("#marshmallows"),
    wool: document.querySelector("#wool"),
    room: document.querySelector("#room-pill"),
    music: document.querySelector("#game-music"),
    musicToggle: document.querySelector("#music-toggle"),
    missionToggle: document.querySelector("#mission-toggle"),
    allianceToggle: document.querySelector("#alliance-toggle"),
    alliancePanel: document.querySelector("#alliance-panel"),
    allianceClose: document.querySelector("#alliance-close"),
    allianceList: document.querySelector("#alliance-list"),
    tutorial: document.querySelector("#tutorial-missions"),
    tutorialTitle: document.querySelector("#tutorial-title"),
    tutorialCopy: document.querySelector("#tutorial-copy"),
    tutorialList: document.querySelector("#tutorial-list"),
    scoreScreen: document.querySelector("#score-screen"),
    scoreTitle: document.querySelector("#score-title"),
    scoreSummary: document.querySelector("#score-summary"),
    scoreTime: document.querySelector("#score-time"),
    scoreUnits: document.querySelector("#score-units"),
    scoreLost: document.querySelector("#score-lost"),
    scoreKills: document.querySelector("#score-kills"),
    scoreBuildings: document.querySelector("#score-buildings"),
    scoreResources: document.querySelector("#score-resources"),
    scoreRematch: document.querySelector("#score-rematch"),
    title: document.querySelector("#selection-title"),
    copy: document.querySelector("#selection-copy"),
    worker: document.querySelector("#train-worker"),
    soldier: document.querySelector("#train-soldier"),
    elite: document.querySelector("#train-elite"),
    base: document.querySelector("#build-base"),
    supply: document.querySelector("#build-supply"),
    production: document.querySelector("#build-production"),
    extractor: document.querySelector("#build-extractor"),
    forge: document.querySelector("#build-forge"),
    armor: document.querySelector("#upgrade-armor"),
    eliteArmor: document.querySelector("#upgrade-elite-armor"),
    ability: document.querySelector("#cast-ability")
  };
  const commandGroups = Array.from(document.querySelectorAll("[data-command-group]"));
  const commandButtons = Array.from(document.querySelectorAll("[data-command-button]"));

  const poster = new Image();
  poster.src = "./magic-sheep-units.png";
  const unitSprites = new Image();
  unitSprites.src = "./magic-sheep-unit-sprites.png";
  const buildingsPoster = new Image();
  buildingsPoster.src = "./magic-sheep-building-sprites.png";

  const world = { w: 2400, h: 1600 };
  const camera = { x: 0, y: 0, w: 1280, h: 760 };
  const mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, sx: 0, sy: 0 };
  const controlGroups = new Map();
  const selected = new Set();
  let placement = null;
  let commandMode = null;
  let last = performance.now();
  let nextId = 1;
  let aiTimer = 0;
  let aiBuildTimer = 0;
  let attackWaveTimer = 0;
  let messageTimer = 0;

  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get("room") || "LOCAL";
  const network = {
    enabled: params.get("net") === "1",
    playerIndex: Number(params.get("player") || 0),
    lastCommandId: 0,
    lastSnapshotAt: 0,
    lastSnapshotPoll: 0,
    lastCommandPoll: 0,
    lastRoomPoll: 0,
    applyingSnapshot: false,
    tick: 0
  };
  const networkRates = {
    commandPoll: 0.05,
    hostSnapshot: 0.055,
    guestSnapshot: 0.045,
    roomPoll: 2.0
  };
  const isNetworkHost = network.enabled && network.playerIndex === 0;
  const isNetworkGuest = network.enabled && network.playerIndex > 0;
  if (params.get("start") !== "1") {
    window.location.replace("./index.html" + (roomCode !== "LOCAL" ? "?room=" + encodeURIComponent(roomCode) : ""));
    return;
  }
  let roomSettings = readRoomSettings();
  const tutorialMode = params.get("tutorial") === "1" || Boolean(roomSettings.tutorial);
  const aiDifficulty = String(roomSettings.difficulty || params.get("difficulty") || "normal").toLowerCase();
  ui.room.textContent = tutorialMode
    ? "Tutorial Mission"
    : roomSettings.training ? "Training " + aiDifficulty.toUpperCase() + " - " + (roomSettings.map || "Candy Meadow")
    : network.enabled ? "Online Room " + roomCode + " - P" + (network.playerIndex + 1) : "Room " + roomCode;

  const factionData = {
    rainbow: {
      name: "Rainbow Sheep",
      color: "#8d63dc",
      accent: "#eaa0ce",
      worker: "Dreamer Lamb",
      soldier: "Gleamling",
      heavy: "Prism Guard",
      elite: "Rainbow Colossus",
      base: "Rainbow Tree",
      ability: "Prism Burst",
      atlas: [0.02, 0.16, 0.31, 0.74],
      buildingAtlas: [0.02, 0.16, 0.30, 0.70]
    },
    mech: {
      name: "Mech Sheep",
      color: "#2b78a2",
      accent: "#f0b24d",
      worker: "Cog Lamb",
      soldier: "Bolt Lamb",
      heavy: "Gear Ram",
      elite: "Candy Tank",
      base: "Candy Command Barn",
      ability: "Repair Pulse",
      atlas: [0.35, 0.16, 0.31, 0.74],
      buildingAtlas: [0.35, 0.16, 0.30, 0.70]
    },
    fire: {
      name: "Fire Sheep",
      color: "#e85f35",
      accent: "#ffbd55",
      worker: "Kindling Lamb",
      soldier: "Sparkling",
      heavy: "Iron Ram",
      elite: "Inferno Titan",
      base: "Mother Ember",
      ability: "Warm Wool",
      atlas: [0.68, 0.16, 0.30, 0.74],
      buildingAtlas: [0.68, 0.16, 0.30, 0.70]
    }
  };

  const stats = {
    worker: { hp: 48, speed: 115, radius: 17, damage: 3, range: 24, cooldown: 0.9, wool: 1 },
    soldier: { hp: 78, speed: 92, radius: 20, damage: 9, range: 118, cooldown: 0.85, wool: 2 },
    heavy: { hp: 150, speed: 68, radius: 26, damage: 18, range: 44, cooldown: 1.15, wool: 4 },
    elite: { hp: 230, speed: 58, radius: 31, damage: 30, range: 74, cooldown: 1.2, wool: 6 },
    base: { hp: 720, speed: 0, radius: 58, damage: 0, range: 0, cooldown: 1, wool: 0 },
    supply: { hp: 240, speed: 0, radius: 34, damage: 0, range: 0, cooldown: 1, wool: 0 },
    production: { hp: 360, speed: 0, radius: 42, damage: 0, range: 0, cooldown: 1, wool: 0 },
    extractor: { hp: 280, speed: 0, radius: 36, damage: 0, range: 0, cooldown: 1, wool: 0 },
    forge: { hp: 320, speed: 0, radius: 39, damage: 0, range: 0, cooldown: 1, wool: 0 }
  };

  const costs = {
    worker: { l: 0, m: 50 },
    soldier: { l: 0, m: 75 },
    heavy: { l: 35, m: 110 },
    elite: { l: 80, m: 130 },
    base: { l: 0, m: 300 },
    supply: { l: 0, m: 95 },
    production: { l: 0, m: 145 },
    extractor: { l: 0, m: 60 },
    forge: { l: 25, m: 125 },
    armor: { l: 45, m: 120 },
    eliteArmor: { l: 95, m: 160 }
  };

  const trainTimes = { worker: 8, soldier: 11, heavy: 15, elite: 22 };
  const buildTimes = { base: 30, supply: 12, production: 18, extractor: 16, forge: 20 };
  const aiProfiles = {
    easy: { think: 18, drip: 0.65, burst: 18, gasDelay: 140, gas: 2, caps: [1, 3, 5], waveDelay: 180, waveCooldown: 70, waveSize: 4, heavyDelay: 190, heavyChance: 0.86 },
    normal: { think: 14, drip: 1.1, burst: 28, gasDelay: 100, gas: 4, caps: [2, 4, 7], waveDelay: 150, waveCooldown: 55, waveSize: 5, heavyDelay: 160, heavyChance: 0.78 },
    hard: { think: 11, drip: 1.4, burst: 38, gasDelay: 90, gas: 6, caps: [3, 5, 8], waveDelay: 125, waveCooldown: 45, waveSize: 6, heavyDelay: 140, heavyChance: 0.7 }
  };
  const aiProfile = aiProfiles[aiDifficulty] || aiProfiles.normal;
  const mapProfiles = {
    "Candy Meadow": { tint: "#6db978", clearings: [[760, 880, 360, 210, -0.2], [1710, 850, 390, 230, 0.15]], riverY: 1160, player: [330, 820], enemy: [2050, 780], playerGas: [780, 1000], enemyGas: [1640, 990] },
    "Marshmallow Crossing": { tint: "#79bfc9", clearings: [[650, 710, 330, 180, 0.05], [1570, 1020, 430, 210, -0.25]], riverY: 900, player: [310, 650], enemy: [2040, 1050], playerGas: [760, 805], enemyGas: [1650, 1120] },
    "Ember Orchard": { tint: "#9eb45c", clearings: [[690, 990, 330, 210, 0.15], [1670, 700, 400, 210, -0.15]], riverY: 1240, player: [330, 990], enemy: [2050, 650], playerGas: [805, 1110], enemyGas: [1635, 765] },
    "Sugar Spiral": { tint: "#76b88c", clearings: [[620, 720, 300, 190, 0], [1260, 820, 360, 210, 0.4], [1780, 1070, 320, 180, -0.2]], riverY: 1020, player: [300, 720], enemy: [2020, 1070], playerGas: [710, 820], enemyGas: [1680, 1080] },
    "Gumdrop Triangle": { tint: "#85b7d3", clearings: [[560, 1110, 320, 180, -0.1], [1220, 560, 370, 190, 0.2], [1840, 1110, 320, 180, 0.1]], riverY: 1180, player: [330, 1110], enemy: [2050, 560], playerGas: [760, 1120], enemyGas: [1660, 640] },
    "Frosting Four Corners": { tint: "#80c3a8", clearings: [[470, 560, 310, 170, 0], [1910, 560, 310, 170, 0], [470, 1220, 310, 170, 0], [1910, 1220, 310, 170, 0]], riverY: 980, player: [330, 560], enemy: [2050, 1220], playerGas: [710, 700], enemyGas: [1690, 1090] },
    "Clockwork Pastures": { tint: "#6ea6a2", clearings: [[430, 880, 300, 185, 0.2], [1030, 520, 340, 190, -0.2], [1500, 1180, 340, 190, 0.2], [2020, 820, 300, 185, -0.2]], riverY: 1080, player: [330, 880], enemy: [2050, 820], playerGas: [750, 930], enemyGas: [1660, 850] },
    "Five Flock Basin": { tint: "#71bd78", clearings: [[340, 780, 280, 170, 0], [870, 450, 290, 170, 0], [1540, 450, 290, 170, 0], [2020, 780, 280, 170, 0], [1210, 1240, 360, 200, 0]], riverY: 1120, player: [330, 780], enemy: [2050, 780], playerGas: [720, 840], enemyGas: [1675, 840] },
    "Lollipop Ring": { tint: "#7ab7ad", clearings: [[520, 530, 280, 170, 0], [1840, 530, 280, 170, 0], [420, 1210, 280, 170, 0], [1960, 1210, 280, 170, 0], [1210, 850, 390, 230, 0]], riverY: 1260, player: [330, 1210], enemy: [2050, 530], playerGas: [760, 1110], enemyGas: [1660, 660] },
    "Six Shepherd Summit": { tint: "#74b994", clearings: [[360, 500, 260, 160, 0], [1210, 430, 300, 170, 0], [2040, 500, 260, 160, 0], [360, 1230, 260, 160, 0], [1210, 1300, 300, 170, 0], [2040, 1230, 260, 160, 0]], riverY: 1050, player: [330, 500], enemy: [2050, 1230], playerGas: [700, 610], enemyGas: [1690, 1120] },
    "Marshmallow Crown": { tint: "#8bb6cf", clearings: [[410, 850, 280, 170, 0], [790, 500, 280, 170, 0], [1560, 500, 280, 170, 0], [1990, 850, 280, 170, 0], [790, 1230, 280, 170, 0], [1560, 1230, 280, 170, 0]], riverY: 930, player: [330, 850], enemy: [2050, 850], playerGas: [760, 900], enemyGas: [1660, 900] }
  };
  let activeMap = mapProfiles[roomSettings.map] || mapProfiles["Candy Meadow"];

  const state = {
    player: { faction: "rainbow", lollipops: 0, marshmallows: 50, woolUsed: 3, woolMax: 12 },
    enemy: { faction: "mech", lollipops: 0, marshmallows: aiDifficulty === "easy" ? 55 : 80, woolUsed: 0, woolMax: 40 },
    elapsed: 0,
    ended: false,
    setupComplete: false,
    stats: {
      unitsCreated: 0,
      unitsLost: 0,
      enemiesDestroyed: 0,
      structuresBuilt: 0,
      marshmallowsGathered: 0
    },
    units: [],
    structures: [],
    resources: [],
    effects: [],
    training: []
  };
  const upgrades = {
    armor: { researched: false, inProgress: false, elapsed: 0, duration: 22 },
    eliteArmor: { researched: false, inProgress: false, elapsed: 0, duration: 30 }
  };
  const tutorial = {
    step: 0,
    announced: -1,
    attackMoveIssued: false,
    hidden: false,
    missions: [
      {
        title: "Select a Worker",
        copy: "Left-click one worker sheep to select it. You can also hold the mouse button and drag a box around several sheep.",
        task: "Select one worker",
        done: () => state.units.some((unit) => unit.owner === "player" && unit.type === "worker" && selected.has(unit.id))
      },
      {
        title: "Gather Marshmallows",
        copy: "With a worker selected, right-click the white Marshmallow field. The worker will gather, walk back beside your main base, and drop them off.",
        task: "Gather 20 Marshmallows",
        done: () => state.stats.marshmallowsGathered >= 20 || state.player.marshmallows >= 180
      },
      {
        title: "Build a Barracks",
        copy: "Select a worker, click Build Barracks at the bottom, then left-click open ground near your base. Wait for the build timer to finish.",
        task: "Finish one Barracks",
        done: () => state.structures.some((structure) => structure.owner === "player" && structure.type === "production" && !structure.underConstruction)
      },
      {
        title: "Train Fighters",
        copy: "Click your Barracks, then click Train Army at the bottom right. Training has a timer before the unit appears.",
        task: "Create 3 army units",
        done: () => state.units.filter((unit) => unit.owner === "player" && unit.type !== "worker").length >= 3
      },
      {
        title: "Use Attack-Move",
        copy: "Left-click or drag-select your fighters. Press A, then left-click toward the enemy base so they attack anything on the way.",
        task: "Issue one attack-move",
        done: () => tutorial.attackMoveIssued
      },
      {
        title: "Destroy the Main Base",
        copy: "Keep training and attacking until the enemy main base is destroyed.",
        task: "Destroy the enemy main base",
        done: () => !state.structures.some((structure) => structure.owner === "enemy" && structure.type === "base")
      }
    ]
  };

  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = 1;
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    fogCanvas.width = Math.floor(rect.width * ratio);
    fogCanvas.height = Math.floor(rect.height * ratio);
    camera.w = rect.width;
    camera.h = rect.height;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function roomFaction() {
    const index = network.enabled ? network.playerIndex : 0;
    const faction = roomSettings && roomSettings.players && roomSettings.players[index] && roomSettings.players[index].faction;
    if (/mech/i.test(faction)) return "mech";
    if (/fire/i.test(faction)) return "fire";
    return "rainbow";
  }

  function slotTeam(type, index) {
    if (type === "ffa") return "ffa-" + index;
    if (type === "2v2" || type === "2v2-ai") return index < 2 ? "allies" : "rivals";
    if (type === "3v3") return index < 3 ? "allies" : "rivals";
    return index === 0 ? "allies" : "rivals";
  }

  function roomPlayer(index) {
    return roomSettings && roomSettings.players && roomSettings.players[index] ? roomSettings.players[index] : null;
  }

  function roomPlayerTeam(index) {
    const player = roomPlayer(index);
    return player && player.team ? String(player.team) : slotTeam(roomSettings.matchType || "1v1", index);
  }

  function roomPlayersAllied(a, b) {
    if (a === b) return true;
    const pair = (roomSettings.alliances || []).find((alliance) => alliance.includes(a) && alliance.includes(b));
    if (pair) return true;
    const teamA = roomPlayerTeam(a);
    const teamB = roomPlayerTeam(b);
    if ((roomSettings.matchType || "1v1") === "ffa") return false;
    return teamA === teamB;
  }

  function localPlayerIndex() {
    return network.enabled ? network.playerIndex : 0;
  }

  function opponentPlayerIndex() {
    const localIndex = localPlayerIndex();
    const players = roomSettings.players || [];
    const opponentIndex = players.findIndex((player, index) => player && index !== localIndex && !roomPlayersAllied(localIndex, index));
    if (opponentIndex >= 0) return opponentIndex;
    return network.enabled ? (network.playerIndex === 0 ? 1 : 0) : 1;
  }

  function ownerPlayerIndex(owner) {
    return owner === "player" ? localPlayerIndex() : opponentPlayerIndex();
  }

  function ownersAreAllied(a, b) {
    if (a === b) return true;
    return roomPlayersAllied(ownerPlayerIndex(a), ownerPlayerIndex(b));
  }

  function isHostileTo(owner, entity) {
    return entity && entity.owner && !ownersAreAllied(owner, entity.owner);
  }

  function readRoomSettings() {
    try {
      const rooms = JSON.parse(localStorage.getItem("magic-sheep-rts-rooms")) || {};
      return rooms[roomCode] || {};
    } catch (_error) {
      return {};
    }
  }

  function readSession() {
    const key = "war-of-the-sheep-session-" + roomCode;
    try {
      return JSON.parse(sessionStorage.getItem(key) || localStorage.getItem(key)) || null;
    } catch (_error) {
      return null;
    }
  }

  async function refreshOnlineRoom() {
    if (!network.enabled) return;
    try {
      const response = await fetch("/api/rooms/" + encodeURIComponent(roomCode));
      if (!response.ok) return;
      const data = await response.json();
      if (!data.room) return;
      const rooms = JSON.parse(localStorage.getItem("magic-sheep-rts-rooms")) || {};
      rooms[roomCode] = data.room;
      localStorage.setItem("magic-sheep-rts-rooms", JSON.stringify(rooms));
      roomSettings = data.room;
      activeMap = mapProfiles[roomSettings.map] || mapProfiles["Candy Meadow"];
      renderAlliancePanel();
    } catch (_error) {
      say("Online room server not reachable.");
    }
  }

  function allianceRequestBetween(fromIndex, toIndex) {
    return (roomSettings.allianceRequests || []).some((request) => request.fromIndex === fromIndex && request.toIndex === toIndex);
  }

  async function updateAlliance(action, body, message) {
    const session = readSession();
    if (!network.enabled || !session || !session.playerId) {
      say("Alliances need the public multiplayer server.");
      return;
    }
    try {
      const response = await fetch("/api/rooms/" + encodeURIComponent(roomCode) + "/" + action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ playerId: session.playerId }, body || {}))
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Alliance failed.");
      if (data.room) {
        roomSettings = data.room;
        const rooms = JSON.parse(localStorage.getItem("magic-sheep-rts-rooms")) || {};
        rooms[roomCode] = data.room;
        localStorage.setItem("magic-sheep-rts-rooms", JSON.stringify(rooms));
      }
      renderAlliancePanel();
      say(message);
    } catch (error) {
      say(error.message);
    }
  }

  function renderAlliancePanel() {
    if (!ui.allianceToggle || !ui.alliancePanel || !ui.allianceList) return;
    const canUseAlliances = network.enabled && roomSettings.matchType === "ffa" && (roomSettings.players || []).length > 1;
    ui.allianceToggle.hidden = !canUseAlliances;
    if (!canUseAlliances) {
      ui.alliancePanel.hidden = true;
      return;
    }
    const localIndex = localPlayerIndex();
    ui.allianceList.innerHTML = "";
    (roomSettings.players || []).forEach((player, index) => {
      if (index === localIndex) return;
      const row = document.createElement("div");
      const label = document.createElement("div");
      const name = document.createElement("strong");
      const detail = document.createElement("small");
      const actions = document.createElement("div");
      const button = document.createElement("button");
      row.className = "alliance-row";
      actions.className = "alliance-row__actions";
      name.textContent = player.name || "Shepherd " + (index + 1);
      if (roomPlayersAllied(localIndex, index)) {
        detail.textContent = "Ally - green on the minimap";
        button.textContent = "Break";
        button.addEventListener("click", () => updateAlliance("alliance/break", { targetIndex: index }, "Alliance broken."));
      } else if (allianceRequestBetween(index, localIndex)) {
        const decline = document.createElement("button");
        detail.textContent = "They want an alliance";
        button.textContent = "Accept";
        button.addEventListener("click", () => updateAlliance("alliance/respond", { fromIndex: index, accept: true }, "Alliance accepted."));
        decline.textContent = "Decline";
        decline.addEventListener("click", () => updateAlliance("alliance/respond", { fromIndex: index, accept: false }, "Alliance declined."));
        actions.append(decline);
      } else if (allianceRequestBetween(localIndex, index)) {
        detail.textContent = "Alliance request sent";
        button.textContent = "Waiting";
        button.disabled = true;
      } else {
        detail.textContent = "Enemy flock";
        button.textContent = "Request";
        button.addEventListener("click", () => updateAlliance("alliance", { targetIndex: index }, "Alliance request sent."));
      }
      label.append(name, detail);
      actions.prepend(button);
      row.append(label, actions);
      ui.allianceList.append(row);
    });
  }

  async function sendNetworkCommand(command) {
    if (!network.enabled) return;
    try {
      await fetch("/api/rooms/" + encodeURIComponent(roomCode) + "/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIndex: network.playerIndex, command })
      });
    } catch (_error) {
      say("Multiplayer command could not reach the room server.");
    }
  }

  async function pollNetworkCommands() {
    if (!isNetworkHost) return;
    try {
      const response = await fetch("/api/rooms/" + encodeURIComponent(roomCode) + "/commands?since=" + network.lastCommandId);
      if (!response.ok) return;
      const data = await response.json();
      (data.commands || []).forEach((entry) => {
        network.lastCommandId = Math.max(network.lastCommandId, entry.id || 0);
        if (entry.playerIndex === network.playerIndex) return;
        applyRemoteCommand(entry.command || {});
      });
    } catch (_error) {
      say("Waiting for multiplayer room server.");
    }
  }

  async function publishNetworkSnapshot() {
    if (!isNetworkHost) return;
    try {
      await fetch("/api/rooms/" + encodeURIComponent(roomCode) + "/snapshot", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: makeSnapshot() })
      });
    } catch (_error) {
      say("Could not share the match state.");
    }
  }

  async function pollNetworkSnapshot() {
    if (!isNetworkGuest) return;
    try {
      const response = await fetch("/api/rooms/" + encodeURIComponent(roomCode) + "/snapshot");
      if (!response.ok) return;
      const data = await response.json();
      if (!data.snapshot || !data.snapshot.data) return;
      if (data.snapshot.at <= network.lastSnapshotAt) return;
      network.lastSnapshotAt = data.snapshot.at;
      applySnapshot(data.snapshot.data);
    } catch (_error) {
      say("Waiting for host match state.");
    }
  }

  function makeSnapshot() {
    return JSON.parse(JSON.stringify({
      state,
      upgrades,
      nextId,
      aiTimer,
      aiBuildTimer,
      attackWaveTimer
    }));
  }

  function applySnapshot(snapshot) {
    network.applyingSnapshot = true;
    const data = JSON.parse(JSON.stringify(snapshot));
    if (network.playerIndex > 0) swapSnapshotPerspective(data);
    Object.keys(state).forEach((key) => {
      state[key] = data.state[key];
    });
    Object.keys(upgrades).forEach((key) => {
      upgrades[key] = data.upgrades[key];
    });
    nextId = data.nextId;
    aiTimer = data.aiTimer || 0;
    aiBuildTimer = data.aiBuildTimer || 0;
    attackWaveTimer = data.attackWaveTimer || 0;
    selected.forEach((id) => {
      const exists = [...state.units, ...state.structures].some((entity) => entity.id === id && entity.owner === "player");
      if (!exists) selected.delete(id);
    });
    if (state.ended && ui.scoreScreen.hidden) {
      const enemyBase = state.structures.find((s) => s.owner === "enemy" && s.type === "base");
      const playerBase = state.structures.find((s) => s.owner === "player" && s.type === "base");
      showScoreScreen(enemyBase && !playerBase ? "defeat" : "victory");
    }
    network.applyingSnapshot = false;
  }

  function swapSnapshotPerspective(data) {
    const previousPlayer = data.state.player;
    data.state.player = data.state.enemy;
    data.state.enemy = previousPlayer;
    [...data.state.units, ...data.state.structures].forEach((entity) => {
      if (entity.owner === "player") entity.owner = "enemy";
      else if (entity.owner === "enemy") entity.owner = "player";
    });
  }

  function addUnit(owner, faction, type, x, y) {
    const s = stats[type];
    const unit = {
      id: nextId++,
      kind: "unit",
      owner,
      faction,
      type,
      x,
      y,
      tx: x,
      ty: y,
      hp: s.hp,
      maxHp: s.hp,
      cooldown: 0,
      carry: 0,
      target: null,
      attackMove: false,
      attackX: null,
      attackY: null,
      harvest: null,
      selected: false,
      portraitSeed: Math.random(),
      buildTask: null
    };
    state.units.push(unit);
    if (state.setupComplete && owner === "player") state.stats.unitsCreated += 1;
    return unit;
  }

  function addStructure(owner, faction, type, x, y) {
    const s = stats[type];
    const structure = {
      id: nextId++,
      kind: "structure",
      owner,
      faction,
      type,
      x,
      y,
      hp: s.hp,
      maxHp: s.hp,
      selected: false,
      portraitSeed: Math.random(),
      underConstruction: false,
      buildProgress: 0,
      buildTime: 0,
      buildStarted: false
    };
    state.structures.push(structure);
    return structure;
  }

  function addResource(type, x, y, amount) {
    state.resources.push({ id: nextId++, type, x, y, amount, radius: type === "lollipop" ? 42 : 48 });
  }

  function setup() {
    state.player.faction = roomFaction();
    const pf = state.player.faction;
    const opponentByFaction = { rainbow: "mech", mech: "rainbow", fire: "mech" };
    const opponentIndex = opponentPlayerIndex();
    const roomOpponent = roomSettings && roomSettings.players && roomSettings.players[opponentIndex] && roomSettings.players[opponentIndex].faction;
    const ef = network.enabled
      ? (/mech/i.test(roomOpponent) ? "mech" : /fire/i.test(roomOpponent) ? "fire" : "rainbow")
      : opponentByFaction[pf] || "mech";
    state.enemy.faction = ef;
    if (network.enabled) {
      state.enemy.marshmallows = 50;
      state.enemy.lollipops = 0;
      state.enemy.woolUsed = 3;
      state.enemy.woolMax = 12;
    }
    if (tutorialMode) {
      state.player.marshmallows = 160;
      state.player.lollipops = 45;
      state.enemy.marshmallows = 45;
      state.enemy.lollipops = 0;
      state.enemy.woolUsed = 0;
      state.enemy.woolMax = 12;
    }
    const playerStart = { x: activeMap.player[0], y: activeMap.player[1] };
    const enemyStart = { x: activeMap.enemy[0], y: activeMap.enemy[1] };

    addStructure("player", pf, "base", playerStart.x, playerStart.y);
    addStructure("player", pf, "supply", playerStart.x - 100, playerStart.y - 140);
    addUnit("player", pf, "worker", playerStart.x + 110, playerStart.y - 30);
    addUnit("player", pf, "worker", playerStart.x + 60, playerStart.y + 80);
    addUnit("player", pf, "worker", playerStart.x + 170, playerStart.y + 70);

    addStructure("enemy", ef, "base", enemyStart.x, enemyStart.y);
    addStructure("enemy", ef, "supply", enemyStart.x + 100, enemyStart.y - 140);
    addStructure("enemy", ef, "production", enemyStart.x - 65, enemyStart.y - 125);
    addUnit("enemy", ef, "worker", enemyStart.x - 110, enemyStart.y - 10);
    addUnit("enemy", ef, "worker", enemyStart.x - 65, enemyStart.y + 70);
    if (network.enabled || tutorialMode) addUnit("enemy", ef, "worker", enemyStart.x - 150, enemyStart.y + 90);
    else addUnit("enemy", ef, "soldier", enemyStart.x - 150, enemyStart.y + 90);

    addResourceCluster(activeMap.playerGas[0] - 180, activeMap.playerGas[1] - 120);
    addResourceCluster(activeMap.enemyGas[0] + 35, activeMap.enemyGas[1] - 120);
    addResource("lollipop", activeMap.playerGas[0], activeMap.playerGas[1], 9999);
    addResource("lollipop", activeMap.enemyGas[0], activeMap.enemyGas[1], 9999);
    addExpansionResources();

    const cameraStart = isNetworkGuest ? enemyStart : playerStart;
    camera.x = Math.max(0, Math.min(world.w - camera.w, cameraStart.x - camera.w / 2));
    camera.y = Math.max(0, Math.min(world.h - camera.h, cameraStart.y - camera.h / 2));
    state.setupComplete = true;
    if (tutorialMode) {
      ui.tutorial.hidden = false;
      ui.missionToggle.hidden = false;
      say("Tutorial mission started. Follow the objectives on the right.");
      updateTutorial(true);
    } else {
      say("You are commanding " + factionData[pf].name + " on " + (roomSettings.map || "Candy Meadow") + ". Gather Marshmallows, then build a Lollipop Extractor.");
    }
  }

  function addResourceCluster(x, y) {
    for (let i = 0; i < 8; i += 1) addResource("marshmallow", x + i * 45, y + (i % 2) * 52, 420);
  }

  function expansionSpots() {
    const playerStart = { x: activeMap.player[0], y: activeMap.player[1] };
    const enemyStart = { x: activeMap.enemy[0], y: activeMap.enemy[1] };
    const fromClearings = (activeMap.clearings || []).map((clearing) => ({ x: clearing[0], y: clearing[1] }));
    const fallback = [
      { x: 1200, y: 430 },
      { x: 1200, y: 1240 },
      { x: 790, y: 420 },
      { x: 1580, y: 1180 },
      { x: 770, y: 1210 },
      { x: 1630, y: 500 }
    ];
    const candidates = [...fromClearings, ...fallback];
    const spots = [];
    candidates.forEach((spot) => {
      const farFromPlayer = Math.hypot(spot.x - playerStart.x, spot.y - playerStart.y) > 620;
      const farFromEnemy = Math.hypot(spot.x - enemyStart.x, spot.y - enemyStart.y) > 620;
      const notDuplicate = !spots.some((existing) => Math.hypot(existing.x - spot.x, existing.y - spot.y) < 320);
      if (farFromPlayer && farFromEnemy && notDuplicate) spots.push(spot);
    });
    return spots.slice(0, 4);
  }

  function addExpansionResources() {
    expansionSpots().forEach((spot, index) => {
      const side = index % 2 === 0 ? 1 : -1;
      addResourceCluster(spot.x + 105 * side, spot.y - 115);
      addResource("lollipop", spot.x - 110 * side, spot.y + 110, 9999);
    });
  }

  function say(text) {
    toast.textContent = text;
    messageTimer = 4;
  }

  function updateTutorial(force = false) {
    if (!tutorialMode || !ui.tutorial) return;
    while (tutorial.step < tutorial.missions.length && tutorial.missions[tutorial.step].done()) {
      tutorial.step += 1;
      force = true;
      if (tutorial.step < tutorial.missions.length) say("Mission complete. Next objective: " + tutorial.missions[tutorial.step].title + ".");
      else say("Tutorial complete. Destroy the base to finish the match.");
    }

    const mission = tutorial.missions[Math.min(tutorial.step, tutorial.missions.length - 1)];
    if (!force && tutorial.announced === tutorial.step) return;
    tutorial.announced = tutorial.step;
    ui.tutorialTitle.textContent = tutorial.step >= tutorial.missions.length ? "Tutorial Complete" : mission.title;
    ui.tutorialCopy.textContent = tutorial.step >= tutorial.missions.length ? "You know the basics. Finish the enemy base to win." : mission.copy;
    ui.tutorialList.innerHTML = "";
    tutorial.missions.forEach((item, index) => {
      const li = document.createElement("li");
      li.textContent = item.task;
      if (index < tutorial.step) li.className = "is-done";
      ui.tutorialList.append(li);
    });
  }

  function setMissionPanelHidden(hidden) {
    if (!tutorialMode || !ui.tutorial) return;
    tutorial.hidden = hidden;
    ui.tutorial.hidden = hidden;
    ui.missionToggle.textContent = hidden ? "Show Missions" : "Hide Missions";
    if (hidden) showMissionReopenButton();
    else hideMissionReopenButton();
  }

  function showMissionReopenButton() {
    let button = document.querySelector("#mission-reopen");
    if (!button) {
      button = document.createElement("button");
      button.id = "mission-reopen";
      button.className = "mission-reopen";
      button.type = "button";
      button.textContent = "Show Missions";
      button.addEventListener("click", () => setMissionPanelHidden(false));
      canvas.parentElement.append(button);
    }
    button.hidden = false;
  }

  function hideMissionReopenButton() {
    const button = document.querySelector("#mission-reopen");
    if (button) button.hidden = true;
  }

  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return { x, y, wx: x + camera.x, wy: y + camera.y };
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function sideFor(owner) {
    return owner === "enemy" ? state.enemy : state.player;
  }

  function spend(type, owner = "player") {
    const c = costs[type];
    const side = sideFor(owner);
    if (side.marshmallows < c.m || side.lollipops < c.l) {
      if (owner === "player") say("Need more resources.");
      return false;
    }
    if (stats[type] && type !== "supply" && side.woolUsed + stats[type].wool > side.woolMax) {
      if (owner === "player") say("Build more Wool Capacity.");
      return false;
    }
    side.marshmallows -= c.m;
    side.lollipops -= c.l;
    return true;
  }

  function hasSelectedWorker() {
    return state.units.some((u) => selected.has(u.id) && u.owner === "player" && u.type === "worker");
  }

  function selectedCommandSubject(picked) {
    if (!picked.length) return null;
    const worker = picked.find((entity) => entity.kind === "unit" && entity.type === "worker");
    if (worker) return worker;
    return picked[0];
  }

  function showCommandGroups(groups) {
    commandGroups.forEach((group) => {
      group.hidden = !groups.includes(group.dataset.commandGroup);
    });
    commandButtons.forEach((button) => {
      button.hidden = !groups.includes(button.dataset.commandButton);
    });
  }

  function readyStructure(type, owner = "player") {
    return state.structures.find((s) => s.owner === owner && s.type === type && !s.underConstruction);
  }

  function queueTraining(type, owner = "player") {
    const producerType = type === "worker" ? "base" : "production";
    const producer = readyStructure(producerType, owner);
    if (!producer) {
      if (owner === "player") say(type === "worker" ? "You need a living main base." : "Build a Barracks before training army units.");
      return;
    }
    if (type === "elite" && !readyStructure("forge", owner)) {
      if (owner === "player") say("Build a Forge to unlock elite units.");
      return;
    }
    if (!spend(type, owner)) return;
    sideFor(owner).woolUsed += stats[type].wool;
    state.training.push({
      owner,
      faction: sideFor(owner).faction,
      type,
      producerId: producer.id,
      elapsed: 0,
      duration: trainTimes[type]
    });
    if (owner === "player") say(type === "worker" ? "Worker queued." : unitLabel(type, state.player.faction) + " queued at the Barracks.");
  }

  function finishTraining(job) {
    const producer = state.structures.find((s) => s.id === job.producerId);
    if (!producer) return;
    const angle = Math.random() * Math.PI * 2;
    const unit = addUnit(job.owner, job.faction, job.type, producer.x + Math.cos(angle) * 95, producer.y + Math.sin(angle) * 95);
    applyFinishedUpgrades(unit);
    if (job.owner === "player") {
      selected.clear();
      selected.add(unit.id);
      say(job.type === "worker" ? "Worker ready." : unitLabel(job.type, job.faction) + " ready.");
    }
  }

  function unitLabel(type, faction) {
    const f = factionData[faction];
    if (type === "worker") return f.worker;
    if (type === "heavy") return f.heavy;
    if (type === "elite") return f.elite;
    return f.soldier;
  }

  function applyFinishedUpgrades(unit) {
    if (unit.owner !== "player") return;
    const armorApplies = upgrades.armor.researched && (unit.type === "soldier" || unit.type === "heavy");
    const eliteArmorApplies = upgrades.eliteArmor.researched && unit.type === "elite";
    if (!armorApplies && !eliteArmorApplies) return;
    const bonus = armorHpBonus(unit.type);
    unit.maxHp += bonus;
    unit.hp += bonus;
  }

  function updateTraining(dt) {
    state.training = state.training.filter((job) => {
      const producer = state.structures.find((s) => s.id === job.producerId && !s.underConstruction);
      if (!producer) return false;
      job.elapsed += dt;
      if (job.elapsed >= job.duration) {
        finishTraining(job);
        return false;
      }
      return true;
    });
  }

  function beginStructurePlacement(type) {
    const worker = state.units.find((u) => selected.has(u.id) && u.owner === "player" && u.type === "worker");
    if (!worker) {
      say("Select a worker first, then choose a building.");
      return;
    }
    if ((type === "extractor" || type === "forge") && !readyStructure("production")) {
      say("Build a Barracks to unlock advanced worker buildings.");
      return;
    }
    placement = { type, workerId: worker.id, x: worker.x + 90, y: worker.y - 70, resourceId: null };
    say(type === "extractor" ? "Place the Extractor on a lollipop geyser." : "Place the building on open ground. Right click cancels.");
  }

  function buildSupply() {
    beginStructurePlacement("supply");
  }

  function buildProduction() {
    beginStructurePlacement("production");
  }

  function buildBase() {
    beginStructurePlacement("base");
  }

  function buildExtractor() {
    beginStructurePlacement("extractor");
  }

  function buildForge() {
    beginStructurePlacement("forge");
  }

  function canPlace(type, x, y, owner = "player") {
    const s = stats[type];
    if ((type === "extractor" || type === "forge") && !readyStructure("production", owner)) return false;
    if (!isInBuildZone(type, x, y, owner)) return false;
    if (type === "extractor") return Boolean(lollipopGeyserAt(x, y));
    if (sideFor(owner).faction === "fire" && type !== "base" && !isWarmWool(x, y, owner)) return false;
    if (x < s.radius || y < s.radius || x > world.w - s.radius || y > world.h - s.radius) return false;
    if (type === "base" && state.structures.some((structure) => structure.type === "base" && Math.hypot(structure.x - x, structure.y - y) < 280)) return false;
    const blockers = [
      ...state.structures,
      ...state.resources.filter((resource) => !(type === "base" && resource.type === "marshmallow"))
    ];
    return !blockers.some((blocker) => {
      const radius = blocker.radius || stats[blocker.type].radius;
      return Math.hypot(blocker.x - x, blocker.y - y) < radius + s.radius + 18;
    });
  }

  function isInBuildZone(type, x, y, owner = "player") {
    if (type === "base" && isExpansionBaseSpot(x, y)) return true;
    const structures = state.structures.filter((structure) => {
      return structure.owner === owner && !structure.underConstruction;
    });
    if (!structures.length) return false;
    return structures.some((structure) => {
      const radius = structure.type === "base" ? 720 : type === "extractor" ? 520 : 430;
      return Math.hypot(structure.x - x, structure.y - y) <= radius;
    });
  }

  function isExpansionBaseSpot(x, y) {
    return expansionSpots().some((spot) => Math.hypot(spot.x - x, spot.y - y) <= 190);
  }

  function lollipopGeyserAt(x, y) {
    return state.resources.find((resource) => {
      if (resource.type !== "lollipop" || resource.amount <= 0 || resource.coveredBy) return false;
      return Math.hypot(resource.x - x, resource.y - y) < resource.radius + 26;
    });
  }

  function isWarmWool(x, y, owner = "player") {
    return state.structures.some((structure) => {
      if (structure.owner !== owner || structure.faction !== "fire" || structure.underConstruction) return false;
      const radius = structure.type === "base" ? 360 : 230;
      return Math.hypot(structure.x - x, structure.y - y) <= radius;
    });
  }

  function finishPlacement() {
    if (!placement) return false;
    const worker = state.units.find((u) => u.id === placement.workerId);
    if (!worker) {
      placement = null;
      return true;
    }
    const geyser = placement.type === "extractor" ? lollipopGeyserAt(placement.x, placement.y) : null;
    if (!canPlace(placement.type, placement.x, placement.y, "player")) {
      say("Cannot build there.");
      return true;
    }
    if (isNetworkGuest) {
      sendNetworkCommand({
        action: "build",
        workerId: placement.workerId,
        type: placement.type,
        x: geyser ? geyser.x : placement.x,
        y: geyser ? geyser.y : placement.y,
        resourceId: geyser ? geyser.id : null
      });
      placement = null;
      say("Build order sent to the host.");
      return true;
    }
    if (!spend(placement.type)) return true;
    const buildX = geyser ? geyser.x : placement.x;
    const buildY = geyser ? geyser.y : placement.y;
    assignBuildTask(worker, placement.type, buildX, buildY, geyser ? geyser.id : null);
    placement = null;
    say("Worker moving to build site.");
    return true;
  }

  function assignBuildTask(worker, type, buildX, buildY, resourceId) {
    worker.buildTask = {
      type,
      x: buildX,
      y: buildY,
      resourceId,
      structureId: null,
      started: false
    };
    worker.target = null;
    worker.harvest = null;
    worker.tx = buildX;
    worker.ty = buildY;
  }

  function startConstruction(worker) {
    if (!worker.buildTask || worker.buildTask.started) return;
    const task = worker.buildTask;
    const structure = addStructure(worker.owner, sideFor(worker.owner).faction, task.type, task.x, task.y);
    structure.resourceId = task.resourceId;
    structure.underConstruction = true;
    structure.buildTime = buildTimes[task.type];
    structure.buildProgress = 0;
    structure.buildStarted = true;
    structure.hp = Math.max(1, Math.floor(structure.maxHp * 0.1));
    task.structureId = structure.id;
    task.started = true;
    if (task.resourceId) {
      const resource = state.resources.find((r) => r.id === task.resourceId);
      if (resource) resource.coveredBy = structure.id;
    }
    if (sideFor(worker.owner).faction === "fire") {
      state.units = state.units.filter((u) => u.id !== worker.id);
      selected.delete(worker.id);
      sideFor(worker.owner).woolUsed = Math.max(0, sideFor(worker.owner).woolUsed - stats.worker.wool);
      if (worker.owner === "player") say("The Kindling Lamb becomes the building.");
    } else {
      const exit = constructionExitPoint(structure, worker);
      worker.tx = exit.x;
      worker.ty = exit.y;
      if (worker.owner === "player") say("Construction started.");
    }
  }

  function constructionExitPoint(structure, worker) {
    const structureRadius = stats[structure.type].radius;
    const workerRadius = stats.worker.radius;
    const distance = structureRadius + workerRadius + 34;
    const angles = [-0.75, 0.75, -1.55, 1.55, Math.PI, 0, -2.35, 2.35];
    const originAngle = Math.atan2(worker.y - structure.y, worker.x - structure.x);

    for (let i = 0; i < angles.length; i += 1) {
      const angle = originAngle + angles[i];
      const x = Math.max(40, Math.min(world.w - 40, structure.x + Math.cos(angle) * distance));
      const y = Math.max(40, Math.min(world.h - 40, structure.y + Math.sin(angle) * distance));
      const blocked = [...state.structures, ...state.resources].some((entity) => {
        if (entity.id === structure.id) return false;
        const radius = entity.radius || stats[entity.type].radius;
        return Math.hypot(entity.x - x, entity.y - y) < radius + workerRadius + 12;
      });
      if (!blocked) return { x, y };
    }

    return {
      x: Math.max(40, Math.min(world.w - 40, structure.x - distance)),
      y: Math.max(40, Math.min(world.h - 40, structure.y + distance * 0.4))
    };
  }

  function completeConstruction(structure) {
    structure.underConstruction = false;
    structure.buildProgress = structure.buildTime;
    structure.hp = structure.maxHp;
    if (structure.owner === "player") {
      state.stats.structuresBuilt += 1;
      if (structure.type === "supply") state.player.woolMax += 8;
      if (structure.type === "supply") say("Supply building complete.");
      else if (structure.type === "extractor") say("Lollipop Extractor complete. Lolligas is flowing.");
      else if (structure.type === "forge") say("Forge complete. Armor upgrades unlocked.");
      else say("Barracks complete. Army training unlocked.");
    } else if (structure.type === "supply") {
      state.enemy.woolMax += 8;
    }
    state.units.forEach((unit) => {
      if (unit.buildTask && unit.buildTask.structureId === structure.id) {
        const exit = constructionExitPoint(structure, unit);
        unit.tx = exit.x;
        unit.ty = exit.y;
        unit.buildTask = null;
      }
    });
  }

  function updateConstructions(dt) {
    state.structures.forEach((structure) => {
      if (!structure.underConstruction || !structure.buildStarted) return;
      structure.buildProgress += dt;
      structure.hp = Math.max(1, Math.floor(structure.maxHp * Math.min(1, structure.buildProgress / structure.buildTime)));
      if (structure.buildProgress >= structure.buildTime) completeConstruction(structure);
    });
  }

  function updateExtractors(dt) {
    state.structures.forEach((structure) => {
      if (structure.type !== "extractor" || structure.underConstruction) return;
      if (structure.owner === "player") state.player.lollipops += dt * 1.8;
      else state.enemy.lollipops += dt * 1.8;
    });
  }

  function startUpgrade(type) {
    const upgrade = upgrades[type];
    if (!readyStructure("forge")) {
      say("Build a Forge before researching armor.");
      return;
    }
    if (!upgrade || upgrade.researched) {
      say("That upgrade is already researched.");
      return;
    }
    if (upgrade.inProgress) {
      say("Upgrade already researching.");
      return;
    }
    if (type === "eliteArmor" && !upgrades.armor.researched) {
      say("Research Armor before Elite Armor.");
      return;
    }
    if (!spend(type)) return;
    upgrade.inProgress = true;
    upgrade.elapsed = 0;
    say(type === "eliteArmor" ? "Elite armor research started." : "Armor research started.");
  }

  function updateUpgrades(dt) {
    Object.keys(upgrades).forEach((type) => {
      const upgrade = upgrades[type];
      if (!upgrade.inProgress) return;
      if (!readyStructure("forge")) {
        upgrade.inProgress = false;
        say("Forge destroyed. Upgrade research stopped.");
        return;
      }
      upgrade.elapsed += dt;
      if (upgrade.elapsed >= upgrade.duration) completeUpgrade(type);
    });
  }

  function completeUpgrade(type) {
    const upgrade = upgrades[type];
    upgrade.inProgress = false;
    upgrade.researched = true;
    const affected = type === "eliteArmor" ? ["elite"] : ["soldier", "heavy"];
    state.units.forEach((unit) => {
      if (unit.owner !== "player" || !affected.includes(unit.type)) return;
      const bonus = armorHpBonus(unit.type);
      unit.maxHp += bonus;
      unit.hp += bonus;
    });
    say(type === "eliteArmor" ? "Elite armor complete." : "Unit armor complete.");
  }

  function armorHpBonus(type) {
    if (type === "elite") return 50;
    if (type === "heavy") return 32;
    if (type === "soldier") return 18;
    return 0;
  }

  function castAbility(owner = "player") {
    const side = sideFor(owner);
    const faction = side.faction;
    if (side.marshmallows < 25) {
      if (owner === "player") say("Need 25 Marshmallows for " + factionData[faction].ability + ".");
      return;
    }
    side.marshmallows -= 25;
    const base = state.structures.find((s) => s.owner === owner && s.type === "base") || { x: camera.x + camera.w / 2, y: camera.y + camera.h / 2 };
    if (faction === "rainbow") {
      state.units.filter((u) => u.owner === owner).forEach((u) => {
        u.hp = Math.min(u.maxHp + 25, u.hp + 45);
      });
      burst(base.x, base.y, "#d8c4ff");
      if (owner === "player") say("Prism Burst shields the flock.");
    } else if (faction === "mech") {
      [...state.units, ...state.structures].filter((e) => e.owner === owner).forEach((e) => {
        e.hp = Math.min(e.maxHp, e.hp + 70);
      });
      burst(base.x, base.y, "#8dd5ef");
      if (owner === "player") say("Repair Pulse restores machines and friends.");
    } else {
      state.units.filter((u) => u.owner === owner).forEach((u) => {
        u.tx += owner === "player" ? 160 : -160;
        u.ty += (Math.random() - 0.5) * 120;
      });
      burst(base.x, base.y, "#ff9c45");
      if (owner === "player") say("Warm Wool surges under the flock.");
    }
  }

  function applyRemoteCommand(command) {
    const owner = "enemy";
    if (command.action === "command") {
      applyUnitCommand(owner, command.unitIds || [], Number(command.x), Number(command.y));
    } else if (command.action === "attackMove") {
      applyAttackMove(owner, command.unitIds || [], Number(command.x), Number(command.y));
    } else if (command.action === "train") {
      queueTraining(command.type, owner);
    } else if (command.action === "build") {
      const worker = state.units.find((u) => u.id === command.workerId && u.owner === owner && u.type === "worker");
      if (!worker) return;
      const type = command.type;
      const x = Number(command.x);
      const y = Number(command.y);
      const geyser = type === "extractor" ? lollipopGeyserAt(x, y) : null;
      if (!canPlace(type, x, y, owner)) return;
      if (!spend(type, owner)) return;
      assignBuildTask(worker, type, geyser ? geyser.x : x, geyser ? geyser.y : y, geyser ? geyser.id : command.resourceId || null);
    } else if (command.action === "ability") {
      castAbility(owner);
    }
  }

  function burst(x, y, color) {
    state.effects.push({ x, y, r: 10, life: 0.7, color });
  }

  function fireBullet(unit, target, color) {
    const dx = target.x - unit.x;
    const dy = target.y - unit.y;
    const d = Math.hypot(dx, dy) || 1;
    const startDistance = stats[unit.type].radius + 4;
    const endDistance = stats[target.type].radius * 0.55;
    state.effects.push({
      kind: "bullet",
      x: unit.x + (dx / d) * startDistance,
      y: unit.y + (dy / d) * startDistance,
      tx: target.x - (dx / d) * endDistance,
      ty: target.y - (dy / d) * endDistance,
      life: 1,
      color
    });
  }

  function updateEffects() {
    state.effects = state.effects.filter((effect) => {
      effect.life -= effect.kind === "bullet" ? 0.12 : 1 / 60;
      if (effect.kind !== "bullet") effect.r += 2.2;
      return effect.life > 0;
    });
  }

  function selectableAt(wx, wy) {
    const all = [...state.units, ...state.structures].filter((e) => e.owner === "player");
    for (let i = all.length - 1; i >= 0; i -= 1) {
      if (Math.hypot(all[i].x - wx, all[i].y - wy) < stats[all[i].type].radius + 8) return all[i];
    }
    return null;
  }

  function targetAt(wx, wy, owner = "player") {
    const enemies = [...state.units, ...state.structures].filter((e) => isHostileTo(owner, e));
    const resources = state.resources.filter((r) => r.amount > 0 && !r.coveredBy);
    const all = [...enemies, ...resources];
    for (let i = all.length - 1; i >= 0; i -= 1) {
      const r = all[i].radius || stats[all[i].type].radius;
      if (Math.hypot(all[i].x - wx, all[i].y - wy) < r + 12) return all[i];
    }
    return null;
  }

  function issueCommand(wx, wy) {
    const units = state.units.filter((u) => selected.has(u.id));
    if (!units.length) {
      say("Select your sheep first, then right-click where you want them to go.");
      return;
    }
    if (isNetworkGuest) {
      sendNetworkCommand({ action: "command", unitIds: units.map((u) => u.id), x: wx, y: wy });
      state.effects.push({ x: wx, y: wy, r: 6, life: 0.8, color: "#9cffb7", kind: "move" });
      say("Command sent.");
      return;
    }
    applyUnitCommand("player", units.map((u) => u.id), wx, wy);
    state.effects.push({ x: wx, y: wy, r: 6, life: 0.8, color: "#9cffb7", kind: "move" });
  }

  function applyUnitCommand(owner, unitIds, wx, wy) {
    const units = state.units.filter((u) => unitIds.includes(u.id) && u.owner === owner);
    if (!units.length) return;
    const target = targetAt(wx, wy, owner);
    units.forEach((unit, index) => {
      const offset = formationOffset(index, units.length);
      if (target && target.kind && isHostileTo(owner, target)) {
        unit.target = target.id;
        unit.attackMove = false;
        unit.attackX = null;
        unit.attackY = null;
        unit.harvest = null;
        const stop = attackStopPoint(unit, target, index, units.length);
        unit.tx = stop.x;
        unit.ty = stop.y;
      } else if (target && target.amount && target.type === "marshmallow" && unit.type === "worker") {
        unit.harvest = target.id;
        unit.target = null;
        unit.attackMove = false;
        unit.attackX = null;
        unit.attackY = null;
        unit.tx = target.x + offset.x * 0.5;
        unit.ty = target.y + offset.y * 0.5;
      } else if (target && target.amount && target.type === "lollipop" && unit.type === "worker") {
        if (owner === "player") say("Build a Lollipop Extractor on this geyser to collect Lolligas.");
      } else {
        unit.target = null;
        unit.harvest = null;
        unit.attackMove = false;
        unit.attackX = null;
        unit.attackY = null;
        unit.tx = wx + offset.x;
        unit.ty = wy + offset.y;
      }
    });
  }

  function issueAttackMove(wx, wy) {
    const units = state.units.filter((u) => selected.has(u.id) && u.kind !== "structure");
    if (!units.length) {
      say("Select units before using attack move.");
      return;
    }
    if (isNetworkGuest) {
      sendNetworkCommand({ action: "attackMove", unitIds: units.map((u) => u.id), x: wx, y: wy });
      state.effects.push({ x: wx, y: wy, r: 8, life: 1.1, color: "#ffef7a", kind: "attack" });
      commandMode = null;
      say("Attack move sent.");
      return;
    }
    applyAttackMove("player", units.map((u) => u.id), wx, wy);
    if (tutorialMode) tutorial.attackMoveIssued = true;
    state.effects.push({ x: wx, y: wy, r: 8, life: 1.1, color: "#ffef7a", kind: "attack" });
    commandMode = null;
    say("Attack move issued.");
  }

  function applyAttackMove(owner, unitIds, wx, wy) {
    const units = state.units.filter((u) => unitIds.includes(u.id) && u.owner === owner && u.kind !== "structure");
    if (!units.length) return;
    const target = targetAt(wx, wy, owner);
    units.forEach((unit, index) => {
      const offset = formationOffset(index, units.length);
      unit.harvest = null;
      unit.attackMove = true;
      unit.attackX = wx + offset.x;
      unit.attackY = wy + offset.y;
      if (target && target.kind && isHostileTo(owner, target)) {
        unit.target = target.id;
        const stop = attackStopPoint(unit, target, index, units.length);
        unit.tx = stop.x;
        unit.ty = stop.y;
      } else {
        unit.target = null;
        unit.tx = wx + offset.x;
        unit.ty = wy + offset.y;
      }
    });
  }

  function formationOffset(index, total) {
    const columns = Math.ceil(Math.sqrt(total));
    const row = Math.floor(index / columns);
    const col = index % columns;
    return {
      x: (col - (columns - 1) / 2) * 38,
      y: (row - (Math.ceil(total / columns) - 1) / 2) * 38
    };
  }

  function attackStopPoint(unit, target, index = 0, total = 1) {
    const targetRadius = stats[target.type].radius;
    const unitRadius = stats[unit.type].radius;
    const range = Math.max(18, stats[unit.type].range);
    const desired = target.kind === "structure"
      ? targetRadius + Math.max(unitRadius + 8, Math.min(range * 0.62, 58))
      : targetRadius + Math.max(unitRadius * 0.8, Math.min(range * 0.4, 44));
    const baseAngle = Math.atan2(unit.y - target.y, unit.x - target.x) || 0;
    const spread = (index - (total - 1) / 2) * 0.22;
    const angle = baseAngle + spread;
    return {
      x: Math.max(35, Math.min(world.w - 35, target.x + Math.cos(angle) * desired)),
      y: Math.max(35, Math.min(world.h - 35, target.y + Math.sin(angle) * desired))
    };
  }

  function dropOffPoint(unit, base) {
    const baseRadius = stats[base.type].radius;
    const unitRadius = stats[unit.type].radius;
    const desired = baseRadius + unitRadius + 18;
    const angle = Math.atan2(unit.y - base.y, unit.x - base.x) || 0;
    return {
      x: Math.max(35, Math.min(world.w - 35, base.x + Math.cos(angle) * desired)),
      y: Math.max(35, Math.min(world.h - 35, base.y + Math.sin(angle) * desired))
    };
  }

  function nearestBase(owner, x, y) {
    return state.structures
      .filter((structure) => structure.owner === owner && structure.type === "base" && !structure.underConstruction)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0] || null;
  }

  function pushUnitOutOfBuildings(unit) {
    state.structures.forEach((structure) => {
      if (structure.underConstruction && structure.buildProgress < structure.buildTime * 0.25) return;
      const minDistance = stats[structure.type].radius + stats[unit.type].radius + 10;
      const dx = unit.x - structure.x;
      const dy = unit.y - structure.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= minDistance) return;
      const nx = distance ? dx / distance : 1;
      const ny = distance ? dy / distance : 0;
      unit.x = structure.x + nx * minDistance;
      unit.y = structure.y + ny * minDistance;
      if (Math.hypot(unit.tx - structure.x, unit.ty - structure.y) < minDistance) {
        unit.tx = unit.x;
        unit.ty = unit.y;
      }
    });
  }

  function update(dt) {
    if (state.ended) return;
    state.elapsed += dt;
    messageTimer -= dt;
    if (messageTimer <= 0) toast.textContent = "Gather Marshmallows, scout, and destroy the enemy main base.";

    network.tick += dt;
    if (network.enabled && roomSettings.matchType === "ffa") {
      network.lastRoomPoll += dt;
      if (network.lastRoomPoll > networkRates.roomPoll) {
        network.lastRoomPoll = 0;
        refreshOnlineRoom();
      }
    }
    if (isNetworkGuest) {
      network.lastSnapshotPoll += dt;
      if (network.lastSnapshotPoll > networkRates.guestSnapshot) {
        network.lastSnapshotPoll = 0;
        pollNetworkSnapshot();
      }
      updateEffects();
      updateUi();
      return;
    }

    aiTimer += dt;
    aiBuildTimer += dt;
    attackWaveTimer += dt;

    if (isNetworkHost) {
      network.lastCommandPoll += dt;
      network.lastSnapshotPoll += dt;
      if (network.lastCommandPoll > networkRates.commandPoll) {
        network.lastCommandPoll = 0;
        pollNetworkCommands();
      }
      if (network.lastSnapshotPoll > networkRates.hostSnapshot) {
        network.lastSnapshotPoll = 0;
        publishNetworkSnapshot();
      }
    }

    if (!network.enabled && !tutorialMode && aiTimer > aiProfile.think) {
      aiTimer = 0;
      enemyThink();
    }

    if (!network.enabled && !tutorialMode) state.enemy.marshmallows += dt * aiProfile.drip;

    updateTraining(dt);
    state.units.forEach((unit) => updateUnit(unit, dt));
    updateConstructions(dt);
    updateExtractors(dt);
    updateUpgrades(dt);
    fight(dt);
    cleanup();
    updateTutorial();
    updateUi();
  }

  function updateUnit(unit, dt) {
    unit.cooldown = Math.max(0, unit.cooldown - dt);
    if (unit.buildTask) {
      unit.target = null;
      unit.attackMove = false;
      unit.harvest = null;
      unit.tx = unit.buildTask.x;
      unit.ty = unit.buildTask.y;
      if (Math.hypot(unit.x - unit.buildTask.x, unit.y - unit.buildTask.y) < 38) {
        startConstruction(unit);
      }
    }
    if (unit.harvest) {
      const resource = state.resources.find((r) => r.id === unit.harvest && r.amount > 0);
      const base = resource ? nearestBase(unit.owner, resource.x, resource.y) : null;
      if (!resource || !base) {
        unit.harvest = null;
      } else if (unit.carry >= 10) {
        const drop = dropOffPoint(unit, base);
        unit.tx = drop.x;
        unit.ty = drop.y;
        if (dist(unit, base) < stats.base.radius + stats.worker.radius + 34) {
          if (unit.owner === "player") state.player.marshmallows += unit.carry;
          else state.enemy.marshmallows += unit.carry;
          if (unit.owner === "player") state.stats.marshmallowsGathered += Math.floor(unit.carry);
          unit.carry = 0;
          unit.tx = resource.x;
          unit.ty = resource.y;
        }
      } else if (dist(unit, resource) < resource.radius + 18) {
        const take = Math.min(resource.amount, dt * 18);
        resource.amount -= take;
        unit.carry += take;
      } else {
        unit.tx = resource.x;
        unit.ty = resource.y;
      }
    }

    if (unit.target) {
      const target = [...state.units, ...state.structures].find((e) => e.id === unit.target);
      if (target) {
        const stop = attackStopPoint(unit, target);
        unit.tx = stop.x;
        unit.ty = stop.y;
      } else {
        unit.target = null;
        if (unit.attackMove && unit.attackX !== null && unit.attackY !== null) {
          unit.tx = unit.attackX;
          unit.ty = unit.attackY;
        } else if (unit.attackMove) {
          unit.attackMove = false;
        }
      }
    }

    const speed = stats[unit.type].speed;
    const dx = unit.tx - unit.x;
    const dy = unit.ty - unit.y;
    const d = Math.hypot(dx, dy);
    if (speed && d > 4) {
      const step = Math.min(d, speed * dt);
      unit.x += (dx / d) * step;
      unit.y += (dy / d) * step;
      unit.x = Math.max(30, Math.min(world.w - 30, unit.x));
      unit.y = Math.max(30, Math.min(world.h - 30, unit.y));
      pushUnitOutOfBuildings(unit);
    } else if (unit.attackMove && !unit.target && unit.attackX !== null && unit.attackY !== null) {
      unit.attackMove = false;
      unit.attackX = null;
      unit.attackY = null;
    }
  }

  function fight(dt) {
    state.units.forEach((unit) => {
      const s = stats[unit.type];
      if (!s.damage) return;
      const enemies = [...state.units, ...state.structures].filter((e) => isHostileTo(unit.owner, e));
      let target = unit.target ? enemies.find((e) => e.id === unit.target) : null;
      if (!target) {
        target = enemies.find((e) => Math.hypot(e.x - unit.x, e.y - unit.y) < s.range + stats[e.type].radius);
        if (target && unit.attackMove) unit.target = target.id;
      }
      if (!target) return;
      const d = Math.hypot(target.x - unit.x, target.y - unit.y);
      if (d > s.range + stats[target.type].radius) return;
      if (unit.cooldown <= 0) {
        unit.cooldown = s.cooldown;
        target.hp -= damageAfterArmor(s.damage, target);
        if (s.range > 55) fireBullet(unit, target, factionData[unit.faction].accent);
        else burst(target.x, target.y, factionData[unit.faction].accent);
        if (target.type === "base" && target.hp <= 0) {
          if (target.owner === "enemy") state.stats.enemiesDestroyed += 1;
        }
      }
    });
  }

  function damageAfterArmor(damage, target) {
    if (target.owner !== "player" || target.kind !== "unit") return damage;
    if (target.type === "elite" && upgrades.eliteArmor.researched) return Math.max(1, damage - 5);
    if ((target.type === "soldier" || target.type === "heavy") && upgrades.armor.researched) return Math.max(1, damage - 3);
    return damage;
  }

  function cleanup() {
    state.units = state.units.filter((u) => {
      if (u.hp > 0) return true;
      selected.delete(u.id);
      sideFor(u.owner).woolUsed = Math.max(0, sideFor(u.owner).woolUsed - stats[u.type].wool);
      if (u.owner === "player") state.stats.unitsLost += 1;
      if (u.owner === "enemy") state.stats.enemiesDestroyed += 1;
      return false;
    });
    state.structures = state.structures.filter((s) => {
      if (s.hp > 0) return true;
      if (s.type === "extractor" && s.resourceId) {
        const resource = state.resources.find((r) => r.id === s.resourceId);
        if (resource) resource.coveredBy = null;
      }
      if (s.owner === "enemy") state.stats.enemiesDestroyed += 1;
      return false;
    });
    updateEffects();

    const enemyBase = state.structures.find((s) => s.owner === "enemy" && s.type === "base");
    const playerBase = state.structures.find((s) => s.owner === "player" && s.type === "base");
    if (!enemyBase) endMatch("victory");
    if (!playerBase) endMatch("defeat");
  }

  function formatTime(seconds) {
    const whole = Math.floor(seconds);
    const minutes = Math.floor(whole / 60);
    const rest = String(whole % 60).padStart(2, "0");
    return minutes + ":" + rest;
  }

  function endMatch(result) {
    if (state.ended) return;
    state.ended = true;
    showScoreScreen(result);
  }

  function showScoreScreen(result) {
    ui.music.pause();
    ui.music.currentTime = 0;
    ui.musicToggle.textContent = "Music Off";
    ui.musicToggle.setAttribute("aria-pressed", "false");
    ui.scoreTitle.textContent = result === "victory" ? "Victory" : "Defeat";
    ui.scoreSummary.textContent = result === "victory"
      ? "You destroyed the enemy main base and claimed the meadow."
      : "Your main base was destroyed. The meadow is lost.";
    ui.scoreTime.textContent = formatTime(state.elapsed);
    ui.scoreUnits.textContent = state.stats.unitsCreated;
    ui.scoreLost.textContent = state.stats.unitsLost;
    ui.scoreKills.textContent = state.stats.enemiesDestroyed;
    ui.scoreBuildings.textContent = state.stats.structuresBuilt;
    ui.scoreResources.textContent = state.stats.marshmallowsGathered;
    ui.scoreScreen.hidden = false;
  }

  async function startMatchMusic() {
    if (!ui.music.paused || state.ended) return;
    ui.music.volume = 0.45;
    try {
      await ui.music.play();
      ui.musicToggle.textContent = "Music On";
      ui.musicToggle.setAttribute("aria-pressed", "true");
    } catch (_error) {
      ui.musicToggle.textContent = "Music Off";
      ui.musicToggle.setAttribute("aria-pressed", "false");
    }
  }

  function enemyThink() {
    const base = state.structures.find((s) => s.owner === "enemy" && s.type === "base");
    const playerBase = state.structures.find((s) => s.owner === "player" && s.type === "base");
    if (!base || !playerBase) return;

    state.enemy.marshmallows += aiProfile.burst;
    if (state.elapsed > aiProfile.gasDelay) state.enemy.lollipops += aiProfile.gas;
    let production = state.structures.find((s) => s.owner === "enemy" && s.type === "production" && !s.underConstruction);
    const rebuildingProduction = state.structures.some((s) => s.owner === "enemy" && s.type === "production" && s.underConstruction);
    if (!production) {
      if (!rebuildingProduction && aiBuildTimer > 24 && state.enemy.marshmallows >= costs.production.m) {
        aiBuildTimer = 0;
        state.enemy.marshmallows -= costs.production.m;
        const rebuilt = addStructure("enemy", state.enemy.faction, "production", base.x - 95, base.y - 125);
        rebuilt.underConstruction = true;
        rebuilt.buildTime = buildTimes.production + 6;
        rebuilt.buildProgress = 0;
        rebuilt.buildStarted = true;
        rebuilt.hp = Math.max(1, Math.floor(rebuilt.maxHp * 0.1));
        if (visibleToPlayer(rebuilt)) say("Enemy Barracks rebuilding near their base.");
      }
      return;
    }
    const enemyArmy = state.units.filter((u) => u.owner === "enemy" && u.type !== "worker");
    const armyCap = state.elapsed < 90 ? aiProfile.caps[0] : state.elapsed < 150 ? aiProfile.caps[1] : aiProfile.caps[2];
    if (state.enemy.marshmallows >= 75 && enemyArmy.length < armyCap) {
      const type = state.elapsed > aiProfile.heavyDelay && state.enemy.lollipops >= 35 && Math.random() > aiProfile.heavyChance ? "heavy" : "soldier";
      if (state.enemy.lollipops >= costs[type].l && state.enemy.marshmallows >= costs[type].m) {
        state.enemy.lollipops -= costs[type].l;
        state.enemy.marshmallows -= costs[type].m;
        const unit = addUnit("enemy", state.enemy.faction, type, production.x - 60, production.y + (Math.random() - 0.5) * 90);
        unit.tx = production.x - 120 + Math.random() * 70;
        unit.ty = production.y - 90 + Math.random() * 180;
      }
    }

    const playerCrossedMap = state.units.some((u) => u.owner === "player" && u.x > world.w * 0.55);
    const waveReady = state.elapsed > aiProfile.waveDelay && attackWaveTimer > aiProfile.waveCooldown && enemyArmy.length >= 4;
    if (!playerCrossedMap && !waveReady) {
      return;
    }

    attackWaveTimer = 0;
    enemyArmy.slice(0, aiProfile.waveSize).forEach((u, index) => {
      const offset = formationOffset(index, Math.min(aiProfile.waveSize, enemyArmy.length));
      u.target = null;
      u.harvest = null;
      u.attackMove = true;
      u.attackX = playerBase.x + offset.x;
      u.attackY = playerBase.y + offset.y;
      u.tx = u.attackX;
      u.ty = u.attackY;
    });
    say("Enemy attack-move wave spotted. Rally the flock.");
  }

  function visibleToPlayer(e) {
    if (ownersAreAllied("player", e.owner)) return true;
    const scouts = [...state.units, ...state.structures].filter((x) => ownersAreAllied("player", x.owner));
    return scouts.some((s) => Math.hypot(s.x - e.x, s.y - e.y) < (s.type === "base" ? 520 : 330));
  }

  function draw() {
    ctx.clearRect(0, 0, camera.w, camera.h);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawTerrain();
    drawWarmWool();
    drawFog();
    state.resources.forEach(drawResource);
    state.structures.forEach((s) => {
      if (visibleToPlayer(s)) drawEntity(s);
    });
    state.units.forEach((u) => {
      if (visibleToPlayer(u)) drawEntity(u);
    });
    state.effects.forEach(drawEffect);
    drawPlacementGhost();
    drawCommandCursor();
    ctx.restore();
    drawSelectionBox();
    drawMinimap();
  }

  function drawTerrain() {
    ctx.fillStyle = activeMap.tint;
    ctx.fillRect(0, 0, world.w, world.h);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let x = 0; x < world.w; x += 120) {
      for (let y = 0; y < world.h; y += 120) {
        ctx.beginPath();
        ctx.arc(x + 40, y + 70, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    activeMap.clearings.forEach((clearing) => {
      ctx.ellipse(clearing[0], clearing[1], clearing[2], clearing[3], clearing[4], 0, Math.PI * 2);
    });
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, activeMap.riverY);
    ctx.bezierCurveTo(700, activeMap.riverY - 160, 1300, activeMap.riverY + 130, 2400, activeMap.riverY - 60);
    ctx.stroke();
  }

  function drawWarmWool() {
    if (state.player.faction !== "fire") return;
    ctx.save();
    state.structures.forEach((structure) => {
      if (structure.owner !== "player" || structure.faction !== "fire" || structure.underConstruction) return;
      const radius = structure.type === "base" ? 360 : 230;
      const grad = ctx.createRadialGradient(structure.x, structure.y, 20, structure.x, structure.y, radius);
      grad.addColorStop(0, "rgba(255, 132, 62, 0.24)");
      grad.addColorStop(1, "rgba(255, 132, 62, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(structure.x, structure.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 184, 84, 0.28)";
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.arc(structure.x, structure.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawResource(r) {
    if (r.amount <= 0 || r.coveredBy) return;
    ctx.save();
    ctx.translate(r.x, r.y);
    if (r.type === "lollipop") {
      for (let i = 0; i < 5; i += 1) {
        const a = (Math.PI * 2 * i) / 5;
        ctx.fillStyle = i % 2 ? "#ff8ba5" : "#fff1b8";
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 20, Math.sin(a) * 13, 17, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#fff";
      ctx.fillRect(-3, 10, 6, 38);
    } else {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(0, 0, 50, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(141,213,239,0.5)";
      ctx.beginPath();
      ctx.arc(8, -8, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEntity(e) {
    const s = stats[e.type];
    const f = factionData[e.faction];
    ctx.save();
    ctx.translate(e.x, e.y);
    if (selected.has(e.id)) {
      ctx.strokeStyle = "#fff47a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 8, s.radius + 10, (s.radius + 10) * 0.56, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(0, s.radius * 0.7, s.radius * 1.2, s.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    if (e.kind === "structure") drawStructureShape(e, f, s);
    else drawUnitShape(e, f, s);

    drawHealth(e, s);
    if (e.underConstruction) drawProgressBar(e.buildProgress, e.buildTime, s.radius, "#f2bf4d");
    const trainingJob = e.kind === "structure" && !e.underConstruction ? state.training.find((job) => job.producerId === e.id) : null;
    if (trainingJob) drawProgressBar(trainingJob.elapsed, trainingJob.duration, s.radius, "#83e79a");
    ctx.restore();
  }

  function drawUnitShape(e, f, s) {
    const sprite = unitSpriteCrop(e);
    if (unitSprites.complete && unitSprites.naturalWidth) {
      ctx.save();
      const scale = e.type === "elite" ? 7.2 : e.type === "worker" ? 6.25 : e.type === "heavy" ? 6.9 : 6.6;
      const drawW = s.radius * scale;
      const drawH = s.radius * scale;
      ctx.drawImage(unitSprites, sprite.x, sprite.y, sprite.w, sprite.h, -drawW / 2, -drawH / 2 - 18, drawW, drawH);
      ctx.restore();
    } else if (poster.complete && poster.naturalWidth) {
      const crop = atlasCrop(e);
      ctx.save();
      const drawW = s.radius * 4.65;
      const drawH = s.radius * 5.15;
      ctx.beginPath();
      ctx.ellipse(0, -5, s.radius * 1.18, s.radius * 1.28, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(poster, crop.x, crop.y, crop.w, crop.h, -drawW / 2, -drawH * 0.66, drawW, drawH);
      ctx.restore();
    }
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -4, s.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
    if (e.carry > 0) {
      ctx.fillStyle = "#ff8ba5";
      ctx.beginPath();
      ctx.arc(s.radius - 2, -s.radius, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStructureShape(e, f, s) {
    const crop = buildingCrop(e);
    const isBase = e.type === "base";
    const drawW = s.radius * (isBase ? 3.45 : 2.35);
    const drawH = s.radius * (isBase ? 3.0 : 1.95);
    const drawY = isBase ? -drawH * 0.74 : -drawH * 0.62;
    if (buildingsPoster.complete && buildingsPoster.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-drawW / 2, drawY, drawW, drawH);
      ctx.clip();
      ctx.drawImage(buildingsPoster, crop.x, crop.y, crop.w, crop.h, -drawW / 2, drawY, drawW, drawH);
      ctx.restore();
    }
    ctx.strokeStyle = e.type === "base" ? f.color : f.accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, 6, s.radius * 1.2, s.radius * 0.76, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function unitSpriteCrop(e) {
    const rows = { rainbow: 0, mech: 1, fire: 2 };
    const cols = { worker: 0, soldier: 1, heavy: 2, elite: 3 };
    const cell = 256;
    return {
      x: (cols[e.type] || 0) * cell,
      y: (rows[e.faction] || 0) * cell,
      w: cell,
      h: cell
    };
  }

  function atlasCrop(e) {
    const f = factionData[e.faction].atlas;
    const w = poster.naturalWidth || 3072;
    const h = poster.naturalHeight || 1792;
    const colX = f[0] * w;
    const colY = f[1] * h;
    const colW = f[2] * w;
    const colH = f[3] * h;
    const positions = {
      rainbow: {
        worker: { x: 0.08, y: 0.03, w: 0.18, h: 0.15 },
        soldier: { x: 0.36, y: 0.04, w: 0.15, h: 0.13 },
        heavy: { x: 0.55, y: 0.04, w: 0.16, h: 0.13 },
        elite: { x: 0.55, y: 0.39, w: 0.20, h: 0.15 }
      },
      mech: {
        worker: { x: 0.07, y: 0.03, w: 0.17, h: 0.15 },
        soldier: { x: 0.34, y: 0.04, w: 0.15, h: 0.13 },
        heavy: { x: 0.50, y: 0.04, w: 0.16, h: 0.13 },
        elite: { x: 0.45, y: 0.36, w: 0.20, h: 0.15 }
      },
      fire: {
        worker: { x: 0.07, y: 0.03, w: 0.17, h: 0.15 },
        soldier: { x: 0.34, y: 0.04, w: 0.14, h: 0.13 },
        heavy: { x: 0.06, y: 0.28, w: 0.16, h: 0.13 },
        elite: { x: 0.46, y: 0.66, w: 0.20, h: 0.15 }
      }
    };
    const p = (positions[e.faction] && positions[e.faction][e.type]) || positions.rainbow.soldier;
    return { x: colX + p.x * colW, y: colY + p.y * colH, w: p.w * colW, h: p.h * colH };
  }

  function buildingCrop(e) {
    const rows = { rainbow: 0, mech: 1, fire: 2 };
    const cols = { base: 0, supply: 1, production: 2, extractor: 3, forge: 4 };
    const cellW = (buildingsPoster.naturalWidth || 1800) / 5;
    const cellH = (buildingsPoster.naturalHeight || 780) / 3;
    return {
      x: (cols[e.type] ?? 2) * cellW,
      y: (rows[e.faction] ?? 0) * cellH,
      w: cellW,
      h: cellH
    };
  }

  function drawHealth(e, s) {
    const pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(-s.radius, -s.radius - 22, s.radius * 2, 5);
    ctx.fillStyle = ownersAreAllied("player", e.owner) ? "#84f09b" : "#ff725e";
    ctx.fillRect(-s.radius, -s.radius - 22, s.radius * 2 * pct, 5);
  }

  function drawProgressBar(value, max, radius, color) {
    if (!max) return;
    const pct = Math.max(0, Math.min(1, value / max));
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(-radius, radius + 16, radius * 2, 6);
    ctx.fillStyle = color;
    ctx.fillRect(-radius, radius + 16, radius * 2 * pct, 6);
  }

  function drawEffect(e) {
    if (e.kind === "bullet") {
      const progress = 1 - Math.max(0, Math.min(1, e.life));
      const x = e.x + (e.tx - e.x) * progress;
      const y = e.y + (e.ty - e.y) * progress;
      const angle = Math.atan2(e.ty - e.y, e.tx - e.x);
      ctx.save();
      ctx.globalAlpha = Math.max(0.15, e.life);
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(angle) * 18, y - Math.sin(angle) * 18);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(angle) * 13, y - Math.sin(angle) * 13);
      ctx.lineTo(x + Math.cos(angle) * 5, y + Math.sin(angle) * 5);
      ctx.stroke();
      ctx.fillStyle = "#fff7be";
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * 5, y + Math.sin(angle) * 5, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (e.kind === "move") {
      ctx.save();
      ctx.strokeStyle = e.color;
      ctx.globalAlpha = Math.max(0, e.life);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(e.x - 14, e.y);
      ctx.lineTo(e.x + 14, e.y);
      ctx.moveTo(e.x, e.y - 14);
      ctx.lineTo(e.x, e.y + 14);
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (e.kind === "attack") {
      ctx.save();
      ctx.strokeStyle = e.color;
      ctx.globalAlpha = Math.max(0, e.life);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(e.x - e.r - 8, e.y - e.r - 8);
      ctx.lineTo(e.x + e.r + 8, e.y + e.r + 8);
      ctx.moveTo(e.x + e.r + 8, e.y - e.r - 8);
      ctx.lineTo(e.x - e.r - 8, e.y + e.r + 8);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.strokeStyle = e.color;
    ctx.globalAlpha = Math.max(0, e.life);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawPlacementGhost() {
    if (!placement) return;
    const ghost = placementGhostPosition();
    const valid = canPlace(placement.type, placement.x, placement.y);
    const s = stats[placement.type];
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.translate(ghost.x, ghost.y);
    drawStructureShape({ type: placement.type, faction: state.player.faction }, factionData[state.player.faction], s);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = valid ? "#7cff9a" : "#ff725e";
    ctx.fillStyle = valid ? "rgba(124,255,154,0.14)" : "rgba(255,114,94,0.16)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 8, s.radius * 1.35, s.radius * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function placementGhostPosition() {
    if (!placement || placement.type !== "extractor") return placement;
    const geyser = lollipopGeyserAt(placement.x, placement.y);
    return geyser ? { x: geyser.x, y: geyser.y } : placement;
  }

  function drawCommandCursor() {
    if (commandMode !== "attack" || placement) return;
    ctx.save();
    ctx.strokeStyle = "#ffef7a";
    ctx.fillStyle = "rgba(255, 239, 122, 0.12)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mouse.wx, mouse.wy, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mouse.wx - 36, mouse.wy);
    ctx.lineTo(mouse.wx - 12, mouse.wy);
    ctx.moveTo(mouse.wx + 12, mouse.wy);
    ctx.lineTo(mouse.wx + 36, mouse.wy);
    ctx.moveTo(mouse.wx, mouse.wy - 36);
    ctx.lineTo(mouse.wx, mouse.wy - 12);
    ctx.moveTo(mouse.wx, mouse.wy + 12);
    ctx.lineTo(mouse.wx, mouse.wy + 36);
    ctx.stroke();
    ctx.restore();
  }

  function drawFog() {
    fctx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
    fctx.fillStyle = "rgba(5,12,10,0.64)";
    fctx.fillRect(0, 0, camera.w, camera.h);
    fctx.globalCompositeOperation = "destination-out";
    [...state.units, ...state.structures].filter((e) => ownersAreAllied("player", e.owner)).forEach((e) => {
      const r = e.type === "base" ? 520 : 330;
      fctx.beginPath();
      fctx.arc(e.x - camera.x, e.y - camera.y, r, 0, Math.PI * 2);
      fctx.fillStyle = "rgba(0,0,0,0.92)";
      fctx.fill();
    });
    fctx.globalCompositeOperation = "source-over";
    ctx.drawImage(fogCanvas, camera.x, camera.y, camera.w, camera.h);
  }

  function drawSelectionBox() {
    if (!mouse.down) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const ratio = window.devicePixelRatio || 1;
    ctx.scale(ratio, ratio);
    const x = Math.min(mouse.sx, mouse.x);
    const y = Math.min(mouse.sy, mouse.y);
    const w = Math.abs(mouse.x - mouse.sx);
    const h = Math.abs(mouse.y - mouse.sy);
    ctx.fillStyle = "rgba(255,244,122,0.12)";
    ctx.strokeStyle = "#fff47a";
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  function drawMinimap() {
    mctx.clearRect(0, 0, mini.width, mini.height);
    mctx.fillStyle = "#4f985e";
    mctx.fillRect(0, 0, mini.width, mini.height);
    const sx = mini.width / world.w;
    const sy = mini.height / world.h;
    state.resources.forEach((r) => {
      if (r.amount <= 0 || r.coveredBy) return;
      mctx.fillStyle = r.type === "lollipop" ? "#ff8ba5" : "#fff";
      mctx.fillRect(r.x * sx - 2, r.y * sy - 2, 4, 4);
    });
    state.training.forEach((job) => {
      const producer = state.structures.find((s) => s.id === job.producerId);
      if (!producer || !visibleToPlayer(producer)) return;
      mctx.fillStyle = "#f2bf4d";
      mctx.fillRect(producer.x * sx - 3, producer.y * sy + 5, 6 * Math.min(1, job.elapsed / job.duration), 2);
    });
    [...state.structures, ...state.units].forEach((e) => {
      if (!visibleToPlayer(e)) return;
      mctx.fillStyle = ownersAreAllied("player", e.owner) ? "#7cff9a" : "#ff705d";
      mctx.beginPath();
      mctx.arc(e.x * sx, e.y * sy, e.kind === "structure" ? 4 : 2.5, 0, Math.PI * 2);
      mctx.fill();
    });
    mctx.strokeStyle = "#fff47a";
    mctx.lineWidth = 1;
    mctx.strokeRect(camera.x * sx, camera.y * sy, camera.w * sx, camera.h * sy);
  }

  function updateUi() {
    ui.lollipops.textContent = Math.floor(state.player.lollipops);
    ui.marshmallows.textContent = Math.floor(state.player.marshmallows);
    ui.wool.textContent = state.player.woolUsed + " / " + state.player.woolMax;
    const picked = [...state.units, ...state.structures].filter((e) => selected.has(e.id));
    showCommandGroups([]);
    if (!picked.length) {
      ui.title.textContent = "No Selection";
      ui.copy.textContent = "Select a worker, base, Barracks, or Forge to see its commands.";
      return;
    }
    const first = selectedCommandSubject(picked);
    const f = factionData[first.faction];
    const label = first.kind === "structure"
      ? (first.type === "base" ? f.base : first.type === "production" ? "Barracks" : first.type === "extractor" ? "Lollipop Extractor" : first.type === "forge" ? "Forge" : "Wool Capacity")
      : unitLabel(first.type, first.faction);
    const hasBarracks = Boolean(readyStructure("production"));
    const hasForge = Boolean(readyStructure("forge"));
    if (!first.underConstruction && first.kind === "unit" && first.type === "worker") {
      showCommandGroups(["basic-build", "advanced-build"]);
      ui.base.disabled = false;
      ui.supply.disabled = false;
      ui.production.disabled = false;
      ui.extractor.disabled = !hasBarracks;
      ui.forge.disabled = !hasBarracks;
    } else if (!first.underConstruction && first.kind === "structure" && first.type === "base") {
      showCommandGroups(["base"]);
      ui.worker.disabled = false;
      ui.ability.disabled = false;
    } else if (!first.underConstruction && first.kind === "structure" && first.type === "production") {
      showCommandGroups(["barracks"]);
      ui.soldier.disabled = false;
      ui.elite.disabled = !hasForge;
    } else if (!first.underConstruction && first.kind === "structure" && first.type === "forge") {
      showCommandGroups(["forge"]);
      ui.armor.disabled = upgrades.armor.researched || upgrades.armor.inProgress;
      ui.eliteArmor.disabled = !upgrades.armor.researched || upgrades.eliteArmor.researched || upgrades.eliteArmor.inProgress;
    }
    ui.title.textContent = picked.length === 1 ? label : picked.length + " selected";
    if (first.underConstruction) {
      ui.copy.textContent = "Constructing: " + Math.ceil(Math.max(0, first.buildTime - first.buildProgress)) + " seconds remaining.";
    } else if (first.kind === "unit" && first.type === "worker") {
      ui.copy.textContent = hasBarracks
        ? "Worker commands. Build extra bases at far marshmallow fields to expand."
        : "Worker commands. Build a Base, Supply, or Barracks. Barracks unlocks Extractor and Forge.";
    } else if (first.kind === "structure" && first.type === "base") {
      ui.copy.textContent = "Main base selected. Train workers here.";
    } else if (first.kind === "structure" && first.type === "production") {
      ui.copy.textContent = hasForge
        ? "Barracks selected. Train army units and elite units here."
        : "Barracks selected. Build a Forge to unlock elite units.";
    } else if (first.kind === "structure" && first.type === "forge") {
      ui.copy.textContent = activeUpgradeText() || (upgrades.armor.researched ? "Forge selected. Elite armor is unlocked." : "Forge selected. Research armor upgrades here.");
    } else {
      const producerQueue = first.kind === "structure" ? state.training.find((job) => job.producerId === first.id) : null;
      const forgeQueue = first.type === "forge" ? activeUpgradeText() : "";
      ui.copy.textContent = forgeQueue || (producerQueue
        ? "Training: " + Math.ceil(Math.max(0, producerQueue.duration - producerQueue.elapsed)) + " seconds remaining."
        : picked.length === 1 ? f.name + " " + label + ". Press A, then click to attack-move." : "Group ready. Right click to move or press A, then click to attack-move.");
    }
  }

  function activeUpgradeText() {
    if (upgrades.armor.inProgress) return "Researching Armor: " + Math.ceil(upgrades.armor.duration - upgrades.armor.elapsed) + " seconds remaining.";
    if (upgrades.eliteArmor.inProgress) return "Researching Elite Armor: " + Math.ceil(upgrades.eliteArmor.duration - upgrades.eliteArmor.elapsed) + " seconds remaining.";
    if (upgrades.armor.researched && upgrades.eliteArmor.researched) return "All armor upgrades complete.";
    return "";
  }

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("mousedown", (event) => {
    startMatchMusic();
    const p = screenToWorld(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.wx = p.wx;
    mouse.wy = p.wy;
    const moveClick = event.button === 2 || (event.button === 0 && event.ctrlKey);
    if (moveClick) {
      event.preventDefault();
      if (placement) {
        placement = null;
        say("Building placement cancelled.");
        return;
      }
      if (commandMode) {
        commandMode = null;
        say("Attack command cancelled.");
        return;
      }
      issueCommand(p.wx, p.wy);
      return;
    }
    if (event.button === 0 && commandMode === "attack") {
      issueAttackMove(p.wx, p.wy);
      return;
    }
    mouse.down = true;
    mouse.sx = p.x;
    mouse.sy = p.y;
  });

  canvas.addEventListener("mousemove", (event) => {
    const p = screenToWorld(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.wx = p.wx;
    mouse.wy = p.wy;
    if (placement) {
      placement.x = p.wx;
      placement.y = p.wy;
    }
    const edge = 22;
    if (p.x < edge) camera.x -= 16;
    if (p.x > camera.w - edge) camera.x += 16;
    if (p.y < edge) camera.y -= 16;
    if (p.y > camera.h - edge) camera.y += 16;
    camera.x = Math.max(0, Math.min(world.w - camera.w, camera.x));
    camera.y = Math.max(0, Math.min(world.h - camera.h, camera.y));
  });

  canvas.addEventListener("mouseup", (event) => {
    if (event.button !== 0) return;
    if (finishPlacement()) {
      mouse.down = false;
      return;
    }
    mouse.down = false;
    const dx = Math.abs(mouse.x - mouse.sx);
    const dy = Math.abs(mouse.y - mouse.sy);
    if (!event.shiftKey) selected.clear();
    if (dx < 6 && dy < 6) {
      const hit = selectableAt(mouse.wx, mouse.wy);
      if (hit) selected.add(hit.id);
    } else {
      const x1 = Math.min(mouse.sx, mouse.x) + camera.x;
      const x2 = Math.max(mouse.sx, mouse.x) + camera.x;
      const y1 = Math.min(mouse.sy, mouse.y) + camera.y;
      const y2 = Math.max(mouse.sy, mouse.y) + camera.y;
      state.units.filter((u) => u.owner === "player" && u.x >= x1 && u.x <= x2 && u.y >= y1 && u.y <= y2).forEach((u) => selected.add(u.id));
    }
  });

  mini.addEventListener("click", (event) => {
    const rect = mini.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * world.w;
    const y = ((event.clientY - rect.top) / rect.height) * world.h;
    camera.x = Math.max(0, Math.min(world.w - camera.w, x - camera.w / 2));
    camera.y = Math.max(0, Math.min(world.h - camera.h, y - camera.h / 2));
  });

  window.addEventListener("keydown", (event) => {
    if ((event.key === "a" || event.key === "A") && !event.ctrlKey && !event.metaKey) {
      const units = state.units.filter((u) => selected.has(u.id));
      if (!units.length) {
        say("Select one of your units first, then press A.");
        return;
      }
      commandMode = "attack";
      event.preventDefault();
      say("Attack move: click an enemy or a spot on the map.");
      return;
    }
    if (!/^[1-9]$/.test(event.key)) return;
    if (event.ctrlKey || event.metaKey) {
      controlGroups.set(event.key, [...selected]);
      say("Control group " + event.key + " saved.");
    } else if (controlGroups.has(event.key)) {
      selected.clear();
      controlGroups.get(event.key).forEach((id) => selected.add(id));
    }
  });

  ui.worker.addEventListener("click", () => {
    startMatchMusic();
    if (isNetworkGuest) sendNetworkCommand({ action: "train", type: "worker" });
    else queueTraining("worker");
  });
  ui.soldier.addEventListener("click", () => {
    startMatchMusic();
    if (isNetworkGuest) sendNetworkCommand({ action: "train", type: "soldier" });
    else queueTraining("soldier");
  });
  ui.elite.addEventListener("click", () => {
    startMatchMusic();
    if (isNetworkGuest) sendNetworkCommand({ action: "train", type: "elite" });
    else queueTraining("elite");
  });
  ui.supply.addEventListener("click", () => {
    startMatchMusic();
    buildSupply();
  });
  ui.base.addEventListener("click", () => {
    startMatchMusic();
    buildBase();
  });
  ui.production.addEventListener("click", () => {
    startMatchMusic();
    buildProduction();
  });
  ui.extractor.addEventListener("click", () => {
    startMatchMusic();
    buildExtractor();
  });
  ui.forge.addEventListener("click", () => {
    startMatchMusic();
    buildForge();
  });
  ui.armor.addEventListener("click", () => {
    startMatchMusic();
    startUpgrade("armor");
  });
  ui.eliteArmor.addEventListener("click", () => {
    startMatchMusic();
    startUpgrade("eliteArmor");
  });
  ui.ability.addEventListener("click", () => {
    startMatchMusic();
    if (isNetworkGuest) sendNetworkCommand({ action: "ability" });
    else castAbility();
  });
  ui.musicToggle.addEventListener("click", async () => {
    if (ui.music.paused) {
      await startMatchMusic();
    } else {
      ui.music.pause();
      ui.musicToggle.textContent = "Music Off";
      ui.musicToggle.setAttribute("aria-pressed", "false");
    }
  });
  ui.missionToggle.addEventListener("click", () => {
    setMissionPanelHidden(!tutorial.hidden);
  });
  if (ui.allianceToggle) {
    ui.allianceToggle.addEventListener("click", () => {
      ui.alliancePanel.hidden = !ui.alliancePanel.hidden;
      renderAlliancePanel();
    });
  }
  if (ui.allianceClose) {
    ui.allianceClose.addEventListener("click", () => {
      ui.alliancePanel.hidden = true;
    });
  }
  ui.scoreRematch.addEventListener("click", () => {
    window.location.reload();
  });

  function loop(now) {
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", fitCanvas);
  window.addEventListener("keydown", startMatchMusic, { once: true });
  fitCanvas();
  refreshOnlineRoom().finally(() => {
    setup();
    renderAlliancePanel();
    requestAnimationFrame(loop);
  });
})();
