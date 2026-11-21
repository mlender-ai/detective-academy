import { forwardRef, useEffect, useImperativeHandle, useRef, type PointerEvent } from "react";
import { prefersReducedMotion } from "../app/motion";
import { DepthScene } from "../scene/depthScene";
import type { HomeScene, SceneState, SpotId } from "../scene/homeScene";
import { SideScene } from "../scene/sideScene";
import { Stage, runLoop } from "../scene/stage";

export interface LiveSceneHandle {
  /** 그곳으로 걸어간다. 도착하면 onArrive 가 불린다. 모션 줄이기 설정이면 곧바로 도착한다. */
  go(id: SpotId): void;
  /** 걷는 중이면 곧바로 도착시킨다 */
  skip(): void;
  busy(): boolean;
}

interface Props {
  /** depth: 깊이 방향으로 본 복도(A안) · side: 옆에서 본 복도(B안) */
  kind: "depth" | "side";
  state: SceneState;
  onArrive?: (id: SpotId) => void;
  /** 장면 안의 물건을 눌렀을 때. 주지 않으면 장면은 누를 수 없다(장식). */
  onPick?: (id: SpotId) => void;
  className?: string;
}

/**
 * 살아 있는 복도 장면. 캔버스 하나에 층으로 나눈 복도와 탐정을 그린다.
 * 화면을 떠나면 그리기를 멈추고, 내려갈 때 루프를 정리한다.
 */
export const LiveScene = forwardRef<LiveSceneHandle, Props>(function LiveScene({ kind, state, onArrive, onPick, className }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HomeScene | null>(null);
  const stageRef = useRef<Stage | null>(null);
  const arriveRef = useRef(onArrive);
  arriveRef.current = onArrive;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const host = hostRef.current!;
    const canvas = canvasRef.current!;
    const scene: HomeScene = kind === "depth" ? new DepthScene() : new SideScene();
    scene.state = stateRef.current;
    scene.onArrive = (id) => arriveRef.current?.(id);
    const stage = new Stage(canvas, scene.w, scene.h);
    sceneRef.current = scene;
    stageRef.current = stage;

    // 보이는 영역을 알려 준다: 탐정이 화면 안에 서고, 카메라가 장면 밖을 비추지 않게
    const measure = () => {
      const box = host.getBoundingClientRect();
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) return;
      const k = scene.w / rect.width;
      scene.setView({
        x0: Math.max(0, (box.left - rect.left) * k),
        y0: Math.max(0, (box.top - rect.top) * k),
        x1: Math.min(scene.w, (box.right - rect.left) * k),
        y1: Math.min(scene.h, (box.bottom - rect.top) * k),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);

    if (prefersReducedMotion()) {
      // 움직임 없이 한 장면만 그린다. 상태가 바뀌면 다시 그린다(아래 effect).
      scene.update(0);
      stage.draw(scene.frame());
      return () => observer.disconnect();
    }
    const stop = runLoop((dt) => {
      scene.state = stateRef.current;
      scene.update(dt);
      stage.draw(scene.frame());
    });
    return () => {
      stop();
      observer.disconnect();
      sceneRef.current = null;
      stageRef.current = null;
    };
  }, [kind]);

  // 모션 줄이기: 루프가 없으므로 상태가 바뀔 때 한 번 다시 그린다
  useEffect(() => {
    const scene = sceneRef.current;
    const stage = stageRef.current;
    if (!scene || !stage || !prefersReducedMotion()) return;
    scene.state = state;
    scene.update(0);
    stage.draw(scene.frame());
  }, [state]);

  const redrawIfStill = () => {
    const scene = sceneRef.current;
    const stage = stageRef.current;
    if (scene && stage && prefersReducedMotion()) {
      scene.update(0);
      stage.draw(scene.frame());
    }
  };

  useImperativeHandle(ref, () => ({
    go(id) {
      const scene = sceneRef.current;
      if (!scene) return;
      scene.go(id);
      if (prefersReducedMotion()) {
        scene.skip();
        redrawIfStill();
      }
    },
    skip() {
      sceneRef.current?.skip();
      redrawIfStill();
    },
    busy() {
      return sceneRef.current?.busy ?? false;
    },
  }));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const scene = sceneRef.current;
    const canvas = canvasRef.current;
    if (!scene || !canvas || !onPick) return;
    if (scene.busy) {
      scene.skip();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const id = scene.hit(((event.clientX - rect.left) / rect.width) * scene.w, ((event.clientY - rect.top) / rect.height) * scene.h);
    if (id) onPick(id);
  };

  return (
    <div
      ref={hostRef}
      className={["livescene", className].filter(Boolean).join(" ")}
      data-kind={kind}
      data-interactive={!!onPick}
      data-testid="live-scene"
      onPointerDown={onPick ? onPointerDown : undefined}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />
    </div>
  );
});
