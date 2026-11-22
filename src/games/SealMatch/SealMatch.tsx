import { useEffect, useState } from "react";
import { haptic, playSound } from "../../app/sound";
import { pressSeal, sealFace } from "../../engine/seal";
import type { SpatialInput, SpatialPuzzle } from "../../engine/types";
import type { GameProps } from "../logic";

const TURN_WORD = ["돌리지 않음", "한 번 돌림", "두 번 돌림", "세 번 돌림"];

interface GridProps {
  grid: readonly string[];
  /** 점 하나의 크기(px). 2의 배수여야 한다. */
  cell: number;
  label: string;
  /** 작게 놓을 때: 모눈(빈칸의 점과 칸 사이의 금)을 그리지 않고 모양만 찍는다 */
  plain?: boolean;
  className?: string;
}

/** 점 격자: 찍힌 곳은 흰 점, 빈 곳은 검정, 번진 곳은 점묘 */
export function DotGrid({ grid, cell, label, plain = false, className }: GridProps) {
  return (
    <span
      className={["dotgrid", className].filter(Boolean).join(" ")}
      data-plain={plain}
      role="img"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${grid.length}, ${cell}px)`, gridAutoRows: `${cell}px` }}
    >
      {grid.flatMap((row, r) =>
        [...row].map((ch, c) => <i key={`${r}-${c}`} data-c={ch === "#" ? "on" : ch === "?" ? "blur" : "off"} />),
      )}
    </span>
  );
}

/** 격자를 글로 옮긴 것: 화면 낭독기가 줄마다 읽는다 */
export function gridWords(grid: readonly string[]): string {
  return grid
    .map((row, r) => `${r + 1}째 줄 ${[...row].map((ch) => (ch === "#" ? "점" : ch === "?" ? "번짐" : "빈칸")).join(" ")}`)
    .join(". ");
}

/**
 * 인장 대조. 종이에 남은 자국과, 손에 든 도장의 면을 나란히 놓고 본다.
 * 도장은 돌릴 수 있고, 시험 종이에 찍어 보면 좌우가 뒤집힌 자국이 남는다. 시험 종이는 정해진 수만큼만 쓸 수 있다.
 */
export function SealMatch({ puzzle, input, onChange, locked, verdict, wrongCount }: GameProps<SpatialPuzzle, SpatialInput>) {
  const { rules } = puzzle;
  const [shaking, setShaking] = useState(false);
  /** 방금 찍은 시험 종이(잠깐 뒤집혀 보인다) */
  const [pressed, setPressed] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (wrongCount === 0) return;
    setShaking(true);
    const id = window.setTimeout(() => setShaking(false), 460);
    return () => window.clearTimeout(id);
  }, [wrongCount]);

  useEffect(() => {
    if (pressed === null) return;
    const id = window.setTimeout(() => setPressed(null), 420);
    return () => window.clearTimeout(id);
  }, [pressed]);

  const held = rules.stamps.find((stamp) => stamp.id === input.stamp) ?? null;
  const turn = held ? (input.turns[held.id] ?? 0) : 0;
  const left = rules.trials - input.trials.length;
  const cell = rules.size >= 6 ? 16 : 20;
  /** 도장 고르는 칸의 작은 그림 */
  const small = rules.size >= 6 ? 6 : 8;
  /** 시험 종이의 자국: 큰 자국과 견줘 볼 수 있게 조금 크게 찍는다 */
  const print = rules.size >= 6 ? 8 : 10;

  const pick = (id: string) => {
    if (locked) return;
    setNote(null);
    playSound("tick");
    onChange((previous) => ({ ...previous, stamp: id }));
  };

  const rotate = () => {
    if (locked || !held) return;
    setNote(null);
    playSound("tick");
    haptic(6);
    onChange((previous) => ({ ...previous, turns: { ...previous.turns, [held.id]: ((previous.turns[held.id] ?? 0) + 1) % 4 } }));
  };

  const press = () => {
    if (locked) return;
    if (!held) {
      setNote("찍어 볼 도장을 먼저 집는다.");
      return;
    }
    if (left <= 0) {
      setNote("시험 종이를 다 썼다. 남은 것은 눈으로 따져 본다.");
      return;
    }
    if (input.trials.some((trial) => trial.stamp === held.id && trial.turn === turn)) {
      setNote("이 도장은 이 방향으로 이미 찍어 봤다.");
      return;
    }
    setNote(null);
    playSound("place");
    haptic(12);
    setPressed(input.trials.length);
    onChange((previous) => ({ ...previous, trials: [...previous.trials, { stamp: held.id, turn }] }));
  };

  const status =
    verdict === "correct"
      ? "자국이 정확히 겹친다."
      : (note ?? (held ? `${held.name} · ${TURN_WORD[turn]}. 찍으면 좌우가 뒤집힌다.` : "도장을 집어 돌려 본다. 찍으면 좌우가 뒤집힌다."));

  return (
    <div className="seal" data-verdict={verdict} data-shaking={shaking} data-size={rules.size}>
      <section className="seal__stage" aria-label="자국과 도장">
        <figure className="seal__paper">
          <DotGrid grid={rules.imprint} cell={cell} label={`종이에 남은 자국. ${gridWords(rules.imprint)}`} />
          <figcaption>종이에 남은 자국</figcaption>
        </figure>

        {/* 손에 든 도장: 누르면 시계 방향으로 한 번 돈다. 위쪽을 가리키던 눈금이 함께 돈다. */}
        <button
          type="button"
          className="seal__hand"
          data-empty={!held}
          onClick={rotate}
          disabled={locked || !held}
          data-testid="seal-turn"
          aria-label={held ? `${held.name}, ${TURN_WORD[turn]}. 누르면 시계 방향으로 돌린다. ${gridWords(sealFace(held.face, turn))}` : "손에 든 도장 없음"}
        >
          {held ? (
            <span className="seal__block" data-turn={turn} data-testid="held-face" data-stamp={held.id}>
              <i className="seal__notch" aria-hidden="true" />
              <DotGrid grid={sealFace(held.face, turn)} cell={cell} label="" />
            </span>
          ) : (
            <span className="seal__block seal__block--none" style={{ width: cell * rules.size, height: cell * rules.size }}>
              아래에서
              <br />
              도장을 집는다
            </span>
          )}
          <span className="seal__cap">{held ? `${held.name}의 면` : "손에 든 도장"}</span>
          <span className="seal__spin" data-on={!!held}>
            눌러서 돌리기
          </span>
        </button>

        <p className="seal__status" role="status" data-testid="seal-status">
          {status}
        </p>
      </section>

      <section className="seal__rack" role="radiogroup" aria-label="도장 고르기">
        {rules.stamps.map((stamp) => {
          const selected = stamp.id === input.stamp;
          const stampTurn = input.turns[stamp.id] ?? 0;
          return (
            <button
              key={stamp.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className="seal__pick"
              data-selected={selected}
              data-testid={`stamp-${stamp.id}`}
              disabled={locked}
              onClick={() => pick(stamp.id)}
            >
              <DotGrid grid={sealFace(stamp.face, stampTurn)} cell={small} label="" plain />
              <span className="seal__name">{stamp.name.replace(" 도장", "")}</span>
            </button>
          );
        })}
      </section>

      {rules.trials === 0 ? (
        /* 시험 종이가 없는 문제: 머릿속으로만 돌리고 뒤집어 본다 */
        <p className="seal__notrial" data-testid="seal-notrial">
          시험 종이 없음 · 눈으로만 따져 본다
        </p>
      ) : (
        <section className="seal__trials" aria-label="시험 종이">
          <button type="button" className="seal__press" onClick={press} disabled={locked} data-testid="seal-press" data-left={left}>
            찍어 보기
            <span className="seal__left num" aria-label={`남은 시험 종이 ${left}장`}>
              {left}
            </span>
          </button>
          <ol className="seal__sheets">
            {Array.from({ length: rules.trials }, (_, i) => {
              const trial = input.trials[i];
              const stamp = trial ? rules.stamps.find((s) => s.id === trial.stamp) : null;
              return (
                <li key={i} className="seal__sheet" data-used={!!trial} data-fresh={pressed === i} data-testid={`trial-${i}`}>
                  {trial && stamp ? (
                    <>
                      <DotGrid
                        grid={pressSeal(stamp.face, trial.turn)}
                        cell={print}
                        plain
                        label={`${stamp.name}을 ${TURN_WORD[trial.turn]}으로 찍은 자국. ${gridWords(pressSeal(stamp.face, trial.turn))}`}
                      />
                      <span className="seal__name">{stamp.name.replace(" 도장", "")}</span>
                    </>
                  ) : (
                    <span className="seal__blank" style={{ width: print * rules.size, height: print * rules.size }} aria-label="빈 시험 종이" />
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
