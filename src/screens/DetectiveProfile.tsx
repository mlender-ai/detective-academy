import { useState, type FormEvent } from "react";
import { goBack } from "../app/router";
import { playSound } from "../app/sound";
import { gameStore, useGame } from "../app/store";
import { PenMark } from "../art/pixel";
import { RankMark } from "../art/objects";
import { Sprite } from "../art/pixel";
import { DeskWood } from "../components/DeskWood";
import { CreditTag } from "../components/CreditReward";
import { IdCard } from "../components/IdCard";
import { PUZZLES } from "../data/puzzles";
import { RANKS, nextRank, rankLabel } from "../data/ranks";
import { NICKNAME_MAX, getProgress } from "../engine/progressEngine";
import { formatDuration } from "../engine/time";
import type { PuzzleCategory, PuzzleProgress } from "../engine/types";

const CATEGORY_LABEL: Record<PuzzleCategory, string> = {
  daily: "오늘의 추리",
  practice: "연습실",
  exam: "승급 시험",
};

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
  const issuedAt = game.promotions[game.promotions.length - 1]?.at ?? game.enrolledAt;

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
            {PUZZLES.map((puzzle) => {
              const progress = getProgress(game, puzzle.id);
              return (
                <li key={puzzle.id} data-status={progress.status} data-testid={`record-${puzzle.category}`}>
                  <span className="tickbox" aria-hidden="true">
                    {progress.status === "solved" && <PenMark kind="check" />}
                  </span>
                  <span className="records__cat">{CATEGORY_LABEL[puzzle.category]}</span>
                  <span className="records__title">{puzzle.title}</span>
                  <span className="records__line hand num">{recordLine(progress)}</span>
                </li>
              );
            })}
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
