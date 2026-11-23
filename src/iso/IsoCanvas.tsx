import { useEffect, useImperativeHandle, useRef, type PointerEvent, type ReactNode, type Ref } from "react";
import { prefersReducedMotion } from "../app/motion";
import { runLoop } from "../scene/stage";
import type { HallDecor, HallSpot } from "./hallArt";
import type { HallScene, HallState } from "./hallScene";

export interface IsoHandle {
  /** 그곳으로 걸어간다. 가는 중에 같은 곳을 또 부르면 걸음을 건너뛴다. 모션 줄이기면 곧바로 도착한다. */
  go(id: HallSpot): void;
  skip(): void;
  busy(): boolean;
}

interface Props {
  scene: HallScene;
  state: HallState;
  onArrive: (id: HallSpot) => void;
  /** 바닥을 눌러 물건 앞을 떠났을 때 */
  onLeave: () => void;
  /** 바닥을 눌렀을 때. 살펴볼 수 있는 것(창, 의자, 우산꽂이)을 눌렀으면 그 이름을 준다. */
  onFloor?: (decor: HallDecor | null) => void;
  /** 장면 위에 겹쳐 놓는 것(누르는 자리, 이름표). 장면과 같은 좌표(점 × 2px)를 쓴다. */
  children?: ReactNode;
  /** 방의 틀에 붙여 얹는 것: 위쪽 어둠의 서술 한 줄, 구석의 음악 단추 */
  caption?: ReactNode;
  ref?: Ref<IsoHandle>;
}

/**
 * 쿼터뷰 장면을 그리는 캔버스. 캔버스의 한 화소가 점 하나이고 화면에는 2배로 놓인다.
 * 화면을 떠나 있는 동안에는 그리지 않고, 모션 줄이기 설정에서는 바뀔 때마다 한 장면만 그린다.
 */
export function IsoCanvas({ scene, state, onArrive, onLeave, onFloor, children, caption, ref }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<() => void>(() => {});
  const stateRef = useRef(state);
  stateRef.current = state;
  const arriveRef = useRef(onArrive);
  arriveRef.current = onArrive;
  const leaveRef = useRef(onLeave);
  leaveRef.current = onLeave;

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = scene.w;
    canvas.height = scene.h;
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(scene.w, scene.h);
    scene.onArrive = (id) => arriveRef.current(id);
    scene.onLeave = () => leaveRef.current();
    // force: 바뀐 것이 없어 보여도 그린다(처음 한 번, 모션 줄이기의 한 장면)
    const draw = (force = false) => {
      scene.state = stateRef.current;
      if (scene.render(image.data, force)) ctx.putImageData(image, 0, 0);
    };
    drawRef.current = () => draw(true);
    if (prefersReducedMotion()) {
      scene.update(0);
      draw(true);
      return;
    }
    draw(true);
    return runLoop((dt) => {
      scene.state = stateRef.current;
      scene.update(dt);
      draw();
    });
  }, [scene]);

  // 모션 줄이기: 루프가 없으므로 상태가 바뀔 때 한 번 다시 그린다
  useEffect(() => {
    if (!prefersReducedMotion()) return;
    scene.state = state;
    scene.update(1);
    drawRef.current();
  }, [scene, state]);

  const settle = () => {
    if (!prefersReducedMotion()) return;
    scene.skip();
    scene.update(1);
    drawRef.current();
  };

  useImperativeHandle(ref, () => ({
    go(id) {
      if (scene.busy && scene.heading === id) scene.skip();
      else scene.go(id);
      settle();
    },
    skip() {
      scene.skip();
      settle();
    },
    busy() {
      return scene.busy;
    },
  }));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // 물건 위의 단추는 따로 받는다
    if ((event.target as HTMLElement).closest("button")) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const hit = scene.tap(((event.clientX - rect.left) / rect.width) * scene.w, ((event.clientY - rect.top) / rect.height) * scene.h);
    if (hit?.kind === "floor") onFloor?.(null);
    else if (hit?.kind === "decor") onFloor?.(hit.id);
    settle();
  };

  return (
    <div className="isostage" data-testid="iso-stage">
      <div className="isostage__world" onPointerDown={onPointerDown}>
        <canvas ref={canvasRef} aria-hidden="true" data-testid="iso-canvas" />
        {children}
      </div>
      {caption}
    </div>
  );
}
