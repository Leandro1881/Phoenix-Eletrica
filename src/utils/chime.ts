/**
 * Toque curto de notificação (duas notas) gerado pelo navegador, sem arquivo de áudio.
 * Os navegadores só liberam som depois que a pessoa interage com a página;
 * antes disso a função não faz nada.
 */
export function playChime() {
  try {
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (activation && !activation.hasBeenActive) return;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx: AudioContext = new AudioCtx();

    [659.25, 880].forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.13;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.08, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.36);
    });

    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    // Som é só um enfeite: qualquer falha é ignorada
  }
}
