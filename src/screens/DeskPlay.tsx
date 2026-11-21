import type { ReactNode } from "react";
import { CineCard } from "../components/CineCard";
import { DeskWood } from "../components/DeskWood";
import { CreditTag } from "../components/CreditReward";
import { HintDrawer } from "../components/HintDrawer";
import { Sprite } from "../art/pixel";
import type { SubmitOutcome } from "../engine/progressEngine";
import { formatElapsed } from "../engine/time";
import type { CodeInput, CodePuzzle, Puzzle, ScheduleInput, SchedulePuzzle, TruthInput, TruthPuzzle } from "../engine/types";
import { CodeBreaker } from "../games/CodeBreaker/CodeBreaker";
import { submitLabel, type GameProps } from "../games/logic";
import { SchedulePuzzleGame } from "../games/SchedulePuzzle/SchedulePuzzle";
import { TRUTH_REVEAL_STEP_MS, TruthDeduction } from "../games/TruthDeduction/TruthDeduction";
import { usePlaySession, WRONG_TEXT } from "./usePlaySession";

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

/** 정답 직후 퍼즐이 반응하는 시간. 화면을 누르면 건너뛴다. */
const REACTION_MS: Record<Puzzle["type"], number> = {
  code: 1050,
  truth: TRUTH_REVEAL_STEP_MS * 4 + 700,
  schedule: 1200,
};

const WRONG_TITLE: Record<Puzzle["type"], string> = {
  code: "잠금이 풀리지 않았습니다",
  truth: "추론이 맞지 않습니다",
  schedule: "추론이 맞지 않습니다",
};

const CHECKING_LABEL: Record<Puzzle["type"], string> = {
  code: "잠금 해제",
  truth: "추론 확인 완료",
  schedule: "추론 확인 완료",
};

/**
 * 추리 책상. 게시판이나 연습실에서 가져온 시험지가 책상 위에 놓이고,
 * 그 아래에서 자물쇠를 굴리거나 진술서를 살피거나 이름표를 옮긴다.
 */
export function DeskPlay({ puzzle, variant = "case", replay = false, onExit, onSolved }: Props) {
  const {
    game,
    progress,
    input,
    phase,
    wrongCount,
    notice,
    hintsOpen,
    setHintsOpen,
    change,
    submit,
    finish,
    locked,
    verdict,
    hintsLeft,
    openedHints,
    ready,
  } = usePlaySession(puzzle, { replay, reactionMs: REACTION_MS[puzzle.type], onSolved });

  const submitText = phase === "checking" ? CHECKING_LABEL[puzzle.type] : submitLabel(puzzle, input);

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

      <header className="deskbar">
        <button type="button" className="tilebtn" aria-label="뒤로" onClick={onExit} data-testid="play-back">
          <Sprite name="arrow-left" />
        </button>
        <p className="deskbar__tag leaf">
          <span className="deskbar__type">
            {variant === "exam" ? "승급 시험" : `${replay ? "다시 풀기 · " : ""}${puzzle.typeLabel}`}
          </span>
          {!replay && (
            <span className="deskbar__timer num" data-testid="timer" aria-label={`경과 시간 ${formatElapsed(progress.elapsedMs)}`}>
              {formatElapsed(progress.elapsedMs)}
            </span>
          )}
        </p>
        <CreditTag credits={game.credits} />
      </header>

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

      {notice && phase === "playing" && (
        <div className="desk__notice" key={notice.kind === "wrong" ? `wrong-${wrongCount}` : "invalid"}>
          {notice.kind === "invalid" ? (
            <div className="slip leaf" role="status" data-testid="notice-invalid">
              <p>{notice.text}</p>
            </div>
          ) : (
            <div className="slip slip--wrong leaf" role="alert" data-testid="notice-wrong">
              <strong>{WRONG_TITLE[puzzle.type]}</strong>
              <p>{WRONG_TEXT[puzzle.type]}</p>
              {wrongCount >= 2 && hintsLeft > 0 && (
                <button type="button" className="slip__action" onClick={() => setHintsOpen(true)}>
                  수사 지원을 받아 볼까요?
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <footer className="deskfoot">
        <button
          type="button"
          className="inkbtn deskfoot__hint"
          onClick={() => setHintsOpen(true)}
          disabled={locked}
          data-testid="hint-button"
        >
          수사 지원
          <span className="deskfoot__count num" aria-label={`남은 힌트 ${hintsLeft}개`}>
            {hintsLeft}
          </span>
        </button>
        <button
          type="button"
          className="inkbtn inkbtn--wine deskfoot__submit"
          onClick={submit}
          disabled={locked}
          data-ready={ready.ok}
          data-long={submitText.length > 7}
          data-testid="submit"
        >
          {submitText}
        </button>
      </footer>

      {phase === "checking" && (
        <button type="button" className="desk__skip" onClick={finish} data-testid="skip-reaction">
          <span className="sr-only">화면을 누르면 바로 넘어갑니다</span>
        </button>
      )}

      {hintsOpen && phase === "playing" && (
        <HintDrawer puzzle={puzzle} progress={progress} credits={game.credits} onClose={() => setHintsOpen(false)} />
      )}

      <CineCard kicker={variant === "exam" ? "승급 시험" : replay ? "다시 풀기" : "사건 기록"} title={puzzle.title} sub={puzzle.typeLabel} />
    </div>
  );
}
