import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { nextStep } from "../app/flow";
import { goBack, navigate } from "../app/router";
import { useGame } from "../app/store";
import { KeyArt, PencilArt } from "../art/objects";
import { Sprite } from "../art/pixel";
import { DeskWood } from "../components/DeskWood";
import { CreditTag } from "../components/CreditReward";
import { Stamp } from "../components/Stamp";
import { PRACTICE_PUZZLES, PUZZLE_BY_ID } from "../data/puzzles";
import { getProgress } from "../engine/progressEngine";
import { formatElapsed } from "../engine/time";
import type { PuzzleProgress } from "../engine/types";
import { CaseSession } from "./CaseSession";

/** 마지막으로 연 연습 문제. 목록으로 돌아올 때 그 과제지로 접히는 전환을 이어 준다. */
let lastOpenedId: string | null = PRACTICE_PUZZLES[0]?.id ?? null;

function sheetCta(progress: PuzzleProgress): string {
  if (progress.status === "solved") return "채점 기록 보기";
  if (progress.status === "in_progress") return "이어서 풀기";
  return "과제 펼치기";
}

function sheetStatus(progress: PuzzleProgress): string {
  if (progress.status === "solved") return "해결";
  if (progress.status === "in_progress") return `풀이 중 ${formatElapsed(progress.elapsedMs)}`;
  return "미해결";
}

/** 연습실: 책상 위에 연습 과제지가 놓여 있다 */
export function PracticeRoom() {
  const game = useGame();
  const step = nextStep(game);
  const [morphId, setMorphId] = useState(lastOpenedId);
  const solvedCount = PRACTICE_PUZZLES.filter((p) => getProgress(game, p.id).status === "solved").length;

  const open = (id: string) => {
    lastOpenedId = id;
    // 전환이 시작되기 전에, 펼쳐질 과제지를 먼저 지정해 둔다.
    flushSync(() => setMorphId(id));
    navigate({ name: "practice-play", id });
  };

  return (
    <div className="screen desk inkworld practice" data-testid="practice-room">
      <DeskWood />

      <header className="deskbar">
        <button type="button" className="tilebtn" aria-label="뒤로" onClick={() => goBack({ name: "home" })}>
          <Sprite name="arrow-left" />
        </button>
        <div className="deskbar__tag leaf">
          <h1 className="deskbar__type">연습실</h1>
          <span className="deskbar__timer num">
            해결 {solvedCount}/{PRACTICE_PUZZLES.length}
          </span>
        </div>
        <CreditTag credits={game.credits} />
      </header>

      <div className="screen__scroll desk__scroll practice__scroll">
        <p className="desknote leaf">
          유형별 추리 문제로 감각을 다듬는 곳입니다. 처음 해결한 과제는 크레딧을 받고, 승급 시험 응시 조건에도 반영됩니다.
        </p>

        {PRACTICE_PUZZLES.map((puzzle, i) => {
          const progress = getProgress(game, puzzle.id);
          const solved = progress.status === "solved";
          const emphasis = step === "practice" && !solved;
          return (
            <article
              className="worksheet"
              key={puzzle.id}
              data-status={progress.status}
              data-testid="practice-file"
              onClick={() => open(puzzle.id)}
            >
              <span className="worksheet__pile" aria-hidden="true" />
              <div className="worksheet__leaf leaf" style={morphId === puzzle.id ? { viewTransitionName: "exam-sheet" } : undefined}>
                <p className="worksheet__head">
                  <span className="worksheet__no">연습 과제 {i + 1}</span>
                  <span className="posting__status hand" data-testid="practice-file-status">
                    {sheetStatus(progress)}
                  </span>
                </p>
                <h2 className="worksheet__title">{puzzle.title}</h2>
                <p className="worksheet__desc">{puzzle.description}</p>

                <div className="posting__meta">
                  <span>
                    <i>유형</i>
                    <b>{puzzle.typeLabel}</b>
                  </span>
                  <span>
                    <i>난이도</i>
                    <b>
                      <span className="diamonds" role="img" aria-label={`5단계 중 ${puzzle.difficulty}단계`}>
                        {Array.from({ length: 5 }, (_, k) => (
                          <i key={k} data-on={k < puzzle.difficulty} />
                        ))}
                      </span>
                    </b>
                  </span>
                  {solved ? (
                    <span className="posting__sealed">
                      <Stamp className="posting__stamp" label="해결" size={78} />
                    </span>
                  ) : (
                    <span>
                      <i>해결 보상</i>
                      <b className="num">+{puzzle.reward}</b>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className={`inkbtn inkbtn--block ${emphasis ? "inkbtn--wine" : ""}`}
                  data-testid="practice-file-cta"
                  onClick={(event) => {
                    event.stopPropagation();
                    open(puzzle.id);
                  }}
                >
                  {sheetCta(progress)}
                </button>
              </div>
            </article>
          );
        })}

        <div className="practice__props" aria-hidden="true">
          <KeyArt className="practice__key" />
          <PencilArt className="practice__pencil" />
        </div>
      </div>
    </div>
  );
}

export function PracticePlay({ id }: { id: string }) {
  const puzzle = PUZZLE_BY_ID[id];
  const valid = !!puzzle && puzzle.category === "practice";

  useEffect(() => {
    if (!valid) navigate({ name: "practice" }, { replace: true });
  }, [valid]);

  if (!valid) return null;
  return <CaseSession puzzle={puzzle} onExit={() => goBack({ name: "practice" })} />;
}
