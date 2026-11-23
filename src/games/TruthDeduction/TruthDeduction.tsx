import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { motionMs } from "../../app/motion";
import { playSound } from "../../app/sound";
import { PenMark } from "../../art/pixel";
import { Pushpin } from "../../art/objects";
import { Portrait } from "../../art/portraits";
import { truthValues } from "../../engine/puzzleValidator";
import type { TruthClaim, TruthInput, TruthPuzzle } from "../../engine/types";
import { countWord, josa, type GameProps } from "../logic";

/** 진술이 하나씩 밝혀지는 간격 */
export const TRUTH_REVEAL_STEP_MS = 300;

/** 진술이 입에 올린 사람. 남의 말을 가리키는 진술이면 그 사람이다. */
function mentionedIn(claim: TruthClaim): string[] {
  return claim.kind === "culpritAmong" ? claim.who : [claim.who];
}

interface Props extends GameProps<TruthPuzzle, TruthInput> {
  /** 시험지 머리(제목·문제·수사 지원). 책상 화면이 넘겨준다. */
  brief?: ReactNode;
}

/**
 * 진술 추리. 시험지에 붙은 학생 사진에서 한 명을 골라 가정하고,
 * 책상에 늘어놓은 진술서마다 참·거짓을 빨간 펜으로 표시한다.
 */
export function TruthDeduction({ puzzle, input, onChange, locked, verdict, wrongCount, brief }: Props) {
  const { people, statements } = puzzle.rules;
  const personById = Object.fromEntries(people.map((p) => [p.id, p]));
  const suspect = input.suspect ? personById[input.suspect] : null;
  const memo = suspect ? (input.memos[suspect.id] ?? {}) : {};

  // 정답을 맞힌 뒤에만 실제 참/거짓을 계산해 차례로 보여 준다.
  const [revealed, setRevealed] = useState(0);
  const actual = verdict === "correct" ? truthValues(puzzle.rules, puzzle.solution) : null;

  useEffect(() => {
    if (verdict !== "correct") {
      setRevealed(0);
      return;
    }
    const step = motionMs(TRUTH_REVEAL_STEP_MS);
    if (step === 0) {
      setRevealed(statements.length);
      return;
    }
    const timers = statements.map((_, i) =>
      window.setTimeout(() => {
        setRevealed(i + 1);
        playSound("stamp");
      }, step * (i + 1)),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [verdict, statements]);

  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    if (wrongCount === 0) return;
    setShaking(true);
    const id = window.setTimeout(() => setShaking(false), 460);
    return () => window.clearTimeout(id);
  }, [wrongCount]);

  const selectSuspect = (id: string) => {
    if (locked) return;
    onChange((previous) => ({ ...previous, suspect: previous.suspect === id ? null : id }));
    playSound("tick");
  };

  const setMemo = (speaker: string, value: boolean) => {
    if (locked) return;
    onChange((previous) => {
      if (!previous.suspect) return previous;
      const current = { ...(previous.memos[previous.suspect] ?? {}) };
      if (current[speaker] === value) delete current[speaker];
      else current[speaker] = value;
      return { ...previous, memos: { ...previous.memos, [previous.suspect]: current } };
    });
  };

  const togglePin = (speaker: string) => {
    if (locked) return;
    onChange((previous) => ({
      ...previous,
      pinned: previous.pinned.includes(speaker)
        ? previous.pinned.filter((s) => s !== speaker)
        : [...previous.pinned, speaker].slice(-2),
    }));
  };

  const mentioned = new Set(
    statements.filter((s) => input.pinned.includes(s.speaker)).flatMap((s) => mentionedIn(s.claim)),
  );
  const comparing = input.pinned.length > 0 && verdict !== "correct";

  return (
    <div className="truth">
      <article className="exampaper leaf" style={{ viewTransitionName: "exam-sheet" }}>
        {brief}

        <section className="suspects" data-shaking={shaking} aria-labelledby="suspects-title">
          <h2 id="suspects-title" className="hand">
            누가 숨겼다고 가정할까요?
          </h2>
          <div className="suspects__rail" role="radiogroup" aria-labelledby="suspects-title" style={{ "--cols": people.length } as CSSProperties}>
            {people.map((person) => {
              const marks = Object.values(input.memos[person.id] ?? {});
              const trueCount = marks.filter((v) => v).length;
              const falseCount = marks.length - trueCount;
              const selected = input.suspect === person.id;
              const culprit = verdict === "correct" && puzzle.solution === person.id;
              return (
                <button
                  key={person.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className="suspect"
                  data-selected={selected}
                  data-mentioned={comparing && mentioned.has(person.id)}
                  data-culprit={culprit}
                  data-testid={`suspect-${person.id}`}
                  disabled={locked}
                  onClick={() => selectSuspect(person.id)}
                >
                  <span className="suspect__photo">
                    <Portrait person={person} />
                    {(selected || culprit) && <PenMark kind="circle" draw />}
                  </span>
                  <span className="suspect__name">{person.name}</span>
                  <span className="suspect__memo num">
                    {culprit ? "숨긴 사람" : marks.length === 0 ? "메모 없음" : `참 ${trueCount} · 거짓 ${falseCount}`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </article>

      <section className="statements" aria-labelledby="statements-title">
        <h2 id="statements-title" className="truth__prompt leaf" data-testid="truth-prompt">
          {verdict === "correct" ? (
            puzzle.rules.trueCount === 1
              ? `${countWord(statements.length)} 진술 가운데 참은 하나뿐이었습니다`
              : `${countWord(statements.length)} 진술 가운데 참은 ${puzzle.rules.trueCount}개뿐이었습니다`
          ) : suspect ? (
            <>
              <b className="truth__who">{suspect.name}</b>
              {josa(suspect.name, "이", "가")} 숨겼다면, 각 진술은 참일까요 거짓일까요?
            </>
          ) : (
            "위에서 한 명을 고르면 진술마다 참·거짓을 메모할 수 있습니다"
          )}
        </h2>
        <ol className="statements__list">
          {statements.map((statement, i) => {
            const speaker = personById[statement.speaker];
            const pinned = input.pinned.includes(statement.speaker);
            const mark = memo[statement.speaker];
            const shown = actual && i < revealed ? actual[i] : null;
            return (
              <li
                key={statement.speaker}
                className="statement leaf"
                data-pinned={pinned && verdict !== "correct"}
                data-dim={comparing && !pinned}
                data-result={shown === null ? "none" : shown ? "true" : "false"}
                data-testid={`statement-${statement.speaker}`}
              >
                {pinned && verdict !== "correct" && <Pushpin className="statement__pin" />}
                <button
                  type="button"
                  className="statement__main"
                  aria-pressed={pinned}
                  aria-label={`${speaker.name}의 진술: ${statement.text} 비교하려면 누르세요`}
                  disabled={locked}
                  onClick={() => togglePin(statement.speaker)}
                >
                  <span className="statement__photo">
                    <Portrait person={speaker} />
                  </span>
                  <span className="statement__body">
                    <span className="statement__who">{speaker.name}</span>
                    <span className="statement__quote">“{statement.text}”</span>
                  </span>
                </button>

                {shown === null ? (
                  <div className="statement__memo" role="group" aria-label={`${speaker.name}의 진술 메모`}>
                    <button
                      type="button"
                      aria-pressed={mark === true}
                      data-value="true"
                      data-testid={`memo-${statement.speaker}-true`}
                      disabled={!suspect || locked}
                      onClick={() => setMemo(statement.speaker, true)}
                    >
                      참{mark === true && <PenMark kind="circle" draw />}
                    </button>
                    <button
                      type="button"
                      aria-pressed={mark === false}
                      data-value="false"
                      data-testid={`memo-${statement.speaker}-false`}
                      disabled={!suspect || locked}
                      onClick={() => setMemo(statement.speaker, false)}
                    >
                      거짓{mark === false && <PenMark kind="cross" draw />}
                    </button>
                  </div>
                ) : (
                  <span className="statement__verdict" data-true={shown}>
                    {shown ? "참" : "거짓"}
                    <PenMark kind={shown ? "circle" : "cross"} draw />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {verdict !== "correct" && <p className="statements__tip leaf">진술서를 누르면 두 장까지 골라 나란히 비교할 수 있습니다.</p>}
      </section>
    </div>
  );
}
