/**
 * CountUp — animated numeric counter with eased easing.
 * Re-runs whenever `value` changes.
 */
import { useEffect, useRef, useState } from 'react';

export default function CountUp({
  value,
  duration = 800,
  format = (n) => Math.round(n).toLocaleString('en-IN'),
  suffix = '',
  prefix = '',
}) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = null;
    cancelAnimationFrame(rafRef.current);

    const step = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / duration);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (target - fromRef.current) * eased;
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(target);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return (
    <span>{prefix}{format(display)}{suffix}</span>
  );
}
