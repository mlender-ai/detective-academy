import { describe, expect, it } from "vitest";
import { DAILY_SCHEDULE_1 } from "../data/dailySet";
import * as PEOPLE from "../data/people";
import { EXAM_SCHEDULE } from "../data/puzzles";
import {
  EXAM_SCHEDULE_A_S,
  EXAM_SCHEDULE_B_A,
  EXAM_SCHEDULE_C_B,
  PRACTICE_SCHEDULE_A,
  PRACTICE_SCHEDULE_C,
  PRACTICE_SCHEDULE_D,
  SCHEDULE_SET,
} from "../data/sets/schedule";
import { checkAnswer, constraintHolds, permutations, solveSchedule, verifyGuidance, verifyPuzzle } from "../engine/puzzleValidator";
import type { ScheduleConstraint, SchedulePuzzle } from "../engine/types";
import { initialInput, readiness, toAnswer } from "../games/logic";

/** 순서 추론 여섯 문제 (GATE 05): 연습 D·C·A, 시험 C→B·B→A·A→S */

const each = SCHEDULE_SET.map((p) => [p.id, p] as const);

/** 조건의 일부(순번은 1부터)만 지키는 모든 순서 */
function ordersWith(puzzle: SchedulePuzzle, numbers: number[]): string[][] {
  const picked = numbers.map((n) => puzzle.rules.constraints[n - 1]);
  return permutations(puzzle.rules.people.map((p) => p.id)).filter((order) => picked.every((c) => constraintHolds(c, order)));
}

const at = (order: string[], who: string) => order.indexOf(who);

/** 조건 종류의 조합: 사람 수 + 정렬한 종류들 */
const signature = (puzzle: SchedulePuzzle) => `${puzzle.rules.people.length}명 ${puzzle.rules.constraints.map((c) => c.kind).sort().join("+")}`;

const kinds = (puzzle: SchedulePuzzle) => puzzle.rules.constraints.map((c) => c.kind);

describe("순서 추론 여섯 문제: 표의 칸", () => {
  it("여섯 문제가 표의 순서대로 있고, 구분·등급·보상·힌트 수가 맞다", () => {
    const table = [
      { id: "practice-schedule-d", category: "practice", rank: "D", difficulty: 2, reward: 35, hints: 2, people: 4 },
      { id: "practice-schedule-c", category: "practice", rank: "C", difficulty: 3, reward: 40, hints: 2, people: 4 },
      { id: "exam-schedule-c-b", category: "exam", rank: "C", difficulty: 3, reward: 0, hints: 2, people: 4 },
      { id: "practice-schedule-a", category: "practice", rank: "A", difficulty: 5, reward: 50, hints: 2, people: 5 },
      { id: "exam-schedule-b-a", category: "exam", rank: "B", difficulty: 4, reward: 0, hints: 0, people: 5 },
      { id: "exam-schedule-a-s", category: "exam", rank: "A", difficulty: 5, reward: 0, hints: 0, people: 5 },
    ];
    expect(SCHEDULE_SET).toHaveLength(6);
    expect(
      SCHEDULE_SET.map((p) => ({
        id: p.id,
        category: p.category,
        rank: p.rank,
        difficulty: p.difficulty,
        reward: p.reward,
        hints: p.hints.length,
        people: p.rules.people.length,
      })),
    ).toEqual(table);
    expect(SCHEDULE_SET.every((p) => p.type === "schedule")).toBe(true);
    // 같은 유형의 기존 문제와 같은 유형 이름을 쓴다
    expect(new Set([EXAM_SCHEDULE, DAILY_SCHEDULE_1, ...SCHEDULE_SET].map((p) => p.typeLabel)).size).toBe(1);
  });

  it("제목과 이름표가 기존 문제와도, 서로도 겹치지 않는다", () => {
    const all = [EXAM_SCHEDULE, DAILY_SCHEDULE_1, ...SCHEDULE_SET];
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    expect(new Set(all.map((p) => p.title)).size).toBe(all.length);
    const taken = [
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
    SCHEDULE_SET.forEach((p) => expect(taken).not.toContain(p.title));
    // 순서의 이름도 문제마다 다르다
    expect(new Set(SCHEDULE_SET.map((p) => p.rules.title)).size).toBe(6);
    SCHEDULE_SET.forEach((p) => expect(p.rules.title).toBeTruthy());
  });

  it.each(each)("%s: 여는 글과 닫는 글이 한두 문장이고 64자 이하다", (_id, puzzle) => {
    for (const text of [puzzle.intro, puzzle.outro]) {
      expect(text).toBeTruthy();
      expect(text!.split(/[.?!]\s/).length).toBeLessThanOrEqual(2);
      expect(text!.length).toBeLessThanOrEqual(64);
      expect(text!.endsWith("다.")).toBe(true);
    }
    expect(puzzle.minutes).toBeGreaterThanOrEqual(2);
    expect(puzzle.minutes).toBeLessThanOrEqual(6);
  });
});

describe("순서 추론 여섯 문제: 정답과 안내", () => {
  it.each(each)("%s: 정답이 정확히 하나이고 짜임새에 문제가 없다", (_id, puzzle) => {
    const result = verifyPuzzle(puzzle);
    expect(result.issues).toEqual([]);
    expect(result.solutions).toEqual([puzzle.solution]);
    expect(result.matchesDeclared).toBe(true);
    expect(result.ok).toBe(true);
    // 찍어서 맞히기 어렵다: 네 명이면 24가지, 다섯 명이면 120가지 가운데 하나
    expect(result.candidateCount).toBe(puzzle.rules.people.length === 5 ? 120 : 24);
  });

  it.each(each)("%s: 어느 조건도 군더더기가 아니다(하나를 빼면 답이 여럿이 된다)", (_id, puzzle) => {
    puzzle.rules.constraints.forEach((_, skip) => {
      const rules = { ...puzzle.rules, constraints: puzzle.rules.constraints.filter((__, i) => i !== skip) };
      expect(solveSchedule(rules).length).toBeGreaterThan(1);
    });
  });

  it.each(each)("%s: 힌트와 해설이 정답과 맞고, 힌트만으로 답이 드러나지 않는다", (_id, puzzle) => {
    const result = verifyGuidance(puzzle);
    expect(result.issues).toEqual([]);
    expect(result.candidatesAfterHints).toBeGreaterThanOrEqual(2);
    expect(puzzle.explanation.length).toBeGreaterThanOrEqual(3);
    // 해설은 단계마다 확인할 수 있는 사실을 단다
    puzzle.explanation.forEach((step) => expect(step.facts.length).toBeGreaterThanOrEqual(1));
    // 마지막 단계는 모든 사람의 자리를 말한다
    const last = puzzle.explanation[puzzle.explanation.length - 1];
    expect(last.facts.filter((fact) => fact.kind === "slotIs")).toHaveLength(puzzle.rules.people.length);
    // 힌트에는 정답의 순서가 통째로 적혀 있지 않다
    const names = puzzle.solution.map((id) => puzzle.rules.people.find((p) => p.id === id)!.name);
    puzzle.hints.forEach((hint) => expect(hint.text).not.toContain(names.join(", ")));
  });

  it.each(each)("%s: 정답만 정답으로 채점되고, 화면의 조작으로 정답에 닿는다", (_id, puzzle) => {
    expect(checkAnswer(puzzle, puzzle.solution)).toBe(true);
    const ids = puzzle.rules.people.map((p) => p.id);
    expect(permutations(ids).filter((order) => checkAnswer(puzzle, order))).toEqual([puzzle.solution]);
    // 빈 시간표에서 시작해 이름표를 모두 놓으면 제출할 수 있고, 놓인 순서가 그대로 답안이 된다
    const start = initialInput(puzzle);
    expect(start).toEqual({ type: "schedule", placement: ids.map(() => null) });
    expect(readiness(puzzle, start).ok).toBe(false);
    const filled = { type: "schedule" as const, placement: [...puzzle.solution] };
    expect(readiness(puzzle, filled).ok).toBe(true);
    expect(toAnswer(puzzle, filled)).toEqual(puzzle.solution);
    // 사람이 빠진 답안, 겹친 답안은 오답
    expect(checkAnswer(puzzle, puzzle.solution.slice(1))).toBe(false);
    expect(checkAnswer(puzzle, puzzle.solution.map(() => puzzle.solution[0]))).toBe(false);
  });
});

describe("순서 추론 여섯 문제: 푸는 길이 서로 다르다", () => {
  it("조건 종류의 조합이 여섯 문제끼리도, 기존 두 문제와도 다르다", () => {
    const all = [EXAM_SCHEDULE, DAILY_SCHEDULE_1, ...SCHEDULE_SET];
    const signatures = all.map(signature);
    expect(new Set(signatures).size).toBe(all.length);
    expect(signatures).toEqual([
      "4명 before+immediatelyAfter+notAtSlot+notAtSlot",
      "4명 before+notAdjacent+notAdjacent+notAtSlot",
      "4명 before+before+slotAmong+slotAmong",
      "4명 before+gap+notAdjacent",
      "4명 between+between+immediatelyAfter",
      "5명 before+between+gap+gap+notAdjacent",
      "5명 before+before+notAtSlot+slotAmong+slotAmong",
      "5명 between+gap+immediatelyAfter+notAdjacent+slotAmong",
    ]);
  });

  it("문제마다 표가 정한 조건이 중심에 있다", () => {
    // 연습 D: 처음 아니면 마지막
    const ends = PRACTICE_SCHEDULE_D.rules.constraints.filter((c) => c.kind === "slotAmong");
    expect(ends.map((c) => (c.kind === "slotAmong" ? c.slots : []))).toEqual([
      [0, 3],
      [0, 3],
    ]);
    // 연습 C: 사이에 정확히 한 명
    expect(PRACTICE_SCHEDULE_C.rules.constraints[0]).toMatchObject({ kind: "gap", between: 1 });
    // 시험 C→B: 두 사람 사이
    expect(kinds(EXAM_SCHEDULE_C_B).filter((k) => k === "between")).toHaveLength(2);
    // 연습 A: GATE 05 에서 더한 조건 종류가 셋 이상 섞인다
    expect(kinds(PRACTICE_SCHEDULE_A).filter((k) => k === "gap" || k === "between" || k === "slotAmong").length).toBeGreaterThanOrEqual(3);
    // 시험 B→A: 먼저의 사슬(갑 → 을 → 병) + 자리 가운데 하나 + 금지 자리
    const befores = EXAM_SCHEDULE_B_A.rules.constraints.filter((c): c is Extract<ScheduleConstraint, { kind: "before" }> => c.kind === "before");
    expect(befores).toHaveLength(2);
    expect(befores[0].b).toBe(befores[1].a);
    expect(kinds(EXAM_SCHEDULE_B_A)).toContain("slotAmong");
    expect(kinds(EXAM_SCHEDULE_B_A)).toContain("notAtSlot");
    // 시험 A→S: 조건이 모두 다른 종류다
    expect(new Set(kinds(EXAM_SCHEDULE_A_S)).size).toBe(EXAM_SCHEDULE_A_S.rules.constraints.length);
    expect(EXAM_SCHEDULE_A_S.rules.constraints).toHaveLength(5);
  });

  it("경우를 나누는 문제와 나누지 않는 문제가 섞여 있다", () => {
    // 연습 D 는 조건을 차례로 겹치기만 하면 풀린다: 앞의 두 조건만으로 가운데 두 자리의 주인이 정해진다
    const d = ordersWith(PRACTICE_SCHEDULE_D, [1, 2]);
    expect(d).toHaveLength(4);
    // 연습 C 는 '한 자리 건너'의 네 경우를 견줘야 한다: 조건 1만으로는 도윤의 자리가 네 곳 모두 열려 있다
    const c = ordersWith(PRACTICE_SCHEDULE_C, [1]);
    expect(new Set(c.map((order) => at(order, "doyun"))).size).toBe(4);
  });
});

describe("순서 추론 여섯 문제: 해설의 글이 말하는 사실", () => {
  it("연습 D: 조건 1·2로 가운데 두 자리가 정해지고, 조건 3이 준호를 맨 앞에 세운다", () => {
    const p = PRACTICE_SCHEDULE_D;
    for (const order of ordersWith(p, [1, 2])) {
      expect([at(order, "junho"), at(order, "harin")].sort()).toEqual([0, 3]);
      expect([at(order, "sea"), at(order, "daon")].sort()).toEqual([1, 2]);
    }
    const three = ordersWith(p, [1, 2, 3]);
    expect(three.every((order) => at(order, "junho") === 0 && at(order, "harin") === 3)).toBe(true);
    expect(three).toHaveLength(2);
    expect(ordersWith(p, [1, 2, 3, 4])).toEqual([["junho", "sea", "daon", "harin"]]);
  });

  it("연습 C: 도윤이 가운데 자리면 민재가 설 곳이 없고, 23시면 세라보다 먼저일 수 없다", () => {
    const p = PRACTICE_SCHEDULE_C;
    // 조건 1만: 도윤·하나는 20시·22시 또는 21시·23시 (네 경우)
    const pairs = new Set(ordersWith(p, [1]).map((order) => `${at(order, "doyun")}-${at(order, "hana")}`));
    expect([...pairs].sort()).toEqual(["0-2", "1-3", "2-0", "3-1"]);
    // 도윤이 21시(1)나 22시(2)이고 하나가 한 자리 건너면, 남는 두 자리는 모두 도윤의 옆이다
    for (const order of ordersWith(p, [1]).filter((o) => [1, 2].includes(at(o, "doyun")))) {
      expect(Math.abs(at(order, "minjae") - at(order, "doyun"))).toBe(1);
      expect(Math.abs(at(order, "sera") - at(order, "doyun"))).toBe(1);
    }
    // 그래서 조건 1·2를 함께 지키면 도윤은 20시 아니면 23시
    const two = ordersWith(p, [1, 2]);
    expect(new Set(two.map((order) => at(order, "doyun")))).toEqual(new Set([0, 3]));
    expect(two).toHaveLength(2);
    // 23시의 도윤은 조건 3을 지킬 수 없다
    expect(two.filter((order) => at(order, "doyun") === 3).every((order) => !constraintHolds(p.rules.constraints[2], order))).toBe(true);
    // 도윤이 20시일 때: 하나 22시, 민재는 21시에 설 수 없다
    const first = two.find((order) => at(order, "doyun") === 0)!;
    expect(first).toEqual(p.solution);
    expect(at(first, "hana")).toBe(2);
    expect(at(first, "minjae")).toBe(3);
  });

  it("시험 C→B: 다온은 끝자리, 하나는 그 옆이고, 도윤과 하린은 함께 반대쪽에 선다", () => {
    const p = EXAM_SCHEDULE_C_B;
    const two = ordersWith(p, [1, 2]);
    // 다온·하나·(도윤, 하린) 또는 (도윤, 하린)·하나·다온: 네 가지
    expect(two).toHaveLength(4);
    for (const order of two) {
      expect([0, 3]).toContain(at(order, "daon"));
      expect(Math.abs(at(order, "hana") - at(order, "daon"))).toBe(1);
      const side = (who: string) => Math.sign(at(order, who) - at(order, "hana"));
      expect(side("doyun")).toBe(side("harin"));
      expect(side("doyun")).toBe(-side("daon"));
    }
    // 조건 3(도윤 바로 다음이 하나)이면 도윤이 하나보다 앞이므로 다온은 4번
    const all = ordersWith(p, [1, 2, 3]);
    expect(all).toEqual([["harin", "doyun", "hana", "daon"]]);
  });

  it("연습 A: 두 쌍을 겹치지 않게 놓으면 하나는 1번 아니면 5번이고, 세라·준호가 3번·5번이면 조건 4에 어긋난다", () => {
    const p = PRACTICE_SCHEDULE_A;
    const pairs = ordersWith(p, [1, 2]);
    // 쌍의 자리는 {1·3번, 2·4번} 또는 {2·4번, 3·5번}뿐이다
    const spots = (order: string[], a: string, b: string) => [at(order, a), at(order, b)].sort().join("");
    const layouts = new Set(pairs.map((order) => [spots(order, "sera", "junho"), spots(order, "daon", "doyun")].sort().join("|")));
    expect([...layouts].sort()).toEqual(["02|13", "13|24"]);
    expect(new Set(pairs.map((order) => at(order, "hana")))).toEqual(new Set([0, 4]));
    // 조건 5: 하나가 다온보다 먼저 → 하나는 1번
    const withBefore = ordersWith(p, [1, 2, 5]);
    expect(withBefore.every((order) => at(order, "hana") === 0)).toBe(true);
    // 조건 3: 하나가 1번이면 세라가 준호보다 앞
    const withBetween = ordersWith(p, [1, 2, 3, 5]);
    expect(withBetween.every((order) => at(order, "sera") < at(order, "junho"))).toBe(true);
    // 세라·준호가 3번·5번인 경우: 다온과 도윤이 모두 세라의 옆이라 조건 4를 지킬 수 없다
    const late = withBetween.filter((order) => at(order, "sera") === 2);
    expect(late.length).toBeGreaterThan(0);
    expect(late.every((order) => at(order, "junho") === 4 && Math.abs(at(order, "doyun") - 2) === 1)).toBe(true);
    expect(late.some((order) => constraintHolds(p.rules.constraints[3], order))).toBe(false);
    // 세라 2번·준호 4번인 경우: 도윤이 3번이면 세라의 옆, 5번이면 통과
    const early = withBetween.filter((order) => at(order, "sera") === 1);
    expect(early.map((order) => at(order, "doyun")).sort()).toEqual([2, 4]);
    expect(early.filter((order) => constraintHolds(p.rules.constraints[3], order))).toEqual([p.solution]);
  });

  it("시험 B→A: 세아는 끝자리가 아니고, 하린이 5번이면 세아가 반드시 3번이 된다", () => {
    const p = EXAM_SCHEDULE_B_A;
    const chain = ordersWith(p, [1, 2]);
    expect(chain).toHaveLength(20);
    expect(new Set(chain.map((order) => at(order, "sea")))).toEqual(new Set([1, 2, 3]));
    // 하린이 5번인 경우(조건 1~4): 하나가 1번이든 2번이든 세아는 3번
    const last = ordersWith(p, [1, 2, 3, 4]).filter((order) => at(order, "harin") === 4);
    expect(last.map((order) => at(order, "hana")).sort()).toEqual([0, 1]);
    expect(last.every((order) => at(order, "sea") === 2)).toBe(true);
    // 하린이 1번인 경우: 하나는 2번, 세아는 4번
    const first = ordersWith(p, [1, 2, 3, 4]).filter((order) => at(order, "harin") === 0);
    expect(first).toEqual([["harin", "hana", "minjae", "sea", "doyun"]]);
    expect(at(first[0], "sea")).toBe(3);
  });

  it("시험 A→S: 준호는 세라보다 뒤, 네 사람이 한 덩어리, 덩어리는 2~5번", () => {
    const p = EXAM_SCHEDULE_A_S;
    // 조건 5(다온 다음 세라)와 조건 1(한 자리 건너)만: 준호가 앞일 수도 뒤일 수도 있다
    const loose = ordersWith(p, [1, 5]);
    expect(loose.some((order) => at(order, "junho") < at(order, "sera"))).toBe(true);
    // 준호가 세라보다 앞이면 준호 바로 다음이 다온이다
    expect(loose.filter((order) => at(order, "junho") < at(order, "sera")).every((order) => at(order, "daon") === at(order, "junho") + 1)).toBe(true);
    // 조건 4까지 지키면 준호는 세라의 두 자리 뒤: 다온·세라·한 명·준호가 이어진다
    const block = ordersWith(p, [1, 4, 5]);
    expect(block.every((order) => at(order, "sera") === at(order, "daon") + 1 && at(order, "junho") === at(order, "sera") + 2)).toBe(true);
    expect(new Set(block.map((order) => at(order, "daon")))).toEqual(new Set([0, 1]));
    expect(new Set(block.map((order) => at(order, "junho")))).toEqual(new Set([3, 4]));
    // 덩어리가 1~4번이면 세라의 앞에는 다온뿐이라 조건 2를 지킬 수 없다
    expect(block.filter((order) => at(order, "daon") === 0).some((order) => constraintHolds(p.rules.constraints[1], order))).toBe(false);
    const placed = ordersWith(p, [1, 2, 4, 5]);
    expect(placed.every((order) => at(order, "daon") === 1 && at(order, "sera") === 2 && at(order, "junho") === 4)).toBe(true);
    expect(placed).toHaveLength(2);
    // 조건 3: 5번은 준호이므로 민재가 1번
    expect(ordersWith(p, [1, 2, 3, 4, 5])).toEqual([["minjae", "daon", "sera", "harin", "junho"]]);
  });
});

describe("순서 추론 여섯 문제: 화면의 한계", () => {
  const cast = new Set(Object.values(PEOPLE).map((person) => person.id));

  it.each(each)("%s: 사람·자리·조건의 수와 글의 길이가 화면에 들어간다", (_id, puzzle) => {
    const { people, slots, constraints } = puzzle.rules;
    expect([4, 5]).toContain(people.length);
    expect(slots).toHaveLength(people.length);
    expect(people.every((person) => cast.has(person.id))).toBe(true);
    expect(new Set(people.map((person) => person.name)).size).toBe(people.length);
    expect(constraints.length).toBeLessThanOrEqual(5);
    constraints.forEach((c) => {
      // 낮은 화면(375px 폭)에서 조건 하나가 한 줄에 들어가는 폭: 한글 16px, 숫자·빈칸·마침표 8px
      const width = [...c.text].reduce((sum, ch) => sum + (ch.charCodeAt(0) < 128 ? 8 : 16), 0);
      expect(width, c.text).toBeLessThanOrEqual(288);
      expect(c.text.endsWith("다.")).toBe(true);
    });
    // 다섯 명이면 자리 이름은 두 글자("1번"~"5번"), 네 명이면 세 글자 이하("18시")
    slots.forEach((slot) => expect(slot.label.length).toBeLessThanOrEqual(people.length === 5 ? 2 : 3));
    expect(new Set(slots.map((slot) => slot.label)).size).toBe(slots.length);
    expect(slots.map((slot) => slot.ordinal)).toEqual(["첫 번째", "두 번째", "세 번째", "네 번째", "다섯 번째"].slice(0, slots.length));
    // 문제의 글은 조건의 수와 사람의 수를 바르게 말한다
    const count = ["", "한", "두", "세", "네", "다섯"];
    expect(puzzle.description).toContain(`${count[people.length]} 명`);
    expect(puzzle.description).toContain(`${count[constraints.length]} 조건`);
    expect(puzzle.description).toContain(puzzle.rules.title!);
  });

  it("이름표를 늘어놓은 순서가 정답을 알려 주지 않고, 사람 이름 '하나'가 수를 세는 말과 섞이지 않는다", () => {
    for (const puzzle of SCHEDULE_SET) {
      // 쟁반에는 rules.people 의 순서대로 이름표가 놓인다
      expect(puzzle.rules.people.map((p) => p.id)).not.toEqual(puzzle.solution);
      if (!puzzle.rules.people.some((p) => p.id === "hana")) continue;
      const texts = [puzzle.description, ...puzzle.rules.constraints.map((c) => c.text), ...puzzle.hints.map((h) => h.text), ...puzzle.explanation.map((e) => e.text)];
      texts.forEach((text) => expect(text).not.toMatch(/하나씩|하나만|하나뿐|하나도/));
    }
  });

  it("다섯 명 문제는 표에 적힌 세 문제뿐이다", () => {
    expect(SCHEDULE_SET.filter((p) => p.rules.people.length === 5).map((p) => p.id)).toEqual([
      "practice-schedule-a",
      "exam-schedule-b-a",
      "exam-schedule-a-s",
    ]);
  });

  it("조건의 글이 가리키는 사람이 조건의 내용과 같다", () => {
    for (const puzzle of SCHEDULE_SET) {
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
        // 글에 나오는 이름은 조건이 가리키는 사람과 정확히 같다
        const inText = puzzle.rules.people.filter((p) => c.text.includes(p.name)).map((p) => p.id);
        expect(inText.sort()).toEqual([...named].sort());
        // 글의 첫 이름이 주어다
        const subject = c.kind === "before" || c.kind === "notAdjacent" || c.kind === "gap" ? c.a : c.who;
        expect(c.text.startsWith(name(subject))).toBe(true);
        if (c.kind === "before") expect(c.text).toContain("먼저");
        if (c.kind === "gap") expect(c.text).toContain(`딱 ${["", "한", "두", "세"][c.between]} 명`);
        if (c.kind === "notAdjacent") expect(c.text).toContain("연달아");
        if (c.kind === "between") expect(c.text).toContain("사이");
        if (c.kind === "immediatelyAfter") expect(c.text).toContain("바로 다음");
        if (c.kind === "notAtSlot") expect(c.text).toContain(["첫", "두", "세", "네", "다섯"][c.slot]);
      }
    }
  });
});
