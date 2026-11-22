import { describe, expect, it } from "vitest";
import { DAILY_TRUTH_1 } from "../data/dailySet";
import { daon, doyun, hana, harin, junho, minjae, sea, sera } from "../data/people";
import { PRACTICE_TRUTH } from "../data/puzzles";
import { EXAM_TRUTH_A_S, EXAM_TRUTH_B_A, EXAM_TRUTH_D_C, PRACTICE_TRUTH_B, PRACTICE_TRUTH_D, TRUTH_SET } from "../data/sets/truth";
import { checkAnswer, countTrue, evalTruthClaim, solveTruth, truthValues, verifyGuidance, verifyPuzzle } from "../engine/puzzleValidator";
import type { Person, TruthClaim, TruthPuzzle, TruthRules, TruthStatement } from "../engine/types";

/**
 * 진술 추리 5문제 (GATE 05).
 *
 * 지시의 표에서 벗어난 곳 하나: 가리키는 진술 둘이 "서로 다른 사실 진술을 하나씩" 가리키는 모양(갑 → 병, 을 → 정)은
 * 답이 하나이면서 네 가정의 무늬가 모두 다른 세트가 없다(아래 "짝 모양은 쓸 수 없다" 테스트가 전수로 확인한다).
 * 그래서 가리키는 진술 둘은 두 모양으로 나눴다: 한 사람의 말을 두고 두 사람이 입을 모으는 모양(B→A)과
 * 갑 → 을 → 사실의 사슬(A→S). 두 단계를 따라가야 하는 사슬이 더 어려워 높은 시험에 놓았다.
 */

const CAST: Person[] = [hana, junho, sera, daon, doyun, minjae, sea, harin];
const EXISTING_TITLES = [
  "자료실 금고의 암호",
  "사라진 시험 답안지",
  "발표 순서 재구성",
  "사라진 자료실 열쇠",
  "추천서의 인장",
  "다시 잠긴 금고",
  "숨겨진 출석부",
  "비어 있던 진열장",
  "찢어진 면담 순서표",
  "다시 붙은 봉투의 인장",
];

const ids = (rules: TruthRules) => rules.people.map((p) => p.id);
/** 가정(숨긴 사람)마다 네 진술의 참·거짓 */
const table = (rules: TruthRules) => ids(rules).map((id) => truthValues(rules, id));
const counts = (rules: TruthRules) => ids(rules).map((id) => countTrue(rules, id));
/** 한 사람의 진술이 가정마다 어떤 값인가 */
const column = (rules: TruthRules, speaker: string) => {
  const at = rules.statements.findIndex((s) => s.speaker === speaker);
  return table(rules).map((row) => row[at]);
};
const isMeta = (claim: TruthClaim) => claim.kind === "speakerTruthful" || claim.kind === "speakerLying";

/** 가리키는 진술의 모양: 없음 / 하나 / 같은 사람을 가리킴(fan) / 꼬리를 묾(chain) / 따로따로(pairs) */
function metaShape(rules: TruthRules): string {
  const metas = rules.statements.filter((s) => isMeta(s.claim)).map((s) => ({ from: s.speaker, to: (s.claim as { who: string }).who }));
  if (metas.length === 0) return "none";
  if (metas.length === 1) return "single";
  if (metas.length > 2) return "many";
  if (metas.some((m) => metas.some((n) => n.from === m.to))) return "chain";
  return metas[0].to === metas[1].to ? "fan" : "pairs";
}

/** 진술 종류의 조합. 자기 부인("나는 숨기지 않았다")은 남에 대한 부인과 따로 센다. */
function kinds(rules: TruthRules): string {
  return rules.statements
    .map((s) => (s.claim.kind === "culpritIsNot" && s.claim.who === s.speaker ? "denySelf" : s.claim.kind))
    .sort()
    .join("+");
}

/**
 * 진술 하나를 가리고(참인지 거짓인지 모른다고 하고) 참의 수가 맞을 수 있는 가정을 모두 돌려준다.
 * 가린 진술을 가리키는 말은 그 값을 따라간다. 하나만 남으면 그 진술은 없어도 되는 군더더기다.
 */
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

const each = TRUTH_SET.map((p) => [p.id, p] as const);

describe("진술 추리 5문제: 표의 칸", () => {
  it("다섯 문제가 표의 순서대로 놓여 있다", () => {
    expect(TRUTH_SET.map((p) => [p.id, p.category, p.rank, p.reward, p.hints.length])).toEqual([
      ["practice-truth-d", "practice", "D", 35, 2],
      ["exam-truth-d-c", "exam", "D", 0, 2],
      ["practice-truth-b", "practice", "B", 45, 2],
      ["exam-truth-b-a", "exam", "B", 0, 0],
      ["exam-truth-a-s", "exam", "A", 0, 0],
    ]);
    expect(TRUTH_SET).toEqual([PRACTICE_TRUTH_D, EXAM_TRUTH_D_C, PRACTICE_TRUTH_B, EXAM_TRUTH_B_A, EXAM_TRUTH_A_S]);
    expect(TRUTH_SET.every((p) => p.type === "truth" && p.typeLabel === PRACTICE_TRUTH.typeLabel)).toBe(true);
    expect(TRUTH_SET.map((p) => p.difficulty)).toEqual([2, 3, 4, 4, 5]);
  });

  it("제목·숨긴 물건·숨긴 사람이 서로, 그리고 기존 문제와 겹치지 않는다", () => {
    const titles = TRUTH_SET.map((p) => p.title);
    expect(new Set([...titles, ...EXISTING_TITLES]).size).toBe(titles.length + EXISTING_TITLES.length);
    const items = [...TRUTH_SET.map((p) => p.rules.item), PRACTICE_TRUTH.rules.item ?? "답안지", DAILY_TRUTH_1.rules.item];
    expect(items.every(Boolean)).toBe(true);
    expect(new Set(items).size).toBe(items.length);
    expect(new Set(TRUTH_SET.map((p) => p.solution)).size).toBe(TRUTH_SET.length);
  });
});

describe("진술 추리 5문제: 정답과 풀이", () => {
  it.each(each)("%s: 정답이 정확히 하나이고 짜임새에 문제가 없다", (_id, puzzle) => {
    const result = verifyPuzzle(puzzle);
    expect(result.issues).toEqual([]);
    expect(result.solutions).toEqual([puzzle.solution]);
    expect(result.matchesDeclared).toBe(true);
    expect(result.ok).toBe(true);
    // 후보는 네 명이다(찍으면 넷 중 하나)
    expect(result.candidateCount).toBe(4);
  });

  it.each(each)("%s: 힌트와 해설이 규칙과 맞고, 힌트만으로 답이 드러나지 않는다", (_id, puzzle) => {
    const result = verifyGuidance(puzzle);
    expect(result.issues).toEqual([]);
    expect(result.candidatesAfterHints).toBeGreaterThanOrEqual(2);
    expect(puzzle.explanation.length).toBeGreaterThanOrEqual(3);
    // 해설은 정답에서의 사실을 적어도 하나는 단정한다
    expect(puzzle.explanation.flatMap((step) => step.facts).length).toBeGreaterThanOrEqual(3);
  });

  it.each(each)("%s: 정답만 정답으로 채점된다", (_id, puzzle) => {
    const accepted = ids(puzzle.rules).filter((id) => checkAnswer(puzzle, id));
    expect(accepted).toEqual([puzzle.solution]);
    expect(checkAnswer(puzzle, null)).toBe(false);
    expect(checkAnswer(puzzle, "hana")).toBe(false);
    expect(checkAnswer(puzzle, [puzzle.solution])).toBe(false);
  });

  it("가정마다 참의 수 (해설의 글이 말하는 수)", () => {
    // 사람의 순서는 문제에 적힌 순서
    expect(ids(PRACTICE_TRUTH_D.rules)).toEqual(["junho", "sera", "daon", "harin"]);
    expect(counts(PRACTICE_TRUTH_D.rules)).toEqual([1, 2, 3, 2]);
    expect(ids(EXAM_TRUTH_D_C.rules)).toEqual(["doyun", "sea", "daon", "minjae"]);
    expect(counts(EXAM_TRUTH_D_C.rules)).toEqual([3, 3, 0, 1]);
    expect(ids(PRACTICE_TRUTH_B.rules)).toEqual(["minjae", "harin", "sera", "doyun"]);
    expect(counts(PRACTICE_TRUTH_B.rules)).toEqual([4, 2, 3, 3]);
    expect(ids(EXAM_TRUTH_B_A.rules)).toEqual(["junho", "sea", "harin", "daon"]);
    expect(counts(EXAM_TRUTH_B_A.rules)).toEqual([3, 1, 2, 2]);
    expect(ids(EXAM_TRUTH_A_S.rules)).toEqual(["minjae", "daon", "sera", "doyun"]);
    expect(counts(EXAM_TRUTH_A_S.rules)).toEqual([2, 1, 2, 3]);
  });
});

describe("진술 추리 5문제: 품질", () => {
  it.each(each)("%s: 네 가정의 참·거짓 무늬가 모두 다르고, 늘 같은 값인 진술이 없다", (_id, puzzle) => {
    const rows = table(puzzle.rules).map((row) => row.map((v) => (v ? "T" : "F")).join(""));
    expect(new Set(rows).size).toBe(4);
    puzzle.rules.statements.forEach((s) => {
      expect(new Set(column(puzzle.rules, s.speaker)).size).toBe(2);
    });
    // 오답인 세 가정이 모두 같은 수로 떨어지지는 않는다
    const wrong = counts(puzzle.rules).filter((_, i) => ids(puzzle.rules)[i] !== puzzle.solution);
    expect(new Set(wrong).size).toBeGreaterThanOrEqual(2);
  });

  it.each(each)("%s: 군더더기 진술이 없다(어느 진술을 가려도 답이 하나로 정해지지 않는다)", (_id, puzzle) => {
    puzzle.rules.statements.forEach((_, hidden) => {
      const possible = possibleWithout(puzzle.rules, hidden);
      expect(possible).toContain(puzzle.solution);
      expect(possible.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("가리지 않으면 답은 하나다(위 점검의 기준선)", () => {
    for (const puzzle of TRUTH_SET) expect(solveTruth(puzzle.rules)).toEqual([puzzle.solution]);
  });

  it("푸는 길이 서로, 그리고 기존 두 문제와 다르다: 참의 수 · 진술 종류의 조합 · 가리키는 진술의 모양", () => {
    const all: TruthPuzzle[] = [PRACTICE_TRUTH, DAILY_TRUTH_1, ...TRUTH_SET];
    // 진술 종류의 조합만으로도 일곱 문제가 모두 다르다
    expect(new Set(all.map((p) => kinds(p.rules))).size).toBe(all.length);
    expect(TRUTH_SET.map((p) => [p.rules.trueCount, metaShape(p.rules)])).toEqual([
      [3, "none"],
      [1, "none"],
      [2, "single"],
      [1, "fan"],
      [3, "chain"],
    ]);
    expect([PRACTICE_TRUTH, DAILY_TRUTH_1].map((p) => [p.rules.trueCount, metaShape(p.rules)])).toEqual([
      [1, "none"],
      [2, "none"],
    ]);
    // 참의 수가 같은 문제끼리는 가리키는 진술의 모양이나 진술 종류가 다르다
    expect(new Set(all.map((p) => `${p.rules.trueCount}|${metaShape(p.rules)}|${kinds(p.rules)}`)).size).toBe(all.length);
    expect(kinds(PRACTICE_TRUTH_D.rules)).toBe("culpritAmong+culpritAmong+culpritIs+culpritIsNot");
    expect(kinds(EXAM_TRUTH_D_C.rules)).toBe("culpritAmong+culpritIs+culpritIs+denySelf");
    expect(kinds(PRACTICE_TRUTH_B.rules)).toBe("culpritIsNot+culpritIsNot+culpritIsNot+speakerTruthful");
    expect(kinds(EXAM_TRUTH_B_A.rules)).toBe("culpritAmong+culpritAmong+speakerLying+speakerLying");
    expect(kinds(EXAM_TRUTH_A_S.rules)).toBe("culpritAmong+culpritAmong+speakerLying+speakerTruthful");
  });

  it("짝 모양(갑 → 병, 을 → 정)은 쓸 수 없다: 답이 하나이면서 네 가정의 무늬가 모두 다른 세트가 없다", () => {
    const people: Person[] = ["a", "b", "c", "d"].map((id) => ({ id, name: id, color: "#000", mark: "circle" }));
    const facts = (self: string): TruthClaim[] => {
      const others = ["a", "b", "c", "d"].filter((id) => id !== self);
      return [
        ...others.map((who): TruthClaim => ({ kind: "culpritIs", who })),
        ...["a", "b", "c", "d"].map((who): TruthClaim => ({ kind: "culpritIsNot", who })),
        ...others.flatMap((x, i) => others.slice(i + 1).map((y): TruthClaim => ({ kind: "culpritAmong", who: [x, y] }))),
      ];
    };
    const metas = (who: string): TruthClaim[] => [
      { kind: "speakerTruthful", who },
      { kind: "speakerLying", who },
    ];
    let tried = 0;
    let passed = 0;
    for (const ma of metas("c")) for (const mb of metas("d")) for (const fc of facts("c")) for (const fd of facts("d")) {
      const statements: TruthStatement[] = [ma, mb, fc, fd].map((claim, i) => ({ speaker: people[i].id, text: "", claim }));
      const rows = people.map((p) => truthValues({ people, statements, trueCount: 1 }, p.id));
      const distinct = new Set(rows.map((row) => row.join())).size === 4;
      for (const trueCount of [1, 2, 3]) {
        tried += 1;
        const unique = solveTruth({ people, statements, trueCount }).length === 1;
        if (unique && distinct) passed += 1;
      }
    }
    expect(tried).toBe(2 * 2 * 10 * 10 * 3);
    expect(passed).toBe(0);
  });
});

describe("진술 추리 5문제: 해설이 말하는 중간 사실", () => {
  it("연습 D: 준호와 다온의 말만 정면으로 맞서고, 세라와 하린의 말이 함께 참인 가정은 하나뿐이다", () => {
    const { rules } = PRACTICE_TRUTH_D;
    const speakers = rules.statements.map((s) => s.speaker);
    const opposed: string[] = [];
    speakers.forEach((x, i) =>
      speakers.slice(i + 1).forEach((y) => {
        const [cx, cy] = [column(rules, x), column(rules, y)];
        if (cx.every((v, h) => v !== cy[h])) opposed.push(`${x}-${y}`);
      }),
    );
    expect(opposed).toEqual(["junho-daon"]);
    const bothTrue = ids(rules).filter((_, h) => column(rules, "sera")[h] && column(rules, "harin")[h]);
    expect(bothTrue).toEqual(["daon"]);
    // 거짓말을 한 사람은 숨긴 사람이 아니다
    expect(truthValues(rules, "daon")).toEqual([false, true, true, true]);
  });

  it("시험 D→C: 서로 지목한 둘 중 누가 숨겼어도 세 사람의 덩어리에서 참이 둘, 다온의 부인까지 셋이다", () => {
    const { rules } = EXAM_TRUTH_D_C;
    const trio = (h: number) => ["doyun", "sea", "minjae"].filter((speaker) => column(rules, speaker)[h]).length;
    expect(ids(rules).map((_, h) => trio(h))).toEqual([2, 2, 0, 0]);
    // 다온의 부인은 다온이 숨긴 경우에만 거짓이다
    expect(column(rules, "daon")).toEqual([true, true, false, true]);
    expect(truthValues(rules, "minjae")).toEqual([false, false, true, false]);
  });

  it("연습 B: 민재와 도윤의 말은 늘 함께 가고, 함께 참이면서 하린·세라의 말이 모두 거짓인 가정은 없다", () => {
    const { rules } = PRACTICE_TRUTH_B;
    expect(column(rules, "doyun")).toEqual(column(rules, "minjae"));
    const caseOne = table(rules).filter(([m, h, s, d]) => m && d && !h && !s);
    expect(caseOne).toEqual([]);
    // 함께 거짓인 가정은 하린이 숨긴 경우뿐이고, 그때 하린과 세라의 말이 참이다
    const bothFalse = ids(rules).filter((_, i) => !column(rules, "minjae")[i]);
    expect(bothFalse).toEqual(["harin"]);
    expect(truthValues(rules, "harin")).toEqual([false, true, true, false]);
    // 힌트 2: 민재가 숨겼다면 네 진술이 모두 참
    expect(truthValues(rules, "minjae")).toEqual([true, true, true, true]);
  });

  it("시험 B→A: 하린과 다온의 말은 늘 같고 준호의 말과는 늘 반대다", () => {
    const { rules } = EXAM_TRUTH_B_A;
    expect(column(rules, "harin")).toEqual(column(rules, "daon"));
    expect(column(rules, "harin")).toEqual(column(rules, "junho").map((v) => !v));
    // 참이 하나뿐이려면 준호의 말이 참이고 세아의 말이 거짓이어야 한다: 그런 가정은 세아뿐
    const fits = ids(rules).filter((_, h) => column(rules, "junho")[h] && !column(rules, "sea")[h]);
    expect(fits).toEqual(["sea"]);
    expect(truthValues(rules, "sea")).toEqual([true, false, false, false]);
  });

  it("시험 A→S: 세라의 말은 도윤의 말과 같고 민재의 말과 반대라, 세 사람의 참은 1개 아니면 2개다", () => {
    const { rules } = EXAM_TRUTH_A_S;
    expect(column(rules, "sera")).toEqual(column(rules, "doyun"));
    expect(column(rules, "doyun")).toEqual(column(rules, "minjae").map((v) => !v));
    const trio = ids(rules).map((_, h) => ["minjae", "sera", "doyun"].filter((speaker) => column(rules, speaker)[h]).length);
    expect(trio).toEqual([2, 1, 1, 2]);
    // 참이 셋이려면 민재의 말이 거짓이고 다온의 말이 참이어야 한다: 그런 가정은 도윤뿐
    const fits = ids(rules).filter((_, h) => !column(rules, "minjae")[h] && column(rules, "daon")[h]);
    expect(fits).toEqual(["doyun"]);
    // 숨긴 사람은 참말을 했고, 거짓말을 한 사람은 숨기지 않았다
    expect(truthValues(rules, "doyun")).toEqual([false, true, true, true]);
  });
});

describe("진술 추리 5문제: 글과 화면의 한계", () => {
  it.each(each)("%s: 사람 넷이 한 번씩 말하고, 진술의 글은 16자 이하다", (_id, puzzle) => {
    const { people, statements } = puzzle.rules;
    expect(people).toHaveLength(4);
    expect(statements.map((s) => s.speaker)).toEqual(people.map((p) => p.id));
    people.forEach((person) => expect(CAST).toContain(person));
    statements.forEach((s) => {
      expect([...s.text].length).toBeLessThanOrEqual(16);
      expect(s.text.endsWith("다.")).toBe(true);
    });
    // '하나'라는 이름은 "참은 하나뿐"과 헷갈리고, 세라와 세아는 이름이 닮아 한 문제에 함께 두지 않는다
    const names = people.map((p) => p.id);
    expect(names).not.toContain("hana");
    expect(names.includes("sera") && names.includes("sea")).toBe(false);
  });

  it.each(each)("%s: 문제 글이 참의 수를 분명히 적는다", (_id, puzzle) => {
    const phrase = { 1: "정확히 하나만 참", 2: "정확히 둘만 참", 3: "거짓은 하나뿐" }[puzzle.rules.trueCount as 1 | 2 | 3];
    expect(puzzle.description).toContain(phrase);
    expect(puzzle.description).toContain(puzzle.rules.item!);
    // 남의 말을 가리키는 진술이 있으면 그것도 센다고 알려 준다
    if (metaShape(puzzle.rules) !== "none") expect(puzzle.description).toContain("남의 말을 두고 한 말도 진술로 셉니다");
  });

  it.each(each)("%s: 사건을 여는 글과 닫는 글이 한두 문장이고 64자 이하다", (_id, puzzle) => {
    for (const text of [puzzle.intro, puzzle.outro]) {
      expect(text).toBeTruthy();
      expect(text!.split(/[.?!]\s/).length).toBeLessThanOrEqual(3);
      expect([...text!].length).toBeLessThanOrEqual(64);
    }
    expect(puzzle.minutes).toBeGreaterThanOrEqual(2);
    expect(puzzle.minutes).toBeLessThanOrEqual(6);
    // 닫는 글은 숨긴 사람의 이름을 밝힌다(해결한 뒤에만 보인다)
    const culprit = puzzle.rules.people.find((p) => p.id === puzzle.solution)!;
    expect(puzzle.outro).toContain(culprit.name);
    expect(puzzle.intro).not.toContain(culprit.name);
  });
});
