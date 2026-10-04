# Quiz Club

Quiz Club is a real-time quiz game for a group of **exactly 3 players**. Create a room, share its six-character code, and compete across 10 quick questions.

## Features

- Create a private room or join one with a game code
- Live lobby showing the three player seats
- Ten multiple-choice questions, with 10 seconds to answer each
- Live scores, answer feedback, and a final leaderboard
- Real-time multiplayer updates powered by Socket.IO

## Requirements

- Node.js
- npm

## Run locally

Install dependencies:

```bash
npm install
```

Start the client and game server in development mode:

```bash
npm run dev
```

Open the Vite URL shown in the terminal (usually <http://localhost:5173>). The Vite development server proxies Socket.IO connections to the game server on port `3001`.

## Production

Build the client:

```bash
npm run build
```

Start the server:

```bash
npm start
```

The Express server serves the production client and handles Socket.IO connections. By default, it listens on port `3001`; set `PORT` to use another port.

## Deploying to Vercel

Vercel hosts the frontend, while the Socket.IO game server needs a persistent Node.js process. The included `render.yaml` configures the backend for Render, including the `https://meroquiz.vercel.app` browser origin. To deploy it, create a Render Blueprint from this repository and deploy the `meroquiz-api` web service. The client uses `https://myquizapp-w08z.onrender.com` by default in production; if Render assigns a different service URL, set `VITE_SERVER_URL` to that URL in Vercel and redeploy.

The backend's `/health` endpoint can be used to check that the service is running. If the connection still fails, verify that the backend is deployed and publicly reachable, that its URL uses `https://`, and that `CLIENT_ORIGIN` matches the frontend origin. Vercel preview deployments have different origins and need to be allowed separately if used for testing. Render's free service may take a short time to wake after inactivity.

## How to play

1. Enter a player name and create a game, or enter a friend's six-character code to join.
2. Share the code with one other player. A room accepts up to three players, including its host.
3. The quiz starts automatically when the third player joins.
4. Choose one answer per question before the 10-second timer ends. Correct answers are worth 10 points.
5. Check the live scores during the game and the leaderboard at the end.

Room codes and game state are held in server memory, so active rooms are cleared when the server restarts.

## Configuration

| Variable          | Purpose                                                           | Default     |
| ----------------- | ----------------------------------------------------------------- | ----------- |
| `PORT`            | Port for the Express and Socket.IO server                         | `3001`      |
| `CLIENT_ORIGIN`   | Allowed browser origin for Socket.IO connections                  | Any origin  |
| `VITE_SERVER_URL` | Public Socket.IO server URL, embedded in the client at build time | Same origin |

For a separate frontend and backend deployment, set `VITE_SERVER_URL` when building the client and configure `CLIENT_ORIGIN` on the server to allow the frontend origin.
