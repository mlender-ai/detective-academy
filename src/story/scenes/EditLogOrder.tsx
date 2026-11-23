import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { haptic, playSound } from "../../app/sound";
import { gameStore } from "../../app/store";
import { Narration } from "../../components/Narration";
import { EvidenceGain, StoryShell, nextLabel, type SceneProps } from "../components/StoryParts";
import { orderOf, sceneAfter, sceneDone } from "../engine/storyEngine";
import type { OrderScene } from "../engine/storyTypes";

/** 끌기로 치는 거리(px). 이보다 덜 움직였으면 누른 것이다. */
const DRAG_THRESHOLD = 6;

interface Drag {
  id: string;
  from: number;
  /** 손가락이 움직인 거리 */
  dy: number;
  /** 지금 놓으면 들어갈 자리 */
  to: number;
}

/**
 * 순서 놓기. 뒤섞인 기록 카드가 한 줄로 놓여 있고, 카드를 끌어 원하는 자리에 끼워 넣거나,
 * 카드 하나를 누른 뒤 다른 카드를 눌러 두 장의 자리를 맞바꾼다. 놓은 순서는 저장되어 나갔다 와도 그대로다.
 * "이 순서로 확인"을 누르면 채점한다: 틀리면 어긋나는 까닭 하나를 듣고 다시 놓는다(맞는 순서는 듣지 못한다).
 */
export function EditLogOrder(props: SceneProps & { scene: OrderScene }) {
  const { c, ch, p, go, scene } = props;
  const done = sceneDone(p, scene);
  const order = orderOf(p, scene);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);
  const [line, setLine] = useState(done ? scene.done : scene.enter);
  const [gain, setGain] = useState<string[]>([]);
  const [shake, setShake] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);
  const gesture = useRef<{ id: string; pointerId: number; startY: number; pitch: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const alertRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (wrong) alertRef.current?.scrollIntoView({ block: "nearest" });
  }, [wrong, shake]);

  const arrange = (next: string[]) => {
    if (next.every((id, i) => id === order[i])) return;
    gameStore.storyArrange(c, ch, scene.id, next);
    setWrong(null);
    playSound("place");
    haptic(8);
  };

  /** 카드를 그 자리에 끼워 넣는다(사이의 카드는 한 칸씩 밀린다) */
  const insert = (id: string, to: number) => {
    const next = order.filter((x) => x !== id);
    next.splice(to, 0, id);
    arrange(next);
  };

  const swap = (a: string, b: string) => {
    arrange(order.map((id) => (id === a ? b : id === b ? a : id)));
  };

  const tap = (id: string) => {
    if (done) return;
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (selected === null) {
      setSelected(id);
      playSound("tick");
    } else if (selected === id) {
      setSelected(null);
    } else {
      swap(selected, id);
      setSelected(null);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (done || event.button > 0) return;
    const rows = listRef.current?.children;
    // 줄과 줄 사이의 거리: 첫 두 줄의 위쪽 끝의 차이
    const pitch = rows && rows.length > 1 ? rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top : 50;
    gesture.current = { id, pointerId: event.pointerId, startY: event.clientY, pitch, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== event.pointerId) return;
    const dy = event.clientY - g.startY;
    if (!g.moved && Math.abs(dy) < DRAG_THRESHOLD) return;
    g.moved = true;
    const from = order.indexOf(g.id);
    const to = Math.max(0, Math.min(order.length - 1, from + Math.round(dy / g.pitch)));
    setDrag({ id: g.id, from, dy, to });
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (g.moved && drag) {
      suppressClick.current = true;
      // 끌어 놓은 뒤에 따라오는 누름은 삼킨다(끌기가 고르기로 바뀌지 않게). 누름이 오지 않으면 곧 푼다.
      window.setTimeout(() => (suppressClick.current = false), 80);
      if (drag.to !== drag.from) insert(g.id, drag.to);
      setSelected(null);
    }
    setDrag(null);
  };

  const submit = () => {
    const outcome = gameStore.storyOrder(c, ch, scene.id, order);
    setSelected(null);
    if (outcome.correct) {
      playSound("success");
      setWrong(null);
      setLine(outcome.reason);
      if (outcome.granted.length > 0) setGain(outcome.granted);
      return;
    }
    playSound("wrong");
    haptic(30);
    setWrong(outcome.reason);
    setShake((n) => n + 1);
  };

  /** 끄는 동안: 끄는 카드는 손가락을 따라가고, 사이의 카드는 한 칸씩 비켜 선다 */
  const shift = (id: string, i: number): CSSProperties | undefined => {
    if (!drag) return undefined;
    const pitch = gesture.current?.pitch ?? 50;
    if (id === drag.id) return { transform: `translateY(${Math.round(drag.dy / 2) * 2}px)` };
    if (drag.to > drag.from && i > drag.from && i <= drag.to) return { transform: `translateY(${-pitch}px)` };
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return { transform: `translateY(${pitch}px)` };
    return undefined;
  };

  return (
    <StoryShell
      {...props}
      current={scene.id}
      foot={
        done ? (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" data-long={nextLabel(ch, scene.id).length > 7} onClick={() => go(sceneAfter(ch, scene.id))} data-testid="story-next">
            {nextLabel(ch, scene.id)}
          </button>
        ) : (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" onClick={submit} data-testid="order-submit">
            순서 확인
          </button>
        )
      }
    >
      <div className="story__scroll">
        <section className="olog" aria-label={scene.title} data-solved={done} data-dragging={!!drag} data-testid="order">
          <p className="olog__bar">
            <span>{scene.question}</span>
          </p>
          <ol className="olog__list" ref={listRef} key={shake} data-shake={shake > 0 && !!wrong}>
            {order.map((id, i) => {
              const card = scene.cards.find((x) => x.id === id)!;
              return (
                <li className="olog__row" key={id} data-testid={`slot-${i + 1}`} data-card={id}>
                  <span className="olog__no num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    className="olog__card"
                    style={shift(id, i)}
                    aria-pressed={selected === id}
                    aria-label={`${i + 1}번째: ${card.label} (${card.tags.join(", ")})`}
                    data-dragging={drag?.id === id}
                    disabled={done}
                    onClick={() => tap(id)}
                    onPointerDown={(event) => onPointerDown(event, id)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    data-testid={`card-${id}`}
                  >
                    <span className="olog__label">{card.label}</span>
                    <span className="olog__tags">
                      {card.tags.map((t) => (
                        <i key={t} className="num">
                          {t}
                        </i>
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="olog__how" data-testid="order-how">
            {done ? "순서가 확인됐다." : selected ? "바꿀 자리의 카드를 누르면 두 장이 자리를 맞바꾼다." : "카드를 끌어 옮기거나, 두 장을 차례로 눌러 맞바꾼다."}
          </p>
          <ul className="olog__rules" aria-label="기록 읽는 법" data-testid="order-rules">
            {scene.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
      </div>

      {wrong && !done ? (
        <p className="story__alert" ref={alertRef} role="alert" data-testid="order-wrong">
          {wrong}
        </p>
      ) : (
        <Narration text={line} />
      )}

      {gain.length > 0 && (
        <EvidenceGain
          evidence={ch.evidence.filter((e) => gain.includes(e.id))}
          onClose={() => {
            setGain([]);
            setLine(scene.done);
          }}
        />
      )}
    </StoryShell>
  );
}
