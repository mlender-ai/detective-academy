/**
 * 증거 조합의 규칙.
 *
 * 세계: 사람마다 시각마다 한 곳에 있다. 증거 카드는 그 세계에 대한 주장(claim)이다.
 *  - 두 주장이 "모순"이라는 것은, 둘을 함께 만족하는 세계가 하나도 없다는 뜻이다.
 *  - 두 주장에서 어떤 사실이 "나온다"는 것은, 둘을 만족하는 모든 세계에서 그 사실이 성립한다는 뜻이다.
 * 둘 다 가능한 세계를 전부 만들어 보고 판정한다(전수 탐색). 손으로 적은 표를 믿지 않는다.
 */
import type { EvidenceCard, EvidenceClaim, EvidenceDerivation, EvidenceRules, EvidenceSolution } from "./types";

type World = Uint8Array;
type Test = (world: World) => boolean;

interface Frame {
  /** 이번 판정에 관계된 사람들 (나머지 사람은 어디에 있어도 결과가 같다) */
  people: string[];
  places: string[];
  times: number;
}

/** 주장이 누구의 위치에 달려 있는가. 빈 곳·혼자에 대한 주장은 모든 사람에게 달려 있다. */
function peopleOf(rules: EvidenceRules, claim: EvidenceClaim): string[] {
  switch (claim.kind) {
    case "at":
    case "notAt":
    case "stayed":
    case "visited":
      return [claim.who];
    case "together":
      return [claim.a, claim.b];
    case "empty":
    case "alone":
    case "count":
      return rules.people.map((p) => p.id);
    case "all":
      return claim.of.flatMap((part) => peopleOf(rules, part));
  }
}

function frameFor(rules: EvidenceRules, claims: readonly EvidenceClaim[]): Frame {
  const wanted = new Set(claims.flatMap((claim) => peopleOf(rules, claim)));
  return {
    people: rules.people.map((p) => p.id).filter((id) => wanted.has(id)),
    places: rules.places.map((p) => p.id),
    times: rules.times.length,
  };
}

function compile(frame: Frame, claim: EvidenceClaim): Test {
  const cell = (who: string, time: number) => frame.people.indexOf(who) * frame.times + time;
  const place = (id: string) => frame.places.indexOf(id);
  switch (claim.kind) {
    case "at": {
      const i = cell(claim.who, claim.time);
      const p = place(claim.place);
      return (w) => w[i] === p;
    }
    case "notAt": {
      const i = cell(claim.who, claim.time);
      const p = place(claim.place);
      return (w) => w[i] !== p;
    }
    case "stayed": {
      const p = place(claim.place);
      const cells: number[] = [];
      for (let t = claim.from; t <= claim.to; t++) cells.push(cell(claim.who, t));
      return (w) => cells.every((i) => w[i] === p);
    }
    case "visited": {
      const p = place(claim.place);
      const cells: number[] = [];
      for (let t = 0; t <= claim.until; t++) cells.push(cell(claim.who, t));
      return (w) => cells.some((i) => w[i] === p);
    }
    case "empty": {
      const p = place(claim.place);
      const cells = frame.people.map((who) => cell(who, claim.time));
      return (w) => cells.every((i) => w[i] !== p);
    }
    case "alone": {
      const p = place(claim.place);
      const me = cell(claim.who, claim.time);
      const others = frame.people.filter((who) => who !== claim.who).map((who) => cell(who, claim.time));
      return (w) => w[me] === p && others.every((i) => w[i] !== p);
    }
    case "together": {
      const a = cell(claim.a, claim.time);
      const b = cell(claim.b, claim.time);
      return (w) => w[a] === w[b];
    }
    case "count": {
      const p = place(claim.place);
      const cells = frame.people.map((who) => cell(who, claim.time));
      return (w) => cells.reduce((n, i) => n + (w[i] === p ? 1 : 0), 0) === claim.count;
    }
    case "all": {
      const parts = claim.of.map((part) => compile(frame, part));
      return (w) => parts.every((test) => test(w));
    }
  }
}

/** 관계된 사람들의 가능한 세계를 모두 돈다. visit 이 true 를 돌려주면 멈춘다. 돌아본 세계의 수를 돌려준다. */
function eachWorld(frame: Frame, visit: (world: World) => boolean | void): number {
  const size = frame.people.length * frame.times;
  const base = frame.places.length;
  const world = new Uint8Array(size);
  let count = 0;
  for (;;) {
    count += 1;
    if (visit(world) === true) return count;
    let i = 0;
    while (i < size) {
      world[i] += 1;
      if (world[i] < base) break;
      world[i] = 0;
      i += 1;
    }
    if (i === size) return count;
  }
}

/** 주장들을 모두 만족하는 세계가 있는가 */
export function satisfiable(rules: EvidenceRules, claims: readonly EvidenceClaim[]): boolean {
  const frame = frameFor(rules, claims);
  const tests = claims.map((claim) => compile(frame, claim));
  let found = false;
  eachWorld(frame, (world) => {
    if (tests.every((test) => test(world))) found = true;
    return found;
  });
  return found;
}

/** 두 주장은 함께 성립할 수 없는가 */
export function contradicts(rules: EvidenceRules, a: EvidenceClaim, b: EvidenceClaim): boolean {
  return !satisfiable(rules, [a, b]);
}

/** 전제들을 만족하는 모든 세계에서 claim 이 성립하는가. 전제끼리 모순이면 false 로 본다. */
export function entails(rules: EvidenceRules, premises: readonly EvidenceClaim[], claim: EvidenceClaim): boolean {
  const frame = frameFor(rules, [...premises, claim]);
  const given = premises.map((p) => compile(frame, p));
  const goal = compile(frame, claim);
  let some = false;
  let broken = false;
  eachWorld(frame, (world) => {
    if (!given.every((test) => test(world))) return false;
    some = true;
    if (!goal(world)) broken = true;
    return broken;
  });
  return some && !broken;
}

export interface Position {
  who: string;
  place: string;
  time: number;
}

/** 전제들에서 나오는 "누가 언제 어디에 있었다"를 모두 찾는다 */
export function entailedPositions(rules: EvidenceRules, premises: readonly EvidenceClaim[]): Position[] {
  const frame = frameFor(rules, premises);
  const tests = premises.map((p) => compile(frame, p));
  const size = frame.people.length * frame.times;
  const seen = new Uint32Array(size);
  let some = false;
  eachWorld(frame, (world) => {
    if (!tests.every((test) => test(world))) return false;
    some = true;
    for (let i = 0; i < size; i++) seen[i] |= 1 << world[i];
    return false;
  });
  if (!some) return [];
  const out: Position[] = [];
  for (let i = 0; i < size; i++) {
    const mask = seen[i];
    if (mask !== 0 && (mask & (mask - 1)) === 0) {
      out.push({
        who: frame.people[Math.floor(i / frame.times)],
        place: frame.places[Math.log2(mask)],
        time: i % frame.times,
      });
    }
  }
  return out;
}

/* ───────── 카드 ───────── */

/** 이어서 얻을 수 있는 사실 카드 (같은 사실에 이르는 길이 여럿이어도 한 장) */
export function derivedCards(rules: EvidenceRules): EvidenceCard[] {
  const seen = new Set<string>();
  return rules.derivations
    .map((d) => d.card)
    .filter((card) => (seen.has(card.id) ? false : (seen.add(card.id), true)));
}

/** 처음부터 있는 증거와, 이어서 얻을 수 있는 사실 전부 */
export function allCards(rules: EvidenceRules): EvidenceCard[] {
  return [...rules.cards, ...derivedCards(rules)];
}

export function cardOf(rules: EvidenceRules, id: string): EvidenceCard | undefined {
  return allCards(rules).find((card) => card.id === id);
}

const isStatement = (card: EvidenceCard) => card.kind === "statement";

/** 두 증거를 이었을 때 나오는 사실. 없으면 null. (표에 적힌 것만 돌려준다. 표가 빠짐없는지는 auditEvidence 가 본다.) */
export function deriveFrom(rules: EvidenceRules, a: string, b: string): EvidenceCard | null {
  const hit = rules.derivations.find((d) => (d.from[0] === a && d.from[1] === b) || (d.from[0] === b && d.from[1] === a));
  return hit ? hit.card : null;
}

/** 그 사실을 얻기까지 이어야 하는 것들을, 잇는 순서대로 돌려준다. 처음부터 있는 증거면 빈 목록이다. */
export function derivationPath(rules: EvidenceRules, id: string, seen: ReadonlySet<string> = new Set()): EvidenceDerivation[] {
  // 같은 사실에 이르는 길이 여럿이면(되돌아가는 길 포함) 지금 따라가는 사실을 다시 거치지 않는 첫 길을 고른다
  const visiting = new Set([...seen, id]);
  const step = rules.derivations.find((d) => d.card.id === id && d.from.every((from) => !visiting.has(from)));
  if (!step) return [];
  const before = step.from.flatMap((from) => derivationPath(rules, from, visiting));
  return [...before.filter((d, i) => before.findIndex((other) => other.card.id === d.card.id) === i), step];
}

/** 답안의 모양이 맞고(진술 하나 + 증거 하나), 둘이 실제로 모순인가 */
export function evidenceAnswerHolds(rules: EvidenceRules, answer: EvidenceSolution): boolean {
  const statement = cardOf(rules, answer.statement);
  const against = cardOf(rules, answer.against);
  if (!statement || !against || !isStatement(statement) || isStatement(against)) return false;
  return contradicts(rules, statement.claim, against.claim);
}

/** 진술 × 증거(이어서 얻는 사실 포함)의 모든 짝 */
export function enumerateEvidence(rules: EvidenceRules): EvidenceSolution[] {
  const cards = allCards(rules);
  const statements = cards.filter(isStatement);
  const facts = cards.filter((card) => !isStatement(card));
  return statements.flatMap((s) => facts.map((f) => ({ statement: s.id, against: f.id })));
}

export function solveEvidence(rules: EvidenceRules): EvidenceSolution[] {
  return enumerateEvidence(rules).filter((answer) => evidenceAnswerHolds(rules, answer));
}

/* ───────── 문제의 짜임새 점검 ───────── */

export interface EvidenceAudit {
  issues: string[];
  /** 기록 전체와 어긋나는 진술 */
  falseStatements: string[];
  /** 정답의 증거가 이어서 얻는 사실인가 (= 조합을 거쳐야 풀리는가) */
  needsDerivation: boolean;
  /** 정답에 이르기까지 이어야 하는 횟수 */
  depth: number;
}

const samePosition = (a: Position, b: Position) => a.who === b.who && a.place === b.place && a.time === b.time;

/**
 * 문제의 짜임새를 전수 탐색으로 점검한다.
 *  1) 믿을 수 있는 기록끼리는 함께 성립한다.
 *  2) 이어서 얻는 사실은 두 증거에서 실제로 나오고, 어느 한쪽만으로는 나오지 않는다.
 *  3) 표에 적히지 않은 짝을 이었을 때 "새로 알 수 있는 것이 없다"는 답이 참이다.
 *  4) 기록 전체와 어긋나는 진술은 정확히 하나이고, 나머지 진술은 기록과 함께 성립한다.
 *  5) 이어서 얻는 사실은 모두 처음의 증거에서 출발해 닿을 수 있다.
 */
export function auditEvidence(rules: EvidenceRules): EvidenceAudit {
  const issues: string[] = [];
  const cards = allCards(rules);
  const ids = cards.map((card) => card.id);
  if (new Set(ids).size !== ids.length) issues.push("카드의 이름표가 겹친다");

  const personIds = rules.people.map((p) => p.id);
  const placeIds = rules.places.map((p) => p.id);
  const timeOk = (t: number) => Number.isInteger(t) && t >= 0 && t < rules.times.length;
  const checkClaim = (id: string, c: EvidenceClaim) => {
    if (c.kind === "all") {
      c.of.forEach((part) => checkClaim(id, part));
      return;
    }
    if (!peopleOf(rules, c).every((who) => personIds.includes(who))) issues.push(`${id}: 없는 사람을 가리킨다`);
    if ("place" in c && !placeIds.includes(c.place)) issues.push(`${id}: 없는 장소를 가리킨다`);
    const times = c.kind === "stayed" ? [c.from, c.to] : c.kind === "visited" ? [c.until] : [c.time];
    if (!times.every(timeOk)) issues.push(`${id}: 없는 시각을 가리킨다`);
  };
  cards.forEach((card) => {
    checkClaim(card.id, card.claim);
    if (isStatement(card) && !personIds.includes(card.speaker ?? "")) issues.push(`${card.id}: 진술한 사람이 없다`);
  });
  rules.derivations.forEach((d) => {
    if (d.card.kind !== "derived") issues.push(`${d.card.id}: 이어서 얻는 사실은 derived 여야 한다`);
    d.from.forEach((id) => {
      const from = cards.find((card) => card.id === id);
      if (!from) issues.push(`${d.card.id}: 없는 증거 ${id} 에서 나온다`);
      else if (isStatement(from)) issues.push(`${d.card.id}: 진술(${id})에서 사실을 끌어낼 수 없다`);
    });
  });
  if (issues.length > 0) return { issues, falseStatements: [], needsDerivation: false, depth: 0 };

  const base = rules.cards.filter((card) => !isStatement(card));
  const facts = cards.filter((card) => !isStatement(card));
  const statements = cards.filter(isStatement);
  const reliable = base.map((card) => card.claim);

  // 1) 기록끼리 함께 성립하는가
  if (!satisfiable(rules, reliable)) issues.push("믿을 수 있는 기록끼리 모순이다");

  // 5) 닿을 수 있는가 (그리고 몇 번 이어야 하는가)
  const depthOf = new Map<string, number>(rules.cards.map((card) => [card.id, 0]));
  for (let round = 0; round < rules.derivations.length + 1; round++) {
    rules.derivations.forEach((d) => {
      const a = depthOf.get(d.from[0]);
      const b = depthOf.get(d.from[1]);
      if (a === undefined || b === undefined) return;
      const depth = Math.max(a, b) + 1;
      if (depth < (depthOf.get(d.card.id) ?? Infinity)) depthOf.set(d.card.id, depth);
    });
  }
  derivedCards(rules).forEach((card) => {
    if (!depthOf.has(card.id)) issues.push(`${card.id}: 처음의 증거에서 출발해 닿을 수 없다`);
  });

  // 2) 이어서 얻는 사실은 두 증거에서 나오고, 한쪽만으로는 나오지 않는다. 기록 전체와도 어긋나지 않는다.
  rules.derivations.forEach((d) => {
    const [a, b] = d.from.map((id) => cards.find((card) => card.id === id)!);
    if (!entails(rules, [a.claim, b.claim], d.card.claim)) issues.push(`${d.card.id}: ${a.id} + ${b.id} 에서 나오지 않는다`);
    if (entails(rules, [a.claim], d.card.claim) || entails(rules, [b.claim], d.card.claim)) {
      issues.push(`${d.card.id}: ${a.id} 나 ${b.id} 하나만으로도 나온다(이을 필요가 없다)`);
    }
  });

  // 3) 표가 빠짐없는가: 어느 두 증거를 이어도, 새로 나오는 "누가 언제 어디에"는 표에 적힌 사실 안에 있어야 한다.
  const known = (position: Position, from: EvidenceCard[]) =>
    from.some((card) => entailedPositions(rules, [card.claim]).some((p) => samePosition(p, position)));
  for (let i = 0; i < facts.length; i++) {
    for (let j = i + 1; j < facts.length; j++) {
      const [a, b] = [facts[i], facts[j]];
      // 한쪽이 다른 쪽에서 나온 사실이면 잇는 것이 뜻이 없다(되돌아가는 길)
      const fresh = entailedPositions(rules, [a.claim, b.claim]).filter((p) => !known(p, [a, b]) && !known(p, base));
      const derived = deriveFrom(rules, a.id, b.id);
      const missing = fresh.filter((p) => !derived || !entailedPositions(rules, [derived.claim]).some((q) => samePosition(p, q)));
      missing.forEach((p) => {
        issues.push(`${a.id} + ${b.id} 를 이으면 "${p.who} ${rules.times[p.time]} ${p.place}"가 나오는데 표에 없다`);
      });
    }
  }

  // 4) 거짓 진술은 정확히 하나
  const falseStatements = statements.filter((s) => !satisfiable(rules, [...reliable, s.claim])).map((s) => s.id);
  if (falseStatements.length !== 1) issues.push(`기록과 어긋나는 진술이 ${falseStatements.length}개다(하나여야 한다)`);
  const honest = statements.filter((s) => !falseStatements.includes(s.id)).map((s) => s.claim);
  if (!satisfiable(rules, [...reliable, ...honest])) issues.push("참인 진술들과 기록이 함께 성립하지 않는다");

  const solutions = solveEvidence(rules);
  if (solutions.length === 1 && falseStatements.length === 1 && solutions[0].statement !== falseStatements[0]) {
    issues.push("모순인 짝의 진술이 거짓 진술과 다르다");
  }
  const against = solutions.length === 1 ? cards.find((card) => card.id === solutions[0].against) : undefined;

  return {
    issues,
    falseStatements,
    needsDerivation: against?.kind === "derived",
    depth: against ? (depthOf.get(against.id) ?? 0) : 0,
  };
}
