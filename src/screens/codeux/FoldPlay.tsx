import { useId, type ReactNode } from "react";
import { DeskWood } from "../../components/DeskWood";
import type { SubmitOutcome } from "../../engine/progressEngine";
import type { CodeInput, CodePuzzle } from "../../engine/types";
import { ClueList, ClueStrip, CodeLock, MemoPad, memoSummary, useCodeBoard } from "../../games/CodeBreaker/CodeBreaker";
import type { GameProps } from "../../games/logic";
import { PlayBar, PlayFoot, PlayNotice, PlayOverlays, REACTION_MS } from "../playParts";
import { usePlaySession } from "../usePlaySession";
import { useStored } from "./useStored";

export interface CodePlayProps {
  puzzle: CodePuzzle;
  /** 이미 해결한 문제를 기록·보상 없이 다시 푼다 */
  replay?: boolean;
  onExit: () => void;
  /** 정답 연출이 끝나면 호출된다 */
  onSolved: (outcome: SubmitOutcome) => void;
}

type PanelId = "brief" | "clues" | "memo";

interface FoldProps {
  id: PanelId;
  title: string;
  /** 접혀 있을 때 머리줄 오른쪽에 보이는 한 줄 요약: 안에 무엇이 들어 있는지 알 수 있어야 한다 */
  summary?: ReactNode;
  /** 접혀 있을 때 머리줄 아래에 보이는 것(한 줄에 담기지 않는 요약) */
  peek?: ReactNode;
  /** 펼쳐져 있을 때 머리줄 오른쪽에 보이는 것. 없으면 '접기' */
  aside?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** 접고 펴는 패널 한 칸. 머리줄을 누르면 접히고, 접힌 동안에는 요약이 보인다(요약을 눌러도 펼쳐진다). */
function Fold({ id, title, summary, peek, aside, open, onToggle, children }: FoldProps) {
  const bodyId = useId();
  return (
    <section className="fold" data-open={open} data-testid={`fold-${id}`}>
      <h2 className="fold__h">
        <button type="button" className="fold__head" aria-expanded={open} aria-controls={bodyId} onClick={onToggle} data-testid={`fold-${id}-toggle`}>
          <span className="fold__mark" aria-hidden="true">
            {open ? "▼" : "▶"}
          </span>
          <span className="fold__title">{title}</span>
          {open ? (aside ?? <span className="fold__aside fold__aside--do">접기</span>) : <span className="fold__aside">{summary ?? <span className="fold__aside--do">펼치기</span>}</span>}
        </button>
      </h2>
      {open ? (
        <div id={bodyId} className="fold__body">
          {children}
        </div>
      ) : (
        peek && (
          <div id={bodyId} className="fold__peek" onClick={onToggle}>
            {peek}
          </div>
        )
      )}
    </section>
  );
}

/**
 * 암호 풀이 A안 · 접기·펼치기. ?play=a 로만 열린다 (V3 GATE 03 에서 고르지 않은 안. 걷어내기 전까지 남겨 둔다).
 * 한 화면에서 푼다. 사건·시도 기록·숫자 메모를 접고 펴며, 접어 둔 만큼 자물쇠가 넓어진다.
 * 자물쇠와 제출 단추는 항상 아래에 고정돼 있고, 패널이 길어지면 패널 쪽만 스크롤된다.
 */
export function FoldPlay({ puzzle, replay = false, onExit, onSolved }: CodePlayProps) {
  const session = usePlaySession(puzzle, { replay, reactionMs: REACTION_MS.code, onSolved });
  const input = session.input as CodeInput;
  const board = useCodeBoard({
    input,
    onChange: session.change as GameProps<CodePuzzle, CodeInput>["onChange"],
    verdict: session.verdict,
    wrongCount: session.wrongCount,
  });
  // 처음에는 시도 기록만 펴 둔다. 사건 설명은 한 줄 요약(숫자의 범위와 개수)으로 접어 두고, 필요할 때 편다.
  const [open, setOpen] = useStored<Record<PanelId, boolean>>(`fold:${puzzle.id}`, { brief: false, clues: true, memo: false });
  const toggle = (id: PanelId) => setOpen((now) => ({ ...now, [id]: !now[id] }));

  const { out, maybe } = memoSummary(puzzle, input.memo);
  const { rules } = puzzle;
  const range = `${rules.digits[0]}~${rules.digits[rules.digits.length - 1]}`;

  return (
    <div className="screen desk inkworld foldplay" data-ux="a" data-type="code" data-phase={session.phase} data-testid="play-screen">
      <DeskWood />
      <PlayBar puzzle={puzzle} session={session} variant="case" replay={replay} onExit={onExit} />

      <div className="foldplay__panels">
        <Fold
          id="brief"
          title="사건"
          open={open.brief}
          onToggle={() => toggle("brief")}
          summary={`${range} 가운데 서로 다른 숫자 ${rules.length}개${session.openedHints.length > 0 ? ` · 지원 ${session.openedHints.length}` : ""}`}
        >
          <h1 className="exampaper__title">{puzzle.title}</h1>
          <p className="exampaper__text">{puzzle.description}</p>
          {session.openedHints.map((hint, i) => (
            <p className="exampaper__hint" key={i} data-testid={`brief-hint-${i + 1}`}>
              <b className="hand">수사 지원 {i + 1}</b>
              <span>{hint.text}</span>
            </p>
          ))}
        </Fold>

        <Fold
          id="clues"
          title={`시도 기록 ${rules.clues.length}건`}
          open={open.clues}
          onToggle={() => toggle("clues")}
          peek={<ClueStrip puzzle={puzzle} memo={input.memo} />}
        >
          <ClueList puzzle={puzzle} memo={input.memo} head={false} />
        </Fold>

        <Fold
          id="memo"
          title="숫자 메모"
          open={open.memo}
          onToggle={() => toggle("memo")}
          summary={
            <span data-testid="fold-memo-summary">
              {out.length + maybe.length === 0
                ? "표시한 숫자 없음"
                : [out.length > 0 ? `제외 ${out.join(" ")}` : "", maybe.length > 0 ? `후보 ${maybe.join(" ")}` : ""].filter(Boolean).join(" · ")}
            </span>
          }
        >
          <MemoPad puzzle={puzzle} memo={input.memo} locked={session.locked} onCycle={board.cycleMemo} head={false} />
        </Fold>
      </div>

      <div className="foldplay__stage lockstage">
        <CodeLock puzzle={puzzle} input={input} locked={session.locked} verdict={session.verdict} board={board} />
      </div>

      <PlayNotice puzzle={puzzle} session={session} />
      <PlayFoot puzzle={puzzle} session={session} />
      <PlayOverlays puzzle={puzzle} session={session} variant="case" replay={replay} />
    </div>
  );
}
