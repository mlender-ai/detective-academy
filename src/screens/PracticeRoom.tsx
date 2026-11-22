import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { goBack, navigate } from "../app/router";
import { playSound } from "../app/sound";
import { useGame } from "../app/store";
import { RankMark } from "../art/objects";
import { Sprite } from "../art/pixel";
import { DeskWood } from "../components/DeskWood";
import { CreditTag } from "../components/CreditReward";
import { PRACTICE_PUZZLES, PUZZLE_BY_ID, practiceOfRank } from "../data/puzzles";
import { RANK_BY_ID, RANKS, rankIndex, rankLabel } from "../data/ranks";
import { getProgress, practiceUnlocked } from "../engine/progressEngine";
import { formatElapsed } from "../engine/time";
import type { GameState, PuzzleProgress, RankId } from "../engine/types";
import { TYPE_NAME } from "../games/logic";
import { CaseSession } from "./CaseSession";

/** 과제가 든 서랍: 등급마다 하나 (최고 등급에는 연습 과제가 없다) */
const DRAWERS: RankId[] = RANKS.map((r) => r.id).filter((id) => practiceOfRank(id).length > 0);

/** 마지막으로 연 연습 문제. 목록으로 돌아올 때 그 과제지로 접히는 전환을 이어 준다. */
let lastOpenedId: string | null = null;
/** 마지막으로 열어 본 서랍. 문제를 풀고 돌아와도 같은 서랍이 열려 있다. */
let lastDrawer: RankId | null = null;

function sheetStatus(progress: PuzzleProgress): string {
  if (progress.status === "solved") return "해결";
  if (progress.status === "in_progress") return `풀이 중 ${formatElapsed(progress.elapsedMs)}`;
  return "미해결";
}

/** 처음 열어 둘 서랍: 열려 있는 서랍 가운데 풀지 않은 과제가 남은 가장 낮은 등급, 없으면 지금 등급 */
function startDrawer(game: GameState): RankId {
  const open = DRAWERS.filter((rank) => rankIndex(rank) <= rankIndex(game.rank));
  const pending = open.find((rank) => practiceOfRank(rank).some((p) => getProgress(game, p.id).status !== "solved"));
  return pending ?? open[open.length - 1] ?? DRAWERS[0];
}

/**
 * 연습실: 책상 위에 등급별 과제 서랍이 놓여 있다.
 * 지금 등급까지의 서랍은 열려 있고, 그 위의 서랍은 승급해야 열린다. 푼 과제는 언제든 다시 풀어 볼 수 있다.
 */
export function PracticeRoom() {
  const game = useGame();
  const [drawer, setDrawer] = useState<RankId>(() => lastDrawer ?? startDrawer(game));
  const [morphId, setMorphId] = useState(lastOpenedId);
  const solvedTotal = PRACTICE_PUZZLES.filter((p) => getProgress(game, p.id).status === "solved").length;

  const sheets = practiceOfRank(drawer);
  const locked = rankIndex(drawer) > rankIndex(game.rank);
  const solvedHere = sheets.filter((p) => getProgress(game, p.id).status === "solved").length;
  /** 권하는 과제: 이 서랍에서 풀지 않은 첫 과제 */
  const nextId = locked ? null : (sheets.find((p) => getProgress(game, p.id).status !== "solved")?.id ?? null);

  const pick = (rank: RankId) => {
    if (rank === drawer) return;
    lastDrawer = rank;
    setDrawer(rank);
    playSound("tick");
  };

  const open = (id: string) => {
    lastOpenedId = id;
    lastDrawer = drawer;
    // 전환이 시작되기 전에, 펼쳐질 과제지를 먼저 지정해 둔다.
    flushSync(() => setMorphId(id));
    navigate({ name: "practice-play", id });
  };

  return (
    <div className="screen desk inkworld practice" data-testid="practice-room" data-drawer={drawer}>
      <DeskWood />

      <header className="deskbar">
        <button type="button" className="tilebtn" aria-label="뒤로" onClick={() => goBack({ name: "home" })}>
          <Sprite name="arrow-left" />
        </button>
        <div className="deskbar__tag leaf">
          <h1 className="deskbar__type">연습실</h1>
          <span className="deskbar__timer num" data-testid="practice-total">
            해결 {solvedTotal}/{PRACTICE_PUZZLES.length}
          </span>
        </div>
        <CreditTag credits={game.credits} />
      </header>

      <div className="screen__scroll desk__scroll practice__scroll">
        {/* 서랍 이름표: 등급마다 하나. 잠긴 서랍은 반만 찍힌다. */}
        <div className="drawers" role="tablist" aria-label="등급별 과제 서랍">
          {DRAWERS.map((rank) => {
            const shut = rankIndex(rank) > rankIndex(game.rank);
            const done = practiceOfRank(rank).every((p) => getProgress(game, p.id).status === "solved");
            return (
              <button
                key={rank}
                type="button"
                role="tab"
                className="drawers__tab"
                aria-selected={rank === drawer}
                aria-label={`${rank}급 서랍${shut ? ", 잠김" : done ? ", 모두 해결" : ""}`}
                data-locked={shut}
                data-done={done}
                data-testid={`drawer-${rank}`}
                onClick={() => pick(rank)}
              >
                <RankMark rank={rank} />
                <span className="drawers__state" aria-hidden="true">
                  {shut ? "잠김" : done ? "완료" : rank === game.rank ? "지금" : "열림"}
                </span>
              </button>
            );
          })}
        </div>

        <section className="drawer leaf" role="tabpanel" aria-label={`${drawer}급 서랍`} data-locked={locked} key={drawer}>
          <header className="drawer__head">
            <h2 className="drawer__title">{rankLabel(drawer)}</h2>
            <p className="drawer__focus">{RANK_BY_ID[drawer].focus}</p>
            <span className="drawer__count num" data-testid="drawer-count">
              {locked ? "잠김" : `해결 ${solvedHere}/${sheets.length}`}
            </span>
          </header>

          {locked ? (
            <p className="drawer__shut" data-testid="drawer-locked">
              {rankLabel(drawer)}에 오르면 열리는 서랍입니다. 과제 {sheets.length}개가 들어 있습니다.
            </p>
          ) : (
            <ol className="tasklist">
              {sheets.map((puzzle, i) => {
                const progress = getProgress(game, puzzle.id);
                const solved = progress.status === "solved";
                return (
                  <li key={puzzle.id}>
                    <button
                      type="button"
                      className="taskrow"
                      data-status={progress.status}
                      data-primary={puzzle.id === nextId}
                      data-testid={`practice-file-${puzzle.id}`}
                      aria-label={`연습 과제 ${i + 1}, ${puzzle.title}, ${TYPE_NAME[puzzle.type]}, 난이도 5단계 중 ${puzzle.difficulty}단계, ${sheetStatus(progress)}`}
                      style={morphId === puzzle.id ? { viewTransitionName: "exam-sheet" } : undefined}
                      onClick={() => open(puzzle.id)}
                    >
                      <span className="taskrow__top">
                        <span className="taskrow__no">연습 과제 {i + 1}</span>
                        <span className="posting__status" data-testid={`practice-status-${puzzle.id}`}>
                          {sheetStatus(progress)}
                        </span>
                      </span>
                      <span className="taskrow__title">{puzzle.title}</span>
                      <span className="taskrow__meta">
                        <span>{TYPE_NAME[puzzle.type]}</span>
                        <span className="diamonds" aria-hidden="true">
                          {Array.from({ length: 5 }, (_, k) => (
                            <i key={k} data-on={k < puzzle.difficulty} />
                          ))}
                        </span>
                        <span className="num">{solved ? "보상 받음" : `보상 +${puzzle.reward}`}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <p className="desknote leaf practice__note">
          처음 해결한 과제는 크레딧을 받고, 승급 시험의 응시 조건에 들어갑니다. 푼 과제는 보상 없이 다시 풀어 볼 수 있습니다.
        </p>
      </div>
    </div>
  );
}

export function PracticePlay({ id }: { id: string }) {
  const game = useGame();
  const puzzle = PUZZLE_BY_ID[id];
  // 잠긴 서랍의 과제는 주소로 직접 들어와도 열리지 않는다
  const valid = !!puzzle && puzzle.category === "practice" && practiceUnlocked(game, puzzle);

  useEffect(() => {
    if (!valid) navigate({ name: "practice" }, { replace: true });
  }, [valid]);

  if (!valid) return null;
  return <CaseSession puzzle={puzzle} onExit={() => goBack({ name: "practice" })} />;
}
