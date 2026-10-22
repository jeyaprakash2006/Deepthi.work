# Voice Studio

Open `/tools/voice-studio`. Script drafts are stored on this device. Device preview uses Web Speech API voices installed/available in the browser. Tamil requires a Tamil voice; preview is not an audio export. Device voices may use the operating system's online speech service.

For natural MP3 generation locally, set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in `.env.local`, then restart Vite. The configured voice must be available to the API account. The server uses Eleven v3, Tamil/English language codes, and MP3 44.1kHz/128kbps. Generation sends the script to ElevenLabs and consumes its quota. Device preview settings do not change natural generation.

The API is deliberately localhost-only, with body limits, timeouts, a single active generation, 3 attempts/minute and 20/day (in-memory, reset on process restart). These are local guardrails, not production account quotas.

Firebase Hosting serves the UI only. To enable online generation, deploy an authenticated server endpoint with protected credentials, durable per-user quotas and matching hosting rewrites. Do not expose keys in client environment variables or remove the localhost restriction to publish the current development handler.

Reference: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
