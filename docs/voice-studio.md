# Voice Studio

Open `/tools/voice-studio`. Script drafts are stored on this device. Device preview uses Web Speech API voices installed/available in the browser. Tamil requires a Tamil voice; preview is not an audio export. Device voices may use the operating system's online speech service.

For natural MP3 generation locally, set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in `.env.local`, then restart Vite. The configured voice must be available to the API account. The server uses Eleven v3, Tamil/English language codes, and MP3 44.1kHz/128kbps. Generation sends the script to ElevenLabs and consumes its quota. Device preview settings do not change natural generation.

The API is deliberately localhost-only, with body limits, timeouts, a single active generation, 3 attempts/minute and 20/day (in-memory, reset on process restart). These are local guardrails, not production account quotas.

Firebase Hosting serves the UI only. To enable online generation, deploy an authenticated server endpoint with protected credentials, durable per-user quotas and matching hosting rewrites. Do not expose keys in client environment variables or remove the localhost restriction to publish the current development handler.

Reference: https://elevenlabs.io/docs/api-reference/text-to-speech/convert

## Gemini

Set `GEMINI_API_KEY` in `.env.local` and restart Vite. Gemini takes priority when both providers are configured. The adapter uses `gemini-3.8-flash-tts` through the Interactions endpoint, with Kore/Puck/Aoede voices and three curated narration styles. Language is detected from script text. Unary output is a complete WAV file; it is validated for RIFF/WAVE headers and downloaded as `.wav`, not mislabeled as MP3. ElevenLabs retains MP3 output.

Free-tier scripts may be used by Google to improve products. The UI discloses this before generation. Production backend deployment and credentials are still required to enable this on Firebase Hosting; adding a key locally does not activate the public website.

Reference: https://ai.google.dev/gemini-api/docs/speech-generation

## Extended narration controls

The studio now offers 30 Gemini prebuilt voices, voice search, 20 language choices (Gemini detects spoken language from the script), seven narration styles and A:/B: multi-speaker scripts. TXT and SRT import is limited to 500 KB and 3,000 characters; SRT timing is intentionally not retained. Script export and approximate word-based duration are available.

Local FFmpeg enables WAV, 192 kbps MP3 and AAC/M4A conversion, 0.5–2× speed, ±12 semitone pitch, volume, optional −16 LUFS loudness normalization, and start/end silence. Capability is checked before generation; unavailable conversion settings are disabled. Normalization determines final loudness after the volume adjustment. Temporary audio files are removed after conversion.

This is a Narakeet-inspired TTS workflow, not the Narakeet service or full feature parity. Narakeet proprietary voices, SSML, exact subtitle alignment, presentation/video rendering, background music mixing, and batch jobs are not included. Public hosting still requires a protected backend with credentials and FFmpeg for natural generation/exports.
