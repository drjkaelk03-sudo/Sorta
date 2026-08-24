import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  try {
    const file = join(process.cwd(), 'api', 'puzzles.json');
    const puzzles = JSON.parse(readFileSync(file, 'utf8'));

    // --- FIX: TAMPER-PROOF GLOBAL ROLLOVER ---
    // We stripped the req.query.tz vulnerability. 
    // The server dictates the time (America/New_York). 
    // 'en-CA' cleanly outputs the YYYY-MM-DD format we need.
    const dateString = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    let puzzle = puzzles.find(p => p.date === dateString) || puzzles[puzzles.length - 1];

    // --- HUMAN ERROR SANITY CHECK ---
    let isCorrupted = false;
    const idSet = new Set();
    if (puzzle.items.length !== 6) isCorrupted = true;
    puzzle.items.forEach(item => {
      if (idSet.has(item.id)) isCorrupted = true;
      idSet.add(item.id);
    });
    
    if (isCorrupted) {
      console.error(`CRITICAL: Puzzle data corrupted for date: ${dateString}`);
      puzzle = puzzles[0]; 
    }

    // --- ANTI-CHEAT PAYLOAD STRIPPING ---
    const secureItems = puzzle.items.map(item => ({
      id: item.id,
      title: item.title
      // Intentionally omitting 'numericValue' and 'displayValue'
    }));

    res.status(200).json({ ...puzzle, items: secureItems });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load puzzle' });
  }
}