import { useEffect, useState } from "react";
import { gameNow } from "../app/clock";
import { motionMs, useSequence } from "../app/motion";
import { goBack, navigate } from "../app/router";
import { playSound } from "../app/sound";
import { gameStore, useGame } from "../app/store";
import { EXAMROOM } from "../app/backdrop";
import { PenMark, Sprite } from "../art/pixel";
import { RankMedal } from "../art/objects";
import { cineDuration } from "../components/CineCard";
import { ExamEnvelope } from "../components/ExamEnvelope";
import { IdCard } from "../components/IdCard";
import { Stamp } from "../components/Stamp";
import { PUZZLE_BY_ID } from "../data/puzzles";
import { PROMOTION_RULES, RANK_BY_ID, rankLabel, type ExamRules, type PromotionRule } from "../data/ranks";
import { examRemainingMs, examRuleOf, examStatus, getProgress, type ExamStatus, type SubmitOutcome } from "../engine/progressEngine";
import { formatCountdown } from "../engine/time";
import type { ExamSession, Puzzle, RankId } from "../engine/types";
import { TYPE_NAME } from "../games/logic";
import { EvidencePlay } from "./cases/EvidencePlay";
import { SealPlay } from "./cases/SealPlay";
import { ScenePlay } from "./codeux/ScenePlay";
import { DeskPlay } from "./DeskPlay";
import { GradedExplain, GradedFacts, Reward } from "./DeskResult";

const ENVELOPE_OPEN_MS = 900;

const goHome = () => navigate({ name: "home" }, { replace: true });

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
        {note && (
          <span className="deskbar__timer" data-testid="room-note">
            {note}
          </span>
        )}
      </div>
    </header>
  );
}

/** 시험에 걸린 제한을 한 줄씩: 걸린 것만 적고, 아무것도 없으면 없다고 적는다 */
function ruleLines(rules: ExamRules): string[] {
  const lines: string[] = [];
  if (rules.timeLimitSec !== null) lines.push(`${Math.round(rules.timeLimitSec / 60)}분 안에 모두 풉니다`);
  if (rules.submitsPerPuzzle !== null) {
    // 유형에 따라 더 줄인 횟수가 있으면 함께 적는다: "문제마다 3번까지 제출합니다 (진술 추리는 2번)"
    const fewer = (Object.entries(rules.submitsByType ?? {}) as [Puzzle["type"], number][])
      .filter(([, count]) => count < rules.submitsPerPuzzle!)
      .map(([type, count]) => `${TYPE_NAME[type]}는 ${count}번`);
    lines.push(`문제마다 ${rules.submitsPerPuzzle}번까지 제출합니다${fewer.length ? ` (${fewer.join(", ")})` : ""}`);
  }
  if (lines.length === 0) lines.push("시간과 제출 횟수에 제한이 없습니다");
  lines.push(rules.hints ? "수사 지원을 쓸 수 있습니다" : "수사 지원을 쓸 수 없습니다");
  return lines;
}

function puzzlesOf(rule: PromotionRule): Puzzle[] {
  return rule.examPuzzleIds.map((id) => PUZZLE_BY_ID[id]).filter(Boolean);
}

/** 응시 안내: 무엇이 나오고, 어떤 제한이 걸리고, 붙으면 무엇을 받는가 */
function ExamFacts({ rule, status }: { rule: PromotionRule; status: ExamStatus }) {
  const puzzles = puzzlesOf(rule);
  return (
    <dl className="roomnote__facts" data-testid="exam-facts">
      <div>
        <dt>승급</dt>
        <dd>
          {rankLabel(rule.from)} → {rankLabel(rule.to)}
        </dd>
      </div>
      <div>
        <dt>출제</dt>
        <dd>
          <span className="num">{puzzles.length}문제</span> · {puzzles.map((p) => TYPE_NAME[p.type]).join(", ")}
        </dd>
      </div>
      <div>
        <dt>규칙</dt>
        <dd>
          <ul className="roomnote__rules" data-testid="exam-rules">
            {ruleLines(rule.exam).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </dd>
      </div>
      {rule.exam.attemptsPerDay !== null && (
        <div>
          <dt>응시</dt>
          <dd className="num" data-testid="attempts-left">
            하루 {rule.exam.attemptsPerDay}번 · 오늘 {status.attemptsLeft ?? 0}번 남음
          </dd>
        </div>
      )}
      <div>
        <dt>합격 보상</dt>
        <dd className="num">수사 크레딧 +{rule.reward}</dd>
      </div>
    </dl>
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

/* ───────── 봉투: 시험을 시작하기 전, 그리고 문제와 문제 사이 ───────── */

interface GateProps {
  rule: PromotionRule;
  status: ExamStatus;
  /** 치르고 있는 응시. 없으면 아직 시작 전이다. */
  session: ExamSession | null;
  state: "sealed" | "opening";
  onOpen: () => void;
}

function ExamGate({ rule, status, session, state, onOpen }: GateProps) {
  const puzzles = puzzlesOf(rule);
  const between = !!session;
  const index = session?.index ?? 0;
  const next = puzzles[index];
  const remaining = session ? examRemainingMs(session, gameNow()) : null;
  const blocked = !between && !status.canStart;
  const timed = rule.exam.timeLimitSec !== null;

  return (
    <div className="screen room inkworld" data-state={state} data-between={between} data-testid={between ? "exam-between" : "exam-gate"}>
      <RoomScene />
      <RoomBar title={`${rule.to}급 승급 시험`} note={between ? `${index}/${puzzles.length} 통과` : undefined} />

      <div className="screen__scroll room__scroll">
        <div className="room__envelope">
          <ExamEnvelope state={state} letterTitle={between ? `${index + 1}번 문제` : `${rule.from}급 → ${rule.to}급`} />
        </div>

        {between ? (
          <section className="roomnote leaf" aria-label="다음 시험지">
            <p className="roomnote__lead" data-testid="between-lead">
              {index}번 문제를 통과했습니다. 다음 시험지를 펼치면 시험이 이어집니다.
            </p>
            <dl className="roomnote__facts">
              <div>
                <dt>다음 문제</dt>
                <dd>
                  <span className="num">
                    {index + 1}/{puzzles.length}
                  </span>{" "}
                  · {next ? TYPE_NAME[next.type] : ""}
                </dd>
              </div>
              {remaining !== null && (
                <div>
                  <dt>남은 시간</dt>
                  <dd className="num" data-testid="between-time">
                    {formatCountdown(remaining)} (멈춰 있음)
                  </dd>
                </div>
              )}
              <div>
                <dt>규칙</dt>
                <dd>
                  <ul className="roomnote__rules">
                    {ruleLines(rule.exam).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          </section>
        ) : (
          <section className="roomnote leaf" aria-label="응시 안내">
            <p className="roomnote__lead">
              {blocked
                ? "오늘의 응시 횟수를 모두 썼습니다. 자정이 지나면 다시 응시할 수 있습니다."
                : timed
                  ? "봉투를 열면 시험이 시작됩니다. 시험지를 펼친 뒤에는 화면을 떠나도 시간이 흐릅니다."
                  : "학원 인장으로 봉한 시험 봉투입니다. 봉투를 열면 시험이 시작됩니다."}
            </p>
            <ExamFacts rule={rule} status={status} />
          </section>
        )}
      </div>

      <footer className="deskfoot">
        {blocked ? (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" onClick={goHome} data-testid="exam-blocked">
            학원 복도로
          </button>
        ) : (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" onClick={onOpen} data-testid={between ? "open-sheet" : "open-envelope"}>
            {state === "opening" ? "시험지 꺼내는 중" : between ? "다음 시험지 펼치기" : "봉투 열고 시험 시작"}
          </button>
        )}
      </footer>
    </div>
  );
}

/** 응시 조건의 눈금: 채운 만큼 찬 네모 */
function TaskMeter({ solved, required }: { solved: number; required: number }) {
  return (
    <p className="meter" role="img" aria-label={`해결한 과제 ${solved}개, 필요한 과제 ${required}개`}>
      {Array.from({ length: required }, (_, i) => (
        <i key={i} data-on={i < solved} />
      ))}
    </p>
  );
}

function ExamLocked({ rule, status }: { rule: PromotionRule; status: ExamStatus }) {
  const left = Math.max(0, status.required - status.solved);
  return (
    <div className="screen room inkworld" data-state="locked" data-testid="exam-locked">
      <RoomScene />
      <RoomBar title={`${rule.to}급 승급 시험`} note="응시 전" />

      <div className="screen__scroll room__scroll">
        <div className="room__envelope">
          <ExamEnvelope state="locked" letterTitle={`${rule.from}급 → ${rule.to}급`} />
        </div>

        <section className="roomnote leaf" aria-label="응시 조건">
          <p className="roomnote__lead">아직 응시할 수 없습니다. 오늘의 추리와 연습실의 과제를 {left}개 더 해결하면 봉투가 열립니다.</p>
          <div className="roomnote__need">
            <span>해결한 과제</span>
            <b className="num" data-testid="exam-need">
              {status.solved}/{status.required}
            </b>
            <TaskMeter solved={status.solved} required={status.required} />
          </div>
          <ExamFacts rule={rule} status={status} />
        </section>
      </div>

      <footer className="deskfoot">
        <button type="button" className="inkbtn deskfoot__hint" onClick={goHome}>
          학원 복도
        </button>
        <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" onClick={() => navigate({ name: "practice" }, { replace: true })} data-testid="exam-to-practice">
          연습실로 이동
        </button>
      </footer>
    </div>
  );
}

/* ───────── 떨어졌을 때 ───────── */

function ExamFailed({ rule, session, status }: { rule: PromotionRule; session: ExamSession; status: ExamStatus }) {
  const total = rule.examPuzzleIds.length;
  const byTime = session.failedBy === "time";
  // 닫고 나면 다시 응시할 수 있는가 (오늘 횟수가 남았는가)
  const canRetry = status.attemptsLeft === null || status.attemptsLeft > 0;

  useEffect(() => {
    playSound("wrong");
  }, []);

  return (
    <div className="screen room inkworld" data-state="failed" data-testid="exam-failed">
      <RoomScene />
      <RoomBar title={`${rule.to}급 승급 시험`} note="시험 종료" />

      <div className="screen__scroll room__scroll">
        <div className="room__envelope">
          <ExamEnvelope state="locked" letterTitle={`${rule.from}급 → ${rule.to}급`} />
        </div>

        <section className="roomnote roomnote--failed leaf" aria-label="시험 결과">
          <h2 className="roomnote__title" data-testid="failed-title">
            {byTime ? "시간이 끝났습니다" : "제출을 다 썼습니다"}
          </h2>
          <p className="roomnote__lead" data-testid="failed-lead">
            {byTime
              ? `제한 시간 ${Math.round((rule.exam.timeLimitSec ?? 0) / 60)}분이 모두 흘렀습니다.`
              : `${session.index + 1}번 문제에서 주어진 제출을 모두 썼습니다.`}{" "}
            이번 응시는 여기까지입니다. 등급은 {rankLabel(rule.from)} 그대로입니다.
          </p>
          <dl className="roomnote__facts">
            <div>
              <dt>통과</dt>
              <dd className="num" data-testid="failed-progress">
                {session.index}/{total}문제
              </dd>
            </div>
            {rule.exam.attemptsPerDay !== null && (
              <div>
                <dt>응시</dt>
                <dd className="num" data-testid="attempts-left">
                  오늘 {status.attemptsLeft ?? 0}번 남음
                </dd>
              </div>
            )}
          </dl>
          {!canRetry && <p className="roomnote__lead">오늘의 응시 횟수를 모두 썼습니다. 자정이 지나면 다시 응시할 수 있습니다.</p>}
        </section>
      </div>

      <footer className="deskfoot">
        <button
          type="button"
          className={`inkbtn ${canRetry ? "deskfoot__hint" : "inkbtn--wine deskfoot__submit"}`}
          onClick={() => {
            gameStore.dismissExam();
            goHome();
          }}
          data-testid="failed-home"
        >
          {canRetry ? "학원 복도" : "학원 복도로"}
        </button>
        {canRetry && (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" onClick={() => gameStore.dismissExam()} data-testid="failed-retry">
            다시 응시
          </button>
        )}
      </footer>
    </div>
  );
}

/* ───────── 합격 기록 (최고 등급에 오른 뒤) ───────── */

function ExamPassed({ rule }: { rule: PromotionRule }) {
  const game = useGame();
  const puzzles = puzzlesOf(rule);
  return (
    <div className="screen room room--passed inkworld" data-testid="exam-passed">
      <RoomScene />
      <RoomBar title={`${rule.to}급 승급 시험`} note="합격 기록" />

      <div className="screen__scroll room__scroll">
        <Diploma from={rule.from} to={rule.to} lead={[`${puzzles.length}문제를 모두 풀어`, `${RANK_BY_ID[rule.from].title}에서 승급했습니다.`]} />
        {puzzles.map((puzzle, i) => (
          <section className="roomnote roomnote--record leaf" aria-label={`${i + 1}번 문제의 기록`} key={puzzle.id}>
            {i === 0 && <Stamp className="roomnote__stamp" label="합격" size={84} />}
            <h2 className="roomnote__title">{puzzles.length > 1 ? `${i + 1}. ${puzzle.title}` : "시험 기록"}</h2>
            <GradedFacts progress={getProgress(game, puzzle.id)} />
            <GradedExplain puzzle={puzzle} />
          </section>
        ))}
      </div>

      <footer className="deskfoot">
        <button type="button" className="inkbtn deskfoot__hint" onClick={() => navigate({ name: "profile" })}>
          신분증 보기
        </button>
        <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" onClick={goHome}>
          학원 복도로
        </button>
      </footer>
    </div>
  );
}

/* ───────── 시험 문제 한 장 ───────── */

function ExamPlay({ puzzle, onSolved }: { puzzle: Puzzle; onSolved: (outcome: SubmitOutcome) => void }) {
  const exit = () => goBack({ name: "home" });
  // 유형마다 그 유형의 화면에서 치른다: 암호는 자료실, 증거·인장은 책상 위의 게시판과 도장, 나머지는 시험지
  if (puzzle.type === "code") return <ScenePlay puzzle={puzzle} variant="exam" onExit={exit} onSolved={onSolved} />;
  if (puzzle.type === "evidence") return <EvidencePlay puzzle={puzzle} variant="exam" onExit={exit} onSolved={onSolved} />;
  if (puzzle.type === "spatial") return <SealPlay puzzle={puzzle} variant="exam" onExit={exit} onSolved={onSolved} />;
  return <DeskPlay puzzle={puzzle} variant="exam" onExit={exit} onSolved={onSolved} />;
}

/** 시험지를 펼칠 때 도입 장면만큼 시계를 늦게 돌린다 (암호는 자막 화면 없이 자료실에 들어선다) */
function graceFor(puzzle: Puzzle | undefined): number {
  if (!puzzle || puzzle.type === "code") return 0;
  return cineDuration(puzzle.title, puzzle.intro);
}

/* ───────── 승급 시험 ───────── */

/**
 * 시험 한 번의 흐름: 봉투 → 문제 → (다음 시험지 → 문제 …) → 승급 연출. 중간에 시간이 끝나거나 제출을 다 쓰면 그 응시는 끝난다.
 * 어디까지 왔는지는 저장된 응시 기록(game.exam)이 정한다: 새로고침하거나 나갔다 와도 같은 자리에서 잇는다.
 */
export function PromotionExam() {
  const game = useGame();
  const status = examStatus(game, gameNow());
  const { rule, session } = status;
  const currentId = rule && session?.status === "active" ? rule.examPuzzleIds[session.index] : null;

  const [opening, setOpening] = useState(false);
  const [passed, setPassed] = useState<{ outcome: SubmitOutcome; from: RankId } | null>(null);
  /**
   * 화면에 펼쳐 둔 문제. 정답을 맞히면 엔진은 곧바로 다음 문제로 넘어가지만,
   * 정답 연출이 끝날 때까지는 풀던 문제의 화면을 그대로 둔다.
   */
  const [playing, setPlaying] = useState<string | null>(session?.status === "active" && session.stage === "playing" ? currentId : null);

  // 들어설 때, 떠나 있는 사이에 시간이 끝났는지 본다
  useEffect(() => {
    gameStore.tickExam();
  }, []);

  /** 봉투(또는 다음 시험지)를 연다 */
  const begin = () => {
    setOpening(false);
    if (!rule) return;
    if (session?.status === "active") {
      gameStore.openExamSheet(graceFor(PUZZLE_BY_ID[rule.examPuzzleIds[session.index]]));
      setPlaying(rule.examPuzzleIds[session.index]);
    } else {
      gameStore.startExam(graceFor(PUZZLE_BY_ID[rule.examPuzzleIds[0]]));
      setPlaying(rule.examPuzzleIds[0]);
    }
  };

  // 봉투를 뜯는 연출이 끝나면 시험지를 펼친다. 다시 누르면 바로 넘어간다.
  useEffect(() => {
    if (!opening) return;
    const id = window.setTimeout(begin, motionMs(ENVELOPE_OPEN_MS));
    return () => window.clearTimeout(id);
    // begin 은 그때의 응시 상태를 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening]);

  const lastRule = PROMOTION_RULES.find((r) => r.to === game.rank) ?? null;

  useEffect(() => {
    if (!rule && !lastRule && !passed) goHome();
  }, [rule, lastRule, passed]);

  if (passed) {
    return (
      <PromotionCeremony
        from={passed.from}
        to={passed.outcome.promotedTo ?? game.rank}
        reward={passed.outcome.reward}
        onDone={goHome}
        onViewCard={() => navigate({ name: "profile" }, { replace: true })}
      />
    );
  }

  // 풀던 문제는 정답 연출이 끝날 때까지 그대로 둔다(마지막 문제를 맞히면 엔진의 등급은 이미 올라가 있다)
  const held = playing ? PUZZLE_BY_ID[playing] : null;
  const failed = session?.status === "failed";
  if (held && !failed && (session || getProgress(game, held.id).status === "solved")) {
    return (
      <ExamPlay
        key={held.id}
        puzzle={held}
        onSolved={(outcome) => {
          setPlaying(null);
          if (outcome.promotedTo) setPassed({ outcome, from: examRuleOf(held.id)?.from ?? game.rank });
        }}
      />
    );
  }

  // 최고 등급: 더 치를 시험이 없다. 마지막 시험의 합격 기록을 보여 준다.
  if (!rule) return lastRule ? <ExamPassed rule={lastRule} /> : null;

  if (session?.status === "failed") return <ExamFailed rule={rule} session={session} status={status} />;

  if (!session && !status.unlocked) return <ExamLocked rule={rule} status={status} />;

  return (
    <ExamGate
      rule={rule}
      status={status}
      session={session}
      state={opening ? "opening" : "sealed"}
      onOpen={() => {
        if (opening) begin();
        else {
          setOpening(true);
          playSound("place");
        }
      }}
    />
  );
}
