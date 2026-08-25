import { createClient } from '@supabase/supabase-js';

// SECURE ARCHITECTURE: 
// Use the Service Role Key to bypass the RLS lockdown and read the stats safely.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const puzzleId = req.query.puzzleId;
    if (!puzzleId) return res.status(400).json({ error: 'Missing puzzle ID' });

    // --- FIX: VERCEL EDGE CACHING ---
    // Cache the stats on Vercel's global network for 60 seconds (s-maxage=60).
    // Allow serving stale data for up to 30 seconds while fetching fresh data (stale-while-revalidate).
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');

    // Fetch the stats from the real-time view in Supabase
    const { data, error } = await supabase
      .from('community_stats')
      .select('*')
      .eq('puzzle_id', puzzleId)
      .single();

    // If nobody has played this puzzle yet, or if there's a database blip
    if (error || !data) {
      return res.status(200).json({ totalPlayers: 1, parAttempts: "N/A" });
    }

    // Return the REAL stats to the React frontend
    return res.status(200).json({
      totalPlayers: data.total_players,
      parAttempts: parseFloat(data.par_attempts).toFixed(1) // Format to 1 decimal place safely
    });

  } catch (error) {
    console.error('Stats Fetch Error:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
}