import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  try {
    const file = join(process.cwd(), 'api', 'puzzles.json');
    const puzzles = JSON.parse(readFileSync(file, 'utf8'));

    // --- FIX #3: THE TIMEZONE SHIFT ---
    // The server asks the client what timezone they are in, and calculates the 
    // exact YYYY-MM-DD for that specific region to ensure a true Midnight reset.
    const userTz = req.query.tz || 'UTC';
    const dateString = new Date().toLocaleDateString('en-CA', { timeZone: userTz });

    let puzzle = puzzles.find(p => p.date === dateString) || puzzles[puzzles.length - 1];

    // --- FIX #4: HUMAN ERROR SANITY CHECK ---
    // If you made a typo in the JSON database, the server catches it and logs a critical error
    // before it has a chance to crash the player's browser.
    let isCorrupted = false;
    const idSet = new Set();
    if (puzzle.items.length !== 6) isCorrupted = true;
    puzzle.items.forEach(item => {
      if (idSet.has(item.id)) isCorrupted = true;
      idSet.add(item.id);
    });
    
    if (isCorrupted) {
      console.error(`CRITICAL: Puzzle data corrupted for date: ${dateString}`);
      // Fallback to the very first puzzle just so the app doesn't white-screen
      puzzle = puzzles[0]; 
    }

    // THE FIX: We strip the answers from the payload before sending it to the browser
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