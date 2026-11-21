import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { haptic, playSound } from "../../app/sound";
import { PenMark } from "../../art/pixel";
import { Portrait } from "../../art/portraits";
import type { ScheduleInput, SchedulePuzzle } from "../../engine/types";
import type { GameProps } from "../logic";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Target = { kind: "slot"; index: number } | { kind: "tray" };

interface DragState {
  id: string;
  dx: number;
  dy: number;
  over: Target | null;
}

const DRAG_THRESHOLD = 6;

interface Props extends GameProps<SchedulePuzzle, ScheduleInput> {
  /** 시험지 머리(제목·문제·수사 지원). 책상 화면이 넘겨준다. */
  brief?: ReactNode;
}

/**
 * 발표 순서 맞추기. 시험지에 조건이 적혀 있고,
 * 그 아래 시간표에 학생 이름표를 끌어다 놓는다.
 */
export function SchedulePuzzleGame({ puzzle, input, onChange, locked, verdict, wrongCount, brief }: Props) {
  const { people, slots, constraints } = puzzle.rules;
  const placement = input.placement;

  const boardRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const homeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [layout, setLayout] = useState<{ slots: Box[]; homes: Box[]; tray: Box } | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [history, setHistory] = useState<(string | null)[][]>([]);
  const gesture = useRef<{ id: string; pointerId: number; startX: number; startY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  /* 슬롯·대기석 위치를 재서, 카드 네 장을 한 층 위에 절대 좌표로 올린다.
     위치가 바뀌면 transform 전환만으로 자리에 달라붙는다. */
  const measure = useCallback(() => {
    const board = boardRef.current;
    const tray = trayRef.current;
    if (!board || !tray) return;
    const origin = board.getBoundingClientRect();
    const box = (el: Element | null): Box => {
      if (!el) return { x: 0, y: 0, w: 0, h: 0 };
      const r = el.getBoundingClientRect();
      // 반 화소 자리에 놓이면 테두리가 흐려지므로(두 색만 쓰는 화면에 회색이 생긴다) 화소 단위로 맞춘다.
      return { x: Math.round(r.left - origin.left), y: Math.round(r.top - origin.top), w: Math.round(r.width), h: Math.round(r.height) };
    };
    setLayout({
      slots: slots.map((_, i) => box(slotRefs.current[i])),
      homes: people.map((_, i) => box(homeRefs.current[i])),
      tray: box(tray),
    });
  }, [slots, people]);

  useLayoutEffect(() => {
    measure();
    const board = boardRef.current;
    if (!board || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    if (wrongCount === 0) return;
    setShaking(true);
    const id = window.setTimeout(() => setShaking(false), 460);
    return () => window.clearTimeout(id);
  }, [wrongCount]);

  useEffect(() => {
    if (locked) setSelected(null);
  }, [locked]);

  /** 직전 배치에서 새 배치를 만들어 반영한다. 바뀐 것이 있을 때만 되돌리기 기록에 쌓는다. */
  const apply = (build: (current: (string | null)[]) => (string | null)[]) => {
    onChange((previous) => {
      const next = build(previous.placement);
      if (next.every((id, i) => id === previous.placement[i])) return previous;
      setHistory((h) => [...h.slice(-30), previous.placement]);
      playSound("place");
      haptic(8);
      return { type: "schedule", placement: next };
    });
  };

  /** 카드를 슬롯이나 대기석으로 옮긴다. 슬롯끼리는 자리를 맞바꾼다. */
  const move = (id: string, target: Target) => {
    apply((current) => {
      const next = [...current];
      const from = next.indexOf(id);
      if (target.kind === "tray") {
        if (from >= 0) next[from] = null;
        return next;
      }
      if (from === target.index) return next;
      const occupant = next[target.index];
      if (from >= 0) next[from] = occupant; // 슬롯 → 슬롯: 맞바꾸기 (대상이 비었으면 비워진다)
      next[target.index] = id; // 대기석 → 찬 슬롯: 원래 있던 사람은 대기석으로 돌아간다
      return next;
    });
  };

  const undo = () => {
    if (locked || history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    onChange({ type: "schedule", placement: previous });
    setSelected(null);
    playSound("tick");
  };

  const clearAll = () => {
    if (locked) return;
    apply((current) => current.map(() => null));
    setSelected(null);
  };

  const hitTest = (clientX: number, clientY: number): Target | null => {
    const board = boardRef.current;
    if (!board || !layout) return null;
    const origin = board.getBoundingClientRect();
    const x = clientX - origin.left;
    const y = clientY - origin.top;
    const inside = (b: Box, pad: number) =>
      x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;
    const slotIndex = layout.slots.findIndex((b) => inside(b, 4));
    if (slotIndex >= 0) return { kind: "slot", index: slotIndex };
    if (inside(layout.tray, 6)) return { kind: "tray" };
    return null;
  };

  /* ── 드래그 ── */
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (locked || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== event.pointerId) return;
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      g.moved = true;
      setSelected(null);
    }
    if (g.moved) setDrag({ id: g.id, dx, dy, over: hitTest(event.clientX, event.clientY) });
  };

  const endDrag = (event: PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!g || g.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (!g.moved) return; // 누르기만 했다면 click 에서 처리한다
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 0);
    setDrag(null);
    if (cancelled) return;
    const target = hitTest(event.clientX, event.clientY);
    if (target) move(g.id, target);
  };

  /* ── 누르기: 카드를 고른 뒤 자리를 누른다 ── */
  const onCardClick = (id: string) => {
    if (locked || suppressClick.current) return;
    if (selected === id) {
      setSelected(null);
      return;
    }
    if (selected) {
      const slotIndex = placement.indexOf(id);
      if (slotIndex >= 0) {
        move(selected, { kind: "slot", index: slotIndex });
        setSelected(null);
        return;
      }
    }
    setSelected(id);
    playSound("tick");
  };

  const onSlotClick = (index: number) => {
    if (locked || !selected) return;
    move(selected, { kind: "slot", index });
    setSelected(null);
  };

  const onTrayClick = () => {
    if (locked || !selected) return;
    move(selected, { kind: "tray" });
    setSelected(null);
  };

  const placedCount = placement.filter(Boolean).length;
  const selectedName = people.find((p) => p.id === selected)?.name;

  return (
    <div className="schedule">
      <article className="exampaper leaf" style={{ viewTransitionName: "exam-sheet" }}>
        {brief}
        <section className="conditions" aria-labelledby="conditions-title">
          <h2 id="conditions-title" className="hand">
            조건
          </h2>
          <ol>
            {constraints.map((c, i) => (
              <li key={i}>
                <span className="conditions__no hand num">{i + 1}</span>
                {c.text}
              </li>
            ))}
          </ol>
        </section>
      </article>

      <section className="board" ref={boardRef} data-shaking={shaking} data-verdict={verdict} aria-label="발표 시간표">
        <div className="board__slots">
          {slots.map((slot, i) => {
            const occupant = people.find((p) => p.id === placement[i]);
            return (
              <div className="slot" key={slot.label}>
                <p className="slot__time num">{slot.label}</p>
                <p className="slot__ordinal">{slot.ordinal}</p>
                <button
                  type="button"
                  className="slot__drop"
                  ref={(el) => {
                    slotRefs.current[i] = el;
                  }}
                  data-over={drag?.over?.kind === "slot" && drag.over.index === i}
                  data-ready={!!selected}
                  data-filled={!!occupant}
                  data-testid={`slot-${i}`}
                  aria-label={`${slot.label} ${slot.ordinal} 자리${occupant ? `, ${occupant.name} 배치됨` : ", 비어 있음"}${selectedName ? `. 누르면 ${selectedName} 배치` : ""}`}
                  disabled={locked}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => onSlotClick(i)}
                >
                  {verdict === "correct" && (
                    <span className="slot__check">
                      <PenMark kind="check" draw delayMs={i * 120} />
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div
          className="board__tray"
          ref={trayRef}
          data-over={drag?.over?.kind === "tray"}
          data-ready={!!selected && placement.includes(selected)}
          onClick={onTrayClick}
        >
          <p className="board__tray-label">
            {selectedName
              ? `${selectedName} 선택됨 — 놓을 시간을 누르세요`
              : placedCount === slots.length
                ? "네 명을 모두 배치했습니다"
                : "카드를 끌거나, 누른 뒤 시간을 눌러 배치하세요"}
          </p>
          <div className="board__seats">
            {people.map((person, i) => (
              <div
                className="seat"
                key={person.id}
                ref={(el) => {
                  homeRefs.current[i] = el;
                }}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>

        {/* 카드 층 */}
        <div className="board__cards">
          {layout &&
            people.map((person, homeIndex) => {
              const slotIndex = placement.indexOf(person.id);
              const box = slotIndex >= 0 ? layout.slots[slotIndex] : layout.homes[homeIndex];
              const dragging = drag?.id === person.id;
              const x = box.x + (dragging ? drag.dx : 0);
              const y = box.y + (dragging ? drag.dy : 0);
              return (
                <button
                  key={person.id}
                  type="button"
                  className="pcard"
                  data-dragging={dragging}
                  data-selected={selected === person.id}
                  data-placed={slotIndex >= 0}
                  data-testid={`card-${person.id}`}
                  aria-pressed={selected === person.id}
                  aria-label={`${person.name} 카드, ${slotIndex >= 0 ? `${slots[slotIndex].label}에 배치됨` : "대기 중"}`}
                  disabled={locked}
                  style={{
                    width: box.w,
                    height: box.h,
                    // 끌 때 이름표를 기울이거나 키우지 않는다 (점이 뭉개지지 않게)
                    transform: `translate3d(${x}px, ${y}px, 0)`,
                    animationDelay: verdict === "correct" && slotIndex >= 0 ? `${slotIndex * 120}ms` : undefined,
                  }}
                  onPointerDown={(event) => onPointerDown(event, person.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={(event) => endDrag(event, false)}
                  onPointerCancel={(event) => endDrag(event, true)}
                  onClick={() => onCardClick(person.id)}
                >
                  <Portrait person={person} />
                  <span className="pcard__name">{person.name}</span>
                </button>
              );
            })}
        </div>
      </section>

      <div className="schedule__tools">
        <span className="schedule__count leaf num" data-testid="placed-count">
          배치 {placedCount}/{slots.length}
        </span>
        <button type="button" className="minibtn leaf" onClick={undo} disabled={locked || history.length === 0} data-testid="undo">
          되돌리기
        </button>
        <button type="button" className="minibtn leaf" onClick={clearAll} disabled={locked || placedCount === 0} data-testid="clear">
          모두 비우기
        </button>
      </div>
    </div>
  );
}
