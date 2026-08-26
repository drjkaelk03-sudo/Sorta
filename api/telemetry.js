import { createClient } from '@supabase/supabase-js';

// SECURE ARCHITECTURE: 
// We use the Service Role Key so we can completely lock down the Supabase database.
// Do NOT use VITE_ prefix for the service key, or it will leak to the frontend.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Basic in-memory rate limiter to block DDoS/Spam scripts
const rateLimitCache = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- FIX 1: IP-BASED RATE LIMITING ---
  // Max 10 requests per IP every 5 minutes.
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  
  if (rateLimitCache.has(ip)) {
    const { count, lastRequest } = rateLimitCache.get(ip);
    if (now - lastRequest < 300000) { // 5 minutes
      if (count >= 10) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }
      rateLimitCache.set(ip, { count: count + 1, lastRequest: now });
    } else {
      rateLimitCache.set(ip, { count: 1, lastRequest: now });
    }
  } else {
    rateLimitCache.set(ip, { count: 1, lastRequest: now });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // --- FIX 2: TELEMETRY POISONING (YOUR SANITY CHECKS) ---
    if (payload.event === 'attempt_submit') {
        if (payload.scoreK > 6 || payload.scoreK < 0) return res.status(400).json({ error: 'Invalid score' });
        if (payload.attemptNum > 5 || payload.attemptNum < 1) return res.status(400).json({ error: 'Invalid attempt limit' });
        if (typeof payload.puzzleId !== 'number') return res.status(400).json({ error: 'Invalid format' });
        if (payload.timeOnAttemptMs && payload.timeOnAttemptMs > 86400000) return res.status(400).json({ error: 'Invalid time duration' });
    }

    // --- FIX 3: SECURE INSERT ---
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

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Telemetry Error:', error);
    return res.status(500).json({ error: 'Failed to log telemetry' });
  }
}