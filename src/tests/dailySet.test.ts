import { describe, expect, it } from "vitest";
import { DAILY_EVIDENCE_1, DAILY_EVIDENCE_2, DAILY_SCHEDULE_1, DAILY_SEAL_1, DAILY_SEAL_2, DAILY_SET, DAILY_TRUTH_1 } from "../data/dailySet";
import { ALL_PUZZLES, PUZZLES } from "../data/puzzles";
import { allCards, auditEvidence, contradicts, deriveFrom, entailedPositions, entails, enumerateEvidence, satisfiable, solveEvidence } from "../engine/evidence";
import { checkAnswer, countTrue, solveSchedule, verifyGuidance, verifyPuzzle } from "../engine/puzzleValidator";
import { auditSpatial, dotCount, enumerateSeals, imprintMatches, mirrorGrid, pressSeal, rotateGrid, sealDifference, solveSpatial } from "../engine/seal";
import type { EvidencePuzzle, SpatialPuzzle } from "../engine/types";
import { evidencePair, initialInput, readiness, restoreInput, toAnswer } from "../games/logic";

describe("일일 문제 일곱 개", () => {
  it("일곱 개이고, 새 유형이 둘씩 들어 있으며, 이름표가 겹치지 않는다", () => {
    expect(DAILY_SET).toHaveLength(7);
    expect(DAILY_SET.filter((p) => p.type === "evidence")).toHaveLength(2);
    expect(DAILY_SET.filter((p) => p.type === "spatial")).toHaveLength(2);
    expect(new Set(DAILY_SET.map((p) => p.type)).size).toBe(5);
    expect(new Set(ALL_PUZZLES.map((p) => p.id)).size).toBe(ALL_PUZZLES.length);
    // 지금 제품의 흐름(입학 → 승급)에 놓인 문제는 그대로 셋이다
    expect(PUZZLES).toHaveLength(3);
  });

  it.each(DAILY_SET.map((p) => [p.id, p] as const))("%s: 정답이 정확히 하나이고 짜임새에 문제가 없다", (_id, puzzle) => {
    const result = verifyPuzzle(puzzle);
    expect(result.issues).toEqual([]);
    expect(result.solutions).toHaveLength(1);
    expect(result.matchesDeclared).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.candidateCount).toBeGreaterThanOrEqual(4);
  });

  it.each(DAILY_SET.map((p) => [p.id, p] as const))("%s: 힌트와 해설이 규칙과 맞고, 힌트만으로 답이 드러나지 않는다", (_id, puzzle) => {
    const result = verifyGuidance(puzzle);
    expect(result.issues).toEqual([]);
    expect(result.candidatesAfterHints).toBeGreaterThanOrEqual(2);
    expect(puzzle.hints).toHaveLength(2);
    expect(puzzle.explanation.length).toBeGreaterThanOrEqual(3);
  });

  it.each(DAILY_SET.map((p) => [p.id, p] as const))("%s: 사건을 여는 글과 닫는 글이 한두 문장이다", (_id, puzzle) => {
    for (const text of [puzzle.intro, puzzle.outro]) {
      expect(text).toBeTruthy();
      expect(text!.split(/[.?!]\s/).length).toBeLessThanOrEqual(3);
      expect(text!.length).toBeLessThanOrEqual(64);
    }
    expect(puzzle.rank).toBeTruthy();
    expect(puzzle.minutes).toBeGreaterThanOrEqual(3);
    expect(puzzle.minutes).toBeLessThanOrEqual(5);
  });

  it("같은 유형의 두 문제는 푸는 길이 다르다", () => {
    // 증거 조합: 한 번 이어서 푸는 문제와 두 번 이어야 풀리는 문제
    expect(auditEvidence(DAILY_EVIDENCE_1.rules).depth).toBe(1);
    expect(auditEvidence(DAILY_EVIDENCE_2.rules).depth).toBe(2);
    // 인장: 자국이 다 보이는 문제와 번진 문제
    expect(DAILY_SEAL_1.rules.imprint.join("")).not.toContain("?");
    expect(DAILY_SEAL_2.rules.imprint.join("")).toContain("?");
  });
});

describe("증거 조합", () => {
  const p1 = DAILY_EVIDENCE_1;
  const p2 = DAILY_EVIDENCE_2;
  const claim = (puzzle: EvidencePuzzle, id: string) => allCards(puzzle.rules).find((card) => card.id === id)!.claim;

  it("진술 × 증거의 모든 짝을 검사하고, 모순인 짝은 하나뿐이다", () => {
    // 진술 3 × (기록 4 + 이어서 얻는 사실 1)
    expect(enumerateEvidence(p1.rules)).toHaveLength(15);
    expect(solveEvidence(p1.rules)).toEqual([{ statement: "say-sera", against: "fact-sera" }]);
    // 진술 4 × (기록 5 + 사실 2)
    expect(enumerateEvidence(p2.rules)).toHaveLength(28);
    expect(solveEvidence(p2.rules)).toEqual([{ statement: "say-minjae", against: "fact-alone" }]);
  });

  it("기록 하나만으로는 거짓 진술이 깨지지 않는다(이어야 풀린다)", () => {
    for (const puzzle of [p1, p2]) {
      const audit = auditEvidence(puzzle.rules);
      expect(audit.issues).toEqual([]);
      expect(audit.needsDerivation).toBe(true);
      expect(audit.falseStatements).toEqual([puzzle.solution.statement]);
      const liar = claim(puzzle, puzzle.solution.statement);
      for (const card of puzzle.rules.cards.filter((c) => c.kind !== "statement")) {
        expect(contradicts(puzzle.rules, liar, card.claim)).toBe(false);
      }
    }
  });

  it("눈에 띄는 물건은 함정이다: 발견된 시각보다 앞서 떨어뜨렸을 수 있다", () => {
    expect(contradicts(p1.rules, claim(p1, "say-junho"), claim(p1, "case"))).toBe(false);
    expect(contradicts(p2.rules, claim(p2, "say-minjae"), claim(p2, "brush"))).toBe(false);
    expect(contradicts(p2.rules, claim(p2, "say-minjae"), claim(p2, "counter"))).toBe(false);
  });

  it("이어서 얻는 사실은 두 증거에서 실제로 나온다", () => {
    expect(entailedPositions(p1.rules, [claim(p1, "roster"), claim(p1, "photo")])).toContainEqual({ who: "sera", place: "hall", time: 1 });
    expect(entails(p1.rules, [claim(p1, "roster")], claim(p1, "fact-sera"))).toBe(false);
    expect(entailedPositions(p2.rules, [claim(p2, "patrol"), claim(p2, "tag")])).toEqual([{ who: "doyun", place: "hall", time: 1 }]);
    expect(entails(p2.rules, [claim(p2, "fact-doyun"), claim(p2, "counter")], claim(p2, "fact-alone"))).toBe(true);
    expect(entails(p2.rules, [claim(p2, "counter")], claim(p2, "fact-alone"))).toBe(false);
  });

  it("화면의 조작으로 정답에 닿는다: 처음의 증거에서 출발해 이어 가면 정답의 증거가 나온다", () => {
    for (const puzzle of [p1, p2]) {
      const have = new Set(puzzle.rules.cards.map((card) => card.id));
      for (let round = 0; round < 4; round++) {
        for (const a of [...have]) for (const b of [...have]) {
          const card = a < b ? deriveFrom(puzzle.rules, a, b) : null;
          if (card) have.add(card.id);
        }
      }
      expect(have.has(puzzle.solution.against)).toBe(true);
      // 집어 든 두 장이 답안이 된다 (순서와 무관)
      const { statement, against } = puzzle.solution;
      expect(evidencePair(puzzle, [against, statement])).toEqual(puzzle.solution);
      expect(toAnswer(puzzle, { type: "evidence", picked: [statement, against], found: [against] })).toEqual(puzzle.solution);
    }
  });

  it("정답만 정답으로 채점된다", () => {
    const accepted = enumerateEvidence(p1.rules).filter((answer) => checkAnswer(p1, answer));
    expect(accepted).toEqual([p1.solution]);
    expect(checkAnswer(p1, { statement: "fact-sera", against: "say-sera" })).toBe(false);
    expect(checkAnswer(p1, { statement: "say-sera", against: "say-hana" })).toBe(false);
    expect(checkAnswer(p1, { statement: "say-sera", against: "nothing" })).toBe(false);
    expect(checkAnswer(p1, ["say-sera", "fact-sera"])).toBe(false);
    expect(checkAnswer(p1, null)).toBe(false);
  });

  it("진술 둘이나 기록 둘을 집으면 제출할 수 없다", () => {
    const input = (picked: string[]) => ({ type: "evidence" as const, picked, found: [] });
    expect(readiness(p1, input([])).ok).toBe(false);
    expect(readiness(p1, input(["say-sera"])).ok).toBe(false);
    expect(readiness(p1, input(["say-sera", "say-hana"])).ok).toBe(false);
    expect(readiness(p1, input(["roster", "photo"])).ok).toBe(false);
    expect(readiness(p1, input(["say-junho", "case"])).ok).toBe(true);
  });

  it("저장된 값에 없는 카드가 있으면 버린다", () => {
    const restored = restoreInput(p1, { type: "evidence", picked: ["say-sera", "ghost"], found: ["fact-sera", "ghost", "roster"] });
    expect(restored).toEqual({ type: "evidence", picked: ["say-sera"], found: ["fact-sera"] });
    expect(initialInput(p1)).toEqual({ type: "evidence", picked: [], found: [] });
  });

  it("표에서 이어지는 길을 빼면 검증이 실패한다", () => {
    const broken: EvidencePuzzle = { ...p1, rules: { ...p1.rules, derivations: [] } };
    const result = verifyPuzzle(broken);
    expect(result.solutions).toHaveLength(0);
    expect(result.ok).toBe(false);
    // 그리고 "새로 알 수 있는 것이 없다"는 답이 거짓이 된다는 것도 잡아낸다
    expect(auditEvidence(broken.rules).issues.join(" ")).toContain("표에 없다");
  });

  it("나오지 않는 사실을 표에 적으면 검증이 실패한다", () => {
    const wrong: EvidencePuzzle = {
      ...p1,
      rules: { ...p1.rules, derivations: [{ from: ["case", "gate"], card: p1.rules.derivations[0].card }] },
    };
    expect(auditEvidence(wrong.rules).issues.join(" ")).toContain("나오지 않는다");
    expect(verifyPuzzle(wrong).ok).toBe(false);
  });

  it("거짓 진술이 없거나 둘이면 검증이 실패한다", () => {
    const honest: EvidencePuzzle = {
      ...p1,
      rules: {
        ...p1.rules,
        cards: p1.rules.cards.map((card) =>
          card.id === "say-sera" ? { ...card, claim: { kind: "at", who: "sera", place: "library", time: 0 } as const } : card,
        ),
      },
    };
    expect(auditEvidence(honest.rules).falseStatements).toEqual([]);
    expect(verifyPuzzle(honest).ok).toBe(false);

    const two: EvidencePuzzle = {
      ...p1,
      rules: {
        ...p1.rules,
        cards: p1.rules.cards.map((card) =>
          card.id === "say-hana" ? { ...card, claim: { kind: "at", who: "hana", place: "office", time: 1 } as const } : card,
        ),
      },
    };
    expect(auditEvidence(two.rules).falseStatements).toHaveLength(2);
    expect(verifyPuzzle(two).ok).toBe(false);
  });

  it("기록끼리 모순이면 검증이 실패한다", () => {
    const clash: EvidencePuzzle = {
      ...p1,
      rules: {
        ...p1.rules,
        cards: [...p1.rules.cards, { id: "extra", kind: "log", label: "가짜 기록", text: "", claim: { kind: "at", who: "hana", place: "office", time: 1 } }],
      },
    };
    expect(satisfiable(clash.rules, clash.rules.cards.filter((c) => c.kind !== "statement").map((c) => c.claim))).toBe(false);
    expect(verifyPuzzle(clash).ok).toBe(false);
  });

  it("힌트가 모순인 짝을 그대로 알려 주면 점검이 실패한다", () => {
    const spoiler: EvidencePuzzle = {
      ...p1,
      hints: [p1.hints[0], { text: "세라의 말과 새 사실을 맞대어 보세요.", facts: [{ kind: "contradicts", a: "say-sera", b: "fact-sera" }] }],
    };
    const result = verifyGuidance(spoiler);
    expect(result.candidatesAfterHints).toBe(1);
    expect(result.ok).toBe(false);
    const leak: EvidencePuzzle = { ...p1, hints: [p1.hints[0], { text: "세라의 진술이 거짓입니다.", facts: [] }] };
    expect(verifyGuidance(leak).ok).toBe(false);
  });
});

describe("공간 추론 · 인장 대조", () => {
  const p1 = DAILY_SEAL_1;
  const p2 = DAILY_SEAL_2;
  const face = (puzzle: SpatialPuzzle, id: string) => puzzle.rules.stamps.find((s) => s.id === id)!.face;

  it("돌리기와 뒤집기", () => {
    const g = ["#..", "...", ".##"];
    expect(rotateGrid(g, 1)).toEqual(["..#", "#..", "#.."]);
    expect(rotateGrid(g, 4)).toEqual(g);
    expect(rotateGrid(rotateGrid(g, 1), 3)).toEqual(g);
    expect(mirrorGrid(g)).toEqual(["..#", "...", "##."]);
    expect(mirrorGrid(mirrorGrid(g))).toEqual(g);
    // 찍으면 좌우가 뒤집힌다
    expect(pressSeal(g, 0)).toEqual(mirrorGrid(g));
    expect(pressSeal(g, 1)).toEqual(mirrorGrid(rotateGrid(g, 1)));
  });

  it("도장 × 방향의 모든 경우를 검사하고, 자국과 맞는 것은 하나뿐이다", () => {
    expect(enumerateSeals(p1.rules)).toHaveLength(16);
    expect(solveSpatial(p1.rules)).toEqual([{ stamp: "clerk", turn: 2 }]);
    expect(enumerateSeals(p2.rules)).toHaveLength(16);
    expect(solveSpatial(p2.rules)).toEqual([{ stamp: "vice", turn: 1 }]);
  });

  it("그림 자료: 점의 수가 같고, 좌우 반전을 잊으면 빠지는 함정이 있다", () => {
    const a1 = auditSpatial(p1.rules);
    expect(a1.issues).toEqual([]);
    expect(a1.mirrorTraps).toEqual(["archive"]);
    expect(a1.minDifference).toBe(2);
    expect(new Set(p1.rules.stamps.map((s) => dotCount(s.face)))).toEqual(new Set([9]));

    const a2 = auditSpatial(p2.rules);
    expect(a2.issues).toEqual([]);
    expect(a2.mirrorTraps).toEqual(["steward"]);
    // 번진 문제는 한 칸 차이로 갈리는 오답이 있다
    expect(a2.minDifference).toBe(1);
    expect(new Set(p2.rules.stamps.map((s) => dotCount(s.face)))).toEqual(new Set([20]));
  });

  it("해설이 말하는 그림의 사실이 맞다", () => {
    // 1번: 함정 도장은 뒤집지 않고 돌려 보면 자국과 같다
    expect([0, 1, 2, 3].some((t) => imprintMatches(p1.rules.imprint, rotateGrid(face(p1, "archive"), t)))).toBe(true);
    expect([0, 1, 2, 3].some((t) => imprintMatches(p1.rules.imprint, pressSeal(face(p1, "archive"), t)))).toBe(false);
    // 7번: 학원장 도장은 세 번 돌려 찍으면 넷째 줄 셋째 칸 하나만 다르다
    const principal = pressSeal(face(p2, "principal"), 3);
    expect(sealDifference(p2.rules.imprint, principal)).toBe(1);
    expect(p2.rules.imprint[3][2]).toBe(".");
    expect(principal[3][2]).toBe("#");
    // 7번: 사서 도장은 두 번 돌려 찍으면 아래 다섯 줄이 맞고 맨 윗줄만 다르다
    const librarian = pressSeal(face(p2, "librarian"), 2);
    expect(librarian[0]).toBe("####.#");
    expect(p2.rules.imprint[0]).toBe("#.####");
    expect(imprintMatches(p2.rules.imprint.slice(1), librarian.slice(1))).toBe(true);
    // 7번: 번지지 않은 칸은 서른 칸
    expect(p2.rules.imprint.join("").replaceAll("?", "")).toHaveLength(30);
  });

  it("정답만 정답으로 채점된다", () => {
    for (const puzzle of [p1, p2]) {
      const accepted = enumerateSeals(puzzle.rules).filter((answer) => checkAnswer(puzzle, answer));
      expect(accepted).toEqual([puzzle.solution]);
    }
    expect(checkAnswer(p1, { stamp: "clerk", turn: 6 })).toBe(false);
    expect(checkAnswer(p1, { stamp: "nobody", turn: 2 })).toBe(false);
    expect(checkAnswer(p1, "clerk")).toBe(false);
    expect(checkAnswer(p1, null)).toBe(false);
  });

  it("화면의 조작으로 정답에 닿는다: 도장을 집고 돌린 횟수가 답안이 된다", () => {
    const input = { type: "spatial" as const, stamp: "clerk", turns: { clerk: 2, office: 1 }, trials: [] };
    expect(toAnswer(p1, input)).toEqual(p1.solution);
    expect(readiness(p1, input).ok).toBe(true);
    expect(readiness(p1, { ...input, stamp: null }).ok).toBe(false);
    expect(toAnswer(p1, { ...input, turns: {} })).toEqual({ stamp: "clerk", turn: 0 });
  });

  it("저장된 값에 없는 도장이 있거나 시험 종이를 더 쓴 기록이 있으면 버린다", () => {
    const restored = restoreInput(p2, {
      type: "spatial",
      stamp: "ghost",
      turns: { ghost: 1, vice: 3 },
      trials: [
        { stamp: "vice", turn: 0 },
        { stamp: "ghost", turn: 1 },
        { stamp: "steward", turn: 2 },
        { stamp: "principal", turn: 3 },
      ],
    });
    expect(restored).toEqual({
      type: "spatial",
      stamp: null,
      turns: { vice: 3 },
      trials: [
        { stamp: "vice", turn: 0 },
        { stamp: "steward", turn: 2 },
      ],
    });
  });

  it("자국이 다 번지면 답이 여러 개가 되어 검증이 실패한다", () => {
    const blurred: SpatialPuzzle = { ...p2, rules: { ...p2.rules, imprint: p2.rules.imprint.map(() => "??????") } };
    const result = verifyPuzzle(blurred);
    expect(result.solutions.length).toBeGreaterThan(1);
    expect(result.ok).toBe(false);
  });

  it("좌우 대칭인 도장이 답이면 검증이 실패한다(뒤집어도 같아 함정이 답과 겹친다)", () => {
    const sym = ["#.#", "###", ".#."];
    const flat: SpatialPuzzle = {
      ...p1,
      rules: {
        size: 3,
        trials: 3,
        imprint: pressSeal(sym, 0),
        stamps: [
          { id: "a", name: "가 도장", face: sym },
          { id: "b", name: "나 도장", face: ["##.", ".##", "#.."] },
        ],
      },
      solution: { stamp: "a", turn: 0 },
    };
    expect(auditSpatial(flat.rules).issues.join(" ")).toContain("좌우 대칭");
    expect(verifyPuzzle(flat).ok).toBe(false);
  });

  it("점의 수가 다른 도장이 섞이면 검증이 실패한다", () => {
    const uneven: SpatialPuzzle = {
      ...p1,
      rules: {
        ...p1.rules,
        stamps: p1.rules.stamps.map((s) => (s.id === "office" ? { ...s, face: [".....", ".#.#.", "#.###", "#.#..", "....."] } : s)),
      },
    };
    expect(auditSpatial(uneven.rules).issues.join(" ")).toContain("점의 수");
  });
});

describe("기존 유형의 새 문제", () => {
  it("순서 추론: 이웃하지 않는다는 조건을 판정한다", () => {
    expect(solveSchedule(DAILY_SCHEDULE_1.rules)).toEqual([["sera", "junho", "daon", "hana"]]);
    expect(checkAnswer(DAILY_SCHEDULE_1, ["sera", "junho", "daon", "hana"])).toBe(true);
    // 하나와 준호가 이웃하면 오답
    expect(checkAnswer(DAILY_SCHEDULE_1, ["sera", "daon", "junho", "hana"])).toBe(false);
    // 어느 조건도 군더더기가 아니다: 하나를 빼면 답이 여러 개가 된다
    DAILY_SCHEDULE_1.rules.constraints.forEach((_, skip) => {
      const rules = { ...DAILY_SCHEDULE_1.rules, constraints: DAILY_SCHEDULE_1.rules.constraints.filter((__, i) => i !== skip) };
      expect(solveSchedule(rules).length).toBeGreaterThan(1);
    });
  });

  it("진술 추리: 참이 정확히 둘인 경우는 민재뿐이다", () => {
    const rules = DAILY_TRUTH_1.rules;
    expect(["doyun", "minjae", "sea", "harin"].map((id) => countTrue(rules, id))).toEqual([1, 2, 3, 3]);
  });

  it("암호 해독: 어느 단서도 군더더기가 아니다", () => {
    const code = DAILY_SET.find((p) => p.id === "daily-code-002")!;
    if (code.type !== "code") throw new Error("암호 문제가 아니다");
    code.rules.clues.forEach((_, skip) => {
      const loose = { ...code, rules: { ...code.rules, clues: code.rules.clues.filter((__, i) => i !== skip) } };
      expect(verifyPuzzle(loose).solutions.length).toBeGreaterThan(1);
    });
  });
});
