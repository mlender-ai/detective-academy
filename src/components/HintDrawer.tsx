import { useEffect, useRef, useState } from "react";
import { playSound } from "../app/sound";
import { gameStore } from "../app/store";
import { canAfford, hintCost } from "../engine/creditEngine";
import type { Puzzle, PuzzleProgress } from "../engine/types";
import { CreditTag } from "./CreditReward";

interface Props {
  puzzle: Puzzle;
  progress: PuzzleProgress;
  credits: number;
  onClose: () => void;
}

const TIER_NAMES = ["접근 방향", "구체적인 추론 도움"];

/** 수사 지원(힌트) 서랍. 두 단계이며 크레딧으로 연다. */
export function HintDrawer({ puzzle, progress, credits, onClose }: Props) {
  const [denied, setDenied] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const open = (tier: number) => {
    const outcome = gameStore.requestHint(puzzle);
    if (outcome.kind === "opened") {
      setDenied(null);
      playSound("place");
    } else if (outcome.kind === "insufficient") {
      setDenied(tier);
    }
  };

  return (
    <>
      <div className="sheet-backdrop sheet-backdrop--paper" onClick={onClose} />
      <section className="sheet hints hints--paper" role="dialog" aria-modal="true" aria-labelledby="hints-title" data-testid="hint-drawer">
        <div className="sheet__head">
          <h2 className="sheet__title" id="hints-title">
            수사 지원
          </h2>
          <CreditTag credits={credits} />
          <button type="button" className="iconbtn" aria-label="수사 지원 닫기" onClick={onClose} ref={closeRef}>
            <span className="pxclose">닫기</span>
          </button>
        </div>

        <div className="sheet__body">
          {puzzle.hints.map((hint, tier) => {
            const opened = tier < progress.hintsUsed;
            const isNext = tier === progress.hintsUsed;
            const cost = hintCost(tier) ?? 0;
            const affordable = canAfford(credits, cost);

            return (
              <article className="hint" key={tier} data-opened={opened} data-testid={`hint-${tier + 1}`}>
                <h3 className="hint__name">
                  <span className="hint__tier num">{tier + 1}</span>
                  {TIER_NAMES[tier] ?? `힌트 ${tier + 1}`}
                </h3>

                {opened ? (
                  <p className="hint__text">{hint.text}</p>
                ) : (
                  <>
                    <button
                      type="button"
                      className="inkbtn inkbtn--sm hint__open"
                      disabled={!isNext || !affordable}
                      onClick={() => open(tier)}
                      data-testid={`hint-${tier + 1}-open`}
                    >
                      <span className="num">{isNext ? `${cost} 크레딧으로 열기` : "앞 단계를 먼저 여세요"}</span>
                    </button>
                    {isNext && (!affordable || denied === tier) && (
                      <p className="hint__short" role="status" data-testid="hint-short">
                        크레딧이 {cost - credits} 모자랍니다. 문제를 해결하면 크레딧을 얻을 수 있습니다.
                      </p>
                    )}
                  </>
                )}
              </article>
            );
          })}
          <p className="hints__note">
            {puzzle.category === "exam"
              ? "힌트를 써도 정답이면 합격합니다. 사용 여부는 기록에 남습니다."
              : "힌트 없이 해결하면 '힌트 미사용' 기록이 남습니다."}
          </p>
        </div>
      </section>
    </>
  );
}
