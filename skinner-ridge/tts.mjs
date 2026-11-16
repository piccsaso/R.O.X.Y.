// This code was assisted through the use of SI.
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export async function handleTts(request, response) {
  const fail = (status, message) => response.writeHead(status, {'Content-Type':'text/plain', 'Cache-Control':'no-store'}).end(message);
  if (request.method !== 'POST') return fail(405, 'POST required');
  const origin = process.env.RENDER_EXTERNAL_URL || 'http://' + request.headers.host;
  if (request.headers.origin && request.headers.origin !== origin) return fail(403, 'Origin rejected');
  if (!request.headers['content-type']?.startsWith('application/json')) return fail(415, 'JSON required');
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return fail(503, 'ElevenLabs is not configured');
  try {
    request.setEncoding('utf8');
    let body = '';
    for await (const chunk of request) {
      body += chunk.toString();
      if (Buffer.byteLength(body) > 8192) return fail(413, 'Request too large');
    }
    let data;
    try { data = JSON.parse(body); } catch { return fail(400, 'Invalid JSON'); }
    if (typeof data?.text !== 'string' || !data.text.trim() || data.text.length > 2000) return fail(400, 'Text must contain 1 to 2000 characters');
    const voice = process.env.ELEVENLABS_VOICE_ID || 'cgSgspJ2msm6clMCkdW9';
    const client = new ElevenLabsClient();
    const stream = await client.textToSpeech.convert(voice, {
      text: data.text,
      modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
      outputFormat: 'mp3_44100_128'
    }, { timeoutInSeconds: 20, maxRetries: 0 });
    const audio = Buffer.from(await new Response(stream).arrayBuffer());
    response.writeHead(200, {'Content-Type':'audio/mpeg', 'Content-Length':audio.length, 'Cache-Control':'no-store'}).end(audio);
  } catch { if (!response.destroyed) fail(502, 'Speech request failed'); }
}
