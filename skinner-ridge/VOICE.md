# ElevenLabs voice

Use Node.js 20 or newer. In the skinner-ridge directory, set ELEVENLABS_API_KEY in the server environment and run node serve.mjs. Keep the key out of source control and browser code. Optionally set ELEVENLABS_VOICE_ID and ELEVENLABS_MODEL_ID. Defaults use the documentation example voice and eleven_multilingual_v2.

Navigation and warning callouts send their text to ElevenLabs. Requests can consume your ElevenLabs credits. Browser speech is used if configuration, synthesis, or starting playback fails, with a visible status message. Mute and push-to-talk cancel pending playback. The server binds to localhost. Live provider audio requires your own valid API key and has not been verified during implementation.
