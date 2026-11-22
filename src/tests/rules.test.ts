import { describe, expect, it } from "vitest";
import { daon, hana, junho, sera, doyun } from "../data/people";
import {
  auditCode,
  auditSchedule,
  auditTruth,
  codeConditionHolds,
  constraintHolds,
  countTrue,
  solveCode,
  solveSchedule,
  solveTruth,
  truthValues,
} from "../engine/puzzleValidator";
import type { CodeRules, ScheduleRules, TruthRules } from "../engine/types";

/** GATE 05 에서 기존 세 유형에 더한 규칙: 금고에 새겨진 조건, 남의 말을 가리키는 진술, 새 순서 조건 */

describe("암호: 금고 문에 새겨진 조건", () => {
  it("합, 크기 비교, 홀수의 수를 판정한다", () => {
    expect(codeConditionHolds({ kind: "sum", value: 12, text: "" }, [4, 2, 6])).toBe(true);
    expect(codeConditionHolds({ kind: "sum", value: 13, text: "" }, [4, 2, 6])).toBe(false);
    expect(codeConditionHolds({ kind: "greater", a: 2, b: 0, text: "" }, [4, 2, 6])).toBe(true);
    expect(codeConditionHolds({ kind: "greater", a: 1, b: 0, text: "" }, [4, 2, 6])).toBe(false);
    expect(codeConditionHolds({ kind: "oddCount", count: 0, text: "" }, [4, 2, 6])).toBe(true);
    expect(codeConditionHolds({ kind: "oddCount", count: 2, text: "" }, [3, 2, 5])).toBe(true);
  });

  it("조건은 시도 기록과 함께 후보를 줄인다", () => {
    const rules: CodeRules = { length: 3, digits: [1, 2, 3, 4, 5, 6, 7, 8, 9], clues: [{ guess: [1, 2, 3], match: 0, inPlace: 0 }] };
    const open = solveCode(rules).length;
    const narrowed = solveCode({ ...rules, conditions: [{ kind: "sum", value: 15, text: "" }] });
    expect(open).toBe(120);
    expect(narrowed.length).toBeLessThan(open);
    expect(narrowed.every((code) => code[0] + code[1] + code[2] === 15)).toBe(true);
    expect(narrowed.every((code) => !code.some((d) => [1, 2, 3].includes(d)))).toBe(true);
  });

  it("없는 자리를 가리키는 조건과 길이가 다른 기록을 잡아낸다", () => {
    const rules: CodeRules = { length: 3, digits: [1, 2, 3, 4, 5, 6], clues: [{ guess: [1, 2, 3], match: 1, inPlace: 0 }] };
    expect(auditCode(rules)).toEqual([]);
    expect(auditCode({ ...rules, conditions: [{ kind: "greater", a: 3, b: 0, text: "" }] })).toHaveLength(1);
    expect(auditCode({ ...rules, conditions: [{ kind: "greater", a: 1, b: 1, text: "" }] })).toHaveLength(1);
    expect(auditCode({ ...rules, conditions: [{ kind: "oddCount", count: 4, text: "" }] })).toHaveLength(1);
    expect(auditCode({ ...rules, clues: [{ guess: [1, 2], match: 1, inPlace: 0 }] })).toHaveLength(1);
    expect(auditCode({ ...rules, clues: [{ guess: [1, 1, 2], match: 1, inPlace: 0 }] })).toHaveLength(1);
    expect(auditCode({ ...rules, clues: [{ guess: [1, 2, 9], match: 1, inPlace: 0 }] })).toHaveLength(1);
  });
});

describe("진술: 남의 말을 가리키는 진술", () => {
  const rules: TruthRules = {
    people: [hana, junho, sera, daon],
    statements: [
      { speaker: "hana", text: "준호가 숨겼다.", claim: { kind: "culpritIs", who: "junho" } },
      { speaker: "junho", text: "하나의 말은 거짓이다.", claim: { kind: "speakerLying", who: "hana" } },
      { speaker: "sera", text: "준호의 말은 참이다.", claim: { kind: "speakerTruthful", who: "junho" } },
      { speaker: "daon", text: "세라가 숨겼다.", claim: { kind: "culpritIs", who: "sera" } },
    ],
    trueCount: 2,
  };

  it("가리키는 진술의 참·거짓을 따라간다", () => {
    // 준호가 숨겼다면: 하나 참 → 준호 거짓 → 세라 거짓, 다온 거짓
    expect(truthValues(rules, "junho")).toEqual([true, false, false, false]);
    // 세라가 숨겼다면: 하나 거짓 → 준호 참 → 세라 참, 다온 참
    expect(truthValues(rules, "sera")).toEqual([false, true, true, true]);
    // 하나가 숨겼다면: 하나 거짓 → 준호 참 → 세라 참, 다온 거짓
    expect(truthValues(rules, "hana")).toEqual([false, true, true, false]);
    expect(countTrue(rules, "daon")).toBe(2);
    expect(solveTruth(rules)).toEqual(["hana", "daon"]);
    expect(auditTruth(rules)).toEqual([]);
  });

  it("돌고 돌아 제자리로 오는 진술, 없는 진술을 가리키는 진술을 잡아낸다", () => {
    const loop: TruthRules = {
      ...rules,
      statements: [
        { speaker: "hana", text: "준호의 말은 거짓이다.", claim: { kind: "speakerLying", who: "junho" } },
        { speaker: "junho", text: "하나의 말은 거짓이다.", claim: { kind: "speakerLying", who: "hana" } },
      ],
      trueCount: 1,
    };
    expect(auditTruth(loop).some((issue) => issue.includes("제자리"))).toBe(true);
    const self: TruthRules = { ...rules, statements: [{ speaker: "hana", text: "내 말은 거짓이다.", claim: { kind: "speakerLying", who: "hana" } }], trueCount: 1 };
    expect(auditTruth(self).some((issue) => issue.includes("제자리"))).toBe(true);
    const missing: TruthRules = { ...rules, statements: [{ speaker: "hana", text: "다온의 말은 참이다.", claim: { kind: "speakerTruthful", who: "daon" } }], trueCount: 1 };
    expect(auditTruth(missing).some((issue) => issue.includes("진술이 없다"))).toBe(true);
    const twice: TruthRules = { ...rules, statements: [rules.statements[0], rules.statements[0]], trueCount: 1 };
    expect(auditTruth(twice)).toContain("한 사람이 두 번 진술한다");
  });
});

describe("순서: 새 조건", () => {
  const order = ["hana", "junho", "sera", "daon", "doyun"];

  it("사이에 정확히 몇 명, 자리 가운데 하나, 두 사람 사이", () => {
    expect(constraintHolds({ kind: "gap", a: "hana", b: "sera", between: 1, text: "" }, order)).toBe(true);
    expect(constraintHolds({ kind: "gap", a: "sera", b: "hana", between: 1, text: "" }, order)).toBe(true);
    expect(constraintHolds({ kind: "gap", a: "hana", b: "junho", between: 1, text: "" }, order)).toBe(false);
    expect(constraintHolds({ kind: "gap", a: "hana", b: "doyun", between: 3, text: "" }, order)).toBe(true);
    expect(constraintHolds({ kind: "slotAmong", who: "doyun", slots: [0, 4], text: "" }, order)).toBe(true);
    expect(constraintHolds({ kind: "slotAmong", who: "sera", slots: [0, 4], text: "" }, order)).toBe(false);
    expect(constraintHolds({ kind: "between", who: "junho", a: "hana", b: "daon", text: "" }, order)).toBe(true);
    expect(constraintHolds({ kind: "between", who: "junho", a: "daon", b: "hana", text: "" }, order)).toBe(true);
    expect(constraintHolds({ kind: "between", who: "hana", a: "junho", b: "daon", text: "" }, order)).toBe(false);
  });

  it("다섯 명의 순서도 전수 탐색한다", () => {
    const rules: ScheduleRules = {
      people: [hana, junho, sera, daon, doyun],
      slots: ["1번", "2번", "3번", "4번", "5번"].map((label, i) => ({ label, ordinal: `${i + 1}번째` })),
      constraints: [{ kind: "slotAmong", who: "hana", slots: [0], text: "" }],
    };
    expect(solveSchedule(rules)).toHaveLength(24);
    expect(auditSchedule(rules)).toEqual([]);
  });

  it("없는 사람·자리를 가리키는 조건을 잡아낸다", () => {
    const rules: ScheduleRules = {
      people: [hana, junho, sera, daon],
      slots: ["9시", "10시", "11시", "12시"].map((label, i) => ({ label, ordinal: `${i + 1}번째` })),
      constraints: [],
    };
    expect(auditSchedule({ ...rules, constraints: [{ kind: "gap", a: "hana", b: "doyun", between: 1, text: "" }] })).toHaveLength(1);
    expect(auditSchedule({ ...rules, constraints: [{ kind: "gap", a: "hana", b: "junho", between: 3, text: "" }] })).toHaveLength(1);
    expect(auditSchedule({ ...rules, constraints: [{ kind: "slotAmong", who: "hana", slots: [4], text: "" }] })).toHaveLength(1);
    expect(auditSchedule({ ...rules, constraints: [{ kind: "between", who: "hana", a: "hana", b: "junho", text: "" }] })).toHaveLength(1);
    expect(auditSchedule({ ...rules, people: [hana, junho, sera] })).toContain("사람의 수와 자리의 수가 다르다");
  });
});
