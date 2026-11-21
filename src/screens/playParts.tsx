import type { ReactNode } from "react";
import { Sprite } from "../art/pixel";
import { CineCard } from "../components/CineCard";
import { CreditTag } from "../components/CreditReward";
import { HintDrawer } from "../components/HintDrawer";
import { formatElapsed } from "../engine/time";
import type { Puzzle } from "../engine/types";
import { submitLabel } from "../games/logic";
import { TRUTH_REVEAL_STEP_MS } from "../games/TruthDeduction/TruthDeduction";
import { WRONG_TEXT, type usePlaySession } from "./usePlaySession";

/**
 * 풀이 화면의 공통 부품: 위 막대, 오답 쪽지, 아래 단추 줄, 그 위에 뜨는 것들(건너뛰기·수사 지원 서랍·자막 화면).
 * 화면 구성이 달라도 판정과 힌트, 시간 기록은 한 가지다(usePlaySession).
 */

export type PlaySession = ReturnType<typeof usePlaySession>;

/** 정답 직후 퍼즐이 반응하는 시간. 화면을 누르면 건너뛴다. */
export const REACTION_MS: Record<Puzzle["type"], number> = {
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

export function submitText(puzzle: Puzzle, session: PlaySession): string {
  return session.phase === "checking" ? CHECKING_LABEL[puzzle.type] : submitLabel(puzzle, session.input);
}

interface BarProps {
  puzzle: Puzzle;
  session: PlaySession;
  variant: "case" | "exam";
  replay: boolean;
  onExit: () => void;
}

export function PlayBar({ puzzle, session, variant, replay, onExit }: BarProps) {
  const { progress, game } = session;
  return (
    <header className="deskbar">
      <button type="button" className="tilebtn" aria-label="뒤로" onClick={onExit} data-testid="play-back">
        <Sprite name="arrow-left" />
      </button>
      <p className="deskbar__tag leaf">
        <span className="deskbar__type">{variant === "exam" ? "승급 시험" : `${replay ? "다시 풀기 · " : ""}${puzzle.typeLabel}`}</span>
        {!replay && (
          <span className="deskbar__timer num" data-testid="timer" aria-label={`경과 시간 ${formatElapsed(progress.elapsedMs)}`}>
            {formatElapsed(progress.elapsedMs)}
          </span>
        )}
      </p>
      <CreditTag credits={game.credits} />
    </header>
  );
}

/** 오답이거나 아직 제출할 수 없을 때 뜨는 쪽지 */
export function PlayNotice({ puzzle, session }: { puzzle: Puzzle; session: PlaySession }) {
  const { notice, phase, wrongCount, hintsLeft, setHintsOpen } = session;
  if (!notice || phase !== "playing") return null;
  return (
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
  );
}

interface FootProps {
  puzzle: Puzzle;
  session: PlaySession;
  /** 수사 지원 단추 자리에 대신 놓을 것 (없으면 수사 지원 단추) */
  lead?: ReactNode;
}

/** 수사 지원 단추: 남은 힌트 수가 붙는다 */
export function HintButton({ session }: { session: PlaySession }) {
  const { setHintsOpen, locked, hintsLeft } = session;
  return (
    <button type="button" className="inkbtn deskfoot__hint" onClick={() => setHintsOpen(true)} disabled={locked} data-testid="hint-button">
      수사 지원
      <span className="deskfoot__count num" aria-label={`남은 힌트 ${hintsLeft}개`}>
        {hintsLeft}
      </span>
    </button>
  );
}

/** 아래 단추 줄: 수사 지원, 제출 */
export function PlayFoot({ puzzle, session, lead }: FootProps) {
  const { locked, submit, ready } = session;
  const text = submitText(puzzle, session);
  return (
    <footer className="deskfoot">
      {lead ?? <HintButton session={session} />}
      <button
        type="button"
        className="inkbtn inkbtn--wine deskfoot__submit"
        onClick={submit}
        disabled={locked}
        data-ready={ready.ok}
        data-long={text.length > 7}
        data-testid="submit"
      >
        {text}
      </button>
    </footer>
  );
}

interface OverProps {
  puzzle: Puzzle;
  session: PlaySession;
  variant: "case" | "exam";
  replay: boolean;
  /** 사건을 열 때의 자막 화면을 띄울지. 자기 도입 장면이 있는 화면은 끈다. */
  cine?: boolean;
}

/** 화면 위에 뜨는 것들: 정답 연출 건너뛰기, 수사 지원 서랍, 사건을 열 때의 자막 화면 */
export function PlayOverlays({ puzzle, session, variant, replay, cine = true }: OverProps) {
  const { phase, finish, hintsOpen, setHintsOpen, progress, game } = session;
  return (
    <>
      {phase === "checking" && (
        <button type="button" className="desk__skip" onClick={finish} data-testid="skip-reaction">
          <span className="sr-only">화면을 누르면 바로 넘어갑니다</span>
        </button>
      )}

      {hintsOpen && phase === "playing" && (
        <HintDrawer puzzle={puzzle} progress={progress} credits={game.credits} onClose={() => setHintsOpen(false)} />
      )}

      {cine && <CineCard kicker={variant === "exam" ? "승급 시험" : replay ? "다시 풀기" : "사건 기록"} title={puzzle.title} sub={puzzle.typeLabel} />}
    </>
  );
}
