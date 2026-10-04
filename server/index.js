import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT) || 3001;
const MAX_PLAYERS = 3;
const QUESTION_TIME_MS = 10_000;
const ROOM_RETENTION_MS = 5 * 60_000;

const QUESTIONS = [
  {
    prompt: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Mercury"],
    answer: 1,
  },
  {
    prompt: "How many sides does a hexagon have?",
    options: ["Five", "Six", "Seven", "Eight"],
    answer: 1,
  },
  {
    prompt: "What is the largest ocean on Earth?",
    options: ["Atlantic", "Indian", "Arctic", "Pacific"],
    answer: 3,
  },
  {
    prompt: "Which animal is the tallest in the world?",
    options: ["Elephant", "Ostrich", "Giraffe", "Camel"],
    answer: 2,
  },
  {
    prompt: "What is the chemical symbol for gold?",
    options: ["Ag", "Au", "Go", "Gd"],
    answer: 1,
  },
  {
    prompt: "Which country is home to the city of Kyoto?",
    options: ["China", "South Korea", "Thailand", "Japan"],
    answer: 3,
  },
  {
    prompt: "How many colors are traditionally in a rainbow?",
    options: ["Five", "Six", "Seven", "Eight"],
    answer: 2,
  },
  {
    prompt: "Which instrument has keys, pedals, and strings?",
    options: ["Piano", "Flute", "Violin", "Trumpet"],
    answer: 0,
  },
  {
    prompt: "What is the fastest land animal?",
    options: ["Lion", "Horse", "Cheetah", "Greyhound"],
    answer: 2,
  },
  {
    prompt: "Which gas do plants absorb from the atmosphere?",
    options: ["Oxygen", "Nitrogen", "Helium", "Carbon dioxide"],
    answer: 3,
  },
];

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || true,
  },
});

const rooms = new Map();

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});
app.use(express.static(fileURLToPath(new URL("../dist", import.meta.url))));
app.get(/.*/, (_request, response) => {
  response.sendFile(fileURLToPath(new URL("../dist/index.html", import.meta.url)));
});

function createCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;

  do {
    code = Array.from(
      { length: 6 },
      () => alphabet[randomInt(alphabet.length)],
    ).join("");
  } while (rooms.has(code));

  return code;
}

function cleanUsername(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 18);
}

function publicQuestion(index) {
  const question = QUESTIONS[index];
  return {
    prompt: question.prompt,
    options: question.options,
  };
}

function sortedPlayers(room) {
  return [...room.players.values()]
    .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt)
    .map((player) => ({
      id: player.id,
      username: player.username,
      score: player.score,
      answered: Boolean(room.answers[player.id]),
      connected: player.connected,
    }));
}

function roomSnapshot(room) {
  return {
    code: room.code,
    phase: room.phase,
    players: sortedPlayers(room),
    maxPlayers: MAX_PLAYERS,
    questionIndex: room.questionIndex,
    totalQuestions: QUESTIONS.length,
    deadline: room.deadline,
    question:
      room.phase === "playing" ? publicQuestion(room.questionIndex) : null,
    answerIndex: room.phase === "between" ? room.answerIndex : null,
    revealedAnswer:
      room.phase === "between"
        ? QUESTIONS[room.questionIndex].options[room.answerIndex]
        : null,
  };
}

function broadcastRoom(room) {
  io.to(room.code).emit("room:state", roomSnapshot(room));
}

function clearRoomTimer(room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}

function finishGame(room) {
  clearRoomTimer(room);
  room.phase = "finished";
  room.deadline = null;
  room.finishedAt = Date.now();
  broadcastRoom(room);
}

function showQuestion(room, index) {
  room.questionIndex = index;
  room.answerIndex = null;
  room.answers = {};
  room.phase = "playing";
  room.deadline = Date.now() + QUESTION_TIME_MS;
  broadcastRoom(room);

  clearRoomTimer(room);
  room.timer = setTimeout(() => {
    room.timer = null;
    if (room.phase !== "playing") return;

    if (room.questionIndex === QUESTIONS.length - 1) {
      finishGame(room);
      return;
    }

    room.answerIndex = QUESTIONS[room.questionIndex].answer;
    room.phase = "between";
    room.deadline = null;
    broadcastRoom(room);
    scheduleNextQuestion(room);
  }, QUESTION_TIME_MS);
}

function scheduleNextQuestion(room) {
  clearRoomTimer(room);
  room.timer = setTimeout(() => {
    room.timer = null;
    if (room.phase !== "between") return;
    if (room.questionIndex === QUESTIONS.length - 1) {
      finishGame(room);
    } else {
      showQuestion(room, room.questionIndex + 1);
    }
  }, 1_500);
}

function advanceAfterAnswers(room) {
  if (
    room.phase !== "playing" ||
    room.players.size === 0 ||
    Object.keys(room.answers).length <
      [...room.players.values()].filter((player) => player.connected).length
  ) {
    return;
  }

  clearRoomTimer(room);
  room.answerIndex = QUESTIONS[room.questionIndex].answer;
  room.phase = "between";
  room.deadline = null;
  broadcastRoom(room);
  scheduleNextQuestion(room);
}

function startGame(room) {
  if (room.phase !== "waiting" || room.players.size !== MAX_PLAYERS) return;
  showQuestion(room, 0);
}

function leaveRoom(socket, room, { disconnected = false } = {}) {
  if (!room.players.has(socket.id)) return;

  if (room.phase === "waiting") {
    room.players.delete(socket.id);
    if (room.players.size === 0) {
      clearRoomTimer(room);
      rooms.delete(room.code);
      return;
    }
    broadcastRoom(room);
  } else if (room.phase === "playing" || room.phase === "between") {
    if (disconnected) {
      room.players.get(socket.id).connected = false;
      if (room.phase === "playing") advanceAfterAnswers(room);
      if (room.phase === "between") scheduleNextQuestion(room);
      broadcastRoom(room);
    } else {
      room.players.delete(socket.id);
      delete room.answers[socket.id];
      if (room.phase === "playing") advanceAfterAnswers(room);
      if (room.phase === "between") scheduleNextQuestion(room);
      broadcastRoom(room);
    }
  } else {
    room.players.delete(socket.id);
    broadcastRoom(room);
  }

  socket.leave(room.code);
}

function validateJoin(room, username) {
  if (!username) return "Enter a username to continue.";
  if (room.phase !== "waiting") return "This game has already started.";
  if (room.players.size >= MAX_PLAYERS) return "This room is full.";
  const nameTaken = [...room.players.values()].some(
    (player) => player.username.toLowerCase() === username.toLowerCase(),
  );
  if (nameTaken) return "That username is already in this room.";
  return null;
}

io.on("connection", (socket) => {
  socket.on("room:create", (rawUsername, callback) => {
    const username = cleanUsername(rawUsername);
    if (!username) {
      callback?.({ ok: false, error: "Enter a username to continue." });
      return;
    }

    const code = createCode();
    const room = {
      code,
      phase: "waiting",
      players: new Map(),
      answers: {},
      questionIndex: -1,
      answerIndex: null,
      deadline: null,
      timer: null,
      createdAt: Date.now(),
      finishedAt: null,
    };
    room.players.set(socket.id, {
      id: socket.id,
      username,
      score: 0,
      connected: true,
      joinedAt: Date.now(),
    });
    rooms.set(code, room);
    socket.join(code);
    callback?.({ ok: true, room: roomSnapshot(room) });
    broadcastRoom(room);
  });

  socket.on("room:join", (payload, callback) => {
    const username = cleanUsername(payload?.username);
    const code =
      typeof payload?.code === "string"
        ? payload.code.trim().toUpperCase()
        : "";
    const room = rooms.get(code);

    if (!room) {
      callback?.({ ok: false, error: "We couldn't find that game code." });
      return;
    }

    const error = validateJoin(room, username);
    if (error) {
      callback?.({ ok: false, error });
      return;
    }

    room.players.set(socket.id, {
      id: socket.id,
      username,
      score: 0,
      connected: true,
      joinedAt: Date.now(),
    });
    socket.join(code);
    callback?.({ ok: true, room: roomSnapshot(room) });
    if (room.players.size === MAX_PLAYERS) startGame(room);
    else broadcastRoom(room);
  });

  socket.on("player:answer", (choice, callback) => {
    const room = [...rooms.values()].find((candidate) =>
      candidate.players.has(socket.id),
    );

    if (!room || room.phase !== "playing") {
      callback?.({ ok: false, error: "There is no active question." });
      return;
    }
    if (room.answers[socket.id]) {
      callback?.({ ok: false, error: "You already answered this question." });
      return;
    }

    const answer = Number(choice);
    if (
      !Number.isInteger(answer) ||
      answer < 0 ||
      answer >= QUESTIONS[room.questionIndex].options.length
    ) {
      callback?.({ ok: false, error: "Choose one of the available answers." });
      return;
    }

    const correct =
      answer === QUESTIONS[room.questionIndex].answer;
    room.answers[socket.id] = { choice: answer, correct };
    if (correct) room.players.get(socket.id).score += 10;

    callback?.({ ok: true });
    broadcastRoom(room);
    advanceAfterAnswers(room);
  });

  socket.on("room:leave", () => {
    const room = [...rooms.values()].find((candidate) =>
      candidate.players.has(socket.id),
    );
    if (room) leaveRoom(socket, room);
  });

  socket.on("disconnect", () => {
    const room = [...rooms.values()].find((candidate) =>
      candidate.players.has(socket.id),
    );
    if (room) leaveRoom(socket, room, { disconnected: true });
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (
      room.phase === "finished" &&
      now - room.finishedAt > ROOM_RETENTION_MS
    ) {
      clearRoomTimer(room);
      rooms.delete(code);
    }
  }
}, 60_000).unref();

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Quiz game server listening on port ${PORT}`);
});
