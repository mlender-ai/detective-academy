import { useEffect, useMemo, useRef } from "react";
import { prefersReducedMotion } from "../app/motion";
import { COIN, HOURGLASS, drawCoin, drawHourglass, hourglassStage } from "./ascii";
import { DotCanvas, DotGrid } from "./dots";

interface Props {
  /** 격자의 크기(점). 화면에는 2배(px)로 놓인다. */
  w: number;
  h: number;
  /** 한 장면을 그린다. t 는 화면에 올라온 뒤 흐른 시간(초) */
  draw: (g: DotGrid, t: number) => void;
  /** 초당 몇 번 다시 그릴 것인가 (끊어서 움직인다) */
  rate?: number;
  /** 모션 줄이기 설정에서 보여 줄 한 장면의 시각 */
  stillAt?: number;
  /** 이 시각(초)이 되면 그 장면을 그리고 멈춘다(한 번 하고 끝나는 연출). 주지 않으면 화면에 있는 동안 계속 돈다. */
  endAt?: number;
  /** 이 값이 바뀌면 멈춘 장면도 다시 그린다 (모션 줄이기에서 상태를 따라가야 할 때) */
  stamp?: number | string;
  className?: string;
}

/**
 * 점 격자에 그린 작은 움직이는 그림 한 장.
 * 화면에 보이는 동안에만 돌고(화면 밖·탭이 가려진 동안은 멈춘다), 모션 줄이기 설정에서는 한 장면만 그린다.
 */
export function FxCanvas({ w, h, draw, rate = 12, stillAt = 0.6, endAt, stamp, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const paintRef = useRef<((t: number) => void) | null>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const grid = new DotGrid(w, h);
    const dc = new DotCanvas(canvas, grid);
    const paint = (t: number) => {
      drawRef.current(grid, t);
      dc.draw(0, 0, true);
    };
    paintRef.current = paint;
    if (prefersReducedMotion()) {
      paint(stillAt);
      return;
    }
    let raf = 0;
    let visible = true;
    let done = false;
    let last = -1;
    const t0 = performance.now();
    const tick = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const step = Math.floor(((now - t0) / 1000) * rate);
      if (endAt !== undefined && step / rate >= endAt) {
        // 끝났다: 마지막 장면을 그리고 더 돌지 않는다
        done = true;
        paint(endAt);
        return;
      }
      if (step !== last) {
        last = step;
        paint(step / rate);
      }
      raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf && !done && visible && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      kick();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", kick);
    paint(0);
    kick();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", kick);
      paintRef.current = null;
    };
  }, [w, h, rate, stillAt, endAt]);

  // 모션 줄이기: 루프가 없으므로 상태가 바뀔 때 한 번 다시 그린다
  useEffect(() => {
    if (prefersReducedMotion()) paintRef.current?.(stillAt);
  }, [stamp, stillAt]);

  return <canvas ref={ref} className={["fxcanvas", className].filter(Boolean).join(" ")} style={{ width: w * 2, height: h * 2 }} aria-hidden="true" />;
}

/**
 * 수사 크레딧 한 닢(위 막대의 팔각 주화를 크게 찍은 것). delayMs 뒤에 한 바퀴(두 번 뒤집힌다) 돌고 정면에서 멈춘다.
 * 모션 줄이기 설정에서는 처음부터 정면이다.
 */
export function FxCoin({ delayMs = 0, className }: { delayMs?: number; className?: string }) {
  const start = delayMs / 1000;
  const draw = useMemo(() => (g: DotGrid, t: number) => drawCoin(g, Math.max(0, Math.min(COIN.turn, Math.floor((t - start) * COIN.rate + 1e-6)))), [start]);
  return <FxCanvas w={COIN.size} h={COIN.size} draw={draw} rate={COIN.rate} stillAt={0} endAt={start + COIN.turn / COIN.rate} className={["fxcoin", className].filter(Boolean).join(" ")} />;
}

/** 제한 시간의 모래시계(11×14점). spent 는 흘러간 비율(0 가득 ~ 1 다 떨어짐). running 이 거짓이면 모래 줄기가 멈춘다. */
export function FxHourglass({ spent, running = true, className }: { spent: number; running?: boolean; className?: string }) {
  const state = useRef({ spent, running });
  state.current = { spent, running };
  const draw = useMemo(() => (g: DotGrid, t: number) => drawHourglass(g, state.current.spent, state.current.running ? Math.max(t, 0.001) : 0), []);
  return <FxCanvas w={HOURGLASS.w} h={HOURGLASS.h} draw={draw} rate={8} stamp={hourglassStage(spent)} className={["fxglass", className].filter(Boolean).join(" ")} />;
}
