import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase to securely check past attempts
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    // We no longer accept 'isFinalAttempt' from the client. The server decides!
    const { puzzleId, attemptSequence, anonId } = req.body;
    
    const file = join(process.cwd(), 'api', 'puzzles.json');
    const puzzles = JSON.parse(readFileSync(file, 'utf8'));
    const puzzle = puzzles.find(p => p.id === puzzleId);

    if (!puzzle) return res.status(400).json({ error: 'Puzzle not found' });

    // 1. Ask the Database how many times this user has played this puzzle today
    const { count, error } = await supabase
      .from('telemetry_events')
      .select('*', { count: 'exact', head: true })
      .eq('anon_id', anonId)
      .eq('puzzle_id', puzzleId)
      .eq('event_type', 'attempt_submit');

    const previousAttempts = count || 0;
    const currentAttemptNum = previousAttempts + 1;

    // 2. The server securely calculates the score
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