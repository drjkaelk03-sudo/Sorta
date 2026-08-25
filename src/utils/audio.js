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
    
    if (audioCtx) {
      // 1. Attempt standard resume
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      
      // 2. FIX: The iOS WebKit Unlocker
      // Play a microscopic, silent buffer immediately to permanently authorize the audio context
      const buffer = audioCtx.createBuffer(1, 1, 22050);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start(0);
    }
  } catch (e) {
    console.warn("Audio initialization bypassed.");
  }
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
    // Note: This API is natively blocked by Apple on all iOS devices.
    // It will gracefully degrade to nothing on iPhone, but work perfectly on Android.
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      if (type === 'suspense') window.navigator.vibrate(50);
      if (type === 'success') window.navigator.vibrate([30, 50, 30, 50, 100]);
      if (type === 'error') window.navigator.vibrate([100, 30, 100]);
    }
  } catch (e) {}
};