import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { haptic, playSound } from "../../app/sound";
import { PenMark, PX, Sprite } from "../../art/pixel";
import type { CodeClue, CodeInput, CodePuzzle, DigitMemo } from "../../engine/types";
import type { GameProps } from "../logic";

/** 숫자 한 칸을 넘기는 데 필요한 손가락 이동 거리이자, 드럼 면 하나의 높이 */
const CELL = 50;
const ORDINALS = ["첫째", "둘째", "셋째", "넷째", "다섯째"];

const mod = (n: number, m: number) => ((n % m) + m) % m;

export function clueText(clue: CodeClue): string {
  const { match, inPlace } = clue;
  if (match === 0) return "일치하는 숫자 없음";
  if (inPlace === 0) return match === 1 ? "1개 일치, 위치는 틀림" : `${match}개 일치, 모두 위치 틀림`;
  if (inPlace === match) return match === 1 ? "1개 일치, 위치도 정확" : `${match}개 일치, 모두 위치 정확`;
  return `${match}개 일치, ${inPlace}개만 위치 정확`;
}

/* ───────── 숫자 드럼 한 자리 ───────── */

interface DialProps {
  index: number;
  value: number;
  digits: number[];
  disabled: boolean;
  duplicate: boolean;
  onChange: (value: number) => void;
}

function Chevron({ up }: { up: boolean }) {
  return <Sprite name={up ? "chevron-up" : "chevron-down"} />;
}

/**
 * 손가락으로 굴리는 숫자 릴.
 * 슬롯 릴처럼 평평한 숫자 면이 점 크기에 맞춰 딱딱 끊겨 움직인다.
 * 위치를 직접 계산해 옮기므로 어느 엔진에서나 똑같이 보인다. 놓으면 가장 가까운 숫자에 딸깍 물린다.
 */
function Dial({ index, value, digits, disabled, duplicate, onChange }: DialProps) {
  const n = digits.length;

  // pos 는 끝없이 이어지는 회전 위치다. 9 다음 1로 넘어갈 때도 같은 방향으로 굴러간다.
  const [pos, setPos] = useState(() => Math.max(0, digits.indexOf(value)));
  const posRef = useRef(pos);
  const [dragPx, setDragPx] = useState(0);
  const gesture = useRef<{ pointerId: number; startY: number; moved: boolean; lastStep: number } | null>(null);
  const suppressClick = useRef(false);

  // 바깥에서 값이 바뀌면(초기화 등) 가까운 방향으로 돌려 맞춘다.
  useEffect(() => {
    const target = digits.indexOf(value);
    if (target < 0) return;
    let delta = target - mod(posRef.current, n);
    if (delta > n / 2) delta -= n;
    if (delta < -n / 2) delta += n;
    if (delta === 0) return;
    posRef.current += delta;
    setPos(posRef.current);
  }, [value, digits, n]);

  const rotate = (steps: number, silent = false) => {
    if (disabled || steps === 0) return;
    const next = posRef.current + steps;
    posRef.current = next;
    setPos(next);
    onChange(digits[mod(next, n)]);
    if (!silent) {
      playSound("tick");
      haptic(6);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { pointerId: event.pointerId, startY: event.clientY, moved: false, lastStep: 0 };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== event.pointerId) return;
    const dy = event.clientY - g.startY;
    if (!g.moved && Math.abs(dy) > 5) g.moved = true;
    if (!g.moved) return;
    setDragPx(dy);
    // 굴리는 동안 숫자 한 칸을 지날 때마다 톱니가 걸리는 느낌을 준다
    const passed = Math.round(-dy / CELL);
    if (passed !== g.lastStep) {
      g.lastStep = passed;
      playSound("tick");
      haptic(4);
    }
  };

  const endGesture = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!g || g.pointerId !== event.pointerId) return;
    gesture.current = null;
    const dy = event.clientY - g.startY;
    setDragPx(0);
    if (g.moved) {
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
      if (!cancelled) rotate(Math.round(-dy / CELL), true);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      rotate(1);
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      rotate(-1);
    }
  };

  const dragging = dragPx !== 0;
  const centre = pos - dragPx / CELL;
  const faces: number[] = [];
  for (let k = Math.floor(centre) - 2; k <= Math.ceil(centre) + 2; k++) faces.push(k);
  const ordinal = ORDINALS[index] ?? `${index + 1}번째`;

  return (
    <div className="dial" data-duplicate={duplicate} data-disabled={disabled}>
      <button
        type="button"
        className="dial__step"
        aria-label={`${ordinal} 자리 이전 숫자`}
        disabled={disabled}
        onClick={() => rotate(-1)}
      >
        <Chevron up />
      </button>

      <div
        className="dial__window"
        role="spinbutton"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${ordinal} 자리 숫자`}
        aria-valuemin={digits[0]}
        aria-valuemax={digits[n - 1]}
        aria-valuenow={value}
        aria-disabled={disabled}
        data-testid={`dial-${index}`}
        data-dragging={dragging}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => endGesture(event, false)}
        onPointerCancel={(event) => endGesture(event, true)}
        onClick={() => {
          if (!suppressClick.current) rotate(1);
        }}
        onKeyDown={onKeyDown}
      >
        {faces.map((k) => {
          const offset = Math.round(((k - centre) * CELL) / PX) * PX;
          return (
            <span key={k} className="dial__face num" aria-hidden="true" style={{ transform: `translate3d(0, ${offset}px, 0)` }}>
              {digits[mod(k, n)]}
            </span>
          );
        })}
        <span className="dial__shade" aria-hidden="true" />
      </div>

      <button
        type="button"
        className="dial__step"
        aria-label={`${ordinal} 자리 다음 숫자`}
        disabled={disabled}
        data-testid={`dial-${index}-next`}
        onClick={() => rotate(1)}
      >
        <Chevron up={false} />
      </button>
    </div>
  );
}

/* ───────── 자물쇠 고리 ───────── */

function Shackle() {
  return <Sprite name="shackle" className="lock__shackle" />;
}

/* ───────── 자물쇠 몸통의 리벳 ───────── */

function LockPlate() {
  return (
    <>
      {(["tl", "tr", "bl", "br"] as const).map((corner) => (
        <i key={corner} className={`lock__rivet lock__rivet--${corner}`} aria-hidden="true" />
      ))}
    </>
  );
}

/**
 * 풀린 자물쇠. 결과 화면에서 풀이 때와 같은 자리에 놓여 암호를 보여 준다(조작할 수 없다).
 */
export function LockOpen({ digits }: { digits: number[] }) {
  return (
    <section
      className="lock lock--open"
      data-verdict="correct"
      aria-label={`풀린 자물쇠, 금고의 암호 ${digits.join("")}`}
      data-testid="solution"
      style={{ viewTransitionName: "code-lock" }}
    >
      <Shackle />
      <div className="lock__body">
        <LockPlate />
        <div className="lock__dials" aria-hidden="true">
          <span className="lock__sight" />
          {digits.map((digit, index) => (
            <div className="dial" key={index}>
              <div className="dial__window dial__window--still">
                <span className="dial__face dial__face--still num">{digit}</span>
                <span className="dial__shade" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="lock__status">금고의 암호</p>
    </section>
  );
}

/* ───────── 암호 해독 ───────── */

const MEMO_CYCLE: (DigitMemo | undefined)[] = [undefined, "out", "maybe"];
const MEMO_LABEL: Record<string, string> = { none: "표시 없음", out: "제외", maybe: "후보" };

interface Props extends GameProps<CodePuzzle, CodeInput> {
  /** 시험지 머리: 문제 제목과 설명, 열어 본 수사 지원 */
  brief: ReactNode;
}

/**
 * 책상 위의 시험지(시도 기록 + 숫자 메모)와 암호 자물쇠.
 * 시험지를 읽으면서 바로 아래 자물쇠를 굴린다.
 */
export function CodeBreaker({ puzzle, input, onChange, locked, verdict, wrongCount, brief }: Props) {
  const { rules } = puzzle;
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (wrongCount === 0) return;
    setShaking(true);
    const id = window.setTimeout(() => setShaking(false), 460);
    return () => window.clearTimeout(id);
  }, [wrongCount]);

  // 정답이면 고리가 튀어 오르며 잠금이 풀린다
  useEffect(() => {
    if (verdict !== "correct") return;
    const id = window.setTimeout(() => {
      playSound("unlock");
      haptic(24);
    }, 220);
    return () => window.clearTimeout(id);
  }, [verdict]);

  const setDial = (index: number, value: number) => {
    onChange((previous) => {
      const dials = [...previous.dials];
      dials[index] = value;
      return { ...previous, dials };
    });
  };

  const cycleMemo = (digit: number) => {
    playSound("place");
    onChange((previous) => {
      const current = previous.memo[String(digit)];
      const next = MEMO_CYCLE[(MEMO_CYCLE.indexOf(current) + 1) % MEMO_CYCLE.length];
      const memo = { ...previous.memo };
      if (next) memo[String(digit)] = next;
      else delete memo[String(digit)];
      return { ...previous, memo };
    });
  };

  const isDuplicate = (index: number) => input.dials.some((d, i) => i !== index && d === input.dials[index]);
  const hasDuplicate = input.dials.some((_, i) => isDuplicate(i));

  return (
    <div className="code">
      <article className="exampaper leaf" style={{ viewTransitionName: "exam-sheet" }}>
        {brief}

        <section className="clues" aria-labelledby="clues-title">
          <div className="clues__head">
            <h2 id="clues-title">시도 기록</h2>
            <p className="clues__legend">
              <i className="peg" data-kind="place" aria-hidden="true" />
              숫자·위치 일치
              <i className="peg" data-kind="digit" aria-hidden="true" />
              숫자만 일치
            </p>
          </div>
          <ol className="clues__list">
            {rules.clues.map((clue, i) => (
              <li className="clue" key={i}>
                <span className="clue__digits num" aria-label={`입력 ${clue.guess.join("")}`}>
                  {clue.guess.map((digit, j) => {
                    const memo = input.memo[String(digit)] ?? "none";
                    return (
                      <span className="clue__digit" key={j} data-memo={memo} aria-hidden="true">
                        {digit}
                        {memo === "out" && <PenMark kind="cross" />}
                        {memo === "maybe" && <PenMark kind="circle" />}
                      </span>
                    );
                  })}
                </span>
                <span className="clue__pegs" aria-hidden="true">
                  {Array.from({ length: rules.length }, (_, k) => (
                    <i key={k} className="peg" data-kind={k < clue.inPlace ? "place" : k < clue.match ? "digit" : "none"} />
                  ))}
                </span>
                <span className="clue__text">{clueText(clue)}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="memo" aria-labelledby="memo-title">
          <div className="memo__head">
            <h2 id="memo-title" className="hand">
              숫자 메모
            </h2>
            <p>누를 때마다 제외, 후보, 지움</p>
          </div>
          <div className="memo__grid">
            {rules.digits.map((digit) => {
              const state = input.memo[String(digit)] ?? "none";
              return (
                <button
                  key={digit}
                  type="button"
                  className="memo__chip hand"
                  data-state={state}
                  data-testid={`memo-${digit}`}
                  aria-label={`숫자 ${digit} 메모: ${MEMO_LABEL[state]}`}
                  disabled={locked}
                  onClick={() => cycleMemo(digit)}
                >
                  {digit}
                  {state === "out" && <PenMark kind="cross" draw />}
                  {state === "maybe" && <PenMark kind="circle" draw />}
                </button>
              );
            })}
          </div>
        </section>
      </article>

      <section
        className="lock"
        data-verdict={verdict}
        data-shaking={shaking}
        aria-label="암호 자물쇠"
        style={{ viewTransitionName: "code-lock" }}
      >
        <Shackle />
        <div className="lock__body">
          <LockPlate />
          <div className="lock__dials">
            <span className="lock__sight" aria-hidden="true" />
            {input.dials.map((value, index) => (
              <Dial
                key={index}
                index={index}
                value={value}
                digits={rules.digits}
                disabled={locked}
                duplicate={isDuplicate(index)}
                onChange={(next) => setDial(index, next)}
              />
            ))}
          </div>
        </div>

        <p className="lock__status" role="status" data-warn={hasDuplicate && verdict === "idle"}>
          {verdict === "correct"
            ? "잠금이 풀렸습니다"
            : hasDuplicate
              ? "같은 숫자가 겹쳐 있습니다. 암호는 서로 다른 숫자 3개입니다."
              : "숫자를 굴리거나 눌러서 맞추세요"}
        </p>
      </section>
    </div>
  );
}
