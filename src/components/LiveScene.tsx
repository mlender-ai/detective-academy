import { useEffect, useImperativeHandle, useRef, type PointerEvent, type Ref } from "react";
import { prefersReducedMotion } from "../app/motion";
import type { Scene } from "../scene/homeScene";
import { Stage, runLoop } from "../scene/stage";

export interface LiveSceneHandle<Id extends string = string> {
  /** 그곳으로 걸어간다. 도착하면 onArrive 가 불린다. 모션 줄이기 설정이면 곧바로 도착한다. */
  go(id: Id): void;
  /** 걷는 중이면 곧바로 도착시킨다 */
  skip(): void;
  busy(): boolean;
}

interface Props<Id extends string, S> {
  /** 장면의 종류. 스타일이 캔버스를 놓는 자리를 이것으로 가른다: side(옆에서 본 복도) · vault(자료실) */
  kind: string;
  /** 장면을 만든다. 화면에 올라올 때 한 번 불린다. */
  make: () => Scene<Id, S>;
  state: S;
  onArrive?: (id: Id) => void;
  /** 장면 안의 물건을 눌렀을 때. 주지 않으면 장면은 누를 수 없다(장식). */
  onPick?: (id: Id) => void;
  className?: string;
  ref?: Ref<LiveSceneHandle<Id>>;
}

/**
 * 모션 줄이기에서 그리는 한 장면: 움직임이 다 끝난 뒤의 모습이다.
 * 장면은 update 가 흘려 준 시간만큼만 카메라·문·금고를 목표 쪽으로 옮긴다. 시간을 흘리지 않으면(0) 탐정만 옮겨지고
 * 카메라가 따라오지 않아, 복도 끝으로 간 탐정이 화면 밖에 선다.
 * 그래서 한 박자를 앞으로 굴려 끝 상태에 이르게 한 뒤 같은 만큼 되감는다. 목표로 다가가는 값은 끝 상태에 남고,
 * 장면의 시계는 제자리로 돌아온다: 환경의 박자(깜빡이는 등, 팔랑이는 종이, 표시 괄호)는 언제 그려도 같은 모습이다.
 * 한 박자는 가장 느린 것(금고 문이 열리는 0.39초)보다 길고, 도착한 자세가 풀리는 시간(2.4초)보다 짧아야 한다.
 */
const SETTLE_SEC = 1;

function drawStill<Id extends string, S>(scene: Scene<Id, S>, stage: Stage) {
  scene.update(SETTLE_SEC);
  scene.update(-SETTLE_SEC);
  stage.draw(scene.frame());
}

/**
 * 살아 있는 장면. 캔버스 하나에 층으로 나눈 배경과 탐정을 그린다.
 * 화면을 떠나면 그리기를 멈추고, 내려갈 때 루프를 정리한다.
 */
export function LiveScene<Id extends string, S>({ kind, make, state, onArrive, onPick, className, ref }: Props<Id, S>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene<Id, S> | null>(null);
  const stageRef = useRef<Stage | null>(null);
  const arriveRef = useRef(onArrive);
  arriveRef.current = onArrive;
  const stateRef = useRef(state);
  stateRef.current = state;
  const makeRef = useRef(make);
  makeRef.current = make;

  useEffect(() => {
    const host = hostRef.current!;
    const canvas = canvasRef.current!;
    const scene = makeRef.current();
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
    const still = prefersReducedMotion();
    const observer = new ResizeObserver(() => {
      measure();
      // 루프가 없으면 화면 폭이 바뀌어도 카메라가 그대로다: 새 폭에 맞춰 한 번 다시 그린다
      if (still) drawStill(scene, stage);
    });
    observer.observe(host);

    if (still) {
      // 움직임 없이 한 장면만 그린다. 상태가 바뀌면 다시 그린다(아래 effect).
      drawStill(scene, stage);
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
    drawStill(scene, stage);
  }, [state]);

  const redrawIfStill = () => {
    const scene = sceneRef.current;
    const stage = stageRef.current;
    if (scene && stage && prefersReducedMotion()) drawStill(scene, stage);
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
    // 걷는 중에 누르면 먼저 그 걸음을 끝낸다. 누른 자리에 물건이 있으면 곧바로 그쪽으로 다시 간다.
    if (scene.busy) scene.skip();
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
}
