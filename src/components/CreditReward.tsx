import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../app/motion";
import { CoinsArt } from "../art/objects";

/** 책상 위에 놓인 크레딧 꼬리표 (V2). 값이 바뀌면 살짝 튄다. */
export function CreditTag({ credits }: { credits: number }) {
  const previous = useRef(credits);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (previous.current === credits) return;
    previous.current = credits;
    setBump(true);
    const id = window.setTimeout(() => setBump(false), 540);
    return () => window.clearTimeout(id);
  }, [credits]);

  return (
    <span className="credittag leaf num" data-bump={bump} data-testid="credit-balance" aria-label={`보유 수사 크레딧 ${credits}`}>
      <CoinsArt count={1} />
      <span aria-hidden="true">{credits.toLocaleString("ko-KR")}</span>
    </span>
  );
}

/** from → to 로 올라가는 숫자 */
export function useCountUp(to: number, from: number, durationMs = 700, delayMs = 0): number {
  const [value, setValue] = useState(prefersReducedMotion() ? to : from);

  useEffect(() => {
    if (prefersReducedMotion() || from === to) {
      setValue(to);
      return;
    }
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t + delayMs;
      const p = Math.min(1, Math.max(0, (t - start) / durationMs));
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, from, durationMs, delayMs]);

  return value;
}
