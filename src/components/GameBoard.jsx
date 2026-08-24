import React, { useState, useEffect, useRef } from 'react';
import { Reorder, motion, AnimatePresence } from 'framer-motion';
import { Share, Volume2, VolumeX, BarChart2 } from 'lucide-react';

// External Local Imports
import GameTile from './GameTile';
import StatsModal from './StatsModal'; // <--- THIS WAS MISSING
import { getPlayerStats, savePlayerStats } from '../utils/storage';
import { initAudio, playAudio, triggerHaptic } from '../utils/audio';
import { useTelemetry, getOrCreateAnonId } from '../utils/telemetry';

const MAX_ATTEMPTS = 5;

// Fisher-Yates (Knuth) Shuffle for mathematically true randomness
const getInitialSequence = (items) => {
  let array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

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

const generateShareString = (attempts, puzzleId) => {
  let text = `Sorta #${puzzleId} ◦ ${attempts.length > 0 && attempts[attempts.length-1].exactMatches === 6 ? attempts.length : 'X'}/${MAX_ATTEMPTS}\n\n`;
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

  if (attempts.length > 0) {
    if (attempts[attempts.length - 1].exactMatches === 6) {
      scorePath += " ✨";
    } else if (attempts.length >= MAX_ATTEMPTS) {
      scorePath += " 💀";
    }
  }

  return text + scorePath;
};

export default function GameBoard({ dailyPuzzle }) {
  const [sequence, setSequence] = useState(getInitialSequence(dailyPuzzle.items));
  const [attempts, setAttempts] = useState([]);
  const [phase, setPhase] = useState('idle');
  const [gameState, setGameState] = useState('playing'); 
  const [shareCopied, setShareCopied] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  
  const [communityStats, setCommunityStats] = useState(null);
  const [playerStats, setPlayerStats] = useState(getPlayerStats());
  const [showStatsModal, setShowStatsModal] = useState(false);

  const isMounted = useRef(true);
  const isSubmitting = useRef(false);

  const maxRevealedValue = Math.max(...sequence.map(i => i.numericValue || 0), 10);

  const { logAttempt } = useTelemetry(dailyPuzzle.id, gameState !== 'playing');

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/stats?puzzleId=${dailyPuzzle.id}`);
        if (!response.ok) throw new Error("Stats fetch failed");
        
        if (isMounted.current) {
          const data = await response.json();
          setCommunityStats(data);
        }
      } catch (error) {
        console.warn("Server offline. Loading mock community stats for preview.");
        if (isMounted.current) {
          setCommunityStats({
            totalPlayers: 14205,
            parAttempts: 3.4
          });
        }
      }
    };
    fetchStats();
  }, [dailyPuzzle.id]);

  useEffect(() => {
    const handleResize = () => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      document.dispatchEvent(new Event('pointercancel'));
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

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

  const handleLockIn = async () => {
    if (phase !== 'idle' || gameState !== 'playing' || isSubmitting.current) return;
    isSubmitting.current = true;

    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.dispatchEvent(new Event('pointercancel'));

    initAudio();
    setPhase('suspense');
    playAudio('suspense_hum', isAudioMuted);
    triggerHaptic('suspense');

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 5000);

    // FIXED: Scope bug resolved by passing all required arguments locally
    const processCalibrationResult = (exactMatches, currentAttemptNum, revealData) => {
      const newAttempt = { attemptNumber: currentAttemptNum, sequence: [...sequence], exactMatches };
      logAttempt(newAttempt.attemptNumber, exactMatches, 0);

      setAttempts(prev => [...prev, newAttempt]);
      
      if (revealData) {
        setSequence(prev => prev.map(item => revealData.find(r => r.id === item.id) || item));
      }

      const isWin = exactMatches === sequence.length;

      if (isWin) {
        setPhase('path_a_win');
        setGameState('won');
        triggerHaptic('success');

        setPlayerStats(prev => {
          const isConsecutive = prev.lastPlayedPuzzleId === dailyPuzzle.id - 1;
          const newStreak = isConsecutive ? prev.currentStreak + 1 : 1;

          const newStats = {
            ...prev,
            played: prev.played + 1,
            wins: prev.wins + 1,
            currentStreak: newStreak,
            maxStreak: Math.max(prev.maxStreak, newStreak),
            lastPlayedPuzzleId: dailyPuzzle.id,
            distribution: prev.distribution.map((d, i) => i === currentAttemptNum - 1 ? d + 1 : d)
          };
          savePlayerStats(newStats);
          return newStats;
        });
        setTimeout(() => { if (isMounted.current) setShowStatsModal(true); }, 3500);

        sequence.forEach((_, i) => {
          setTimeout(() => {
            if (!isMounted.current) return;
            if (!isAudioMuted && window.AudioContext) {
                try {
                  const tempAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                  const osc = tempAudioCtx.createOscillator();
                  const gain = tempAudioCtx.createGain();
                  osc.type = 'sine';
                  osc.frequency.setValueAtTime(440 + (i * 110), tempAudioCtx.currentTime);
                  gain.gain.setValueAtTime(0, tempAudioCtx.currentTime);
                  gain.gain.linearRampToValueAtTime(0.3, tempAudioCtx.currentTime + 0.05);
                  gain.gain.exponentialRampToValueAtTime(0.01, tempAudioCtx.currentTime + 0.3);
                  osc.connect(gain);
                  gain.connect(tempAudioCtx.destination);
                  osc.start(tempAudioCtx.currentTime);
                  osc.stop(tempAudioCtx.currentTime + 0.3);
                } catch(e){}
            }
          }, i * 200);
        });
      } else {
        setPhase('path_b_near_miss');
        playAudio('thud_dissonant', isAudioMuted);
        triggerHaptic('error');

        setTimeout(() => {
          if (!isMounted.current) return;
          if (currentAttemptNum >= MAX_ATTEMPTS) {
            setGameState('lost');

            setPlayerStats(prev => {
              const newStats = {
                ...prev,
                played: prev.played + 1,
                currentStreak: 0,
                lastPlayedPuzzleId: dailyPuzzle.id
              };
              savePlayerStats(newStats);
              return newStats;
            });
            setTimeout(() => { if (isMounted.current) setShowStatsModal(true); }, 2500);
          }
          setPhase('idle');
          isSubmitting.current = false; 
        }, 500); // Tightened timeout loop
      }
    };

    try {
      const [validationRes] = await Promise.all([
        fetch('/api/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            puzzleId: dailyPuzzle.id,
            attemptSequence: sequence,
            anonId: getOrCreateAnonId() 
          }),
          signal: abortController.signal
        }),
        new Promise(res => setTimeout(res, 1500))
      ]);

      clearTimeout(timeoutId);
      if (!isMounted.current) return;

      if (!validationRes.ok) throw new Error("Validation failed");
      const data = await validationRes.json();
      
      processCalibrationResult(data.exactMatches, data.attemptNumber, data.revealData);

    } catch (err) {
      console.warn("Server offline. Using local offline grading fallback.", err);
      if (!isMounted.current) return;

      let exactMatches = 0;
      sequence.forEach((item, index) => {
        if (item.id === dailyPuzzle.items[index].id) exactMatches++;
      });
      
      const currentAttemptNum = attempts.length + 1;
      const revealData = currentAttemptNum >= MAX_ATTEMPTS || exactMatches === sequence.length 
        ? dailyPuzzle.items 
        : null;

      processCalibrationResult(exactMatches, currentAttemptNum, revealData);
    }
  };

  const handleShare = async () => {
    const text = generateShareString(attempts, dailyPuzzle.id);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setShareCopied(true);
      setTimeout(() => { if (isMounted.current) setShareCopied(false); }, 2000);
    } catch (err) {
      console.error("Failed to copy", err);
      alert("Clipboard access denied by browser. Try copying manually!");
    }
  };

  const currentScore = attempts.length > 0 ? attempts[attempts.length - 1].exactMatches : 0;
  const isGameOver = gameState === 'won' || gameState === 'lost';

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        * { box-sizing: border-box; }
        body { 
          background-color: #020617; 
          margin: 0; 
          padding: 0; 
          font-family: system-ui, sans-serif; 
          overflow-x: hidden; 
          touch-action: manipulation; 
          overscroll-behavior-y: none; 
          -webkit-user-select: none; 
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
        }
        
        button, div { -webkit-tap-highlight-color: transparent; }
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

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '1.5rem', paddingBottom: '4rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
        <div style={{ width: '100%', maxWidth: '450px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
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
              <button onClick={() => setShowStatsModal(true)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                <BarChart2 size={18} />
              </button>
              <button onClick={() => setIsAudioMuted(!isAudioMuted)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                {isAudioMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </div>
          </div>

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

          <div style={{ width: '100%', textAlign: 'center', marginBottom: '0.5rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em' }}>
            ▲ {dailyPuzzle.topLabel || "HIGHEST"} ▲
          </div>

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
                  maxRevealedValue={maxRevealedValue}
                />
              ))}
            </Reorder.Group>
          </motion.div>

          <div style={{ width: '100%', textAlign: 'center', marginTop: '0.25rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em' }}>
            ▼ {dailyPuzzle.bottomLabel || "LOWEST"} ▼
          </div>

          <div style={{ marginTop: '1.5rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!isGameOver ? (
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
            ) : (
              <button
                onClick={handleShare}
                style={{
                  width: '100%',
                  padding: '1.25rem',
                  backgroundColor: shareCopied ? '#10B981' : '#06B6D4',
                  color: '#020617',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: shareCopied ? '0 4px 20px rgba(16, 185, 129, 0.3)' : '0 4px 20px rgba(6, 182, 212, 0.3)',
                  transition: 'all 0.2s ease',
                  textTransform: 'uppercase'
                }}
              >
                {shareCopied ? 'COPIED TO CLIPBOARD' : 'SHARE RESULTS'} <Share size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showStatsModal && (
          <StatsModal 
            stats={playerStats} 
            communityStats={communityStats}
            onClose={() => setShowStatsModal(false)} 
            show={showStatsModal} 
            onShare={handleShare}
            shareCopied={shareCopied}
          />
        )}
      </AnimatePresence>
    </>
  );
}