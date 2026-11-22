import { describe, expect, it } from "vitest";
import { DAILY_CODE_2 } from "../data/dailySet";
import { DAILY_CODE } from "../data/puzzles";
import { CODE_SET, EXAM_CODE_A_S, EXAM_CODE_B_A, EXAM_CODE_D_C, PRACTICE_CODE_B, PRACTICE_CODE_C, PRACTICE_CODE_F } from "../data/sets/code";
import { checkAnswer, enumerateCodes, scoreCodeGuess, solveCode, verifyGuidance, verifyPuzzle } from "../engine/puzzleValidator";
import type { CodePuzzle } from "../engine/types";

/** 암호 해독 · 연습실 셋과 승급 시험 셋 (GATE 05). 표의 칸, 정답의 유일성, 군더더기, 푸는 길, 해설의 글, 화면의 한계를 본다. */

const text = (code: readonly number[]) => code.join("");
const has = (code: readonly number[], digit: number) => code.includes(digit);

/** 기록·조건의 일부만 남기고 푼다 (번호는 0부터) */
function solveWith(puzzle: CodePuzzle, keep: { clues?: number[]; conditions?: number[] }): string[] {
  const { rules } = puzzle;
  return solveCode({
    ...rules,
    clues: keep.clues ? keep.clues.map((i) => rules.clues[i]) : rules.clues,
    conditions: keep.conditions ? keep.conditions.map((i) => rules.conditions![i]) : rules.conditions,
  }).map(text);
}

/** 문제의 뼈대: 자릿수 · 숫자 범위 · '일치 없음' 기록의 유무 · 조건의 종류 · 두 기록이 함께 쓰는 숫자의 최대 수 */
function shape(puzzle: CodePuzzle): string {
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
  ].join(" · ");
}

describe("암호 해독 여섯 문제: 표의 칸", () => {
  it("순서, 구분, 등급, 보상, 힌트 수가 표와 맞는다", () => {
    expect(
      CODE_SET.map((p) => [p.id, p.category, p.rank, p.difficulty, p.reward, p.hints.length]),
    ).toEqual([
      ["practice-code-f", "practice", "F", 1, 30, 2],
      ["exam-code-d-c", "exam", "D", 3, 0, 2],
      ["practice-code-c", "practice", "C", 3, 40, 2],
      ["practice-code-b", "practice", "B", 4, 45, 2],
      ["exam-code-b-a", "exam", "B", 4, 0, 0],
      ["exam-code-a-s", "exam", "A", 5, 0, 0],
    ]);
    expect(CODE_SET.every((p) => p.type === "code" && p.typeLabel === DAILY_CODE.typeLabel)).toBe(true);
    const titles = [DAILY_CODE, DAILY_CODE_2, ...CODE_SET].map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it.each(CODE_SET.map((p) => [p.id, p] as const))("%s: 사건을 여는 글과 닫는 글이 한두 문장이고, 예상 시간이 적혀 있다", (_id, puzzle) => {
    for (const line of [puzzle.intro, puzzle.outro]) {
      expect(line).toBeTruthy();
      expect(line!.split(/[.?!]\s/).length).toBeLessThanOrEqual(3);
      expect(line!.length).toBeLessThanOrEqual(64);
    }
    expect(puzzle.minutes).toBeGreaterThanOrEqual(2);
    expect(puzzle.minutes).toBeLessThanOrEqual(6);
  });

  it.each(CODE_SET.map((p) => [p.id, p] as const))("%s: 화면의 한계를 넘지 않는다", (_id, puzzle) => {
    const { rules } = puzzle;
    const fourDigits = ["practice-code-b", "exam-code-a-s"].includes(puzzle.id);
    expect(rules.length).toBe(fourDigits ? 4 : 3);
    expect(rules.digits.every((digit) => digit >= 1 && digit <= 9)).toBe(true);
    expect(rules.clues.length).toBeLessThanOrEqual(5);
    expect(rules.clues.length + (rules.conditions?.length ?? 0)).toBeLessThanOrEqual(6);
    for (const condition of rules.conditions ?? []) expect(condition.text.length).toBeLessThanOrEqual(22);
  });
});

describe("암호 해독 여섯 문제: 정답과 풀이", () => {
  it.each(CODE_SET.map((p) => [p.id, p] as const))("%s: 정답이 정확히 하나이고 짜임새에 문제가 없다", (_id, puzzle) => {
    const result = verifyPuzzle(puzzle);
    expect(result.issues).toEqual([]);
    expect(result.solutions).toHaveLength(1);
    expect(result.matchesDeclared).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("찍어서 맞히기 어렵다: 후보 수", () => {
    expect(CODE_SET.map((p) => verifyPuzzle(p).candidateCount)).toEqual([120, 504, 504, 3024, 504, 3024]);
  });

  it.each(CODE_SET.map((p) => [p.id, p] as const))("%s: 정답만 정답으로 채점된다", (_id, puzzle) => {
    const accepted = enumerateCodes(puzzle.rules).filter((code) => checkAnswer(puzzle, code));
    expect(accepted).toEqual([puzzle.solution]);
    // 같은 숫자가 겹치거나 길이가 다른 답안은 받지 않는다
    expect(checkAnswer(puzzle, puzzle.solution.map(() => puzzle.solution[0]))).toBe(false);
    expect(checkAnswer(puzzle, puzzle.solution.slice(1))).toBe(false);
  });

  it.each(CODE_SET.map((p) => [p.id, p] as const))("%s: 힌트와 해설이 규칙과 맞고, 힌트만으로 답이 드러나지 않는다", (_id, puzzle) => {
    const result = verifyGuidance(puzzle);
    expect(result.issues).toEqual([]);
    expect(result.candidatesAfterHints).toBeGreaterThanOrEqual(2);
    expect(puzzle.explanation.length).toBeGreaterThanOrEqual(3);
    // 해설의 마지막 단계는 모든 자리를 말한다
    const last = puzzle.explanation[puzzle.explanation.length - 1].facts.filter((fact) => fact.kind === "at");
    expect(last).toHaveLength(puzzle.rules.length);
    // 힌트의 글에 정답이 그대로 적혀 있지 않다
    for (const hint of puzzle.hints) expect(hint.text).not.toContain(text(puzzle.solution));
  });

  it.each(CODE_SET.map((p) => [p.id, p] as const))("%s: 어느 기록도, 어느 조건도 군더더기가 아니다", (_id, puzzle) => {
    const { rules } = puzzle;
    rules.clues.forEach((_, skip) => {
      const rest = rules.clues.map((__, i) => i).filter((i) => i !== skip);
      expect(solveWith(puzzle, { clues: rest }).length).toBeGreaterThan(1);
    });
    (rules.conditions ?? []).forEach((_, skip) => {
      const rest = rules.conditions!.map((__, i) => i).filter((i) => i !== skip);
      expect(solveWith(puzzle, { conditions: rest }).length).toBeGreaterThan(1);
    });
    // 기록에 적힌 결과는 정답과 견주어 맞다
    for (const clue of rules.clues) expect(scoreCodeGuess(puzzle.solution, clue.guess)).toEqual({ match: clue.match, inPlace: clue.inPlace });
  });
});

describe("암호 해독 여섯 문제: 푸는 길이 서로 다르다", () => {
  it("뼈대가 서로, 그리고 일일 문제의 두 암호와 겹치지 않는다", () => {
    const shapes = [DAILY_CODE, DAILY_CODE_2, ...CODE_SET].map(shape);
    expect(shapes).toEqual([
      "3자리 · 숫자 9개 · 빈 기록 있음 · 조건 없음 · 겹침 2",
      "3자리 · 숫자 9개 · 빈 기록 없음 · 조건 없음 · 겹침 1",
      "3자리 · 숫자 6개 · 빈 기록 있음 · 조건 없음 · 겹침 2",
      "3자리 · 숫자 9개 · 빈 기록 없음 · sum · 겹침 1",
      "3자리 · 숫자 9개 · 빈 기록 없음 · 조건 없음 · 겹침 2",
      "4자리 · 숫자 9개 · 빈 기록 있음 · 조건 없음 · 겹침 3",
      "3자리 · 숫자 9개 · 빈 기록 없음 · greater+oddCount · 겹침 1",
      "4자리 · 숫자 9개 · 빈 기록 없음 · greater+sum · 겹침 3",
    ]);
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it("연습 F: '일치 없음' 한 줄이 암호의 숫자 셋을 그대로 남기고, 세 가지 결과를 한 번씩 읽는다", () => {
    const p = PRACTICE_CODE_F;
    const afterEmpty = solveWith(p, { clues: [0] });
    expect(afterEmpty).toHaveLength(6);
    expect(afterEmpty.every((code) => [...code].sort().join("") === "135")).toBe(true);
    // 324 까지 보면 3 이 첫째 자리로 정해지고 둘이 남는다 (힌트 두 단계를 다 본 상태)
    expect(solveWith(p, { clues: [0, 1] })).toEqual(["315", "351"]);
    expect(verifyGuidance(p).candidatesAfterHints).toBe(2);
    expect(p.rules.clues.map((clue) => `${clue.match}/${clue.inPlace}`).sort()).toEqual(["0/0", "1/0", "1/1"]);
  });

  it("시험 D→C: 472 와 합으로 묶음이 둘로 줄고, 915 가 하나를 지운다", () => {
    const p = EXAM_CODE_D_C;
    const sets = (codes: string[]) => [...new Set(codes.map((code) => [...code].sort().join("")))].sort();
    // 4 와 7 이 함께면 남은 숫자가 4 라 겹친다: 묶음은 2·4·9 와 2·6·7 뿐이다
    expect(sets(solveWith(p, { clues: [0] }))).toEqual(["249", "267"]);
    expect(sets(solveWith(p, { clues: [0, 1] }))).toEqual(["249"]);
    // 합이 없으면 묶음을 계산할 수 없다
    expect(sets(solveWith(p, { clues: [0], conditions: [] })).length).toBeGreaterThan(2);
    expect(solveWith(p, { conditions: [] })).toHaveLength(3);
    // 9 는 두 기록에서 모두 위치가 틀려 둘째 자리다
    expect(solveWith(p, { clues: [1, 2] }).every((code) => !has([...code].map(Number), 9) || code[1] === "9")).toBe(true);
  });

  it("연습 C: 세 가정 가운데 둘이 모순으로 지워진다", () => {
    const p = PRACTICE_CODE_C;
    expect(p.rules.clues.every((clue) => clue.match > 0)).toBe(true);
    const digits = (code: string) => [...code].map(Number);
    // 3 과 5 가 함께라는 가정은 358 · 531 을 함께 만족하지 못한다
    expect(solveWith(p, { clues: [0, 1] }).filter((code) => has(digits(code), 3) && has(digits(code), 5))).toEqual([]);
    // 그래서 8 은 반드시 있고 1 은 없다
    expect(solveWith(p, { clues: [0, 1] }).every((code) => has(digits(code), 8) && !has(digits(code), 1))).toBe(true);
    // 3 과 8 이라는 가정은 531 까지는 살아 있지만(8·3 이 첫째·둘째), 816 에서 사라진다
    expect(solveWith(p, { clues: [0, 1] }).some((code) => has(digits(code), 3))).toBe(true);
    expect(solveWith(p, { clues: [0, 1, 2] }).filter((code) => has(digits(code), 3))).toEqual([]);
    // 남는 것은 5 · 8 · ? 뿐이고, 마지막 기록이 셋째 자리를 정한다
    expect(solveWith(p, { clues: [0, 1, 2] })).toEqual(["582", "584", "587", "589"]);
  });

  it("연습 B: 두 기록의 차이로 4 와 5 를 가르고, 자리를 단계마다 좁힌다", () => {
    const p = PRACTICE_CODE_B;
    const [first, second] = p.rules.clues;
    // 두 기록은 넷째 숫자만 다르다
    expect(first.guess.slice(0, 3)).toEqual(second.guess.slice(0, 3));
    expect(first.guess[3]).not.toBe(second.guess[3]);
    const afterPair = solveWith(p, { clues: [0, 1] }).map((code) => [...code].map(Number));
    expect(afterPair.every((code) => has(code, 4) && !has(code, 5))).toBe(true);
    // 1, 2, 3 가운데 정확히 하나가 있고, 적힌 자리 그대로다. 4 는 넷째 자리가 아니다.
    expect(afterPair.every((code) => [1, 2, 3].filter((digit) => has(code, digit)).length === 1)).toBe(true);
    expect(afterPair.every((code) => [1, 2, 3].some((digit) => code[digit - 1] === digit))).toBe(true);
    expect(afterPair.every((code) => code[3] !== 4)).toBe(true);
    // '일치 없음'까지 보면 숫자는 2·4·7·9 로 정해지고 2 는 둘째 자리다
    const afterEmpty = solveWith(p, { clues: [0, 1, 2] });
    expect(afterEmpty).toEqual(["4279", "4297", "7249", "9247"]);
    // 9 가 첫째 자리라는 가정은 마지막 기록과 어긋난다(위치가 정확한 것이 둘이 된다)
    const last = p.rules.clues[3];
    expect(scoreCodeGuess([9, 2, 4, 7], last.guess)).toEqual({ match: 2, inPlace: 2 });
    // 7 은 어느 기록에도 적히지 않았다: 남는 숫자로 드러난다
    expect(p.rules.clues.some((clue) => clue.guess.includes(7))).toBe(false);
  });

  it("시험 B→A: 홀짝을 세어 숫자를 정하고, 크기 비교로 첫째 자리를 거른다", () => {
    const p = EXAM_CODE_B_A;
    const digits = (code: string) => [...code].map(Number);
    // "홀수는 하나뿐" + 513 → 7 과 9 는 없다
    expect(solveWith(p, { clues: [0], conditions: [0] }).every((code) => !has(digits(code), 7) && !has(digits(code), 9))).toBe(true);
    // 839 까지 보면 3 이 셋째, 8 이 둘째 자리다 (크기 조건 없이도)
    const middle = solveWith(p, { clues: [0, 2], conditions: [0] });
    expect(middle).toEqual(["283", "483", "683"]);
    // 크기 조건이 2 를, 642 가 6 을 지운다
    expect(solveWith(p, { clues: [0, 2] })).toEqual(["483", "683"]);
    expect(solveWith(p, { conditions: [0] })).toEqual(["283", "483"]);
    expect(scoreCodeGuess([6, 8, 3], p.rules.clues[1].guess)).toEqual({ match: 1, inPlace: 1 });
  });

  it("시험 A→S: 합으로 묶음을 세우고, 크기 비교로 9 와 8 의 자리를 정하고, 4 와 5 로 묶음을 가른다", () => {
    const p = EXAM_CODE_A_S;
    const sets = (codes: string[]) => [...new Set(codes.map((code) => [...code].sort().join("")))].sort();
    // 합이 28 인 서로 다른 네 숫자는 두 묶음뿐이다
    expect(sets(solveWith(p, { clues: [], conditions: [0] }))).toEqual(["4789", "5689"]);
    // 기록 두 줄과 두 조건으로 8 은 첫째, 9 는 셋째 자리가 된다
    expect(solveWith(p, { clues: [0, 1] })).toEqual(["8497", "8596", "8695", "8794"]);
    // 크기 조건이 없으면 8 과 9 의 자리가 정해지지 않는다
    const loose = solveWith(p, { clues: [0, 1], conditions: [0] });
    expect(loose.some((code) => code[3] === "9")).toBe(true);
    expect(loose.some((code) => code[3] === "8")).toBe(true);
    expect(solveWith(p, { conditions: [0] })).toContain("7498");
    // 마지막 기록의 4 와 5 는 서로 다른 묶음이라, 맞은 수로는 묶음을 알 수 없고 위치로 가른다
    const last = p.rules.clues[2];
    const scores = ["8497", "8596", "8695", "8794"].map((code) => scoreCodeGuess([...code].map(Number), last.guess));
    expect(scores.map((score) => score.match)).toEqual([1, 1, 1, 1]);
    expect(scores.map((score) => score.inPlace)).toEqual([1, 0, 0, 0]);
  });
});
