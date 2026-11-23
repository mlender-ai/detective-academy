import { useEffect, useState } from "react";
import { todayKey } from "../app/clock";
import { goBack, navigate } from "../app/router";
import { playSound } from "../app/sound";
import { useGame } from "../app/store";
import { Sprite } from "../art/pixel";
import { CreditTag } from "../components/CreditReward";
import { DeskWood } from "../components/DeskWood";
import { PUZZLE_BY_ID, dailyOpenOn, getDailyPuzzle, pastDailies } from "../data/puzzles";
import { getProgress } from "../engine/progressEngine";
import { formatElapsed } from "../engine/time";
import type { PuzzleProgress } from "../engine/types";
import { TYPE_NAME } from "../games/logic";
import { CaseSession } from "./CaseSession";
import type { ResultBack } from "./DeskResult";

/** "2026-11-22" → "11월 22일" */
function dateLabel(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

function statusText(progress: PuzzleProgress): string {
  if (progress.status === "solved") return "해결";
  if (progress.status === "in_progress") return `풀이 중 ${formatElapsed(progress.elapsedMs)}`;
  return "미해결";
}

/**
 * 지난 사건: 달력의 첫날부터 오늘까지 게시판에 붙었던 오늘의 추리. 최근 것이 위다.
 * 줄을 누르면 그 사건을 연다: 풀지 못하고 지나간 사건은 지금 풀어도 처음 해결 보상을 한 번 받고,
 * 이미 해결한 사건은 채점 기록을 보고 보상 없이 다시 풀어 볼 수 있다(판정과 보상은 다른 문제와 같은 엔진이다).
 * 새 틀을 만들지 않았다: 추리 책상의 위 막대 · 신분증의 기록부(.ledger) · 연습실의 과제 줄(.isotask)이다.
 */
export function DailyArchive() {
  const game = useGame();
  // 들어선 날의 목록을 붙든다(보는 중에 자정을 넘겨도 줄이 갑자기 늘지 않는다)
  const [today] = useState(todayKey);
  const entries = pastDailies(today).reverse();
  const current = getDailyPuzzle(today);
  const solved = entries.filter((e) => getProgress(game, e.puzzle.id).status === "solved").length;

  const open = (id: string) => {
    playSound("place");
    navigate({ name: "daily-past-play", id });
  };

  return (
    <div className="screen desk inkworld dailypast" data-testid="past-screen" data-today={current ? current.id : ""}>
      <DeskWood />

      <header className="deskbar">
        <button type="button" className="tilebtn" aria-label="뒤로" onClick={() => goBack({ name: "home" })} data-testid="past-back">
          <Sprite name="arrow-left" />
        </button>
        <div className="deskbar__tag leaf">
          <h1 className="deskbar__type">지난 사건</h1>
          <span className="deskbar__timer num" data-testid="past-total">
            해결 {solved}/{entries.length}
          </span>
        </div>
        <CreditTag credits={game.credits} />
      </header>

      <div className="screen__scroll desk__scroll dailypast__scroll">
        <section className="ledger leaf dailypast__ledger" aria-labelledby="past-title">
          <h2 id="past-title" className="ledger__title">
            오늘의 추리 기록
          </h2>
          <p className="ranks__note dailypast__note" data-testid="past-note">
            {!current
              ? "새 사건을 준비하고 있습니다. 그동안 지난 사건을 다시 볼 수 있습니다."
              : "게시판에 붙었던 사건입니다. 풀지 못한 사건은 지금 풀어도 보상을 받습니다."}
          </p>
          {entries.length === 0 ? (
            <p className="isocard__shut" data-testid="past-empty">
              아직 게시판에 붙은 사건이 없습니다.
            </p>
          ) : (
            <ol className="isotasks dailypast__list">
              {entries.map(({ date, puzzle }) => {
                const progress = getProgress(game, puzzle.id);
                const isToday = current?.id === puzzle.id && date === today;
                return (
                  <li key={puzzle.id}>
                    <button
                      type="button"
                      className="isotask"
                      data-status={progress.status}
                      data-testid={`past-file-${puzzle.id}`}
                      aria-label={`${dateLabel(date)}${isToday ? " 오늘" : ""}, ${puzzle.title}, ${TYPE_NAME[puzzle.type]}, ${statusText(progress)}`}
                      onClick={() => open(puzzle.id)}
                    >
                      <span className="isotask__title">{puzzle.title}</span>
                      <span className="isotask__meta">
                        <span>
                          {isToday && <b className="isotask__flag">오늘</b>}
                          <span className="num" data-testid={`past-date-${puzzle.id}`}>
                            {dateLabel(date)}
                          </span>
                          {` · ${TYPE_NAME[puzzle.type]}`}
                        </span>
                        <span className="num" data-testid={`past-status-${puzzle.id}`}>
                          {progress.status === "solved" ? "해결" : progress.status === "in_progress" ? "풀이 중" : `미해결 +${puzzle.reward}`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

const PAST_BACK: ResultBack = { short: "지난 사건", label: "지난 사건으로", route: { name: "daily-past" } };

/**
 * 지난 사건 하나의 풀이. 달력에서 오늘까지 붙었던 문제만 열린다:
 * 아직 오지 않은 날의 문제, 달력에 없는 문제(연습 과제 · 시험 문제), 없는 이름표는 주소로 바로 와도 목록으로 돌려보낸다.
 */
export function PastDailyPlay({ id }: { id: string }) {
  // 들어선 때 열려 있던 문제는 끝까지 붙든다(날짜는 앞으로만 가므로 열렸던 문제가 닫히는 일은 없다)
  const [puzzle] = useState(() => {
    const found = PUZZLE_BY_ID[id];
    return found && found.category === "daily" && dailyOpenOn(found.id, todayKey()) ? found : null;
  });

  useEffect(() => {
    if (!puzzle) navigate({ name: "daily-past" }, { replace: true });
  }, [puzzle]);

  if (!puzzle) return null;
  return <CaseSession puzzle={puzzle} onExit={() => goBack({ name: "daily-past" })} back={PAST_BACK} />;
}
