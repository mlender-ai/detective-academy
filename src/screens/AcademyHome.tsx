import { LiveScene, type LiveSceneHandle } from "../components/LiveScene";
import { Narration } from "../components/Narration";
import { useRef, useState } from "react";
import { nextStep, type NextStep } from "../app/flow";
import { prefersReducedMotion } from "../app/motion";
import { navigate, type Route } from "../app/router";
import { playSound } from "../app/sound";
import { useGame } from "../app/store";
import { CORRIDOR } from "../app/backdrop";
import { PenMark } from "../art/pixel";
import { CoinsArt, Crest, EnvelopeArt, IdArt, KeyArt, Pushpin, RankMark } from "../art/objects";
import { Stamp } from "../components/Stamp";
import { getDailyPuzzle, PRACTICE_PUZZLES, PUZZLE_BY_ID } from "../data/puzzles";
import { RANK_BY_ID, rankLabel } from "../data/ranks";
import { examStatus, getProgress } from "../engine/progressEngine";
import { formatElapsed, seoulDateKey, seoulDateLabel } from "../engine/time";
import type { PuzzleProgress } from "../engine/types";
import { DepthScene } from "../scene/depthScene";
import type { SpotId } from "../scene/homeScene";

/** 복도의 네 곳과 그곳에서 열리는 화면 (A안의 살아 있는 장면이 쓴다) */
const SPOT_ROUTE: Record<SpotId, Route> = {
  board: { name: "daily" },
  practice: { name: "practice" },
  exam: { name: "exam" },
  archive: { name: "profile" },
};

function postingCta(progress: PuzzleProgress): string {
  if (progress.status === "solved") return "채점 기록 보기";
  if (progress.status === "in_progress") return "이어서 풀기";
  return "시험지 펼치기";
}

/** 장면 아래의 서술 한 줄. 지금 할 일을 장면 묘사로 알려 준다. */
function narration(step: NextStep, progress: PuzzleProgress): string {
  if (step === "daily") {
    return progress.status === "in_progress"
      ? "풀다 만 시험지가 책상 위에 그대로 있다."
      : "자정이 가까운 복도. 게시판에 오늘의 사건이 붙어 있다.";
  }
  if (step === "exam") return "문틈으로 봉투가 들어와 있다. 승급 시험이다.";
  if (step === "practice") return "오늘의 사건은 끝났다. 연습실 문이 조금 열려 있다.";
  return "복도는 조용하다. 끝 교실의 불은 아직 켜져 있다.";
}

function postingStatus(progress: PuzzleProgress): string {
  if (progress.status === "solved") return "해결";
  if (progress.status === "in_progress") return `풀이 중 ${formatElapsed(progress.elapsedMs)}`;
  return "미해결";
}

/**
 * 학원 복도. 벽의 게시판에 오늘의 시험 공고가 붙어 있고,
 * 공고를 누르면 그 종이가 그대로 책상 위 시험지로 펼쳐진다.
 *
 * live 를 주면 A안 · 시네마틱 복도다(V3 GATE 02 비교안, ?home=a): 구성은 그대로이고 복도 그림만 살아 움직인다.
 * 갈 곳을 고르면 탐정이 그쪽으로 짧게 걸어가고(0.5~1.2초) 카메라가 따라간 뒤 화면이 바뀐다. 한 번 더 누르면 건너뛴다.
 */
export function AcademyHome({ live = false }: { live?: boolean }) {
  const game = useGame();
  const daily = getDailyPuzzle(seoulDateKey());
  const dailyProgress = getProgress(game, daily.id);
  const exam = examStatus(game);
  const step = nextStep(game);
  const [lifting, setLifting] = useState(false);
  const sceneRef = useRef<LiveSceneHandle<SpotId>>(null);
  /** 탐정이 걸어가고 있는 곳. 도착하면 그 화면으로 바뀐다. */
  const heading = useRef<SpotId | null>(null);

  /** 그곳으로 간다. 살아 있는 장면이 없으면(확정된 홈) 곧바로 화면을 바꾼다. */
  const head = (id: SpotId) => {
    const scene = sceneRef.current;
    if (!live || !scene) {
      navigate(SPOT_ROUTE[id]);
      return;
    }
    if (heading.current === id) {
      // 가는 중에 한 번 더 누르면 걷기를 건너뛴다
      scene.skip();
      return;
    }
    heading.current = id;
    scene.go(id);
  };

  const onArrive = (id: SpotId) => {
    if (heading.current !== id) return;
    navigate(SPOT_ROUTE[id]);
  };

  const practiceSolved = PRACTICE_PUZZLES.filter((p) => getProgress(game, p.id).status === "solved").length;
  const examPuzzle = exam.rule ? PUZZLE_BY_ID[exam.rule.examPuzzleIds[0]] : null;
  const examInProgress = examPuzzle ? getProgress(game, examPuzzle.id).status === "in_progress" : false;
  const solved = dailyProgress.status === "solved";

  // 공고를 누르면 압정이 빠지며 종이가 떠오르고, 곧바로 책상 위 시험지로 이어진다.
  const openDaily = () => {
    if (live) {
      if (!lifting) playSound("place");
      setLifting(true);
      head("board");
      return;
    }
    if (lifting) return;
    if (prefersReducedMotion()) {
      navigate({ name: "daily" });
      return;
    }
    setLifting(true);
    playSound("place");
    window.setTimeout(() => navigate({ name: "daily" }), 150);
  };

  return (
    <div className="screen hall inkworld" data-testid="home-screen" data-home={live ? "a" : undefined} data-next={step}>
      <h1 className="sr-only">탐정학원 복도</h1>

      {live ? (
        <LiveScene
          ref={sceneRef}
          kind="depth"
          make={() => new DepthScene()}
          className="hall__scene"
          state={{ dailySolved: solved, examRank: exam.rule ? exam.rule.to : game.rank, examOpen: exam.unlocked }}
          onArrive={onArrive}
        />
      ) : (
        <div className="hall__scene" aria-hidden="true">
          <img src={CORRIDOR.src} alt="" width={CORRIDOR.width} height={CORRIDOR.height} decoding="async" />
        </div>
      )}

      <header className="hall__top">
        <div className="hall__sign">
          <Crest />
          <p className="hall__name">
            <span>탐정학원</span>
            <span>DETECTIVE ACADEMY</span>
          </p>
        </div>
        <p className="hall__rank leaf">
          <RankMark rank={game.rank} />
          <span data-testid="home-rank">{rankLabel(game.rank)}</span>
        </p>
      </header>

      <Narration text={narration(step, dailyProgress)} />

      <section className="bulletin" aria-label="시험 게시판">
        <button
          type="button"
          className="posting"
          data-status={dailyProgress.status}
          data-primary={step === "daily"}
          data-lifting={lifting}
          data-testid="daily-file"
          onClick={openDaily}
        >
          <Pushpin className="posting__pin" />
          <span className="posting__leaf leaf" style={{ viewTransitionName: "exam-sheet" }}>
            <span className="posting__head">
              <span className="posting__title">오늘의 추리</span>
              <span className="posting__date num">{seoulDateLabel()}</span>
            </span>
            <span className="posting__subject">
              {daily.title}
              <span className="posting__status hand" data-testid="daily-file-status">
                {postingStatus(dailyProgress)}
              </span>
            </span>

            <span className="posting__meta">
              <span>
                <i>유형</i>
                <b>{daily.typeLabel}</b>
              </span>
              <span>
                <i>난이도</i>
                <b>
                  <span className="diamonds" role="img" aria-label={`5단계 중 ${daily.difficulty}단계`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <i key={i} data-on={i < daily.difficulty} />
                    ))}
                  </span>
                </b>
              </span>
              {solved ? (
                // 해결한 공고에는 보상 칸 자리에 인장이 찍힌다
                <span className="posting__sealed">
                  <Stamp className="posting__stamp" label="해결" size={78} />
                </span>
              ) : (
                <span>
                  <i>해결 보상</i>
                  <b className="num">+{daily.reward}</b>
                </span>
              )}
            </span>

            <span className={`inkbtn inkbtn--block posting__cta ${step === "daily" ? "inkbtn--wine" : ""}`} data-testid="daily-file-cta">
              {postingCta(dailyProgress)}
            </span>
          </span>
        </button>

        {exam.rule ? (
          <div className="promoslip" data-state={exam.unlocked ? "ready" : "locked"} data-testid="promo">
            <span className="promoslip__env">
              <EnvelopeArt />
              <Pushpin className="promoslip__pin" />
            </span>
            <div className="promoslip__tag leaf">
              <h2 className="promoslip__title">{exam.rule.to}급 승급 시험</h2>
              <p className="sr-only">
                응시 조건 <span data-testid="promo-count">{`${exam.doneCount}/${exam.requirements.length}`}</span> 완료
              </p>
              {exam.unlocked ? (
                <button
                  type="button"
                  className={`inkbtn inkbtn--sm inkbtn--block ${step === "exam" ? "inkbtn--wine" : ""}`}
                  onClick={() => head("exam")}
                  data-testid="exam-cta"
                >
                  {examInProgress ? "시험 이어서 풀기" : "승급 시험 응시"}
                </button>
              ) : (
                <ul className="promoslip__reqs">
                  {exam.requirements.map((req) => (
                    <li key={req.label} data-done={req.done}>
                      <span className="tickbox">{req.done && <PenMark kind="check" />}</span>
                      {req.label}
                      <span className="sr-only">{req.done ? " 완료" : " 미완료"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="promoslip" data-state="passed" data-testid="promo">
            <span className="promoslip__env">
              <EnvelopeArt open />
            </span>
            <div className="promoslip__tag leaf">
              <h2 className="promoslip__title">{game.rank}급 승급 시험 합격</h2>
              <p className="promoslip__note">{RANK_BY_ID[game.rank].title}이 되었습니다.</p>
              <button
                type="button"
                className="inkbtn inkbtn--sm inkbtn--block"
                onClick={() => head("exam")}
                data-testid="exam-record"
              >
                합격 기록 보기
              </button>
            </div>
          </div>
        )}
      </section>

      <nav className="ledge" aria-label="학원 안의 물건">

        <button
          type="button"
          className="ledge__item"
          data-primary={step === "practice"}
          onClick={() => head("practice")}
          data-testid="practice-entry"
        >
          <span className="ledge__art">
            <KeyArt />
            {step === "practice" && <PenMark kind="circle" draw delayMs={420} className="ledge__mark" />}
          </span>
          <span className="ledge__name">연습실</span>
          <span className="ledge__sub num">
            {step === "practice" ? "다음 과제 · " : ""}해결 {practiceSolved}/{PRACTICE_PUZZLES.length}
          </span>
        </button>

        <button
          type="button"
          className="ledge__item"
          onClick={() => head("archive")}
          aria-label={`${rankLabel(game.rank)} ${game.nickname}, 탐정 신분증 보기`}
          data-testid="identity"
        >
          <span className="ledge__art">
            <IdArt rank={game.rank} />
          </span>
          <span className="ledge__name">탐정 신분증</span>
          <span className="ledge__sub">{game.nickname}</span>
        </button>

        <p className="ledge__item ledge__item--coins">
          <span className="ledge__art">
            <CoinsArt />
          </span>
          <span className="ledge__name num" data-testid="credit-balance" aria-label={`보유 수사 크레딧 ${game.credits}`}>
            <span aria-hidden="true">{game.credits.toLocaleString("ko-KR")}</span>
          </span>
          <span className="ledge__sub">수사 크레딧</span>
        </p>
      </nav>
    </div>
  );
}
