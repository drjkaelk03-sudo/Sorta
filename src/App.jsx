import React, { useState, useEffect } from 'react';
import GameBoard from './components/GameBoard';

// ==========================================
// EMERGENCY FAILSAFE PUZZLE
// ==========================================
const EMERGENCY_PUZZLE = {
  id: 999,
  date: "1999-01-01",
  title: "Vercel is Offline (Backup Puzzle)",
  unit: "YEARS OLD",
  topLabel: "OLDEST",
  bottomLabel: "NEWEST",
  items: [
    { id: "1", title: "THE UNIVERSE", displayValue: "13.8 B", numericValue: 13800000000 },
    { id: "2", title: "EARTH", displayValue: "4.5 B", numericValue: 4500000000 },
    { id: "3", title: "DINOSAURS (EXTINCTION)", displayValue: "66 M", numericValue: 66000000 },
    { id: "4", title: "HUMAN CIVILIZATION", displayValue: "6,000", numericValue: 6000 },
    { id: "5", title: "THE INTERNET", displayValue: "41", numericValue: 41 },
    { id: "6", title: "THIS GAME", displayValue: "0", numericValue: 0 }
  ]
};

// ==========================================
// APP COMPONENT
// ==========================================
export default function App() {
  const [dailyPuzzle, setDailyPuzzle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAndCheckPuzzle = async () => {
      try {
        const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const response = await fetch(`/api/daily?tz=${encodeURIComponent(userTz)}`);
        
        if (!response.ok) throw new Error('Failed to load puzzle');
        const serverPuzzle = await response.json();

        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('sorta_daily_cache', JSON.stringify({
              timestamp: Date.now(),
              puzzle: serverPuzzle
            }));
          }
        } catch (storageErr) {}

        setDailyPuzzle(currentPuzzle => !currentPuzzle ? serverPuzzle : currentPuzzle);
        setLoading(false);
      } catch (err) {
        try {
          const cached = localStorage.getItem('sorta_daily_cache');
          if (cached) {
            const { puzzle, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 86400000) {
              setDailyPuzzle(puzzle);
              setLoading(false);
              return;
            }
          }
        } catch(cacheErr) {}

        setDailyPuzzle(EMERGENCY_PUZZLE);
        setLoading(false);
      }
    };

    loadAndCheckPuzzle();
    const handleVisibilityChange = () => document.visibilityState === 'visible' && loadAndCheckPuzzle();
    const preventSafariZoom = (e) => e.touches && e.touches.length > 1 && e.preventDefault();

    window.addEventListener('focus', loadAndCheckPuzzle);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('touchmove', preventSafariZoom, { passive: false });
    const clockTick = setInterval(loadAndCheckPuzzle, 60000);

    return () => {
      window.removeEventListener('focus', loadAndCheckPuzzle);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('touchmove', preventSafariZoom, { passive: false });
      clearInterval(clockTick);
    };
  }, []);

  if (loading) return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617', color: '#06B6D4', fontFamily: 'monospace' }}>INITIALIZING ENGINE...</div>;
  if (!dailyPuzzle) return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617', color: '#f59e0b', fontFamily: 'monospace' }}>CRITICAL ENGINE FAILURE</div>;

  return <GameBoard key={dailyPuzzle.id} dailyPuzzle={dailyPuzzle} />;
}