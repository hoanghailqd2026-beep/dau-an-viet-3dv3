import React, { useCallback } from 'react';

/**
 * Provides lightweight, zero-re-render 60fps physical 3D tilt (±4deg max)
 * and warm bronze-gold cursor specular glow (rgba(200, 169, 110, 0.12))
 * for Heritage Cards and Ticket Cards.
 */
export function useMuseumTilt3D(maxDeg = 4) {
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const card = e.currentTarget;
      const rect = card.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const normX = (x / rect.width) * 2 - 1; // -1 to 1
      const normY = (y / rect.height) * 2 - 1; // -1 to 1

      const rotateY = +(normX * maxDeg).toFixed(2);
      const rotateX = +(-normY * maxDeg).toFixed(2);

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

      const glowEl = card.querySelector<HTMLElement>('[data-tilt-glow="true"]');
      if (glowEl) {
        glowEl.style.opacity = '1';
        glowEl.style.background = `radial-gradient(420px circle at ${Math.round(x)}px ${Math.round(
          y
        )}px, rgba(200, 169, 110, 0.12), transparent 70%)`;
      }
    },
    [maxDeg]
  );

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const card = e.currentTarget;
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    const glowEl = card.querySelector<HTMLElement>('[data-tilt-glow="true"]');
    if (glowEl) {
      glowEl.style.opacity = '0';
    }
  }, []);

  return {
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
  };
}
