/**
 * 오늘의 추리의 날짜 정책 (V3 RELEASE 지시서 3절).
 * - 날짜(Asia/Seoul)마다 정해진 문제 하나. 날짜 ↔ 이름표의 표는 여기에 못박아 둔다: 새 문제가 뒤에 더해져도 지난 날짜의 배정은 바뀌지 않는다.
 * - 달력이 끝나면 처음으로 돌아가지 않는다(오늘의 추리가 없다). 지난 사건은 오늘까지 붙은 문제뿐이다.
 * - 보상은 처음 해결에 한 번: 다시 풀기, 지난 사건에서 처음 풀기, 자정을 넘겨 풀기, 저장을 다시 읽기.
 */
import { describe, expect, it } from "vitest";
import { ALL_PUZZLES, DAILY_CALENDAR, PRACTICE_PUZZLES, PUZZLE_BY_ID, dailyDateOf, dailyIndex, dailyLastDate, dailyOpenOn, getDailyPuzzle, pastDailies } from "../data/puzzles";
import { CREDIT_POLICY } from "../engine/creditEngine";
import { addElapsed, buildDemoState, createInitialState, enroll, getProgress, hydrate, recordInput, solvedCount, submitAnswer, tasksSolved } from "../engine/progressEngine";
import { addDays, seoulDateKey } from "../engine/time";
import type { GameState, Puzzle } from "../engine/types";

/** 날짜 ↔ 문제의 표. 이 표의 줄을 고치거나 사이에 끼워 넣으면 이미 지나간 날의 배정과 기록이 뒤바뀐다: 새 문제는 맨 뒤에만 붙인다. */
const ASSIGNED: [date: string, id: string][] = [
  ["2026-11-22", "daily-code-001"],
  ["2026-11-23", "daily-evidence-001"],
  ["2026-11-24", "daily-seal-001"],
  ["2026-11-25", "daily-code-002"],
  ["2026-11-26", "daily-truth-001"],
  ["2026-11-27", "daily-evidence-002"],
  ["2026-11-28", "daily-schedule-001"],
  ["2026-11-29", "daily-seal-002"],
  ["2026-11-30", "daily-schedule-002"],
  ["2026-12-01", "daily-truth-002"],
  ["2026-12-02", "daily-code-003"],
  ["2026-12-03", "daily-seal-003"],
  ["2026-12-04", "daily-evidence-003"],
  ["2026-12-05", "daily-schedule-003"],
];

const FIRST = ASSIGNED[0][0];
const LAST = ASSIGNED[ASSIGNED.length - 1][0];

/** 서울의 그 날짜 · 그 시각 */
const seoul = (dateKey: string, time = "12:00:00") => new Date(`${dateKey}T${time}+09:00`);

function enrolled(at: Date = seoul(FIRST)): GameState {
  return enroll(createInitialState(), "달력 탐정", "DA-202611", at);
}

const puzzleOn = (dateKey: string): Puzzle => {
  const puzzle = getDailyPuzzle(dateKey);
  if (!puzzle) throw new Error(`${dateKey} 에 붙은 문제가 없다`);
  return puzzle;
};

describe("날짜별 배정: 표는 고정되어 있다", () => {
  it("열나흘 동안 날짜마다 표의 문제가 붙는다", () => {
    expect(DAILY_CALENDAR.start).toBe(FIRST);
    // 앞의 열네 줄은 그대로여야 한다. 새 문제가 더해지면 이 표의 뒤에 줄을 더한다(앞 줄은 건드리지 않는다).
    expect(DAILY_CALENDAR.order.slice(0, ASSIGNED.length)).toEqual(ASSIGNED.map(([, id]) => id));
    for (const [date, id] of ASSIGNED) {
      expect(getDailyPuzzle(date)?.id, date).toBe(id);
      expect(dailyDateOf(id), id).toBe(date);
      expect(PUZZLE_BY_ID[id].category, id).toBe("daily");
    }
    expect(dailyLastDate()).toBe(addDays(FIRST, DAILY_CALENDAR.order.length - 1));
  });

  it("달력의 문제는 서로 다르고, 일일 문제는 빠짐없이 달력에 있다", () => {
    expect(new Set(DAILY_CALENDAR.order).size).toBe(DAILY_CALENDAR.order.length);
    const dailies = ALL_PUZZLES.filter((p) => p.category === "daily").map((p) => p.id);
    expect([...dailies].sort()).toEqual([...DAILY_CALENDAR.order].sort());
    // 달력에 없는 문제에는 날짜가 없다
    expect(dailyDateOf(PRACTICE_PUZZLES[0].id)).toBeNull();
    expect(dailyDateOf("없는-문제")).toBeNull();
  });

  it("날짜는 서울의 자정에 바뀐다: 23:59:59 까지는 그날의 문제, 00:00:00 부터 다음 날의 문제", () => {
    for (let i = 0; i < ASSIGNED.length - 1; i++) {
      const [date, id] = ASSIGNED[i];
      const [nextDate, nextId] = ASSIGNED[i + 1];
      expect(seoulDateKey(seoul(date, "00:00:00"))).toBe(date);
      expect(getDailyPuzzle(seoulDateKey(seoul(date, "23:59:59")))?.id).toBe(id);
      expect(seoulDateKey(seoul(nextDate, "00:00:00"))).toBe(nextDate);
      expect(getDailyPuzzle(seoulDateKey(seoul(nextDate, "00:00:00")))?.id).toBe(nextId);
    }
    // 세계시로는 전날 15시가 서울의 자정이다: 기기의 시간대가 아니라 서울의 날짜를 따른다
    expect(seoulDateKey(new Date("2026-11-22T14:59:59Z"))).toBe("2026-11-22");
    expect(seoulDateKey(new Date("2026-11-22T15:00:00Z"))).toBe("2026-11-23");
    expect(getDailyPuzzle(seoulDateKey(new Date("2026-11-21T15:00:00Z")))?.id).toBe("daily-code-001");
    expect(getDailyPuzzle(seoulDateKey(new Date("2026-11-21T14:59:59Z")))).toBeNull();
  });
});

describe("달력이 끝난 뒤: 되풀이하지 않는다", () => {
  it("마지막 문제의 다음 날부터는 오늘의 추리가 없다. 첫 문제가 새 문제처럼 다시 붙지 않는다", () => {
    expect(getDailyPuzzle(LAST)?.id).toBe("daily-schedule-003");
    // 그 뒤 두 해 동안 하루도 문제가 붙지 않는다(열나흘 주기로 돌던 예전에는 12월 6일에 첫 문제가 다시 붙었다)
    for (let day = 1; day <= 730; day++) {
      const date = addDays(LAST, day);
      expect(getDailyPuzzle(date), date).toBeNull();
      expect(dailyIndex(date), date).toBeNull();
    }
  });

  it("시작일 이전과 날짜가 아닌 값에도 문제를 내지 않는다", () => {
    expect(getDailyPuzzle(addDays(FIRST, -1))).toBeNull();
    expect(getDailyPuzzle(addDays(FIRST, -14))).toBeNull();
    expect(getDailyPuzzle("어제")).toBeNull();
    expect(getDailyPuzzle("")).toBeNull();
    expect(pastDailies("어제")).toEqual([]);
    expect(pastDailies(addDays(FIRST, -1))).toEqual([]);
  });

  it("달력이 끝난 날에도 QA 프리셋은 만들어진다(오늘의 추리를 풀지 않은 채로)", () => {
    const after = seoul(addDays(LAST, 5));
    const solved = buildDemoState("daily-solved", after);
    expect(solved.credits).toBe(CREDIT_POLICY.initial);
    expect(solvedCount(solved, "daily")).toBe(0);
    expect(buildDemoState("promoted", after).rank).toBe("D");
    expect(buildDemoState("rank-s", after).rank).toBe("S");
  });
});

describe("지난 사건: 오늘까지 붙은 문제만", () => {
  it("날마다 그날까지의 문제가 날짜 순서로 쌓이고, 오지 않은 날의 문제는 들어 있지 않다", () => {
    ASSIGNED.forEach(([date], i) => {
      const entries = pastDailies(date);
      expect(entries.map((e) => [e.date, e.puzzle.id]), date).toEqual(ASSIGNED.slice(0, i + 1));
      expect(entries.map((e) => e.day)).toEqual(ASSIGNED.slice(0, i + 1).map((_, k) => k + 1));
    });
    // 달력이 끝난 뒤에는 열넷이 그대로 남는다(늘지도 줄지도 않는다)
    for (const day of [1, 2, 30, 400]) {
      expect(pastDailies(addDays(LAST, day)).map((e) => [e.date, e.puzzle.id])).toEqual(ASSIGNED);
    }
  });

  it("열 수 있는 것은 그 날짜까지 붙은 문제뿐이다", () => {
    for (const [today] of ASSIGNED) {
      for (const [date, id] of ASSIGNED) {
        expect(dailyOpenOn(id, today), `${today} 에 ${id}`).toBe(date <= today);
      }
    }
    for (const [, id] of ASSIGNED) {
      expect(dailyOpenOn(id, addDays(FIRST, -1)), id).toBe(false);
      expect(dailyOpenOn(id, addDays(LAST, 90)), id).toBe(true);
      expect(dailyOpenOn(id, "어제"), id).toBe(false);
    }
    // 달력에 없는 문제(연습 과제 · 시험 문제)와 없는 이름표는 어느 날에도 지난 사건으로 열리지 않는다
    for (const puzzle of ALL_PUZZLES.filter((p) => p.category !== "daily")) {
      expect(dailyOpenOn(puzzle.id, addDays(LAST, 90)), puzzle.id).toBe(false);
    }
    expect(dailyOpenOn("없는-문제", LAST)).toBe(false);
  });
});

describe("보상은 처음 해결에 한 번", () => {
  it("아직 오지 않은 날의 문제는 채점되지 않는다: 정답을 내도 풀리지 않고 크레딧도 그대로다", () => {
    const state = enrolled();
    const now = seoul("2026-11-24");
    for (const [date, id] of ASSIGNED.filter(([d]) => d > "2026-11-24")) {
      const puzzle = PUZZLE_BY_ID[id];
      const result = submitAnswer(state, puzzle, puzzle.solution, now);
      expect(result.outcome.accepted, date).toBe(false);
      expect(result.outcome.reward).toBe(0);
      expect(result.state).toBe(state);
    }
    // 그날이 되면 풀린다
    const tomorrow = PUZZLE_BY_ID["daily-code-002"];
    const onTheDay = submitAnswer(state, tomorrow, tomorrow.solution, seoul("2026-11-25", "00:00:00"));
    expect(onTheDay.outcome).toMatchObject({ accepted: true, correct: true, firstSolve: true, reward: tomorrow.reward });
  });

  it("같은 문제를 다시 풀어도 보상은 다시 나오지 않는다(그날에도, 날이 지난 뒤에도)", () => {
    const puzzle = puzzleOn(FIRST);
    const first = submitAnswer(enrolled(), puzzle, puzzle.solution, seoul(FIRST));
    expect(first.outcome).toMatchObject({ correct: true, firstSolve: true, reward: puzzle.reward });
    expect(first.state.credits).toBe(CREDIT_POLICY.initial + puzzle.reward);
    for (const when of [seoul(FIRST, "12:00:05"), seoul("2026-11-30"), seoul(addDays(LAST, 40))]) {
      const again = submitAnswer(first.state, puzzle, puzzle.solution, when);
      expect(again.outcome).toMatchObject({ accepted: true, correct: true, firstSolve: false, reward: 0 });
      // 기록도 처음 해결한 때의 것 그대로다
      expect(again.state).toBe(first.state);
    }
  });

  it("풀지 못하고 지나간 문제는 지난 사건에서 풀면 처음 해결 보상을 한 번 받는다", () => {
    // 11월 22일에 입학해 첫날 문제만 풀고, 달력이 끝난 뒤(12월 10일)에 돌아왔다
    let state = enrolled();
    const firstDay = puzzleOn(FIRST);
    state = submitAnswer(state, firstDay, firstDay.solution, seoul(FIRST)).state;
    const back = seoul("2026-12-10");
    expect(getDailyPuzzle(seoulDateKey(back))).toBeNull();

    const missed = pastDailies(seoulDateKey(back)).filter((e) => getProgress(state, e.puzzle.id).status !== "solved");
    expect(missed).toHaveLength(13);
    let credits = state.credits;
    for (const { puzzle } of missed) {
      const solved = submitAnswer(state, puzzle, puzzle.solution, back);
      expect(solved.outcome, puzzle.id).toMatchObject({ accepted: true, correct: true, firstSolve: true, reward: puzzle.reward });
      credits += puzzle.reward;
      expect(solved.state.credits).toBe(credits);
      // 해결한 날은 붙었던 날이 아니라 실제로 푼 날이다
      expect(getProgress(solved.state, puzzle.id).solvedDateKey).toBe("2026-12-10");
      // 곧바로 다시 내도 한 번뿐이다
      const again = submitAnswer(solved.state, puzzle, puzzle.solution, back);
      expect(again.outcome.reward).toBe(0);
      expect(again.state.credits).toBe(credits);
      state = solved.state;
    }
    expect(solvedCount(state, "daily")).toBe(14);
    // 지난 사건에서 처음 푼 것도 승급 시험의 응시 조건(처음 해결한 과제)에 들어간다
    expect(tasksSolved(state)).toBe(14);
    expect(state.credits).toBe(CREDIT_POLICY.initial + 14 * CREDIT_POLICY.daily);
  });

  it("푸는 중에 자정을 넘겨도 풀던 문제는 그대로 풀리고 보상을 한 번 받는다. 새 날의 문제는 미해결로 따로 붙는다", () => {
    const puzzle = puzzleOn(FIRST);
    let state = enrolled(seoul(FIRST, "23:40:00"));
    // 11월 22일 밤에 풀기 시작해 한 번 틀렸다
    state = addElapsed(state, puzzle.id, 19 * 60_000);
    state = recordInput(state, puzzle.id, { type: "code", dials: [1, 2, 3], memo: { "5": "out" } });
    state = submitAnswer(state, puzzle, [1, 2, 3], seoul(FIRST, "23:59:30")).state;
    expect(getProgress(state, puzzle.id)).toMatchObject({ status: "in_progress", attempts: 1 });

    // 자정이 지났다: 오늘의 추리는 다음 문제지만, 풀던 문제의 진행은 그대로다
    const after = seoul("2026-11-23", "00:00:20");
    const today = puzzleOn(seoulDateKey(after));
    expect(today.id).not.toBe(puzzle.id);
    expect(getProgress(state, puzzle.id).input).toEqual({ type: "code", dials: [1, 2, 3], memo: { "5": "out" } });

    const solved = submitAnswer(state, puzzle, puzzle.solution, after);
    expect(solved.outcome).toMatchObject({ accepted: true, correct: true, firstSolve: true, reward: puzzle.reward });
    expect(getProgress(solved.state, puzzle.id)).toMatchObject({ status: "solved", solvedAttempts: 2, solvedDateKey: "2026-11-23", solvedElapsedMs: 19 * 60_000 });
    expect(getProgress(solved.state, today.id).status).toBe("new");

    // 새 날의 문제도 따로 한 번 보상을 받는다
    const next = submitAnswer(solved.state, today, today.solution, after);
    expect(next.outcome.reward).toBe(today.reward);
    expect(next.state.credits).toBe(CREDIT_POLICY.initial + puzzle.reward + today.reward);
  });

  it("저장을 다시 읽어도(새로고침) 받은 보상은 다시 나오지 않는다", () => {
    let state = enrolled();
    const puzzle = puzzleOn(FIRST);
    state = submitAnswer(state, puzzle, puzzle.solution, seoul(FIRST)).state;
    const missedLater = PUZZLE_BY_ID["daily-evidence-001"];
    state = submitAnswer(state, missedLater, missedLater.solution, seoul("2026-12-10")).state;
    const credits = state.credits;

    const reloaded = hydrate(JSON.parse(JSON.stringify(state)));
    expect(reloaded).toEqual(state);
    for (const p of [puzzle, missedLater]) {
      const again = submitAnswer(reloaded, p, p.solution, seoul("2026-12-11"));
      expect(again.outcome).toMatchObject({ accepted: true, firstSolve: false, reward: 0 });
      expect(again.state.credits).toBe(credits);
    }
  });
});
