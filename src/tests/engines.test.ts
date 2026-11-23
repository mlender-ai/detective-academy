import { describe, expect, it } from "vitest";
import { DAILY_SET } from "../data/dailySet";
import { ALL_PUZZLES, DAILY_CALENDAR, DAILY_CODE, EXAM_SCHEDULE, PRACTICE_PUZZLES, PRACTICE_TRUTH, PUZZLE_BY_ID, dailyIndex, getDailyPuzzle, practiceOfRank } from "../data/puzzles";
import { PROMOTION_RULES, RANKS, submitLimit } from "../data/ranks";
import { CREDIT_POLICY, canAfford, hintCost, policyReward, spend } from "../engine/creditEngine";
import {
  addElapsed,
  buildDemoState,
  canPlay,
  createInitialState,
  DEMO_PRESETS,
  dismissExam,
  enroll,
  examRemainingMs,
  examStatus,
  getProgress,
  hintsAllowed,
  hydrate,
  openExamSheet,
  practiceUnlocked,
  recordInput,
  rename,
  requestHint,
  startExam,
  submitAnswer,
  tasksSolved,
  tickExam,
} from "../engine/progressEngine";
import { addDays, daysBetween, formatCountdown, formatDuration, formatElapsed, isDateKey, seoulDateKey } from "../engine/time";
import type { GameState, Puzzle } from "../engine/types";

const NOW = new Date("2026-11-22T03:00:00Z"); // 서울 11월 22일 정오: 오늘의 추리는 '자료실 금고의 암호'
const later = (ms: number) => new Date(NOW.getTime() + ms);
const MIN = 60_000;
const DAY = 86_400_000;

function enrolled(): GameState {
  return enroll(createInitialState(), "시험용 탐정", "DA-123456", NOW);
}

const rule = (from: string) => PROMOTION_RULES.find((r) => r.from === from)!;
const puzzlesOf = (from: string) => rule(from).examPuzzleIds.map((id) => PUZZLE_BY_ID[id]);

/** 정답이 아닌 답 하나 */
function wrongAnswer(puzzle: Puzzle): unknown {
  switch (puzzle.type) {
    case "code":
      return [...puzzle.solution].reverse();
    case "truth":
      return puzzle.rules.people.find((p) => p.id !== puzzle.solution)!.id;
    case "schedule":
      return [...puzzle.solution].reverse();
    case "evidence":
      return { statement: puzzle.solution.statement, against: puzzle.rules.cards.find((c) => c.kind !== "statement" && c.id !== puzzle.solution.against)!.id };
    case "spatial":
      return { stamp: puzzle.solution.stamp, turn: (puzzle.solution.turn + 1) % 4 };
  }
}

describe("크레딧 정책", () => {
  it("최초 40, 힌트 20 → 40", () => {
    expect(CREDIT_POLICY.initial).toBe(40);
    expect(hintCost(0)).toBe(20);
    expect(hintCost(1)).toBe(40);
    expect(hintCost(2)).toBeNull();
  });

  it("잔액이 모자라면 차감하지 않고 음수가 되지 않는다", () => {
    expect(canAfford(20, 40)).toBe(false);
    expect(spend(20, 40)).toEqual({ ok: false, credits: 20 });
    expect(spend(40, 40)).toEqual({ ok: true, credits: 0 });
    expect(spend(0, 20)).toEqual({ ok: false, credits: 0 });
  });

  it("모든 문제의 보상이 정책표와 같다: 오늘의 추리 60, 연습 과제는 등급별, 특수 도전 60, 시험 문제는 0", () => {
    for (const puzzle of ALL_PUZZLES) {
      expect(puzzle.reward, puzzle.id).toBe(policyReward(puzzle.category, puzzle.rank, puzzle.special));
    }
    expect(policyReward("daily", "F")).toBe(60);
    expect(["F", "D", "C", "B", "A"].map((rank) => policyReward("practice", rank as never))).toEqual([30, 35, 40, 45, 50]);
    expect(policyReward("exam", "A")).toBe(0);
    // 특수 도전은 놓인 서랍의 등급과 무관하다: 가장 높은 연습 보상보다 크고, 가장 낮은 합격 보상보다 작다
    expect(["F", "C", "A"].map((rank) => policyReward("practice", rank as never, true))).toEqual([60, 60, 60]);
    expect(CREDIT_POLICY.special).toBeGreaterThan(Math.max(...Object.values(CREDIT_POLICY.practice)));
    expect(CREDIT_POLICY.special).toBeLessThan(Math.min(...PROMOTION_RULES.map((r) => r.reward)));
    // 특수 도전이 아닌 것에는 붙지 않는다
    expect(policyReward("daily", "F", true)).toBe(60);
    expect(policyReward("exam", "A", true)).toBe(0);
  });

  it("밸런스의 뼈대: 문제 하나의 보상은 첫 힌트보다 크고, 힌트 두 단계의 값을 넘지 않는다", () => {
    const full = CREDIT_POLICY.hintCosts.reduce((a, b) => a + b, 0);
    for (const puzzle of ALL_PUZZLES.filter((p) => p.category !== "exam")) {
      expect(puzzle.reward, puzzle.id).toBeGreaterThan(CREDIT_POLICY.hintCosts[0]);
      expect(puzzle.reward, puzzle.id).toBeLessThanOrEqual(full);
    }
    // 연습 과제를 모두 풀어 받는 총액(GATE 05 의 600 + 더한 F·D·C 둘씩 210 + 특수 도전 60)과, 승급 보상의 총액
    expect(PRACTICE_PUZZLES.reduce((sum, p) => sum + p.reward, 0)).toBe(870);
    expect(PROMOTION_RULES.reduce((sum, r) => sum + r.reward, 0)).toBe(660);
  });

  it("문제마다 힌트를 끝까지 여는 사람은 잔액이 줄어 두 번째 힌트를 못 열게 되고, 그래도 문제는 풀 수 있다", () => {
    let state = enrolled();
    let blocked = 0;
    for (const puzzle of practiceOfRank("F")) {
      state = requestHint(state, puzzle).state;
      const second = requestHint(state, puzzle);
      if (second.outcome.kind === "insufficient") blocked += 1;
      state = submitAnswer(second.state, puzzle, puzzle.solution, NOW).state;
      expect(getProgress(state, puzzle.id).status).toBe("solved");
      expect(state.credits).toBeGreaterThanOrEqual(0);
    }
    expect(blocked).toBeGreaterThan(0);
    // 그래도 다음 문제의 첫 힌트는 살 수 있다
    expect(state.credits).toBeGreaterThanOrEqual(CREDIT_POLICY.hintCosts[0]);
  });
});

describe("입학", () => {
  it("F급 견습 탐정으로 등록되고 40 크레딧을 받는다", () => {
    const state = enrolled();
    expect(state.enrolled).toBe(true);
    expect(state.rank).toBe("F");
    expect(state.credits).toBe(40);
    expect(state.nickname).toBe("시험용 탐정");
    expect(state.exam).toBeNull();
  });

  it("두 번 입학해도 크레딧은 한 번만 지급된다", () => {
    const again = enroll(enrolled(), "다른 이름", "DA-999999", NOW);
    expect(again.credits).toBe(40);
    expect(again.nickname).toBe("시험용 탐정");
  });

  it("닉네임은 10자로 자르고 빈 이름으로 바꿀 수 없다", () => {
    expect(rename(enrolled(), "  열한글자를넘어가는이름입니다  ").nickname).toBe("열한글자를넘어가는이");
    expect(rename(enrolled(), "   ").nickname).toBe("시험용 탐정");
  });
});

describe("힌트", () => {
  it("1단계는 20을 차감하고, 잔액이 모자란 2단계는 열리지 않는다", () => {
    const first = requestHint(enrolled(), DAILY_CODE);
    expect(first.outcome).toEqual({ kind: "opened", tier: 0, cost: 20 });
    expect(first.state.credits).toBe(20);
    expect(getProgress(first.state, DAILY_CODE.id).hintsUsed).toBe(1);

    const second = requestHint(first.state, DAILY_CODE);
    expect(second.outcome).toEqual({ kind: "insufficient", tier: 1, cost: 40, shortBy: 20 });
    expect(second.state).toBe(first.state);
    expect(second.state.credits).toBe(20);
  });

  it("힌트는 두 단계까지만 있다", () => {
    let state = { ...enrolled(), credits: 500 };
    state = requestHint(state, DAILY_CODE).state;
    state = requestHint(state, DAILY_CODE).state;
    expect(state.credits).toBe(440);
    const third = requestHint(state, DAILY_CODE);
    expect(third.outcome).toEqual({ kind: "exhausted" });
    expect(third.state.credits).toBe(440);
  });

  it("힌트를 아무리 요청해도 잔액은 음수가 되지 않는다", () => {
    let state = enrolled();
    for (let i = 0; i < 10; i++) {
      state = requestHint(state, DAILY_CODE).state;
      state = requestHint(state, PRACTICE_TRUTH).state;
      expect(state.credits).toBeGreaterThanOrEqual(0);
    }
    expect(state.credits).toBe(0);
  });
});

describe("추론 제출과 보상", () => {
  it("오답은 시도 횟수만 늘고 보상이 없다", () => {
    const { state, outcome } = submitAnswer(enrolled(), DAILY_CODE, [1, 2, 3], NOW);
    expect(outcome.correct).toBe(false);
    expect(outcome.reward).toBe(0);
    expect(state.credits).toBe(40);
    expect(getProgress(state, DAILY_CODE.id)).toMatchObject({ status: "in_progress", attempts: 1 });
  });

  it("정답은 +60을 지급하고 기록을 남긴다", () => {
    let state = addElapsed(enrolled(), DAILY_CODE.id, 83_000);
    const result = submitAnswer(state, DAILY_CODE, [4, 2, 6], NOW);
    state = result.state;
    expect(result.outcome).toMatchObject({ correct: true, reward: 60, firstSolve: true, noHint: true, exam: null });
    expect(state.credits).toBe(100);
    expect(getProgress(state, DAILY_CODE.id)).toMatchObject({
      status: "solved",
      rewardClaimed: true,
      solvedElapsedMs: 83_000,
      solvedAttempts: 1,
      solvedHints: 0,
      solvedDateKey: "2026-11-22",
    });
  });

  it("같은 문제를 다시 맞혀도 보상은 다시 지급되지 않는다", () => {
    let state = submitAnswer(enrolled(), DAILY_CODE, [4, 2, 6], NOW).state;
    for (let i = 0; i < 5; i++) {
      const again = submitAnswer(state, DAILY_CODE, [4, 2, 6], NOW);
      expect(again.outcome).toMatchObject({ correct: true, reward: 0, firstSolve: false });
      state = again.state;
    }
    expect(state.credits).toBe(100);
    expect(getProgress(state, DAILY_CODE.id).attempts).toBe(1);
  });

  it("힌트를 쓰고 맞히면 '힌트 미사용' 기록이 남지 않는다", () => {
    const hinted = requestHint(enrolled(), DAILY_CODE).state;
    const result = submitAnswer(hinted, DAILY_CODE, [4, 2, 6], NOW);
    expect(result.outcome.noHint).toBe(false);
    expect(result.state.credits).toBe(80);
    expect(getProgress(result.state, DAILY_CODE.id).solvedHints).toBe(1);
  });

  it("풀이 중 입력값이 저장되고 해결 후에는 시간이 더 쌓이지 않는다", () => {
    let state = recordInput(enrolled(), DAILY_CODE.id, { type: "code", dials: [4, 2, 1], memo: { "5": "out" } });
    expect(getProgress(state, DAILY_CODE.id)).toMatchObject({
      status: "in_progress",
      input: { type: "code", dials: [4, 2, 1], memo: { "5": "out" } },
    });
    state = addElapsed(state, DAILY_CODE.id, 10_000);
    state = submitAnswer(state, DAILY_CODE, [4, 2, 6], NOW).state;
    state = addElapsed(state, DAILY_CODE.id, 99_000);
    expect(getProgress(state, DAILY_CODE.id).elapsedMs).toBe(10_000);
  });
});

describe("오늘의 추리: 날짜별 배정", () => {
  it("시작일에 '자료실 금고의 암호'가 붙고, 그 뒤 열세 날은 일일 문제 열세 개가 차례로 붙는다", () => {
    expect(DAILY_CALENDAR.start).toBe("2026-11-22");
    expect(getDailyPuzzle("2026-11-22")).toBe(DAILY_CODE);
    DAILY_SET.forEach((puzzle, i) => {
      expect(getDailyPuzzle(addDays("2026-11-22", i + 1)), puzzle.id).toBe(puzzle);
    });
    expect(DAILY_SET).toHaveLength(13);
    expect(DAILY_CALENDAR.order).toHaveLength(14);
    expect(new Set(DAILY_CALENDAR.order).size).toBe(14);
    expect(DAILY_CALENDAR.order.every((id) => PUZZLE_BY_ID[id]?.category === "daily")).toBe(true);
    // 일일 문제는 모두 달력에 있다
    expect(ALL_PUZZLES.filter((p) => p.category === "daily").every((p) => DAILY_CALENDAR.order.includes(p.id))).toBe(true);
  });

  it("같은 날짜에는 누구에게나 같은 문제가 붙고, 달력이 끝나면 처음으로 돌아가지 않는다", () => {
    // 앞 여덟 날의 배정은 문제가 늘어도 그대로다: 아흐레째(11월 30일)부터 둘째 주의 문제가 붙는다
    expect(getDailyPuzzle("2026-11-29")).toBe(DAILY_SET[6]);
    expect(getDailyPuzzle("2026-11-30")).toBe(DAILY_SET[7]);
    expect(getDailyPuzzle("2026-12-05")).toBe(DAILY_SET[12]);
    // 열닷새째부터는 오늘의 추리가 없다: 첫 문제를 새 문제처럼 다시 붙이지 않는다 (자세한 것은 daily-calendar.test.ts)
    expect(getDailyPuzzle("2026-12-06")).toBeNull();
    expect(getDailyPuzzle("2026-12-07")).toBeNull();
    expect(dailyIndex("2027-03-01")).toBeNull();
    // 시작일 이전에도 붙은 문제가 없다
    expect(getDailyPuzzle("2026-11-21")).toBeNull();
    expect(getDailyPuzzle("2026-11-08")).toBeNull();
    // 깨진 날짜에도 문제를 내지 않는다
    expect(getDailyPuzzle("어제")).toBeNull();
  });

  it("날짜 계산", () => {
    expect(isDateKey("2026-11-22")).toBe(true);
    expect(isDateKey("2026-1-2")).toBe(false);
    expect(isDateKey(null)).toBe(false);
    expect(daysBetween("2026-11-22", "2026-12-01")).toBe(9);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("날짜가 바뀌면 새 문제가 미해결로 붙고, 어제 푼 문제의 기록은 남는다", () => {
    let state = submitAnswer(enrolled(), getDailyPuzzle(seoulDateKey(NOW))!, [4, 2, 6], NOW).state;
    const tomorrow = later(DAY);
    const next = getDailyPuzzle(seoulDateKey(tomorrow))!;
    expect(next).toBe(DAILY_SET[0]);
    expect(getProgress(state, next.id).status).toBe("new");
    state = submitAnswer(state, next, next.solution, tomorrow).state;
    expect(tasksSolved(state)).toBe(2);
    expect(state.credits).toBe(40 + 60 + 60);
    expect(getProgress(state, DAILY_CODE.id).solvedDateKey).toBe("2026-11-22");
    expect(getProgress(state, next.id).solvedDateKey).toBe("2026-11-23");
  });
});

describe("연습실: 등급별 서랍", () => {
  it("스물두 문제가 다섯 등급에 들어 있다: F·D 다섯, C 여섯(특수 도전 하나), B·A 셋. 서랍의 보통 과제는 유형이 겹치지 않는다", () => {
    expect(PRACTICE_PUZZLES).toHaveLength(22);
    expect((["F", "D", "C", "B", "A"] as const).map((rank) => practiceOfRank(rank).length)).toEqual([5, 5, 6, 3, 3]);
    for (const rank of ["F", "D", "C", "B", "A"] as const) {
      const sheets = practiceOfRank(rank).filter((p) => !p.special);
      // 특수 도전을 뺀 보통 과제는 한 서랍에서 유형이 겹치지 않는다(F·D·C 는 다섯 유형이 모두 있다)
      expect(new Set(sheets.map((p) => p.type)).size, rank).toBe(sheets.length);
    }
    for (const rank of ["F", "D", "C"] as const) expect(practiceOfRank(rank).filter((p) => !p.special), rank).toHaveLength(5);
    expect(practiceOfRank("S")).toHaveLength(0);
    // 특수 도전은 하나뿐이고 C 서랍의 맨 끝에 놓인다
    expect(PRACTICE_PUZZLES.filter((p) => p.special).map((p) => p.id)).toEqual(["special-code-001"]);
    expect(practiceOfRank("C").at(-1)?.id).toBe("special-code-001");
    // 유형별 과제 수(특수 도전 포함): 암호 5 · 진술 4 · 순서 4 · 증거 5 · 인장 4
    expect(["code", "truth", "schedule", "evidence", "spatial"].map((type) => PRACTICE_PUZZLES.filter((p) => p.type === type).length)).toEqual([5, 4, 4, 5, 4]);
    // 목록은 등급 순서다
    const order = PRACTICE_PUZZLES.map((p) => RANKS.findIndex((r) => r.id === p.rank));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("윗등급의 서랍은 잠겨 있다: 풀 수 없고, 제출해도 접수되지 않는다", () => {
    const state = enrolled();
    const [upper] = practiceOfRank("D");
    expect(practiceUnlocked(state, upper)).toBe(false);
    expect(canPlay(state, upper)).toBe(false);
    const result = submitAnswer(state, upper, upper.solution, NOW);
    expect(result.outcome.accepted).toBe(false);
    expect(result.state).toBe(state);
    for (const sheet of practiceOfRank("F")) expect(canPlay(state, sheet)).toBe(true);
  });

  it("승급하면 그 등급의 서랍이 열린다", () => {
    const state = buildDemoState("promoted", NOW);
    expect(state.rank).toBe("D");
    for (const sheet of practiceOfRank("D")) expect(canPlay(state, sheet)).toBe(true);
    for (const sheet of practiceOfRank("C")) expect(canPlay(state, sheet)).toBe(false);
  });
});

describe("승급 시험: 응시 조건", () => {
  it("등급마다 시험이 하나씩 있고, 문제 수는 1·3·3·4·5 다", () => {
    expect(PROMOTION_RULES.map((r) => `${r.from}${r.to}`)).toEqual(["FD", "DC", "CB", "BA", "AS"]);
    expect(PROMOTION_RULES.map((r) => r.examPuzzleIds.length)).toEqual([1, 3, 3, 4, 5]);
    // D→C 시험의 셋째 문제는 맨 뒤에 붙었다(앞의 두 문제와 순서는 그대로다)
    expect(rule("D").examPuzzleIds).toEqual(["exam-code-d-c", "exam-truth-d-c", "exam-evidence-d-c"]);
    expect(PROMOTION_RULES.map((r) => r.requiredSolved)).toEqual([3, 5, 8, 12, 15]);
    const ids = PROMOTION_RULES.flatMap((r) => r.examPuzzleIds);
    expect(new Set(ids).size).toBe(16);
    for (const id of ids) expect(PUZZLE_BY_ID[id]?.category, id).toBe("exam");
    expect(ALL_PUZZLES.filter((p) => p.category === "exam")).toHaveLength(16);
    // 시험 문제의 권장 등급은 응시하는 등급이다
    for (const r of PROMOTION_RULES) for (const id of r.examPuzzleIds) expect(PUZZLE_BY_ID[id].rank, id).toBe(r.from);
    // 한 시험 안에서 유형이 겹치지 않는다
    for (const r of PROMOTION_RULES) expect(new Set(r.examPuzzleIds.map((id) => PUZZLE_BY_ID[id].type)).size).toBe(r.examPuzzleIds.length);
  });

  it("응시 조건은 그 등급에서 열린 과제만으로 채울 수 있다", () => {
    // 지금 등급까지의 연습 과제 수 (오늘의 추리를 하나도 풀지 않아도 채워져야 한다)
    let open = 0;
    for (const r of PROMOTION_RULES) {
      open += practiceOfRank(r.from).length;
      expect(open, `${r.from}→${r.to}`).toBeGreaterThanOrEqual(r.requiredSolved);
    }
  });

  it("처음 해결한 과제(오늘의 추리 + 연습실)가 셋이 되어야 F→D 시험이 열린다", () => {
    let state = enrolled();
    expect(examStatus(state, NOW)).toMatchObject({ unlocked: false, solved: 0, required: 3, canStart: false });
    expect(canPlay(state, EXAM_SCHEDULE)).toBe(false);

    state = submitAnswer(state, DAILY_CODE, [4, 2, 6], NOW).state;
    expect(examStatus(state, NOW)).toMatchObject({ unlocked: false, solved: 1 });

    const [first, second] = practiceOfRank("F");
    state = submitAnswer(state, first, first.solution, NOW).state;
    expect(examStatus(state, NOW)).toMatchObject({ unlocked: false, solved: 2 });
    state = submitAnswer(state, second, second.solution, NOW).state;
    expect(examStatus(state, NOW)).toMatchObject({ unlocked: true, solved: 3, canStart: true });
    // 봉투를 열기 전에는 시험 문제를 풀 수 없다
    expect(canPlay(state, EXAM_SCHEDULE)).toBe(false);
  });

  it("잠긴 시험에는 정답을 내도 접수되지 않고, 봉투도 열리지 않는다", () => {
    const state = enrolled();
    const result = submitAnswer(state, EXAM_SCHEDULE, EXAM_SCHEDULE.solution, NOW);
    expect(result.outcome.accepted).toBe(false);
    expect(result.state.rank).toBe("F");
    expect(startExam(state, NOW)).toBe(state);
  });
});

describe("승급 시험: 한 번의 응시", () => {
  it("F→D: 한 문제, 제한 없음. 합격하면 D급이 되고 +80을 받는다", () => {
    let state = buildDemoState("exam-ready", NOW);
    const before = state.credits;
    state = startExam(state, NOW);
    expect(state.exam).toMatchObject({ from: "F", index: 0, stage: "playing", submits: 0, remainingMs: null, runningSince: null, status: "active" });
    expect(canPlay(state, EXAM_SCHEDULE)).toBe(true);

    // 제한이 없는 시험은 몇 번을 틀려도 끝나지 않는다
    for (let i = 0; i < 6; i++) {
      const wrong = submitAnswer(state, EXAM_SCHEDULE, wrongAnswer(EXAM_SCHEDULE), NOW);
      expect(wrong.outcome).toMatchObject({ accepted: true, correct: false, exam: { ended: null, submitsLeft: null } });
      state = wrong.state;
    }
    expect(state.rank).toBe("F");

    const pass = submitAnswer(state, EXAM_SCHEDULE, EXAM_SCHEDULE.solution, NOW);
    expect(pass.outcome).toMatchObject({ correct: true, reward: 80, promotedTo: "D", exam: { ended: "passed" } });
    expect(pass.state.rank).toBe("D");
    expect(pass.state.credits).toBe(before + 80);
    expect(pass.state.exam).toBeNull();
    expect(pass.state.promotions).toEqual([{ from: "F", to: "D", at: NOW.toISOString() }]);
    expect(getProgress(pass.state, EXAM_SCHEDULE.id)).toMatchObject({ status: "solved", solvedAttempts: 7 });
  });

  it("힌트를 써도 정답이면 합격한다 (힌트를 쓸 수 있는 시험)", () => {
    let state = startExam(buildDemoState("exam-ready", NOW), NOW);
    expect(hintsAllowed(EXAM_SCHEDULE)).toBe(true);
    state = requestHint(state, EXAM_SCHEDULE).state;
    state = requestHint(state, EXAM_SCHEDULE).state;
    const pass = submitAnswer(state, EXAM_SCHEDULE, EXAM_SCHEDULE.solution, NOW);
    expect(pass.outcome.promotedTo).toBe("D");
    expect(pass.outcome.noHint).toBe(false);
    expect(getProgress(pass.state, EXAM_SCHEDULE.id).solvedHints).toBe(2);
  });

  it("합격한 뒤 같은 문제에 다시 제출해도 두 번 승급하거나 보상을 다시 받지 않는다", () => {
    const promoted = buildDemoState("promoted", NOW);
    const again = submitAnswer(promoted, EXAM_SCHEDULE, EXAM_SCHEDULE.solution, NOW);
    expect(again.outcome.accepted).toBe(false);
    expect(again.state).toBe(promoted);
    expect(promoted.promotions).toHaveLength(1);
  });

  it("D→C: 세 문제를 차례로 푼다. 문제 사이에서는 다음 시험지를 펼쳐야 이어진다", () => {
    let state = buildDemoState("ready-c", NOW);
    expect(state.rank).toBe("D");
    const [first, second, third] = puzzlesOf("D");
    state = startExam(state, NOW);
    // 두 번째 문제는 아직 풀 수 없다
    expect(canPlay(state, second)).toBe(false);
    expect(submitAnswer(state, second, second.solution, NOW).outcome.accepted).toBe(false);

    const one = submitAnswer(state, first, first.solution, NOW);
    expect(one.outcome).toMatchObject({ correct: true, reward: 0, promotedTo: null, exam: { ended: null } });
    state = one.state;
    expect(state.rank).toBe("D");
    expect(state.exam).toMatchObject({ index: 1, stage: "ready", submits: 0 });
    // 시험지를 펼치기 전에는 제출이 접수되지 않는다
    expect(submitAnswer(state, second, second.solution, NOW).outcome.accepted).toBe(false);

    state = openExamSheet(state, NOW);
    expect(state.exam).toMatchObject({ index: 1, stage: "playing" });
    const two = submitAnswer(state, second, second.solution, NOW);
    expect(two.outcome).toMatchObject({ correct: true, reward: 0, promotedTo: null, exam: { ended: null } });
    state = two.state;
    expect(state.rank).toBe("D");
    expect(state.exam).toMatchObject({ index: 2, stage: "ready", submits: 0 });
    // 셋째 문제(증거 조합)도 시험지를 펼쳐야 제출이 접수된다
    expect(third.type).toBe("evidence");
    expect(submitAnswer(state, third, third.solution, NOW).outcome.accepted).toBe(false);

    state = openExamSheet(state, NOW);
    expect(state.exam).toMatchObject({ index: 2, stage: "playing" });
    const three = submitAnswer(state, third, third.solution, NOW);
    expect(three.outcome).toMatchObject({ correct: true, reward: 100, promotedTo: "C", exam: { ended: "passed" } });
    expect(three.state.rank).toBe("C");
    expect(three.state.promotions.map((p) => p.to)).toEqual(["D", "C"]);
  });

  it("응시할 때마다 시험 문제의 풀이 기록을 새로 쓴다", () => {
    let state = startExam(buildDemoState("exam-ready", NOW), NOW);
    state = recordInput(state, EXAM_SCHEDULE.id, { type: "schedule", placement: ["sea", null, null, null] });
    state = addElapsed(state, EXAM_SCHEDULE.id, 30_000);
    state = submitAnswer(state, EXAM_SCHEDULE, wrongAnswer(EXAM_SCHEDULE), NOW).state;
    expect(getProgress(state, EXAM_SCHEDULE.id)).toMatchObject({ attempts: 1, elapsedMs: 30_000 });
    // 진행 중에는 다시 시작할 수 없다(기록이 지워지지 않는다)
    expect(startExam(state, NOW)).toBe(state);
  });
});

describe("승급 시험: 제한 시간 (C→B, 15분)", () => {
  const ready = () => buildDemoState("ready-b", NOW);
  const [first, second, third] = puzzlesOf("C");

  it("시계는 봉투를 연 때부터 돌고, 문제를 푸는 동안에만 흐른다", () => {
    let state = startExam(ready(), NOW);
    expect(state.exam).toMatchObject({ remainingMs: 15 * MIN, runningSince: NOW.getTime() });
    expect(examRemainingMs(state.exam!, later(4 * MIN))).toBe(11 * MIN);

    // 4분에 첫 문제를 맞힌다 → 시계가 멈춘다
    state = submitAnswer(state, first, first.solution, later(4 * MIN)).state;
    expect(state.exam).toMatchObject({ index: 1, stage: "ready", remainingMs: 11 * MIN, runningSince: null });
    // 문제 사이에서 30분을 쉬어도 시간은 줄지 않고, 실패로 바뀌지도 않는다
    expect(examRemainingMs(state.exam!, later(34 * MIN))).toBe(11 * MIN);
    expect(tickExam(state, later(34 * MIN))).toBe(state);

    // 다음 시험지를 펼치면 다시 돈다
    state = openExamSheet(state, later(34 * MIN));
    expect(examRemainingMs(state.exam!, later(36 * MIN))).toBe(9 * MIN);
  });

  it("도입 장면만큼 시계를 늦게 돌릴 수 있다", () => {
    const state = startExam(ready(), NOW, 3_000);
    expect(examRemainingMs(state.exam!, later(2_000))).toBe(15 * MIN);
    expect(examRemainingMs(state.exam!, later(5_000))).toBe(15 * MIN - 2_000);
  });

  it("시간이 끝나면 그 응시는 실패로 바뀌고, 등급과 크레딧은 그대로다", () => {
    let state = startExam(ready(), NOW);
    const credits = state.credits;
    expect(tickExam(state, later(15 * MIN - 1))).toBe(state);
    state = tickExam(state, later(15 * MIN));
    expect(state.exam).toMatchObject({ status: "failed", failedBy: "time", remainingMs: 0, runningSince: null });
    expect(state.rank).toBe("C");
    expect(state.credits).toBe(credits);
    expect(state.promotions).toHaveLength(2);
    // 끝난 시험에는 정답을 내도 접수되지 않는다
    expect(submitAnswer(state, first, first.solution, later(16 * MIN)).outcome.accepted).toBe(false);
  });

  it("시간이 끝난 뒤의 제출은 채점하지 않고 실패로 처리한다", () => {
    const state = startExam(ready(), NOW);
    const late = submitAnswer(state, first, first.solution, later(15 * MIN + 5_000));
    expect(late.outcome).toMatchObject({ accepted: false, correct: false, exam: { ended: "time" } });
    expect(late.state.exam).toMatchObject({ status: "failed", failedBy: "time" });
    expect(getProgress(late.state, first.id).status).not.toBe("solved");
  });

  it("새로고침해도(저장했다 읽어도) 남은 시간과 응시 횟수가 되돌아가지 않는다", () => {
    const state = startExam(ready(), NOW);
    const restored = hydrate(JSON.parse(JSON.stringify(state)));
    expect(restored).toEqual(state);
    // 화면을 떠나 있던 6분도 흐른 시간이다
    expect(examRemainingMs(restored.exam!, later(6 * MIN))).toBe(9 * MIN);
    expect(examStatus(restored, NOW).attemptsLeft).toBe(2);
    // 떠나 있는 사이에 시간이 끝났으면 돌아왔을 때 실패다
    expect(tickExam(restored, later(20 * MIN)).exam).toMatchObject({ status: "failed", failedBy: "time" });
  });

  it("남은 시간을 고쳐 써도 제한 시간보다 길어지지 않는다", () => {
    const state = startExam(ready(), NOW);
    const forged = hydrate(JSON.parse(JSON.stringify({ ...state, exam: { ...state.exam, remainingMs: 99 * MIN } })));
    expect(forged.exam!.remainingMs).toBe(15 * MIN);
    const broken = hydrate(JSON.parse(JSON.stringify({ ...state, exam: { ...state.exam, remainingMs: "많이" } })));
    expect(broken.exam!.remainingMs).toBe(0);
  });

  it("하루 세 번까지 응시한다. 떨어진 결과를 닫으면 다시 응시할 수 있고, 다음 날 횟수가 돌아온다", () => {
    let state = ready();
    expect(examStatus(state, NOW)).toMatchObject({ attemptsLeft: 3, canStart: true });
    for (let attempt = 1; attempt <= 3; attempt++) {
      state = startExam(state, NOW);
      expect(examStatus(state, NOW)).toMatchObject({ attemptsLeft: 3 - attempt, canStart: false });
      state = tickExam(state, later(15 * MIN));
      // 결과를 닫기 전에는 떨어진 시험이 남아 있다
      expect(examStatus(state, NOW).session?.status).toBe("failed");
      state = dismissExam(state);
      expect(state.exam).toBeNull();
    }
    expect(examStatus(state, NOW)).toMatchObject({ unlocked: true, attemptsLeft: 0, canStart: false });
    expect(startExam(state, NOW)).toBe(state);
    // 자정(서울)이 지나면 다시 세 번
    expect(examStatus(state, later(DAY))).toMatchObject({ attemptsLeft: 3, canStart: true });
    expect(startExam(state, later(DAY)).exam).toMatchObject({ status: "active", dateKey: "2026-11-23" });
  });

  it("다시 응시하면 처음 문제부터, 제한 시간도 처음부터다", () => {
    let state = startExam(ready(), NOW);
    state = submitAnswer(state, first, first.solution, later(MIN)).state;
    state = openExamSheet(state, later(MIN));
    state = tickExam(state, later(20 * MIN));
    expect(state.exam).toMatchObject({ status: "failed", index: 1 });
    state = startExam(dismissExam(state), later(21 * MIN));
    expect(state.exam).toMatchObject({ index: 0, stage: "playing", remainingMs: 15 * MIN });
    expect(getProgress(state, first.id).status).toBe("new");
  });

  it("세 문제를 시간 안에 풀면 B급이 된다", () => {
    let state = startExam(ready(), NOW);
    state = submitAnswer(state, first, first.solution, later(3 * MIN)).state;
    state = submitAnswer(openExamSheet(state, later(3 * MIN)), second, second.solution, later(7 * MIN)).state;
    const pass = submitAnswer(openExamSheet(state, later(7 * MIN)), third, third.solution, later(12 * MIN));
    expect(pass.outcome).toMatchObject({ promotedTo: "B", reward: 120 });
    expect(pass.state.rank).toBe("B");
  });
});

describe("승급 시험: 제출 횟수 (B→A, 문제마다 세 번 · 수사 지원 없음)", () => {
  const ready = () => buildDemoState("ready-a", NOW);
  const puzzles = puzzlesOf("B");

  it("수사 지원을 쓸 수 없다", () => {
    const state = startExam(ready(), NOW);
    for (const puzzle of puzzles) expect(hintsAllowed(puzzle)).toBe(false);
    const asked = requestHint(state, puzzles[0]);
    expect(asked.outcome).toEqual({ kind: "forbidden" });
    expect(asked.state).toBe(state);
  });

  it("한 문제에서 세 번을 다 쓰고도 틀리면 그 응시는 끝난다. 등급은 그대로다", () => {
    let state = startExam(ready(), NOW);
    const puzzle = puzzles[0];
    expect(submitLimit(rule("B").exam, puzzle.type)).toBe(3);
    let result = submitAnswer(state, puzzle, wrongAnswer(puzzle), NOW);
    expect(result.outcome.exam).toEqual({ ended: null, submitsLeft: 2 });
    result = submitAnswer(result.state, puzzle, wrongAnswer(puzzle), NOW);
    expect(result.outcome.exam).toEqual({ ended: null, submitsLeft: 1 });
    result = submitAnswer(result.state, puzzle, wrongAnswer(puzzle), NOW);
    expect(result.outcome).toMatchObject({ accepted: true, correct: false, exam: { ended: "submits", submitsLeft: 0 } });
    state = result.state;
    expect(state.exam).toMatchObject({ status: "failed", failedBy: "submits", index: 0 });
    expect(state.rank).toBe("B");
    expect(submitAnswer(state, puzzle, puzzle.solution, NOW).outcome.accepted).toBe(false);
  });

  it("문제를 맞히면 다음 문제에서 제출 횟수가 다시 찬다", () => {
    let state = startExam(ready(), NOW);
    state = submitAnswer(state, puzzles[0], wrongAnswer(puzzles[0]), NOW).state;
    state = submitAnswer(state, puzzles[0], wrongAnswer(puzzles[0]), NOW).state;
    state = submitAnswer(state, puzzles[0], puzzles[0].solution, NOW).state;
    expect(state.exam).toMatchObject({ index: 1, submits: 0, status: "active" });
  });

  it("진술 추리는 후보가 넷뿐이라 제출을 한 번 덜 준다", () => {
    const truth = puzzles.find((p) => p.type === "truth")!;
    expect(submitLimit(rule("B").exam, "truth")).toBe(2);
    expect(submitLimit(rule("A").exam, "truth")).toBe(1);
    expect(submitLimit(rule("A").exam, "code")).toBe(2);
    expect(submitLimit(rule("C").exam, "truth")).toBeNull();

    let state = startExam(ready(), NOW);
    for (const puzzle of puzzles) {
      if (puzzle === truth) break;
      state = openExamSheet(submitAnswer(state, puzzle, puzzle.solution, NOW).state, NOW);
    }
    let result = submitAnswer(state, truth, wrongAnswer(truth), NOW);
    expect(result.outcome.exam).toEqual({ ended: null, submitsLeft: 1 });
    result = submitAnswer(result.state, truth, wrongAnswer(truth), NOW);
    expect(result.outcome.exam).toEqual({ ended: "submits", submitsLeft: 0 });
  });

  it("하루 두 번 응시하고, 네 문제를 모두 맞히면 A급이 된다", () => {
    let state = ready();
    expect(examStatus(state, NOW).attemptsLeft).toBe(2);
    state = startExam(state, NOW);
    let outcome = null;
    for (const puzzle of puzzles) {
      state = openExamSheet(state, NOW);
      const result = submitAnswer(state, puzzle, puzzle.solution, NOW);
      state = result.state;
      outcome = result.outcome;
    }
    expect(outcome).toMatchObject({ promotedTo: "A", reward: 160 });
    expect(state.rank).toBe("A");
  });
});

describe("승급 시험: 종합 시험 (A→S, 25분 · 문제마다 두 번 · 하루 한 번)", () => {
  const ready = () => buildDemoState("ready-s", NOW);
  const puzzles = puzzlesOf("A");

  it("다섯 유형이 하나씩 나온다", () => {
    expect(puzzles.map((p) => p.type).sort()).toEqual(["code", "evidence", "schedule", "spatial", "truth"]);
    for (const puzzle of puzzles) expect(puzzle.hints, puzzle.id).toEqual([]);
  });

  it("시간과 제출 횟수가 함께 걸린다", () => {
    let state = startExam(ready(), NOW);
    expect(state.exam).toMatchObject({ remainingMs: 25 * MIN });
    const first = puzzles[0];
    const limit = submitLimit(rule("A").exam, first.type)!;
    let result = submitAnswer(state, first, wrongAnswer(first), later(MIN));
    for (let i = 1; i < limit; i++) result = submitAnswer(result.state, first, wrongAnswer(first), later(MIN));
    expect(result.state.exam).toMatchObject({ status: "failed", failedBy: "submits" });
    // 다른 응시: 시간이 먼저 끝난다
    state = tickExam(startExam(ready(), NOW), later(25 * MIN));
    expect(state.exam).toMatchObject({ status: "failed", failedBy: "time" });
  });

  it("하루에 한 번만 응시할 수 있다", () => {
    let state = startExam(ready(), NOW);
    state = dismissExam(tickExam(state, later(25 * MIN)));
    expect(examStatus(state, later(26 * MIN))).toMatchObject({ attemptsLeft: 0, canStart: false });
    expect(startExam(state, later(26 * MIN))).toBe(state);
    expect(examStatus(state, later(DAY)).canStart).toBe(true);
  });

  it("다섯 문제를 모두 맞히면 S급이 되고, 더 치를 시험이 없다", () => {
    let state = startExam(ready(), NOW);
    for (const puzzle of puzzles) {
      state = openExamSheet(state, NOW);
      state = submitAnswer(state, puzzle, puzzle.solution, later(MIN)).state;
    }
    expect(state.rank).toBe("S");
    expect(state.promotions.map((p) => p.to)).toEqual(["D", "C", "B", "A", "S"]);
    expect(examStatus(state, NOW)).toMatchObject({ rule: null, passed: true, canStart: false });
    expect(startExam(state, NOW)).toBe(state);
  });
});

describe("데모 프리셋", () => {
  it("상태들을 엔진으로 재현한다", () => {
    expect(buildDemoState("first-run", NOW).enrolled).toBe(false);

    const unsolved = buildDemoState("daily-unsolved", NOW);
    expect(unsolved).toMatchObject({ enrolled: true, credits: 40, rank: "F" });
    expect(getProgress(unsolved, DAILY_CODE.id).status).toBe("new");

    const solved = buildDemoState("daily-solved", NOW);
    expect(getProgress(solved, DAILY_CODE.id).status).toBe("solved");
    expect(solved.credits).toBe(100);
    expect(examStatus(solved, NOW).unlocked).toBe(false);

    const ready = buildDemoState("exam-ready", NOW);
    expect(examStatus(ready, NOW)).toMatchObject({ unlocked: true, solved: 3, canStart: true });
    expect(ready.credits).toBe(40 + 60 + 30 + 30);

    const promoted = buildDemoState("promoted", NOW);
    expect(promoted).toMatchObject({ rank: "D", credits: 40 + 60 + 30 + 30 + 80 });
    expect(examStatus(promoted, NOW).unlocked).toBe(false);
  });

  it("등급별 프리셋: 그 등급에서 시험을 볼 수 있는 상태", () => {
    const expected = { "ready-c": "D", "ready-b": "C", "ready-a": "B", "ready-s": "A" } as const;
    for (const [preset, rank] of Object.entries(expected)) {
      const state = buildDemoState(preset as keyof typeof expected, NOW);
      expect(state.rank, preset).toBe(rank);
      expect(examStatus(state, NOW), preset).toMatchObject({ unlocked: true, canStart: true });
      expect(state.exam, preset).toBeNull();
      // 프리셋은 오늘의 응시 횟수를 쓰지 않은 상태다
      expect(state.examDays, preset).toEqual({});
    }
    const top = buildDemoState("rank-s", NOW);
    expect(top.rank).toBe("S");
    expect(top.promotions).toHaveLength(5);
    expect(PRACTICE_PUZZLES.every((p) => getProgress(top, p.id).status === "solved")).toBe(true);
    expect(DEMO_PRESETS.map((p) => p.id)).toContain("rank-s");
  });

  it("오늘의 추리가 다른 날에도 프리셋이 선다", () => {
    const state = buildDemoState("exam-ready", later(3 * DAY));
    expect(getProgress(state, DAILY_SET[2].id).status).toBe("solved");
    expect(examStatus(state, later(3 * DAY)).unlocked).toBe(true);
  });
});

describe("저장 데이터 복원", () => {
  it("JSON 으로 저장했다 읽어도 상태가 같다", () => {
    for (const preset of ["promoted", "ready-b", "rank-s"] as const) {
      const state = buildDemoState(preset, NOW);
      expect(hydrate(JSON.parse(JSON.stringify(state)))).toEqual(state);
    }
  });

  it("깨진 값은 초기 상태로 돌린다", () => {
    expect(hydrate(null)).toEqual(createInitialState());
    expect(hydrate("문자열")).toEqual(createInitialState());
    expect(hydrate({ version: 99, credits: 9999 })).toEqual(createInitialState());
  });

  it("음수 크레딧과 모르는 문제 기록은 버린다", () => {
    const restored = hydrate({
      version: 1,
      enrolled: true,
      credits: -50,
      rank: "Z",
      puzzles: { "지워진-문제": { status: "solved" } },
    });
    expect(restored.credits).toBe(0);
    expect(restored.rank).toBe("F");
    expect(restored.puzzles).toEqual({});
  });

  it("예전 저장(시험 기록이 없던 때)을 읽으면 시험은 없는 상태다", () => {
    const old = { version: 1, enrolled: true, nickname: "옛 탐정", detectiveNo: "DA-1", enrolledAt: NOW.toISOString(), rank: "D", credits: 350, puzzles: {}, promotions: [{ from: "F", to: "D", at: NOW.toISOString() }], settings: { sound: true } };
    const restored = hydrate(old);
    expect(restored).toMatchObject({ rank: "D", credits: 350, exam: null, examDays: {} });
    expect(restored.settings.sound).toBe(true);
  });

  it("깨진 시험 기록은 버린다", () => {
    const base = JSON.parse(JSON.stringify(buildDemoState("ready-b", NOW)));
    expect(hydrate({ ...base, exam: { from: "S", index: 0 } }).exam).toBeNull();
    expect(hydrate({ ...base, exam: { from: "C", index: 9 } }).exam).toBeNull();
    expect(hydrate({ ...base, exam: "시험" }).exam).toBeNull();
    expect(hydrate({ ...base, examDays: { C: { dateKey: "2026-11-22", count: 2 }, Z: { dateKey: "x", count: 1 }, B: "두 번" } }).examDays).toEqual({ C: { dateKey: "2026-11-22", count: 2 } });
  });
});

describe("시간", () => {
  it("날짜 기준은 Asia/Seoul 이다", () => {
    // UTC 15:30 은 서울에서 다음 날 00:30 이다.
    expect(seoulDateKey(new Date("2026-11-20T15:30:00Z"))).toBe("2026-11-21");
    expect(seoulDateKey(new Date("2026-11-20T14:59:00Z"))).toBe("2026-11-20");
  });

  it("경과 시간과 남은 시간 표기", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(127_400)).toBe("02:07");
    expect(formatDuration(45_000)).toBe("45초");
    expect(formatDuration(127_400)).toBe("2분 7초");
    // 남은 시간은 올림한다: 0:00 이 보이는 순간이 끝이다
    expect(formatCountdown(15 * MIN)).toBe("15:00");
    expect(formatCountdown(59_001)).toBe("01:00");
    expect(formatCountdown(1)).toBe("00:01");
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5)).toBe("00:00");
  });
});
