import { describe, expect, it } from "vitest";
import { DAILY_SEAL_1, DAILY_SEAL_2 } from "../data/dailySet";
import { EXAM_SEAL_A_S, EXAM_SEAL_B_A, EXAM_SEAL_C_B, PRACTICE_SEAL_A, PRACTICE_SEAL_C, PRACTICE_SEAL_F, SEAL_SET } from "../data/sets/seal";
import { checkAnswer, verifyGuidance, verifyPuzzle } from "../engine/puzzleValidator";
import { auditSpatial, dotCount, enumerateSeals, imprintMatches, mirrorGrid, pressSeal, rotateGrid, sealDifference, solveSpatial, TURNS } from "../engine/seal";
import type { SpatialPuzzle, SpatialRules } from "../engine/types";
import { readiness, restoreInput, toAnswer } from "../games/logic";

/**
 * 인장 대조 여섯 문제(GATE 05)의 검증.
 * 정답이 하나뿐인 것만 보지 않는다: 그림 자료, 오답 도장이 답과 맺는 관계(푸는 길), 해설이 말하는 그림의 사실까지 본다.
 */

/** 시험 종이가 0장인 문제(B→A, A→S 시험)도 있다. 그림 점검은 종이의 수와 무관하게 같은 것을 본다. */
const withPaper = (rules: SpatialRules): SpatialRules => rules;

const face = (puzzle: SpatialPuzzle, id: string) => puzzle.rules.stamps.find((s) => s.id === id)!.face;
const smudged = (puzzle: SpatialPuzzle) => puzzle.rules.imprint.join("").split("?").length - 1;
const at = (grid: readonly string[], row: number, col: number) => grid[row][col];
/** 그 도장을 찍었을 때(press) 또는 돌려 보기만 했을 때(look) 자국과 다른 보이는 칸 수의 최솟값 */
const best = (puzzle: SpatialPuzzle, id: string, how: "press" | "look") =>
  Math.min(...TURNS.map((turn) => sealDifference(puzzle.rules.imprint, how === "press" ? pressSeal(face(puzzle, id), turn) : rotateGrid(face(puzzle, id), turn))));
/** 번지기 전의 자국 전체 */
const fullPrint = (puzzle: SpatialPuzzle) => pressSeal(face(puzzle, puzzle.solution.stamp), puzzle.solution.turn);
/** 크기 / 도장 수 / 번진 칸 수 / 시험 종이 수 */
const signature = (puzzle: SpatialPuzzle) => [puzzle.rules.size, puzzle.rules.stamps.length, smudged(puzzle), puzzle.rules.trials].join("/");
const each = SEAL_SET.map((p) => [p.id, p] as const);

describe("인장 대조 여섯 문제: 표의 칸", () => {
  it("순서·구분·등급·보상·힌트 수가 표와 같다", () => {
    expect(SEAL_SET.map((p) => [p.id, p.category, p.rank, p.difficulty, p.reward, p.hints.length])).toEqual([
      ["practice-seal-f", "practice", "F", 1, 30, 2],
      ["practice-seal-c", "practice", "C", 3, 40, 2],
      ["exam-seal-c-b", "exam", "C", 3, 0, 2],
      ["practice-seal-a", "practice", "A", 5, 50, 2],
      ["exam-seal-b-a", "exam", "B", 4, 0, 0],
      ["exam-seal-a-s", "exam", "A", 5, 0, 0],
    ]);
    expect(SEAL_SET).toEqual([PRACTICE_SEAL_F, PRACTICE_SEAL_C, EXAM_SEAL_C_B, PRACTICE_SEAL_A, EXAM_SEAL_B_A, EXAM_SEAL_A_S]);
    expect(SEAL_SET.every((p) => p.type === "spatial" && p.typeLabel === DAILY_SEAL_1.typeLabel)).toBe(true);
    // 제목은 서로, 그리고 기존 인장 문제와 겹치지 않는다
    const titles = [...SEAL_SET, DAILY_SEAL_1, DAILY_SEAL_2].map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it.each(each)("%s: 여는 글과 닫는 글이 한두 문장이고 64자 이하다", (_id, puzzle) => {
    for (const text of [puzzle.intro, puzzle.outro]) {
      expect(text).toBeTruthy();
      expect(text!.split(/[.?!]\s/).length).toBeLessThanOrEqual(2);
      expect(text!.length).toBeLessThanOrEqual(64);
    }
    expect(puzzle.minutes).toBeGreaterThanOrEqual(2);
    expect(puzzle.minutes).toBeLessThanOrEqual(6);
    expect(puzzle.description.length).toBeGreaterThan(20);
  });

  it.each(each)("%s: 화면의 한계 안이다 (5×5 또는 6×6, 도장 넷 이하, 시험 종이 0~3장, 짧은 도장 이름)", (_id, puzzle) => {
    const { size, stamps, trials, imprint } = puzzle.rules;
    expect([5, 6]).toContain(size);
    expect(stamps.length).toBeLessThanOrEqual(4);
    expect(trials).toBeGreaterThanOrEqual(0);
    expect(trials).toBeLessThanOrEqual(3);
    expect(imprint).toHaveLength(size);
    for (const stamp of stamps) {
      expect(stamp.name.endsWith(" 도장")).toBe(true);
      // 도장 줄에는 " 도장"을 뗀 이름이 찍힌다
      expect(stamp.name.replace(" 도장", "").length).toBeLessThanOrEqual(3);
    }
    expect(new Set(stamps.map((s) => s.name)).size).toBe(stamps.length);
  });
});

describe("인장 대조 여섯 문제: 정답과 그림 자료", () => {
  it.each(each)("%s: 도장 × 방향을 모두 찍어 보면 자국과 맞는 것은 선언한 답 하나뿐이다", (_id, puzzle) => {
    const result = verifyPuzzle(puzzle);
    expect(result.issues).toEqual([]);
    expect(result.solutions).toEqual([puzzle.solution]);
    expect(result.unique).toBe(true);
    expect(result.matchesDeclared).toBe(true);
    expect(result.ok).toBe(true);
    // 찍어서 맞히기: 도장 수 × 네 방향
    expect(result.candidateCount).toBe(puzzle.rules.stamps.length * 4);
    expect(solveSpatial(puzzle.rules)).toEqual([puzzle.solution]);
  });

  it("후보 수: 입문은 12, 나머지는 16", () => {
    expect(SEAL_SET.map((p) => enumerateSeals(p.rules).length)).toEqual([12, 16, 16, 16, 16, 16]);
  });

  it.each(each)("%s: 정답만 정답으로 채점되고, 화면의 조작(도장을 집고 돌린 횟수)으로 정답에 닿는다", (_id, puzzle) => {
    const accepted = enumerateSeals(puzzle.rules).filter((answer) => checkAnswer(puzzle, answer));
    expect(accepted).toEqual([puzzle.solution]);
    const { stamp, turn } = puzzle.solution;
    const input = { type: "spatial" as const, stamp, turns: { [stamp]: turn }, trials: [] };
    expect(readiness(puzzle, input).ok).toBe(true);
    expect(toAnswer(puzzle, input)).toEqual(puzzle.solution);
    // 저장된 값에 시험 종이를 더 쓴 기록이 있으면 버린다(종이가 0장이면 하나도 남지 않는다)
    const many = TURNS.map((t) => ({ stamp, turn: t }));
    expect(restoreInput(puzzle, { ...input, trials: many })).toEqual({ ...input, trials: many.slice(0, puzzle.rules.trials) });
  });

  it.each(each)("%s: 힌트와 해설이 답과 맞고, 힌트만으로 답이 드러나지 않는다", (_id, puzzle) => {
    const result = verifyGuidance(puzzle);
    expect(result.issues).toEqual([]);
    expect(result.candidatesAfterHints).toBeGreaterThanOrEqual(2);
    expect(puzzle.explanation.length).toBeGreaterThanOrEqual(3);
    // 해설의 마지막 단계는 방향 셋을 지워 답의 방향만 남긴다
    const last = puzzle.explanation[puzzle.explanation.length - 1].facts;
    expect(last.map((fact) => (fact.kind === "turnIsNot" ? fact.turn : -1)).sort()).toEqual(TURNS.filter((t) => t !== puzzle.solution.turn));
    // 해설은 답이 아닌 도장을 모두 한 번씩 지운다
    const ruledOut = new Set(puzzle.explanation.flatMap((step) => step.facts).flatMap((fact) => (fact.kind === "stampIsNot" ? [fact.stamp] : [])));
    expect([...ruledOut].sort()).toEqual(puzzle.rules.stamps.map((s) => s.id).filter((id) => id !== puzzle.solution.stamp).sort());
  });

  it("그림 자료: 도장끼리 점의 수가 같고, 같은 자국이 둘 나오지 않고, 좌우 반전을 잊으면 빠지는 함정이 하나씩 있다", () => {
    const audits = SEAL_SET.map((p) => auditSpatial(withPaper(p.rules)));
    expect(audits.map((a) => a.issues)).toEqual([[], [], [], [], [], []]);
    expect(audits.map((a) => a.mirrorTraps)).toEqual([["west"], ["reading"], ["dining"], ["dark"], ["auditorium"], ["winter"]]);
    // 오답 후보가 자국과 다른 보이는 칸 수의 최솟값: 입문은 넉넉하고, 번진 두 문제는 한 칸으로 갈린다
    expect(audits.map((a) => a.minDifference)).toEqual([4, 2, 2, 1, 10, 1]);
    expect(SEAL_SET.map((p) => [...new Set(p.rules.stamps.map((s) => dotCount(s.face)))])).toEqual([[11], [11], [9], [12], [17], [12]]);
  });

  it("시험 종이가 0장인 두 문제도 그림 점검을 그대로 통과한다", () => {
    for (const puzzle of [EXAM_SEAL_B_A, EXAM_SEAL_A_S]) {
      expect(puzzle.rules.trials).toBe(0);
      expect(auditSpatial(puzzle.rules).issues).toEqual([]);
      expect(verifyPuzzle(puzzle).ok).toBe(true);
    }
    // 시험 종이의 수가 음수이거나 정수가 아니면 걸린다
    expect(auditSpatial({ ...EXAM_SEAL_B_A.rules, trials: -1 }).issues).toEqual(["시험 종이의 수가 맞지 않는다"]);
    expect(auditSpatial({ ...EXAM_SEAL_B_A.rules, trials: 1.5 }).issues).toEqual(["시험 종이의 수가 맞지 않는다"]);
  });
});

describe("인장 대조 여섯 문제: 푸는 길이 서로 다르다", () => {
  it("크기 / 도장 수 / 번진 칸 수 / 시험 종이 수의 조합이 서로, 그리고 일일 문제의 두 문제와 겹치지 않는다", () => {
    expect(SEAL_SET.map(signature)).toEqual(["5/3/0/3", "5/4/0/2", "5/4/0/1", "6/4/14/1", "6/4/0/0", "6/4/8/0"]);
    const all = [...SEAL_SET, DAILY_SEAL_1, DAILY_SEAL_2].map(signature);
    expect(new Set(all).size).toBe(all.length);
  });

  it("연습 F: 도장이 셋뿐이고, 오답은 거울상 하나와 눈에 띄게 다른 하나다", () => {
    const p = PRACTICE_SEAL_F;
    expect(face(p, "west")).toEqual(mirrorGrid(face(p, "east")));
    expect(best(p, "west", "look")).toBe(0);
    expect(best(p, "west", "press")).toBe(6);
    expect(best(p, "main", "press")).toBe(4);
  });

  it("연습 C: 거울상 하나에, 같은 쪽으로 뻗는 닮은꼴 둘이 두 칸·네 칸 차이로 섞여 있고 놓인 방향이 제각각이다", () => {
    const p = PRACTICE_SEAL_C;
    expect(best(p, "reading", "look")).toBe(0);
    expect(best(p, "stacks", "press")).toBe(2);
    expect(best(p, "bindery", "press")).toBe(4);
    expect(best(p, "reading", "press")).toBe(6);
    // 닮은꼴 둘은 뒤집지 않고 보아도 자국과 같지 않다(거울상이 아니다)
    expect(best(p, "stacks", "look")).toBeGreaterThan(0);
    expect(best(p, "bindery", "look")).toBeGreaterThan(0);
    // 받침이 아래로 오게 세우려면 도장마다 돌리는 횟수가 다르다
    const upright = (id: string) => TURNS.find((turn) => rotateGrid(face(p, id), turn)[4].startsWith("###") || rotateGrid(face(p, id), turn)[4].endsWith("###"));
    expect(["reading", "stacks", "scribe", "bindery"].map(upright)).toEqual([3, 2, 1, 0]);
  });

  it("시험 C→B: 두 가지 특징(손잡이의 쪽, 불꽃의 쪽)의 네 조합이다. 같은 쪽인 둘은 서로 거울상이고, 반대쪽인 둘도 서로 거울상이다", () => {
    const p = EXAM_SEAL_C_B;
    expect(face(p, "dining")).toEqual(mirrorGrid(face(p, "belfry")));
    expect(face(p, "storage")).toEqual(mirrorGrid(face(p, "greenhouse")));
    expect(best(p, "dining", "look")).toBe(0);
    expect([best(p, "greenhouse", "press"), best(p, "storage", "press"), best(p, "dining", "press")]).toEqual([2, 4, 6]);
  });

  it("연습 A: 닮은꼴 둘은 답과 두 칸씩 다르지만 한 칸이 번져, 저마다 다른 보이는 한 칸으로만 가려진다", () => {
    const p = PRACTICE_SEAL_A;
    const full = fullPrint(p);
    const twin = (id: string, turn: number) => {
      const printed = pressSeal(face(p, id), turn);
      const cells: string[] = [];
      p.rules.imprint.forEach((row, r) => [...row].forEach((ch, c) => ch !== "?" && ch !== printed[r][c] && cells.push(`${r},${c}`)));
      return { whole: sealDifference(full, printed), visible: cells };
    };
    expect(twin("lab", 0)).toEqual({ whole: 2, visible: ["5,3"] });
    expect(twin("analysis", 1)).toEqual({ whole: 2, visible: ["1,5"] });
    expect(best(p, "lab", "press")).toBe(1);
    expect(best(p, "analysis", "press")).toBe(1);
    // 거울상은 찍으면 네 칸이 다르다
    expect(best(p, "dark", "look")).toBe(0);
    expect(best(p, "dark", "press")).toBe(4);
    // 그 한 칸마저 번지면 닮은꼴도 답이 된다(그 칸이 결정적이다)
    const blur = (row: number, col: number) => p.rules.imprint.map((line, r) => (r === row ? `${line.slice(0, col)}?${line.slice(col + 1)}` : line));
    expect(solveSpatial({ ...p.rules, imprint: blur(5, 3) }).map((a) => a.stamp).sort()).toEqual(["lab", "sample"]);
    expect(solveSpatial({ ...p.rules, imprint: blur(1, 5) }).map((a) => a.stamp).sort()).toEqual(["analysis", "sample"]);
  });

  it("시험 B→A: 자국과 닮은 도장이 셋이고(똑같은 것 하나, 두 칸 다른 것 둘) 셋 다 답이 아니다. 닮지 않은 하나가 답이다", () => {
    const p = EXAM_SEAL_B_A;
    expect([best(p, "auditorium", "look"), best(p, "mainhall", "look"), best(p, "gym", "look")]).toEqual([0, 2, 2]);
    expect(best(p, "annex", "look")).toBe(10);
    // 닮은 셋은 찍으면 열 칸 넘게 어긋난다
    for (const id of ["auditorium", "mainhall", "gym"]) expect(best(p, id, "press")).toBeGreaterThanOrEqual(10);
    expect(best(p, "annex", "press")).toBe(0);
  });

  it("시험 A→S: 거의 대칭인 무늬라 거울상을 찍어도 두 칸만 다르다. 닮은꼴 둘은 서로 다른 이유의 한 칸으로 지워진다", () => {
    const p = EXAM_SEAL_A_S;
    const full = fullPrint(p);
    expect(best(p, "winter", "look")).toBe(0);
    expect(best(p, "winter", "press")).toBe(2);
    // 봄: 보이는 별의 자리(넷째 줄 둘째 칸)가 빈다
    const spring = pressSeal(face(p, "spring"), 0);
    expect(sealDifference(p.rules.imprint, spring)).toBe(1);
    expect([at(p.rules.imprint, 3, 1), at(spring, 3, 1)]).toEqual(["#", "."]);
    expect(sealDifference(full, spring)).toBe(2);
    // 여름: 보이는 빈칸(다섯째 줄 둘째 칸)에 별이 찍힌다
    const summer = pressSeal(face(p, "summer"), 3);
    expect(sealDifference(p.rules.imprint, summer)).toBe(1);
    expect([at(p.rules.imprint, 4, 1), at(summer, 4, 1)]).toEqual([".", "#"]);
    expect(sealDifference(full, summer)).toBe(2);
    // 그 두 칸이 번지면 답이 갈린다
    const blur = (row: number, col: number) => p.rules.imprint.map((line, r) => (r === row ? `${line.slice(0, col)}?${line.slice(col + 1)}` : line));
    expect(solveSpatial({ ...p.rules, imprint: blur(3, 1) }).map((a) => a.stamp).sort()).toEqual(["autumn", "spring"]);
    expect(solveSpatial({ ...p.rules, imprint: blur(4, 1) }).map((a) => a.stamp).sort()).toEqual(["autumn", "summer"]);
  });

  it("번진 두 문제: 번진 칸을 걷어 내면 답의 자국 전체가 나오고, 번진 칸은 자국의 점을 실제로 가리고 있다", () => {
    for (const p of [PRACTICE_SEAL_A, EXAM_SEAL_A_S]) {
      const full = fullPrint(p);
      expect(imprintMatches(p.rules.imprint, full)).toBe(true);
      const hiddenDots = p.rules.imprint.flatMap((row, r) => [...row].filter((ch, c) => ch === "?" && full[r][c] === "#")).length;
      expect(hiddenDots).toBeGreaterThanOrEqual(1);
      expect(dotCount(p.rules.imprint) + hiddenDots).toBe(dotCount(full));
    }
    // 연습 A 는 점 열둘 가운데 일곱이, 시험 A→S 는 별 하나만 가려졌다
    expect(dotCount(PRACTICE_SEAL_A.rules.imprint)).toBe(5);
    expect(dotCount(EXAM_SEAL_A_S.rules.imprint)).toBe(11);
  });
});

describe("인장 대조 여섯 문제: 해설이 말하는 그림의 사실", () => {
  const column = (grid: readonly string[], col: number) => grid.map((row) => row[col]).join("");

  it("연습 F: 동문 도장의 깃발은 장대 끝에서 오른쪽으로, 정문 도장의 깃발은 장대 가운데에 달려 있다", () => {
    const p = PRACTICE_SEAL_F;
    // 장대는 왼쪽에서 둘째 줄, 맨 아랫줄은 받침
    for (const id of ["east", "main"]) {
      expect(column(face(p, id), 1)).toBe("#####");
      expect(face(p, id)[4]).toBe("###..");
    }
    // 장대 오른쪽에 붙은 깃발의 줄: 동문은 위 세 줄, 정문은 가운데 세 줄
    const flagRows = (id: string) => face(p, id).map((row, r) => (r < 4 && row[2] === "#" ? r : -1)).filter((r) => r >= 0);
    expect(flagRows("east")).toEqual([0, 1, 2]);
    expect(flagRows("main")).toEqual([1, 2, 3]);
    // 서문 도장은 세 번 돌려 보면 자국과 같고, 동문 도장은 한 번 돌려 찍으면 겹친다
    expect(rotateGrid(face(p, "west"), 3)).toEqual(p.rules.imprint);
    expect(pressSeal(face(p, "east"), 1)).toEqual(p.rules.imprint);
    expect(TURNS.some((turn) => imprintMatches(p.rules.imprint, pressSeal(face(p, "west"), turn)))).toBe(false);
  });

  it("연습 C: 받침을 아래로 세우면 열람실만 팔이 왼쪽, 제본실은 팔이 한 칸 아래, 서고는 등줄 한 칸·받침 네 칸", () => {
    const p = PRACTICE_SEAL_C;
    const upright = { reading: rotateGrid(face(p, "reading"), 3), stacks: rotateGrid(face(p, "stacks"), 2), scribe: rotateGrid(face(p, "scribe"), 1), bindery: face(p, "bindery") };
    const shape = (grid: readonly string[]) => {
      const pole = [0, 1, 2, 3, 4].find((c) => column(grid, c) === "#####")!;
      // 등은 기둥에서 두 칸 떨어진 줄에 매달린다
      const lampCol = [pole - 2, pole + 2].find((c) => c >= 0 && c < 5 && column(grid, c).slice(0, 4).includes("#"))!;
      const armRow = grid.findIndex((row) => row[lampCol] === "#");
      const cord = column(grid, lampCol).slice(armRow + 1, 4).split("#").length - 1;
      return { side: lampCol > pole ? "오른쪽" : "왼쪽", armRow, cord, base: dotCount([grid[4]]) };
    };
    expect(shape(upright.scribe)).toEqual({ side: "오른쪽", armRow: 0, cord: 2, base: 3 });
    expect(shape(upright.reading)).toEqual({ side: "왼쪽", armRow: 0, cord: 2, base: 3 });
    expect(shape(upright.stacks)).toEqual({ side: "오른쪽", armRow: 0, cord: 1, base: 4 });
    expect(shape(upright.bindery)).toEqual({ side: "오른쪽", armRow: 1, cord: 2, base: 3 });
    // 열람실 도장은 답의 거울상이고, 두 번 돌려 보면 자국과 같다
    expect(upright.reading).toEqual(mirrorGrid(upright.scribe));
    expect(rotateGrid(face(p, "reading"), 2)).toEqual(p.rules.imprint);
    expect(pressSeal(face(p, "scribe"), 2)).toEqual(p.rules.imprint);
  });

  it("시험 C→B: 자국에서 손잡이와 불꽃은 반대쪽이고, 온실·창고 도장은 같은 쪽이다", () => {
    const p = EXAM_SEAL_C_B;
    // 초는 가운데 줄, 불꽃은 맨 윗줄, 손잡이는 넷째 줄의 양 끝 가운데 한 곳
    const sides = (grid: readonly string[]) => ({ flame: grid[0].indexOf("#") < 2 ? "왼쪽" : "오른쪽", handle: grid[3][0] === "#" ? "왼쪽" : "오른쪽" });
    for (const stamp of p.rules.stamps) expect(column(stamp.face, 2).slice(1)).toBe("####");
    expect(sides(face(p, "belfry"))).toEqual({ flame: "오른쪽", handle: "왼쪽" });
    expect(sides(face(p, "dining"))).toEqual({ flame: "왼쪽", handle: "오른쪽" });
    expect(sides(face(p, "greenhouse"))).toEqual({ flame: "왼쪽", handle: "왼쪽" });
    expect(sides(face(p, "storage"))).toEqual({ flame: "오른쪽", handle: "오른쪽" });
    // 자국을 바로 세우면 식당 도장의 면과 같다(반대쪽). 식당 도장은 한 번 돌려 보면 자국과 같다.
    expect(TURNS.some((turn) => rotateGrid(p.rules.imprint, turn).join("/") === face(p, "dining").join("/"))).toBe(true);
    expect(rotateGrid(face(p, "dining"), 1)).toEqual(p.rules.imprint);
    expect(pressSeal(face(p, "belfry"), 3)).toEqual(p.rules.imprint);
  });

  it("연습 A: 번진 칸은 열넷, 보이는 칸은 스물둘이고, 빛점은 보이지 않는다", () => {
    const p = PRACTICE_SEAL_A;
    expect(smudged(p)).toBe(14);
    expect(p.rules.imprint.join("").replaceAll("?", "")).toHaveLength(22);
    // 암실 도장은 돌리지 않아도 보이는 칸이 모두 같다
    expect(imprintMatches(p.rules.imprint, face(p, "dark"))).toBe(true);
    // 빛점이 찍히는 칸: 감식실(돌리지 않고) 맨 아랫줄 넷째 칸, 분석실(한 번) 둘째 줄 맨 오른쪽 칸, 표본실(세 번) 맨 아랫줄 둘째 칸
    const full = fullPrint(p);
    expect([at(pressSeal(face(p, "lab"), 0), 5, 3), at(p.rules.imprint, 5, 3)]).toEqual(["#", "."]);
    expect([at(pressSeal(face(p, "analysis"), 1), 1, 5), at(p.rules.imprint, 1, 5)]).toEqual(["#", "."]);
    expect([at(full, 5, 1), at(p.rules.imprint, 5, 1)]).toEqual(["#", "?"]);
    // 세 도장 모두 그렇게 찍으면 렌즈와 자루(빛점을 뺀 열한 칸)는 답의 자국과 같다
    const body = (grid: readonly string[], row: number, col: number) => grid.map((line, r) => (r === row ? `${line.slice(0, col)}.${line.slice(col + 1)}` : line));
    expect(body(pressSeal(face(p, "lab"), 0), 5, 3)).toEqual(body(full, 5, 1));
    expect(body(pressSeal(face(p, "analysis"), 1), 1, 5)).toEqual(body(full, 5, 1));
    // 보이는 점은 렌즈의 테 넷과 자루 끝 하나
    expect(p.rules.imprint.map((row) => row.replaceAll("?", "."))).toEqual([".##...", "#.....", "#.....", ".....#", "......", "......"]);
  });

  it("시험 B→A: 자국의 우산을 바로 세우면 손잡이가 오른쪽으로 굽고, 별관 도장은 왼쪽으로 굽는다", () => {
    const p = EXAM_SEAL_B_A;
    const uprightImprint = rotateGrid(p.rules.imprint, 2);
    const uprightAnnex = rotateGrid(face(p, "annex"), 3);
    // 우산 지붕은 위 세 줄
    for (const grid of [uprightImprint, uprightAnnex]) expect(grid.slice(0, 3)).toEqual(["..##..", ".####.", "######"]);
    // 손잡이: 자국은 우산대(넷째 칸)의 오른쪽으로, 별관 도장은 우산대(셋째 칸)의 왼쪽으로 굽는다
    expect(uprightImprint.slice(3)).toEqual(["...#..", "...#.#", "...##."]);
    expect(uprightAnnex.slice(3)).toEqual(["..#...", "#.#...", ".##..."]);
    expect(uprightAnnex).toEqual(mirrorGrid(uprightImprint));
    // 강당 도장은 돌리지 않아도 자국과 같다. 본관은 손잡이 끝이 눕고, 체육관은 꼭지가 한 칸 치우쳤다.
    expect(face(p, "auditorium")).toEqual(p.rules.imprint);
    expect(rotateGrid(face(p, "mainhall"), 1).slice(3)).toEqual(["...#..", "...#..", "...###"]);
    expect(face(p, "gym")[0]).toBe("...##.");
    expect(face(p, "gym").slice(1)).toEqual(uprightImprint.slice(1));
    expect(pressSeal(face(p, "annex"), 1)).toEqual(p.rules.imprint);
  });

  it("시험 A→S: 달은 왼쪽으로 열려 있고, 보이는 별은 넷째 줄 둘째 칸 하나뿐이며 그 아래 칸은 비어 있다", () => {
    const p = EXAM_SEAL_A_S;
    const { imprint } = p.rules;
    expect(smudged(p)).toBe(8);
    expect(imprint.join("").replaceAll("?", "")).toHaveLength(28);
    // 달의 점 열 개는 오른쪽 세 줄에 있고(왼쪽으로 열렸다) 하나도 번지지 않았다
    expect(imprint.map((row) => row.slice(3))).toEqual(["##.", ".##", "..#", "..#", ".##", "##."]);
    // 왼쪽 세 줄에서 보이는 점은 별 하나뿐
    expect(imprint.map((row) => row.slice(0, 3))).toEqual(["??.", "???", "???", ".#.", "...", "..."]);
    expect([at(imprint, 3, 1), at(imprint, 4, 1), at(imprint, 5, 1)]).toEqual(["#", ".", "."]);
    // 겨울 도장은 돌리지 않아도 보이는 칸이 모두 같다
    expect(imprintMatches(imprint, face(p, "winter"))).toBe(true);
    // 가을 도장을 한 번 돌려 찍으면 별 하나는 보이는 자리에, 하나는 번진 곳(둘째 줄 둘째 칸)에 들어간다
    const full = fullPrint(p);
    expect([at(full, 3, 1), at(full, 1, 1), at(imprint, 1, 1)]).toEqual(["#", "#", "?"]);
    // 봄 도장은 달이 맞게 찍으면 별 둘이 모두 번진 곳에 들어간다
    const spring = pressSeal(face(p, "spring"), 0);
    expect([at(spring, 1, 1), at(spring, 2, 1), at(imprint, 1, 1), at(imprint, 2, 1)]).toEqual(["#", "#", "?", "?"]);
    // 달 자체는 뒤집어도 같다: 별을 지우면 가을과 겨울의 자국이 같다
    const moonOnly = (grid: readonly string[]) => grid.map((row) => `...${row.slice(3)}`);
    expect(moonOnly(pressSeal(face(p, "winter"), 2))).toEqual(moonOnly(full));
  });
});
