import { useState, type FormEvent } from "react";
import { todayKey } from "../app/clock";
import { goBack } from "../app/router";
import { playSound } from "../app/sound";
import { gameStore, useGame } from "../app/store";
import { PenMark } from "../art/pixel";
import { RankMark } from "../art/objects";
import { Sprite } from "../art/pixel";
import { DeskWood } from "../components/DeskWood";
import { CreditTag } from "../components/CreditReward";
import { IdCard } from "../components/IdCard";
import { ALL_PUZZLES, PRACTICE_PUZZLES, getDailyPuzzle } from "../data/puzzles";
import { RANKS, nextRank, rankLabel } from "../data/ranks";
import { NICKNAME_MAX, getProgress, solvedCount } from "../engine/progressEngine";
import { dottedDate, formatDuration } from "../engine/time";
import type { PuzzleProgress } from "../engine/types";

function recordLine(progress: PuzzleProgress): string {
  if (progress.status === "solved") {
    const hints = progress.solvedHints ?? 0;
    return [
      formatDuration(progress.solvedElapsedMs ?? 0),
      `제출 ${progress.solvedAttempts ?? 1}회`,
      hints === 0 ? "힌트 미사용" : `힌트 ${hints}단계`,
    ].join(" · ");
  }
  if (progress.status === "in_progress") return `풀이 중 · ${formatDuration(progress.elapsedMs)} 경과`;
  return "아직 풀지 않았습니다";
}

/** 탐정 신분증: 책상 위에 신분증과 학생 기록부가 놓여 있다 */
export function DetectiveProfile() {
  const game = useGame();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(game.nickname);
  const rankIndex = RANKS.findIndex((r) => r.id === game.rank);
  const upcoming = nextRank(game.rank);
  const lastPromotion = game.promotions[game.promotions.length - 1] ?? null;
  const issuedAt = lastPromotion?.at ?? game.enrolledAt;
  const daily = getDailyPuzzle(todayKey());
  const dailyProgress = getProgress(game, daily.id);
  const dailySolved = solvedCount(game, "daily");
  const practiceSolved = solvedCount(game, "practice");
  // 가장 최근에 해결한 연습 과제
  const lastPractice =
    ALL_PUZZLES.filter((p) => p.category === "practice" && getProgress(game, p.id).solvedAt)
      .sort((x, y) => (getProgress(game, y.id).solvedAt ?? "").localeCompare(getProgress(game, x.id).solvedAt ?? ""))[0] ?? null;

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (draft.trim()) gameStore.rename(draft);
    setEditing(false);
  };

  const toggleSound = () => {
    const on = !game.settings.sound;
    gameStore.setSound(on);
    if (on) playSound("success");
  };

  return (
    <div className="screen desk inkworld profile" data-testid="profile-screen">
      <DeskWood />

      <header className="deskbar">
        <button type="button" className="tilebtn" aria-label="뒤로" onClick={() => goBack({ name: "home" })}>
          <Sprite name="arrow-left" />
        </button>
        <div className="deskbar__tag leaf">
          <h1 className="deskbar__type">탐정 신분증</h1>
        </div>
        <CreditTag credits={game.credits} />
      </header>

      <div className="screen__scroll desk__scroll profile__scroll">
        <div className="profile__card">
          <IdCard nickname={game.nickname} rank={game.rank} detectiveNo={game.detectiveNo} issuedAt={issuedAt} />
        </div>

        {editing ? (
          <form className="rename leaf" onSubmit={save}>
            <label className="rename__field">
              <span className="rename__label">새 이름</span>
              <input
                type="text"
                className="hand"
                value={draft}
                maxLength={NICKNAME_MAX}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="done"
                data-testid="rename-input"
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
            <button type="submit" className="inkbtn inkbtn--sm inkbtn--wine" data-testid="rename-save">
              저장
            </button>
            <button type="button" className="minibtn" onClick={() => setEditing(false)}>
              취소
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="minibtn leaf profile__rename"
            onClick={() => {
              setDraft(game.nickname);
              setEditing(true);
            }}
            data-testid="rename"
          >
            이름 고쳐 쓰기
          </button>
        )}

        <section className="ledger leaf" aria-labelledby="ranks-title">
          <h2 id="ranks-title" className="ledger__title">
            탐정 등급
          </h2>
          <ol className="ranks__ladder">
            {RANKS.map((rank, i) => {
              const state = i < rankIndex ? "past" : i === rankIndex ? "current" : "locked";
              return (
                <li key={rank.id} data-state={state}>
                  <span className="ranks__mark">
                    <RankMark rank={rank.id} />
                    {state === "current" && <PenMark kind="circle" />}
                  </span>
                  <span className="ranks__id">{rank.id}급</span>
                  <span className="sr-only">
                    {rank.title}
                    {state === "current" ? " (현재 등급)" : state === "past" ? " (지나온 등급)" : " (미획득)"}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="ranks__note" data-testid="rank-note">
            현재 {rankLabel(game.rank)}
            {upcoming ? ` · 다음은 ${rankLabel(upcoming)}` : " · 최고 등급입니다"}
          </p>
        </section>

        <section className="ledger ledger--records leaf" aria-labelledby="records-title">
          <h2 id="records-title" className="ledger__title">
            수사 기록
          </h2>
          <ul className="records">
            <li data-status={dailyProgress.status} data-testid="record-daily">
              <span className="tickbox" aria-hidden="true">
                {dailyProgress.status === "solved" && <PenMark kind="check" />}
              </span>
              <span className="records__cat">오늘의 추리 · 지금까지 {dailySolved}개 해결</span>
              <span className="records__title">{daily.title}</span>
              <span className="records__line hand num">{recordLine(dailyProgress)}</span>
            </li>
            <li data-status={practiceSolved > 0 ? "solved" : "new"} data-testid="record-practice">
              <span className="tickbox" aria-hidden="true">
                {practiceSolved > 0 && <PenMark kind="check" />}
              </span>
              <span className="records__cat">연습실</span>
              <span className="records__title">
                과제 {practiceSolved}/{PRACTICE_PUZZLES.length} 해결
              </span>
              <span className="records__line hand num">{lastPractice ? `마지막으로 푼 과제 · ${lastPractice.title}` : "아직 풀지 않았습니다"}</span>
            </li>
            <li data-status={lastPromotion ? "solved" : game.exam ? "in_progress" : "new"} data-testid="record-exam">
              <span className="tickbox" aria-hidden="true">
                {lastPromotion && <PenMark kind="check" />}
              </span>
              <span className="records__cat">승급 시험</span>
              <span className="records__title">
                {lastPromotion ? `${lastPromotion.to}급 승급 시험 합격` : upcoming ? `${upcoming}급 승급 시험` : "승급 시험"}
              </span>
              <span className="records__line hand num">
                {lastPromotion ? `${dottedDate(lastPromotion.at)} · 승급 ${game.promotions.length}번` : game.exam ? "시험을 치르는 중입니다" : "아직 치르지 않았습니다"}
              </span>
            </li>
          </ul>
        </section>

        <button
          type="button"
          className="soundswitch leaf"
          role="switch"
          aria-checked={game.settings.sound}
          onClick={toggleSound}
          data-testid="sound-toggle"
        >
          <span className="soundswitch__text">
            <span>효과음</span>
            <small>{game.settings.sound ? "켜짐" : "꺼짐 (기본)"}</small>
          </span>
          <span className="tickbox" aria-hidden="true">
            {game.settings.sound && <PenMark kind="check" />}
          </span>
        </button>
      </div>
    </div>
  );
}
