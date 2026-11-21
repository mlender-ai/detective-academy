import type { ReactNode } from "react";
import { DeskWood } from "../components/DeskWood";
import type { SubmitOutcome } from "../engine/progressEngine";
import type { CodeInput, CodePuzzle, Puzzle, ScheduleInput, SchedulePuzzle, TruthInput, TruthPuzzle } from "../engine/types";
import { CodeBreaker } from "../games/CodeBreaker/CodeBreaker";
import type { GameProps } from "../games/logic";
import { SchedulePuzzleGame } from "../games/SchedulePuzzle/SchedulePuzzle";
import { TruthDeduction } from "../games/TruthDeduction/TruthDeduction";
import { PlayBar, PlayFoot, PlayNotice, PlayOverlays, REACTION_MS } from "./playParts";
import { usePlaySession } from "./usePlaySession";

interface Props {
  puzzle: Puzzle;
  /** exam: 시험실 책상(녹색 깔개)에서 치르는 승급 시험 */
  variant?: "case" | "exam";
  /** 이미 해결한 문제를 기록·보상 없이 다시 푼다 */
  replay?: boolean;
  onExit: () => void;
  /** 정답 연출이 끝나면 호출된다 */
  onSolved: (outcome: SubmitOutcome) => void;
}

/**
 * 추리 책상. 게시판이나 연습실에서 가져온 시험지가 책상 위에 놓이고,
 * 그 아래에서 자물쇠를 굴리거나 진술서를 살피거나 이름표를 옮긴다.
 */
export function DeskPlay({ puzzle, variant = "case", replay = false, onExit, onSolved }: Props) {
  const session = usePlaySession(puzzle, { replay, reactionMs: REACTION_MS[puzzle.type], onSolved });
  const { input, phase, wrongCount, change, locked, verdict, openedHints } = session;

  const brief: ReactNode = (
    <header className="exampaper__head">
      <h1 className="exampaper__title">{puzzle.title}</h1>
      <p className="exampaper__text">{puzzle.description}</p>
      {openedHints.map((hint, i) => (
        <p className="exampaper__hint" key={i} data-testid={`brief-hint-${i + 1}`}>
          <b className="hand">수사 지원 {i + 1}</b>
          <span>{hint.text}</span>
        </p>
      ))}
    </header>
  );

  return (
    <div className="screen desk inkworld" data-variant={variant} data-type={puzzle.type} data-phase={phase} data-testid="play-screen">
      <DeskWood />
      {variant === "exam" && <span className="desk__blotter" aria-hidden="true" />}

      <PlayBar puzzle={puzzle} session={session} variant={variant} replay={replay} onExit={onExit} />

      <div className="screen__scroll play__scroll desk__scroll">
        {puzzle.type === "code" && (
          <CodeBreaker
            puzzle={puzzle}
            input={input as CodeInput}
            onChange={change as GameProps<CodePuzzle, CodeInput>["onChange"]}
            locked={locked}
            verdict={verdict}
            wrongCount={wrongCount}
            brief={brief}
          />
        )}
        {puzzle.type === "truth" && (
          <TruthDeduction
            puzzle={puzzle}
            input={input as TruthInput}
            onChange={change as GameProps<TruthPuzzle, TruthInput>["onChange"]}
            locked={locked}
            verdict={verdict}
            wrongCount={wrongCount}
            brief={brief}
          />
        )}
        {puzzle.type === "schedule" && (
          <SchedulePuzzleGame
            puzzle={puzzle}
            input={input as ScheduleInput}
            onChange={change as GameProps<SchedulePuzzle, ScheduleInput>["onChange"]}
            locked={locked}
            verdict={verdict}
            wrongCount={wrongCount}
            brief={brief}
          />
        )}
      </div>

      <PlayNotice puzzle={puzzle} session={session} />
      <PlayFoot puzzle={puzzle} session={session} />
      <PlayOverlays puzzle={puzzle} session={session} variant={variant} replay={replay} />
    </div>
  );
}
