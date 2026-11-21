import { useEffect, useState } from "react";
import { motionMs, useSequence } from "../app/motion";
import { goBack, navigate } from "../app/router";
import { playSound } from "../app/sound";
import { gameStore, useGame } from "../app/store";
import { EXAMROOM } from "../app/backdrop";
import { PenMark, Sprite } from "../art/pixel";
import { RankMedal } from "../art/objects";
import { ExamEnvelope } from "../components/ExamEnvelope";
import { IdCard } from "../components/IdCard";
import { Stamp } from "../components/Stamp";
import { PUZZLE_BY_ID } from "../data/puzzles";
import { PROMOTION_RULES, RANK_BY_ID, rankLabel, type PromotionRule } from "../data/ranks";
import { examStatus, getProgress, type SubmitOutcome } from "../engine/progressEngine";
import type { GameState, Puzzle, RankId } from "../engine/types";
import { DeskPlay } from "./DeskPlay";
import { GradedExplain, GradedFacts, Reward } from "./DeskResult";

const ENVELOPE_OPEN_MS = 900;

/** 지금 치를 시험, 없으면 가장 최근에 통과한 시험 */
function currentRule(game: GameState): PromotionRule | null {
  return (
    PROMOTION_RULES.find((r) => r.from === game.rank) ??
    PROMOTION_RULES.find((r) => r.to === game.rank) ??
    null
  );
}

/* ───────── 시험실 ───────── */

/** 응시자 자리에서 올려다본 시험실. 아래쪽은 책상에 가려진다. */
function RoomScene() {
  return (
    <>
      <div className="room__scene" aria-hidden="true">
        <img src={EXAMROOM.src} alt="" width={EXAMROOM.width} height={EXAMROOM.height} decoding="async" />
      </div>
      <span className="room__wood" aria-hidden="true" />
    </>
  );
}

function RoomBar({ title, note }: { title: string; note?: string }) {
  return (
    <header className="deskbar">
      <button type="button" className="tilebtn" aria-label="뒤로" onClick={() => goBack({ name: "home" })}>
        <Sprite name="arrow-left" />
      </button>
      <div className="deskbar__tag leaf">
        <h1 className="deskbar__type">{title}</h1>
        {note && <span className="deskbar__timer">{note}</span>}
      </div>
    </header>
  );
}

/* ───────── 승급 증서 ───────── */

interface DiplomaProps {
  from: RankId;
  to: RankId;
  /** 옛 휘장이 물러나고 새 휘장이 찍히는 연출을 보여 줄지 */
  animate?: boolean;
  titleTestId?: string;
  lead: string[];
}

function Diploma({ from, to, animate = false, titleTestId, lead }: DiplomaProps) {
  return (
    <article className="diploma leaf" data-animate={animate}>
      <p className="diploma__kind">승급 증서</p>
      <div className="diploma__marks" aria-hidden="true">
        <span className="diploma__mark diploma__mark--old">
          <RankMedal rank={from} />
        </span>
        <span className="diploma__mark diploma__mark--new">
          <RankMedal rank={to} />
          <PenMark kind="circle" draw={animate} delayMs={1700} />
        </span>
      </div>
      <h1 className="diploma__title" data-testid={titleTestId}>
        {rankLabel(to)}
      </h1>
      <p className="diploma__lead">
        {lead.map((line, i) => (
          <span key={i}>{line}</span>
        ))}
      </p>
    </article>
  );
}

/* ───────── 승급 연출 ───────── */

interface CeremonyProps {
  from: RankId;
  to: RankId;
  reward: number;
  onDone: () => void;
  onViewCard: () => void;
}

/**
 * 시험실 불빛이 밝아지고 → 옛 휘장이 물러나고 → 새 휘장이 증서에 찍히고 → 새 신분증에 학원 인장이 찍힌다.
 * 어느 단계에서든 건너뛸 수 있고, 버튼은 처음부터 눌린다.
 */
function PromotionCeremony({ from, to, reward, onDone, onViewCard }: CeremonyProps) {
  const game = useGame();
  const { step, done, skip } = useSequence([650, 620, 900, 700]);

  useEffect(() => {
    playSound("promote");
  }, []);

  return (
    <div className="screen room room--ceremony inkworld" data-step={step} data-done={done} data-testid="ceremony">
      <RoomScene />
      <span className="room__glow" aria-hidden="true" />

      <header className="deskbar ceremony__bar">
        {!done && (
          <button type="button" className="minibtn leaf" onClick={skip} data-testid="ceremony-skip">
            건너뛰기
          </button>
        )}
      </header>

      <div className="screen__scroll room__scroll">
        <Diploma
          from={from}
          to={to}
          animate
          titleTestId="ceremony-title"
          lead={["승급 시험에 합격했습니다.", `${rankLabel(from)}에서 한 단계 올라섰습니다.`]}
        />

        <div className="ceremony__card">
          <IdCard
            nickname={game.nickname}
            rank={game.rank}
            detectiveNo={game.detectiveNo}
            issuedAt={game.promotions[game.promotions.length - 1]?.at ?? game.enrolledAt}
            overlay={step >= 3 ? <Stamp className="idcard__stamp" label="합격" size={58} animate={!done || step === 3} /> : undefined}
          />
        </div>

        {reward > 0 && step >= 3 && (
          <div className="ceremony__reward leaf">
            <Reward amount={reward} balance={game.credits} delayMs={380} />
          </div>
        )}
      </div>

      <footer className="deskfoot">
        <button type="button" className="inkbtn deskfoot__hint" onClick={onViewCard} data-testid="ceremony-card">
          신분증 보기
        </button>
        <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" onClick={onDone} data-testid="ceremony-done">
          학원 복도로
        </button>
      </footer>
    </div>
  );
}

/* ───────── 시험실 입구: 봉투 ───────── */

function ExamGate({
  rule,
  puzzle,
  state,
  onOpen,
}: {
  rule: PromotionRule;
  puzzle: Puzzle;
  state: "sealed" | "opening";
  onOpen: () => void;
}) {
  return (
    <div className="screen room inkworld" data-state={state} data-testid="exam-gate">
      <RoomScene />
      <RoomBar title={`${rule.to}급 승급 시험`} />

      <div className="screen__scroll room__scroll">
        <div className="room__envelope">
          <ExamEnvelope state={state} letterTitle={`${rule.from}급 → ${rule.to}급`} />
        </div>

        <section className="roomnote leaf" aria-label="응시 안내">
          <p className="roomnote__lead">학원 인장으로 봉한 시험 봉투입니다. 봉투를 열면 시험이 시작됩니다.</p>
          <dl className="roomnote__facts">
            <div>
              <dt>승급</dt>
              <dd>
                {rankLabel(rule.from)} → {rankLabel(rule.to)}
              </dd>
            </div>
            <div>
              <dt>출제</dt>
              <dd className="num">
                {rule.examPuzzleIds.length}문제 · {puzzle.typeLabel}
              </dd>
            </div>
            <div>
              <dt>합격 기준</dt>
              <dd>정답을 제출하면 합격. 힌트를 써도 됩니다.</dd>
            </div>
            <div>
              <dt>합격 보상</dt>
              <dd className="num">수사 크레딧 +{puzzle.reward}</dd>
            </div>
          </dl>
        </section>
      </div>

      <footer className="deskfoot">
        <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" onClick={onOpen} data-testid="open-envelope">
          {state === "opening" ? "시험지 꺼내는 중" : "봉투 열고 시험 시작"}
        </button>
      </footer>
    </div>
  );
}

function ExamLocked({ rule }: { rule: PromotionRule }) {
  const game = useGame();
  const status = examStatus(game);
  return (
    <div className="screen room inkworld" data-state="locked" data-testid="exam-locked">
      <RoomScene />
      <RoomBar title={`${rule.to}급 승급 시험`} note="응시 전" />

      <div className="screen__scroll room__scroll">
        <div className="room__envelope">
          <ExamEnvelope state="locked" letterTitle={`${rule.from}급 → ${rule.to}급`} />
        </div>

        <section className="roomnote leaf" aria-label="응시 조건">
          <p className="roomnote__lead">아직 응시할 수 없습니다. 아래 조건을 모두 채우면 봉투가 열립니다.</p>
          <ul className="promoslip__reqs roomnote__reqs">
            {status.requirements.map((req) => (
              <li key={req.label} data-done={req.done}>
                <span className="tickbox">{req.done && <PenMark kind="check" />}</span>
                {req.label}
                <span className="sr-only">{req.done ? " 완료" : " 미완료"}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="deskfoot">
        <button
          type="button"
          className="inkbtn inkbtn--wine deskfoot__submit"
          onClick={() => navigate({ name: "home" }, { replace: true })}
        >
          학원 복도로
        </button>
      </footer>
    </div>
  );
}

function ExamPassed({ rule, puzzle }: { rule: PromotionRule; puzzle: Puzzle }) {
  const game = useGame();
  const progress = getProgress(game, puzzle.id);
  return (
    <div className="screen room room--passed inkworld" data-testid="exam-passed">
      <RoomScene />
      <RoomBar title={`${rule.to}급 승급 시험`} note="합격 기록" />

      <div className="screen__scroll room__scroll">
        <Diploma
          from={rule.from}
          to={rule.to}
          lead={[`${puzzle.title} 문제를 풀어`, `${RANK_BY_ID[rule.from].title}에서 승급했습니다.`]}
        />
        <section className="roomnote roomnote--record leaf" aria-label="시험 기록">
          <Stamp className="roomnote__stamp" label="합격" size={84} />
          <h2 className="roomnote__title">시험 기록</h2>
          <GradedFacts progress={progress} />
          <GradedExplain puzzle={puzzle} />
        </section>
      </div>

      <footer className="deskfoot">
        <button type="button" className="inkbtn deskfoot__hint" onClick={() => navigate({ name: "profile" })}>
          신분증 보기
        </button>
        <button
          type="button"
          className="inkbtn inkbtn--wine deskfoot__submit"
          onClick={() => navigate({ name: "home" }, { replace: true })}
        >
          학원 복도로
        </button>
      </footer>
    </div>
  );
}

/* ───────── 승급 시험 ───────── */

export function PromotionExam() {
  const game = useGame();
  const rule = currentRule(game);
  const puzzle = rule ? PUZZLE_BY_ID[rule.examPuzzleIds[0]] : null;
  const progress = puzzle ? getProgress(game, puzzle.id) : null;

  const [opening, setOpening] = useState(false);
  const [passed, setPassed] = useState<{ outcome: SubmitOutcome; from: RankId } | null>(null);
  // 들어올 때 이미 합격해 있던 경우에만 '합격 기록'을 보여 준다.
  // 방금 합격한 경우에는 정답 연출 → 승급 연출 순서로 이어진다.
  const [solvedOnArrival] = useState(progress?.status === "solved");

  // 봉투를 뜯는 연출이 끝나면 시험지를 펼친다. 다시 누르면 바로 넘어간다.
  useEffect(() => {
    if (!opening || !puzzle) return;
    const id = window.setTimeout(() => gameStore.markOpened(puzzle.id), motionMs(ENVELOPE_OPEN_MS));
    return () => window.clearTimeout(id);
  }, [opening, puzzle]);

  useEffect(() => {
    if (!rule || !puzzle) navigate({ name: "home" }, { replace: true });
  }, [rule, puzzle]);

  if (!rule || !puzzle || !progress) return null;

  if (passed) {
    return (
      <PromotionCeremony
        from={passed.from}
        to={passed.outcome.promotedTo ?? rule.to}
        reward={passed.outcome.reward}
        onDone={() => navigate({ name: "home" }, { replace: true })}
        onViewCard={() => navigate({ name: "profile" }, { replace: true })}
      />
    );
  }

  if (solvedOnArrival) return <ExamPassed rule={rule} puzzle={puzzle} />;

  const inSession = progress.status === "solved";

  if (!inSession && !examStatus(game).unlocked) return <ExamLocked rule={rule} />;

  if (!inSession && !progress.opened) {
    return (
      <ExamGate
        rule={rule}
        puzzle={puzzle}
        state={opening ? "opening" : "sealed"}
        onOpen={() => {
          if (opening) {
            gameStore.markOpened(puzzle.id);
          } else {
            setOpening(true);
            playSound("place");
          }
        }}
      />
    );
  }

  return (
    <DeskPlay
      puzzle={puzzle}
      variant="exam"
      onExit={() => goBack({ name: "home" })}
      onSolved={(outcome) => setPassed({ outcome, from: rule.from })}
    />
  );
}
