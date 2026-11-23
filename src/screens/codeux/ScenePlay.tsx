import { useEffect, useMemo, useRef, useState } from "react";
import { Narration } from "../../components/Narration";
import type { CodeInput, CodePuzzle } from "../../engine/types";
import { ClueList, CodeLock, Engraved, MemoPad, memoSummary, useCodeBoard } from "../../games/CodeBreaker/CodeBreaker";
import type { GameProps } from "../../games/logic";
import { IsoCanvas, type IsoHandle } from "../../iso/IsoCanvas";
import { makeVaultRoom, type VaultSpot } from "../../iso/vaultRoom";
import { HintButton, PlayBar, PlayFoot, PlayNotice, PlayOverlays } from "../playParts";
import { usePlaySession } from "../usePlaySession";
import type { CodePlayProps } from "./types";
import { vaultStory } from "./story";
import { useStored } from "./useStored";

/** 금고가 열리는 모습을 보여 주는 시간. 화면을 누르면 건너뛴다. */
const OPEN_MS = 1700;
/** 들어서서 걷기 시작하기 전의 뜸 */
const ENTRANCE_DELAY_MS = 320;

/**
 * 암호 풀이 · 장면 전개. 암호 해독 문제의 기본 화면이다 (V3 GATE 03 에서 사용자가 고른 B안).
 * 문제 하나가 자료실의 장면들로 펼쳐진다: 자료실에 들어선다 → 책상의 기록을 살핀다 → 금고 앞에서 드럼을 돌린다 → 금고가 열린다.
 * 책상과 금고 사이는 장면의 물건이나 아래 단추를 눌러 언제든 오간다. 다이얼과 메모는 오가도 그대로다.
 * 위쪽의 띠가 자료실(쿼터뷰 방)이다. 서술 한 줄은 방 위쪽의 어둠에 얹는다(화면이 낮으면 방의 윗부분을 띠가 가린다).
 */
export function ScenePlay({ puzzle, variant = "case", replay = false, onExit, onSolved }: CodePlayProps) {
  const session = usePlaySession(puzzle, { replay, reactionMs: OPEN_MS, onSolved });
  const input = session.input as CodeInput;
  const board = useCodeBoard({
    input,
    onChange: session.change as GameProps<CodePuzzle, CodeInput>["onChange"],
    verdict: session.verdict,
    wrongCount: session.wrongCount,
  });
  const story = vaultStory(puzzle);

  const sceneRef = useRef<IsoHandle<VaultSpot>>(null);
  const room = useMemo(() => makeVaultRoom(), []);
  // 마지막에 서 있던 곳을 기억한다: 풀다가 나갔다 와도 금고 앞이었으면 금고 앞에서 잇는다
  const [spot, setSpot] = useStored<VaultSpot>(`scene:${puzzle.id}`, "desk");
  /** 탐정이 실제로 도착했는가 (도착 전에는 들어서는 중이다) */
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => sceneRef.current?.go(spot), ENTRANCE_DELAY_MS);
    return () => window.clearTimeout(id);
    // 들어설 때 한 번만 한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 그곳으로 간다. 화면은 누른 즉시 바뀌고, 탐정은 그 뒤를 따라 걷는다(걷는 중에 다시 누르면 건너뛴다). */
  const walk = (id: VaultSpot) => {
    if (session.locked) return;
    const scene = sceneRef.current;
    if (id === spot && scene?.busy()) {
      scene.skip();
      return;
    }
    setSpot(id);
    scene?.go(id);
  };

  const solved = session.verdict === "correct";
  const { out, maybe } = memoSummary(puzzle, input.memo);
  const line = solved ? story.solved : !arrived && spot === "desk" ? story.arrive : spot === "desk" ? story.desk : story.safe;

  return (
    <div
      className="screen desk inkworld sceneplay"
      data-ux="b"
      data-view="iso"
      data-type="code"
      data-phase={session.phase}
      data-at={spot}
      data-testid="play-screen"
    >
      <PlayBar puzzle={puzzle} session={session} variant={variant} replay={replay} onExit={onExit} />

      <IsoCanvas
        ref={sceneRef}
        scene={room}
        className="vaultscene vaultscene--iso"
        state={{ open: solved, mark: solved ? null : spot === "desk" ? "safe" : "desk" }}
        onArrive={() => setArrived(true)}
        caption={<Narration text={line} />}
      >
        {(["desk", "safe"] as const).map((id) => {
          const [x, y, w, h] = room.hitRect(id);
          return (
            <button
              key={id}
              type="button"
              className="isospot"
              style={{ left: x * 2, top: y * 2, width: w * 2, height: h * 2 }}
              data-on={spot === id}
              aria-label={id === "desk" ? "책상: 시도 기록과 메모" : "금고: 자물쇠"}
              data-testid={`scene-${id}`}
              onClick={() => walk(id)}
            />
          );
        })}
      </IsoCanvas>

      <div className="sceneplay__panel">
        {spot === "desk" ? (
          <article className="exampaper leaf sceneplay__record" data-testid="record">
            <header className="exampaper__head">
              <h1 className="exampaper__title">{puzzle.title}</h1>
              {session.openedHints.map((hint, i) => (
                <p className="exampaper__hint" key={i} data-testid={`brief-hint-${i + 1}`}>
                  <b className="hand">수사 지원 {i + 1}</b>
                  <span>{hint.text}</span>
                </p>
              ))}
            </header>
            <ClueList puzzle={puzzle} memo={input.memo} />
            <MemoPad puzzle={puzzle} memo={input.memo} locked={session.locked} onCycle={board.cycleMemo} />
          </article>
        ) : (
          <div className="sceneplay__safe lockstage" data-engraved={puzzle.rules.conditions?.length ?? 0}>
            {/* 책상에서 적어 온 메모: 금고 앞에서도 내 손에 있다 */}
            <p className="carry" data-testid="carry-memo">
              <b>내 메모</b>
              {out.length + maybe.length === 0 ? (
                <span>표시한 숫자 없음</span>
              ) : (
                <>
                  {out.length > 0 && (
                    <span>
                      제외 <i className="num">{out.join(" ")}</i>
                    </span>
                  )}
                  {maybe.length > 0 && (
                    <span>
                      후보 <i className="num">{maybe.join(" ")}</i>
                    </span>
                  )}
                </>
              )}
            </p>
            {/* 문에 새겨진 글은 금고 앞에서도 보인다 */}
            <Engraved puzzle={puzzle} compact />
            <CodeLock puzzle={puzzle} input={input} locked={session.locked} verdict={session.verdict} board={board} />
          </div>
        )}
      </div>

      <PlayNotice puzzle={puzzle} session={session} />

      {/* 책상 앞에서는 수사 지원을 받고 금고로 간다. 금고 앞에서는 기록을 다시 보러 가거나 제출한다. */}
      {spot === "desk" ? (
        <footer className="deskfoot">
          <HintButton session={session} />
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" onClick={() => walk("safe")} data-testid="to-safe">
            금고 앞으로
          </button>
        </footer>
      ) : (
        <PlayFoot
          puzzle={puzzle}
          session={session}
          lead={
            <button type="button" className="inkbtn deskfoot__hint" onClick={() => walk("desk")} disabled={session.locked} data-testid="to-desk">
              기록 보기
            </button>
          }
        />
      )}

      {/* 사건을 여는 자막 화면 대신, 자료실에 들어서는 장면이 도입이다 */}
      <PlayOverlays puzzle={puzzle} session={session} variant={variant} replay={replay} cine={false} />
    </div>
  );
}
