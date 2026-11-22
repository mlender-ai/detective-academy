import { useEffect, useRef, useState, type ReactNode } from "react";
import { gameNow, todayKey } from "../app/clock";
import { nextStep, type NextStep } from "../app/flow";
import { prefersReducedMotion } from "../app/motion";
import { navigate, type Route } from "../app/router";
import { playSound } from "../app/sound";
import { useGame } from "../app/store";
import { Crest, RankMark } from "../art/objects";
import { LiveScene, type LiveSceneHandle } from "../components/LiveScene";
import { Narration } from "../components/Narration";
import { getDailyPuzzle, PRACTICE_PUZZLES } from "../data/puzzles";
import { nextRank, rankLabel } from "../data/ranks";
import { examRemainingMs, examStatus, getProgress, practiceUnlocked } from "../engine/progressEngine";
import { formatCountdown, formatElapsed } from "../engine/time";
import type { SpotId } from "../scene/homeScene";
import { SideScene } from "../scene/sideScene";
import { CASES } from "../story/cases";
import { caseStatus, getChapter } from "../story/engine/storyEngine";

/** 지금 접수함에 들어 있는 사건 (사건이 늘면 풀지 않은 첫 사건을 고른다) */
const STORY = CASES[0];

/** 복도의 곳들과 그곳에서 열리는 화면 */
const ROUTE: Record<SpotId, Route> = {
  board: { name: "daily" },
  practice: { name: "practice" },
  exam: { name: "exam" },
  archive: { name: "profile" },
  case: { name: "story", id: STORY.id },
};

/** 명령 창의 줄. 사건 수사는 그 사건을 맡을 수 있는 등급부터 나온다. */
const ORDER: SpotId[] = ["board", "practice", "exam", "case", "archive"];

const PLACE: Record<SpotId, string> = {
  board: "시험 게시판",
  practice: "연습실",
  exam: "승급 시험실",
  archive: "기록 보관함",
  case: "사건 수사",
};

const STEP_SPOT: Record<NextStep, SpotId | null> = { daily: "board", practice: "practice", exam: "exam", none: null };

/** 도착해서 화면이 바뀌기 전의 짧은 박자: 게시판을 짚고, 문이 열린다 */
const ARRIVE_BEAT_MS = 200;
/** 들어서자마자 탐정이 오늘 할 일 쪽으로 걸어가기 전의 뜸 */
const ENTRANCE_DELAY_MS = 420;

/**
 * 메인 홈 · 플레이 가능한 복도 (V3 GATE 02 에서 B안으로 골랐다, 2026-11-22).
 * 복도가 게임 장면이다. 장면의 물건을 누르면 탐정이 그 앞으로 걸어가 살펴보고,
 * 아래 명령 창의 줄을 누르면 걸어가서 곧바로 들어간다(빠른 진입). 걷는 중에 한 번 더 누르면 건너뛴다.
 */
export function HomePlayable() {
  const game = useGame();
  const daily = getDailyPuzzle(todayKey());
  const dailyProgress = getProgress(game, daily.id);
  const exam = examStatus(game, gameNow());
  const step = nextStep(game);
  const stepSpot = STEP_SPOT[step];

  const sceneRef = useRef<LiveSceneHandle<SpotId>>(null);
  /** 탐정이 서 있는 곳 */
  const [here, setHere] = useState<SpotId | null>(null);
  /** 걸어가는 곳. 처음에는 오늘 할 일이 있는 곳으로 간다. */
  const [heading, setHeading] = useState<SpotId | null>(stepSpot);
  /** 사용자가 직접 어딘가를 골랐는가 (그 전에는 홈의 첫 서술을 그대로 둔다) */
  const [explored, setExplored] = useState(false);
  /** 도착하면 곧바로 들어갈 곳 (명령 창으로 골랐을 때) */
  const enterOnArrive = useRef<SpotId | null>(null);
  const touched = useRef(false);
  const leaving = useRef(false);
  const timers = useRef<number[]>([]);
  /**
   * 장면이 실제로 걸어가고 있는 곳. heading 은 줄을 미리 펼쳐 두려고 걸음보다 먼저 바뀔 수 있어서
   * (들어설 때의 뜸), "지금 그곳으로 가는 중인가"는 이것으로 본다.
   */
  const walkingTo = useRef<SpotId | null>(null);
  const walkTo = (id: SpotId) => {
    walkingTo.current = id;
    sceneRef.current?.go(id);
  };

  // 들어서면(그리고 오늘 할 일이 바뀌면) 탐정이 그곳으로 걸어가 그 앞에 선다.
  // 기다릴 필요는 없다: 그동안에도 모든 것을 누를 수 있다. 사용자가 이미 다른 곳을 골랐으면 끼어들지 않는다.
  useEffect(() => {
    if (!stepSpot || touched.current || leaving.current) return;
    setHeading((now) => (sceneRef.current?.busy() || here !== stepSpot ? stepSpot : now));
    const id = window.setTimeout(() => {
      if (!touched.current && !leaving.current) walkTo(stepSpot);
    }, ENTRANCE_DELAY_MS);
    return () => window.clearTimeout(id);
    // 오늘 할 일이 있는 곳이 바뀔 때만 다시 한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepSpot]);

  // 화면을 떠날 때 남은 타이머를 정리한다
  useEffect(() => {
    const list = timers.current;
    return () => {
      list.forEach((id) => window.clearTimeout(id));
      list.length = 0;
    };
  }, []);

  const leave = (id: SpotId, beat: number) => {
    if (leaving.current) return;
    leaving.current = true;
    playSound("place");
    const wait = prefersReducedMotion() ? 0 : beat;
    if (wait === 0) navigate(ROUTE[id]);
    else timers.current.push(window.setTimeout(() => navigate(ROUTE[id]), wait));
  };

  const onArrive = (id: SpotId) => {
    setHere(id);
    setHeading(null);
    if (enterOnArrive.current === id) {
      enterOnArrive.current = null;
      leave(id, ARRIVE_BEAT_MS);
    }
  };

  /** 명령 창의 줄: 걸어가서 곧바로 들어간다. 이미 그 앞이면 바로 들어간다. */
  const command = (id: SpotId) => {
    if (leaving.current) return;
    const scene = sceneRef.current;
    touched.current = true;
    setExplored(true);
    if (!scene) {
      navigate(ROUTE[id]);
      return;
    }
    if (here === id && !scene.busy()) {
      leave(id, 0);
      return;
    }
    enterOnArrive.current = id;
    if (scene.busy() && walkingTo.current === id) {
      // 가는 중에 한 번 더 누르면 걷기를 건너뛴다
      scene.skip();
      return;
    }
    setHeading(id);
    walkTo(id);
  };

  /** 장면의 물건: 걸어가서 살펴본다. 그 앞에 서서 한 번 더 누르면 들어간다. */
  const look = (id: SpotId) => {
    if (leaving.current) return;
    const scene = sceneRef.current;
    if (!scene) return;
    touched.current = true;
    setExplored(true);
    if (here === id) {
      leave(id, 0);
      return;
    }
    enterOnArrive.current = null;
    setHeading(id);
    walkTo(id);
  };

  const selected = heading ?? here;
  const story = caseStatus(game, STORY);
  const storyChapter = STORY.chapters[0];
  const storyCleared = STORY.chapters.filter((ch) => getChapter(game, STORY, ch).status === "cleared").length;
  const storyState = story === "cleared" ? `${storyCleared}장 해결` : story === "open" ? "수사 중" : "새 사건";
  const order = ORDER.filter((id) => id !== "case" || story !== "locked");
  const practiceSolved = PRACTICE_PUZZLES.filter((p) => getProgress(game, p.id).status === "solved").length;
  // 다음 과제: 지금 등급에서 열려 있는 것 가운데 풀지 않은 첫 문제
  const practiceNext = PRACTICE_PUZZLES.find((p) => practiceUnlocked(game, p) && getProgress(game, p.id).status !== "solved") ?? null;
  const practiceLocked = PRACTICE_PUZZLES.some((p) => !practiceUnlocked(game, p));
  const examSession = exam.session;
  const examActive = examSession?.status === "active";
  const examFailed = examSession?.status === "failed";
  /** 시험실에 들어가 할 일이 있는가: 치르던 시험이 있거나 지금 응시할 수 있다 */
  const examOpen = !!examSession || exam.canStart;
  const examTotal = exam.rule?.examPuzzleIds.length ?? 0;
  const examLeft = examSession && examActive ? examRemainingMs(examSession, gameNow()) : null;
  const examState = !exam.rule
    ? ""
    : examActive
      ? `${exam.rule.to}급 시험 중 ${examSession.index}/${examTotal}`
      : examFailed
        ? `${exam.rule.to}급 시험 종료`
        : exam.canStart
          ? `${exam.rule.to}급 응시 가능`
          : exam.unlocked
            ? `${exam.rule.to}급 오늘 응시 끝`
            : `${exam.rule.to}급 과제 ${exam.solved}/${exam.required}`;
  const dailyState =
    dailyProgress.status === "solved" ? "해결" : dailyProgress.status === "in_progress" ? `풀이 중 ${formatElapsed(dailyProgress.elapsedMs)}` : "미해결";

  const line = (() => {
    if (!explored || !selected) {
      if (step === "daily") {
        return dailyProgress.status === "in_progress"
          ? "풀다 만 시험지가 게시판에 그대로 붙어 있다."
          : "자정이 가까운 복도. 게시판에 오늘의 사건이 붙어 있다.";
      }
      if (step === "exam") {
        if (examActive) return "시험실에 풀다 만 시험지가 놓여 있다.";
        if (examFailed) return "시험실 문에 쪽지가 붙어 있다. 시험이 끝났다.";
        return "시험실 문 안에 불이 켜져 있다. 승급 시험이다.";
      }
      if (step === "practice") return "오늘의 사건은 끝났다. 연습실에 풀지 않은 과제가 남아 있다.";
      return "복도는 조용하다. 창밖의 나뭇가지만 흔들린다.";
    }
    if (selected === "board") {
      if (dailyProgress.status === "solved") return "게시판 앞. 오늘의 사건에는 해결 도장이 찍혀 있다.";
      if (dailyProgress.status === "in_progress") return "게시판 앞. 풀다 만 시험지가 그대로 붙어 있다.";
      return `게시판 앞. 오늘의 사건은 「${daily.title}」.`;
    }
    if (selected === "practice") {
      if (practiceNext) return "연습실 문이 열린다. 풀지 않은 과제가 남아 있다.";
      return practiceLocked ? "연습실 문이 열린다. 남은 서랍은 등급이 올라야 열린다." : "연습실 문이 열린다. 과제는 모두 풀었다.";
    }
    if (selected === "exam") {
      if (!exam.rule) return `승급 시험실. 문 위에 ${game.rank}. 합격 기록이 남아 있다.`;
      if (examActive) return `승급 시험실. 문 위에 ${exam.rule.to}. 풀다 만 시험지가 책상에 놓여 있다.`;
      if (examFailed) return `승급 시험실. 문 위에 ${exam.rule.to}. 시험이 끝났다는 쪽지가 붙어 있다.`;
      if (exam.canStart) return `승급 시험실. 문 위에 ${exam.rule.to}. 안에 불이 켜져 있다.`;
      if (exam.unlocked) return `승급 시험실. 문 위에 ${exam.rule.to}. 오늘은 불이 꺼졌다.`;
      return `승급 시험실. 문 위에 ${exam.rule.to}. 아직 열리지 않는다.`;
    }
    if (selected === "case") {
      if (story === "cleared") return "창 아래의 텔레비전은 꺼져 있다. 수사 기록이 남아 있다.";
      if (story === "open") return "창 아래의 텔레비전. 수사하던 방송이 멈춰 있다.";
      return "창 아래의 낡은 텔레비전이 혼자 켜져 있다. 새 사건이 접수됐다.";
    }
    return `기록 보관함. 서랍에 ${game.nickname}의 신분증이 들어 있다.`;
  })();

  // 줄마다: 테스트 이름(id), 낭독용 상태(label), 보이는 상태(state), 펼쳤을 때의 내용(body), 하는 일(go)
  const rows: Record<SpotId, { id: string; label: string; state: ReactNode; body: ReactNode; go: string }> = {
    board: {
      id: "daily-file",
      label: `오늘의 추리 ${dailyState}`,
      state: (
        <>
          오늘의 추리 [<span data-testid="daily-file-status">{dailyState}</span>]
        </>
      ),
      go: dailyProgress.status === "solved" ? "채점 기록 보기" : dailyProgress.status === "in_progress" ? "이어서 풀기" : "시험지 펼치기",
      body: (
        <>
          <span className="cmd__subject">{daily.title}</span>
          <span className="cmd__line">
            <span>{daily.typeLabel}</span>
            <span className="diamonds" role="img" aria-label={`난이도 5단계 중 ${daily.difficulty}단계`}>
              {Array.from({ length: 5 }, (_, i) => (
                <i key={i} data-on={i < daily.difficulty} />
              ))}
            </span>
            <span>{dailyProgress.status === "solved" ? "보상 받음" : `보상 +${daily.reward}`}</span>
          </span>
        </>
      ),
    },
    practice: {
      id: "practice-entry",
      label: `해결 ${practiceSolved}/${PRACTICE_PUZZLES.length}`,
      state: `해결 ${practiceSolved}/${PRACTICE_PUZZLES.length}`,
      go: "연습실 들어가기",
      body: (
        <span className="cmd__line">
          {practiceNext ? (
            <>
              <span>다음 과제</span>
              <span>{practiceNext.title}</span>
            </>
          ) : (
            <span>{practiceLocked ? "남은 서랍은 등급이 올라야 열린다." : "과제를 모두 풀었다. 다시 풀어 볼 수 있다."}</span>
          )}
        </span>
      ),
    },
    exam: exam.rule
      ? {
          // 시험실에 들어가 할 일이 있을 때만 exam-cta 다(응시 조건을 채우기 전, 오늘 횟수를 다 쓴 뒤에는 exam-wait)
          id: examOpen ? "exam-cta" : "exam-wait",
          label: examState,
          state: (
            <>
              {examState}
              <span className="sr-only">
                , 응시 조건 <span data-testid="promo-count">{`${exam.solved}/${exam.required}`}</span>
              </span>
            </>
          ),
          go: examActive ? "시험 이어서 풀기" : examFailed ? "시험 결과 보기" : exam.canStart ? "승급 시험 응시" : "시험실 들여다보기",
          body: examActive ? (
            <span className="cmd__line">
              <span>
                {examSession.index + 1}번 문제 {examSession.stage === "ready" ? "시험지가 기다린다" : "푸는 중"}
              </span>
              {examLeft !== null && <span className="num">남은 시간 {formatCountdown(examLeft)}</span>}
            </span>
          ) : examFailed ? (
            <span className="cmd__line">
              <span>등급은 그대로다.</span>
              {exam.attemptsLeft !== null && <span className="num">오늘 {exam.attemptsLeft}번 남음</span>}
            </span>
          ) : exam.unlocked ? (
            <span className="cmd__line">
              <span>
                {exam.rule.to}급 승급 시험 · <span className="num">{examTotal}문제</span>
              </span>
              <span>{exam.canStart ? "봉투가 기다린다." : "내일 다시 열린다."}</span>
            </span>
          ) : (
            <span className="cmd__need">
              <span>
                오늘의 추리·연습실 과제 <b className="num">{exam.solved}/{exam.required}</b>
              </span>
              <span className="meter" aria-hidden="true">
                {Array.from({ length: exam.required }, (_, i) => (
                  <i key={i} data-on={i < exam.solved} />
                ))}
              </span>
            </span>
          ),
        }
      : {
          id: "exam-record",
          label: `${game.rank}급 합격`,
          state: `${game.rank}급 합격`,
          go: "합격 기록 보기",
          body: (
            <span className="cmd__line">
              <span>{game.rank}급 승급 시험 합격</span>
              <span>{nextRank(game.rank) ? "" : "최고 등급"}</span>
            </span>
          ),
        },
    case: {
      id: "story-entry",
      label: `${STORY.title}, ${storyState}`,
      state: (
        <>
          {STORY.code} [<span data-testid="story-entry-status">{storyState}</span>]
        </>
      ),
      go: story === "cleared" ? "사건 기록 보기" : story === "open" ? "수사 이어서 하기" : "사건 파일 열기",
      body: (
        <span className="cmd__line">
          <span>{STORY.title}</span>
          <span className="num">{story === "cleared" ? "보상 받음" : `보상 +${storyChapter.reward}`}</span>
        </span>
      ),
    },
    archive: {
      id: "identity",
      label: `탐정 신분증, ${rankLabel(game.rank)} ${game.nickname}`,
      state: "탐정 신분증",
      go: "신분증 보기",
      body: (
        <span className="cmd__line">
          <span>{rankLabel(game.rank)}</span>
          <span>{game.nickname}</span>
        </span>
      ),
    },
  };

  return (
    <div className="screen hall hall--play inkworld" data-testid="home-screen" data-home="b" data-next={step} data-at={here ?? ""} data-rows={order.length}>
      <h1 className="sr-only">탐정학원 복도</h1>

      <header className="hall__top">
        <div className="hall__sign">
          <Crest />
          <p className="hall__name">
            <span>탐정학원</span>
            <span>DETECTIVE ACADEMY</span>
          </p>
        </div>
        <div className="hall__side">
          <p className="hall__rank leaf">
            <RankMark rank={game.rank} />
            <span data-testid="home-rank">{rankLabel(game.rank)}</span>
          </p>
          <p className="hall__purse">
            <i>수사 크레딧</i>
            <span className="num" data-testid="credit-balance" aria-label={`보유 수사 크레딧 ${game.credits}`}>
              <span aria-hidden="true">{game.credits.toLocaleString("ko-KR")}</span>
            </span>
          </p>
        </div>
      </header>

      <LiveScene
        ref={sceneRef}
        kind="side"
        make={() => new SideScene()}
        className="playscene"
        state={{
          dailySolved: dailyProgress.status === "solved",
          examRank: exam.rule ? exam.rule.to : game.rank,
          examOpen,
          mark: stepSpot && selected !== stepSpot ? stepSpot : null,
          caseStatus: story,
        }}
        onArrive={onArrive}
        onPick={look}
      />

      <Narration text={line} />

      <nav className="cmd" aria-label="갈 곳">
        {order.map((id) => {
          const row = rows[id];
          const on = selected === id;
          return (
            <button
              key={id}
              type="button"
              className="cmd__row"
              data-on={on}
              data-primary={stepSpot === id}
              data-spot={id}
              data-testid={row.id}
              aria-label={`${PLACE[id]}, ${row.label}, ${row.go}`}
              onClick={() => command(id)}
            >
              <span className="cmd__head">
                <span className="cmd__cursor" aria-hidden="true">
                  ▶
                </span>
                <span className="cmd__name">{PLACE[id]}</span>
                <span className="cmd__state">{row.state}</span>
              </span>
              {on && (
                <span className="cmd__body">
                  {row.body}
                  <span className="inkbtn inkbtn--block inkbtn--wine cmd__go" data-testid={id === "board" ? "daily-file-cta" : `${row.id}-go`}>
                    {row.go}
                  </span>
                </span>
              )}
            </button>
          );
        })}
        <p className="cmd__hint" aria-hidden="true">
          물건을 누르면 살펴본다 · 줄을 누르면 바로 들어간다
        </p>
      </nav>
    </div>
  );
}
