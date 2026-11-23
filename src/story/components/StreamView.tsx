import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../../app/motion";
import { Stage, runLoop } from "../../scene/stage";
import { SH, SW, paintStream, streamFrame, type StreamArt, type StreamFrameId } from "../art/broadcastArt";

let cached: StreamArt | null = null;
/** 방송실 그림은 한 번만 그려 두고 쓴다 */
const art = () => (cached ??= paintStream());

interface Props {
  frame: StreamFrameId;
  className?: string;
  /** 멈춘 한 장면으로 둔다 (정지 화면) */
  paused?: boolean;
}

/**
 * 방송 기록의 한 시점. 캔버스 하나에 방송실을 그린다(점 하나 = 2px).
 * 시점을 바꾸면 그 시점의 처음부터 다시 움직인다. 화면을 떠나면 그리기를 멈춘다.
 */
export function StreamView({ frame, className, paused = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(frame);
  const timeRef = useRef(0);

  // 시점이 바뀌면 그 시점의 처음으로
  if (frameRef.current !== frame) {
    frameRef.current = frame;
    timeRef.current = 0;
  }

  useEffect(() => {
    const stage = new Stage(canvasRef.current!, SW, SH);
    const still = paused || prefersReducedMotion();
    const draw = () => stage.draw(streamFrame(art(), frameRef.current, timeRef.current, still));
    if (still) {
      draw();
      return;
    }
    return runLoop((dt) => {
      timeRef.current += dt;
      draw();
    });
  }, [paused]);

  // 모션 줄이기·정지 화면: 루프가 없으므로 시점이 바뀔 때 한 번 다시 그린다
  useEffect(() => {
    if ((!paused && !prefersReducedMotion()) || !canvasRef.current) return;
    new Stage(canvasRef.current, SW, SH).draw(streamFrame(art(), frame, 0, true));
  }, [frame, paused]);

  return (
    <canvas
      ref={canvasRef}
      className={["stream", className].filter(Boolean).join(" ")}
      width={SW}
      height={SH}
      data-frame={frame}
      aria-hidden="true"
    />
  );
}
