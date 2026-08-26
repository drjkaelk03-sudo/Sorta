import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { puzzleId, attemptSequence, clientAttemptNum } = req.body;
    
    const file = join(process.cwd(), 'api', 'puzzles.json');
    const puzzles = JSON.parse(readFileSync(file, 'utf8'));
    // Loose equality handles string/int mismatches
    const puzzle = puzzles.find(p => p.id == puzzleId);

    if (!puzzle) return res.status(400).json({ error: 'Puzzle not found' });

    // 1. Mathematically grade the sequence
    let exactMatches = 0;
    if (Array.isArray(attemptSequence)) {
      attemptSequence.forEach((item, index) => {
        if (item?.id === puzzle.items[index].id) exactMatches++;
      });
    }

    const isWin = exactMatches === puzzle.items.length;
    
    // 2. Trust the client's attempt number (fallback to 5 to prevent infinite loops)
    const attemptNum = clientAttemptNum || 5; 
    const gameOver = isWin || attemptNum >= 5; 

    res.status(200).json({
      exactMatches,
      isWin,
      // 3. Only send the answers back if the game is mathematically over
      revealData: gameOver ? puzzle.items : null 
    });
  } catch (e) {
    console.error("Validation Error:", e);
    res.status(500).json({ error: 'Validation failed' });
  }
}
// Inside api/validate.js
const ENABLE_TELEMETRY = process.env.ENABLE_TELEMETRY === 'true';

// The game mathematically grades the puzzle here... (This always runs)
const isWin = checkExactMatches(guess, answer) === 6;

// The Kill Switch limits the database ping
if (ENABLE_TELEMETRY) {
  try {
    await supabase.from('telemetry_events').insert([{
      anon_id: userId,
      puzzle_id: puzzleId,
      attempt_num: attemptNum,
      score_k: isWin ? 6 : 0,
      event_type: 'attempt_submit'
    }]);
  } catch (error) {
    console.error("Telemetry failed, but game continues.");
  }
}