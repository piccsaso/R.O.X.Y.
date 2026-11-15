export function createSpeech(onFallback) {
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
  async function speak(text, onComplete) {
    cancel();
    completion = onComplete;
    const current = generation;
    controller = new AbortController();
    try {
      const response = await fetch('/api/tts', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({text}), signal:controller.signal
      });
      if (!response.ok) throw new Error('Speech unavailable');
      const blob = await response.blob();
      if (current !== generation) return;
      url = URL.createObjectURL(blob);
      audio = new Audio(url);
      audio.onended = () => { if (current === generation) cancel(); };
      audio.onerror = () => { if (current === generation) cancel(); };
      await audio.play();
    } catch {
      if (current !== generation) return;
      // Keep the completion callback until fallback audio has finished.
      controller = null;
      if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; }
      if (url) { URL.revokeObjectURL(url); url = null; }
      onFallback();
      if (window.speechSynthesis) {
        const finish = () => { if (current === generation) cancel(); };
        try {
          window.speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(text), {rate:1.05,onend:finish,onerror:finish}));
        } catch { finish(); }
      } else cancel();
    }
  }
  return {speak, cancel};
}
