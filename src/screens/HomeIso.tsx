import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { gameNow, todayKey } from "../app/clock";
import { nextStep, type NextStep } from "../app/flow";
import { prefersReducedMotion } from "../app/motion";
import { navigate, type Route } from "../app/router";
import { ensureContext, playSound } from "../app/sound";
import { gameStore, useGame } from "../app/store";
import { Crest, RankMark } from "../art/objects";
import { Narration } from "../components/Narration";
import { getDailyPuzzle, PRACTICE_PUZZLES } from "../data/puzzles";
import { nextRank, rankLabel } from "../data/ranks";
import { examRemainingMs, examStatus, getProgress, practiceUnlocked } from "../engine/progressEngine";
import { formatCountdown, formatElapsed } from "../engine/time";
import { IsoCanvas, type IsoHandle } from "../iso/IsoCanvas";
import type { HallDecor, HallSpot } from "../iso/hallArt";
import { HallScene } from "../iso/hallScene";
import { CASES } from "../story/cases";
import { caseStatus, chapterCleared, getChapter, nextChapter } from "../story/engine/storyEngine";

/** 지금 접수함에 들어 있는 사건 */
const STORY = CASES[0];

const ROUTE: Record<HallSpot, Route> = {
  board: { name: "daily" },
  practice: { name: "practice" },
  exam: { name: "exam" },
  archive: { name: "profile" },
  case: { name: "story", id: STORY.id },
};

/** 누르는 자리의 차례(키보드로 옮겨 다닐 때의 순서) */
const ORDER: HallSpot[] = ["board", "practice", "exam", "case", "archive"];

const PLACE: Record<HallSpot, string> = {
  board: "시험 게시판",
  practice: "연습실",
  exam: "승급 시험실",
  archive: "기록 보관함",
  case: "사건 접수함",
};

/** 장면 속 이름표(짧게) */
const TAG: Record<HallSpot, string> = {
  board: "게시판",
  practice: "연습실",
  exam: "시험실",
  archive: "보관함",
  case: "접수함",
};

/** 들어선 뒤 이름표를 모두 보여 주는 시간: 어디를 누를 수 있는지 한 번 훑어보게 한다 */
const TAGS_SHOWN_MS = 3200;

/** 들어갈 곳은 아니지만 눌러서 살펴볼 수 있는 것의 서술 */
const DECOR: Record<HallDecor, string> = {
  window: "높은 창에 빗물이 흘러내린다. 밖은 보이지 않는다.",
  bench: "창 아래의 긴 의자. 누군가 방금까지 앉아 있었던 것 같다.",
  stand: "우산꽂이에 젖은 우산이 둘. 먼저 온 사람이 있다.",
};

const STEP_SPOT: Record<NextStep, HallSpot | null> = { daily: "board", practice: "practice", exam: "exam", none: null };

/** 도착해서 화면이 바뀌기 전의 짧은 박자 */
const ARRIVE_BEAT_MS = 200;
/** 들어서자마자 탐정이 오늘 할 일 쪽으로 걸어가기 전의 뜸 */
const ENTRANCE_DELAY_MS = 420;

/**
 * 메인 홈 · 쿼터뷰 학원 홀 (2026-11-23, 사용자: "아예 ux가 달라졌으면 … 쿼터뷰로 본다던가"에 따라 만들었고, 같은 날 "쿼터뷰로"라고 골랐다).
 * 화면의 대부분이 방이다. 바닥을 누르면 탐정이 그리로 걷고, 문이나 물건을 누르면 그 앞까지 가서 살펴본다.
 * 갈 곳의 목록(명령 창)은 없다: 갈 곳은 방 안의 문과 물건이고, 아래의 창은 지금 선 곳의 이야기와 할 일 하나만 보여 준다.
 */
export function HomeIso() {
  const game = useGame();
  const daily = getDailyPuzzle(todayKey());
  const dailyProgress = getProgress(game, daily.id);
  const exam = examStatus(game, gameNow());
  const step = nextStep(game);
  const stepSpot = STEP_SPOT[step];

  const scene = useMemo(() => new HallScene(), []);
  const sceneRef = useRef<IsoHandle>(null);
  /** 탐정이 서 있는 곳 */
  const [here, setHere] = useState<HallSpot | null>(null);
  /** 걸어가는 곳. 처음에는 오늘 할 일이 있는 곳으로 간다. */
  const [heading, setHeading] = useState<HallSpot | null>(stepSpot);
  /** 사용자가 직접 어딘가를 골랐는가 (그 전에는 홀의 첫 서술을 그대로 둔다) */
  const [explored, setExplored] = useState(false);
  /** 방금 살펴본 것(창, 의자, 우산꽂이). 서술 한 줄이 그 이야기로 바뀐다. */
  const [decor, setDecor] = useState<HallDecor | null>(null);
  /** 들어선 직후인가: 그동안은 이름표를 모두 보여 준다 */
  const [fresh, setFresh] = useState(true);
  /** 도착하면 곧바로 들어갈 곳 */
  const enterOnArrive = useRef<HallSpot | null>(null);
  const touched = useRef(false);
  const leaving = useRef(false);
  const timers = useRef<number[]>([]);

  // 들어서면(그리고 오늘 할 일이 바뀌면) 탐정이 그곳으로 걸어가 그 앞에 선다. 사용자가 이미 다른 곳을 골랐으면 끼어들지 않는다.
  useEffect(() => {
    if (!stepSpot || touched.current || leaving.current) return;
    setHeading(stepSpot);
    const id = window.setTimeout(
      () => {
        if (!touched.current && !leaving.current) sceneRef.current?.go(stepSpot);
      },
      prefersReducedMotion() ? 0 : ENTRANCE_DELAY_MS,
    );
    return () => window.clearTimeout(id);
    // 오늘 할 일이 있는 곳이 바뀔 때만 다시 한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepSpot]);

  useEffect(() => {
    const id = window.setTimeout(() => setFresh(false), TAGS_SHOWN_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const list = timers.current;
    return () => {
      list.forEach((id) => window.clearTimeout(id));
      list.length = 0;
    };
  }, []);

  const leave = (id: HallSpot, beat: number) => {
    if (leaving.current) return;
    leaving.current = true;
    playSound("place");
    const wait = prefersReducedMotion() ? 0 : beat;
    if (wait === 0) navigate(ROUTE[id]);
    else timers.current.push(window.setTimeout(() => navigate(ROUTE[id]), wait));
  };

  const onArrive = (id: HallSpot) => {
    setHere(id);
    setHeading(null);
    if (enterOnArrive.current === id) {
      enterOnArrive.current = null;
      leave(id, ARRIVE_BEAT_MS);
    }
  };

  /** 바닥을 눌러 물건 앞을 떠났다 */
  const onLeave = () => {
    setHere(null);
    setHeading(null);
  };

  const onFloor = (what: HallDecor | null) => {
    if (leaving.current) return;
    touched.current = true;
    setExplored(true);
    enterOnArrive.current = null;
    setHere(null);
    setHeading(null);
    setDecor(what);
    playSound("tick");
  };

  /** 방 안의 문과 물건: 걸어가서 살펴본다. 그 앞에 서서 한 번 더 누르면 들어간다. */
  const look = (id: HallSpot) => {
    if (leaving.current) return;
    const handle = sceneRef.current;
    if (!handle) return;
    touched.current = true;
    setExplored(true);
    if (here === id && !handle.busy()) {
      leave(id, 0);
      return;
    }
    enterOnArrive.current = null;
    setDecor(null);
    setHere(null);
    setHeading(id);
    handle.go(id);
  };

  /** 아래 창의 주 단추: 그 앞이면 바로, 가는 중이면 도착하는 대로 들어간다 */
  const enter = (id: HallSpot) => {
    if (leaving.current) return;
    const handle = sceneRef.current;
    touched.current = true;
    setExplored(true);
    if (!handle) {
      navigate(ROUTE[id]);
      return;
    }
    if (here === id && !handle.busy()) {
      leave(id, 0);
      return;
    }
    enterOnArrive.current = id;
    setHeading(id);
    handle.go(id);
  };

  /** 음악 켜고 끄기. 음량과 효과음은 신분증 화면에 있다. */
  const toggleMusic = () => {
    // 사파리는 사용자의 조작 안에서 깨운 소리만 낸다
    ensureContext();
    gameStore.setMusic(!game.settings.music);
  };

  const selected = heading ?? here;
  const story = caseStatus(game, STORY);
  // 사건의 진행: 새 사건 / 수사 중 · 해결한 장 수 / 사건 해결. 보상은 풀 차례의 장의 것을 적는다.
  const storyChapter = nextChapter(game, STORY) ?? STORY.chapters[0];
  const storyCleared = STORY.chapters.filter((ch) => chapterCleared(getChapter(game, STORY, ch))).length;
  const storyState = story === "cleared" ? "사건 해결" : story === "open" ? `수사 중 · ${storyCleared}/${STORY.chapters.length}장` : "새 사건";
  const order = ORDER.filter((id) => id !== "case" || story !== "locked");
  const practiceSolved = PRACTICE_PUZZLES.filter((p) => getProgress(game, p.id).status === "solved").length;
  const practiceNext = PRACTICE_PUZZLES.find((p) => practiceUnlocked(game, p) && getProgress(game, p.id).status !== "solved") ?? null;
  const practiceLocked = PRACTICE_PUZZLES.some((p) => !practiceUnlocked(game, p));
  const examSession = exam.session;
  const examActive = examSession?.status === "active";
  const examFailed = examSession?.status === "failed";
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
      if (explored && decor) return DECOR[decor];
      if (explored) return "비 내리는 밤의 학원 홀. 빗소리뿐이다.";
      if (step === "daily") {
        return dailyProgress.status === "in_progress" ? "풀다 만 시험지가 게시판에 그대로 붙어 있다." : "비 내리는 밤의 학원 홀. 게시판에 오늘의 사건이 붙어 있다.";
      }
      if (step === "exam") {
        if (examActive) return "시험실에 풀다 만 시험지가 놓여 있다.";
        if (examFailed) return "시험실 문에 쪽지가 붙어 있다. 시험이 끝났다.";
        return "시험실 유리에 불이 켜져 있다. 승급 시험이다.";
      }
      if (step === "practice") return "오늘의 사건은 끝났다. 연습실에 풀지 않은 과제가 남아 있다.";
      return "홀은 조용하다. 창에 빗물만 흘러내린다.";
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
      if (exam.canStart) return `승급 시험실. 문 위에 ${exam.rule.to}. 유리에 불이 켜져 있다.`;
      if (exam.unlocked) return `승급 시험실. 문 위에 ${exam.rule.to}. 오늘은 불이 꺼졌다.`;
      return `승급 시험실. 문 위에 ${exam.rule.to}. 아직 열리지 않는다.`;
    }
    if (selected === "case") {
      if (story === "cleared") return "낡은 텔레비전은 꺼져 있다. 수사 기록이 남아 있다.";
      if (story === "open") return "낡은 텔레비전. 수사하던 방송이 멈춰 있다.";
      return "낡은 텔레비전이 혼자 켜져 있다. 새 사건이 접수됐다.";
    }
    return `기록 보관함. 서랍에 ${game.nickname}의 신분증이 들어 있다.`;
  })();

  // 곳마다: 테스트 이름(id), 상태 한 줄(state), 테스트가 읽는 값(probe. 누르는 자리 안에 숨겨 둔다), 창에 적는 내용(body), 하는 일(go)
  const rows: Record<HallSpot, { id: string; state: string; probe?: ReactNode; body: ReactNode; go: string }> = {
    board: {
      id: "daily-file",
      state: `오늘의 추리 [${dailyState}]`,
      probe: <span data-testid="daily-file-status">{dailyState}</span>,
      go: dailyProgress.status === "solved" ? "채점 기록 보기" : dailyProgress.status === "in_progress" ? "이어서 풀기" : "시험지 펼치기",
      body: (
        <>
          <span className="isocard__subject">{daily.title}</span>
          <span className="isocard__line">
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
      state: `해결 ${practiceSolved}/${PRACTICE_PUZZLES.length}`,
      go: "연습실 들어가기",
      body: (
        <span className="isocard__line">
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
          id: examOpen ? "exam-cta" : "exam-wait",
          state: examState,
          probe: <span data-testid="promo-count">{`${exam.solved}/${exam.required}`}</span>,
          go: examActive ? "시험 이어서 풀기" : examFailed ? "시험 결과 보기" : exam.canStart ? "승급 시험 응시" : "시험실 들여다보기",
          body: examActive ? (
            <span className="isocard__line">
              <span>
                {examSession.index + 1}번 문제 {examSession.stage === "ready" ? "시험지가 기다린다" : "푸는 중"}
              </span>
              {examLeft !== null && <span className="num">남은 시간 {formatCountdown(examLeft)}</span>}
            </span>
          ) : examFailed ? (
            <span className="isocard__line">
              <span>등급은 그대로다.</span>
              {exam.attemptsLeft !== null && <span className="num">오늘 {exam.attemptsLeft}번 남음</span>}
            </span>
          ) : exam.unlocked ? (
            <span className="isocard__line">
              <span>
                {exam.rule.to}급 승급 시험 · <span className="num">{examTotal}문제</span>
              </span>
              <span>{exam.canStart ? "봉투가 기다린다." : "내일 다시 열린다."}</span>
            </span>
          ) : (
            <span className="isocard__line">
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
          state: `${game.rank}급 합격`,
          go: "합격 기록 보기",
          body: (
            <span className="isocard__line">
              <span>{game.rank}급 승급 시험 합격</span>
              <span>{nextRank(game.rank) ? "" : "최고 등급"}</span>
            </span>
          ),
        },
    case: {
      id: "story-entry",
      state: `${STORY.code} [${storyState}]`,
      probe: <span data-testid="story-entry-status">{storyState}</span>,
      go: story === "cleared" ? "사건 기록 보기" : story === "open" ? "수사 이어서 하기" : "사건 파일 열기",
      body: (
        <span className="isocard__line">
          <span>{story === "open" ? `제${storyChapter.no}장 · ${storyChapter.title}` : STORY.title}</span>
          <span className="num">{story === "cleared" ? "보상 받음" : `보상 +${storyChapter.reward}`}</span>
        </span>
      ),
    },
    archive: {
      id: "identity",
      state: "탐정 신분증",
      go: "신분증 보기",
      body: (
        <span className="isocard__line">
          <span>{rankLabel(game.rank)}</span>
          <span>{game.nickname}</span>
        </span>
      ),
    },
  };

  const card = selected ? rows[selected] : null;

  return (
    <div className="screen hall hall--iso inkworld" data-testid="home-screen" data-home="iso" data-next={step} data-at={here ?? ""} data-heading={heading ?? ""}>
      <h1 className="sr-only">탐정학원 홀</h1>

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

      <IsoCanvas
        ref={sceneRef}
        scene={scene}
        state={{
          dailySolved: dailyProgress.status === "solved",
          examRank: exam.rule ? exam.rule.to : game.rank,
          examOpen,
          mark: stepSpot && selected !== stepSpot ? stepSpot : null,
          caseStatus: story,
        }}
        onArrive={onArrive}
        onLeave={onLeave}
        onFloor={onFloor}
        caption={
          <>
            <Narration text={line} />
            {/* 음악은 기본이 꺼짐이다. 켜는 곳을 방 한쪽에 둔다(자세한 설정은 신분증 화면). */}
            <button type="button" className="isomusic" role="switch" aria-checked={game.settings.music} aria-label="음악" onClick={toggleMusic} data-testid="iso-music">
              <span aria-hidden="true">음악 {game.settings.music ? "켬" : "끔"}</span>
            </button>
          </>
        }
      >
        {order.map((id) => {
          const [x, y, w, h] = scene.hitRect(id);
          const [tx, ty] = scene.tagAt(id);
          const row = rows[id];
          // 이름표는 오늘 할 일이 있는 곳과 지금 고른 곳에만 늘 떠 있다. 나머지는 들어선 직후와, 아무 곳도 고르지 않고 둘러볼 때만 보인다.
          const tagged = id === stepSpot || id === selected || fresh || !selected;
          return (
            <button
              key={id}
              type="button"
              className="isospot"
              data-tag={tagged}
              style={{ left: x * 2, top: y * 2, width: w * 2, height: h * 2 }}
              data-spot={id}
              data-on={selected === id}
              data-primary={stepSpot === id}
              data-testid={row.id}
              aria-label={`${PLACE[id]}, ${row.state}`}
              onClick={() => look(id)}
            >
              <span className="isotag" style={{ left: (tx - x) * 2, top: (ty - y) * 2 }} aria-hidden="true">
                {stepSpot === id && <b>!</b>}
                {TAG[id]}
              </span>
              {row.probe && <span className="sr-only">{row.probe}</span>}
            </button>
          );
        })}
      </IsoCanvas>

      <section className="isowin">
        {card && selected ? (
          <div className="isocard" key={selected} data-spot={selected}>
            <p className="isocard__head">
              <span aria-hidden="true">▶</span>
              <span className="isocard__name">{PLACE[selected]}</span>
              <span className="isocard__state" aria-hidden="true">
                {card.state}
              </span>
            </p>
            <div className="isocard__body">{card.body}</div>
            <button type="button" className="inkbtn inkbtn--block inkbtn--wine isocard__go" data-testid={selected === "board" ? "daily-file-cta" : `${card.id}-go`} onClick={() => enter(selected)}>
              {card.go}
            </button>
          </div>
        ) : (
          <div className="isowin__idle">
            <p className="isowin__hint">문이나 물건을 누르면 다가가 살펴본다 · 바닥을 누르면 걷는다</p>
            {stepSpot && (
              <button type="button" className="inkbtn inkbtn--block isowin__todo" data-testid="iso-todo" onClick={() => look(stepSpot)}>
                오늘 할 일: {PLACE[stepSpot]}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
