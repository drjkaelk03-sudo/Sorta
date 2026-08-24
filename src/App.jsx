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
    let isMounted = true; // Safely prevent React state updates if component unmounts

    const loadPuzzle = async () => {
      try {
        // FIX 1: Strip the timezone parameter. The server dictates the time globally.
        const response = await fetch('/api/daily');
        
        if (!response.ok) throw new Error('Failed to load puzzle');
        const serverPuzzle = await response.json();

        if (typeof window !== 'undefined') {
          localStorage.setItem('sorta_daily_cache', JSON.stringify({
            timestamp: Date.now(),
            puzzle: serverPuzzle
          }));
        }

        if (isMounted) {
          setDailyPuzzle(serverPuzzle);
          setLoading(false);
        }
      } catch (err) {
        console.warn("Network fetch failed, attempting cache fallback...", err);
        try {
          const cached = localStorage.getItem('sorta_daily_cache');
          if (cached) {
            const { puzzle, timestamp } = JSON.parse(cached);
            // If cache is less than 12 hours old, safely use it
            if (Date.now() - timestamp < 43200000 && isMounted) {
              setDailyPuzzle(puzzle);
              setLoading(false);
              return;
            }
          }
        } catch(cacheErr) {}

        if (isMounted) {
          console.error("Cache failed or expired. Initializing Emergency Puzzle.");
          setDailyPuzzle(EMERGENCY_PUZZLE);
          setLoading(false);
        }
      }
    };

    loadPuzzle();

    // FIX 2: Removed the self-DDoS polling. Hitting the API once on load is sufficient.
    const preventSafariZoom = (e) => e.touches && e.touches.length > 1 && e.preventDefault();
    document.addEventListener('touchmove', preventSafariZoom, { passive: false });

    return () => {
      isMounted = false;
      document.removeEventListener('touchmove', preventSafariZoom, { passive: false });
    };
  }, []);

  if (loading) return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617', color: '#06B6D4', fontFamily: 'monospace' }}>INITIALIZING ENGINE...</div>;
  if (!dailyPuzzle) return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617', color: '#f59e0b', fontFamily: 'monospace' }}>CRITICAL ENGINE FAILURE</div>;

  return <GameBoard key={dailyPuzzle.id} dailyPuzzle={dailyPuzzle} />;
}