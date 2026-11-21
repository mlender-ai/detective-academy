import { useEffect, useRef, useState } from "react";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** 모션 줄이기 설정이면 0, 아니면 그대로 */
export function motionMs(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}

/**
 * 단계별 연출.
 * durations[i] 가 지나면 i+1 단계로 넘어간다. skip() 은 마지막 단계로 바로 보낸다.
 * 모션 줄이기 설정이면 처음부터 마지막 단계다.
 */
export function useSequence(durations: number[], active = true) {
  const last = durations.length;
  const [step, setStep] = useState(() => (prefersReducedMotion() ? last : 0));
  const timer = useRef<number>(0);

  useEffect(() => {
    if (!active || step >= last) return;
    timer.current = window.setTimeout(() => setStep((s) => Math.min(last, s + 1)), durations[step]);
    return () => window.clearTimeout(timer.current);
    // durations 는 호출부에서 고정 배열로 넘긴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, active, last]);

  const skip = () => {
    window.clearTimeout(timer.current);
    setStep(last);
  };

  return { step, done: step >= last, skip };
}
