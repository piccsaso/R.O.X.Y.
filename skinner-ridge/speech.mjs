export function createSpeech(onFallback) {
  let controller, audio, url, generation = 0;
  function cancel() {
    generation++;
    controller?.abort();
    controller = null;
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; }
    if (url) { URL.revokeObjectURL(url); url = null; }
    window.speechSynthesis?.cancel();
  }
  async function speak(text) {
    cancel();
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
      await audio.play();
    } catch {
      if (current !== generation) return;
      cancel();
      onFallback();
      if (window.speechSynthesis) {
        window.speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(text), {rate:1.05}));
      }
    }
  }
  return {speak, cancel};
}
