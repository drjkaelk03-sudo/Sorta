import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Reorder, motion, animate, AnimatePresence } from 'framer-motion';
import { Share, CheckCircle, Info, Volume2, VolumeX } from 'lucide-react';

const MAX_ATTEMPTS = 5;

// ==========================================
// TELEMETRY ENGINE
// ==========================================
const ANON_ID_KEY = 'sorta_anon_id';
const TELEMETRY_ENDPOINT = '/api/telemetry';

let fallbackSessionId = null;

function getOrCreateAnonId() {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = `usr_${crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14)}`;
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch (error) {
    if (!fallbackSessionId) {
      fallbackSessionId = `tmp_${Math.random().toString(36).slice(2, 14)}`;
    }
    return fallbackSessionId;
  }
}

function sendTelemetry(eventData) {
  if (typeof window === 'undefined') return false;
  const payload = {
    ...eventData,
    anonId: getOrCreateAnonId(),
    timestamp: Date.now(),
    deviceType: window.innerWidth <= 768 ? 'mobile' : 'desktop',
  };

  try {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon) {
      return navigator.sendBeacon(TELEMETRY_ENDPOINT, blob);
    }
    fetch(TELEMETRY_ENDPOINT, { method: 'POST', body: blob, keepalive: true }).catch(() => {});
    return true;
  } catch (e) {
    return false;
  }
}

function useTelemetry(puzzleId, isPuzzleComplete) {
  const sessionStartTime = useRef(Date.now());
  const attemptStartTime = useRef(Date.now());
  const lastAttemptState = useRef({ num: 0, scoreK: 0 });

  const logAttempt = useCallback((attemptNum, scoreK, swapsCount) => {
    const now = Date.now();
    const timeOnAttemptMs = now - attemptStartTime.current;
    lastAttemptState.current = { num: attemptNum, scoreK };

    sendTelemetry({ event: 'attempt_submit', puzzleId, attemptNum, scoreK, swapsCount, timeOnAttemptMs });
    attemptStartTime.current = now;
  }, [puzzleId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !isPuzzleComplete && lastAttemptState.current.num > 0) {
        sendTelemetry({
          event: 'puzzle_abandoned',
          puzzleId,
          lastAttemptNum: lastAttemptState.current.num,
          lastScoreK: lastAttemptState.current.scoreK,
          totalTimeElapsedMs: Date.now() - sessionStartTime.current,
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [puzzleId, isPuzzleComplete]);

  return { logAttempt };
}

// ==========================================
// GAME UTILS & AUDIO
// ==========================================
// Fisher-Yates (Knuth) Shuffle for mathematically true randomness
const getInitialSequence = (items) => {
  let array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  // Prevent accidentally solving it on load
  let isPerfect = true;
  for (let i = 0; i < array.length; i++) {
    if (array[i].id !== items[i].id) {
      isPerfect = false;
      break;
    }
  }

  if (isPerfect) {
    [array[0], array[1]] = [array[1], array[0]];
  }
  return array;
};

let audioCtx = null;
const initAudio = () => {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  } catch (e) {}
};

const playAudio = (type, isMuted) => {
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

const triggerHaptic = (type) => {
  try {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      if (type === 'suspense') window.navigator.vibrate(50);
      if (type === 'success') window.navigator.vibrate([30, 50, 30, 50, 100]);
      if (type === 'error') window.navigator.vibrate([100, 30, 100]);
    }
  } catch (e) {}
};

const generateShareString = (attempts, puzzleId) => {
  let text = `Sorta #${puzzleId} ◦ ${attempts.length}/${MAX_ATTEMPTS}\n\n`;
  let scorePath = "";

  attempts.forEach((att, index) => {
    scorePath += `${att.exactMatches}`;
    if (index < attempts.length - 1) {
      const next = attempts[index + 1].exactMatches;
      if (next > att.exactMatches) scorePath += " ↗ ";
      else if (next < att.exactMatches) scorePath += " ↘ ";
      else scorePath += " ➔ ";
    }
  });

  if (attempts[attempts.length - 1].exactMatches === 6) {
    scorePath += " ✨";
  }

  return text + scorePath + "\n\nsortagame.com";
};

// ==========================================
// COMPONENT: GAME TILE
// ==========================================
function GameTile({ item, index, phase, gameState, handleKeyDown, dailyPuzzle }) {
  const isIdle = phase === 'idle' && gameState === 'playing';
  const isPathA = phase === 'path_a_win' || gameState === 'lost';
  const countRef = useRef(null);

  useEffect(() => {
    if (isPathA) {
      const controls = animate(0, item.numericValue, {
        duration: 1.2,
        delay: index * 0.08, // Tightened cascade ripple
        ease: "easeOut",
        onUpdate: (val) => {
          if (countRef.current) {
            const formatted = val % 1 === 0 ? val.toFixed(0) : val.toFixed(2);
            countRef.current.textContent = `${formatted} ${dailyPuzzle.unit}`;
          }
        },
        onComplete: () => {
          if (countRef.current) {
            countRef.current.textContent = item.displayValue;
          }
        }
      });
      return () => controls?.stop?.();
    }
  }, [isPathA, item.numericValue, item.displayValue, index, dailyPuzzle.unit]);

  const maxValue = Math.max(...dailyPuzzle.items.map(i => i.numericValue));
  const fillWidth = Math.max(15, (item.numericValue / maxValue) * 100);

  return (
    <Reorder.Item
      value={item}
      dragListener={isIdle}
      variants={{ active: { zIndex: 999 }, idle: { zIndex: 1 } }}
      whileDrag="active"
      whileTap={isIdle ? "active" : "idle"}
      initial="idle"
      onKeyDown={(e) => handleKeyDown(e, index)}
      tabIndex={isIdle ? 0 : -1}
      className="keyboard-focus"
      style={{
        width: '100%',
        marginBottom: '0.6rem',
        touchAction: 'none',
        position: 'relative',
        perspective: "1200px",
        outline: 'none',
        userSelect: 'none'
      }}
    >
      <motion.div
        variants={{ active: { scale: 1.03 }, idle: { scale: 1 } }}
        style={{
          width: "100%",
          transformStyle: "preserve-3d",
          position: "relative",
          cursor: isIdle ? "grab" : "default",
        }}
        animate={{
          rotateX: isPathA ? 180 : 0,
          scale: phase === 'path_a_win' ? [1, 1.05, 1] : 1,
        }}
        transition={{
          rotateX: { duration: 0.8, delay: isPathA ? index * 0.08 : 0, type: "spring", bounce: 0.3 }, // Tightened cascade
          scale: { duration: 0.6, delay: 2.0, ease: [0.34, 1.56, 0.64, 1] }
        }}
      >
        {/* FRONT FACE */}
        <div
          className={`front-face ${phase === 'suspense' ? 'pulse-buffer' : ''} ${phase === 'path_a_win' ? 'ignition-glow' : ''}`}
          style={{
            backgroundColor: '#1e293b',
            border: "1px solid #334155",
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            borderRadius: "8px",
            padding: "1.25rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            color: "#f8fafc",
            backfaceVisibility: "hidden",
            transition: "all 0.3s ease",
            animationDelay: phase === 'path_a_win' ? `${index * 0.08}s` : '0s' // Tightened cascade
          }}
        >
          <span style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.02em', textAlign: 'center' }}>
            {item.title}
          </span>
        </div>

        {/* BACK FACE - Reveal */}
        <div
          style={{
            backgroundColor: '#0f172a',
            border: `1px solid ${gameState === 'lost' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
            boxShadow: `0 0 20px ${gameState === 'lost' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'}`,
            borderRadius: "8px",
            padding: "1.25rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            backfaceVisibility: "hidden",
            transform: "rotateX(180deg)",
            overflow: 'hidden'
          }}
        >
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: isPathA ? `${fillWidth}%` : '0%' }}
            transition={{ duration: 1.2, delay: (index * 0.08) + 0.5, ease: [0.16, 1, 0.3, 1] }} // Tightened cascade
            style={{
              position: 'absolute',
              top: 0, left: 0, bottom: 0,
              backgroundColor: gameState === 'lost' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              borderRight: `2px solid ${gameState === 'lost' ? 'rgba(245, 158, 11, 0.8)' : 'rgba(16, 185, 129, 0.8)'}`,
              zIndex: 0
            }}
          />
          <span style={{ fontSize: '1rem', fontWeight: 700, color: "#f8fafc", zIndex: 1 }}>
            {item.title}
          </span>
          <span ref={countRef} style={{ fontSize: '1.1rem', fontWeight: 700, color: gameState === 'lost' ? '#f59e0b' : '#10b981', fontVariantNumeric: "tabular-nums", zIndex: 1 }}>
            0
          </span>
        </div>
      </motion.div>
    </Reorder.Item>
  );
}

// ==========================================
// COMPONENT: MAIN GAME BOARD
// ==========================================
function GameBoard({ dailyPuzzle }) {
  const [sequence, setSequence] = useState(getInitialSequence(dailyPuzzle.items));
  const [attempts, setAttempts] = useState([]);
  const [phase, setPhase] = useState('idle');
  const [gameState, setGameState] = useState('playing'); // playing, won, lost
  const [shareCopied, setShareCopied] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  
  // Community Stats (Real Fetch)
  const [communityStats, setCommunityStats] = useState(null);

  const { logAttempt } = useTelemetry(dailyPuzzle.id, gameState !== 'playing');

  // Fetch Community Data on Mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/stats?puzzleId=${dailyPuzzle.id}`);
        if (response.ok) {
          const data = await response.json();
          setCommunityStats(data);
        }
      } catch (error) {
        console.error("Failed to load community stats");
      }
    };
    
    fetchStats();
  }, [dailyPuzzle.id]);

  useEffect(() => {
    if (gameState !== 'playing') return; 
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, [gameState]);

  const handleKeyDown = (e, index) => {
    if (phase !== 'idle' || gameState !== 'playing') return;
    
    if (e.key === 'ArrowUp' || e.key === 'w') {
      e.preventDefault();
      if (index > 0) {
        const newSeq = [...sequence];
        [newSeq[index - 1], newSeq[index]] = [newSeq[index], newSeq[index - 1]];
        setSequence(newSeq);
        setTimeout(() => document.activeElement?.blur(), 0);
        setTimeout(() => document.querySelectorAll('.keyboard-focus')[index - 1]?.focus(), 10);
      }
    } else if (e.key === 'ArrowDown' || e.key === 's') {
      e.preventDefault();
      if (index < sequence.length - 1) {
        const newSeq = [...sequence];
        [newSeq[index + 1], newSeq[index]] = [newSeq[index], newSeq[index + 1]];
        setSequence(newSeq);
        setTimeout(() => document.activeElement?.blur(), 0);
        setTimeout(() => document.querySelectorAll('.keyboard-focus')[index + 1]?.focus(), 10);
      }
    }
  };

  const handleLockIn = () => {
    if (phase !== 'idle' || gameState !== 'playing') return;
    initAudio();

    let exactMatches = 0;
    sequence.forEach((item, index) => {
      if (item.id === dailyPuzzle.items[index].id) exactMatches++;
    });

    const newAttempt = { attemptNumber: attempts.length + 1, sequence: [...sequence], exactMatches };
    logAttempt(newAttempt.attemptNumber, exactMatches, 0);

    setPhase('suspense');
    playAudio('suspense_hum', isAudioMuted);
    triggerHaptic('suspense');

    setTimeout(() => {
      setAttempts(prev => [...prev, newAttempt]);

      if (exactMatches === 6) {
        setPhase('path_a_win');
        setGameState('won');
        triggerHaptic('success');

        sequence.forEach((_, i) => {
          setTimeout(() => {
            if (!isAudioMuted && audioCtx) {
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(440 + (i * 110), audioCtx.currentTime);
              gain.gain.setValueAtTime(0, audioCtx.currentTime);
              gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
              gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.start(audioCtx.currentTime);
              osc.stop(audioCtx.currentTime + 0.3);
            }
          }, i * 200); // Tightened audio arpeggio
        });
      } else {
        setPhase('path_b_near_miss');
        playAudio('thud_dissonant', isAudioMuted);
        triggerHaptic('error');

        setTimeout(() => {
          if (newAttempt.attemptNumber >= MAX_ATTEMPTS) {
            setSequence([...dailyPuzzle.items]);
            setGameState('lost');
          }
          setPhase('idle');
        }, 1500);
      }
    }, 1500); // Sped up the suspense evaluation time slightly
  };

  const handleShare = async () => {
    const text = generateShareString(attempts, dailyPuzzle.id);
    try {
      await navigator.clipboard.writeText(text);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const currentScore = attempts.length > 0 ? attempts[attempts.length - 1].exactMatches : 0;
  const isGameOver = gameState === 'won' || gameState === 'lost';

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        * { box-sizing: border-box; }
        body { background-color: #020617; margin: 0; padding: 0; font-family: system-ui, sans-serif; overflow-x: hidden; touch-action: manipulation; -webkit-user-select: none; }
        
        .keyboard-focus:focus-visible { outline: 2px solid #06B6D4; outline-offset: 2px; border-radius: 8px; }

        @keyframes microShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        .shake-active { animation: microShake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both; }
        
        @keyframes pulseBuffer {
          0% { box-shadow: inset 0 0 0px rgba(0,0,0,0); filter: brightness(1); }
          50% { box-shadow: inset 0 0 25px rgba(0,0,0,0.6); filter: brightness(0.85); }
          100% { box-shadow: inset 0 0 0px rgba(0,0,0,0); filter: brightness(1); }
        }
        .pulse-buffer { animation: pulseBuffer 0.8s ease-in-out infinite; }

        @keyframes ignitionPulse {
          0% { box-shadow: 0 4px 15px rgba(0,0,0,0.3); border-color: #334155; }
          50% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.6); border-color: #10B981; }
          100% { box-shadow: 0 4px 15px rgba(0,0,0,0.3); border-color: #334155; }
        }
        .ignition-glow { animation: ignitionPulse 1.2s ease-out; }
      `}} />

      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(10px)' }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: '#020617',
              display: 'flex', flexDirection: 'column',
              justifyContent: 'center', alignItems: 'center',
              zIndex: 9999
            }}
          >
            <h1 style={{ color: '#f8fafc', fontSize: '2.5rem', margin: 0, fontWeight: 900, letterSpacing: '0.1em', lineHeight: 1 }}>
              {dailyPuzzle.topLabel || "HIGHEST"}
            </h1>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2.5rem 0' }}>
              <motion.div 
                animate={{ y: [0, -8, 0, 8, 0] }}
                transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                style={{ color: '#06B6D4', fontSize: '4.5rem', lineHeight: 1, marginBottom: '0.5rem' }}
              >
                ↕
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                style={{ color: '#06B6D4', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}
              >
                Drag tiles into correct order
              </motion.p>
            </div>

            <h1 style={{ color: '#f8fafc', fontSize: '2.5rem', margin: 0, fontWeight: 900, letterSpacing: '0.1em', lineHeight: 1 }}>
              {dailyPuzzle.bottomLabel || "LOWEST"}
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '1.5rem', paddingBottom: '4rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
        
        <div style={{ width: '100%', maxWidth: '450px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {/* Header */}
          <div style={{ width: '100%', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1.5rem', zIndex: 10 }}>
            <div style={{ position: 'absolute', left: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.4 }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#06B6D4', boxShadow: '0 0 8px #06B6D4' }} />
              <span style={{ color: '#06B6D4', fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600 }}>#{dailyPuzzle.id.toString().padStart(3, '0')}</span>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ color: '#f8fafc', fontSize: '1.75rem', margin: 0, fontWeight: 900, letterSpacing: '0.05em', userSelect: 'none' }}>SORTA</h1>
              <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{dailyPuzzle.title}</p>
            </div>
            
            <div style={{ position: 'absolute', right: 0, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={() => setIsAudioMuted(!isAudioMuted)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                {isAudioMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </div>
          </div>

          {/* Minimalist Progress Tracker */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                ATTEMPT {Math.min(attempts.length + 1, MAX_ATTEMPTS)} OF {MAX_ATTEMPTS}
              </div>
              <div style={{ color: '#06B6D4', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                CORRECT: {currentScore} / 6
              </div>
            </div>
          </div>

          {/* Game Board */}
          <motion.div 
            className={phase === 'path_b_near_miss' ? 'shake-active' : ''}
            animate={{
              scale: phase === 'suspense' ? 0.97 : 1,
              opacity: phase === 'suspense' ? 0.8 : 1,
            }}
            transition={{ duration: phase === 'suspense' ? 0.8 : 0.3 }}
            style={{ width: '100%', position: 'relative' }}
          >
            <Reorder.Group 
              axis="y" 
              values={sequence} 
              onReorder={setSequence}
              style={{ listStyleType: 'none', padding: 0, margin: 0, width: '100%' }}
            >
              {sequence.map((item, index) => (
                <GameTile 
                  key={item.id}
                  item={item} 
                  index={index} 
                  phase={phase}
                  gameState={gameState}
                  handleKeyDown={handleKeyDown}
                  dailyPuzzle={dailyPuzzle}
                />
              ))}
            </Reorder.Group>
          </motion.div>

          {/* Bottom Control / Share Deck */}
          <div style={{ marginTop: '1.5rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!isGameOver && (
              <button
                onClick={handleLockIn}
                disabled={phase !== 'idle'}
                style={{
                  width: '100%',
                  padding: '1.25rem',
                  backgroundColor: phase === 'idle' ? '#06B6D4' : '#334155',
                  color: phase === 'idle' ? '#020617' : '#94a3b8',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  cursor: phase === 'idle' ? 'pointer' : 'not-allowed',
                  boxShadow: phase === 'idle' ? '0 4px 20px rgba(6, 182, 212, 0.3)' : 'none',
                  transition: 'all 0.2s ease',
                  textTransform: 'uppercase'
                }}
              >
                {phase === 'suspense' ? 'SCANNING SEQUENCE...' : 'CALIBRATE SEQUENCE'}
              </button>
            )}

            {isGameOver && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gameState === 'won' ? 2.5 : 1.5 }} // Sped up modal reveal to match new fast flip cascade
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1rem',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: gameState === 'won' ? '#10B981' : '#F59E0B' }}>
                  {gameState === 'won' ? <CheckCircle size={24} /> : <Info size={24} />}
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                    {gameState === 'won' ? 'PUZZLE SOLVED' : 'MAX ATTEMPTS REACHED'}
                  </h2>
                </div>
                
                <button
                  onClick={handleShare}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    backgroundColor: '#10B981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginTop: '0.5rem',
                  }}
                >
                  {shareCopied ? <CheckCircle size={18} /> : <Share size={18} />}
                  {shareCopied ? 'COPIED TO CLIPBOARD' : 'SHARE RESULTS'}
                </button>

                {/* Community Stats Reveal */}
                {communityStats && (
                  <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', marginTop: '0.5rem', paddingTop: '1.5rem', borderTop: '1px solid #334155' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>PLAYERS TODAY</div>
                      <div style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {communityStats.totalPlayers.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ width: '1px', backgroundColor: '#334155' }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>COMMUNITY PAR</div>
                      <div style={{ color: '#06B6D4', fontSize: '1.25rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {communityStats.parAttempts}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
          
        </div>
      </div>
    </>
  );
}

// ==========================================
// APP COMPONENT (DATA FETCHER)
// ==========================================
export default function App() {
  const [dailyPuzzle, setDailyPuzzle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPuzzle = async () => {
      try {
        const response = await fetch('/puzzles.json');
        if (!response.ok) throw new Error('Failed to load database');
        const puzzles = await response.json();

        // Calculate today's date in local time (YYYY-MM-DD)
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        // Find today's puzzle, or fallback to the most recent one if in the future
        let puzzleForToday = puzzles.find(p => p.date === dateString);
        
        if (!puzzleForToday) {
          puzzleForToday = puzzles[puzzles.length - 1]; // Fallback
        }

        setDailyPuzzle(puzzleForToday);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(true);
        setLoading(false);
      }
    };

    fetchPuzzle();
  }, []);

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617', color: '#06B6D4', fontFamily: 'monospace' }}>INITIALIZING ENGINE...</div>;
  }

  if (error || !dailyPuzzle) {
    return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617', color: '#f59e0b', fontFamily: 'monospace' }}>DATABASE CONNECTION ERROR</div>;
  }

  // Keying GameBoard forces a full unmount/remount when the puzzle ID changes (next day)
  return <GameBoard key={dailyPuzzle.id} dailyPuzzle={dailyPuzzle} />;
}