# Host Roxy on Render Free

[Deploy to Render](https://render.com/deploy?repo=https://github.com/piccsaso/nasa-hackathon)

Sign in to Render and use the link above to create a Blueprint from `main`.
The root-level `render.yaml` selects a **Free** Node.js web service and uses
the bundled terrain assets without rebuilding them. No database or disk is needed.

For a manually created Web Service, use:

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Root directory | `skinner-ridge` |
| Build command | `npm ci` |
| Start command | `npm start` |
| Instance type | Free |
| Environment | `NODE_VERSION=24.22.1`, `HOST=0.0.0.0` |

Render supplies `PORT`, `RENDER`, and `RENDER_EXTERNAL_URL`. The server uses
these to accept public traffic and same-origin HTTPS speech requests.
Local `npm start` still listens on `127.0.0.1:8080` by default.

## Optional ElevenLabs speech

Add `ELEVENLABS_API_KEY` in the service's Environment settings. Optionally add
`ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL_ID`. Do not commit credentials or
upload `.env.local` to GitHub. Without a key, Roxy falls back to browser speech.
Speech recognition still uses the browser and requires microphone permission.
ElevenLabs usage is separate from Render's free hosting allowance.

## Check the public link

Wait for the deployment to become Live, then open its HTTPS `onrender.com` URL
in Chrome or Edge on another computer. Check terrain loading, movement,
overlays, weather, typed commands, and microphone commands. If configured,
check ElevenLabs replies too. No judge should need to log in.

Free web services sleep after 15 minutes without incoming traffic, so the next
visit can take about a minute to start. Terrain downloads also consume the
workspace's bandwidth allowance. See [Render's free limits](https://render.com/docs/free).
