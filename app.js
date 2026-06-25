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
  const addAi = document.querySelector("#add-ai");
  const startGame = document.querySelector("#start-game");
  const quitLobby = document.querySelector("#quit-lobby");
  const roomCodeInput = document.querySelector("#room-code-input");
  const mapName = document.querySelector("#map-name");
  const playerCount = document.querySelector("#player-count");
  const trainingMap = document.querySelector("#training-map");
  const matchType = document.querySelector("#match-type");
  const tutorialTrain = document.querySelector("#tutorial-train");
  const tutorialHost = document.querySelector("#tutorial-host");
  const storyStart = document.querySelector("#story-start");
  const campaignSelect = document.querySelector("#campaign-select");
  const storyDifficulty = document.querySelector("#story-difficulty");

  let activeRoom = null;
  let serverOnline = false;
  let lobbyPoll = null;
  const mapCatalog = [
    { name: "Candy Meadow", players: 2 },
    { name: "Marshmallow Crossing", players: 2 },
    { name: "Ember Orchard", players: 2 },
    { name: "Rainbow Ridge", players: 2 },
    { name: "Sugar Spiral", players: 3 },
    { name: "Gumdrop Triangle", players: 3 },
    { name: "Frosting Four Corners", players: 4 },
    { name: "Clockwork Pastures", players: 4 },
    { name: "Forge Divide", players: 4 },
    { name: "Five Flock Basin", players: 5 },
    { name: "Lollipop Ring", players: 5 },
    { name: "Six Shepherd Summit", players: 6 },
    { name: "Marshmallow Crown", players: 6 },
    { name: "Molten Sixfold", players: 6 }
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

  function removeRoom(code) {
    const rooms = readRooms();
    delete rooms[code];
    writeRooms(rooms);
  }

  function clearSession(code) {
    const key = "war-of-the-sheep-session-" + code;
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }

  function leaveLocalRoom(code) {
    const rooms = readRooms();
    const room = rooms[code];
    const session = readSession(code);
    if (!room || !session || session.playerIndex === 0 || room.training) {
      removeRoom(code);
      clearSession(code);
      return;
    }
    room.players = room.players.filter(function (_player, index) {
      return index !== session.playerIndex;
    });
    room.players.forEach(function (player, index) {
      player.host = index === 0;
      player.team = player.team || slotTeam(room.matchType || "1v1", index);
    });
    rooms[code] = room;
    writeRooms(rooms);
    clearSession(code);
  }

  function returnToHome(message) {
    if (lobbyPoll) {
      clearInterval(lobbyPoll);
      lobbyPoll = null;
    }
    activeRoom = null;
    renderRoom(null);
    showPanel("host-panel");
    window.history.replaceState({}, "", window.location.pathname);
    status.textContent = message || "Left the lobby.";
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

  function showPanel(panelId, scrollToPanel, openMode) {
    document.body.classList.toggle("mode-open", Boolean(openMode));

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

    if (scrollToPanel) {
      const panel = document.getElementById(panelId);
      if (panel) setTimeout(function () {
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 30);
    }
  }

  function launchRoom(code) {
    const session = readSession(code);
    const net = session && serverOnline ? "&net=1&player=" + encodeURIComponent(session.playerIndex) : "";
    window.location.href = "game.html?room=" + encodeURIComponent(code) + "&start=1" + net;
  }

  function readSession(code) {
    const key = "war-of-the-sheep-session-" + code;
    try {
      return JSON.parse(sessionStorage.getItem(key) || localStorage.getItem(key)) || null;
    } catch (_error) {
      return null;
    }
  }

  function saveSession(code, session) {
    const key = "war-of-the-sheep-session-" + code;
    const value = JSON.stringify(session);
    sessionStorage.setItem(key, value);
    localStorage.setItem(key, value);
  }

  async function api(path, options) {
    const response = await fetch(path, Object.assign({
      headers: { "Content-Type": "application/json" }
    }, options || {}));
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || "Server error");
      error.data = data;
      throw error;
    }
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

  function slotTeam(type, index) {
    if (type === "ffa") return "ffa-" + index;
    const teamSize = matchTeamSizes(type);
    if (teamSize) return index < teamSize.allies ? "allies" : "rivals";
    return index === 0 ? "allies" : "rivals";
  }

  function matchTeamSizes(type) {
    const match = String(type || "").match(/^(\d+)v(\d+)(?:-ai)?$/);
    if (!match) return null;
    return { allies: Number(match[1]), rivals: Number(match[2]), total: Number(match[1]) + Number(match[2]) };
  }

  function matchPlayerCount(type) {
    const sizes = matchTeamSizes(type);
    return sizes ? sizes.total : type === "ffa" ? Number(playerCount.value || 2) : 2;
  }

  function playerTeamLabel(room, player, index) {
    if (room.matchType === "ffa" && room.alliances && room.alliances.some(function (pair) {
      return pair.includes(index);
    })) return "FFA Alliance";
    const team = player.team || slotTeam(room.matchType, index);
    if (room.matchType === "ffa" || String(team).startsWith("ffa")) return "FFA";
    return team === "allies" ? "Team 1" : "Team 2";
  }

  function teamOptions(room) {
    if (!room || room.matchType === "ffa") return [["", "FFA"]];
    return [["allies", "Team 1"], ["rivals", "Team 2"]];
  }

  function makeSlotSelect(label, value, options, disabled, onChange) {
    const wrap = document.createElement("label");
    const text = document.createElement("span");
    const select = document.createElement("select");
    wrap.className = "slot-control";
    text.textContent = label;
    options.forEach(function (item) {
      const option = document.createElement("option");
      option.value = item[0];
      option.textContent = item[1];
      select.append(option);
    });
    select.value = value;
    select.disabled = disabled;
    select.addEventListener("change", async function () {
      const previousValue = value;
      select.disabled = true;
      text.textContent = label + " saving";
      const changed = await onChange(select.value);
      if (changed === false) select.value = previousValue;
      text.textContent = label;
      select.disabled = disabled;
    });
    wrap.append(text, select);
    return wrap;
  }

  async function updateRoomSlot(action, body, localUpdate) {
    if (!activeRoom) return;
    const session = readSession(activeRoom.code);
    if (!serverOnline) {
      localUpdate();
      saveRoom(activeRoom);
      renderRoom(activeRoom);
      return true;
    }
    try {
      const data = await api("/api/rooms/" + encodeURIComponent(activeRoom.code) + "/" + action, {
        method: "POST",
        body: JSON.stringify(Object.assign({ playerId: session && session.playerId }, body))
      });
      saveRoom(data.room);
      renderRoom(data.room);
      if (action === "ready") {
        status.textContent = body.ready ? "You are ready." : "You are not ready yet.";
      } else if (action === "team") {
        status.textContent = "Team changed.";
      } else if (action === "faction") {
        status.textContent = "Faction changed.";
      } else {
        status.textContent = "Lobby updated.";
      }
      return true;
    } catch (error) {
      if (error.data && error.data.room) {
        saveRoom(error.data.room);
        renderRoom(error.data.room);
      } else {
        renderRoom(activeRoom);
      }
      status.textContent = error.message;
      return false;
    }
  }

  function roomFull(room) {
    return room && room.players.length >= room.maxPlayers;
  }

  function hasAlliance(room, a, b) {
    return (room.alliances || []).some(function (pair) {
      return pair.includes(a) && pair.includes(b);
    });
  }

  function requestBetween(room, fromIndex, toIndex) {
    return (room.allianceRequests || []).some(function (request) {
      return request.fromIndex === fromIndex && request.toIndex === toIndex;
    });
  }

  async function updateAlliance(action, body, message) {
    if (!serverOnline || !activeRoom) {
      status.textContent = "FFA alliances need the public multiplayer server.";
      return;
    }
    const session = readSession(activeRoom.code);
    try {
      const data = await api("/api/rooms/" + encodeURIComponent(activeRoom.code) + "/" + action, {
        method: "POST",
        body: JSON.stringify(Object.assign({ playerId: session && session.playerId }, body))
      });
      saveRoom(data.room);
      renderRoom(data.room);
      status.textContent = message;
    } catch (error) {
      status.textContent = error.message;
    }
  }

  function allianceControls(room, index, localIndex) {
    const controls = [];
    if (!room || room.matchType !== "ffa" || room.players.length <= 2 || room.started || localIndex === index || localIndex < 0) return controls;

    if (hasAlliance(room, localIndex, index)) {
      const button = document.createElement("button");
      button.className = "button button--tiny";
      button.type = "button";
      button.textContent = "Break";
      button.addEventListener("click", function () {
        updateAlliance("alliance/break", { targetIndex: index }, "Alliance broken.");
      });
      controls.push(button);
      return controls;
    }

    if (requestBetween(room, index, localIndex)) {
      const accept = document.createElement("button");
      const decline = document.createElement("button");
      accept.className = "button button--tiny";
      decline.className = "button button--tiny button--secondary";
      accept.type = "button";
      decline.type = "button";
      accept.textContent = "Accept";
      decline.textContent = "Decline";
      accept.addEventListener("click", function () {
        updateAlliance("alliance/respond", { fromIndex: index, accept: true }, "Alliance accepted.");
      });
      decline.addEventListener("click", function () {
        updateAlliance("alliance/respond", { fromIndex: index, accept: false }, "Alliance declined.");
      });
      controls.push(accept, decline);
      return controls;
    }

    const button = document.createElement("button");
    button.className = "button button--tiny";
    button.type = "button";
    button.textContent = requestBetween(room, localIndex, index) ? "Requested" : "Request";
    button.disabled = requestBetween(room, localIndex, index);
    button.addEventListener("click", function () {
      updateAlliance("alliance", { targetIndex: index }, "Alliance request sent.");
    });
    controls.push(button);
    return controls;
  }

  function playerRow(room, player, index, isHost, localIndex, previousTeam) {
    const row = document.createElement("div");
    row.className = "player-row";
    const team = player.team || slotTeam(room.matchType, index);
    row.dataset.team = team;
    if (index > 0 && previousTeam && previousTeam !== team && room.matchType !== "ffa") row.classList.add("player-row--team-gap");

    const identity = document.createElement("div");
    const actions = document.createElement("div");
    const name = document.createElement("div");
    const faction = document.createElement("div");
    const badge = document.createElement("strong");

    name.className = "player-name";
    faction.className = "player-faction";
    actions.className = "player-row__actions";

    name.textContent = player.name || "Commander " + (index + 1);
    faction.textContent = player.faction + " - " + playerTeamLabel(room, player, index);
    badge.textContent = player.host ? "Host" : player.ai ? "AI" : "Player";
    if (player.ai) badge.className = "ai-badge";

    identity.append(name, faction);
    actions.append(badge);
    actions.append(makeSlotSelect(
      "Team",
      room.matchType === "ffa" ? "" : (player.team || slotTeam(room.matchType, index)),
      teamOptions(room),
      !isHost || room.started || room.matchType === "ffa",
      function (team) {
        updateRoomSlot("team", { index, team }, function () {
          activeRoom.players[index].team = team;
        });
      }
    ));
    const canChangeFaction = (!player.ai && localIndex === index) || (isHost && player.ai);
    actions.append(makeSlotSelect(
      "Race",
      player.faction,
      [["Rainbow Sheep", "Rainbow"], ["Mech Sheep", "Mech"], ["Fire Sheep", "Fire"]],
      room.started || !canChangeFaction,
      function (faction) {
        updateRoomSlot("faction", { index, faction }, function () {
          activeRoom.players[index].faction = faction;
        });
      }
    ));
    allianceControls(room, index, localIndex).forEach(function (button) {
      actions.append(button);
    });
    row.append(identity, actions);

    return row;
  }

  function renderRoom(room) {
    activeRoom = room;
    const realRoom = Boolean(room && room.players && room.players.length > 0 && room.map !== "Waiting for server" && room.map !== "Waiting for host");
    document.body.classList.toggle("has-room", realRoom);
    const session = room ? readSession(room.code) : null;
    const isHost = room && (room.training || session && session.playerIndex === 0);
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
        const previous = index > 0 ? room.players[index - 1].team || slotTeam(room.matchType, index - 1) : "";
        roster.append(playerRow(room, player, index, isHost, session ? session.playerIndex : 0, previous));
      });
    }

    copyCode.disabled = !room;
    copyLink.disabled = !room;
    quitLobby.disabled = !room;
    addAi.disabled = !room || !isHost || room.training || room.players.length >= room.maxPlayers;
    addAi.title = !room
      ? "Create a room first."
      : !isHost ? "Only the host who created this room can add AI."
      : room.training ? "Training rooms already have an AI."
      : room.players.length >= room.maxPlayers ? "The room is full."
      : "Add an AI player to the next open slot.";
    startGame.disabled = !room || !isHost || (!room.training && !roomFull(room));
    startGame.textContent = room && room.training
      ? "Start Training"
      : room && !isHost ? "Waiting for Host"
      : room && room.players.length < room.maxPlayers ? "Waiting for Players"
      : "Start Skirmish";
  }

  function matchLabel(type) {
    if (type === "ffa") return "FFA";
    if (type === "2v2-ai") return "2v2 vs AI";
    if (matchTeamSizes(type)) return String(type).replace("-ai", " vs AI");
    return "1v1";
  }

  function roomLoadErrorMessage(error) {
    if (error && /Room not found/i.test(error.message)) return "Room not found on this server. Create a new room code.";
    return error && error.message ? error.message : "Waiting for the room server.";
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
        else if ((readSession(code) || {}).playerIndex === 0) status.textContent = "Room full. Host can press Start Skirmish.";
        else status.textContent = "Room full. Waiting for the host to start.";
      } catch (error) {
        status.textContent = roomLoadErrorMessage(error);
      }
    }, 1200);
  }

  async function copyText(text, message) {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      status.textContent = message;
    } catch (_error) {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.left = "-9999px";
      document.body.append(helper);
      helper.select();
      const copied = document.execCommand && document.execCommand("copy");
      helper.remove();
      status.textContent = copied ? message : "Copy this: " + text;
    }
  }

  function inviteLink(code) {
    const url = new URL(window.location.href);
    url.searchParams.set("room", code);
    return url.toString();
  }

  modeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      showPanel(button.dataset.panel, true, true);
      if (button.dataset.panel === "join-panel") status.textContent = "Enter your friend's room code.";
      if (button.dataset.panel === "host-panel") status.textContent = activeRoom ? "Share the room code when ready." : "Create a room code for your friend.";
      if (button.dataset.panel === "train-panel") status.textContent = "Pick an AI difficulty and map.";
      if (button.dataset.panel === "tutorial-panel") status.textContent = "Learn the first build order, then practice against AI.";
      if (button.dataset.panel === "story-panel") status.textContent = "Play the single player story campaign in Rainbow Meadow.";
    });
  });

  function storyMapName(chapter) {
    if (chapter === 2) return "Marshmallow Crossing";
    if (chapter === 3) return "Sugar Spiral";
    if (chapter === 4) return "Rainbow Ridge";
    if (chapter === 5) return "Ember Orchard";
    return "Rainbow Meadow";
  }

  function launchStoryChapter(chapter) {
    const safeChapter = Math.max(1, Math.min(5, Number(chapter) || 1));
    const difficulty = storyDifficulty ? storyDifficulty.value : (localStorage.getItem("magic-sheep-story-difficulty") || "normal");
    const code = makeRoomCode();
    const room = {
      code,
      map: storyMapName(safeChapter),
      maxPlayers: 2,
      training: true,
      story: true,
      storyChapter: safeChapter,
      difficulty,
      createdAt: new Date().toISOString(),
      players: [
        {
          name: "Derek the Dreamer",
          faction: "Rainbow Sheep",
          ready: true,
          host: true
        },
        {
          name: "Wolf Pack",
          faction: "Wolves",
          ready: true,
          host: false,
          ai: true
        }
      ]
    };

    saveRoom(room);
    renderRoom(room);
    localStorage.setItem("magic-sheep-story-chapter", String(safeChapter));
    localStorage.setItem("magic-sheep-story-difficulty", difficulty);
    window.history.replaceState({}, "", "?room=" + encodeURIComponent(code));
    status.textContent = "Story campaign mission " + safeChapter + " ready.";
    window.location.href = "game.html?room=" + encodeURIComponent(code) + "&start=1&story=1&chapter=" + safeChapter + "&difficulty=" + encodeURIComponent(difficulty);
  }

  function renderCampaignProgress() {
    const saved = Math.max(1, Math.min(5, Number(localStorage.getItem("magic-sheep-story-chapter") || 1)));
    document.querySelectorAll("[data-story-chapter]").forEach(function (button) {
      button.classList.toggle("is-current", Number(button.dataset.storyChapter) === saved);
    });
    if (storyStart) storyStart.textContent = saved > 1 ? "Continue Mission " + saved : "Start Campaign";
  }

  storyStart.addEventListener("click", function () {
    launchStoryChapter(localStorage.getItem("magic-sheep-story-chapter") || 1);
  });

  if (storyDifficulty) {
    storyDifficulty.value = localStorage.getItem("magic-sheep-story-difficulty") || "normal";
    storyDifficulty.addEventListener("change", function () {
      localStorage.setItem("magic-sheep-story-difficulty", storyDifficulty.value);
    });
  }

  if (campaignSelect) {
    campaignSelect.addEventListener("click", function (event) {
      const button = event.target.closest("[data-story-chapter]");
      if (!button) return;
      launchStoryChapter(button.dataset.storyChapter);
    });
    renderCampaignProgress();
  }

  tutorialTrain.addEventListener("click", function () {
    const tutorialFactions = ["Rainbow Sheep", "Mech Sheep", "Fire Sheep"];
    const savedIndex = Number(localStorage.getItem("magic-sheep-tutorial-race") || 0);
    const factionIndex = Number.isFinite(savedIndex) ? Math.max(0, Math.min(tutorialFactions.length - 1, savedIndex)) : 0;
    const faction = tutorialFactions[factionIndex];
    const opponent = faction === "Mech Sheep" ? "Fire Sheep" : "Mech Sheep";
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
          faction,
          host: true
        },
        {
          name: "Training Flock",
          faction: opponent,
          host: false,
          ai: true
        }
      ]
    };

    saveRoom(room);
    renderRoom(room);
    window.history.replaceState({}, "", "?room=" + encodeURIComponent(code));
    localStorage.setItem("magic-sheep-tutorial-race", String(factionIndex));
    status.textContent = "Starting " + faction + " tutorial mission.";
    window.location.href = "game.html?room=" + encodeURIComponent(code) + "&start=1&tutorial=1";
  });

  tutorialHost.addEventListener("click", function () {
    showPanel("host-panel", true, true);
    status.textContent = "Create a room, share the code, then start when your friend joins.";
  });

  hostForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const formData = new FormData(hostForm);
    const chosenMatchType = String(formData.get("matchType") || "1v1");
    const matchSize = matchTeamSizes(chosenMatchType);
    const maxPlayers = matchSize ? matchSize.total : Number(formData.get("playerCount"));
    const chosenMap = String(formData.get("mapName") || "");
    if (selectedMapPlayers(chosenMap) !== maxPlayers) {
      status.textContent = "Choose a " + maxPlayers + "-player map for a " + maxPlayers + "-player room.";
      fillMapSelect(mapName, maxPlayers);
      playerCount.value = String(maxPlayers);
      return;
    }
    if (serverOnline) {
      try {
        const data = await api("/api/rooms", {
          method: "POST",
          body: JSON.stringify({
            map: chosenMap,
            maxPlayers,
            matchType: chosenMatchType,
            difficulty: formData.get("hostAiDifficulty") || "normal",
            player: {
              name: formData.get("hostName") || "Host Shepherd",
              faction: getSelectedValue(hostForm, "hostFaction"),
              team: slotTeam(chosenMatchType, 0),
              ready: false
            }
          })
        });
        saveSession(data.room.code, { playerId: data.playerId, playerIndex: data.playerIndex });
        saveRoom(data.room);
        renderRoom(data.room);
        showPanel("host-panel", false, true);
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
      matchType: chosenMatchType,
      training: false,
      difficulty: formData.get("hostAiDifficulty") || "normal",
      createdAt: new Date().toISOString(),
      players: [
        {
          name: formData.get("hostName") || "Host Shepherd",
          faction: getSelectedValue(hostForm, "hostFaction"),
          team: slotTeam(chosenMatchType, 0),
          ready: false,
          host: true
        }
      ]
    };

    saveRoom(room);
    renderRoom(room);
    showPanel("host-panel", false, true);
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
    const neededPlayers = matchPlayerCount(matchType.value);
    if (matchType.value !== "ffa") {
      playerCount.value = String(neededPlayers);
      fillMapSelect(mapName, neededPlayers);
      status.textContent = matchLabel(matchType.value) + " uses a " + neededPlayers + "-player map.";
      return;
    }
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
      team: slotTeam(room.matchType || "1v1", room.players.length),
      ready: false,
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
          ready: true,
          host: true
        },
        {
          name: "AI Flock",
          faction: "Mech Sheep",
          ready: true,
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

  quitLobby.addEventListener("click", async function () {
    if (!activeRoom) return;
    const code = activeRoom.code;
    if (serverOnline && !activeRoom.training) {
      const session = readSession(code);
      try {
        await api("/api/rooms/" + encodeURIComponent(code) + "/leave", {
          method: "POST",
          body: JSON.stringify({ playerId: session && session.playerId })
        });
      } catch (error) {
        status.textContent = error.message;
        return;
      }
      clearSession(code);
      returnToHome(session && session.playerIndex === 0 ? "Host closed the lobby." : "You left the lobby.");
      return;
    }
    leaveLocalRoom(code);
    returnToHome("You left the lobby.");
  });

  addAi.addEventListener("click", async function () {
    if (!activeRoom || activeRoom.players.length >= activeRoom.maxPlayers) return;
    const nextTeam = slotTeam(activeRoom.matchType || "1v1", activeRoom.players.length);
    if (serverOnline) {
      const session = readSession(activeRoom.code);
      try {
        const data = await api("/api/rooms/" + encodeURIComponent(activeRoom.code) + "/ai", {
          method: "POST",
          body: JSON.stringify({ playerId: session && session.playerId, team: nextTeam })
        });
        saveRoom(data.room);
        renderRoom(data.room);
        status.textContent = "AI added to the room.";
      } catch (error) {
        status.textContent = error.message;
      }
      return;
    }
    activeRoom.players.push({
      name: "AI Shepherd " + activeRoom.players.length,
      faction: activeRoom.players.length % 3 === 0 ? "Fire Sheep" : activeRoom.players.length % 2 === 0 ? "Mech Sheep" : "Rainbow Sheep",
      team: nextTeam,
      ready: true,
      ai: true
    });
    saveRoom(activeRoom);
    renderRoom(activeRoom);
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

  async function loadRoomFromUrl() {
    const code = new URLSearchParams(window.location.search).get("room");
    if (!code) {
      renderRoom(null);
      showPanel("host-panel");
      return;
    }

    const cleanCode = code.toUpperCase();
    roomCodeInput.value = cleanCode;
    if (serverOnline) {
      try {
        const data = await api("/api/rooms/" + encodeURIComponent(cleanCode));
        saveRoom(data.room);
        renderRoom(data.room);
        status.textContent = "Room " + cleanCode + " found on the multiplayer server.";
        startLobbyPolling(cleanCode);
        showPanel("join-panel", false, true);
        return;
      } catch (error) {
        renderRoom({
          code: cleanCode,
          map: "Waiting for server",
          maxPlayers: 2,
          matchType: "1v1",
          players: []
        });
        status.textContent = roomLoadErrorMessage(error);
        showPanel("join-panel", false, true);
        return;
      }
    }

    const room = readRooms()[cleanCode];
    renderRoom(room || {
      code: cleanCode,
      map: "Waiting for host",
      maxPlayers: 2,
      players: []
    });
    status.textContent = room ? "Room " + cleanCode + " found. Enter your name to join." : "Enter your name to join " + cleanCode + ".";
    startLobbyPolling(cleanCode);
    showPanel("join-panel", false, true);
  }

  fillMapSelect(mapName, Number(playerCount.value));
  fillMapSelect(trainingMap, 2);
  detectServer().then(loadRoomFromUrl);
})();
