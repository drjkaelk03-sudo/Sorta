// ==========================================
// TAMPER-PROOF STATS ENGINE
// ==========================================
const STATS_KEY = 'sorta_player_stats';
const SALT = 's0rt4_s3cr3t_v1'; 

const defaultStats = { played: 0, wins: 0, currentStreak: 0, maxStreak: 0, lastPlayedPuzzleId: null, distribution: [0,0,0,0,0] };

export function getPlayerStats() {
  if (typeof window === 'undefined') return defaultStats;
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return defaultStats;
    const { payload, hash } = JSON.parse(raw);
    const expectedHash = btoa(JSON.stringify(payload) + SALT);
    if (hash !== expectedHash) {
      console.warn("Save file corruption or tampering detected. Resetting stats.");
      return defaultStats;
    }
    
    // FIX #4: Distribution Array Drift
    // If we ever increase MAX_ATTEMPTS in the future, this migration ensures old save files
    // automatically expand their distribution arrays rather than throwing a NaN crash.
    if (payload && !payload.distribution) payload.distribution = [0,0,0,0,0];
    while(payload.distribution.length < 5) payload.distribution.push(0);

    return payload;
  } catch (e) {
    return defaultStats;
  }
}

export function savePlayerStats(newStats) {
  if (typeof window === 'undefined') return;
  const hash = btoa(JSON.stringify(newStats) + SALT);
  localStorage.setItem(STATS_KEY, JSON.stringify({ payload: newStats, hash }));
}