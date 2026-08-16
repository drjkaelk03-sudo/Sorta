import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Only accept GET requests (reading data)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const puzzleId = req.query.puzzleId;
    if (!puzzleId) return res.status(400).json({ error: 'Missing puzzle ID' });

    // Fetch the stats from the real-time view we created in Supabase
    const { data, error } = await supabase
      .from('community_stats')
      .select('*')
      .eq('puzzle_id', puzzleId)
      .single();

    // If nobody has played this puzzle yet, return default starting stats
    if (error || !data) {
      return res.status(200).json({ totalPlayers: 1, parAttempts: "N/A" });
    }

    return res.status(200).json({
      totalPlayers: data.total_players,
      parAttempts: data.par_attempts
    });

  } catch (error) {
    console.error('Stats Fetch Error:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
}