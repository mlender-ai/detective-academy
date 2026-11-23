import { beforeAll, describe, expect, it } from "vitest";
import { DAILY_CODE_2, DAILY_EVIDENCE_1, DAILY_EVIDENCE_2, DAILY_SCHEDULE_1, DAILY_SEAL_1, DAILY_SEAL_2, DAILY_SET, DAILY_TRUTH_1, DAILY_WEEK_1_COUNT } from "../data/dailySet";
import * as cast from "../data/people";
import { ALL_PUZZLES, DAILY_CALENDAR, DAILY_CODE, EXAM_SCHEDULE, PRACTICE_TRUTH, PUZZLE_BY_ID, getDailyPuzzle, practiceOfRank } from "../data/puzzles";
import { PROMOTION_RULES } from "../data/ranks";
import {
  ADDED_SET,
  EXAM_EVIDENCE_D_C,
  PRACTICE_CODE_D,
  PRACTICE_EVIDENCE_C,
  PRACTICE_EVIDENCE_F,
  PRACTICE_SCHEDULE_F,
  PRACTICE_SEAL_D,
  PRACTICE_TRUTH_C,
  SPECIAL_CODE_1,
} from "../data/sets/additions";
import { CODE_SET } from "../data/sets/code";
import { DAILY_CODE_3, DAILY_EVIDENCE_3, DAILY_SCHEDULE_2, DAILY_SCHEDULE_3, DAILY_SEAL_3, DAILY_TRUTH_2, DAILY_WEEK_2 } from "../data/sets/dailyWeek2";
import { EVIDENCE_SET } from "../data/sets/evidence";
import { SCHEDULE_SET } from "../data/sets/schedule";
import { SEAL_SET } from "../data/sets/seal";
import { TRUTH_SET } from "../data/sets/truth";
import { CREDIT_POLICY, policyReward } from "../engine/creditEngine";
import {
  allCards,
  auditEvidence,
  contradicts,
  derivationPath,
  deriveFrom,
  entailedPositions,
  entails,
  enumerateEvidence,
  satisfiable,
  solveEvidence,
  type EvidenceAudit,
} from "../engine/evidence";
import {
  checkAnswer,
  constraintHolds,
  countTrue,
  enumerateCodes,
  evalTruthClaim,
  permutations,
  scoreCodeGuess,
  solveCode,
  solveSchedule,
  solveTruth,
  truthValues,
  verifyGuidance,
  verifyPuzzle,
  type GuidanceVerification,
  type PuzzleVerification,
} from "../engine/puzzleValidator";
import { auditSpatial, dotCount, enumerateSeals, imprintMatches, mirrorGrid, pressSeal, rotateGrid, sealDifference, solveSpatial, TURNS } from "../engine/seal";
import { addDays } from "../engine/time";
import type {
  CodePuzzle,
  EvidenceClaim,
  EvidencePuzzle,
  EvidenceRules,
  Puzzle,
  SchedulePuzzle,
  SpatialPuzzle,
  TruthClaim,
  TruthPuzzle,
  TruthRules,
} from "../engine/types";
import { evidencePair, initialInput, readiness, toAnswer } from "../games/logic";

/**
 * 첫 공개 버전에서 더한 문제 14개의 검증: 일일 6 · 연습실 6 · D→C 시험 1 · 특수 도전 1.
 *
 * 정답이 하나인 것만 보지 않는다(지시서 4절). 문제마다 다음을 후보 공간 전수 탐색으로 확인한다:
 *  - 정답이 존재하고 정확히 하나이며 선언한 답과 같다. 정답만 정답으로 채점된다.
 *  - 군더더기가 없다: 조건·기록·진술·증거를 하나 빼면 답이 여럿이 되거나 풀리지 않는다.
 *  - 힌트와 해설이 단정하는 사실이 참이고, 해설의 글이 말하는 중간 사실이 맞다.
 *  - 같은 유형의 기존 문제와 푸는 길이 다르다.
 *  - 화면의 한계(글의 길이, 카드·조건·도장의 수) 안이다.
 * 전수 탐색이 무거운 증거 조합은 문제마다 한 번만 돌려 두고 여러 테스트가 나눠 쓴다.
 */

const NEW: Puzzle[] = [...DAILY_WEEK_2, ...ADDED_SET];
const each = NEW.map((p) => [p.id, p] as const);
const OLD: Puzzle[] = ALL_PUZZLES.filter((p) => !NEW.includes(p));

const codes = NEW.filter((p): p is CodePuzzle => p.type === "code");
const truths = NEW.filter((p): p is TruthPuzzle => p.type === "truth");
const schedules = NEW.filter((p): p is SchedulePuzzle => p.type === "schedule");
const evidences = NEW.filter((p): p is EvidencePuzzle => p.type === "evidence");
const seals = NEW.filter((p): p is SpatialPuzzle => p.type === "spatial");

const verified = new Map<string, PuzzleVerification>();
const guidance = new Map<string, GuidanceVerification>();
const audits = new Map<string, EvidenceAudit>();

beforeAll(() => {
  for (const puzzle of NEW) {
    verified.set(puzzle.id, verifyPuzzle(puzzle));
    guidance.set(puzzle.id, verifyGuidance(puzzle));
    if (puzzle.type === "evidence") audits.set(puzzle.id, auditEvidence(puzzle.rules));
  }
}, 180_000);

/* ═════════ 표의 칸 ═════════ */

describe("새 문제 14개: 표의 칸", () => {
  const TABLE = [
    // 일일 · 둘째 주 (달력의 9~14일째)
    { id: "daily-schedule-002", type: "schedule", category: "daily", rank: "F", difficulty: 2, reward: 60, hints: 2 },
    { id: "daily-truth-002", type: "truth", category: "daily", rank: "F", difficulty: 2, reward: 60, hints: 2 },
    { id: "daily-code-003", type: "code", category: "daily", rank: "F", difficulty: 1, reward: 60, hints: 2 },
    { id: "daily-seal-003", type: "spatial", category: "daily", rank: "C", difficulty: 4, reward: 60, hints: 2 },
    { id: "daily-evidence-003", type: "evidence", category: "daily", rank: "D", difficulty: 3, reward: 60, hints: 2 },
    { id: "daily-schedule-003", type: "schedule", category: "daily", rank: "C", difficulty: 4, reward: 60, hints: 2 },
    // 연습실 F · D · C 둘씩
    { id: "practice-schedule-f", type: "schedule", category: "practice", rank: "F", difficulty: 1, reward: 30, hints: 2 },
    { id: "practice-evidence-f", type: "evidence", category: "practice", rank: "F", difficulty: 1, reward: 30, hints: 2 },
    { id: "practice-code-d", type: "code", category: "practice", rank: "D", difficulty: 2, reward: 35, hints: 2 },
    { id: "practice-seal-d", type: "spatial", category: "practice", rank: "D", difficulty: 2, reward: 35, hints: 2 },
    { id: "practice-truth-c", type: "truth", category: "practice", rank: "C", difficulty: 3, reward: 40, hints: 2 },
    { id: "practice-evidence-c", type: "evidence", category: "practice", rank: "C", difficulty: 3, reward: 40, hints: 2 },
    // D→C 승급 시험의 셋째 문제
    { id: "exam-evidence-d-c", type: "evidence", category: "exam", rank: "D", difficulty: 3, reward: 0, hints: 2 },
    // 특수 도전
    { id: "special-code-001", type: "code", category: "practice", rank: "C", difficulty: 5, reward: 60, hints: 2 },
  ];

  it("열네 문제가 표의 순서대로 있고, 유형·구분·등급·난이도·보상·힌트 수가 맞다", () => {
    expect(NEW).toHaveLength(14);
    expect(
      NEW.map((p) => ({ id: p.id, type: p.type, category: p.category, rank: p.rank, difficulty: p.difficulty, reward: p.reward, hints: p.hints.length })),
    ).toEqual(TABLE);
    expect(DAILY_WEEK_2).toEqual([DAILY_SCHEDULE_2, DAILY_TRUTH_2, DAILY_CODE_3, DAILY_SEAL_3, DAILY_EVIDENCE_3, DAILY_SCHEDULE_3]);
    expect(ADDED_SET).toEqual([
      PRACTICE_SCHEDULE_F,
      PRACTICE_EVIDENCE_F,
      PRACTICE_CODE_D,
      PRACTICE_SEAL_D,
      PRACTICE_TRUTH_C,
      PRACTICE_EVIDENCE_C,
      EXAM_EVIDENCE_D_C,
      SPECIAL_CODE_1,
    ]);
  });

  it("이름표와 제목이 기존 문제와도, 서로도 겹치지 않는다. 기존 문제는 하나도 빠지거나 바뀌지 않았다", () => {
    expect(new Set(ALL_PUZZLES.map((p) => p.id)).size).toBe(ALL_PUZZLES.length);
    expect(new Set(ALL_PUZZLES.map((p) => p.title)).size).toBe(ALL_PUZZLES.length);
    // GATE 05 까지의 38문제 + 14
    expect(OLD).toHaveLength(38);
    expect(ALL_PUZZLES).toHaveLength(52);
    for (const puzzle of NEW) expect(PUZZLE_BY_ID[puzzle.id]).toBe(puzzle);
  });

  it("보상은 정책표와 같고, 유형 이름은 같은 유형의 기존 문제와 같다", () => {
    const label = { code: DAILY_CODE.typeLabel, truth: PRACTICE_TRUTH.typeLabel, schedule: EXAM_SCHEDULE.typeLabel, evidence: DAILY_EVIDENCE_1.typeLabel, spatial: DAILY_SEAL_1.typeLabel };
    for (const puzzle of NEW) {
      expect(puzzle.reward, puzzle.id).toBe(policyReward(puzzle.category, puzzle.rank, puzzle.special));
      expect(puzzle.typeLabel, puzzle.id).toBe(label[puzzle.type]);
    }
  });

  it("유형이 고르게 섞였다: 14문제에 다섯 유형이 둘에서 넷씩", () => {
    const count = (type: string) => NEW.filter((p) => p.type === type).length;
    expect(["code", "truth", "schedule", "evidence", "spatial"].map(count)).toEqual([3, 2, 3, 4, 2]);
  });

  it.each(each)("%s: 사건을 여는 글과 닫는 글이 한두 문장이고 64자 이하이며, 예상 시간이 적혀 있다", (_id, puzzle) => {
    for (const text of [puzzle.intro, puzzle.outro]) {
      expect(text).toBeTruthy();
      expect(text!.split(/[.?!]\s/).length).toBeLessThanOrEqual(3);
      expect([...text!].length).toBeLessThanOrEqual(64);
    }
    expect(puzzle.rank).toBeTruthy();
    expect(puzzle.minutes).toBeGreaterThanOrEqual(2);
    expect(puzzle.minutes).toBeLessThanOrEqual(6);
    // 오늘의 추리는 하루 3~5분 안에 든다(가벼운 날은 2분)
    if (puzzle.category === "daily") expect(puzzle.minutes).toBeLessThanOrEqual(5);
    // 홈의 게시판 줄과 연습실의 과제 줄에 들어가는 제목: 같은 자리에 놓이는 기존 제목 가운데 가장 긴 것을 넘지 않는다
    const longest = Math.max(...OLD.filter((p) => p.category === puzzle.category).map((p) => [...p.title].length));
    expect(longest).toBe(puzzle.category === "exam" ? 13 : 12);
    expect([...puzzle.title].length, puzzle.title).toBeLessThanOrEqual(longest);
  });
});

/* ═════════ 달력 · 서랍 · 시험 · 특수 도전 ═════════ */

describe("오늘의 추리: 열나흘치 달력", () => {
  it("앞 여덟 날의 배정은 그대로이고, 새 여섯 문제는 그 뒤에 붙는다", () => {
    expect(DAILY_CALENDAR.start).toBe("2026-11-22");
    expect(DAILY_CALENDAR.order).toEqual([
      "daily-code-001",
      "daily-evidence-001",
      "daily-seal-001",
      "daily-code-002",
      "daily-truth-001",
      "daily-evidence-002",
      "daily-schedule-001",
      "daily-seal-002",
      "daily-schedule-002",
      "daily-truth-002",
      "daily-code-003",
      "daily-seal-003",
      "daily-evidence-003",
      "daily-schedule-003",
    ]);
    DAILY_CALENDAR.order.forEach((id, day) => {
      expect(getDailyPuzzle(addDays(DAILY_CALENDAR.start, day))?.id, `${day + 1}일째`).toBe(id);
    });
    expect(getDailyPuzzle("2026-11-30")).toBe(DAILY_SCHEDULE_2);
    expect(getDailyPuzzle("2026-12-05")).toBe(DAILY_SCHEDULE_3);
    // QA 주소의 ?day= 는 여전히 첫 주의 일곱 문제만 가리킨다
    expect(DAILY_WEEK_1_COUNT).toBe(7);
    expect(DAILY_SET.slice(DAILY_WEEK_1_COUNT)).toEqual(DAILY_WEEK_2);
  });

  it("열나흘에 다섯 유형이 두세 번씩 나오고, 이틀 연달아 같은 유형이 붙지 않는다", () => {
    const days = DAILY_CALENDAR.order.map((id) => PUZZLE_BY_ID[id]);
    const count = (type: string) => days.filter((p) => p.type === type).length;
    expect(["code", "truth", "schedule", "evidence", "spatial"].map(count)).toEqual([3, 2, 3, 3, 3]);
    days.slice(1).forEach((puzzle, i) => expect(puzzle.type, `${i + 2}일째`).not.toBe(days[i].type));
  });

  it("난이도가 1부터 4까지 섞여 있다(둘째 주에 1과 4가 처음 나온다)", () => {
    const days = DAILY_CALENDAR.order.map((id) => PUZZLE_BY_ID[id].difficulty);
    expect(days).toEqual([2, 2, 2, 3, 3, 3, 3, 3, 2, 2, 1, 4, 3, 4]);
    expect(new Set(days)).toEqual(new Set([1, 2, 3, 4]));
    expect(DAILY_WEEK_2.map((p) => p.rank)).toEqual(["F", "F", "F", "C", "D", "C"]);
  });
});

describe("연습실 서랍 · D→C 시험 · 특수 도전", () => {
  it("F · D · C 서랍에 없던 유형이 채워져, 보통 과제로 다섯 유형이 하나씩 있다", () => {
    const ids = (rank: "F" | "D" | "C") => practiceOfRank(rank).map((p) => p.id);
    // 기존 과제가 앞에, 더한 과제가 뒤에 놓인다
    expect(ids("F")).toEqual(["practice-truth-001", "practice-code-f", "practice-seal-f", "practice-schedule-f", "practice-evidence-f"]);
    expect(ids("D")).toEqual(["practice-truth-d", "practice-schedule-d", "practice-evidence-d", "practice-code-d", "practice-seal-d"]);
    expect(ids("C")).toEqual(["practice-code-c", "practice-schedule-c", "practice-seal-c", "practice-truth-c", "practice-evidence-c", "special-code-001"]);
    for (const rank of ["F", "D", "C"] as const) {
      const types = practiceOfRank(rank).filter((p) => !p.special).map((p) => p.type);
      expect([...types].sort(), rank).toEqual(["code", "evidence", "schedule", "spatial", "truth"]);
    }
  });

  it("F 서랍에 더한 두 문제는 그 유형에서 가장 쉽다(규칙을 처음 익히는 수준)", () => {
    for (const puzzle of [PRACTICE_SCHEDULE_F, PRACTICE_EVIDENCE_F]) {
      const sameType = ALL_PUZZLES.filter((p) => p.type === puzzle.type && p !== puzzle);
      expect(puzzle.difficulty).toBe(1);
      expect(Math.min(...sameType.map((p) => p.difficulty)), puzzle.id).toBeGreaterThan(1);
    }
  });

  it("D→C 시험은 세 문제(암호 · 진술 · 증거)이고, 셋째 문제는 그 시험의 다른 문제만큼 어렵다", () => {
    const rule = PROMOTION_RULES.find((r) => r.from === "D")!;
    expect(rule.examPuzzleIds).toEqual(["exam-code-d-c", "exam-truth-d-c", "exam-evidence-d-c"]);
    expect(rule.examPuzzleIds.map((id) => PUZZLE_BY_ID[id].type)).toEqual(["code", "truth", "evidence"]);
    expect(rule.examPuzzleIds.map((id) => PUZZLE_BY_ID[id].difficulty)).toEqual([3, 3, 3]);
    // 수사 지원을 쓸 수 있는 시험이라 힌트가 두 단계 있다
    expect(rule.exam.hints).toBe(true);
    expect(EXAM_EVIDENCE_D_C.hints).toHaveLength(2);
    // 응시 조건·보상 등 시험의 다른 값은 건드리지 않았다
    expect(rule).toMatchObject({ requiredSolved: 5, reward: 100 });
  });

  it("특수 도전은 하나뿐이고, 표시와 보상이 따로 있다", () => {
    const special = ALL_PUZZLES.filter((p) => p.special);
    expect(special).toEqual([SPECIAL_CODE_1]);
    expect(SPECIAL_CODE_1).toMatchObject({ category: "practice", rank: "C", difficulty: 5, special: true, reward: CREDIT_POLICY.special });
    // 같은 서랍의 보통 과제보다 두 단계 어렵고, 보상도 더 많다
    const drawer = practiceOfRank("C").filter((p) => !p.special);
    expect(Math.max(...drawer.map((p) => p.difficulty))).toBe(3);
    expect(Math.max(...drawer.map((p) => p.reward))).toBeLessThan(SPECIAL_CODE_1.reward);
    // 난이도 5 는 지금까지 A급의 문제뿐이었다
    expect(OLD.filter((p) => p.difficulty === 5).every((p) => p.rank === "A")).toBe(true);
  });
});

/* ═════════ 모든 유형에 공통: 정답 · 안내 · 채점 ═════════ */

/** 그 문제의 후보를 모두 만든다(유형마다 다르다) */
function candidates(puzzle: Puzzle): unknown[] {
  switch (puzzle.type) {
    case "code":
      return enumerateCodes(puzzle.rules);
    case "truth":
      return puzzle.rules.people.map((p) => p.id);
    case "schedule":
      return permutations(puzzle.rules.people.map((p) => p.id));
    case "evidence":
      return enumerateEvidence(puzzle.rules);
    case "spatial":
      return enumerateSeals(puzzle.rules);
  }
}

describe("새 문제 14개: 정답과 안내", () => {
  it.each(each)("%s: 정답이 존재하고 정확히 하나이며, 짜임새에 문제가 없다", (id, puzzle) => {
    const result = verified.get(id)!;
    expect(result.issues).toEqual([]);
    expect(result.solutions).toEqual([puzzle.solution]);
    expect(result.unique).toBe(true);
    expect(result.matchesDeclared).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("찍어서 맞히기 어렵다: 탐색한 후보의 수", () => {
    expect(Object.fromEntries(NEW.map((p) => [p.id, verified.get(p.id)!.candidateCount]))).toEqual({
      "daily-schedule-002": 24,
      "daily-truth-002": 4,
      "daily-code-003": 504,
      "daily-seal-003": 16,
      "daily-evidence-003": 15,
      "daily-schedule-003": 120,
      "practice-schedule-f": 24,
      "practice-evidence-f": 15,
      "practice-code-d": 504,
      "practice-seal-d": 12,
      "practice-truth-c": 4,
      "practice-evidence-c": 24,
      "exam-evidence-d-c": 18,
      "special-code-001": 3024,
    });
  });

  it.each(each)("%s: 후보를 모두 채점하면 정답만 정답이다(선언한 답과 견주지 않고 규칙으로 채점한다)", (_id, puzzle) => {
    const accepted = candidates(puzzle).filter((answer) => checkAnswer(puzzle, answer));
    expect(accepted).toEqual([puzzle.solution]);
    expect(checkAnswer(puzzle, null)).toBe(false);
    expect(checkAnswer(puzzle, "")).toBe(false);
    expect(checkAnswer(puzzle, [])).toBe(false);
  });

  it.each(each)("%s: 힌트와 해설이 단정하는 사실이 모두 참이고, 힌트만으로 답이 드러나지 않는다", (id, puzzle) => {
    const result = guidance.get(id)!;
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.candidatesAfterHints).toBeGreaterThanOrEqual(2);
    expect(puzzle.hints).toHaveLength(2);
    expect(puzzle.explanation.length).toBeGreaterThanOrEqual(3);
    // 해설은 단계마다 확인할 수 있는 사실을 단다(글만 있는 단계가 없다)
    puzzle.explanation.forEach((step, i) => expect(step.facts.length, `해설 ${i + 1}`).toBeGreaterThanOrEqual(1));
    // 힌트 두 단계를 합쳐도 기계가 확인하는 사실이 하나는 있다
    expect(puzzle.hints.reduce((total, hint) => total + hint.facts.length, 0)).toBeGreaterThanOrEqual(1);
  });

  it.each(each)("%s: 화면의 조작으로 정답에 닿는다(빈 입력에서는 제출할 수 없고, 정답을 넣은 입력은 정답이 된다)", (_id, puzzle) => {
    const start = initialInput(puzzle);
    // 암호는 다이얼의 처음 값이 곧 답안 모양이라 제출은 되지만 정답은 아니다
    if (puzzle.type === "code") expect(checkAnswer(puzzle, toAnswer(puzzle, start))).toBe(false);
    else expect(readiness(puzzle, start).ok).toBe(false);
    const filled = (() => {
      switch (puzzle.type) {
        case "code":
          return { type: "code" as const, dials: [...puzzle.solution], memo: {} };
        case "truth":
          return { type: "truth" as const, suspect: puzzle.solution, memos: {}, pinned: [] };
        case "schedule":
          return { type: "schedule" as const, placement: [...puzzle.solution] };
        case "evidence": {
          const found = derivationPath(puzzle.rules, puzzle.solution.against).map((step) => step.card.id);
          return { type: "evidence" as const, picked: [puzzle.solution.against, puzzle.solution.statement], found };
        }
        case "spatial":
          return { type: "spatial" as const, stamp: puzzle.solution.stamp, turns: { [puzzle.solution.stamp]: puzzle.solution.turn }, trials: [] };
      }
    })();
    expect(readiness(puzzle, filled).ok).toBe(true);
    expect(checkAnswer(puzzle, toAnswer(puzzle, filled))).toBe(true);
  });
});

/* ═════════ 암호 해독 ═════════ */

const text = (code: readonly number[]) => code.join("");
const digitsOf = (code: string) => [...code].map(Number);

/** 기록·조건의 일부만 남기고 푼다 (번호는 0부터) */
function solveWith(puzzle: CodePuzzle, keep: { clues?: number[]; conditions?: number[] }): string[] {
  const { rules } = puzzle;
  return solveCode({
    ...rules,
    clues: keep.clues ? keep.clues.map((i) => rules.clues[i]) : rules.clues,
    conditions: keep.conditions ? keep.conditions.map((i) => rules.conditions![i]) : rules.conditions,
  }).map(text);
}

/**
 * 암호 문제의 뼈대. 기존 테스트의 뼈대(자릿수 · 숫자 범위 · 빈 기록 · 조건 · 두 기록이 함께 쓰는 숫자의 최대 수)에,
 * 기록의 결과가 만드는 특징을 더했다: 숫자를 모두 맞힌 기록이 있는가, 위치를 맞힌 기록이 하나라도 있는가.
 */
function codeShape(puzzle: CodePuzzle): string {
  const { rules } = puzzle;
  let overlap = 0;
  rules.clues.forEach((a, i) =>
    rules.clues.slice(i + 1).forEach((b) => {
      overlap = Math.max(overlap, a.guess.filter((digit) => b.guess.includes(digit)).length);
    }),
  );
  return [
    `${rules.length}자리`,
    `숫자 ${rules.digits.length}개`,
    rules.clues.some((clue) => clue.match === 0) ? "빈 기록 있음" : "빈 기록 없음",
    (rules.conditions ?? []).map((condition) => condition.kind).sort().join("+") || "조건 없음",
    `겹침 ${overlap}`,
    rules.clues.some((clue) => clue.match === rules.length) ? "다 맞힌 기록 있음" : "다 맞힌 기록 없음",
    rules.clues.every((clue) => clue.inPlace === 0) ? "위치는 한 번도 못 맞힘" : "위치를 맞힌 기록 있음",
  ].join(" · ");
}

describe("암호 해독 세 문제", () => {
  const eachCode = codes.map((p) => [p.id, p] as const);

  it.each(eachCode)("%s: 화면의 한계를 넘지 않는다", (_id, puzzle) => {
    const { rules } = puzzle;
    expect(rules.length).toBe(puzzle === SPECIAL_CODE_1 ? 4 : 3);
    expect(rules.digits).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(rules.clues.length).toBeLessThanOrEqual(5);
    expect(rules.clues.length + (rules.conditions?.length ?? 0)).toBeLessThanOrEqual(6);
    for (const condition of rules.conditions ?? []) expect(condition.text.length).toBeLessThanOrEqual(22);
    // 문제 글이 자릿수와 기록의 수를 바르게 말한다
    expect(puzzle.description).toContain(`서로 다른 숫자 ${rules.length}개`);
    expect(puzzle.description).toContain(`${["", "한", "두", "세", "네", "다섯"][rules.clues.length]} 번`);
  });

  it.each(eachCode)("%s: 어느 기록도, 어느 조건도 군더더기가 아니다(하나를 빼면 답이 여럿이 된다)", (_id, puzzle) => {
    const { rules } = puzzle;
    rules.clues.forEach((_, skip) => {
      const rest = rules.clues.map((__, i) => i).filter((i) => i !== skip);
      expect(solveWith(puzzle, { clues: rest }).length, `기록 ${skip + 1}`).toBeGreaterThan(1);
    });
    (rules.conditions ?? []).forEach((_, skip) => {
      const rest = rules.conditions!.map((__, i) => i).filter((i) => i !== skip);
      expect(solveWith(puzzle, { conditions: rest }).length, `조건 ${skip + 1}`).toBeGreaterThan(1);
    });
    // 기록에 적힌 결과는 정답과 견주어 맞다(단서끼리 모순이 없다)
    for (const clue of rules.clues) expect(scoreCodeGuess(puzzle.solution, clue.guess)).toEqual({ match: clue.match, inPlace: clue.inPlace });
  });

  it.each(eachCode)("%s: 해설의 마지막 단계는 모든 자리를 말하고, 힌트의 글에 정답이 적혀 있지 않다", (_id, puzzle) => {
    const last = puzzle.explanation[puzzle.explanation.length - 1].facts.filter((fact) => fact.kind === "at");
    expect(last).toHaveLength(puzzle.rules.length);
    for (const hint of puzzle.hints) expect(hint.text).not.toContain(text(puzzle.solution));
  });

  it("뼈대가 서로, 그리고 기존의 여덟 암호와 겹치지 않는다", () => {
    const old = [DAILY_CODE, DAILY_CODE_2, ...CODE_SET].map(codeShape);
    const fresh = codes.map(codeShape);
    expect(fresh).toEqual([
      "3자리 · 숫자 9개 · 빈 기록 없음 · 조건 없음 · 겹침 1 · 다 맞힌 기록 있음 · 위치는 한 번도 못 맞힘",
      "3자리 · 숫자 9개 · 빈 기록 없음 · greater+greater · 겹침 0 · 다 맞힌 기록 없음 · 위치를 맞힌 기록 있음",
      "4자리 · 숫자 9개 · 빈 기록 없음 · 조건 없음 · 겹침 2 · 다 맞힌 기록 없음 · 위치는 한 번도 못 맞힘",
    ]);
    expect(new Set([...old, ...fresh]).size).toBe(old.length + fresh.length);
    // 기존 문제에는 숫자를 다 맞힌 기록이 없다
    expect(old.every((shape) => shape.includes("다 맞힌 기록 없음"))).toBe(true);
    // 위치를 한 번도 못 맞힌 기존 문제는 시험 D→C 하나이고, 거기서는 새겨진 합이 숫자를 정한다.
    // 특수 도전에는 새겨진 글이 없어, 숫자를 기록끼리의 겹침으로 정해야 한다(자리를 지우는 뒷부분의 기법은 같은 종류다).
    const neverPlaced = [DAILY_CODE, DAILY_CODE_2, ...CODE_SET].filter((p) => p.rules.clues.every((clue) => clue.inPlace === 0));
    expect(neverPlaced.map((p) => p.id)).toEqual(["exam-code-d-c"]);
    expect(neverPlaced[0].rules.conditions?.map((condition) => condition.kind)).toEqual(["sum"]);
    expect(SPECIAL_CODE_1.rules.conditions).toBeUndefined();
  });

  it("일일 11일째: 첫 기록이 숫자 셋을 정하고, 제자리가 아닌 자리에 놓는 방법은 둘뿐이다", () => {
    const p = DAILY_CODE_3;
    expect(p.rules.clues).toHaveLength(2);
    expect(p.rules.clues[0]).toEqual({ guess: [2, 7, 4], match: 3, inPlace: 0 });
    const afterFirst = solveWith(p, { clues: [0] });
    expect(afterFirst).toEqual(["427", "742"]);
    // 힌트 두 단계를 다 본 상태가 바로 이 둘이다
    expect(guidance.get(p.id)!.candidatesAfterHints).toBe(2);
    // 둘째 기록의 7 은 첫째 자리에 적혀 위치가 틀렸다: 7·4·2 를 지운다
    expect(p.rules.clues[1].guess.indexOf(7)).toBe(0);
    expect(scoreCodeGuess([7, 4, 2], p.rules.clues[1].guess)).toEqual({ match: 1, inPlace: 1 });
    expect(scoreCodeGuess([4, 2, 7], p.rules.clues[1].guess)).toEqual({ match: 1, inPlace: 0 });
    // 둘째 기록만으로는 숫자를 알 수 없다
    expect(solveWith(p, { clues: [1] }).length).toBeGreaterThan(50);
  });

  it("연습 D: 크기 순서가 자리를 정한다. 7 이 첫째라면 세 숫자가 다 맞아 버린다", () => {
    const p = PRACTICE_CODE_D;
    const all = enumerateCodes(p.rules);
    const ascending = all.filter((code) => code[0] < code[1] && code[1] < code[2]);
    // 새겨진 두 줄 = 뒤로 갈수록 커진다
    expect(solveWith(p, { clues: [] }).sort()).toEqual(ascending.map(text).sort());
    // 789 는 맞은 숫자가 모두 적힌 자리 그대로다(맞은 수 = 위치까지 맞은 수): 7 이 있다면 첫째 자리다
    expect(p.rules.clues[1]).toEqual({ guess: [7, 8, 9], match: 2, inPlace: 2 });
    // 7 이 첫째 자리인 오름차순 암호는 789 뿐이고, 그것은 789 와 셋이 다 맞는다
    const sevenFirst = ascending.filter((code) => code[0] === 7);
    expect(sevenFirst.map(text)).toEqual(["789"]);
    expect(scoreCodeGuess(sevenFirst[0], [7, 8, 9])).toEqual({ match: 3, inPlace: 3 });
    // 789 와 두 줄만으로: 7 은 없고 8 은 둘째, 9 는 셋째 자리다. 첫째 자리만 남는다.
    const afterBig = solveWith(p, { clues: [1] });
    expect(afterBig).toEqual(["189", "289", "389", "489", "589", "689"]);
    // 234 의 '위치도 정확'은 첫째 자리의 2 일 수밖에 없다
    expect(solveWith(p, { clues: [0, 1] })).toEqual(["289"]);
    // 새겨진 글이 없으면 답이 셋이다(자리가 크기 순위라는 뜻이 사라진다)
    expect(solveWith(p, { conditions: [] })).toEqual(["289", "739", "784"]);
    // 두 기록은 숫자가 겹치지 않고, '일치 없음'이 없다
    expect(new Set(p.rules.clues.flatMap((clue) => clue.guess)).size).toBe(6);
    expect(p.rules.clues.every((clue) => clue.match > 0)).toBe(true);
  });

  it("특수 도전: 겹침으로 숫자를, 지우기로 자리를 정한다", () => {
    const p = SPECIAL_CODE_1;
    const [c1, c2, c3, c4] = p.rules.clues;
    const all = enumerateCodes(p.rules);
    const has = (code: readonly number[], digit: number) => code.includes(digit);
    const matchOnly = (code: readonly number[], picked: typeof p.rules.clues) => picked.every((clue) => scoreCodeGuess(code, clue.guess).match === clue.match);
    // 네 기록 모두 숫자는 맞고 위치는 하나도 맞지 않았다. 아홉 숫자가 모두 한 번은 적혔다.
    expect(p.rules.clues.map((clue) => clue.inPlace)).toEqual([0, 0, 0, 0]);
    expect(p.rules.clues.map((clue) => clue.match)).toEqual([3, 3, 2, 2]);
    expect(new Set(p.rules.clues.flatMap((clue) => clue.guess)).size).toBe(9);
    // ① 두 기록이 함께 가진 숫자는 9 와 2 뿐이고, 둘 다 암호에 있어야 한다
    expect(c1.guess.filter((digit) => c2.guess.includes(digit)).sort()).toEqual([2, 9]);
    const afterTwo = all.filter((code) => matchOnly(code, [c1, c2]));
    expect(afterTwo.every((code) => has(code, 9) && has(code, 2))).toBe(true);
    expect(afterTwo.every((code) => [3, 5].filter((d) => has(code, d)).length === 1 && [4, 7].filter((d) => has(code, d)).length === 1)).toBe(true);
    expect(afterTwo.every((code) => !has(code, 1) && !has(code, 6) && !has(code, 8))).toBe(true);
    // ② 1283 이 3 을 정한다. 맞은 수만으로는 묶음이 둘(2·3·4·9, 2·3·7·9) 남는다.
    const afterThree = all.filter((code) => matchOnly(code, [c1, c2, c3]));
    expect(afterThree.every((code) => has(code, 3) && !has(code, 5))).toBe(true);
    const sets = (list: number[][]) => [...new Set(list.map((code) => [...code].sort().join("")))].sort();
    expect(sets(all.filter((code) => matchOnly(code, [c1, c2, c3, c4])))).toEqual(["2349", "2379"]);
    // ③ 숫자마다 적혔던 자리: 9 는 첫째·셋째·넷째, 2 는 넷째·첫째·둘째, 3 은 둘째·넷째
    const written = (digit: number) => [...new Set(p.rules.clues.map((clue) => clue.guess.indexOf(digit)).filter((at) => at >= 0))].sort();
    expect(written(9)).toEqual([0, 2, 3]);
    expect(written(2)).toEqual([0, 1, 3]);
    expect(written(3)).toEqual([1, 3]);
    // ④ 7 은 넷째 자리에 적혀 틀렸다. 2·3·7·9 로는 어떻게 놓아도 기록과 맞지 않는다.
    expect(c2.guess.indexOf(7)).toBe(3);
    expect(solveCode(p.rules).map(text)).toEqual(["3924"]);
    expect(all.filter((code) => [...code].sort().join("") === "2379").filter((code) => p.rules.clues.every((clue) => scoreCodeGuess(code, clue.guess).inPlace === 0))).toEqual([]);
    // 위치를 보지 않으면(맞은 수만 보면) 풀리지 않는다: 자리가 숫자까지 정한다
    expect(all.filter((code) => matchOnly(code, p.rules.clues)).length).toBe(48);
    // 힌트 두 단계를 다 보아도 후보가 넉넉히 남는다
    expect(guidance.get(p.id)!.candidatesAfterHints).toBeGreaterThan(20);
    expect(digitsOf(text(p.solution))).toEqual([3, 9, 2, 4]);
  });
});

/* ═════════ 진술 추리 ═════════ */

const ids = (rules: TruthRules) => rules.people.map((p) => p.id);
const table = (rules: TruthRules) => ids(rules).map((id) => truthValues(rules, id));
const counts = (rules: TruthRules) => ids(rules).map((id) => countTrue(rules, id));
const column = (rules: TruthRules, speaker: string) => {
  const at = rules.statements.findIndex((s) => s.speaker === speaker);
  return table(rules).map((row) => row[at]);
};

/** 진술 종류의 조합. 자기 부인과 자백("내가 숨겼다")은 남에 대한 말과 따로 센다. */
function truthKinds(rules: TruthRules): string {
  return rules.statements
    .map((s) => {
      if (s.claim.kind === "culpritIsNot" && s.claim.who === s.speaker) return "denySelf";
      if (s.claim.kind === "culpritIs" && s.claim.who === s.speaker) return "confess";
      return s.claim.kind;
    })
    .sort()
    .join("+");
}

/** 진술 하나를 가리고(참인지 거짓인지 모른다고 하고) 참의 수가 맞을 수 있는 가정을 모두 돌려준다 */
function possibleWithout(rules: TruthRules, hidden: number): string[] {
  return ids(rules).filter((culprit) =>
    [true, false].some((forced) => {
      const memo = new Map<string, boolean | null>();
      const saidBy = (speaker: string): boolean | null => {
        if (memo.has(speaker)) return memo.get(speaker)!;
        const at = rules.statements.findIndex((s) => s.speaker === speaker);
        if (at < 0) return null;
        memo.set(speaker, null);
        const value = at === hidden ? forced : evalTruthClaim(rules.statements[at].claim, culprit, saidBy);
        memo.set(speaker, value);
        return value;
      };
      return rules.statements.filter((s) => saidBy(s.speaker) === true).length === rules.trueCount;
    }),
  );
}

/** 그 진술이 참이 되는 가정(숨긴 사람)의 집합 */
const truthSet = (rules: TruthRules, speaker: string) => ids(rules).filter((_, i) => column(rules, speaker)[i]);

describe("진술 추리 두 문제", () => {
  const eachTruth = truths.map((p) => [p.id, p] as const);
  const oldTruths: TruthPuzzle[] = [PRACTICE_TRUTH, DAILY_TRUTH_1, ...TRUTH_SET];

  it.each(eachTruth)("%s: 네 가정의 참·거짓 무늬가 모두 다르고, 늘 같은 값인 진술이 없다", (_id, puzzle) => {
    const rows = table(puzzle.rules).map((row) => row.map((v) => (v ? "T" : "F")).join(""));
    expect(new Set(rows).size).toBe(4);
    puzzle.rules.statements.forEach((s) => expect(new Set(column(puzzle.rules, s.speaker)).size).toBe(2));
    // 오답인 세 가정이 모두 같은 수로 떨어지지는 않는다
    const wrong = counts(puzzle.rules).filter((_, i) => ids(puzzle.rules)[i] !== puzzle.solution);
    expect(new Set(wrong).size).toBeGreaterThanOrEqual(2);
  });

  it.each(eachTruth)("%s: 군더더기 진술이 없다(어느 진술을 가려도 답이 하나로 정해지지 않는다)", (_id, puzzle) => {
    puzzle.rules.statements.forEach((_, hidden) => {
      const possible = possibleWithout(puzzle.rules, hidden);
      expect(possible).toContain(puzzle.solution);
      expect(possible.length, `진술 ${hidden + 1}`).toBeGreaterThanOrEqual(2);
    });
    expect(solveTruth(puzzle.rules)).toEqual([puzzle.solution]);
  });

  it.each(eachTruth)("%s: 글과 화면의 한계", (_id, puzzle) => {
    const { people, statements } = puzzle.rules;
    expect(people).toHaveLength(4);
    expect(statements.map((s) => s.speaker)).toEqual(people.map((p) => p.id));
    for (const person of people) expect(Object.values(cast)).toContainEqual(person);
    statements.forEach((s) => {
      expect([...s.text].length).toBeLessThanOrEqual(16);
      expect(s.text.endsWith("다.")).toBe(true);
    });
    // '하나'라는 이름은 "참은 하나뿐"과 헷갈리고, 세라와 세아는 이름이 닮아 한 문제에 함께 두지 않는다
    const names = people.map((p) => p.id);
    expect(names).not.toContain("hana");
    expect(names.includes("sera") && names.includes("sea")).toBe(false);
    // 문제 글이 참의 수와 숨긴 물건을 분명히 적는다
    expect(puzzle.rules.trueCount).toBe(2);
    expect(puzzle.description).toContain("정확히 둘만 참");
    expect(puzzle.description).toContain(puzzle.rules.item!);
    // 닫는 글은 숨긴 사람의 이름을 밝히고(해결한 뒤에만 보인다), 여는 글은 밝히지 않는다
    const culprit = people.find((p) => p.id === puzzle.solution)!;
    expect(puzzle.outro).toContain(culprit.name);
    expect(puzzle.intro).not.toContain(culprit.name);
    // 진술의 글이 가리키는 사람이 주장의 내용과 같다
    for (const s of statements) {
      const named = s.claim.kind === "culpritAmong" ? s.claim.who : [s.claim.who];
      const inText = people.filter((p) => s.text.includes(p.name)).map((p) => p.id);
      const self = s.text.startsWith("내가") || s.text.startsWith("나는");
      expect([...inText, ...(self ? [s.speaker] : [])].sort(), s.text).toEqual([...named].sort());
      expect(s.text.includes("않았다"), s.text).toBe(s.claim.kind === "culpritIsNot");
    }
  });

  it("숨긴 물건·숨긴 사람·진술 종류의 조합이 기존 일곱 문제와 겹치지 않는다", () => {
    const all = [...oldTruths, ...truths];
    const items = all.map((p) => p.rules.item ?? "답안지");
    expect(new Set(items).size).toBe(items.length);
    const keys = all.map((p) => `${p.rules.trueCount}|${truthKinds(p.rules)}`);
    expect(new Set(keys).size).toBe(all.length);
    expect(truths.map((p) => truthKinds(p.rules))).toEqual([
      "culpritAmong+culpritAmong+culpritIs+culpritIs",
      "confess+culpritAmong+culpritAmong+culpritIsNot",
    ]);
    // 기존 문제에는 자백도, 네 사람이 모두 남을 가리키는 문제도 없다
    const accusesOnly = (rules: TruthRules) => rules.statements.every((s) => s.claim.kind === "culpritIs" || s.claim.kind === "culpritAmong");
    expect(oldTruths.some((p) => truthKinds(p.rules).includes("confess"))).toBe(false);
    expect(oldTruths.some((p) => accusesOnly(p.rules))).toBe(false);
  });

  it("일일 10일째: 네 사람이 모두 남을 가리킨다. 참의 수는 숨긴 사람이 가리켜진 횟수와 같다", () => {
    const { rules } = DAILY_TRUTH_2;
    expect(ids(rules)).toEqual(["junho", "doyun", "sera", "minjae"]);
    // 모든 진술이 남을 가리키는 말이다(부인도, 자백도, 남의 말에 대한 말도 없다)
    const named = (claim: TruthClaim) => (claim.kind === "culpritAmong" ? claim.who : claim.kind === "culpritIs" ? [claim.who] : null);
    for (const s of rules.statements) {
      expect(named(s.claim)).not.toBeNull();
      expect(named(s.claim)).not.toContain(s.speaker);
    }
    // 가리켜진 횟수: 준호 1 · 도윤 3 · 세라 2 · 민재 0. 가정마다 참의 수가 바로 그 횟수다.
    const mentions = ids(rules).map((id) => rules.statements.filter((s) => named(s.claim)!.includes(id)).length);
    expect(mentions).toEqual([1, 3, 2, 0]);
    expect(counts(rules)).toEqual(mentions);
    // 횟수가 네 사람 모두 달라, 정확히 두 번 가리켜진 사람은 하나뿐이다
    expect(new Set(mentions).size).toBe(4);
    // 가장 많이 가리켜진 사람은 숨긴 사람이 아니고, 숨긴 사람 자신의 말은 거짓이다
    expect(ids(rules)[mentions.indexOf(Math.max(...mentions))]).toBe("doyun");
    expect(truthValues(rules, "sera")).toEqual([false, true, false, true]);
    // 해설의 글: 준호는 세라에게, 도윤은 준호·세라·민재에게, 세라는 도윤·민재에게 가리켜졌다
    const by = (who: string) => rules.statements.filter((s) => named(s.claim)!.includes(who)).map((s) => s.speaker);
    expect(by("junho")).toEqual(["sera"]);
    expect(by("doyun")).toEqual(["junho", "sera", "minjae"]);
    expect(by("sera")).toEqual(["doyun", "minjae"]);
    expect(by("minjae")).toEqual([]);
  });

  it("연습 C: 자백이 참이면 넷이 다 참이다. 세아의 말이 거짓이라는 가정은 준호와 하린의 말을 부딪치게 한다", () => {
    const { rules } = PRACTICE_TRUTH_C;
    expect(ids(rules)).toEqual(["junho", "minjae", "harin", "sea"]);
    expect(counts(rules)).toEqual([1, 4, 2, 1]);
    // 포개진 말: 자백 ⊂ 세아의 말 ⊂ 하린의 말 (좁은 말이 참이면 넓은 말도 참)
    expect(truthSet(rules, "minjae")).toEqual(["minjae"]);
    expect(truthSet(rules, "sea")).toEqual(["minjae", "harin"]);
    expect(truthSet(rules, "harin")).toEqual(["junho", "minjae", "harin"]);
    // 준호의 말도 자백을 품는다: 자백이 참이면 네 진술이 모두 참
    expect(truthSet(rules, "junho")).toContain("minjae");
    expect(truthValues(rules, "minjae")).toEqual([true, true, true, true]);
    // 세아의 말이 거짓인 가정(준호, 세아가 숨긴 경우)에서는 준호의 말과 하린의 말이 함께 참일 수 없다
    const seaFalse = ids(rules).filter((_, i) => !column(rules, "sea")[i]);
    expect(seaFalse).toEqual(["junho", "sea"]);
    for (const culprit of seaFalse) {
      const row = truthValues(rules, culprit);
      expect(row[0] && row[2], culprit).toBe(false);
    }
    // 세아의 말이 참이고 민재가 아닌 가정은 하린뿐이다
    expect(truthSet(rules, "sea").filter((id) => id !== "minjae")).toEqual(["harin"]);
    // 숨긴 사람은 참말을 했고, 자백한 사람은 숨기지 않았다
    expect(truthValues(rules, "harin")).toEqual([false, false, true, true]);
    expect(PRACTICE_TRUTH_C.description).toContain("자백도 진술로 셉니다");
  });
});

/* ═════════ 순서 추론 ═════════ */

/** 조건의 일부(순번은 1부터)만 지키는 모든 순서 */
function ordersWith(puzzle: SchedulePuzzle, numbers: number[]): string[][] {
  const picked = numbers.map((n) => puzzle.rules.constraints[n - 1]);
  return permutations(puzzle.rules.people.map((p) => p.id)).filter((order) => picked.every((c) => constraintHolds(c, order)));
}

const at = (order: string[], who: string) => order.indexOf(who);
const scheduleSignature = (puzzle: SchedulePuzzle) => `${puzzle.rules.people.length}명 ${puzzle.rules.constraints.map((c) => c.kind).sort().join("+")}`;

describe("순서 추론 세 문제", () => {
  const eachSchedule = schedules.map((p) => [p.id, p] as const);
  const oldSchedules: SchedulePuzzle[] = [EXAM_SCHEDULE, DAILY_SCHEDULE_1, ...SCHEDULE_SET];

  it.each(eachSchedule)("%s: 어느 조건도 군더더기가 아니다(하나를 빼면 답이 여럿이 된다)", (_id, puzzle) => {
    puzzle.rules.constraints.forEach((_, skip) => {
      const rules = { ...puzzle.rules, constraints: puzzle.rules.constraints.filter((__, i) => i !== skip) };
      expect(solveSchedule(rules).length, `조건 ${skip + 1}`).toBeGreaterThan(1);
    });
  });

  it.each(eachSchedule)("%s: 해설의 마지막 단계는 모든 사람의 자리를 말하고, 힌트에 정답의 순서가 통째로 적혀 있지 않다", (_id, puzzle) => {
    const last = puzzle.explanation[puzzle.explanation.length - 1];
    expect(last.facts.filter((fact) => fact.kind === "slotIs")).toHaveLength(puzzle.rules.people.length);
    const names = puzzle.solution.map((id) => puzzle.rules.people.find((p) => p.id === id)!.name);
    puzzle.hints.forEach((hint) => {
      expect(hint.text).not.toContain(names.join(", "));
      expect(hint.text).not.toContain(names.join("·"));
    });
    // 해설의 마지막 글은 정답의 순서를 그대로 적는다
    expect(last.text).toContain(names.join(", "));
  });

  it.each(eachSchedule)("%s: 사람·자리·조건의 수와 글의 길이가 화면에 들어간다", (_id, puzzle) => {
    const { people, slots, constraints } = puzzle.rules;
    expect([4, 5]).toContain(people.length);
    expect(slots).toHaveLength(people.length);
    for (const person of people) expect(Object.values(cast)).toContainEqual(person);
    expect(constraints.length).toBeLessThanOrEqual(5);
    constraints.forEach((c) => {
      // 낮은 화면(375px 폭)에서 조건 하나가 한 줄에 들어가는 폭: 한글 16px, 숫자·빈칸·마침표 8px
      const width = [...c.text].reduce((sum, ch) => sum + (ch.charCodeAt(0) < 128 ? 8 : 16), 0);
      expect(width, c.text).toBeLessThanOrEqual(288);
      expect(c.text.endsWith("다.")).toBe(true);
    });
    expect(slots.map((slot) => slot.label)).toEqual(["1번", "2번", "3번", "4번", "5번"].slice(0, slots.length));
    expect(slots.map((slot) => slot.ordinal)).toEqual(["첫 번째", "두 번째", "세 번째", "네 번째", "다섯 번째"].slice(0, slots.length));
    // 문제의 글은 사람의 수와 조건의 수를 바르게 말한다
    const count = ["", "한", "두", "세", "네", "다섯"];
    expect(puzzle.description).toContain(`${count[people.length]} 명`);
    expect(puzzle.description).toContain(`${count[constraints.length]} 조건`);
    expect(puzzle.description).toContain(puzzle.rules.title!);
    // 쟁반에 늘어놓은 이름표의 순서가 정답을 알려 주지 않는다. '하나'라는 이름은 쓰지 않았다.
    expect(people.map((p) => p.id)).not.toEqual(puzzle.solution);
    expect(people.map((p) => p.id)).not.toContain("hana");
    // '사이' 조건이 있으면 바로 옆이 아니어도 된다고 알려 준다
    if (constraints.some((c) => c.kind === "between")) expect(puzzle.description).toContain("'사이'는 바로 옆이 아니어도 됩니다");
  });

  it.each(eachSchedule)("%s: 조건의 글이 가리키는 사람과 말이 조건의 내용과 같다", (_id, puzzle) => {
    const name = (id: string) => puzzle.rules.people.find((p) => p.id === id)!.name;
    for (const c of puzzle.rules.constraints) {
      const named =
        c.kind === "before" || c.kind === "notAdjacent" || c.kind === "gap"
          ? [c.a, c.b]
          : c.kind === "immediatelyAfter"
            ? [c.who, c.after]
            : c.kind === "between"
              ? [c.who, c.a, c.b]
              : [c.who];
      const inText = puzzle.rules.people.filter((p) => c.text.includes(p.name)).map((p) => p.id);
      expect(inText.sort(), c.text).toEqual([...named].sort());
      const subject = c.kind === "before" || c.kind === "notAdjacent" || c.kind === "gap" ? c.a : c.who;
      expect(c.text.startsWith(name(subject)), c.text).toBe(true);
      if (c.kind === "before") expect(c.text).toContain("먼저");
      if (c.kind === "notAdjacent") expect(c.text).toContain("연달아");
      if (c.kind === "between") expect(c.text).toContain("사이");
      if (c.kind === "immediatelyAfter") expect(c.text).toContain("바로 다음");
      if (c.kind === "notAtSlot") expect(c.text).toContain(`${["첫", "두", "세", "네", "다섯"][c.slot]} 번째 순서가 아니다`);
      if (c.kind === "slotAmong" && c.slots.length === 1) expect(c.text).toContain(`${["첫", "두", "세", "네", "다섯"][c.slots[0]]} 번째 순서다`);
    }
  });

  it("조건 종류의 조합과 순서의 이름이 서로, 그리고 기존의 여덟 문제와 다르다", () => {
    const old = oldSchedules.map(scheduleSignature);
    const fresh = schedules.map(scheduleSignature);
    expect(fresh).toEqual([
      "4명 before+between+notAdjacent",
      "5명 before+immediatelyAfter+immediatelyAfter+notAdjacent+notAtSlot",
      "4명 immediatelyAfter+notAtSlot+slotAmong",
    ]);
    expect(new Set([...old, ...fresh]).size).toBe(old.length + fresh.length);
    const titles = [...oldSchedules, ...schedules].map((p) => p.rules.title ?? "발표 순서");
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("연습 F: 조건을 적힌 차례대로 놓기만 하면 풀린다(경우를 나누지 않는다)", () => {
    const p = PRACTICE_SCHEDULE_F;
    // 조건 1 → 하린의 자리, 조건 1·2 → 준호의 자리까지, 조건 3 이 남은 둘을 가른다
    expect(ordersWith(p, [1]).every((order) => at(order, "harin") === 0)).toBe(true);
    const two = ordersWith(p, [1, 2]);
    expect(two.every((order) => at(order, "harin") === 0 && at(order, "junho") === 1)).toBe(true);
    expect(two).toEqual([
      ["sera", "daon"],
      ["daon", "sera"],
    ].map((rest) => ["harin", "junho", ...rest]));
    expect(ordersWith(p, [1, 2, 3])).toEqual([p.solution]);
    // 조건마다 자리가 정해지는 사람이 하나씩 는다: 정해진 자리의 수 1 → 2 → 4
    const fixed = (orders: string[][]) => p.rules.people.filter((person) => new Set(orders.map((order) => at(order, person.id))).size === 1).length;
    expect([fixed(ordersWith(p, [1])), fixed(two), fixed(ordersWith(p, [1, 2, 3]))]).toEqual([1, 2, 4]);
    // F→D 시험에 나오는 조건 종류 가운데 둘(바로 다음, 금지 자리)을 미리 읽는다
    const examKinds = new Set(EXAM_SCHEDULE.rules.constraints.map((c) => c.kind));
    expect(p.rules.constraints.filter((c) => examKinds.has(c.kind)).map((c) => c.kind)).toEqual(["immediatelyAfter", "notAtSlot"]);
  });

  it("일일 9일째: 조건 1·2로 한 줄이 조립되고(하린·다온·세라·민재 또는 그 반대), 조건 3이 방향을 정한다", () => {
    const p = DAILY_SCHEDULE_2;
    const two = ordersWith(p, [1, 2]);
    expect(two).toHaveLength(2);
    expect(two).toContainEqual(["harin", "daon", "sera", "minjae"]);
    expect(two).toContainEqual(["minjae", "sera", "daon", "harin"]);
    for (const order of two) {
      expect([at(order, "daon"), at(order, "sera")].sort()).toEqual([1, 2]);
      expect([at(order, "harin"), at(order, "minjae")].sort()).toEqual([0, 3]);
      // 세라와 하린 사이에 끼어 있는 사람은 다온이다
      expect(Math.abs(at(order, "daon") - at(order, "sera"))).toBe(1);
      expect(Math.abs(at(order, "daon") - at(order, "harin"))).toBe(1);
    }
    // 조건 1만으로는 세라가 하린의 바로 옆일 수도 있다
    expect(ordersWith(p, [1]).some((order) => Math.abs(at(order, "sera") - at(order, "harin")) === 1)).toBe(true);
    // 민재가 1번인 쪽은 조건 3을 지킬 수 없다
    expect(constraintHolds(p.rules.constraints[2], ["minjae", "sera", "daon", "harin"])).toBe(false);
    expect(ordersWith(p, [1, 2, 3])).toEqual([p.solution]);
  });

  it("일일 14일째: 세 덩어리를 줄 세우는 여섯 가지에서, 맨 앞 덩어리를 정하고 남은 둘을 가른다", () => {
    const p = DAILY_SCHEDULE_3;
    const blocks = ordersWith(p, [1, 2]);
    // 두 묶음과 다온: 3! = 6가지
    expect(blocks).toHaveLength(6);
    const head = (order: string[]) => order[0];
    expect([...new Set(blocks.map(head))].sort()).toEqual(["daon", "doyun", "sea"]);
    // 도윤·민재 묶음이 맨 앞이면 민재가 2번이다: 조건 3에 어긋난다
    const doyunFirst = blocks.filter((order) => head(order) === "doyun");
    expect(doyunFirst).toHaveLength(2);
    expect(doyunFirst.every((order) => at(order, "minjae") === 1)).toBe(true);
    // 민재가 2번이 되는 것은 그 묶음이 맨 앞일 때뿐이다("민재는 두 번째가 아니다" = 묶음은 맨 앞이 아니다)
    expect(blocks.filter((order) => at(order, "minjae") === 1)).toEqual(doyunFirst);
    // 다온이 맨 앞이면 세아가 다온보다 먼저일 수 없다: 조건 4에 어긋난다
    const daonFirst = blocks.filter((order) => head(order) === "daon");
    expect(daonFirst).toHaveLength(2);
    expect(daonFirst.some((order) => constraintHolds(p.rules.constraints[3], order))).toBe(false);
    // 조건 3·4까지: 세아·하린이 맨 앞인 둘이 남는다
    const seaFirst = ordersWith(p, [1, 2, 3, 4]);
    expect(seaFirst).toHaveLength(2);
    expect(seaFirst.every((order) => at(order, "sea") === 0 && at(order, "harin") === 1)).toBe(true);
    // 묶음이 바로 이어지면 하린 다음이 도윤이라 조건 5에 어긋난다
    const direct = seaFirst.find((order) => at(order, "doyun") === 2)!;
    expect(constraintHolds(p.rules.constraints[4], direct)).toBe(false);
    expect(ordersWith(p, [1, 2, 3, 4, 5])).toEqual([p.solution]);
    // 조건 3·4·5 가운데 어느 둘을 골라도 둘 이상 남는다(한두 조건이 혼자 정하지 못한다)
    for (const pair of [[3, 4], [3, 5], [4, 5]]) expect(ordersWith(p, [1, 2, ...pair]).length, pair.join("·")).toBeGreaterThanOrEqual(2);
    // 다섯 명 문제 가운데 '바로 다음'이 둘인 것은 이 문제뿐이다
    const five = [...oldSchedules, ...schedules].filter((s) => s.rules.people.length === 5);
    expect(five.filter((s) => s.rules.constraints.filter((c) => c.kind === "immediatelyAfter").length === 2)).toEqual([p]);
  });
});

/* ═════════ 증거 조합 ═════════ */

const claimOf = (puzzle: EvidencePuzzle, id: string): EvidenceClaim => {
  const card = allCards(puzzle.rules).find((c) => c.id === id);
  if (!card) throw new Error(`${puzzle.id}: 카드 ${id} 가 없다`);
  return card.claim;
};
const liar = (puzzle: EvidencePuzzle) => claimOf(puzzle, puzzle.solution.statement);
const baseFacts = (puzzle: EvidencePuzzle) => puzzle.rules.cards.filter((c) => c.kind !== "statement");
const statementsOf = (puzzle: EvidencePuzzle) => puzzle.rules.cards.filter((c) => c.kind === "statement");
const position = (who: string, place: string, time: number) => ({ who, place, time });
const atClaim = (who: string, place: string, time: number): EvidenceClaim => ({ kind: "at", who, place, time });

/** 정답에 이르는 길의 꼴: 잇는 두 증거의 주장 종류 → 얻는 사실의 종류, 그리고 거짓 진술의 종류 */
function evidenceSignature(puzzle: EvidencePuzzle): string {
  const kind = (id: string) => claimOf(puzzle, id).kind;
  const links = derivationPath(puzzle.rules, puzzle.solution.against).map((step) => `${step.from.map(kind).sort().join("+")}→${step.card.claim.kind}`);
  return `${links.join(" / ")} ⊥ ${kind(puzzle.solution.statement)}`;
}

/** 처음의 증거 하나를 뺀 규칙. 남은 증거에서 출발해 더는 닿을 수 없는 사실도 함께 뺀다. */
function without(rules: EvidenceRules, removed: string): EvidenceRules {
  const cards = rules.cards.filter((card) => card.id !== removed);
  const have = new Set(cards.map((card) => card.id));
  for (;;) {
    const next = rules.derivations.find((d) => !have.has(d.card.id) && d.from.every((id) => have.has(id)));
    if (!next) break;
    have.add(next.card.id);
  }
  return { ...rules, cards, derivations: rules.derivations.filter((d) => have.has(d.card.id) && d.from.every((id) => have.has(id))) };
}

describe("증거 조합 네 문제", () => {
  const eachEvidence = evidences.map((p) => [p.id, p] as const);
  const oldEvidences: EvidencePuzzle[] = [DAILY_EVIDENCE_1, DAILY_EVIDENCE_2, ...EVIDENCE_SET];
  const DEPTH: Record<string, number> = { "daily-evidence-003": 1, "practice-evidence-f": 1, "practice-evidence-c": 2, "exam-evidence-d-c": 2 };

  it.each(eachEvidence)("%s: 기록끼리 모순이 없고, 거짓 진술은 하나뿐이며, 기록 하나만으로는 깨지지 않는다(이어야 풀린다)", (id, puzzle) => {
    const audit = audits.get(id)!;
    expect(audit.issues).toEqual([]);
    expect(audit.needsDerivation).toBe(true);
    expect(audit.falseStatements).toEqual([puzzle.solution.statement]);
    expect(audit.depth).toBe(DEPTH[id]);
    for (const card of baseFacts(puzzle)) expect(contradicts(puzzle.rules, liar(puzzle), card.claim), card.id).toBe(false);
    // 오답: 참인 진술은 어떤 증거와 짝지어도 모순이 아니다
    for (const card of statementsOf(puzzle)) {
      if (card.id === puzzle.solution.statement) continue;
      for (const fact of allCards(puzzle.rules).filter((c) => c.kind !== "statement")) {
        expect(contradicts(puzzle.rules, card.claim, fact.claim), `${card.id} × ${fact.id}`).toBe(false);
      }
    }
  });

  it.each(eachEvidence)("%s: 표에 없는 짝이 거짓 진술을 깨는 일이 없다(화면에 없는 지름길이 없다)", (_id, puzzle) => {
    const facts = allCards(puzzle.rules).filter((card) => card.kind !== "statement" && card.id !== puzzle.solution.against);
    for (let i = 0; i < facts.length; i++) {
      for (let j = i + 1; j < facts.length; j++) {
        if (deriveFrom(puzzle.rules, facts[i].id, facts[j].id)) continue;
        expect(satisfiable(puzzle.rules, [facts[i].claim, facts[j].claim, liar(puzzle)]), `${facts[i].id} + ${facts[j].id}`).toBe(true);
      }
    }
  }, 60_000);

  it.each(eachEvidence)("%s: 정답에 이르는 길의 증거는 어느 것도 군더더기가 아니다(하나를 빼면 풀리지 않는다)", (_id, puzzle) => {
    const path = derivationPath(puzzle.rules, puzzle.solution.against);
    const base = new Set(puzzle.rules.cards.map((card) => card.id));
    const needed = [...new Set(path.flatMap((step) => step.from))].filter((cardId) => base.has(cardId));
    expect(needed.length).toBe(path.length + 1);
    for (const cardId of needed) expect(solveEvidence(without(puzzle.rules, cardId)), `${cardId} 를 뺐을 때`).toEqual([]);
    // 이어서 얻는 사실은 모두 정답에 이르는 길 위에 있다(쓸모없는 사실을 얻게 하지 않는다)
    expect(allCards(puzzle.rules).filter((card) => card.kind === "derived").map((card) => card.id)).toEqual(path.map((step) => step.card.id));
  }, 60_000);

  it.each(eachEvidence)("%s: 화면의 조작으로 정답에 닿고, 해설의 마지막 단계는 정답의 짝이 모순임을 말한다", (_id, puzzle) => {
    const have = new Set(puzzle.rules.cards.map((card) => card.id));
    for (let round = 0; round < 4; round++) {
      for (const a of [...have]) for (const b of [...have]) {
        const card = a < b ? deriveFrom(puzzle.rules, a, b) : null;
        if (card) have.add(card.id);
      }
    }
    expect(have.has(puzzle.solution.against)).toBe(true);
    const { statement, against } = puzzle.solution;
    expect(evidencePair(puzzle, [against, statement])).toEqual(puzzle.solution);
    expect(checkAnswer(puzzle, { statement: against, against: statement })).toBe(false);
    expect(puzzle.explanation[puzzle.explanation.length - 1].facts).toEqual([{ kind: "contradicts", a: statement, b: against }]);
    // 힌트는 모순인 짝을 가리키지 않는다
    for (const hint of puzzle.hints) expect(hint.facts.some((fact) => fact.kind === "contradicts")).toBe(false);
    // 해설은 잇는 길을 순서대로 모두 말한다
    const told = puzzle.explanation.flatMap((step) => step.facts).flatMap((fact) => (fact.kind === "derives" ? [fact.card] : []));
    expect(told).toEqual(derivationPath(puzzle.rules, against).map((step) => step.card.id));
  });

  it.each(eachEvidence)("%s: 화면의 한계를 넘지 않는다", (_id, puzzle) => {
    const { rules } = puzzle;
    const derived = allCards(rules).filter((card) => card.kind === "derived");
    expect(statementsOf(puzzle).length).toBeLessThanOrEqual(4);
    expect(baseFacts(puzzle).length).toBeLessThanOrEqual(5);
    expect(derived.length).toBeLessThanOrEqual(3);
    expect(rules.places).toHaveLength(3);
    expect(rules.times.length).toBeLessThanOrEqual(3);
    for (const card of allCards(rules)) {
      expect(card.label.length, `${card.id} 의 이름`).toBeLessThanOrEqual(6);
      expect(card.text.length, `${card.id} 의 글`).toBeLessThanOrEqual(40);
    }
    // 맞대어 보는 자리에 적히는 할 일: 기존 문제보다 길어지지 않게
    expect(puzzle.description.length).toBeLessThanOrEqual(100);
    for (const person of rules.people) expect(Object.values(cast)).toContainEqual(person);
    for (const card of statementsOf(puzzle)) {
      const speaker = rules.people.find((p) => p.id === card.speaker)!;
      expect(card.label).toBe(`${speaker.name}의 진술`);
      expect(card.id).toBe(`say-${speaker.id}`);
    }
    // 카드의 글에 적힌 시각은 주장의 시각과 같다
    const timeOf = (claim: EvidenceClaim): number[] =>
      claim.kind === "all" ? claim.of.flatMap(timeOf) : claim.kind === "stayed" ? [claim.from, claim.to] : claim.kind === "visited" ? [claim.until] : [claim.time];
    for (const card of rules.cards) {
      const inText = rules.times.map((label, i) => (card.text.includes(label) ? i : -1)).filter((i) => i >= 0);
      expect(inText.sort(), card.text).toEqual([...new Set(timeOf(card.claim))].sort());
    }
    // 카드의 글에 적힌 장소와 사람은 주장의 것과 같다
    const placeOf = (claim: EvidenceClaim): string[] => (claim.kind === "all" ? claim.of.flatMap(placeOf) : "place" in claim ? [claim.place] : []);
    const whoOf = (claim: EvidenceClaim): string[] =>
      claim.kind === "all" ? claim.of.flatMap(whoOf) : claim.kind === "together" ? [claim.a, claim.b] : "who" in claim ? [claim.who] : [];
    for (const card of rules.cards) {
      for (const place of new Set(placeOf(card.claim))) expect(card.text, card.id).toContain(rules.places.find((p) => p.id === place)!.name);
      for (const who of new Set(whoOf(card.claim))) {
        if (card.kind === "statement" && who === card.speaker) continue;
        expect(card.text, card.id).toContain(rules.people.find((p) => p.id === who)!.name);
      }
    }
  });

  it("푸는 길이 서로, 그리고 기존의 일곱 문제와 다르다: 처음 잇는 두 장의 조합부터 다르다", () => {
    const old = oldEvidences.map(evidenceSignature);
    const fresh = evidences.map(evidenceSignature);
    expect(fresh).toEqual([
      "visited+visited→all ⊥ at",
      "at+visited→at ⊥ at",
      "stayed+together→all / all+count→all ⊥ at",
      "at+count→alone / alone+visited→at ⊥ at",
    ]);
    expect(new Set([...old, ...fresh]).size).toBe(old.length + fresh.length);
    // 잇는 걸음 하나하나: "두 장의 종류→얻는 사실의 종류"
    const steps = (s: string) => s.split(" ⊥ ")[0].split(" / ");
    const oldSteps = new Set(old.flatMap(steps));
    // 일일 13일째 · 연습 F · 연습 C 의 첫걸음은 기존 문제의 어느 걸음에도 없던 조합이다
    for (const s of fresh.slice(0, 3)) expect(oldSteps.has(steps(s)[0]), s).toBe(false);
    // 시험 D→C 는 익힌 걸음을 새 차례로 쓴다: 첫걸음 "한 명뿐인 곳의 한 사람"은 일일 6일째와 연습 B 의 마지막 걸음이었고,
    // 그 걸음으로 문제를 여는 것은 처음이다. 마지막 걸음 "남이 혼자 있던 때를 지워 물건의 때를 정한다"는 새 것이다.
    const exam = steps(fresh[3]);
    expect(exam).toEqual(["at+count→alone", "alone+visited→at"]);
    expect(old.filter((s) => steps(s).includes(exam[0])).map((s) => steps(s).indexOf(exam[0]))).toEqual([1, 1]);
    expect(old.some((s) => steps(s)[0] === exam[0])).toBe(false);
    expect(oldSteps.has(exam[1])).toBe(false);
    // 일일 6일째는 "물건의 때 → 혼자"였고, 이 시험은 "혼자 → 물건의 때"다(차례가 뒤집혔다)
    expect(steps(evidenceSignature(DAILY_EVIDENCE_2))).toEqual(["all+visited→at", "at+count→alone"]);
    // 기록으로 주어진 구간(줄곧 있었다)과, 남의 자리를 말하는 진술은 기존 문제에 없다
    expect(oldEvidences.some((p) => baseFacts(p).some((card) => card.claim.kind === "stayed"))).toBe(false);
    const aboutOther = (p: EvidencePuzzle) => statementsOf(p).some((card) => card.claim.kind === "at" && card.claim.who !== card.speaker);
    expect(oldEvidences.some(aboutOther)).toBe(false);
    expect(evidences.filter(aboutOther)).toEqual([DAILY_EVIDENCE_3]);
  });

  describe("연습 F · 엎질러진 잉크병: 물건의 때를 기록 하나로 정한다", () => {
    const p = PRACTICE_EVIDENCE_F;

    it("시각이 둘뿐이라, 9:10에 다른 곳에 있었다면 물건을 둔 때는 9:00이다", () => {
      expect(p.rules.times).toEqual(["9:00", "9:10"]);
      expect(entailedPositions(p.rules, [claimOf(p, "ruler")])).toEqual([]);
      expect(entailedPositions(p.rules, [claimOf(p, "roll"), claimOf(p, "ruler")])).toEqual([position("doyun", "drafting", 0), position("doyun", "classroom", 1)]);
      expect(claimOf(p, "fact-doyun")).toEqual(atClaim("doyun", "drafting", 0));
      // 자만으로는 도윤의 말이 깨지지 않는다: 9:10에 제도실에 들렀을 수도 있다
      expect(satisfiable(p.rules, [claimOf(p, "ruler"), liar(p), atClaim("doyun", "drafting", 1)])).toBe(true);
      expect(satisfiable(p.rules, [claimOf(p, "roll"), claimOf(p, "ruler"), liar(p)])).toBe(false);
    });

    it("견주어 보라고 놓은 머리핀은 때를 정해 줄 기록이 없어 누구의 말도 깨지 못한다", () => {
      for (const card of statementsOf(p)) expect(contradicts(p.rules, card.claim, claimOf(p, "pin"))).toBe(false);
      for (const other of ["roll", "ruler", "meal", "fact-doyun"]) expect(deriveFrom(p.rules, "pin", other)).toBeNull();
      // 세아가 9:00에 식당에 있었을 수도, 9:10에 있었을 수도 있다(기록만으로는 정해지지 않는다)
      const records = baseFacts(p).map((card) => card.claim);
      expect(satisfiable(p.rules, [...records, atClaim("sea", "dining", 0)])).toBe(true);
      expect(satisfiable(p.rules, [...records, atClaim("sea", "dining", 1)])).toBe(true);
      // 하린의 말은 배식 기록과 같다
      expect(claimOf(p, "say-harin")).toEqual(claimOf(p, "meal"));
    });

    it("입문: 사람 셋, 시각 둘, 이을 것은 하나뿐이다", () => {
      expect(p.rules.people).toHaveLength(3);
      expect(p.rules.derivations).toHaveLength(1);
      expect(baseFacts(p)).toHaveLength(4);
      expect(p.minutes).toBe(2);
    });
  });

  describe("일일 13일째 · 두 곳에 남은 흔적: 두 물건이 두 시각을 채운다", () => {
    const p = DAILY_EVIDENCE_3;

    it("물건 하나로는 아무것도 정해지지 않지만, 둘이면 그 사람에게 다른 곳에 있을 틈이 없다", () => {
      expect(p.rules.times).toEqual(["18:00", "18:10"]);
      expect(p.description).toContain("18:00과 18:10 둘뿐");
      const [glove, ticket] = [claimOf(p, "glove"), claimOf(p, "ticket")];
      expect(satisfiable(p.rules, [glove, liar(p)])).toBe(true);
      expect(satisfiable(p.rules, [ticket, liar(p)])).toBe(true);
      expect(satisfiable(p.rules, [glove, ticket, liar(p)])).toBe(false);
      for (const time of [0, 1]) {
        expect(entails(p.rules, [glove, ticket], { kind: "notAt", who: "minjae", place: "dorm", time })).toBe(true);
        expect(entails(p.rules, [glove], { kind: "notAt", who: "minjae", place: "dorm", time })).toBe(false);
        expect(entails(p.rules, [ticket], { kind: "notAt", who: "minjae", place: "dorm", time })).toBe(false);
      }
      // 어느 시각에 어디 있었는지는 정해지지 않는다(그래서 얻는 사실은 "기숙사엔 없었다"다)
      expect(entailedPositions(p.rules, [glove, ticket])).toEqual([]);
      expect(satisfiable(p.rules, [glove, ticket, atClaim("minjae", "lab", 0)])).toBe(true);
      expect(satisfiable(p.rules, [glove, ticket, atClaim("minjae", "lab", 1)])).toBe(true);
    });

    it("거짓말은 남의 자리에 대한 것이다. 민재 자신의 말은 기록과 어긋나지 않는다", () => {
      const said = p.rules.cards.find((card) => card.id === "say-sea")!;
      expect(said.speaker).toBe("sea");
      expect(said.claim).toEqual(atClaim("minjae", "dorm", 0));
      const records = baseFacts(p).map((card) => card.claim);
      expect(satisfiable(p.rules, [...records, claimOf(p, "say-minjae"), claimOf(p, "say-harin")])).toBe(true);
      // 해설: 민재가 18:10에 식당에 있었다면 실습실에 있던 때는 18:00이다
      expect(entailedPositions(p.rules, [claimOf(p, "glove"), claimOf(p, "ticket"), claimOf(p, "say-minjae")])).toContainEqual(position("minjae", "lab", 0));
    });

    it("함정: 세아의 출입 기록은 18:10의 것이라 18:00의 목격담을 받쳐 주지 않는다", () => {
      expect(claimOf(p, "gate")).toEqual(atClaim("sea", "dorm", 1));
      for (const card of statementsOf(p)) expect(contradicts(p.rules, card.claim, claimOf(p, "gate"))).toBe(false);
      for (const other of ["glove", "ticket", "rollcall", "fact-route"]) expect(deriveFrom(p.rules, "gate", other)).toBeNull();
    });
  });

  describe("연습 C · 빌린 알리바이: 구간 기록 + 동행 → 두 명으로 찬 방", () => {
    const p = PRACTICE_EVIDENCE_C;

    it("좌석 기록은 구간이다: 19:10도 그 사이다. 사진과 이으면 둘의 자리가 나온다", () => {
      expect(claimOf(p, "seat")).toEqual({ kind: "stayed", who: "daon", place: "reading", from: 0, to: 2 });
      expect(entails(p.rules, [claimOf(p, "seat")], atClaim("daon", "reading", 1))).toBe(true);
      expect(entailedPositions(p.rules, [claimOf(p, "photo")])).toEqual([]);
      expect(entailedPositions(p.rules, [claimOf(p, "seat"), claimOf(p, "photo")])).toContainEqual(position("hana", "reading", 1));
      expect(entails(p.rules, [claimOf(p, "seat")], claimOf(p, "fact-pair"))).toBe(false);
      expect(entails(p.rules, [claimOf(p, "photo")], claimOf(p, "fact-pair"))).toBe(false);
    });

    it("두 명뿐인 열람실이 그 둘로 찼다: 준호와 세라는 거기 없었다", () => {
      const [pair, counter] = [claimOf(p, "fact-pair"), claimOf(p, "counter")];
      for (const who of ["junho", "sera"]) {
        expect(entails(p.rules, [pair, counter], { kind: "notAt", who, place: "reading", time: 1 })).toBe(true);
        expect(entails(p.rules, [pair], { kind: "notAt", who, place: "reading", time: 1 })).toBe(false);
      }
      // 둘의 자리만으로는 준호의 말이 깨지지 않는다(인원을 모르면 셋이 있었을 수도 있다)
      expect(contradicts(p.rules, liar(p), pair)).toBe(false);
      expect(contradicts(p.rules, liar(p), claimOf(p, "fact-full"))).toBe(true);
    });

    it("남은 한 자리를 두고 두 사람이 같은 말을 한다. 기록과 어긋나는 것은 준호의 말뿐이다", () => {
      expect(claimOf(p, "say-hana")).toEqual(atClaim("hana", "reading", 1));
      expect(liar(p)).toEqual(atClaim("junho", "reading", 1));
      // 좌석 기록과 계수기만으로는 두 사람 가운데 누구인지 가릴 수 없다
      const open = [claimOf(p, "seat"), claimOf(p, "counter")];
      expect(satisfiable(p.rules, [...open, claimOf(p, "say-hana")])).toBe(true);
      expect(satisfiable(p.rules, [...open, liar(p)])).toBe(true);
      expect(satisfiable(p.rules, [...open, claimOf(p, "say-hana"), liar(p)])).toBe(false);
    });

    it("네 번째 사람이 있어야 좌석 기록이 군더더기가 되지 않는다", () => {
      expect(p.rules.people).toHaveLength(4);
      expect(p.description).toContain("네 사람뿐");
      // 지금: 사진과 계수기만으로는 준호의 말이 깨지지 않는다(사진의 둘이 다른 곳에 있고 열람실에 준호와 세라가 있었을 수 있다)
      expect(satisfiable(p.rules, [claimOf(p, "photo"), claimOf(p, "counter"), liar(p)])).toBe(true);
      // 세라가 없는 세 사람의 세계라면 그 둘만으로 깨져, 좌석 기록 없이도 풀려 버린다
      const three: EvidenceRules = { ...p.rules, people: p.rules.people.filter((person) => person.id !== "sera") };
      expect(satisfiable(three, [claimOf(p, "photo"), claimOf(p, "counter"), liar(p)])).toBe(false);
    });

    it("함정: 대출 기록은 19:20의 것이다. 준호가 그때 열람실에 있었던 것은 맞다", () => {
      expect(claimOf(p, "loan")).toEqual(atClaim("junho", "reading", 2));
      for (const card of statementsOf(p)) expect(contradicts(p.rules, card.claim, claimOf(p, "loan"))).toBe(false);
      for (const other of ["seat", "photo", "counter", "fact-pair", "fact-full"]) expect(deriveFrom(p.rules, "loan", other)).toBeNull();
    });
  });

  describe("시험 D→C · 사라진 사건 파일: 혼자였던 방 → 물건의 때", () => {
    const p = EXAM_EVIDENCE_D_C;

    it("17:10에 기록실에는 한 명뿐이고 그 한 명은 서명한 하린이다", () => {
      expect(claimOf(p, "fact-alone")).toEqual({ kind: "alone", who: "harin", place: "archive", time: 1 });
      expect(entails(p.rules, [claimOf(p, "counter"), claimOf(p, "desk")], claimOf(p, "fact-alone"))).toBe(true);
      expect(entails(p.rules, [claimOf(p, "counter")], claimOf(p, "fact-alone"))).toBe(false);
      expect(entails(p.rules, [claimOf(p, "desk")], claimOf(p, "fact-alone"))).toBe(false);
    });

    it("남이 혼자 있던 때를 지우면 명찰의 때가 정해진다. 명찰만으로는 준호의 말이 깨지지 않는다", () => {
      expect(entailedPositions(p.rules, [claimOf(p, "badge")])).toEqual([]);
      expect(contradicts(p.rules, liar(p), claimOf(p, "badge"))).toBe(false);
      expect(contradicts(p.rules, liar(p), claimOf(p, "fact-alone"))).toBe(false);
      expect(entailedPositions(p.rules, [claimOf(p, "fact-alone"), claimOf(p, "badge")])).toContainEqual(position("junho", "archive", 0));
      // 계수기나 열람 대장 하나만으로는 명찰의 때가 정해지지 않는다
      expect(deriveFrom(p.rules, "counter", "badge")).toBeNull();
      expect(deriveFrom(p.rules, "desk", "badge")).toBeNull();
      expect(satisfiable(p.rules, [claimOf(p, "counter"), claimOf(p, "badge"), liar(p)])).toBe(true);
      expect(satisfiable(p.rules, [claimOf(p, "desk"), claimOf(p, "badge"), liar(p)])).toBe(true);
    });

    it("함정: 다온의 말은 참일 수 있지만 17:10의 일이다. 17:00의 알리바이가 되지 못한다", () => {
      expect(claimOf(p, "say-daon")).toEqual({ kind: "together", a: "daon", b: "junho", time: 1 });
      expect(liar(p)).toEqual(atClaim("junho", "lounge", 0));
      const records = baseFacts(p).map((card) => card.claim);
      // 다온의 말과 하린의 말은 기록 전체와 함께 성립한다
      expect(satisfiable(p.rules, [...records, claimOf(p, "say-daon"), claimOf(p, "say-harin")])).toBe(true);
      // 다온의 말이 참이어도 준호의 17:00은 달라지지 않는다
      expect(entails(p.rules, [...records, claimOf(p, "say-daon")], atClaim("junho", "archive", 0))).toBe(true);
      // 사물함 기록은 다온의 자리만 말한다
      expect(claimOf(p, "locker")).toEqual(atClaim("daon", "lounge", 0));
      for (const other of ["counter", "desk", "badge", "fact-alone", "fact-junho"]) expect(deriveFrom(p.rules, "locker", other)).toBeNull();
    });
  });

  it("점검이 실패를 잡아낸다: 물건 하나가 더 늦게 발견되면 '두 물건이 두 시각을 채운다'가 성립하지 않는다", () => {
    const p = DAILY_EVIDENCE_3;
    // 시각이 셋이고 장갑이 셋째 시각에 발견됐다면, 민재에게 기숙사에 있을 틈이 생긴다
    const loose: EvidenceRules = {
      ...p.rules,
      times: [...p.rules.times, "18:20"],
      cards: p.rules.cards.map((card) => (card.id === "glove" ? { ...card, claim: { kind: "visited", who: "minjae", place: "lab", until: 2 } as const } : card)),
    };
    expect(auditEvidence(loose).issues.join(" ")).toContain("나오지 않는다");
    // 연습 C: 계수기가 세 명이라고 했다면 '두 명으로 찬 방'이 성립하지 않는다
    const q = PRACTICE_EVIDENCE_C;
    const crowded: EvidenceRules = {
      ...q.rules,
      cards: q.rules.cards.map((card) => (card.id === "counter" ? { ...card, claim: { kind: "count", place: "reading", time: 1, count: 3 } as const } : card)),
    };
    expect(auditEvidence(crowded).issues.join(" ")).toContain("나오지 않는다");
    // 시험 D→C: 계수기가 두 명이라고 했다면 하린이 혼자였다는 사실이 나오지 않는다
    const r = EXAM_EVIDENCE_D_C;
    const two: EvidenceRules = {
      ...r.rules,
      cards: r.rules.cards.map((card) => (card.id === "counter" ? { ...card, claim: { kind: "count", place: "archive", time: 1, count: 2 } as const } : card)),
    };
    expect(auditEvidence(two).issues.join(" ")).toContain("나오지 않는다");
  });
});

/* ═════════ 공간 추론 · 인장 대조 ═════════ */

const face = (puzzle: SpatialPuzzle, id: string) => puzzle.rules.stamps.find((s) => s.id === id)!.face;
const smudged = (puzzle: SpatialPuzzle) => puzzle.rules.imprint.join("").split("?").length - 1;
const bestDiff = (puzzle: SpatialPuzzle, id: string, how: "press" | "look") =>
  Math.min(...TURNS.map((turn) => sealDifference(puzzle.rules.imprint, how === "press" ? pressSeal(face(puzzle, id), turn) : rotateGrid(face(puzzle, id), turn))));
const sealSignature = (puzzle: SpatialPuzzle) => [puzzle.rules.size, puzzle.rules.stamps.length, smudged(puzzle), puzzle.rules.trials].join("/");
/** 격자의 한 귀퉁이(3×3) */
const corner = (grid: readonly string[], rows: "top" | "bottom", cols: "left" | "right") =>
  grid.slice(rows === "top" ? 0 : 3, rows === "top" ? 3 : 6).map((row) => (cols === "left" ? row.slice(0, 3) : row.slice(3, 6)));

describe("인장 대조 두 문제", () => {
  const eachSeal = seals.map((p) => [p.id, p] as const);
  const oldSeals: SpatialPuzzle[] = [DAILY_SEAL_1, DAILY_SEAL_2, ...SEAL_SET];

  it.each(eachSeal)("%s: 그림 자료에 문제가 없고, 화면의 한계 안이다", (_id, puzzle) => {
    const audit = auditSpatial(puzzle.rules);
    expect(audit.issues).toEqual([]);
    const { size, stamps, trials, imprint } = puzzle.rules;
    expect([5, 6]).toContain(size);
    expect(stamps.length).toBeLessThanOrEqual(4);
    expect(trials).toBeGreaterThanOrEqual(0);
    expect(trials).toBeLessThanOrEqual(3);
    expect(imprint).toHaveLength(size);
    for (const stamp of stamps) {
      expect(stamp.name.endsWith(" 도장")).toBe(true);
      expect(stamp.name.replace(" 도장", "").length).toBeLessThanOrEqual(3);
    }
    expect(new Set(stamps.map((s) => s.name)).size).toBe(stamps.length);
    // 도장끼리 점의 수가 같다(점만 세어서는 가려지지 않는다)
    expect(new Set(stamps.map((s) => dotCount(s.face))).size).toBe(1);
    // 닫는 글은 답인 도장의 이름을 밝히고, 여는 글과 문제 글은 밝히지 않는다
    const answer = stamps.find((s) => s.id === puzzle.solution.stamp)!.name;
    expect(puzzle.outro).toContain(answer);
    expect(puzzle.intro).not.toContain(answer);
    expect(puzzle.description).not.toContain(answer);
    // 문제 글이 시험 종이의 수를 바르게 말한다
    expect(puzzle.description).toContain(`시험 종이는 ${["", "한", "두", "세"][trials]} 장`);
  });

  it.each(eachSeal)("%s: 해설은 답이 아닌 도장을 모두 한 번씩 지우고, 마지막 단계에서 방향 셋을 지운다", (_id, puzzle) => {
    const last = puzzle.explanation[puzzle.explanation.length - 1].facts;
    expect(last.map((fact) => (fact.kind === "turnIsNot" ? fact.turn : -1)).sort()).toEqual(TURNS.filter((t) => t !== puzzle.solution.turn));
    const ruledOut = puzzle.explanation.flatMap((step) => step.facts).flatMap((fact) => (fact.kind === "stampIsNot" ? [fact.stamp] : []));
    expect([...ruledOut].sort()).toEqual(puzzle.rules.stamps.map((s) => s.id).filter((id) => id !== puzzle.solution.stamp).sort());
  });

  it("크기 / 도장 수 / 번진 칸 수 / 시험 종이 수의 조합이 서로, 그리고 기존의 여덟 문제와 겹치지 않는다", () => {
    const old = oldSeals.map(sealSignature);
    const fresh = seals.map(sealSignature);
    expect(fresh).toEqual(["6/4/27/2", "5/3/0/2"]);
    expect(new Set([...old, ...fresh]).size).toBe(old.length + fresh.length);
    // 자국의 넷 가운데 셋이 가려진 문제는 처음이다(기존에 가장 많이 번진 것은 서른여섯 칸 가운데 열네 칸)
    expect(Math.max(...oldSeals.map(smudged))).toBe(14);
  });

  it("연습 D: 흩어진 일곱 점. 오답은 거울상 하나와, 외딴 점 하나가 한 칸 어긋난 닮은꼴 하나다", () => {
    const p = PRACTICE_SEAL_D;
    const { imprint } = p.rules;
    const audit = auditSpatial(p.rules);
    expect(audit.mirrorTraps).toEqual(["moon"]);
    expect(audit.minDifference).toBe(2);
    expect(p.rules.stamps.map((s) => dotCount(s.face))).toEqual([7, 7, 7]);
    expect(dotCount(imprint)).toBe(7);
    // 붙어 있는 네 점: 셋째 줄의 세 점이 나란하고, 그 오른쪽 끝 바로 위에 한 점이 꺾여 붙었다
    expect(imprint[2]).toBe("###..");
    expect(imprint[1][2]).toBe("#");
    // 떨어진 세 점: 위쪽에 둘(양 귀퉁이), 맨 아랫줄의 왼쪽에서 넷째 칸에 하나
    expect(imprint[0]).toBe("#...#");
    expect(imprint[4]).toBe("...#.");
    expect(imprint[3]).toBe(".....");
    // 달빛 도장: 두 번 돌려 보면 자국과 똑같다. 찍으면 여섯 칸이 어긋난다.
    expect(rotateGrid(face(p, "moon"), 2)).toEqual(imprint);
    expect(bestDiff(p, "moon", "press")).toBe(6);
    // 새벽 도장: 세 번 돌려 찍으면 맨 아랫줄의 외딴 점만 한 칸 왼쪽에 찍힌다
    const dawn = pressSeal(face(p, "dawn"), 3);
    expect(sealDifference(imprint, dawn)).toBe(2);
    expect(dawn.slice(0, 4)).toEqual(imprint.slice(0, 4));
    expect(dawn[4]).toBe("..#..");
    expect(bestDiff(p, "dawn", "press")).toBe(2);
    // 닮은꼴은 뒤집지 않고 보아도 자국과 같지 않다(거울상이 아니다)
    expect(bestDiff(p, "dawn", "look")).toBeGreaterThan(0);
    // 별빛 도장: 한 번 돌려 찍으면 겹친다
    expect(pressSeal(face(p, "star"), 1)).toEqual(imprint);
    expect(bestDiff(p, "star", "look")).toBeGreaterThan(0);
    // 무늬에 대칭이 없다: 어느 도장도 돌려서 제 거울상이 되지 않는다
    for (const stamp of p.rules.stamps) {
      expect(TURNS.some((turn) => rotateGrid(stamp.face, turn).join("/") === mirrorGrid(stamp.face).join("/")), stamp.id).toBe(false);
    }
  });

  it("일일 12일째: 남은 것은 왼쪽 위 아홉 칸뿐이다", () => {
    const p = DAILY_SEAL_3;
    const { imprint } = p.rules;
    expect(smudged(p)).toBe(27);
    expect(imprint.join("").replaceAll("?", "")).toHaveLength(9);
    // 보이는 칸은 정확히 왼쪽 위 3×3 이다
    imprint.forEach((row, r) => [...row].forEach((cell, c) => expect(cell === "?", `${r},${c}`).toBe(!(r < 3 && c < 3))));
    const piece = corner(imprint, "top", "left");
    expect(piece).toEqual(["##.", ".#.", "..#"]);
    // 조각에 대칭이 없다(돌려서 제 거울상이 되지 않는다): 거울상과 헷갈릴 수 있고, 그래서 가려낼 수 있다
    expect(TURNS.some((turn) => rotateGrid(piece, turn).join("/") === mirrorGrid(piece).join("/"))).toBe(false);
    const audit = auditSpatial(p.rules);
    expect(audit.mirrorTraps).toEqual(["trace"]);
    expect(audit.minDifference).toBe(1);
    expect(p.rules.stamps.map((s) => dotCount(s.face))).toEqual([16, 16, 16, 16]);
  });

  it("일일 12일째: 오답 셋은 저마다 다른 이유로 떨어진다", () => {
    const p = DAILY_SEAL_3;
    const { imprint } = p.rules;
    const piece = corner(imprint, "top", "left");
    const mirrored = mirrorGrid(piece);
    // 찍기 전의 도장 면에서는 오른쪽 위 귀퉁이에 조각의 거울상이 와야 한다
    for (const answer of enumerateSeals(p.rules)) {
      const before = rotateGrid(face(p, answer.stamp), answer.turn);
      expect(imprintMatches(imprint, pressSeal(face(p, answer.stamp), answer.turn)), `${answer.stamp} ${answer.turn}`).toBe(
        corner(before, "top", "right").join("/") === mirrored.join("/"),
      );
    }
    // 추적: 세 번 돌려 보면 왼쪽 위가 조각과 똑같다(뒤집히지 않았다). 찍으면 맞지 않는다.
    expect(corner(rotateGrid(face(p, "trace"), 3), "top", "left")).toEqual(piece);
    expect(bestDiff(p, "trace", "look")).toBe(0);
    expect(bestDiff(p, "trace", "press")).toBeGreaterThan(0);
    // 변장: 오른쪽 아래 귀퉁이에 거울상이 그대로 있다. 세 번 돌리면 그 귀퉁이가 오른쪽 위로 오지만 장식도 함께 돌아간다.
    expect(corner(face(p, "disguise"), "bottom", "right")).toEqual(mirrored);
    const turned = corner(rotateGrid(face(p, "disguise"), 3), "top", "right");
    expect(turned).toEqual(rotateGrid(mirrored, 3));
    expect(turned).not.toEqual(mirrored);
    expect(bestDiff(p, "disguise", "press")).toBeGreaterThanOrEqual(4);
    // 감식: 한 번 돌려 찍으면 조각의 셋째 줄 맨 왼쪽 칸 하나만 다르다(자국은 비었고 도장은 찍힌다)
    const forensic = pressSeal(face(p, "forensic"), 1);
    expect(sealDifference(imprint, forensic)).toBe(1);
    expect([imprint[2][0], forensic[2][0]]).toEqual([".", "#"]);
    expect(bestDiff(p, "forensic", "press")).toBe(1);
    // 암호: 두 번 돌려 찍으면 아홉 칸이 모두 맞는다. 돌려 보기만 해서는 자국과 같아 보이지 않는다.
    expect(corner(pressSeal(face(p, "cipher"), 2), "top", "left")).toEqual(piece);
    expect(bestDiff(p, "cipher", "look")).toBeGreaterThan(0);
    // 그 한 칸마저 가려지면 감식 도장도 답이 된다(그 칸이 결정적이다)
    const blurred = imprint.map((row, r) => (r === 2 ? `?${row.slice(1)}` : row));
    expect(solveSpatial({ ...p.rules, imprint: blurred }).map((a) => a.stamp).sort()).toEqual(["cipher", "forensic"]);
  });
});
