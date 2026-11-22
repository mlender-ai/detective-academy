/**
 * 문제 정답 검증기.
 *
 * 원칙: 문제 데이터에 적힌 solution 을 믿지 않는다.
 *  - solve*  : 가능한 모든 경우를 만들어 규칙을 적용하고, 조건을 만족하는 답을 전부 돌려준다.
 *  - verifyPuzzle : 답이 정확히 1개이고 선언된 정답과 같은지 확인한다.
 *  - checkAnswer  : 플레이어 답안을 '규칙'으로 채점한다 (선언된 정답과 문자열 비교하지 않는다).
 *  - verifyGuidance : 힌트·해설이 단정하는 사실이 실제 정답과 모순되지 않는지 확인한다.
 */
import {
  allCards,
  auditEvidence,
  cardOf,
  contradicts,
  deriveFrom,
  enumerateEvidence,
  evidenceAnswerHolds,
  satisfiable,
  solveEvidence,
} from "./evidence";
import { auditSpatial, enumerateSeals, sealAnswerHolds, solveSpatial } from "./seal";
import type {
  CodeCondition,
  CodeFact,
  CodeRules,
  EvidenceFact,
  EvidenceRules,
  EvidenceSolution,
  Puzzle,
  ScheduleConstraint,
  ScheduleFact,
  ScheduleRules,
  SpatialFact,
  SpatialSolution,
  TruthClaim,
  TruthFact,
  TruthRules,
} from "./types";

/* ───────── 공통 유틸 ───────── */

export function permutations<T>(items: readonly T[], length = items.length): T[][] {
  const out: T[][] = [];
  const used = new Array(items.length).fill(false);
  const current: T[] = [];
  const walk = () => {
    if (current.length === length) {
      out.push([...current]);
      return;
    }
    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      current.push(items[i]);
      walk();
      current.pop();
      used[i] = false;
    }
  };
  walk();
  return out;
}

const sameArray = <T,>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/* ───────── 암호 해독 ───────── */

/** 허용되는 모든 암호 조합 (서로 다른 숫자, 순서 있음) */
export function enumerateCodes(rules: CodeRules): number[][] {
  return permutations(rules.digits, rules.length);
}

/** 추측(guess)을 실제 암호(code)와 비교한 결과 */
export function scoreCodeGuess(code: readonly number[], guess: readonly number[]) {
  let match = 0;
  let inPlace = 0;
  guess.forEach((digit, i) => {
    if (code.includes(digit)) match += 1;
    if (code[i] === digit) inPlace += 1;
  });
  return { match, inPlace };
}

export function isCodeWellFormed(rules: CodeRules, code: readonly number[]): boolean {
  return (
    code.length === rules.length &&
    code.every((d) => rules.digits.includes(d)) &&
    new Set(code).size === code.length
  );
}

export function codeSatisfiesClues(rules: CodeRules, code: readonly number[]): boolean {
  return rules.clues.every((clue) => {
    const score = scoreCodeGuess(code, clue.guess);
    return score.match === clue.match && score.inPlace === clue.inPlace;
  });
}

export function codeConditionHolds(condition: CodeCondition, code: readonly number[]): boolean {
  switch (condition.kind) {
    case "sum":
      return code.reduce((total, digit) => total + digit, 0) === condition.value;
    case "greater":
      return code[condition.a] > code[condition.b];
    case "oddCount":
      return code.filter((digit) => digit % 2 === 1).length === condition.count;
  }
}

/** 시도 기록과 금고에 새겨진 조건을 모두 만족하는가 */
export function codeSatisfies(rules: CodeRules, code: readonly number[]): boolean {
  return codeSatisfiesClues(rules, code) && (rules.conditions ?? []).every((condition) => codeConditionHolds(condition, code));
}

export function solveCode(rules: CodeRules): number[][] {
  return enumerateCodes(rules).filter((code) => codeSatisfies(rules, code));
}

/** 암호 문제의 짜임새: 조건이 가리키는 자리가 있는가, 기록의 길이가 맞는가 */
export function auditCode(rules: CodeRules): string[] {
  const issues: string[] = [];
  rules.clues.forEach((clue, i) => {
    if (clue.guess.length !== rules.length) issues.push(`기록 ${i + 1}의 길이가 암호와 다르다`);
    if (new Set(clue.guess).size !== clue.guess.length) issues.push(`기록 ${i + 1}에 같은 숫자가 겹친다`);
    if (!clue.guess.every((digit) => rules.digits.includes(digit))) issues.push(`기록 ${i + 1}에 쓸 수 없는 숫자가 있다`);
  });
  (rules.conditions ?? []).forEach((condition, i) => {
    if (condition.kind === "greater") {
      const ok = [condition.a, condition.b].every((at) => Number.isInteger(at) && at >= 0 && at < rules.length);
      if (!ok || condition.a === condition.b) issues.push(`조건 ${i + 1}이 없는 자리를 가리킨다`);
    }
    if (condition.kind === "oddCount" && (condition.count < 0 || condition.count > rules.length)) {
      issues.push(`조건 ${i + 1}의 홀수 개수가 자릿수를 벗어난다`);
    }
  });
  return issues;
}

export function codeFactHolds(fact: CodeFact, code: readonly number[]): boolean {
  switch (fact.kind) {
    case "absent":
      return fact.digits.every((d) => !code.includes(d));
    case "present":
      return code.includes(fact.digit);
    case "at":
      return code[fact.position] === fact.digit;
    case "notAt":
      return code[fact.position] !== fact.digit;
  }
}

/* ───────── 거짓 진술 찾기 ───────── */

/**
 * 진술 하나의 참/거짓. 남의 말을 가리키는 진술은 그 사람의 진술을 먼저 따진다(saidBy).
 * 가리키는 진술이 없으면 거짓으로 본다(그런 문제는 auditTruth 가 걸러 낸다).
 */
export function evalTruthClaim(claim: TruthClaim, culprit: string, saidBy?: (speaker: string) => boolean | null): boolean {
  switch (claim.kind) {
    case "culpritIs":
      return culprit === claim.who;
    case "culpritIsNot":
      return culprit !== claim.who;
    case "culpritAmong":
      return claim.who.includes(culprit);
    case "speakerTruthful":
      return saidBy?.(claim.who) === true;
    case "speakerLying":
      return saidBy?.(claim.who) === false;
  }
}

/** culprit 이 범인일 때 각 진술의 참/거짓 (statements 순서) */
export function truthValues(rules: TruthRules, culprit: string): boolean[] {
  const memo = new Map<string, boolean | null>();
  const saidBy = (speaker: string): boolean | null => {
    if (memo.has(speaker)) return memo.get(speaker)!;
    const statement = rules.statements.find((s) => s.speaker === speaker);
    if (!statement) return null;
    memo.set(speaker, null); // 서로 물고 물리면 여기서 끊긴다
    const value = evalTruthClaim(statement.claim, culprit, saidBy);
    memo.set(speaker, value);
    return value;
  };
  return rules.statements.map((s) => saidBy(s.speaker) === true);
}

/** 진술 문제의 짜임새: 한 사람은 한 번만 말하고, 남의 말을 가리키는 진술은 끝이 있어야 한다 */
export function auditTruth(rules: TruthRules): string[] {
  const issues: string[] = [];
  const ids = new Set(rules.people.map((p) => p.id));
  const bySpeaker = new Map(rules.statements.map((s) => [s.speaker, s]));
  if (bySpeaker.size !== rules.statements.length) issues.push("한 사람이 두 번 진술한다");
  const refers = (claim: TruthClaim) => (claim.kind === "speakerTruthful" || claim.kind === "speakerLying" ? claim.who : null);
  for (const statement of rules.statements) {
    if (!ids.has(statement.speaker)) issues.push(`없는 사람 ${statement.speaker} 이 진술한다`);
    const named = statement.claim.kind === "culpritAmong" ? statement.claim.who : [statement.claim.who];
    named.forEach((who) => {
      if (!ids.has(who)) issues.push(`${statement.speaker} 의 진술이 없는 사람 ${who} 을 가리킨다`);
    });
    // 가리키는 말을 따라가다 자기에게 돌아오면 참·거짓을 정할 수 없다
    const seen = new Set<string>([statement.speaker]);
    let next = refers(statement.claim);
    while (next) {
      if (!bySpeaker.has(next)) {
        issues.push(`${statement.speaker} 의 진술이 가리키는 ${next} 의 진술이 없다`);
        break;
      }
      if (seen.has(next)) {
        issues.push(`${statement.speaker} 의 진술이 돌고 돌아 제자리로 온다`);
        break;
      }
      seen.add(next);
      next = refers(bySpeaker.get(next)!.claim);
    }
  }
  if (rules.trueCount < 0 || rules.trueCount > rules.statements.length) issues.push("참인 진술의 수가 진술의 수를 벗어난다");
  return issues;
}

export function countTrue(rules: TruthRules, culprit: string): number {
  return truthValues(rules, culprit).filter(Boolean).length;
}

export function solveTruth(rules: TruthRules): string[] {
  return rules.people
    .map((p) => p.id)
    .filter((id) => countTrue(rules, id) === rules.trueCount);
}

export function truthFactHolds(
  fact: TruthFact,
  rules: TruthRules,
  culprit: string,
): boolean {
  switch (fact.kind) {
    case "statementIs": {
      const index = rules.statements.findIndex((s) => s.speaker === fact.speaker);
      return index >= 0 && truthValues(rules, culprit)[index] === fact.value;
    }
    case "culpritIsNot":
      return culprit !== fact.who;
    case "trueCountIf":
      // 가정에 대한 사실이므로 실제 범인과 무관하게 규칙만으로 판정한다.
      return countTrue(rules, fact.culprit) === fact.count;
  }
}

/* ───────── 발표 순서 재구성 ───────── */

export function constraintHolds(c: ScheduleConstraint, order: readonly string[]): boolean {
  switch (c.kind) {
    case "before":
      return order.indexOf(c.a) < order.indexOf(c.b);
    case "notAtSlot":
      return order.indexOf(c.who) !== c.slot;
    case "immediatelyAfter":
      return order.indexOf(c.who) === order.indexOf(c.after) + 1;
    case "notAdjacent":
      return Math.abs(order.indexOf(c.a) - order.indexOf(c.b)) !== 1;
    case "gap":
      return Math.abs(order.indexOf(c.a) - order.indexOf(c.b)) === c.between + 1;
    case "slotAmong":
      return c.slots.includes(order.indexOf(c.who));
    case "between": {
      const [at, a, b] = [order.indexOf(c.who), order.indexOf(c.a), order.indexOf(c.b)];
      return Math.min(a, b) < at && at < Math.max(a, b);
    }
  }
}

/** 순서 문제의 짜임새: 사람과 자리의 수가 같고, 조건이 있는 사람·자리를 가리킨다 */
export function auditSchedule(rules: ScheduleRules): string[] {
  const issues: string[] = [];
  const ids = new Set(rules.people.map((p) => p.id));
  if (rules.people.length !== rules.slots.length) issues.push("사람의 수와 자리의 수가 다르다");
  const slotOk = (slot: number) => Number.isInteger(slot) && slot >= 0 && slot < rules.slots.length;
  rules.constraints.forEach((c, i) => {
    const named =
      c.kind === "before" || c.kind === "notAdjacent" || c.kind === "gap"
        ? [c.a, c.b]
        : c.kind === "immediatelyAfter"
          ? [c.who, c.after]
          : c.kind === "between"
            ? [c.who, c.a, c.b]
            : [c.who];
    if (!named.every((id) => ids.has(id)) || new Set(named).size !== named.length) issues.push(`조건 ${i + 1}이 가리키는 사람이 맞지 않는다`);
    if (c.kind === "notAtSlot" && !slotOk(c.slot)) issues.push(`조건 ${i + 1}이 없는 자리를 가리킨다`);
    if (c.kind === "slotAmong" && (c.slots.length === 0 || !c.slots.every(slotOk))) issues.push(`조건 ${i + 1}이 없는 자리를 가리킨다`);
    if (c.kind === "gap" && (c.between < 1 || c.between > rules.slots.length - 2)) issues.push(`조건 ${i + 1}의 사이 인원이 맞지 않는다`);
  });
  return issues;
}

export function isOrderWellFormed(rules: ScheduleRules, order: readonly string[]): boolean {
  const ids = rules.people.map((p) => p.id);
  return (
    order.length === rules.slots.length &&
    new Set(order).size === order.length &&
    order.every((id) => ids.includes(id))
  );
}

export function orderSatisfies(rules: ScheduleRules, order: readonly string[]): boolean {
  return rules.constraints.every((c) => constraintHolds(c, order));
}

export function solveSchedule(rules: ScheduleRules): string[][] {
  return permutations(
    rules.people.map((p) => p.id),
    rules.slots.length,
  ).filter((order) => orderSatisfies(rules, order));
}

export function scheduleFactHolds(fact: ScheduleFact, order: readonly string[]): boolean {
  switch (fact.kind) {
    case "adjacent":
      return order.indexOf(fact.second) === order.indexOf(fact.first) + 1;
    case "slotAmong":
      return fact.slots.includes(order.indexOf(fact.who));
    case "slotNot":
      return order.indexOf(fact.who) !== fact.slot;
    case "slotIs":
      return order.indexOf(fact.who) === fact.slot;
  }
}

/* ───────── 증거 조합 ───────── */

const isEvidenceAnswer = (answer: unknown): answer is EvidenceSolution =>
  !!answer &&
  typeof answer === "object" &&
  typeof (answer as EvidenceSolution).statement === "string" &&
  typeof (answer as EvidenceSolution).against === "string";

export function evidenceFactHolds(fact: EvidenceFact, rules: EvidenceRules): boolean {
  const claim = (id: string) => cardOf(rules, id)?.claim;
  switch (fact.kind) {
    case "derives":
      return deriveFrom(rules, fact.from[0], fact.from[1])?.id === fact.card;
    case "consistent": {
      const [a, b] = [claim(fact.a), claim(fact.b)];
      return !!a && !!b && !contradicts(rules, a, b);
    }
    case "contradicts": {
      const [a, b] = [claim(fact.a), claim(fact.b)];
      return !!a && !!b && contradicts(rules, a, b);
    }
    case "statementHolds": {
      const statement = claim(fact.statement);
      const reliable = rules.cards.filter((card) => card.kind !== "statement").map((card) => card.claim);
      return !!statement && satisfiable(rules, [...reliable, statement]);
    }
  }
}

/** 이 사실이 어떤 답안(진술 + 증거)을 후보에서 지우는가 */
function evidenceFactExcludes(fact: EvidenceFact, answer: EvidenceSolution): boolean {
  const pair = (a: string, b: string) =>
    (answer.statement === a && answer.against === b) || (answer.statement === b && answer.against === a);
  switch (fact.kind) {
    case "statementHolds":
      return answer.statement === fact.statement;
    case "consistent":
      return pair(fact.a, fact.b);
    case "contradicts":
      // 모순인 짝을 그대로 알려 주면 그 짝만 남는다
      return !pair(fact.a, fact.b);
    case "derives":
      return false;
  }
}

/* ───────── 공간 추론 · 인장 대조 ───────── */

const isSpatialAnswer = (answer: unknown): answer is SpatialSolution =>
  !!answer &&
  typeof answer === "object" &&
  typeof (answer as SpatialSolution).stamp === "string" &&
  typeof (answer as SpatialSolution).turn === "number";

export function spatialFactHolds(fact: SpatialFact, answer: SpatialSolution): boolean {
  switch (fact.kind) {
    case "stampIsNot":
      return answer.stamp !== fact.stamp;
    case "turnIsNot":
      return answer.turn !== fact.turn;
  }
}

/* ───────── 문제 단위 검증 ───────── */

export interface PuzzleVerification {
  puzzleId: string;
  /** 탐색한 전체 후보 수 */
  candidateCount: number;
  /** 규칙을 모두 만족하는 답 */
  solutions: unknown[];
  unique: boolean;
  matchesDeclared: boolean;
  /** 문제의 짜임새에서 찾은 문제 (가리키는 자리·사람, 증거 조합의 표, 인장의 그림 자료) */
  issues: string[];
  ok: boolean;
}

export function verifyPuzzle(puzzle: Puzzle): PuzzleVerification {
  let candidateCount: number;
  let solutions: unknown[];
  let matchesDeclared: boolean;
  let issues: string[] = [];

  switch (puzzle.type) {
    case "code": {
      candidateCount = enumerateCodes(puzzle.rules).length;
      const found = solveCode(puzzle.rules);
      solutions = found;
      matchesDeclared = found.length === 1 && sameArray(found[0], puzzle.solution);
      issues = auditCode(puzzle.rules);
      break;
    }
    case "truth": {
      candidateCount = puzzle.rules.people.length;
      const found = solveTruth(puzzle.rules);
      solutions = found;
      matchesDeclared = found.length === 1 && found[0] === puzzle.solution;
      issues = auditTruth(puzzle.rules);
      break;
    }
    case "schedule": {
      candidateCount = permutations(puzzle.rules.people, puzzle.rules.slots.length).length;
      const found = solveSchedule(puzzle.rules);
      solutions = found;
      matchesDeclared = found.length === 1 && sameArray(found[0], puzzle.solution);
      issues = auditSchedule(puzzle.rules);
      break;
    }
    case "evidence": {
      candidateCount = enumerateEvidence(puzzle.rules).length;
      const found = solveEvidence(puzzle.rules);
      solutions = found;
      matchesDeclared =
        found.length === 1 &&
        found[0].statement === puzzle.solution.statement &&
        found[0].against === puzzle.solution.against;
      issues = auditEvidence(puzzle.rules).issues;
      break;
    }
    case "spatial": {
      candidateCount = enumerateSeals(puzzle.rules).length;
      const found = solveSpatial(puzzle.rules);
      solutions = found;
      matchesDeclared =
        found.length === 1 && found[0].stamp === puzzle.solution.stamp && found[0].turn === puzzle.solution.turn;
      issues = auditSpatial(puzzle.rules).issues;
      break;
    }
  }

  const unique = solutions.length === 1;
  return {
    puzzleId: puzzle.id,
    candidateCount,
    solutions,
    unique,
    matchesDeclared,
    issues,
    ok: unique && matchesDeclared && issues.length === 0,
  };
}

/** 플레이어 답안 채점. 형식이 맞고 문제의 모든 규칙을 만족해야 정답이다. */
export function checkAnswer(puzzle: Puzzle, answer: unknown): boolean {
  switch (puzzle.type) {
    case "code": {
      if (!Array.isArray(answer) || !answer.every((d) => typeof d === "number")) return false;
      return isCodeWellFormed(puzzle.rules, answer) && codeSatisfies(puzzle.rules, answer);
    }
    case "truth": {
      if (typeof answer !== "string") return false;
      if (!puzzle.rules.people.some((p) => p.id === answer)) return false;
      return countTrue(puzzle.rules, answer) === puzzle.rules.trueCount;
    }
    case "schedule": {
      if (!Array.isArray(answer) || !answer.every((id) => typeof id === "string")) return false;
      return isOrderWellFormed(puzzle.rules, answer) && orderSatisfies(puzzle.rules, answer);
    }
    case "evidence":
      return isEvidenceAnswer(answer) && evidenceAnswerHolds(puzzle.rules, answer);
    case "spatial":
      return isSpatialAnswer(answer) && sealAnswerHolds(puzzle.rules, answer);
  }
}

/* ───────── 힌트·해설 점검 ───────── */

export interface GuidanceVerification {
  puzzleId: string;
  issues: string[];
  /** 힌트에 담긴 사실만으로 남는 후보 수 (1이면 힌트가 정답을 그대로 알려주는 셈) */
  candidatesAfterHints: number;
  ok: boolean;
}

function solutionLiteral(puzzle: Puzzle): string[] {
  switch (puzzle.type) {
    case "code":
      return [puzzle.solution.join("")];
    case "truth": {
      const name = puzzle.rules.people.find((p) => p.id === puzzle.solution)?.name ?? "";
      return [`${name}가 범인`, `${name}이 범인`, `범인은 ${name}`, `${name}가 숨겼`, `${name}이 숨겼`];
    }
    case "schedule": {
      const names = puzzle.solution.map(
        (id) => puzzle.rules.people.find((p) => p.id === id)?.name ?? id,
      );
      return [names.join(" → "), names.join(", "), names.join("-")];
    }
    case "evidence": {
      const statement = cardOf(puzzle.rules, puzzle.solution.statement);
      const name = puzzle.rules.people.find((p) => p.id === statement?.speaker)?.name ?? "";
      return [`${name}의 진술이 거짓`, `${name}의 말이 거짓`, `${name}가 거짓말`, `${name}이 거짓말`, `거짓말을 한 사람은 ${name}`];
    }
    case "spatial": {
      const name = puzzle.rules.stamps.find((s) => s.id === puzzle.solution.stamp)?.name ?? "";
      return [`${name}으로 찍`, `${name}로 찍`, `정답은 ${name}`, `${name}이 맞`, `${name}가 맞`];
    }
  }
}

export function verifyGuidance(puzzle: Puzzle): GuidanceVerification {
  const issues: string[] = [];
  let candidatesAfterHints = 0;

  // 1) 힌트 문구에 정답이 그대로 적혀 있으면 안 된다.
  const literals = solutionLiteral(puzzle).filter(Boolean);
  puzzle.hints.forEach((hint, i) => {
    literals.forEach((literal) => {
      if (hint.text.includes(literal)) issues.push(`힌트 ${i + 1}에 정답 "${literal}"이 그대로 적혀 있다`);
    });
  });

  // 2) 힌트·해설의 사실은 실제 정답에서 모두 참이어야 한다.
  // 3) 힌트의 사실만으로 후보가 1개로 줄면 안 된다.
  switch (puzzle.type) {
    case "code": {
      const answer = puzzle.solution;
      const check = (label: string, facts: CodeFact[]) =>
        facts.forEach((fact) => {
          if (!codeFactHolds(fact, answer)) issues.push(`${label}: ${JSON.stringify(fact)} 가 정답과 모순된다`);
        });
      puzzle.hints.forEach((h, i) => check(`힌트 ${i + 1}`, h.facts));
      puzzle.explanation.forEach((s, i) => check(`해설 ${i + 1}`, s.facts));
      const hintFacts = puzzle.hints.flatMap((h) => h.facts);
      candidatesAfterHints = enumerateCodes(puzzle.rules).filter((code) =>
        hintFacts.every((fact) => codeFactHolds(fact, code)),
      ).length;
      break;
    }
    case "truth": {
      const answer = puzzle.solution;
      const check = (label: string, facts: TruthFact[]) =>
        facts.forEach((fact) => {
          if (!truthFactHolds(fact, puzzle.rules, answer))
            issues.push(`${label}: ${JSON.stringify(fact)} 가 정답과 모순된다`);
        });
      puzzle.hints.forEach((h, i) => check(`힌트 ${i + 1}`, h.facts));
      puzzle.explanation.forEach((s, i) => check(`해설 ${i + 1}`, s.facts));
      const hintFacts = puzzle.hints.flatMap((h) => h.facts);
      candidatesAfterHints = puzzle.rules.people.filter((p) =>
        hintFacts.every((fact) => truthFactHolds(fact, puzzle.rules, p.id)),
      ).length;
      break;
    }
    case "schedule": {
      const answer = puzzle.solution;
      const check = (label: string, facts: ScheduleFact[]) =>
        facts.forEach((fact) => {
          if (!scheduleFactHolds(fact, answer))
            issues.push(`${label}: ${JSON.stringify(fact)} 가 정답과 모순된다`);
        });
      puzzle.hints.forEach((h, i) => check(`힌트 ${i + 1}`, h.facts));
      puzzle.explanation.forEach((s, i) => check(`해설 ${i + 1}`, s.facts));
      const hintFacts = puzzle.hints.flatMap((h) => h.facts);
      candidatesAfterHints = permutations(
        puzzle.rules.people.map((p) => p.id),
        puzzle.rules.slots.length,
      ).filter((order) => hintFacts.every((fact) => scheduleFactHolds(fact, order))).length;
      break;
    }
    case "evidence": {
      const check = (label: string, facts: EvidenceFact[]) =>
        facts.forEach((fact) => {
          if (!evidenceFactHolds(fact, puzzle.rules)) issues.push(`${label}: ${JSON.stringify(fact)} 가 규칙과 맞지 않는다`);
        });
      puzzle.hints.forEach((h, i) => check(`힌트 ${i + 1}`, h.facts));
      puzzle.explanation.forEach((s, i) => check(`해설 ${i + 1}`, s.facts));
      const hintFacts = puzzle.hints.flatMap((h) => h.facts);
      candidatesAfterHints = enumerateEvidence(puzzle.rules).filter(
        (answer) => !hintFacts.some((fact) => evidenceFactExcludes(fact, answer)),
      ).length;
      // 풀이는 실제로 쓰는 카드만 말해야 한다
      const ids = new Set(allCards(puzzle.rules).map((card) => card.id));
      [...puzzle.hints, ...puzzle.explanation].forEach((item) =>
        item.facts.forEach((fact) => {
          const used = fact.kind === "derives" ? [...fact.from, fact.card] : fact.kind === "statementHolds" ? [fact.statement] : [fact.a, fact.b];
          used.forEach((id) => {
            if (!ids.has(id)) issues.push(`없는 카드 ${id} 를 가리킨다`);
          });
        }),
      );
      break;
    }
    case "spatial": {
      const answer = puzzle.solution;
      const check = (label: string, facts: SpatialFact[]) =>
        facts.forEach((fact) => {
          if (!spatialFactHolds(fact, answer)) issues.push(`${label}: ${JSON.stringify(fact)} 가 정답과 모순된다`);
        });
      puzzle.hints.forEach((h, i) => check(`힌트 ${i + 1}`, h.facts));
      puzzle.explanation.forEach((s, i) => check(`해설 ${i + 1}`, s.facts));
      const hintFacts = puzzle.hints.flatMap((h) => h.facts);
      candidatesAfterHints = enumerateSeals(puzzle.rules).filter((candidate) =>
        hintFacts.every((fact) => spatialFactHolds(fact, candidate)),
      ).length;
      break;
    }
  }

  if (candidatesAfterHints < 2) {
    issues.push(`힌트만으로 후보가 ${candidatesAfterHints}개로 줄어 정답이 드러난다`);
  }

  return { puzzleId: puzzle.id, issues, candidatesAfterHints, ok: issues.length === 0 };
}
