import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { haptic, playSound } from "../../app/sound";
import { PenMark } from "../../art/pixel";
import { Portrait } from "../../art/portraits";
import { allCards, deriveFrom } from "../../engine/evidence";
import type { EvidenceCard, EvidenceInput, EvidenceKind, EvidencePuzzle } from "../../engine/types";
import type { GameProps, Verdict } from "../logic";

export const KIND_LABEL: Record<EvidenceKind, string> = {
  log: "출입 기록",
  time: "시간 기록",
  object: "물건",
  statement: "진술",
  derived: "새 사실",
};

/** 카드 귀퉁이의 두 글자 */
const KIND_TAG: Record<EvidenceKind, string> = {
  log: "기록",
  time: "시각",
  object: "물건",
  statement: "진술",
  derived: "사실",
};

/** 집어 든 두 장으로 할 수 있는 일 */
export type BoardMode =
  /** 아직 두 장을 집지 않았다 */
  | "pick"
  /** 기록·물건·사실 두 장: 이어서 새 사실을 찾는다 */
  | "link"
  /** 진술 한 장과 증거 한 장: 모순으로 제출할 수 있다 */
  | "accuse"
  /** 진술 두 장: 할 수 있는 일이 없다 */
  | "statements";

type Note =
  | { kind: "found"; card: EvidenceCard }
  | { kind: "nothing" }
  | { kind: "known"; card: EvidenceCard }
  | { kind: "statements" }
  | { kind: "pick" };

type Board = Pick<GameProps<EvidencePuzzle, EvidenceInput>, "puzzle" | "input" | "onChange" | "locked">;

/**
 * 증거 게시판의 조작: 카드를 두 장까지 집고, 기록끼리는 이어서 새 사실을 얻는다.
 * 잇는 것은 채점되지 않는다(조사다). 채점되는 것은 "이 진술은 이 증거와 모순이다"라는 제출뿐이다.
 */
export function useEvidenceBoard({ puzzle, input, onChange, locked }: Board) {
  const [note, setNote] = useState<Note | null>(null);
  /** 방금 얻은 사실 (게시판에서 잠깐 뒤집혀 보인다) */
  const [fresh, setFresh] = useState<string | null>(null);

  useEffect(() => {
    if (!fresh) return;
    const id = window.setTimeout(() => setFresh(null), 900);
    return () => window.clearTimeout(id);
  }, [fresh]);

  const every = allCards(puzzle.rules);
  const byId = (id: string) => every.find((card) => card.id === id)!;
  /** 게시판에 있는 카드: 처음의 증거 + 지금까지 얻은 사실(얻은 순서대로) */
  const cards = [...puzzle.rules.cards, ...input.found.map(byId)];
  const picked = input.picked.map(byId);
  const statements = picked.filter((card) => card.kind === "statement").length;
  const mode: BoardMode = picked.length < 2 ? "pick" : statements === 2 ? "statements" : statements === 1 ? "accuse" : "link";

  const pick = (id: string) => {
    if (locked) return;
    setNote(null);
    playSound("tick");
    onChange((previous) => {
      if (previous.picked.includes(id)) return { ...previous, picked: previous.picked.filter((p) => p !== id) };
      // 두 장을 이미 집었으면 먼저 집은 것을 내려놓는다
      return { ...previous, picked: [...previous.picked, id].slice(-2) };
    });
  };

  /** 집어 든 두 증거를 잇는다 */
  const link = () => {
    if (locked) return;
    if (mode === "pick") {
      setNote({ kind: "pick" });
      return;
    }
    if (mode === "statements") {
      setNote({ kind: "statements" });
      return;
    }
    if (mode !== "link") return;
    const card = deriveFrom(puzzle.rules, input.picked[0], input.picked[1]);
    if (!card) {
      setNote({ kind: "nothing" });
      playSound("wrong");
      return;
    }
    if (input.found.includes(card.id)) {
      setNote({ kind: "known", card });
      onChange((previous) => ({ ...previous, picked: [card.id] }));
      return;
    }
    setNote({ kind: "found", card });
    setFresh(card.id);
    playSound("stamp");
    haptic(18);
    // 얻은 사실을 곧바로 손에 든다: 이제 진술과 맞대어 볼 차례다
    onChange((previous) => ({ ...previous, found: [...previous.found, card.id], picked: [card.id] }));
  };

  return { cards, picked, mode, note, fresh, pick, link };
}

export type EvidenceBoardState = ReturnType<typeof useEvidenceBoard>;

function statusText(board: EvidenceBoardState, verdict: Verdict): string {
  if (verdict === "correct") return "두 증거는 함께 성립할 수 없다. 거짓 진술을 찾았다.";
  const { note, mode, picked } = board;
  if (note) {
    switch (note.kind) {
      case "found":
        return `새 사실을 얻었다. ${note.card.text}`;
      case "known":
        return `이미 찾아 둔 사실이다. ${note.card.text}`;
      case "nothing":
        return "두 증거를 이어도 새로 알 수 있는 것이 없다.";
      case "statements":
        return "진술끼리는 누가 거짓인지 가릴 수 없다. 기록이나 물건과 맞대어 본다.";
      case "pick":
        return "먼저 증거를 두 장 집는다.";
    }
  }
  if (picked.length === 0) return "증거를 두 장 집어 맞대어 본다.";
  if (picked.length === 1) return "한 장 더 집는다.";
  if (mode === "link") return "기록과 기록이다. 이으면 새 사실이 나올 수 있다.";
  if (mode === "accuse") return "진술과 증거다. 함께 성립할 수 없다면 모순으로 제출한다.";
  return "진술 두 장이다. 진술끼리는 누가 거짓인지 가릴 수 없다.";
}

interface ThreadPoint {
  x: number;
  y: number;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * 집어 든 두 카드를 잇는 실. 점을 2px 격자에 맞춰 찍는다(비스듬한 선을 그으면 회색이 생긴다).
 * 다른 카드의 글자 위는 건너뛴다: 실이 글자 뒤로 지나가는 것처럼 보이고, 글이 가려지지 않는다.
 */
function Thread({ from, to, avoid }: { from: ThreadPoint; to: ThreadPoint; avoid: Box[] }) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.floor(length / 6));
  const dots: ThreadPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const dot = { x: Math.round((from.x + (to.x - from.x) * t) / 2) * 2, y: Math.round((from.y + (to.y - from.y) * t) / 2) * 2 };
    if (avoid.some((box) => dot.x >= box.left - 4 && dot.x <= box.right + 4 && dot.y >= box.top - 2 && dot.y <= box.bottom + 2)) continue;
    dots.push(dot);
  }
  return (
    <span className="evi__thread" aria-hidden="true">
      {dots.map((dot, i) => (
        <i key={i} style={{ left: dot.x, top: dot.y }} />
      ))}
    </span>
  );
}

interface Props {
  puzzle: EvidencePuzzle;
  board: EvidenceBoardState;
  locked: boolean;
  verdict: Verdict;
  wrongCount: number;
}

/**
 * 증거 게시판. 위에는 핀으로 꽂힌 카드들, 아래에는 집어 든 두 장을 나란히 읽는 자리.
 * 집어 든 두 카드 사이에는 실이 걸린다.
 */
export function EvidenceBoard({ puzzle, board, locked, verdict, wrongCount }: Props) {
  const { cards, picked, fresh, pick } = board;
  const [shaking, setShaking] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const [thread, setThread] = useState<{ from: ThreadPoint; to: ThreadPoint; avoid: Box[] } | null>(null);
  const pickedKey = picked.map((card) => card.id).join("+");
  const people = puzzle.rules.people;

  useEffect(() => {
    if (wrongCount === 0) return;
    setShaking(true);
    const id = window.setTimeout(() => setShaking(false), 460);
    return () => window.clearTimeout(id);
  }, [wrongCount]);

  // 집어 든 두 카드의 핀과 핀 사이에 실을 건다. 카드 수가 바뀌거나 창 크기가 바뀌면 다시 잰다.
  useLayoutEffect(() => {
    const host = boardRef.current;
    if (!host || picked.length !== 2) {
      setThread(null);
      return;
    }
    const measure = () => {
      const box = host.getBoundingClientRect();
      const points = picked.map((card) => {
        const pin = host.querySelector<HTMLElement>(`[data-card="${card.id}"] .evichip__pin`);
        if (!pin) return null;
        const r = pin.getBoundingClientRect();
        return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
      });
      // 글자가 놓인 자리(이름표·종류·얼굴)는 실이 건너뛴다
      const avoid = [...host.querySelectorAll<HTMLElement>(".evichip__label, .evichip__tag, .evichip__said, .evichip__face")].map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left - box.left, top: r.top - box.top, right: r.right - box.left, bottom: r.bottom - box.top };
      });
      setThread(points[0] && points[1] ? { from: points[0], to: points[1], avoid } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
    // 집은 카드와 게시판의 카드 수가 바뀔 때만 다시 잰다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedKey, cards.length]);

  const solved = verdict === "correct";
  const statements = cards.filter((card) => card.kind === "statement");
  const facts = cards.filter((card) => card.kind !== "statement");

  const chip = (card: EvidenceCard) => {
    const index = picked.findIndex((p) => p.id === card.id);
    const speaker = card.speaker ? people.find((p) => p.id === card.speaker) : undefined;
    const liar = solved && card.id === puzzle.solution.statement;
    return (
      <button
        key={card.id}
        type="button"
        className="evichip"
        data-card={card.id}
        data-kind={card.kind}
        data-picked={index >= 0}
        data-fresh={fresh === card.id}
        data-liar={liar}
        aria-pressed={index >= 0}
        aria-label={`${KIND_LABEL[card.kind]}: ${card.label}. ${card.text}`}
        data-testid={`card-${card.id}`}
        disabled={locked}
        onClick={() => pick(card.id)}
      >
        <i className="evichip__pin" aria-hidden="true" />
        {speaker ? (
          <>
            <span className="evichip__face" aria-hidden="true">
              <Portrait person={speaker} />
              {liar && <PenMark kind="cross" draw />}
            </span>
            <span className="evichip__label">{speaker.name}</span>
            <span className="evichip__said" aria-hidden="true">
              진술
            </span>
          </>
        ) : (
          <>
            <span className="evichip__tag" aria-hidden="true">
              {KIND_TAG[card.kind]}
            </span>
            <span className="evichip__label">{card.label}</span>
          </>
        )}
      </button>
    );
  };

  return (
    <div className="evi" data-verdict={verdict} data-shaking={shaking}>
      {/* 게시판: 위 줄은 사람들의 말, 아래는 기록·물건과 이어서 얻은 사실. 집어 든 두 장 사이에 실이 걸린다. */}
      <div className="evi__board" ref={boardRef} role="group" aria-label="증거 게시판">
        <div className="evi__people" style={{ gridTemplateColumns: `repeat(${statements.length}, 1fr)` }}>
          {statements.map(chip)}
        </div>
        <div className="evi__facts">{facts.map(chip)}</div>
        {thread && <Thread from={thread.from} to={thread.to} avoid={thread.avoid} />}
      </div>

      <section className="evi__bench" aria-label="맞대어 보는 자리" data-solved={solved} data-empty={picked.length === 0}>
        {picked.length === 0 ? (
          <p className="evi__how" data-testid="evi-how">
            {puzzle.description}
          </p>
        ) : (
          [0, 1].map((slot) => {
            const card = picked[slot];
            return (
              <div key={slot} className="evislot" data-filled={!!card} data-kind={card?.kind} data-testid={`bench-${slot}`}>
                {card ? (
                  <>
                    <p className="evislot__head">
                      <b>{card.label}</b>
                      <span>{KIND_LABEL[card.kind]}</span>
                    </p>
                    <p className="evislot__text">{card.kind === "statement" ? `“${card.text}”` : card.text}</p>
                  </>
                ) : (
                  <p className="evislot__empty">맞대어 볼 증거를 한 장 더 집는다</p>
                )}
              </div>
            );
          })
        )}
        <p className="evi__status" role="status" data-testid="evi-status">
          {statusText(board, verdict)}
        </p>
      </section>
    </div>
  );
}
