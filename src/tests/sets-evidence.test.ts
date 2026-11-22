import { beforeAll, describe, expect, it } from "vitest";
import { DAILY_EVIDENCE_1, DAILY_EVIDENCE_2 } from "../data/dailySet";
import * as cast from "../data/people";
import {
  EVIDENCE_SET,
  EXAM_EVIDENCE_A_S,
  EXAM_EVIDENCE_C_B,
  PRACTICE_EVIDENCE_A,
  PRACTICE_EVIDENCE_B,
  PRACTICE_EVIDENCE_D,
} from "../data/sets/evidence";
import {
  allCards,
  auditEvidence,
  contradicts,
  derivationPath,
  deriveFrom,
  entailedPositions,
  entails,
  satisfiable,
  solveEvidence,
  type EvidenceAudit,
} from "../engine/evidence";
import { checkAnswer, verifyGuidance, verifyPuzzle, type GuidanceVerification, type PuzzleVerification } from "../engine/puzzleValidator";
import type { EvidenceClaim, EvidencePuzzle, EvidenceRules } from "../engine/types";
import { evidencePair, readiness, toAnswer } from "../games/logic";

/**
 * 증거 조합 다섯 문제 (GATE 05)의 검증.
 * 전수 탐색은 무거우므로(네 사람 × 세 시각이면 세계가 53만 개) 문제마다 한 번만 돌려 두고 여러 테스트가 나눠 쓴다.
 */

const SLOTS = [
  { puzzle: PRACTICE_EVIDENCE_D, id: "practice-evidence-d", category: "practice", rank: "D", difficulty: 2, reward: 35, hints: 2, depth: 1, candidates: 15 },
  { puzzle: EXAM_EVIDENCE_C_B, id: "exam-evidence-c-b", category: "exam", rank: "C", difficulty: 3, reward: 0, hints: 2, depth: 1, candidates: 12 },
  { puzzle: PRACTICE_EVIDENCE_B, id: "practice-evidence-b", category: "practice", rank: "B", difficulty: 4, reward: 45, hints: 2, depth: 2, candidates: 24 },
  { puzzle: PRACTICE_EVIDENCE_A, id: "practice-evidence-a", category: "practice", rank: "A", difficulty: 5, reward: 50, hints: 2, depth: 3, candidates: 32 },
  { puzzle: EXAM_EVIDENCE_A_S, id: "exam-evidence-a-s", category: "exam", rank: "A", difficulty: 5, reward: 0, hints: 0, depth: 2, candidates: 28 },
] as const;

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

const each = EVIDENCE_SET.map((p) => [p.id, p] as const);

const claim = (puzzle: EvidencePuzzle, id: string): EvidenceClaim => {
  const card = allCards(puzzle.rules).find((c) => c.id === id);
  if (!card) throw new Error(`${puzzle.id}: 카드 ${id} 가 없다`);
  return card.claim;
};
const liar = (puzzle: EvidencePuzzle) => claim(puzzle, puzzle.solution.statement);
const baseFacts = (puzzle: EvidencePuzzle) => puzzle.rules.cards.filter((c) => c.kind !== "statement");
const statements = (puzzle: EvidencePuzzle) => puzzle.rules.cards.filter((c) => c.kind === "statement");
const at = (who: string, place: string, time: number): EvidenceClaim => ({ kind: "at", who, place, time });
const position = (who: string, place: string, time: number) => ({ who, place, time });

/** 정답에 이르는 길의 꼴: 잇는 두 증거의 주장 종류 → 얻는 사실의 종류, 그리고 거짓 진술의 종류 */
function signature(puzzle: EvidencePuzzle): string {
  const kind = (id: string) => claim(puzzle, id).kind;
  const links = derivationPath(puzzle.rules, puzzle.solution.against).map(
    (step) => `${step.from.map(kind).sort().join("+")}→${step.card.claim.kind}`,
  );
  return `${links.join(" / ")} ⊥ ${kind(puzzle.solution.statement)}`;
}

/** 처음의 증거 하나를 뺀 규칙. 남은 증거에서 출발해 더는 닿을 수 없는 사실도 함께 뺀다(되돌아가는 길끼리 서로를 살려 두지 않게). */
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

const audits = new Map<string, EvidenceAudit>();
const verified = new Map<string, PuzzleVerification>();
const guidance = new Map<string, GuidanceVerification>();

beforeAll(() => {
  for (const puzzle of EVIDENCE_SET) {
    audits.set(puzzle.id, auditEvidence(puzzle.rules));
    verified.set(puzzle.id, verifyPuzzle(puzzle));
    guidance.set(puzzle.id, verifyGuidance(puzzle));
  }
}, 120_000);

describe("증거 조합 다섯 문제 (GATE 05)", () => {
  it("표의 칸과 맞는다: 연습 D·B·A, 시험 C→B·A→S", () => {
    expect(EVIDENCE_SET).toHaveLength(5);
    expect(EVIDENCE_SET.map((p) => p.id)).toEqual(SLOTS.map((slot) => slot.id));
    for (const slot of SLOTS) {
      const { puzzle } = slot;
      expect(puzzle.id).toBe(slot.id);
      expect(puzzle.type).toBe("evidence");
      expect(puzzle.category).toBe(slot.category);
      expect(puzzle.rank).toBe(slot.rank);
      expect(puzzle.difficulty).toBe(slot.difficulty);
      expect(puzzle.reward).toBe(slot.reward);
      expect(puzzle.hints).toHaveLength(slot.hints);
      expect(puzzle.typeLabel).toBe(DAILY_EVIDENCE_1.typeLabel);
    }
    const titles = EVIDENCE_SET.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles.filter((title) => EXISTING_TITLES.includes(title))).toEqual([]);
  });

  it.each(each)("%s: 정답이 정확히 하나이고 잇기 표에 문제가 없다", (id, puzzle) => {
    const result = verified.get(id)!;
    expect(result.issues).toEqual([]);
    expect(result.solutions).toEqual([puzzle.solution]);
    expect(result.matchesDeclared).toBe(true);
    expect(result.ok).toBe(true);
    // 찍어서 맞히기 어렵다: 진술 × 증거(이어서 얻는 사실 포함)의 짝 수
    expect(result.candidateCount).toBe(SLOTS.find((slot) => slot.id === id)!.candidates);
    expect(result.candidateCount).toBeGreaterThanOrEqual(12);
  });

  it.each(each)("%s: 힌트와 해설이 규칙과 맞고, 힌트만으로 답이 드러나지 않는다", (id, puzzle) => {
    const result = guidance.get(id)!;
    expect(result.issues).toEqual([]);
    expect(result.candidatesAfterHints).toBeGreaterThanOrEqual(2);
    expect(puzzle.explanation.length).toBeGreaterThanOrEqual(3);
    puzzle.explanation.forEach((step) => expect(step.facts.length).toBeGreaterThanOrEqual(1));
    // 해설의 마지막 단계는 정답의 짝이 모순임을 말한다
    expect(puzzle.explanation[puzzle.explanation.length - 1].facts).toEqual([
      { kind: "contradicts", a: puzzle.solution.statement, b: puzzle.solution.against },
    ]);
    // 힌트는 모순인 짝을 가리키지 않는다
    for (const hint of puzzle.hints) expect(hint.facts.some((fact) => fact.kind === "contradicts")).toBe(false);
  });

  it.each(each)("%s: 사건을 여는 글과 닫는 글이 한두 문장이고 64자 이하다", (_id, puzzle) => {
    for (const text of [puzzle.intro, puzzle.outro]) {
      expect(text).toBeTruthy();
      expect(text!.split(/[.?!]\s/).length).toBeLessThanOrEqual(3);
      expect(text!.length).toBeLessThanOrEqual(64);
    }
    expect(puzzle.minutes).toBeGreaterThanOrEqual(2);
    expect(puzzle.minutes).toBeLessThanOrEqual(6);
    // 맞대어 보는 자리에 적히는 할 일: 기존 문제(80자)보다 한 줄 넘게 길어지지 않게
    expect(puzzle.description.length).toBeLessThanOrEqual(100);
  });

  it.each(each)("%s: 화면의 한계를 넘지 않는다", (_id, puzzle) => {
    const { rules } = puzzle;
    const derived = allCards(rules).filter((card) => card.kind === "derived");
    expect(statements(puzzle).length).toBeLessThanOrEqual(4);
    expect(baseFacts(puzzle).length).toBeLessThanOrEqual(5);
    expect(derived.length).toBeLessThanOrEqual(3);
    expect(rules.places).toHaveLength(3);
    expect(rules.times.length).toBeLessThanOrEqual(3);
    for (const card of allCards(rules)) {
      expect(card.label.length, `${card.id} 의 이름`).toBeLessThanOrEqual(6);
      expect(card.text.length, `${card.id} 의 글`).toBeLessThanOrEqual(40);
    }
    // 인물은 초상이 있는 여덟 명 가운데서만, 진술의 이름표는 "○○의 진술"
    const known = Object.values(cast);
    for (const person of rules.people) expect(known).toContainEqual(person);
    for (const card of statements(puzzle)) {
      const speaker = rules.people.find((p) => p.id === card.speaker)!;
      expect(card.label).toBe(`${speaker.name}의 진술`);
      expect(card.id).toBe(`say-${speaker.id}`);
    }
  });

  it.each(each)("%s: 기록 하나만으로는 거짓 진술이 깨지지 않는다(이어야 풀린다)", (id, puzzle) => {
    const audit = audits.get(id)!;
    expect(audit.issues).toEqual([]);
    expect(audit.needsDerivation).toBe(true);
    expect(audit.falseStatements).toEqual([puzzle.solution.statement]);
    expect(audit.depth).toBe(SLOTS.find((slot) => slot.id === id)!.depth);
    for (const card of baseFacts(puzzle)) expect(contradicts(puzzle.rules, liar(puzzle), card.claim), card.id).toBe(false);
  });

  it.each(each)(
    "%s: 표에 없는 짝을 이었을 때 '새로 알 수 있는 것이 없다'는 답이 거짓 진술에 대해서도 참이다",
    (_id, puzzle) => {
      // 정답의 증거를 뺀 나머지에서, 표에 없는 두 장이 함께 거짓 진술을 깨는 일이 없어야 한다(화면에 없는 지름길이 없다)
      const facts = allCards(puzzle.rules).filter((card) => card.kind !== "statement" && card.id !== puzzle.solution.against);
      for (let i = 0; i < facts.length; i++) {
        for (let j = i + 1; j < facts.length; j++) {
          if (deriveFrom(puzzle.rules, facts[i].id, facts[j].id)) continue;
          expect(satisfiable(puzzle.rules, [facts[i].claim, facts[j].claim, liar(puzzle)]), `${facts[i].id} + ${facts[j].id}`).toBe(true);
        }
      }
    },
    60_000,
  );

  it.each(each)(
    "%s: 정답에 이르는 길의 증거는 어느 것도 군더더기가 아니다(하나를 빼면 풀리지 않는다)",
    (_id, puzzle) => {
      const path = derivationPath(puzzle.rules, puzzle.solution.against);
      const base = new Set(puzzle.rules.cards.map((card) => card.id));
      const needed = [...new Set(path.flatMap((step) => step.from))].filter((cardId) => base.has(cardId));
      expect(needed.length).toBeGreaterThanOrEqual(2);
      for (const cardId of needed) {
        expect(solveEvidence(without(puzzle.rules, cardId)), `${cardId} 를 뺐을 때`).toEqual([]);
      }
    },
    60_000,
  );

  it.each(each)("%s: 화면의 조작으로 정답에 닿는다", (_id, puzzle) => {
    const have = new Set(puzzle.rules.cards.map((card) => card.id));
    for (let round = 0; round < 4; round++) {
      for (const a of [...have]) {
        for (const b of [...have]) {
          const card = a < b ? deriveFrom(puzzle.rules, a, b) : null;
          if (card) have.add(card.id);
        }
      }
    }
    expect(have.has(puzzle.solution.against)).toBe(true);
    const { statement, against } = puzzle.solution;
    expect(evidencePair(puzzle, [against, statement])).toEqual(puzzle.solution);
    const input = { type: "evidence" as const, picked: [statement, against], found: [...have].filter((id) => id.startsWith("fact-")) };
    expect(readiness(puzzle, input).ok).toBe(true);
    expect(toAnswer(puzzle, input)).toEqual(puzzle.solution);
    expect(checkAnswer(puzzle, puzzle.solution)).toBe(true);
    expect(checkAnswer(puzzle, { statement: against, against: statement })).toBe(false);
    // 참인 진술을 같은 증거와 짝지으면 오답이다
    for (const card of statements(puzzle)) {
      if (card.id !== statement) expect(checkAnswer(puzzle, { statement: card.id, against })).toBe(false);
    }
  });

  it("푸는 길이 서로, 그리고 기존 두 문제와 다르다", () => {
    const all = [DAILY_EVIDENCE_1, DAILY_EVIDENCE_2, ...EVIDENCE_SET];
    const signatures = all.map(signature);
    expect(signatures).toEqual([
      "at+together→at ⊥ stayed",
      "all+visited→at / at+count→alone ⊥ at",
      "empty+empty→all ⊥ alone",
      "count+together→all ⊥ at",
      "count+count→count / at+count→alone ⊥ together",
      "at+count→all / all+visited→at / at+together→at ⊥ at",
      "together+together→all / all+count→all ⊥ at",
    ]);
    expect(new Set(signatures).size).toBe(all.length);
    // 처음 잇는 두 장의 조합부터 일곱 문제가 모두 다르다(첫 실마리가 다르다)
    const first = signatures.map((s) => s.split("→")[0]);
    expect(new Set(first).size).toBe(all.length);
    // 잇는 횟수: 1 · 1 · 2 · 3 · 2
    expect(EVIDENCE_SET.map((p) => derivationPath(p.rules, p.solution.against).length)).toEqual([1, 1, 2, 3, 2]);
    // 거짓 진술의 꼴과 함정의 종류도 한 가지로 되풀이하지 않는다
    expect(new Set(EVIDENCE_SET.map((p) => liar(p).kind))).toEqual(new Set(["alone", "at", "together"]));
    const objects = EVIDENCE_SET.map((p) => baseFacts(p).filter((card) => card.kind === "object").length);
    expect(objects).toEqual([1, 0, 0, 2, 1]);
  });
});

describe("연습 D · 깨진 난초 화분: 빈 곳을 지운다", () => {
  const p = PRACTICE_EVIDENCE_D;

  it("두 곳이 비어 있었으니 세 사람은 모두 남은 한 곳에 있었다", () => {
    expect(p.rules.places.map((place) => place.name)).toEqual(["온실", "창고", "식당"]);
    for (const name of ["온실", "창고", "식당"]) expect(p.description).toContain(name);
    const positions = entailedPositions(p.rules, [claim(p, "lock"), claim(p, "check")]);
    expect(positions).toEqual([position("daon", "dining", 1), position("minjae", "dining", 1), position("sea", "dining", 1)]);
    // 어느 한쪽만으로는 아무의 자리도 정해지지 않는다
    expect(entailedPositions(p.rules, [claim(p, "lock")])).toEqual([]);
    expect(entailedPositions(p.rules, [claim(p, "check")])).toEqual([]);
  });

  it("'혼자였다'는 말은 빈 곳 기록 하나와는 함께 성립하지만 둘과는 성립하지 않는다", () => {
    expect(liar(p).kind).toBe("alone");
    expect(satisfiable(p.rules, [claim(p, "lock"), liar(p)])).toBe(true);
    expect(satisfiable(p.rules, [claim(p, "check"), liar(p)])).toBe(true);
    expect(satisfiable(p.rules, [claim(p, "lock"), claim(p, "check"), liar(p)])).toBe(false);
  });

  it("함정: 늦게 발견된 모종삽은 14:10의 일을 말해 주지 않는다. 세아의 말은 배식 기록과 맞는다", () => {
    expect(contradicts(p.rules, claim(p, "say-minjae"), claim(p, "trowel"))).toBe(false);
    expect(entailedPositions(p.rules, [claim(p, "trowel"), claim(p, "fact-all")])).not.toContainEqual(position("minjae", "greenhouse", 0));
    for (const card of statements(p)) expect(contradicts(p.rules, card.claim, claim(p, "trowel"))).toBe(false);
    expect(entails(p.rules, [claim(p, "say-sea")], claim(p, "meal"))).toBe(true);
  });
});

describe("시험 C→B · 찢겨 나간 고서의 한 쪽: 같이 있던 둘은 한 명뿐인 곳에 있을 수 없다", () => {
  const p = EXAM_EVIDENCE_C_B;

  it("가정이 무너진다: 하나가 음악실에 있었다면 준호도 있어야 하고, 그러면 한 명이 아니다", () => {
    expect(satisfiable(p.rules, [claim(p, "duty"), liar(p)])).toBe(true);
    expect(satisfiable(p.rules, [claim(p, "counter"), liar(p)])).toBe(true);
    expect(satisfiable(p.rules, [claim(p, "duty"), claim(p, "counter"), liar(p)])).toBe(false);
    for (const who of ["hana", "junho"]) {
      expect(entails(p.rules, [claim(p, "duty"), claim(p, "counter")], { kind: "notAt", who, place: "music", time: 1 })).toBe(true);
    }
  });

  it("세 사람뿐이었으니 음악실의 한 명은 하린이다", () => {
    expect(p.rules.people).toHaveLength(3);
    expect(p.description).toContain("세 사람뿐");
    expect(entailedPositions(p.rules, [claim(p, "duty"), claim(p, "counter")])).toEqual([position("harin", "music", 1)]);
    expect(entails(p.rules, [claim(p, "fact-pair")], claim(p, "say-harin"))).toBe(true);
  });

  it("함정: 열쇠 대장은 15:00의 기록이라 누구의 말도 깨지 못한다", () => {
    expect(claim(p, "key")).toEqual(at("hana", "music", 0));
    for (const card of statements(p)) expect(contradicts(p.rules, card.claim, claim(p, "key"))).toBe(false);
    for (const other of ["duty", "counter", "fact-pair"]) expect(deriveFrom(p.rules, "key", other)).toBeNull();
  });

  it("제한 시간이 있는 시험: 기록은 석 장, 시각은 둘, 이을 것은 하나뿐이다", () => {
    expect(baseFacts(p)).toHaveLength(3);
    expect(p.rules.times).toHaveLength(2);
    expect(p.rules.derivations).toHaveLength(1);
    expect(p.minutes).toBeLessThanOrEqual(3);
  });
});

describe("연습 B · 열려 있던 사감실 서랍: 전체 인원에서 빼기", () => {
  const p = PRACTICE_EVIDENCE_B;
  const one: EvidenceClaim = { kind: "count", place: "tower", time: 0, count: 1 };

  it("네 사람 가운데 도서관에 둘, 기숙사에 하나였으니 종탑에는 하나뿐이다", () => {
    expect(p.rules.people).toHaveLength(4);
    expect(p.description).toContain("네 사람뿐");
    for (const place of p.rules.places) expect(p.description).toContain(place.name);
    expect(claim(p, "fact-one")).toEqual(one);
    expect(entails(p.rules, [claim(p, "seats"), claim(p, "rollcall")], one)).toBe(true);
    expect(entails(p.rules, [claim(p, "seats")], one)).toBe(false);
    expect(entails(p.rules, [claim(p, "rollcall")], one)).toBe(false);
    // 인원만으로는 누구의 자리도 정해지지 않는다
    expect(entailedPositions(p.rules, [claim(p, "seats"), claim(p, "rollcall")])).toEqual([]);
  });

  it("그 한 사람이 세라이므로 종탑에는 세라 혼자였다. 출입 기록만으로는 혼자인지 알 수 없다", () => {
    expect(claim(p, "fact-alone")).toEqual({ kind: "alone", who: "sera", place: "tower", time: 0 });
    expect(entails(p.rules, [claim(p, "fact-one"), claim(p, "towerlog")], claim(p, "fact-alone"))).toBe(true);
    expect(entails(p.rules, [claim(p, "towerlog")], claim(p, "fact-alone"))).toBe(false);
    // 거짓말은 자기 자리가 아니라 누구와 있었는지에 대한 것이다
    expect(liar(p)).toEqual({ kind: "together", a: "harin", b: "sera", time: 0 });
    expect(contradicts(p.rules, liar(p), claim(p, "fact-one"))).toBe(false);
    expect(contradicts(p.rules, liar(p), claim(p, "fact-alone"))).toBe(true);
  });

  it("함정: 종탑 순찰 일지의 두 명은 21:20의 인원이다", () => {
    expect(p.rules.times).toEqual(["21:10", "21:20"]);
    expect(claim(p, "later")).toEqual({ kind: "count", place: "tower", time: 1, count: 2 });
    for (const card of statements(p)) expect(contradicts(p.rules, card.claim, claim(p, "later"))).toBe(false);
    for (const other of ["seats", "rollcall", "towerlog", "fact-one", "fact-alone"]) expect(deriveFrom(p.rules, "later", other)).toBeNull();
    // 21:20에는 정말로 하린이 세라 곁에 있었을 수 있다(그래서 그럴듯하다)
    expect(satisfiable(p.rules, [...baseFacts(p).map((c) => c.claim), { kind: "together", a: "harin", b: "sera", time: 1 }])).toBe(true);
  });
});

describe("연습 A · 비어 버린 꿀단지: 세 번 잇기", () => {
  const p = PRACTICE_EVIDENCE_A;

  it("인원수로 자리를 채운다: 식당의 세 명은 하나, 준호, 세아다", () => {
    expect(p.rules.people).toHaveLength(4);
    expect(p.description).toContain("네 사람뿐");
    expect(entailedPositions(p.rules, [claim(p, "meal"), claim(p, "rollcall")])).toEqual([
      position("hana", "dining", 1),
      position("junho", "dining", 1),
      position("sea", "dining", 1),
      position("minjae", "dorm", 1),
    ]);
    expect(entailedPositions(p.rules, [claim(p, "meal")])).toEqual([]);
  });

  it("물건의 때: 머리끈만으로는 때를 알 수 없고, 18:10에 식당에 있었다는 사실이 있어야 18:00으로 정해진다", () => {
    expect(entailedPositions(p.rules, [claim(p, "band")])).toEqual([]);
    expect(satisfiable(p.rules, [claim(p, "band"), at("hana", "kitchen", 1)])).toBe(true);
    expect(entailedPositions(p.rules, [claim(p, "fact-three"), claim(p, "band")])).toContainEqual(position("hana", "kitchen", 0));
    // 같이 있던 사람: 당번표만으로는 세아의 자리가 정해지지 않는다
    expect(entailedPositions(p.rules, [claim(p, "duty")])).toEqual([]);
    expect(entailedPositions(p.rules, [claim(p, "fact-hana"), claim(p, "duty")])).toContainEqual(position("sea", "kitchen", 0));
  });

  it("앞에서 얻은 사실이 있어야 다음 것이 나온다: 길은 셋이고 건너뛸 수 없다", () => {
    expect(derivationPath(p.rules, "fact-sea").map((step) => step.card.id)).toEqual(["fact-three", "fact-hana", "fact-sea"]);
    expect(deriveFrom(p.rules, "band", "duty")).toBeNull();
    expect(deriveFrom(p.rules, "fact-three", "duty")).toBeNull();
    expect(deriveFrom(p.rules, "meal", "band")).toBeNull();
    expect(satisfiable(p.rules, [claim(p, "band"), claim(p, "duty"), liar(p)])).toBe(true);
    expect(satisfiable(p.rules, [claim(p, "fact-three"), claim(p, "duty"), liar(p)])).toBe(true);
    // 되돌아가는 길을 이으면 이미 얻은 사실이 다시 나온다(새 카드가 생기지 않는다)
    expect(deriveFrom(p.rules, "fact-sea", "duty")?.id).toBe("fact-hana");
    expect(allCards(p.rules).filter((card) => card.kind === "derived")).toHaveLength(3);
  });

  it("함정: 앞치마는 18:10을 지워도 18:00과 18:20이 남아 때가 정해지지 않는다", () => {
    const given = [claim(p, "fact-three"), claim(p, "apron")];
    expect(entailedPositions(p.rules, given).filter((pos) => pos.who === "junho" && pos.place === "kitchen")).toEqual([]);
    expect(satisfiable(p.rules, [...given, at("junho", "kitchen", 0)])).toBe(true);
    expect(satisfiable(p.rules, [...given, at("junho", "kitchen", 2)])).toBe(true);
    expect(satisfiable(p.rules, [...given, at("junho", "kitchen", 1)])).toBe(false);
    expect(deriveFrom(p.rules, "fact-three", "apron")).toBeNull();
    expect(contradicts(p.rules, claim(p, "say-junho"), claim(p, "apron"))).toBe(false);
    // 준호의 말과 세아의 말은 같은 꼴("18:00에 기숙사")이지만, 기록과 어긋나는 것은 세아의 말뿐이다
    expect(claim(p, "say-junho")).toEqual(at("junho", "dorm", 0));
    expect(liar(p)).toEqual(at("sea", "dorm", 0));
  });
});

describe("시험 A→S · 금서 서가의 뜯긴 자물쇠: 둘은 될 수 있어도 셋은 안 된다", () => {
  const p = EXAM_EVIDENCE_A_S;

  it("같이 서명한 둘만으로는 아무것도 나오지 않는다: 그 둘이 천문대의 두 명일 수 있다", () => {
    expect(deriveFrom(p.rules, "patrol", "scope")).toBeNull();
    expect(deriveFrom(p.rules, "photo", "scope")).toBeNull();
    expect(entailedPositions(p.rules, [claim(p, "patrol"), claim(p, "scope")])).toEqual([]);
    expect(satisfiable(p.rules, [claim(p, "patrol"), claim(p, "scope"), liar(p)])).toBe(true);
    expect(satisfiable(p.rules, [claim(p, "photo"), claim(p, "scope"), liar(p)])).toBe(true);
  });

  it("셋이 한곳에 있었다는 사실을 먼저 얻어야 한다. 셋은 두 명뿐인 천문대에 있을 수 없다", () => {
    const trio = claim(p, "fact-trio");
    expect(entails(p.rules, [claim(p, "patrol"), claim(p, "photo")], { kind: "together", a: "junho", b: "daon", time: 1 })).toBe(true);
    expect(entails(p.rules, [claim(p, "patrol")], trio)).toBe(false);
    expect(entails(p.rules, [claim(p, "photo")], trio)).toBe(false);
    expect(contradicts(p.rules, liar(p), trio)).toBe(false);
    expect(satisfiable(p.rules, [trio, claim(p, "scope"), liar(p)])).toBe(false);
    for (const who of ["junho", "sera", "daon"]) {
      expect(entails(p.rules, [trio, claim(p, "scope")], { kind: "notAt", who, place: "observatory", time: 1 })).toBe(true);
    }
  });

  it("다섯 사람뿐이었으니 천문대의 두 명은 도윤과 하린이다", () => {
    expect(p.rules.people.map((person) => person.name)).toEqual(["준호", "세라", "다온", "도윤", "하린"]);
    for (const person of p.rules.people) expect(p.description).toContain(person.name);
    expect(entailedPositions(p.rules, [claim(p, "fact-trio"), claim(p, "scope")])).toEqual([
      position("doyun", "observatory", 1),
      position("harin", "observatory", 1),
    ]);
    // 진술하지 않는 사람(세라)은 기록에만 나온다
    expect(statements(p).map((card) => card.speaker)).toEqual(["junho", "daon", "doyun", "harin"]);
    expect(claim(p, "patrol")).toEqual({ kind: "together", a: "junho", b: "sera", time: 1 });
    expect(claim(p, "photo")).toEqual({ kind: "together", a: "sera", b: "daon", time: 1 });
  });

  it("모순처럼 보이지만 성립하는 진술이 둘이다", () => {
    // 다온: 장갑이 23:10에 천문대에서 나왔지만, 23:10에 도서관 앞에 있었다는 말은 성립한다(23:00에 두고 왔다)
    expect(claim(p, "glove")).toEqual({ kind: "visited", who: "daon", place: "observatory", until: 1 });
    expect(claim(p, "say-daon")).toEqual(at("daon", "library", 1));
    expect(contradicts(p.rules, claim(p, "say-daon"), claim(p, "glove"))).toBe(false);
    expect(entailedPositions(p.rules, [claim(p, "fact-away"), claim(p, "glove")])).toContainEqual(position("daon", "observatory", 0));
    expect(entailedPositions(p.rules, [claim(p, "glove")])).toEqual([]);
    // 도윤: 천문대의 둘 가운데 하나지만, 23:00에 기숙사에 있었다는 말은 다른 시각의 일이다
    expect(claim(p, "say-doyun")).toEqual(at("doyun", "dorm", 0));
    expect(contradicts(p.rules, claim(p, "say-doyun"), claim(p, "fact-away"))).toBe(false);
    // 두 진술 모두 기록 전체와 함께 성립한다
    const reliable = baseFacts(p).map((card) => card.claim);
    expect(satisfiable(p.rules, [...reliable, claim(p, "say-daon"), claim(p, "say-doyun"), claim(p, "say-harin")])).toBe(true);
  });

  it("힌트 없이 치르는 시험이다. 답에는 두 번 이으면 닿고, 세 번째 사실은 장갑의 때를 밝힐 뿐이다", () => {
    expect(p.hints).toEqual([]);
    expect(guidance.get(p.id)!.candidatesAfterHints).toBe(verified.get(p.id)!.candidateCount);
    expect(derivationPath(p.rules, p.solution.against).map((step) => step.card.id)).toEqual(["fact-trio", "fact-away"]);
    expect(contradicts(p.rules, liar(p), claim(p, "fact-daon"))).toBe(false);
    expect(p.rules.times).toEqual(["23:00", "23:10"]);
  });
});

describe("증거 조합의 점검이 실패를 잡아낸다 (새 문제로)", () => {
  it("되돌아가는 길을 표에서 빼면 '표에 없다'로 잡힌다", () => {
    const p = PRACTICE_EVIDENCE_A;
    const broken: EvidenceRules = { ...p.rules, derivations: p.rules.derivations.filter((d) => !(d.from[0] === "fact-sea" && d.from[1] === "duty")) };
    expect(auditEvidence(broken).issues.join(" ")).toContain("표에 없다");
  });

  it("인원이 한 사람 늘면 '전체 인원에서 빼기'가 성립하지 않아 잡힌다", () => {
    const p = PRACTICE_EVIDENCE_B;
    const crowded: EvidenceRules = { ...p.rules, people: [...p.rules.people, cast.hana] };
    expect(auditEvidence(crowded).issues.join(" ")).toContain("나오지 않는다");
  });

  it("함께 있던 둘을 셋으로 잇지 않고 바로 인원과 이으면 나오지 않는다고 잡힌다", () => {
    const p = EXAM_EVIDENCE_A_S;
    const shortcut: EvidenceRules = {
      ...p.rules,
      derivations: p.rules.derivations.map((d) => (d.card.id === "fact-away" ? { ...d, from: ["patrol", "scope"] as [string, string] } : d)),
    };
    expect(auditEvidence(shortcut).issues.join(" ")).toContain("나오지 않는다");
  });
});
