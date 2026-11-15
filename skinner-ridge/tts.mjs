export async function handleTts(request, response) {
  const fail = (status, message) => response.writeHead(status, {'Content-Type':'text/plain', 'Cache-Control':'no-store'}).end(message);
  if (request.method !== 'POST') return fail(405, 'POST required');
  if (request.headers.origin && request.headers.origin !== 'http://' + request.headers.host) return fail(403, 'Origin rejected');
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
    const voice = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
    const upstream = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voice) + '?output_format=mp3_44100_128', {
      method:'POST',
      headers:{'xi-api-key':key, 'Content-Type':'application/json'},
      body:JSON.stringify({text:data.text, model_id:process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'}),
      signal:AbortSignal.timeout(20000)
    });
    if (!upstream.ok) return fail(502, 'Speech provider unavailable');
    const audio = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(200, {'Content-Type':'audio/mpeg', 'Content-Length':audio.length, 'Cache-Control':'no-store'}).end(audio);
  } catch { if (!response.destroyed) fail(502, 'Speech request failed'); }
}
