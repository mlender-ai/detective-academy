import { DeskWood } from "../../components/DeskWood";
import type { SpatialInput, SpatialPuzzle } from "../../engine/types";
import type { GameProps } from "../../games/logic";
import { SealMatch } from "../../games/SealMatch/SealMatch";
import { PlayBar, PlayFoot, PlayNotice, PlayOverlays, REACTION_MS } from "../playParts";
import { usePlaySession } from "../usePlaySession";
import { CaseBrief } from "./CaseBrief";
import type { CasePlayProps } from "./EvidencePlay";

/**
 * 인장 대조(공간 추론). 추리 책상 위에 자국이 남은 종이와 도장들이 놓인다.
 * 도장을 집어 돌려 보고, 시험 종이에 찍어 보고, 자국을 낸 도장을 그 방향 그대로 제출한다.
 */
export function SealPlay({ puzzle, variant = "case", replay = false, onExit, onSolved }: CasePlayProps<SpatialPuzzle>) {
  const session = usePlaySession(puzzle, { replay, reactionMs: REACTION_MS.spatial, onSolved });

  return (
    <div className="screen desk inkworld caseplay" data-variant={variant} data-type="spatial" data-phase={session.phase} data-testid="play-screen">
      <DeskWood />
      <PlayBar puzzle={puzzle} session={session} variant={variant} replay={replay} onExit={onExit} />

      <div className="screen__scroll play__scroll desk__scroll">
        <CaseBrief puzzle={puzzle} hints={session.openedHints} />
        <SealMatch
          puzzle={puzzle}
          input={session.input as SpatialInput}
          onChange={session.change as GameProps<SpatialPuzzle, SpatialInput>["onChange"]}
          locked={session.locked}
          verdict={session.verdict}
          wrongCount={session.wrongCount}
        />
      </div>

      <PlayNotice puzzle={puzzle} session={session} />
      <PlayFoot puzzle={puzzle} session={session} />
      <PlayOverlays puzzle={puzzle} session={session} variant={variant} replay={replay} />
    </div>
  );
}
