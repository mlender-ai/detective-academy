import { DeskWood } from "../../components/DeskWood";
import type { SubmitOutcome } from "../../engine/progressEngine";
import type { EvidenceInput, EvidencePuzzle } from "../../engine/types";
import { EvidenceBoard, useEvidenceBoard } from "../../games/EvidenceBoard/EvidenceBoard";
import type { GameProps } from "../../games/logic";
import { HintButton, PlayBar, PlayNotice, PlayOverlays, REACTION_MS, submitText } from "../playParts";
import { usePlaySession } from "../usePlaySession";
import { CaseBrief } from "./CaseBrief";

export interface CasePlayProps<P> {
  puzzle: P;
  /** exam: 승급 시험으로 치른다 */
  variant?: "case" | "exam";
  /** 이미 해결한 문제를 기록·보상 없이 다시 푼다 */
  replay?: boolean;
  onExit: () => void;
  /** 정답 연출이 끝나면 호출된다 */
  onSolved: (outcome: SubmitOutcome) => void;
}

/**
 * 증거 조합. 추리 책상 위의 증거 게시판에서 카드를 두 장씩 맞대어 본다.
 * 아래 주 단추는 집어 든 두 장에 따라 달라진다: 기록끼리면 "두 증거 잇기", 진술과 증거면 "모순으로 제출".
 */
export function EvidencePlay({ puzzle, variant = "case", replay = false, onExit, onSolved }: CasePlayProps<EvidencePuzzle>) {
  const session = usePlaySession(puzzle, { replay, reactionMs: REACTION_MS.evidence, onSolved });
  const input = session.input as EvidenceInput;
  const board = useEvidenceBoard({
    puzzle,
    input,
    onChange: session.change as GameProps<EvidencePuzzle, EvidenceInput>["onChange"],
    locked: session.locked,
  });
  const accusing = board.mode === "accuse" || session.phase === "checking";

  return (
    <div className="screen desk inkworld caseplay" data-variant={variant} data-type="evidence" data-phase={session.phase} data-testid="play-screen">
      <DeskWood />
      <PlayBar puzzle={puzzle} session={session} variant={variant} replay={replay} onExit={onExit} />

      <div className="screen__scroll play__scroll desk__scroll">
        {/* 할 일은 아래 '맞대어 보는 자리'가 비어 있을 때 거기에 적힌다 */}
        <CaseBrief puzzle={puzzle} hints={session.openedHints} description={false} />
        <EvidenceBoard puzzle={puzzle} board={board} locked={session.locked} verdict={session.verdict} wrongCount={session.wrongCount} />
      </div>

      <PlayNotice puzzle={puzzle} session={session} />

      <footer className="deskfoot">
        <HintButton session={session} />
        {accusing ? (
          <button
            type="button"
            className="inkbtn inkbtn--wine deskfoot__submit"
            onClick={session.submit}
            disabled={session.locked}
            data-ready="true"
            data-testid="submit"
          >
            {submitText(puzzle, session)}
          </button>
        ) : (
          <button
            type="button"
            className="inkbtn inkbtn--wine deskfoot__submit"
            onClick={board.link}
            disabled={session.locked}
            data-ready={board.mode === "link"}
            data-testid="link"
          >
            두 증거 잇기
          </button>
        )}
      </footer>

      <PlayOverlays puzzle={puzzle} session={session} variant={variant} replay={replay} />
    </div>
  );
}
