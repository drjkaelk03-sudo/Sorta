import React, { useEffect, useRef } from 'react';
import { Reorder, motion, animate } from 'framer-motion';

export default function GameTile({ item, index, phase, gameState, handleKeyDown, dailyPuzzle, maxRevealedValue, onDragStart, onDragEnd }) {
  const isIdle = phase === 'idle' && gameState === 'playing';
  const isPathA = phase === 'path_a_win' || gameState === 'lost';
  const countRef = useRef(null);

  useEffect(() => {
    if (isPathA && item.numericValue !== undefined) {
      const controls = animate(0, item.numericValue, {
        duration: 1.2,
        delay: index * 0.08, 
        ease: "easeOut",
        onUpdate: (val) => {
          if (countRef.current) {
            const formatted = val % 1 === 0 ? val.toFixed(0) : val.toFixed(2);
            countRef.current.textContent = `${formatted} ${dailyPuzzle.unit}`;
          }
        },
        onComplete: () => {
          if (countRef.current && item.displayValue) {
            countRef.current.textContent = item.displayValue;
          }
        }
      });
      return () => controls?.stop?.();
    }
  }, [isPathA, item, index, dailyPuzzle.unit]);

  // FIX #5: The NaN Progress Bar Explosion
  // Safely falls back to 0 if numericValue is stripped, and ensures maxRevealedValue is never 0
  const safeNumericValue = item.numericValue || 0;
  const safeMax = maxRevealedValue || 1;
  const fillWidth = Math.min(100, Math.max(15, (safeNumericValue / safeMax) * 100)) || 15;

  return (
    <Reorder.Item
      value={item}
      dragListener={isIdle}
      variants={{ active: { zIndex: 999 }, idle: { zIndex: 1 } }}
      whileDrag="active"
      whileTap={isIdle ? "active" : "idle"}
      initial="idle"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onKeyDown={(e) => handleKeyDown(e, index)}
      tabIndex={isIdle ? 0 : -1}
      className="keyboard-focus"
      style={{
        width: '100%',
        marginBottom: '0.6rem',
        touchAction: 'none',
        position: 'relative',
        perspective: "1200px",
        outline: 'none',
        userSelect: 'none'
      }}
    >
      <motion.div
        variants={{ active: { scale: 1.03 }, idle: { scale: 1 } }}
        style={{
          width: "100%",
          transformStyle: "preserve-3d",
          WebkitTransformStyle: "preserve-3d",
          position: "relative",
          cursor: isIdle ? "grab" : "default",
        }}
        animate={{
          rotateX: isPathA ? 180 : 0,
          scale: phase === 'path_a_win' ? [1, 1.05, 1] : 1,
        }}
        transition={{
          rotateX: { duration: 0.8, delay: isPathA ? index * 0.08 : 0, type: "spring", bounce: 0.3 },
          scale: { duration: 0.6, delay: 2.0, ease: [0.34, 1.56, 0.64, 1] }
        }}
      >
        <div
          className={`front-face ${phase === 'suspense' ? 'pulse-buffer' : ''} ${phase === 'path_a_win' ? 'ignition-glow' : ''}`}
          style={{
            backgroundColor: '#1e293b',
            border: "1px solid #334155",
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            borderRadius: "8px",
            padding: "1.25rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            color: "#f8fafc",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "translateZ(0)",
            transition: "all 0.3s ease",
            animationDelay: phase === 'path_a_win' ? `${index * 0.08}s` : '0s'
          }}
        >
          <span style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.02em', textAlign: 'center' }}>
            {item.title}
          </span>
        </div>

        <div
          style={{
            backgroundColor: '#0f172a',
            border: `1px solid ${gameState === 'lost' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
            boxShadow: `0 0 20px ${gameState === 'lost' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'}`,
            borderRadius: "8px",
            padding: "1.25rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateX(180deg) translateZ(0)",
            overflow: 'hidden'
          }}
        >
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: isPathA ? `${fillWidth}%` : '0%' }}
            transition={{ duration: 1.2, delay: (index * 0.08) + 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              top: 0, left: 0, bottom: 0,
              backgroundColor: gameState === 'lost' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              borderRight: `2px solid ${gameState === 'lost' ? 'rgba(245, 158, 11, 0.8)' : 'rgba(16, 185, 129, 0.8)'}`,
              zIndex: 0
            }}
          />
          <span style={{ fontSize: '1rem', fontWeight: 700, color: "#f8fafc", zIndex: 1 }}>
            {item.title}
          </span>
          <span ref={countRef} style={{ fontSize: '1.1rem', fontWeight: 700, color: gameState === 'lost' ? '#f59e0b' : '#10b981', fontVariantNumeric: "tabular-nums", zIndex: 1 }}>
            0
          </span>
        </div>
      </motion.div>
    </Reorder.Item>
  );
}