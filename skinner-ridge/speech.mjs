// This code was assisted through the use of SI.
export function createSpeech(onFallback, {timeoutMs=3000}={}) {
  let controller, audio, url, completion, generation = 0;
  function cancel() {
    generation++;
    controller?.abort();
    controller = null;
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; }
    if (url) { URL.revokeObjectURL(url); url = null; }
    window.speechSynthesis?.cancel();
    const done = completion;
    completion = null;
    done?.();
  }
  async function speak(text, onComplete, onPlayback) {
    cancel();
    completion = onComplete;
    const current = generation;
    controller = new AbortController();
    const requestController=controller;
    const requestTimeout=setTimeout(()=>requestController.abort(),timeoutMs);
    try {
      const response = await fetch('/api/tts', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({text}), signal:controller.signal
      });
      if (!response.ok) throw new Error('Speech unavailable');
      const blob = await response.blob();
      clearTimeout(requestTimeout);
      if (current !== generation) return;
      url = URL.createObjectURL(blob);
      audio = new Audio(url);
      audio.onended = () => { if (current === generation) cancel(); };
      audio.onerror = () => { if (current === generation) cancel(); };
      onPlayback?.();
      await audio.play();
    } catch {
      clearTimeout(requestTimeout);
      if (current !== generation) return;
      // Keep the completion callback until fallback audio has finished.
      controller = null;
      if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; }
      if (url) { URL.revokeObjectURL(url); url = null; }
      onFallback();
      if (window.speechSynthesis) {
        const finish = () => { if (current === generation) cancel(); };
        try {
          onPlayback?.();
          window.speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(text), {rate:1.05,onend:finish,onerror:finish}));
        } catch { finish(); }
      } else cancel();
    } finally {
      clearTimeout(requestTimeout);
    }
  }
  return {speak, cancel};
}
