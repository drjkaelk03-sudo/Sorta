import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. Destructure the exact attempt number from the client
    const { puzzleId, attemptSequence, anonId, clientAttemptNum } = req.body;
    
    // 2. Type validation
    if (!puzzleId || !anonId || !Array.isArray(attemptSequence) || attemptSequence.length !== 6 || !clientAttemptNum) {
      return res.status(400).json({ error: 'Malformed payload' });
    }
    
    const file = join(process.cwd(), 'api', 'puzzles.json');
    const puzzles = JSON.parse(readFileSync(file, 'utf8'));
    const puzzle = puzzles.find(p => p.id == puzzleId);

    if (!puzzle) return res.status(400).json({ error: 'Puzzle not found' });

    // 3. SECURE GRADING: Server still mathematically verifies the answers
    let exactMatches = 0;
    attemptSequence.forEach((item, index) => {
      if (item.id === puzzle.items[index].id) exactMatches++;
    });

    const isWin = exactMatches === puzzle.items.length;
    
    // 4. DECOUPLED STATE: Use the client's attempt loop to trigger Game Over
    const gameOver = isWin || clientAttemptNum >= 5; 

    res.status(200).json({
      exactMatches,
      isWin,
      attemptNumber: clientAttemptNum,
      // Only reveal the answers if the game is mathematically over
      revealData: gameOver ? puzzle.items : null 
    });
  } catch (e) {
    console.error("Validation Error:", e);
    res.status(500).json({ error: 'Validation failed' });
  }
}