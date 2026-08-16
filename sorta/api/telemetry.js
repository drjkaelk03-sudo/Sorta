import { createClient } from '@supabase/supabase-js';

// We pull your secret keys safely from the environment
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // 1. Only accept POST requests from our game
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. Parse the telemetry payload
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // 3. Insert the data directly into your Supabase table
    const { error } = await supabase
      .from('telemetry_events')
      .insert([
        {
          anon_id: payload.anonId,
          event_type: payload.event,
          puzzle_id: payload.puzzleId,
          attempt_num: payload.attemptNum || null,
          score_k: payload.scoreK || null,
          time_elapsed_ms: payload.timeOnAttemptMs || payload.totalTimeElapsedMs || null,
          device_type: payload.deviceType
        }
      ]);

    if (error) throw error;

    // 4. Return a successful 200 response to the browser
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Telemetry Error:', error);
    return res.status(500).json({ error: 'Failed to log telemetry' });
  }
}