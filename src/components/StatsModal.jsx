import React from 'react';
import { motion } from 'framer-motion';
import { X, Share } from 'lucide-react';

const SHOW_STATS = import.meta.env.VITE_ENABLE_STATS === 'true';

export default function StatsModal({ stats, communityStats, onClose, show, onShare, shareCopied }) {
  if (!show) return null;
  
  const winPct = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
  const maxDist = Math.max(...stats.distribution, 1); 

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2, 6, 23, 0.9)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '400px', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.5rem' }}><X size={24} /></button>
        
        <h2 style={{ margin: '0 0 1.5rem 0', color: '#f8fafc', textAlign: 'center', fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.05em' }}>STATISTICS</h2>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc' }}>{stats.played}</div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Played</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc' }}>{winPct}%</div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Win %</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc' }}>{stats.currentStreak}</div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Streak</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc' }}>{stats.maxStreak}</div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max</div>
          </div>
        </div>

        <h3 style={{ margin: '0 0 1rem 0', color: '#f8fafc', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Guess Distribution</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {stats.distribution.map((count, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ color: '#94a3b8', width: '0.75rem', fontWeight: 700, textAlign: 'right' }}>{i + 1}</div>
              <div style={{ flex: 1, backgroundColor: '#0f172a', borderRadius: '4px', overflow: 'hidden', height: '1.5rem' }}>
                <div style={{ width: `${Math.max(7, (count / maxDist) * 100)}%`, backgroundColor: count > 0 ? '#06B6D4' : '#334155', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '0.5rem', color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>
                  {count}
                </div>
              </div>
            </div>
          ))}
        </div>

        {SHOW_STATS && communityStats && (
          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #334155', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Global Community</h3>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>{communityStats.totalPlayers?.toLocaleString() || 1}</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Players Today</div>
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>{communityStats.parAttempts || 'N/A'}</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Average Tries</div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onShare}
          style={{
            marginTop: '1.5rem',
            width: '100%',
            padding: '1rem',
            backgroundColor: shareCopied ? '#10B981' : '#06B6D4',
            color: '#020617',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 800,
            letterSpacing: '0.05em',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase'
          }}
        >
          {shareCopied ? 'COPIED!' : 'SHARE RESULTS'} <Share size={18} />
        </button>
      </motion.div>
    </div>
  );
}