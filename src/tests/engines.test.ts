import { describe, expect, it } from "vitest";
import { DAILY_CODE, EXAM_SCHEDULE, PRACTICE_TRUTH } from "../data/puzzles";
import { CREDIT_POLICY, canAfford, hintCost, spend } from "../engine/creditEngine";
import {
  addElapsed,
  buildDemoState,
  canPlay,
  createInitialState,
  enroll,
  examStatus,
  getProgress,
  hydrate,
  recordInput,
  rename,
  requestHint,
  submitAnswer,
} from "../engine/progressEngine";
import { formatDuration, formatElapsed, seoulDateKey } from "../engine/time";
import type { GameState } from "../engine/types";

const NOW = new Date("2026-11-20T03:00:00Z");

function enrolled(): GameState {
  return enroll(createInitialState(), "시험용 탐정", "DA-123456", NOW);
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
});

describe("입학", () => {
  it("F급 견습 탐정으로 등록되고 40 크레딧을 받는다", () => {
    const state = enrolled();
    expect(state.enrolled).toBe(true);
    expect(state.rank).toBe("F");
    expect(state.credits).toBe(40);
    expect(state.nickname).toBe("시험용 탐정");
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

  it("정답은 +100을 지급하고 기록을 남긴다", () => {
    let state = addElapsed(enrolled(), DAILY_CODE.id, 83_000);
    const result = submitAnswer(state, DAILY_CODE, [4, 2, 6], NOW);
    state = result.state;
    expect(result.outcome).toMatchObject({ correct: true, reward: 100, firstSolve: true, noHint: true });
    expect(state.credits).toBe(140);
    expect(getProgress(state, DAILY_CODE.id)).toMatchObject({
      status: "solved",
      rewardClaimed: true,
      solvedElapsedMs: 83_000,
      solvedAttempts: 1,
      solvedHints: 0,
      solvedDateKey: "2026-11-20",
    });
  });

  it("같은 문제를 다시 맞혀도 보상은 다시 지급되지 않는다", () => {
    let state = submitAnswer(enrolled(), DAILY_CODE, [4, 2, 6], NOW).state;
    for (let i = 0; i < 5; i++) {
      const again = submitAnswer(state, DAILY_CODE, [4, 2, 6], NOW);
      expect(again.outcome).toMatchObject({ correct: true, reward: 0, firstSolve: false });
      state = again.state;
    }
    expect(state.credits).toBe(140);
    expect(getProgress(state, DAILY_CODE.id).attempts).toBe(1);
  });

  it("힌트를 쓰고 맞히면 '힌트 미사용' 기록이 남지 않는다", () => {
    const hinted = requestHint(enrolled(), DAILY_CODE).state;
    const result = submitAnswer(hinted, DAILY_CODE, [4, 2, 6], NOW);
    expect(result.outcome.noHint).toBe(false);
    expect(result.state.credits).toBe(120);
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

describe("승급 시험", () => {
  it("오늘의 추리와 연습실 문제를 모두 해결해야 열린다", () => {
    let state = enrolled();
    expect(examStatus(state)).toMatchObject({ unlocked: false, doneCount: 0 });
    expect(canPlay(state, EXAM_SCHEDULE)).toBe(false);

    state = submitAnswer(state, DAILY_CODE, [4, 2, 6], NOW).state;
    expect(examStatus(state)).toMatchObject({ unlocked: false, doneCount: 1 });

    state = submitAnswer(state, PRACTICE_TRUTH, "sera", NOW).state;
    expect(examStatus(state)).toMatchObject({ unlocked: true, doneCount: 2 });
    expect(canPlay(state, EXAM_SCHEDULE)).toBe(true);
  });

  it("잠긴 시험에는 정답을 내도 접수되지 않는다", () => {
    const result = submitAnswer(enrolled(), EXAM_SCHEDULE, EXAM_SCHEDULE.solution, NOW);
    expect(result.outcome.accepted).toBe(false);
    expect(result.state.rank).toBe("F");
    expect(result.state.credits).toBe(40);
  });

  it("합격하면 F급에서 D급으로 올라가고 +150을 받는다", () => {
    let state = buildDemoState("exam-ready", NOW);
    expect(state.credits).toBe(200);
    const wrong = submitAnswer(state, EXAM_SCHEDULE, ["sea", "harin", "doyun", "minjae"], NOW);
    expect(wrong.outcome).toMatchObject({ correct: false, promotedTo: null });
    state = wrong.state;
    expect(state.rank).toBe("F");

    const pass = submitAnswer(state, EXAM_SCHEDULE, ["doyun", "minjae", "sea", "harin"], NOW);
    expect(pass.outcome).toMatchObject({ correct: true, reward: 150, promotedTo: "D" });
    expect(pass.state.rank).toBe("D");
    expect(pass.state.credits).toBe(350);
    expect(pass.state.promotions).toEqual([{ from: "F", to: "D", at: NOW.toISOString() }]);
  });

  it("힌트를 써도 정답이면 합격한다", () => {
    let state = buildDemoState("exam-ready", NOW);
    state = requestHint(state, EXAM_SCHEDULE).state;
    state = requestHint(state, EXAM_SCHEDULE).state;
    const pass = submitAnswer(state, EXAM_SCHEDULE, EXAM_SCHEDULE.solution, NOW);
    expect(pass.outcome.promotedTo).toBe("D");
    expect(getProgress(pass.state, EXAM_SCHEDULE.id).solvedHints).toBe(2);
  });

  it("합격 후 다시 제출해도 두 번 승급하거나 보상을 다시 받지 않는다", () => {
    const promoted = buildDemoState("promoted", NOW);
    const again = submitAnswer(promoted, EXAM_SCHEDULE, EXAM_SCHEDULE.solution, NOW);
    expect(again.outcome).toMatchObject({ correct: true, reward: 0, promotedTo: null });
    expect(again.state.rank).toBe("D");
    expect(again.state.credits).toBe(promoted.credits);
    expect(again.state.promotions).toHaveLength(1);
  });
});

describe("데모 프리셋", () => {
  it("다섯 가지 상태를 엔진으로 재현한다", () => {
    expect(buildDemoState("first-run", NOW).enrolled).toBe(false);

    const unsolved = buildDemoState("daily-unsolved", NOW);
    expect(unsolved).toMatchObject({ enrolled: true, credits: 40, rank: "F" });
    expect(getProgress(unsolved, DAILY_CODE.id).status).toBe("new");

    const solved = buildDemoState("daily-solved", NOW);
    expect(getProgress(solved, DAILY_CODE.id).status).toBe("solved");
    expect(solved.credits).toBe(140);
    expect(examStatus(solved).unlocked).toBe(false);

    expect(examStatus(buildDemoState("exam-ready", NOW)).unlocked).toBe(true);

    const promoted = buildDemoState("promoted", NOW);
    expect(promoted).toMatchObject({ rank: "D", credits: 350 });
  });
});

describe("저장 데이터 복원", () => {
  it("JSON 으로 저장했다 읽어도 상태가 같다", () => {
    const state = buildDemoState("promoted", NOW);
    expect(hydrate(JSON.parse(JSON.stringify(state)))).toEqual(state);
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
});

describe("시간", () => {
  it("날짜 기준은 Asia/Seoul 이다", () => {
    // UTC 15:30 은 서울에서 다음 날 00:30 이다.
    expect(seoulDateKey(new Date("2026-11-20T15:30:00Z"))).toBe("2026-11-21");
    expect(seoulDateKey(new Date("2026-11-20T14:59:00Z"))).toBe("2026-11-20");
  });

  it("경과 시간 표기", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(127_400)).toBe("02:07");
    expect(formatDuration(45_000)).toBe("45초");
    expect(formatDuration(127_400)).toBe("2분 7초");
  });
});
