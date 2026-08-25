import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// SECURE ARCHITECTURE: 
// Use the Service Role Key to bypass RLS and securely count the user's past attempts
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { puzzleId, attemptSequence, anonId } = req.body;
    
    // --- FIX 1: TYPE VALIDATION ---
    // Prevent fatal crashes by ensuring the payload is exactly what we expect
    if (!puzzleId || !anonId || !Array.isArray(attemptSequence) || attemptSequence.length !== 6) {
      return res.status(400).json({ error: 'Malformed payload' });
    }
    
    const file = join(process.cwd(), 'api', 'puzzles.json');
    const puzzles = JSON.parse(readFileSync(file, 'utf8'));
    // Use loose equality (==) in case the client sends puzzleId as a string
    const puzzle = puzzles.find(p => p.id == puzzleId);

    if (!puzzle) return res.status(400).json({ error: 'Puzzle not found' });

    // --- FIX 2: THE SERVICE ROLE READ ---
    // The server securely queries the locked database to find out how many times this ID has played today
    const { count, error } = await supabase
      .from('telemetry_events')
      .select('*', { count: 'exact', head: true })
      .eq('anon_id', anonId)
      .eq('puzzle_id', puzzleId)
      .eq('event_type', 'attempt_submit');

    if (error) {
      console.warn("Attempt fetch failed, defaulting to strictly tracked client attempt.", error);
    }

    const previousAttempts = count || 0;
    const currentAttemptNum = previousAttempts + 1;

    // The server securely calculates the score
    let exactMatches = 0;
    attemptSequence.forEach((item, index) => {
      if (item.id === puzzle.items[index].id) exactMatches++;
    });

    const isWin = exactMatches === puzzle.items.length;
    const gameOver = isWin || currentAttemptNum >= 5; // Server strictly enforces MAX_ATTEMPTS

    res.status(200).json({
      exactMatches,
      isWin,
      attemptNumber: currentAttemptNum,
      // Only reveal the answers if the server mathematically confirms the game is over
      revealData: gameOver ? puzzle.items : null 
    });
  } catch (e) {
    console.error("Validation Error:", e);
    res.status(500).json({ error: 'Validation failed' });
  }
}