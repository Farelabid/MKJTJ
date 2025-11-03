import { useEffect, useState, useRef } from 'react';

interface UseCounterAnimationOptions {
  duration?: number;
  easing?: (t: number) => number;
}

const easeOutExpo = (t: number): number => {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
};

export function useCounterAnimation(
  targetValue: number,
  options: UseCounterAnimationOptions = {}
): number {
  const { duration = 800, easing = easeOutExpo } = options;
  const [displayValue, setDisplayValue] = useState(targetValue);
  const rafRef = useRef<number>();
  const previousTargetRef = useRef(targetValue);

  useEffect(() => {
    // Only animate if target actually changed
    if (previousTargetRef.current === targetValue) {
      return;
    }

    const startValue = displayValue;
    const startTime = performance.now();
    previousTargetRef.current = targetValue;

    // Cancel any existing animation
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);

      const currentValue = 
        startValue + 
        (targetValue - startValue) * easedProgress;

      setDisplayValue(Math.round(currentValue));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [targetValue, duration, easing]);

  return displayValue;
}
