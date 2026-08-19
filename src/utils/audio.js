// ==========================================
// AUDIO & HAPTICS ENGINE
// ==========================================
let audioCtx = null;

export const initAudio = () => {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  } catch (e) {}
};

export const playAudio = (type, isMuted) => {
  if (!audioCtx || isMuted) return;
  try {
    const time = audioCtx.currentTime;
    if (type === 'suspense_hum') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(40, time);
      osc.frequency.linearRampToValueAtTime(70, time + 1.8);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.4, time + 0.6);
      gain.gain.linearRampToValueAtTime(0, time + 2.0);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(time);
      osc.stop(time + 2.0);
    } else if (type === 'thud_dissonant') {
      [100, 106].forEach(freq => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.exponentialRampToValueAtTime(30, time + 0.3);
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(time);
        osc.stop(time + 0.3);
      });
    }
  } catch (e) {}
};

export const triggerHaptic = (type) => {
  try {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      if (type === 'suspense') window.navigator.vibrate(50);
      if (type === 'success') window.navigator.vibrate([30, 50, 30, 50, 100]);
      if (type === 'error') window.navigator.vibrate([100, 30, 100]);
    }
  } catch (e) {}
};