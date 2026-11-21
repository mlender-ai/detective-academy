import { useEffect, useRef, useState, type ReactNode } from "react";
import { nextStep, type NextStep } from "../app/flow";
import { prefersReducedMotion } from "../app/motion";
import { navigate, type Route } from "../app/router";
import { playSound } from "../app/sound";
import { useGame } from "../app/store";
import { PenMark } from "../art/pixel";
import { Crest, RankMark } from "../art/objects";
import { LiveScene, type LiveSceneHandle } from "../components/LiveScene";
import { Narration } from "../components/Narration";
import { getDailyPuzzle, PRACTICE_PUZZLES, PUZZLE_BY_ID } from "../data/puzzles";
import { rankLabel } from "../data/ranks";
import { examStatus, getProgress } from "../engine/progressEngine";
import { formatElapsed, seoulDateKey } from "../engine/time";
import type { SpotId } from "../scene/homeScene";

/** 복도의 네 곳과 그곳에서 열리는 화면 */
const ROUTE: Record<SpotId, Route> = {
  board: { name: "daily" },
  practice: { name: "practice" },
  exam: { name: "exam" },
  archive: { name: "profile" },
};

const ORDER: SpotId[] = ["board", "practice", "exam", "archive"];

const PLACE: Record<SpotId, string> = {
  board: "시험 게시판",
  practice: "연습실",
  exam: "승급 시험실",
  archive: "기록 보관함",
};

const STEP_SPOT: Record<NextStep, SpotId | null> = { daily: "board", practice: "practice", exam: "exam", none: null };

/** 도착해서 화면이 바뀌기 전의 짧은 박자: 게시판을 짚고, 문이 열린다 */
const ARRIVE_BEAT_MS = 200;
/** 들어서자마자 탐정이 오늘 할 일 쪽으로 걸어가기 전의 뜸 */
const ENTRANCE_DELAY_MS = 420;

/**
 * 메인 홈 B안 · 플레이 가능한 복도 (V3 GATE 02 비교안, ?home=b).
 * 복도가 게임 장면이다. 장면의 물건을 누르면 탐정이 그 앞으로 걸어가 살펴보고,
 * 아래 명령 창의 줄을 누르면 걸어가서 곧바로 들어간다(빠른 진입). 걷는 중에 한 번 더 누르면 건너뛴다.
 */
export function HomePlayable() {
  const game = useGame();
  const daily = getDailyPuzzle(seoulDateKey());
  const dailyProgress = getProgress(game, daily.id);
  const exam = examStatus(game);
  const step = nextStep(game);
  const stepSpot = STEP_SPOT[step];

  const sceneRef = useRef<LiveSceneHandle>(null);
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

  useEffect(() => {
    const list = timers.current;
    // 들어서면 탐정이 오늘 할 일이 있는 곳으로 걸어가 그 앞에 선다. 기다릴 필요는 없다: 그동안에도 모든 것을 누를 수 있다.
    if (stepSpot) {
      list.push(
        window.setTimeout(() => {
          if (!touched.current) sceneRef.current?.go(stepSpot);
        }, ENTRANCE_DELAY_MS),
      );
    }
    return () => {
      list.forEach((id) => window.clearTimeout(id));
      list.length = 0;
    };
    // 들어설 때 한 번만 한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (scene.busy() && heading === id) {
      // 가는 중에 한 번 더 누르면 걷기를 건너뛴다
      scene.skip();
      return;
    }
    setHeading(id);
    scene.go(id);
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
    scene.go(id);
  };

  const selected = heading ?? here;
  const practiceSolved = PRACTICE_PUZZLES.filter((p) => getProgress(game, p.id).status === "solved").length;
  const practiceNext = PRACTICE_PUZZLES.find((p) => getProgress(game, p.id).status !== "solved") ?? null;
  const examPuzzle = exam.rule ? PUZZLE_BY_ID[exam.rule.examPuzzleIds[0]] : null;
  const examInProgress = examPuzzle ? getProgress(game, examPuzzle.id).status === "in_progress" : false;
  const dailyState =
    dailyProgress.status === "solved" ? "해결" : dailyProgress.status === "in_progress" ? `풀이 중 ${formatElapsed(dailyProgress.elapsedMs)}` : "미해결";

  const line = (() => {
    if (!explored || !selected) {
      if (step === "daily") {
        return dailyProgress.status === "in_progress"
          ? "풀다 만 시험지가 게시판에 그대로 붙어 있다."
          : "자정이 가까운 복도. 게시판에 오늘의 사건이 붙어 있다.";
      }
      if (step === "exam") return "시험실 문 안에 불이 켜져 있다. 승급 시험이다.";
      if (step === "practice") return "오늘의 사건은 끝났다. 연습실에 풀지 않은 과제가 남아 있다.";
      return "복도는 조용하다. 창밖의 나뭇가지만 흔들린다.";
    }
    if (selected === "board") {
      if (dailyProgress.status === "solved") return "게시판 앞. 오늘의 사건에는 해결 도장이 찍혀 있다.";
      if (dailyProgress.status === "in_progress") return "게시판 앞. 풀다 만 시험지가 그대로 붙어 있다.";
      return `게시판 앞. 오늘의 사건은 「${daily.title}」.`;
    }
    if (selected === "practice") {
      return practiceNext ? "연습실 문이 열린다. 풀지 않은 과제가 남아 있다." : "연습실 문이 열린다. 과제는 모두 풀었다.";
    }
    if (selected === "exam") {
      if (!exam.rule) return `승급 시험실. 문 위에 ${game.rank}. 합격 기록이 남아 있다.`;
      if (exam.unlocked) return `승급 시험실. 문 위에 ${exam.rule.to}. 안에 불이 켜져 있다.`;
      return `승급 시험실. 문 위에 ${exam.rule.to}. 아직 열리지 않는다.`;
    }
    return `기록 보관함. 서랍에 ${game.nickname}의 신분증이 들어 있다.`;
  })();

  const rows: Record<SpotId, { state: string; body: ReactNode; go: string }> = {
    board: {
      state: `오늘의 추리 [${dailyState}]`,
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
            <span>과제를 모두 풀었다. 다시 풀어 볼 수 있다.</span>
          )}
        </span>
      ),
    },
    exam: exam.rule
      ? {
          state: exam.unlocked ? `${exam.rule.to}급 응시 가능` : `${exam.rule.to}급 조건 ${exam.doneCount}/${exam.requirements.length}`,
          go: exam.unlocked ? (examInProgress ? "시험 이어서 풀기" : "승급 시험 응시") : "시험실 들여다보기",
          body: exam.unlocked ? (
            <span className="cmd__line">
              <span>{exam.rule.to}급 승급 시험</span>
              <span>봉투가 기다린다.</span>
            </span>
          ) : (
            <ul className="cmd__reqs">
              {exam.requirements.map((req) => (
                <li key={req.label} data-done={req.done}>
                  <span className="tickbox">{req.done && <PenMark kind="check" />}</span>
                  {req.label}
                  <span className="sr-only">{req.done ? " 완료" : " 미완료"}</span>
                </li>
              ))}
            </ul>
          ),
        }
      : {
          state: `${game.rank}급 합격`,
          go: "합격 기록 보기",
          body: (
            <span className="cmd__line">
              <span>{game.rank}급 승급 시험 합격</span>
            </span>
          ),
        },
    archive: {
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
    <div className="screen hall hall--play inkworld" data-testid="home-screen" data-home="b" data-next={step} data-at={here ?? ""}>
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
        className="playscene"
        state={{
          dailySolved: dailyProgress.status === "solved",
          examRank: exam.rule ? exam.rule.to : game.rank,
          examOpen: exam.unlocked,
          mark: stepSpot && selected !== stepSpot ? stepSpot : null,
        }}
        onArrive={onArrive}
        onPick={look}
      />

      <Narration text={line} />

      <nav className="cmd" aria-label="갈 곳">
        {ORDER.map((id) => {
          const row = rows[id];
          const on = selected === id;
          return (
            <button
              key={id}
              type="button"
              className="cmd__row"
              data-on={on}
              data-primary={stepSpot === id}
              data-testid={`cmd-${id}`}
              aria-label={`${PLACE[id]}, ${row.state}, ${row.go}`}
              onClick={() => command(id)}
            >
              <span className="cmd__head">
                <span className="cmd__cursor" aria-hidden="true">
                  ▶
                </span>
                <span className="cmd__name">{PLACE[id]}</span>
                <span className="cmd__state" data-testid={`cmd-${id}-state`}>
                  {row.state}
                </span>
              </span>
              {on && (
                <span className="cmd__body">
                  {row.body}
                  <span className="inkbtn inkbtn--block inkbtn--wine cmd__go" data-testid={`cmd-${id}-go`}>
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
