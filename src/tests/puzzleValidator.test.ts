import { describe, expect, it } from "vitest";
import { DAILY_CODE, EXAM_SCHEDULE, PRACTICE_TRUTH, PUZZLES } from "../data/puzzles";
import {
  checkAnswer,
  countTrue,
  enumerateCodes,
  permutations,
  scoreCodeGuess,
  solveCode,
  solveSchedule,
  solveTruth,
  truthValues,
  verifyGuidance,
  verifyPuzzle,
} from "../engine/puzzleValidator";
import type { CodePuzzle, SchedulePuzzle, TruthPuzzle } from "../engine/types";

describe("모든 문제는 정답이 정확히 하나다", () => {
  it.each(PUZZLES.map((p) => [p.id, p] as const))("%s", (_id, puzzle) => {
    const result = verifyPuzzle(puzzle);
    expect(result.solutions).toHaveLength(1);
    expect(result.unique).toBe(true);
    expect(result.matchesDeclared).toBe(true);
    expect(result.ok).toBe(true);
  });
});

describe("암호 해독", () => {
  it("1~9의 서로 다른 세 자리 조합 504개를 모두 검사한다", () => {
    expect(enumerateCodes(DAILY_CODE.rules)).toHaveLength(504);
    expect(verifyPuzzle(DAILY_CODE).candidateCount).toBe(504);
  });

  it("단서를 모두 만족하는 암호는 426 하나뿐이다", () => {
    expect(solveCode(DAILY_CODE.rules)).toEqual([[4, 2, 6]]);
  });

  it("단서 채점: 일치 개수와 자리 일치 개수", () => {
    expect(scoreCodeGuess([4, 2, 6], [1, 9, 6])).toEqual({ match: 1, inPlace: 1 });
    expect(scoreCodeGuess([4, 2, 6], [5, 7, 9])).toEqual({ match: 0, inPlace: 0 });
    expect(scoreCodeGuess([4, 2, 6], [1, 6, 5])).toEqual({ match: 1, inPlace: 0 });
    expect(scoreCodeGuess([4, 2, 6], [6, 5, 2])).toEqual({ match: 2, inPlace: 0 });
    expect(scoreCodeGuess([4, 2, 6], [4, 6, 3])).toEqual({ match: 2, inPlace: 1 });
  });

  it("504개 조합 중 정답으로 채점되는 것은 하나뿐이다", () => {
    const accepted = enumerateCodes(DAILY_CODE.rules).filter((code) => checkAnswer(DAILY_CODE, code));
    expect(accepted).toEqual([[4, 2, 6]]);
  });

  it("형식이 틀린 답안은 오답이다", () => {
    expect(checkAnswer(DAILY_CODE, [4, 2])).toBe(false);
    expect(checkAnswer(DAILY_CODE, [4, 4, 6])).toBe(false);
    expect(checkAnswer(DAILY_CODE, [4, 2, 0])).toBe(false);
    expect(checkAnswer(DAILY_CODE, "426")).toBe(false);
    expect(checkAnswer(DAILY_CODE, null)).toBe(false);
  });

  it("단서가 바뀌어 답이 여러 개가 되면 검증이 실패한다", () => {
    const loose: CodePuzzle = {
      ...DAILY_CODE,
      rules: { ...DAILY_CODE.rules, clues: DAILY_CODE.rules.clues.slice(0, 4) },
    };
    const result = verifyPuzzle(loose);
    expect(result.solutions.length).toBeGreaterThan(1);
    expect(result.ok).toBe(false);
  });

  it("단서가 바뀌어 답이 없어지면 검증이 실패한다", () => {
    const broken: CodePuzzle = {
      ...DAILY_CODE,
      rules: {
        ...DAILY_CODE.rules,
        clues: [...DAILY_CODE.rules.clues, { guess: [4, 2, 6], match: 0, inPlace: 0 }],
      },
    };
    const result = verifyPuzzle(broken);
    expect(result.solutions).toHaveLength(0);
    expect(result.ok).toBe(false);
  });

  it("선언된 정답이 틀리면 검증이 실패한다", () => {
    const wrong: CodePuzzle = { ...DAILY_CODE, solution: [4, 6, 2] };
    const result = verifyPuzzle(wrong);
    expect(result.unique).toBe(true);
    expect(result.matchesDeclared).toBe(false);
    expect(result.ok).toBe(false);
  });
});

describe("거짓 진술 찾기", () => {
  it("범인 후보 4명을 모두 가정해 참인 진술 수를 센다", () => {
    const rules = PRACTICE_TRUTH.rules;
    expect(countTrue(rules, "hana")).toBe(2);
    expect(countTrue(rules, "junho")).toBe(3);
    expect(countTrue(rules, "sera")).toBe(1);
    expect(countTrue(rules, "daon")).toBe(3);
  });

  it("정확히 한 진술만 참인 경우는 세라뿐이다", () => {
    expect(solveTruth(PRACTICE_TRUTH.rules)).toEqual(["sera"]);
    // 세라가 범인일 때 참인 진술은 다온의 진술 하나다.
    expect(truthValues(PRACTICE_TRUTH.rules, "sera")).toEqual([false, false, false, true]);
  });

  it("정답만 정답으로 채점된다", () => {
    const accepted = PRACTICE_TRUTH.rules.people.filter((p) => checkAnswer(PRACTICE_TRUTH, p.id));
    expect(accepted.map((p) => p.id)).toEqual(["sera"]);
    expect(checkAnswer(PRACTICE_TRUTH, "nobody")).toBe(false);
    expect(checkAnswer(PRACTICE_TRUTH, 3)).toBe(false);
  });

  it("조건이 바뀌어 답이 2명이 되거나 없어지면 검증이 실패한다", () => {
    const two: TruthPuzzle = { ...PRACTICE_TRUTH, rules: { ...PRACTICE_TRUTH.rules, trueCount: 3 } };
    expect(verifyPuzzle(two).solutions).toHaveLength(2);
    expect(verifyPuzzle(two).ok).toBe(false);

    const none: TruthPuzzle = { ...PRACTICE_TRUTH, rules: { ...PRACTICE_TRUTH.rules, trueCount: 4 } };
    expect(verifyPuzzle(none).solutions).toHaveLength(0);
    expect(verifyPuzzle(none).ok).toBe(false);
  });
});

describe("발표 순서 재구성", () => {
  it("가능한 순서 24개를 모두 검사한다", () => {
    expect(permutations(EXAM_SCHEDULE.rules.people)).toHaveLength(24);
    expect(verifyPuzzle(EXAM_SCHEDULE).candidateCount).toBe(24);
  });

  it("조건을 모두 만족하는 순서는 도윤 → 민재 → 세아 → 하린 하나뿐이다", () => {
    expect(solveSchedule(EXAM_SCHEDULE.rules)).toEqual([["doyun", "minjae", "sea", "harin"]]);
  });

  it("24개 순서 중 정답으로 채점되는 것은 하나뿐이다", () => {
    const ids = EXAM_SCHEDULE.rules.people.map((p) => p.id);
    const accepted = permutations(ids).filter((order) => checkAnswer(EXAM_SCHEDULE, order));
    expect(accepted).toEqual([["doyun", "minjae", "sea", "harin"]]);
  });

  it("덜 채운 답안과 중복 배치는 오답이다", () => {
    expect(checkAnswer(EXAM_SCHEDULE, ["doyun", "minjae", "sea"])).toBe(false);
    expect(checkAnswer(EXAM_SCHEDULE, ["doyun", "minjae", "sea", "sea"])).toBe(false);
    expect(checkAnswer(EXAM_SCHEDULE, ["doyun", "minjae", "sea", null])).toBe(false);
  });

  it("조건 하나가 빠져 답이 여러 개가 되면 검증이 실패한다", () => {
    const loose: SchedulePuzzle = {
      ...EXAM_SCHEDULE,
      rules: { ...EXAM_SCHEDULE.rules, constraints: EXAM_SCHEDULE.rules.constraints.slice(0, 3) },
    };
    expect(verifyPuzzle(loose).solutions.length).toBeGreaterThan(1);
    expect(verifyPuzzle(loose).ok).toBe(false);
  });
});

describe("힌트와 해설은 정답과 모순되지 않는다", () => {
  it.each(PUZZLES.map((p) => [p.id, p] as const))("%s", (_id, puzzle) => {
    const result = verifyGuidance(puzzle);
    expect(result.issues).toEqual([]);
    expect(result.candidatesAfterHints).toBeGreaterThanOrEqual(2);
    expect(puzzle.hints).toHaveLength(2);
    expect(puzzle.explanation.length).toBeGreaterThan(0);
  });

  it("정답과 어긋나는 힌트를 넣으면 점검이 실패한다", () => {
    const bad: CodePuzzle = {
      ...DAILY_CODE,
      hints: [{ text: "6은 암호에 없습니다.", facts: [{ kind: "absent", digits: [6] }] }, DAILY_CODE.hints[1]],
    };
    expect(verifyGuidance(bad).ok).toBe(false);
  });

  it("힌트 문구에 정답이 그대로 적히면 점검이 실패한다", () => {
    const leak: CodePuzzle = {
      ...DAILY_CODE,
      hints: [DAILY_CODE.hints[0], { text: "암호는 426입니다.", facts: [] }],
    };
    expect(verifyGuidance(leak).ok).toBe(false);
  });

  it("힌트만으로 후보가 하나로 줄면 점검이 실패한다", () => {
    const spoiler: SchedulePuzzle = {
      ...EXAM_SCHEDULE,
      hints: [
        EXAM_SCHEDULE.hints[0],
        {
          text: "도윤이 9시, 민재가 10시입니다.",
          facts: [
            { kind: "slotIs", who: "doyun", slot: 0 },
            { kind: "slotIs", who: "minjae", slot: 1 },
          ],
        },
      ],
    };
    const result = verifyGuidance(spoiler);
    expect(result.candidatesAfterHints).toBe(1);
    expect(result.ok).toBe(false);
  });
});
