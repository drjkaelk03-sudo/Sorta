import { useRef, useCallback, useEffect } from 'react';

// ==========================================
// TELEMETRY ENGINE
// ==========================================
const ANON_ID_KEY = 'sorta_anon_id';
const TELEMETRY_ENDPOINT = '/api/telemetry';

let fallbackSessionId = null;

export function getOrCreateAnonId() {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = `usr_${crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14)}`;
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch (error) {
    if (!fallbackSessionId) {
      fallbackSessionId = `tmp_${Math.random().toString(36).slice(2, 14)}`;
    }
    return fallbackSessionId;
  }
}

export function sendTelemetry(eventData) {
  if (typeof window === 'undefined') return false;
  const payload = {
    ...eventData,
    anonId: getOrCreateAnonId(),
    timestamp: Date.now(),
    deviceType: window.innerWidth <= 768 ? 'mobile' : 'desktop',
  };

  try {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon) {
      return navigator.sendBeacon(TELEMETRY_ENDPOINT, blob);
    }
    fetch(TELEMETRY_ENDPOINT, { method: 'POST', body: blob, keepalive: true }).catch(() => {});
    return true;
  } catch (e) {
    return false;
  }
}

export function useTelemetry(puzzleId, isPuzzleComplete) {
  const sessionStartTime = useRef(Date.now());
  const attemptStartTime = useRef(Date.now());
  const lastAttemptState = useRef({ num: 0, scoreK: 0 });
  
  // FIX #3: Telemetry Spam / DDoS Preventer
  const hasAbandoned = useRef(false);

  const logAttempt = useCallback((attemptNum, scoreK, swapsCount) => {
    const now = Date.now();
    const timeOnAttemptMs = now - attemptStartTime.current;
    lastAttemptState.current = { num: attemptNum, scoreK };

    sendTelemetry({ event: 'attempt_submit', puzzleId, attemptNum, scoreK, swapsCount, timeOnAttemptMs });
    attemptStartTime.current = now;
  }, [puzzleId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      // Only fire the abandoned event once per puzzle session to prevent spamming the database
      if (document.visibilityState === 'hidden' && !isPuzzleComplete && lastAttemptState.current.num > 0 && !hasAbandoned.current) {
        hasAbandoned.current = true;
        sendTelemetry({
          event: 'puzzle_abandoned',
          puzzleId,
          lastAttemptNum: lastAttemptState.current.num,
          lastScoreK: lastAttemptState.current.scoreK,
          totalTimeElapsedMs: Date.now() - sessionStartTime.current,
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [puzzleId, isPuzzleComplete]);

  return { logAttempt };
}