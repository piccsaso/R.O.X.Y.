# ElevenLabs voice

Use Node.js 22.9 or newer. Run npm install in the skinner-ridge directory, then npm start. Startup loads .env.local when present. ElevenLabs onboarding saves ELEVENLABS_API_KEY there. You can also supply the key through the server environment. Keep the key out of source control and browser code. Optionally set ELEVENLABS_VOICE_ID and ELEVENLABS_MODEL_ID. Defaults use Jessica (a warm, conversational female voice) and eleven_multilingual_v2.

Navigation, overlay, conversation, and warning callouts send their text to ElevenLabs. Requests can consume your ElevenLabs credits. Browser speech is used if configuration, synthesis, or starting playback fails, with a visible status message. Mute and turning Roxy off cancel pending playback. Recognition pauses during spoken replies and resumes afterward. The server binds to localhost. Live provider audio requires your own valid API key and has not been verified during implementation.

Roxy starts enabled on page load, subject to browser microphone permission and speech-recognition support. The microphone control shows failures and allows retrying or turning voice off. Saying “Roxy” silently opens the controls and listens for a command; it does not speak a wake-up question. See OVERLAYS.md for commands.
