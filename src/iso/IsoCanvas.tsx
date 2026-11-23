import { useEffect, useImperativeHandle, useRef, type CSSProperties, type PointerEvent, type ReactNode, type Ref } from "react";
import { prefersReducedMotion } from "../app/motion";
import { runLoop } from "../scene/stage";
/** 캔버스가 굴리는 장면의 약속. 학원 홀(HallScene)과 그 밖의 방(RoomScene)이 이 모양이다. */
export interface IsoScene<Id extends string, S, D extends string = never> {
  readonly w: number;
  readonly h: number;
  state: S;
  onArrive: (id: Id) => void;
  onLeave: () => void;
  readonly busy: boolean;
  readonly heading: Id | null;
  go(id: Id): void;
  skip(): void;
  tap(x: number, y: number): { kind: "spot"; id: Id } | { kind: "decor"; id: D } | { kind: "floor" } | null;
  update(dt: number): void;
  render(out: Uint8ClampedArray, force?: boolean): boolean;
}

export interface IsoHandle<Id extends string = string> {
  /** 그곳으로 걸어간다. 가는 중에 같은 곳을 또 부르면 걸음을 건너뛴다. 모션 줄이기면 곧바로 도착한다. */
  go(id: Id): void;
  skip(): void;
  busy(): boolean;
}

interface Props<Id extends string, S, D extends string> {
  scene: IsoScene<Id, S, D>;
  state: S;
  onArrive?: (id: Id) => void;
  /** 바닥을 눌러 물건 앞을 떠났을 때 */
  onLeave?: () => void;
  /** 바닥을 눌렀을 때. 살펴볼 수 있는 것(창, 의자, 우산꽂이)을 눌렀으면 그 이름을 준다. */
  onFloor?: (decor: D | null) => void;
  /** 누를 수 없는 장면(보여 주기만 한다) */
  still?: boolean;
  /** 방의 틀에 덧붙일 클래스(화면마다 높이를 다르게 잡는다) */
  className?: string;
  /** 장면 위에 겹쳐 놓는 것(누르는 자리, 이름표). 장면과 같은 좌표(점 × 2px)를 쓴다. */
  children?: ReactNode;
  /** 방의 틀에 붙여 얹는 것: 위쪽 어둠의 서술 한 줄, 구석의 음악 단추 */
  caption?: ReactNode;
  ref?: Ref<IsoHandle<Id>>;
}

/**
 * 쿼터뷰 장면을 그리는 캔버스. 캔버스의 한 화소가 점 하나이고 화면에는 2배로 놓인다.
 * 화면을 떠나 있는 동안에는 그리지 않고, 모션 줄이기 설정에서는 바뀔 때마다 한 장면만 그린다.
 */
export function IsoCanvas<Id extends string, S, D extends string = never>({ scene, state, onArrive, onLeave, onFloor, still = false, className, children, caption, ref }: Props<Id, S, D>) {
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
    scene.onArrive = (id) => arriveRef.current?.(id);
    scene.onLeave = () => leaveRef.current?.();
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
    if (still || (event.target as HTMLElement).closest("button")) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const hit = scene.tap(((event.clientX - rect.left) / rect.width) * scene.w, ((event.clientY - rect.top) / rect.height) * scene.h);
    if (hit?.kind === "floor") onFloor?.(null);
    else if (hit?.kind === "decor") onFloor?.(hit.id);
    settle();
  };

  return (
    <div className={["isostage", className].filter(Boolean).join(" ")} data-still={still} data-testid="iso-stage">
      <div className="isostage__world" style={{ width: scene.w * 2, height: scene.h * 2, "--iso-w": `${scene.w * 2}px`, "--iso-h": `${scene.h * 2}px` } as CSSProperties} onPointerDown={onPointerDown}>
        <canvas ref={canvasRef} aria-hidden="true" data-testid="iso-canvas" />
        {children}
      </div>
      {caption}
    </div>
  );
}
