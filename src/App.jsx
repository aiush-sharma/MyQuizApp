import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Copy,
  Crown,
  DoorOpen,
  Gamepad2,
  LoaderCircle,
  Medal,
  Radio,
  RotateCcw,
  Sparkles,
  Users,
} from "lucide-react";

const serverUrl =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD ? "https://meroquiz-api.onrender.com" : undefined);
const socket = io(serverUrl, {
  autoConnect: false,
});

function App() {
  const [username, setUsername] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [mode, setMode] = useState("home");
  const [room, setRoom] = useState(null);
  const [myId, setMyId] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const previousQuestion = useRef({ phase: null, index: -1 });

  const myPlayer = room?.players.find((player) => player.id === myId);
  const hasAnswered = Boolean(myPlayer?.answered);
  const isPlaying = room?.phase === "playing";
  const sortedPlayers = useMemo(
    () =>
      room
        ? [...room.players].sort(
            (a, b) => b.score - a.score || a.username.localeCompare(b.username),
          )
        : [],
    [room],
  );

  useEffect(() => {
    const handleConnect = () => {
      setMyId(socket.id);
      setError("");
    };
    const handleRoomState = (nextRoom) => {
      const questionChanged =
        nextRoom.phase !== "playing" ||
        previousQuestion.current.phase !== "playing" ||
        previousQuestion.current.index !== nextRoom.questionIndex;
      setRoom(nextRoom);
      setMode(nextRoom.phase === "waiting" ? "lobby" : "game");
      if (questionChanged) setSelectedAnswer(null);
      previousQuestion.current = {
        phase: nextRoom.phase,
        index: nextRoom.questionIndex,
      };
    };
    const handleDisconnect = () => {
      setError("Connection lost. Please refresh to reconnect.");
    };

    socket.on("connect", handleConnect);
    socket.on("room:state", handleRoomState);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("room:state", handleRoomState);
      socket.off("disconnect", handleDisconnect);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying || !room.deadline) {
      setSecondsLeft(10);
      return undefined;
    }

    const updateClock = () => {
      setSecondsLeft(
        Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000)),
      );
    };

    updateClock();
    const interval = window.setInterval(updateClock, 100);
    return () => window.clearInterval(interval);
  }, [isPlaying, room?.deadline]);

  useEffect(() => {
    if (!copied) return undefined;
    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  function ensureConnected(action) {
    const cleanName = username.trim().replace(/\s+/g, " ");
    if (!cleanName) {
      setError("Add your name before joining the game.");
      return;
    }

    setError("");
    if (socket.connected) {
      action(cleanName);
      return;
    }

    socket.connect();
    socket.once("connect", () => action(cleanName));
    socket.once("connect_error", () => {
      setError(
        "Couldn't connect to the game server. Check that VITE_SERVER_URL points to your deployed game server and that CLIENT_ORIGIN allows this site.",
      );
    });
  }

  function createGame() {
    ensureConnected((name) => {
      socket.emit("room:create", name, (response) => {
        if (!response?.ok) {
          setError(response?.error || "Couldn't create a game.");
          return;
        }
        setMyId(socket.id);
        setRoom(response.room);
        setMode("lobby");
      });
    });
  }

  function joinGame(event) {
    event.preventDefault();
    ensureConnected((name) => {
      socket.emit(
        "room:join",
        { username: name, code: gameCode },
        (response) => {
          if (!response?.ok) {
            setError(response?.error || "Couldn't join that game.");
            return;
          }
          setMyId(socket.id);
          setRoom(response.room);
          setMode(response.room.phase === "waiting" ? "lobby" : "game");
        },
      );
    });
  }

  function submitAnswer(index) {
    if (hasAnswered || selectedAnswer !== null || !isPlaying) return;
    setSelectedAnswer(index);
    socket.emit("player:answer", index, (response) => {
      if (!response?.ok) {
        setSelectedAnswer(null);
        setError(response?.error || "Couldn't submit your answer.");
      } else {
        setError("");
      }
    });
  }

  function copyCode() {
    if (!room?.code) return;
    navigator.clipboard
      .writeText(room.code)
      .then(() => setCopied(true))
      .catch(() =>
        setError("Couldn't copy the code. Please copy it manually."),
      );
  }

  function leaveGame() {
    socket.emit("room:leave");
    socket.disconnect();
    setRoom(null);
    setMode("home");
    setGameCode("");
    setSelectedAnswer(null);
    setError("");
  }

  const isLastQuestion = room?.questionIndex === room?.totalQuestions - 1;
  const timerPercent = Math.min(100, (secondsLeft / 10) * 100);

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={leaveGame} type="button">
          <span className="brand-icon">
            <Gamepad2 size={17} strokeWidth={2.2} />
          </span>
          <span>
            Mero<span className="brand-light">Quiz</span>
          </span>
        </button>
        <div className="topbar-right">
          {room ? (
            <span className="live-pill">
              <span className="live-dot" />
              LIVE GAME
            </span>
          ) : (
            <span className="topbar-tag">GOOD PEOPLE. QUICK QUESTIONS.</span>
          )}
        </div>
      </header>

      <div className="content">
        {mode === "home" && (
          <section className="home-layout">
            <div className="home-copy">
              <div className="eyebrow">
                <span className="eyebrow-line" />
                THREE PLAYERS. TEN QUESTIONS.
              </div>
              <h1>
                Make it a
                <br />
                <span>brain</span> thing<span className="period">.</span>
              </h1>
              <p className="home-description">
                Pick your name, bring your people, and race the clock. The
                quickest quiz night wins bragging rights.
              </p>
              <div className="feature-row">
                <span>
                  <Clock3 size={15} /> 10 seconds per question
                </span>
                <span>
                  <Sparkles size={15} /> 10 points for a right answer
                </span>
              </div>
              <div className="home-stamp">
                <span className="stamp-icon">
                  <Radio size={17} />
                </span>
                <span>
                  <strong>Made for your crew</strong>
                  <small>Live games · Up to 3 players</small>
                </span>
              </div>
            </div>

            <div className="entry-card">
              <div className="card-kicker">READY WHEN YOU ARE</div>
              <h2>Game night starts here.</h2>
              <p className="card-description">
                Choose a name, then host a room or join your friends.
              </p>
              <label className="field-label" htmlFor="username">
                YOUR NAME
              </label>
              <input
                autoComplete="nickname"
                className="text-input"
                id="username"
                maxLength={18}
                onChange={(event) => setUsername(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") createGame();
                }}
                placeholder="e.g. Alex"
                value={username}
              />

              <button
                className="primary-button create-button"
                onClick={createGame}
                type="button"
              >
                Create a game <ArrowRight size={17} />
              </button>

              <div className="divider">
                <span>OR JOIN A FRIEND</span>
              </div>
              <form className="join-form" onSubmit={joinGame}>
                <label className="visually-hidden" htmlFor="game-code">
                  Game code
                </label>
                <input
                  autoCapitalize="characters"
                  className="text-input code-input"
                  id="game-code"
                  maxLength={6}
                  onChange={(event) =>
                    setGameCode(event.target.value.toUpperCase().slice(0, 6))
                  }
                  placeholder="ENTER CODE"
                  value={gameCode}
                />
                <button
                  aria-label="Join game"
                  className="join-button"
                  disabled={gameCode.trim().length !== 6}
                  type="submit"
                >
                  <ArrowRight size={18} />
                </button>
              </form>
              {error && (
                <p aria-live="polite" className="error-message">
                  {error}
                </p>
              )}
              <p className="entry-footnote">
                <Users size={13} /> The game begins when all 3 seats are filled.
              </p>
            </div>
          </section>
        )}

        {mode === "lobby" && room && (
          <section className="lobby-layout">
            <div className="lobby-heading">
              <div className="eyebrow">
                <span className="eyebrow-line" /> ROOM IS OPEN
              </div>
              <h1>
                Call your
                <br />
                <span>people</span>
                <span className="period">.</span>
              </h1>
              <p className="home-description">
                Share the code. As soon as the third player joins, the quiz
                kicks off.
              </p>
              <button className="text-button" onClick={leaveGame} type="button">
                <ArrowLeft size={15} /> Leave room
              </button>
            </div>
            <div className="lobby-card">
              <div className="card-kicker">YOUR GAME CODE</div>
              <div className="code-share-row">
                <span className="room-code">{room.code}</span>
                <button
                  className="copy-button"
                  onClick={copyCode}
                  type="button"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="player-list-heading">
                <span>PLAYERS IN THE ROOM</span>
                <span>
                  {room.players.length}
                  <i> / {room.maxPlayers}</i>
                </span>
              </div>
              <div className="player-list">
                {Array.from({ length: room.maxPlayers }, (_, index) => {
                  const player = room.players[index];
                  return (
                    <div
                      className={`player-row${player ? " player-joined" : " player-empty"}`}
                      key={player?.id || index}
                    >
                      <span className="player-avatar">
                        {player ? (
                          player.username.slice(0, 1).toUpperCase()
                        ) : (
                          <Users size={15} />
                        )}
                      </span>
                      <span className="player-name">
                        {player ? player.username : "Waiting for player..."}
                      </span>
                      {player?.id === myId ? (
                        <span className="you-tag">YOU</span>
                      ) : null}
                      {player && player.id !== myId ? (
                        <span className="joined-check">
                          <Check size={13} />
                        </span>
                      ) : null}
                      {!player ? (
                        <span className="seat-number">0{index + 1}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="waiting-note">
                <LoaderCircle className="spin" size={15} />
                <span>
                  {room.players.length < room.maxPlayers
                    ? "Waiting for your crew to join..."
                    : "Starting your game..."}
                </span>
              </div>
              {error && (
                <p aria-live="polite" className="error-message">
                  {error}
                </p>
              )}
            </div>
          </section>
        )}

        {mode === "game" && room && room.phase !== "finished" && (
          <section className="quiz-layout">
            <div className="quiz-topline">
              <button className="text-button" onClick={leaveGame} type="button">
                <DoorOpen size={15} /> Leave game
              </button>
              <div className="quiz-room-code">
                ROOM <strong>{room.code}</strong>
              </div>
            </div>

            {room.phase === "between" ? (
              <div className="question-card reveal-card">
                <div className="reveal-icon">
                  <Check size={25} />
                </div>
                <div className="eyebrow centered">
                  <span className="eyebrow-line" /> ANSWER REVEALED
                </div>
                <h2>Nice one. Get ready!</h2>
                <div className="correct-answer">
                  Correct answer: <strong>{room.revealedAnswer}</strong>
                </div>
                <p className="next-question-copy">
                  {isLastQuestion
                    ? "Last question coming up!"
                    : `Question ${room.questionIndex + 2} is up next.`}
                </p>
                <div className="score-strip">
                  {sortedPlayers.map((player) => (
                    <span className="score-chip" key={player.id}>
                      {player.username}
                      <strong>{player.score}</strong>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="question-card">
                <div className="question-meta">
                  <span>
                    QUESTION{" "}
                    <strong>
                      {String(room.questionIndex + 1).padStart(2, "0")}
                    </strong>
                    <i> / {String(room.totalQuestions).padStart(2, "0")}</i>
                  </span>
                  <span className="points-label">
                    <Sparkles size={13} /> +10 POINTS
                  </span>
                </div>
                <div className="progress-track">
                  <span
                    style={{
                      width: `${((room.questionIndex + 1) / room.totalQuestions) * 100}%`,
                    }}
                  />
                </div>
                <div className="timer-line">
                  <div className="timer-copy">
                    <Clock3 size={15} /> TIME LEFT
                  </div>
                  <div
                    aria-label={`${secondsLeft} seconds remaining`}
                    className={`timer-number${secondsLeft <= 3 ? " timer-urgent" : ""}`}
                  >
                    {String(secondsLeft).padStart(2, "0")}
                    <small>s</small>
                  </div>
                </div>
                <div className="timer-track">
                  <span
                    className={secondsLeft <= 3 ? "timer-track-urgent" : ""}
                    style={{ width: `${timerPercent}%` }}
                  />
                </div>
                <h2 className="question-prompt">{room.question?.prompt}</h2>
                <div className="answer-grid">
                  {room.question?.options.map((option, index) => (
                    <button
                      className={`answer-option${selectedAnswer === index ? " answer-selected" : ""}`}
                      disabled={
                        hasAnswered ||
                        selectedAnswer !== null ||
                        secondsLeft === 0
                      }
                      key={option}
                      onClick={() => submitAnswer(index)}
                      type="button"
                    >
                      <span className="option-letter">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span>{option}</span>
                      {selectedAnswer === index && (
                        <Check className="answer-check" size={16} />
                      )}
                    </button>
                  ))}
                </div>
                <div className="question-footer">
                  <span className="answer-count">
                    <Users size={14} />{" "}
                    {room.players.filter((player) => player.answered).length} of{" "}
                    {room.players.length} answered
                  </span>
                  <span className="answered-label">
                    {hasAnswered ? (
                      <>
                        <Check size={13} /> ANSWER LOCKED IN
                      </>
                    ) : (
                      "CHOOSE WISELY"
                    )}
                  </span>
                </div>
              </div>
            )}

            <aside className="live-scores">
              <div className="live-scores-heading">
                <span>
                  <Medal size={16} /> LIVE SCORES
                </span>
                <span>+10 PER CORRECT</span>
              </div>
              <div className="live-score-list">
                {sortedPlayers.map((player, index) => (
                  <div className="live-score-row" key={player.id}>
                    <span
                      className={`rank-number${index === 0 ? " rank-first" : ""}`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="mini-avatar">
                      {player.username.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="live-player-name">
                      {player.username}
                      {player.id === myId ? <i> (you)</i> : null}
                    </span>
                    {isPlaying && player.answered && (
                      <Check className="live-answered" size={14} />
                    )}
                    <strong className="live-player-score">
                      {player.score}
                    </strong>
                  </div>
                ))}
              </div>
            </aside>
            {error && (
              <p aria-live="polite" className="error-message quiz-error">
                {error}
              </p>
            )}
          </section>
        )}

        {mode === "game" && room?.phase === "finished" && (
          <section className="results-layout">
            <div className="results-heading">
              <span className="winner-badge">
                <Crown size={17} /> GAME COMPLETE
              </span>
              <h1>
                And the
                <br />
                <span>bragging</span>
                <br />
                begins<span className="period">.</span>
              </h1>
              <p className="home-description">
                That was a good game. Here&apos;s how your crew stacked up.
              </p>
              <button
                className="primary-button play-again-button"
                onClick={leaveGame}
                type="button"
              >
                <RotateCcw size={16} /> Play again
              </button>
            </div>
            <div className="leaderboard-card">
              <div className="leaderboard-heading">
                <div>
                  <div className="card-kicker">THE FINAL SCORES</div>
                  <h2>Leaderboard</h2>
                </div>
                <span className="leaderboard-code">{room.code}</span>
              </div>
              <div className="podium">
                {sortedPlayers.slice(0, 3).map((player, index) => (
                  <div
                    className={`podium-player podium-${index + 1}`}
                    key={player.id}
                  >
                    <div className={`podium-avatar podium-avatar-${index + 1}`}>
                      {index === 0 ? (
                        <Crown size={17} />
                      ) : (
                        player.username.slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <span className="podium-name">{player.username}</span>
                    <span className="podium-score">
                      {player.score}
                      <small>pts</small>
                    </span>
                    <div className={`podium-block podium-block-${index + 1}`}>
                      <span>{index + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="final-list">
                {sortedPlayers.map((player, index) => (
                  <div className="final-row" key={player.id}>
                    <span
                      className={`final-rank${index === 0 ? " final-rank-winner" : ""}`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="final-avatar">
                      {player.username.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="final-name">
                      {player.username}
                      {player.id === myId ? <i> (you)</i> : null}
                    </span>
                    {index === 0 && (
                      <span className="winner-label">
                        <Crown size={12} /> WINNER
                      </span>
                    )}
                    <strong className="final-score">
                      {player.score}
                      <small> pts</small>
                    </strong>
                  </div>
                ))}
              </div>
              <div className="total-points">
                <span>MAX POSSIBLE SCORE</span>
                <strong>{room.totalQuestions * 10} PTS</strong>
              </div>
            </div>
          </section>
        )}
      </div>

      <footer className="page-footer">
        <span>
          QUIZ CLUB <i>·</i> GOOD GAMES, GOOD COMPANY
        </span>
        <span>
          10 QUESTIONS <i>·</i> 10 SECONDS <i>·</i> 10 POINTS
        </span>
      </footer>
    </main>
  );
}

export default App;
