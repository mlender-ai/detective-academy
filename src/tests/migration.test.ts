/**
 * 예전 저장 마이그레이션: 지금 배포본(main 브랜치)이 남긴 저장을 지금의 hydrate 가 읽어
 * 크레딧 · 등급 · 해결 기록을 그대로 지키는가. 저장은 main 의 엔진을 실제로 돌려 만든 것이다(fixtures/mainSaves.ts).
 */
import { describe, expect, it } from "vitest";
import { PRACTICE_PUZZLES, PUZZLE_BY_ID, pastDailies } from "../data/puzzles";
import { PROMOTION_RULES } from "../data/ranks";
import { defaultSettings, examStatus, getProgress, hydrate, practiceUnlocked, solvedCount, startExam, submitAnswer, tasksSolved } from "../engine/progressEngine";
import { emptyStory } from "../story/engine/storyEngine";
import type { GameState } from "../engine/types";
import { MAIN_SAVE_D, MAIN_SAVE_F } from "./fixtures/mainSaves";

type OldSave = {
  nickname: string;
  detectiveNo: string;
  enrolledAt: string;
  rank: string;
  credits: number;
  puzzles: Record<string, Record<string, unknown>>;
  promotions: unknown[];
  settings: { sound: boolean };
};

/** 저장소에 문자열로 들어 있던 것을 읽는 길 그대로: JSON → hydrate */
const read = (save: unknown): GameState => hydrate(JSON.parse(JSON.stringify(save)));

/** 서울의 그 날짜 정오 */
const seoul = (dateKey: string) => new Date(`${dateKey}T12:00:00+09:00`);

describe.each([
  ["F급 · 풀다 만 과제가 있는 저장", MAIN_SAVE_F as OldSave],
  ["D급 · 승급한 저장", MAIN_SAVE_D as OldSave],
])("main 의 저장을 읽는다: %s", (_, old) => {
  const state = read(old);

  it("예전 저장에는 시험 진행 · 응시 횟수 · 사건 수사가 없고 설정은 효과음뿐이다(전제)", () => {
    expect(Object.keys(old).sort()).toEqual(["credits", "detectiveNo", "enrolled", "enrolledAt", "nickname", "promotions", "puzzles", "rank", "settings", "version"]);
    expect(Object.keys(old.settings)).toEqual(["sound"]);
  });

  it("이름 · 학번 · 입학일 · 등급 · 크레딧 · 승급 기록이 그대로다", () => {
    expect(state.enrolled).toBe(true);
    expect(state.nickname).toBe(old.nickname);
    expect(state.detectiveNo).toBe(old.detectiveNo);
    expect(state.enrolledAt).toBe(old.enrolledAt);
    expect(state.rank).toBe(old.rank);
    expect(state.credits).toBe(old.credits);
    expect(state.promotions).toEqual(old.promotions);
  });

  it("문제마다의 기록(상태 · 풀던 입력 · 시간 · 제출 · 힌트 · 해결한 때)이 하나도 빠지지 않는다", () => {
    expect(Object.keys(state.puzzles).sort()).toEqual(Object.keys(old.puzzles).sort());
    for (const [id, progress] of Object.entries(old.puzzles)) {
      expect(PUZZLE_BY_ID[id], `${id} 는 지금도 있는 문제다`).toBeTruthy();
      expect(state.puzzles[id], id).toEqual(progress);
    }
  });

  it("새로 생긴 칸은 빈 값으로 채운다: 시험 없음 · 응시 횟수 없음 · 사건 수사 안 함 · 음악 꺼짐", () => {
    expect(state.exam).toBeNull();
    expect(state.examDays).toEqual({});
    expect(state.story).toEqual(emptyStory());
    // 효과음은 저장된 대로, 음악과 음량은 기본값
    expect(state.settings).toEqual({ ...defaultSettings(), sound: old.settings.sound });
  });

  it("읽은 것을 다시 저장했다 읽어도 같다", () => {
    expect(read(state)).toEqual(state);
  });

  it("이미 받은 보상은 다시 나오지 않고, 그 뒤에 새로 푼 문제의 보상은 예전 크레딧 위에 쌓인다", () => {
    const now = seoul("2026-11-24");
    let next = state;
    for (const [id, progress] of Object.entries(old.puzzles)) {
      if (progress.status !== "solved" || PUZZLE_BY_ID[id].category === "exam") continue;
      const again = submitAnswer(next, PUZZLE_BY_ID[id], PUZZLE_BY_ID[id].solution, now);
      expect(again.outcome, id).toMatchObject({ accepted: true, correct: true, firstSolve: false, reward: 0 });
      next = again.state;
    }
    expect(next.credits).toBe(old.credits);

    // 그 사이 지나간 날의 문제(11월 23일)를 지난 사건에서 푼다
    const missed = pastDailies("2026-11-24").find((e) => getProgress(next, e.puzzle.id).status !== "solved")!.puzzle;
    const solved = submitAnswer(next, missed, missed.solution, now);
    expect(solved.outcome).toMatchObject({ firstSolve: true, reward: missed.reward });
    expect(solved.state.credits).toBe(old.credits + missed.reward);
  });
});

describe("main 의 저장으로 이어서 플레이한다", () => {
  it("F급: 풀다 만 연습 과제를 그 입력 그대로 이어 풀고, 처음 해결 보상을 받는다", () => {
    const state = read(MAIN_SAVE_F);
    const practice = PUZZLE_BY_ID["practice-truth-001"];
    expect(getProgress(state, practice.id)).toMatchObject({
      status: "in_progress",
      elapsedMs: 42_000,
      input: { type: "truth", suspect: "hana", memos: { hana: { junho: true, sera: true, daon: false } }, pinned: ["hana"] },
    });
    expect(practiceUnlocked(state, practice)).toBe(true);
    expect(tasksSolved(state)).toBe(1);

    const solved = submitAnswer(state, practice, practice.solution, seoul("2026-11-24"));
    expect(solved.outcome).toMatchObject({ correct: true, firstSolve: true, reward: practice.reward });
    expect(solved.state.credits).toBe(120 + practice.reward);
    // 예전에 쓴 힌트와 제출 횟수는 오늘의 추리 기록에 남아 있다
    expect(getProgress(solved.state, "daily-code-001")).toMatchObject({ status: "solved", solvedHints: 1, solvedAttempts: 2, solvedDateKey: "2026-11-22" });
  });

  it("D급: 등급이 내려가지 않고, 다음 시험(D→C)의 응시 조건을 예전에 푼 과제부터 이어서 센다", () => {
    const state = read(MAIN_SAVE_D);
    const now = seoul("2026-11-24");
    expect(state.rank).toBe("D");
    expect(solvedCount(state, "daily")).toBe(1);
    expect(solvedCount(state, "practice")).toBe(1);

    const status = examStatus(state, now);
    const rule = PROMOTION_RULES.find((r) => r.from === "D")!;
    expect(status.rule).toBe(rule);
    expect(status.solved).toBe(2);
    expect(status.unlocked).toBe(false);
    // 조건을 채우기 전에는 시험이 시작되지 않고, 예전에 합격한 F→D 시험의 기록도 그대로다
    expect(startExam(state, now)).toBe(state);
    expect(getProgress(state, "exam-schedule-f-d")).toMatchObject({ status: "solved", solvedElapsedMs: 155_000 });

    // D급의 서랍까지 열려 있다: 연습 과제를 풀어 조건을 채우면 응시할 수 있다
    let next = state;
    for (const puzzle of PRACTICE_PUZZLES) {
      if (tasksSolved(next) >= rule.requiredSolved) break;
      if (!practiceUnlocked(next, puzzle) || getProgress(next, puzzle.id).status === "solved") continue;
      next = submitAnswer(next, puzzle, puzzle.solution, now).state;
    }
    // 과제 수는 채웠지만 D→C 는 사건(D-001)을 해결해야 열린다: 예전 사용자도 사건부터 푼다
    expect(examStatus(next, now)).toMatchObject({ tasksDone: true, caseRequired: "d001", caseDone: false, canStart: false });
    expect(next.rank).toBe("D");
    expect(next.credits).toBeGreaterThan(350);
  });

  it("깨진 값이 섞인 예전 저장도 버리지 않는다: 읽을 수 있는 크레딧 · 등급 · 기록은 지킨다", () => {
    const old = JSON.parse(JSON.stringify(MAIN_SAVE_D));
    old.settings = null;
    old.puzzles["지워진-문제"] = { status: "solved", rewardClaimed: true };
    old.puzzles["practice-truth-001"] = { status: "solved", rewardClaimed: true };
    const state = hydrate(old);
    expect(state.credits).toBe(350);
    expect(state.rank).toBe("D");
    expect(state.settings).toEqual(defaultSettings());
    // 지금은 없는 문제의 기록은 읽지 않고, 칸이 빠진 기록은 빈 값으로 채운다
    expect(state.puzzles["지워진-문제"]).toBeUndefined();
    expect(state.puzzles["practice-truth-001"]).toMatchObject({ status: "solved", rewardClaimed: true, elapsedMs: 0, solvedAt: null });
    expect(getProgress(state, "daily-code-001").status).toBe("solved");
  });
});
