(function () {
  const STORAGE_KEY = "magic-sheep-rts-rooms";
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const modeButtons = Array.from(document.querySelectorAll(".mode-button"));
  const modePanels = Array.from(document.querySelectorAll("[role='tabpanel']"));
  const hostForm = document.querySelector("#host-form");
  const joinForm = document.querySelector("#join-form");
  const trainForm = document.querySelector("#train-form");
  const roomTitle = document.querySelector("#room-title");
  const roomCodeDisplay = document.querySelector("#room-code-display");
  const roomMap = document.querySelector("#room-map");
  const roomSlots = document.querySelector("#room-slots");
  const roster = document.querySelector("#roster");
  const status = document.querySelector("#status");
  const copyCode = document.querySelector("#copy-code");
  const copyLink = document.querySelector("#copy-link");
  const startGame = document.querySelector("#start-game");
  const roomCodeInput = document.querySelector("#room-code-input");
  const mapName = document.querySelector("#map-name");
  const playerCount = document.querySelector("#player-count");
  const trainingMap = document.querySelector("#training-map");
  const matchType = document.querySelector("#match-type");
  const hostTeam = document.querySelector("#host-team");
  const tutorialTrain = document.querySelector("#tutorial-train");
  const tutorialHost = document.querySelector("#tutorial-host");

  let activeRoom = null;
  let serverOnline = false;
  let lobbyPoll = null;
  const mapCatalog = [
    { name: "Candy Meadow", players: 2 },
    { name: "Marshmallow Crossing", players: 2 },
    { name: "Ember Orchard", players: 2 },
    { name: "Sugar Spiral", players: 3 },
    { name: "Gumdrop Triangle", players: 3 },
    { name: "Frosting Four Corners", players: 4 },
    { name: "Clockwork Pastures", players: 4 },
    { name: "Five Flock Basin", players: 5 },
    { name: "Lollipop Ring", players: 5 },
    { name: "Six Shepherd Summit", players: 6 },
    { name: "Marshmallow Crown", players: 6 }
  ];

  function readRooms() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (_error) {
      return {};
    }
  }

  function writeRooms(rooms) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  }

  function saveRoom(room) {
    const rooms = readRooms();
    rooms[room.code] = room;
    writeRooms(rooms);
  }

  function makeRoomCode() {
    const rooms = readRooms();
    let code = "";

    do {
      code = Array.from({ length: 5 }, function () {
        return alphabet[Math.floor(Math.random() * alphabet.length)];
      }).join("");
    } while (rooms[code]);

    return code;
  }

  function getSelectedValue(form, name) {
    const selected = form.querySelector('input[name="' + name + '"]:checked');
    return selected ? selected.value : "";
  }

  function showPanel(panelId) {
    modeButtons.forEach(function (button) {
      const active = button.dataset.panel === panelId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });

    modePanels.forEach(function (panel) {
      const active = panel.id === panelId;
      panel.hidden = !active;
      panel.classList.toggle("is-hidden", !active);
    });
  }

  function launchRoom(code) {
    const session = readSession(code);
    const net = session && serverOnline ? "&net=1&player=" + encodeURIComponent(session.playerIndex) : "";
    window.location.href = "game.html?room=" + encodeURIComponent(code) + "&start=1" + net;
  }

  function readSession(code) {
    try {
      return JSON.parse(localStorage.getItem("war-of-the-sheep-session-" + code)) || null;
    } catch (_error) {
      return null;
    }
  }

  function saveSession(code, session) {
    localStorage.setItem("war-of-the-sheep-session-" + code, JSON.stringify(session));
  }

  async function api(path, options) {
    const response = await fetch(path, Object.assign({
      headers: { "Content-Type": "application/json" }
    }, options || {}));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Server error");
    return data;
  }

  async function detectServer() {
    try {
      const data = await api("/api/status");
      serverOnline = Boolean(data.multiplayer);
      const localHost = ["127.0.0.1", "localhost", ""].includes(window.location.hostname);
      status.textContent = localHost ? "Local multiplayer server ready." : "Public multiplayer server ready.";
    } catch (_error) {
      serverOnline = false;
    }
  }

  function fillMapSelect(select, players) {
    const current = select.value;
    const maps = mapCatalog.filter(function (map) {
      return map.players === players;
    });
    select.innerHTML = "";
    maps.forEach(function (map) {
      const option = document.createElement("option");
      option.value = map.name;
      option.textContent = map.name + " (" + map.players + "P)";
      select.append(option);
    });
    if (maps.some(function (map) { return map.name === current; })) select.value = current;
  }

  function selectedMapPlayers(name) {
    const map = mapCatalog.find(function (item) {
      return item.name === name;
    });
    return map ? map.players : 2;
  }

  function playerRow(player, index) {
    const row = document.createElement("div");
    row.className = "player-row";

    const identity = document.createElement("div");
    const name = document.createElement("div");
    const faction = document.createElement("div");
    const badge = document.createElement("strong");

    name.className = "player-name";
    faction.className = "player-faction";

    name.textContent = player.name || "Commander " + (index + 1);
    faction.textContent = player.faction;
    badge.textContent = player.host ? "Host" : "Ready";

    identity.append(name, faction);
    row.append(identity, badge);

    return row;
  }

  function renderRoom(room) {
    activeRoom = room;
    const session = room ? readSession(room.code) : null;
    const isHost = room && room.training || session && session.playerIndex === 0;
    roomTitle.textContent = room ? (room.training ? "Training Ready" : "Room Open") : "No Room Yet";
    roomCodeDisplay.textContent = room ? room.code : "-----";
    roomMap.textContent = room ? room.map + (room.matchType ? " - " + matchLabel(room.matchType) : "") : "Not selected";
    roomSlots.textContent = room ? room.players.length + " / " + room.maxPlayers : "0 / 0";
    roster.innerHTML = "";

    if (!room) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Choose Host, Join, or Train.";
      roster.append(empty);
    } else {
      room.players.forEach(function (player, index) {
        roster.append(playerRow(player, index));
      });
    }

    copyCode.disabled = !room;
    copyLink.disabled = !room;
    startGame.disabled = !room || (!room.training && room.players.length < room.maxPlayers);
    startGame.textContent = room && room.training ? "Start Training" : room && room.players.length < room.maxPlayers ? "Waiting for Players" : "Start Skirmish";
  }

  function matchLabel(type) {
    if (type === "ffa") return "FFA";
    if (type === "2v2-ai") return "2v2 vs AI";
    if (type === "teams") return "Teams";
    return "1v1";
  }

  function startLobbyPolling(code) {
    if (lobbyPoll) clearInterval(lobbyPoll);
    if (!serverOnline || !code) return;
    lobbyPoll = setInterval(async function () {
      try {
        const data = await api("/api/rooms/" + encodeURIComponent(code));
        if (!data.room) return;
        saveRoom(data.room);
        renderRoom(data.room);
        const session = readSession(code);
        if (data.room.started && session) launchRoom(code);
        else if (data.room.players.length < data.room.maxPlayers) status.textContent = "Waiting for players in room " + code + ".";
        else status.textContent = "Room full. Press Start Skirmish when everyone is ready.";
      } catch (_error) {
        status.textContent = "Waiting for the room server.";
      }
    }, 1200);
  }

  async function copyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = message;
    } catch (_error) {
      status.textContent = text;
    }
  }

  function inviteLink(code) {
    const url = new URL(window.location.href);
    url.searchParams.set("room", code);
    return url.toString();
  }

  modeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      showPanel(button.dataset.panel);
      if (button.dataset.panel === "join-panel") status.textContent = "Enter your friend's room code.";
      if (button.dataset.panel === "host-panel") status.textContent = activeRoom ? "Share the room code when ready." : "Create a room code for your friend.";
      if (button.dataset.panel === "train-panel") status.textContent = "Pick an AI difficulty and map.";
      if (button.dataset.panel === "tutorial-panel") status.textContent = "Learn the first build order, then practice against AI.";
    });
  });

  tutorialTrain.addEventListener("click", function () {
    const code = makeRoomCode();
    const room = {
      code,
      map: "Candy Meadow",
      maxPlayers: 2,
      training: true,
      tutorial: true,
      difficulty: "easy",
      createdAt: new Date().toISOString(),
      players: [
        {
          name: "Tutorial Shepherd",
          faction: "Rainbow Sheep",
          host: true
        },
        {
          name: "Training Flock",
          faction: "Mech Sheep",
          host: false,
          ai: true
        }
      ]
    };

    saveRoom(room);
    renderRoom(room);
    window.history.replaceState({}, "", "?room=" + encodeURIComponent(code));
    status.textContent = "Starting tutorial mission.";
    window.location.href = "game.html?room=" + encodeURIComponent(code) + "&start=1&tutorial=1";
  });

  tutorialHost.addEventListener("click", function () {
    showPanel("host-panel");
    status.textContent = "Create a room, share the code, then start when your friend joins.";
  });

  hostForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const formData = new FormData(hostForm);
    const maxPlayers = Number(formData.get("playerCount"));
    const chosenMap = String(formData.get("mapName") || "");
    if (selectedMapPlayers(chosenMap) !== maxPlayers) {
      status.textContent = "Choose a " + maxPlayers + "-player map for a " + maxPlayers + "-player room.";
      fillMapSelect(mapName, maxPlayers);
      return;
    }
    if (serverOnline) {
      try {
        const data = await api("/api/rooms", {
          method: "POST",
          body: JSON.stringify({
            map: chosenMap,
            maxPlayers,
            matchType: formData.get("matchType") || "1v1",
            hostTeam: formData.get("hostTeam") || "1",
            player: {
              name: formData.get("hostName") || "Host Shepherd",
              faction: getSelectedValue(hostForm, "hostFaction")
            }
          })
        });
        saveSession(data.room.code, { playerId: data.playerId, playerIndex: data.playerIndex });
        saveRoom(data.room);
        renderRoom(data.room);
        roomCodeInput.value = data.room.code;
        window.history.replaceState({}, "", "?room=" + encodeURIComponent(data.room.code));
        status.textContent = "Online room " + data.room.code + " is ready. Share this code.";
        startLobbyPolling(data.room.code);
        return;
      } catch (error) {
        status.textContent = error.message;
        return;
      }
    }

    const code = makeRoomCode();
    const room = {
      code,
      map: chosenMap,
      maxPlayers,
      matchType: formData.get("matchType") || "1v1",
      hostTeam: formData.get("hostTeam") || "1",
      training: false,
      difficulty: "human",
      createdAt: new Date().toISOString(),
      players: [
        {
          name: formData.get("hostName") || "Host Shepherd",
          faction: getSelectedValue(hostForm, "hostFaction"),
          host: true
        }
      ]
    };

    saveRoom(room);
    renderRoom(room);
    roomCodeInput.value = code;
    window.history.replaceState({}, "", "?room=" + encodeURIComponent(code));
    status.textContent = "Room " + code + " is ready. Share this code with your friend.";
  });

  playerCount.addEventListener("change", function () {
    const count = Number(playerCount.value);
    fillMapSelect(mapName, count);
    status.textContent = "Showing " + count + "-player maps.";
  });

  matchType.addEventListener("change", function () {
    if (matchType.value === "2v2-ai") {
      playerCount.value = "4";
      hostTeam.value = "1";
      fillMapSelect(mapName, 4);
      status.textContent = "2v2 vs AI uses a 4-player map.";
      return;
    }
    if (matchType.value === "ffa") hostTeam.value = "ffa";
    status.textContent = "Match type set to " + matchLabel(matchType.value) + ".";
  });

  joinForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const formData = new FormData(joinForm);
    const code = String(formData.get("roomCode") || "").trim().toUpperCase();
    if (!/^[A-Z2-9]{5,6}$/.test(code)) {
      status.textContent = "Enter a valid room code.";
      return;
    }

    if (serverOnline) {
      try {
        const data = await api("/api/rooms/" + encodeURIComponent(code) + "/join", {
          method: "POST",
          body: JSON.stringify({
            player: {
              name: formData.get("joinName") || "Guest Shepherd",
              faction: getSelectedValue(joinForm, "joinFaction")
            }
          })
        });
        saveSession(data.room.code, { playerId: data.playerId, playerIndex: data.playerIndex });
        saveRoom(data.room);
        renderRoom(data.room);
        window.history.replaceState({}, "", "?room=" + encodeURIComponent(data.room.code));
        status.textContent = data.room.started ? "Match already started. Launching room " + data.room.code + "." : "Joined online room " + data.room.code + ". Waiting for the host to start.";
        startLobbyPolling(data.room.code);
        if (data.room.started) launchRoom(data.room.code);
        return;
      } catch (error) {
        status.textContent = error.message;
        return;
      }
    }

    const rooms = readRooms();
    const room = rooms[code];

    if (!room) {
      const waitingRoom = {
        code,
        map: "Waiting for host",
        maxPlayers: 2,
        training: false,
        difficulty: "human",
        players: [
          {
            name: formData.get("joinName") || "Guest Shepherd",
            faction: getSelectedValue(joinForm, "joinFaction"),
            host: false
          }
        ]
      };
      renderRoom(waitingRoom);
      status.textContent = "Looking for room " + code + ".";
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      status.textContent = "Room " + code + " is full.";
      renderRoom(room);
      return;
    }

    room.players.push({
      name: formData.get("joinName") || "Guest Shepherd",
      faction: getSelectedValue(joinForm, "joinFaction"),
      host: false
    });

    saveRoom(room);
    renderRoom(room);
    window.history.replaceState({}, "", "?room=" + encodeURIComponent(code));
    status.textContent = "Joined room " + code + ". Waiting for the host to start.";
  });

  trainForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const formData = new FormData(trainForm);
    const code = makeRoomCode();
    const room = {
      code,
      map: formData.get("trainingMap"),
      maxPlayers: 2,
      training: true,
      difficulty: formData.get("aiDifficulty"),
      createdAt: new Date().toISOString(),
      players: [
        {
          name: formData.get("trainName") || "Training Shepherd",
          faction: getSelectedValue(trainForm, "trainFaction"),
          host: true
        },
        {
          name: "AI Flock",
          faction: "Mech Sheep",
          host: false,
          ai: true
        }
      ]
    };

    saveRoom(room);
    renderRoom(room);
    window.history.replaceState({}, "", "?room=" + encodeURIComponent(code));
    status.textContent = "Training room ready. Launching " + room.difficulty + " AI.";
    launchRoom(code);
  });

  roomCodeInput.addEventListener("input", function () {
    roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  });

  copyCode.addEventListener("click", function () {
    if (activeRoom) {
      copyText(activeRoom.code, "Room code copied.");
    }
  });

  copyLink.addEventListener("click", function () {
    if (activeRoom) {
      copyText(inviteLink(activeRoom.code), "Invite link copied.");
    }
  });

  startGame.addEventListener("click", async function () {
    if (!activeRoom) {
      return;
    }

    if (serverOnline && !activeRoom.training) {
      const session = readSession(activeRoom.code);
      try {
        await api("/api/rooms/" + encodeURIComponent(activeRoom.code) + "/start", {
          method: "POST",
          body: JSON.stringify({ playerId: session && session.playerId })
        });
      } catch (error) {
        status.textContent = error.message;
        return;
      }
    }

    status.textContent = "Launching room " + activeRoom.code + ".";
    launchRoom(activeRoom.code);
  });

  function loadRoomFromUrl() {
    const code = new URLSearchParams(window.location.search).get("room");
    if (!code) {
      renderRoom(null);
      showPanel("host-panel");
      return;
    }

    const cleanCode = code.toUpperCase();
    const room = readRooms()[cleanCode];
    roomCodeInput.value = cleanCode;
    renderRoom(room || {
      code: cleanCode,
      map: "Waiting for host",
      maxPlayers: 2,
      players: []
    });
    status.textContent = room ? "Room " + cleanCode + " found. Enter your name to join." : "Enter your name to join " + cleanCode + ".";
    startLobbyPolling(cleanCode);
    showPanel("join-panel");
  }

  fillMapSelect(mapName, Number(playerCount.value));
  fillMapSelect(trainingMap, 2);
  detectServer().then(loadRoomFromUrl);
})();
