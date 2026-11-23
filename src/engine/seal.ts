/**
 * 인장 대조(공간 추론)의 규칙.
 * 도장 면은 격자다. 도장을 종이에 찍으면 자국은 도장 면의 좌우가 뒤집힌 모양이 된다.
 * 도장은 시계 방향으로 0~3번 돌려서 찍을 수 있다.
 */
import type { SpatialRules, SpatialSolution } from "./types";

export type Grid = readonly string[];

/** 시계 방향으로 turn 번(90도씩) 돌린다 */
export function rotateGrid(grid: Grid, turn: number): string[] {
  let current = [...grid];
  const times = ((turn % 4) + 4) % 4;
  for (let k = 0; k < times; k++) {
    const n = current.length;
    const next: string[] = [];
    for (let row = 0; row < n; row++) {
      let line = "";
      for (let col = 0; col < n; col++) line += current[n - 1 - col][row];
      next.push(line);
    }
    current = next;
  }
  return current;
}

/** 좌우를 뒤집는다 */
export function mirrorGrid(grid: Grid): string[] {
  return grid.map((row) => [...row].reverse().join(""));
}

/** 지금 보이는 방향(turn)의 도장 면 */
export function sealFace(face: Grid, turn: number): string[] {
  return rotateGrid(face, turn);
}

/** 그 방향으로 찍었을 때 종이에 남는 자국 */
export function pressSeal(face: Grid, turn: number): string[] {
  return mirrorGrid(rotateGrid(face, turn));
}

/** 자국에서 알아볼 수 있는 칸('?' 가 아닌 칸) 가운데 찍은 것과 다른 칸의 수 */
export function sealDifference(imprint: Grid, printed: Grid): number {
  let diff = 0;
  imprint.forEach((row, r) => {
    [...row].forEach((cell, c) => {
      if (cell !== "?" && cell !== printed[r]?.[c]) diff += 1;
    });
  });
  return diff;
}

export function imprintMatches(imprint: Grid, printed: Grid): boolean {
  return imprint.length === printed.length && sealDifference(imprint, printed) === 0;
}

export function dotCount(grid: Grid): number {
  return grid.join("").split("#").length - 1;
}

export const TURNS = [0, 1, 2, 3] as const;

/** 도장 × 방향의 모든 경우 */
export function enumerateSeals(rules: SpatialRules): SpatialSolution[] {
  return rules.stamps.flatMap((stamp) => TURNS.map((turn) => ({ stamp: stamp.id, turn })));
}

export function sealAnswerHolds(rules: SpatialRules, answer: SpatialSolution): boolean {
  const stamp = rules.stamps.find((s) => s.id === answer.stamp);
  if (!stamp || !TURNS.includes(answer.turn as 0 | 1 | 2 | 3)) return false;
  return imprintMatches(rules.imprint, pressSeal(stamp.face, answer.turn));
}

export function solveSpatial(rules: SpatialRules): SpatialSolution[] {
  return enumerateSeals(rules).filter((answer) => sealAnswerHolds(rules, answer));
}

export interface SealAudit {
  issues: string[];
  /** 오답 후보의 자국이 실제 자국과 다른 칸 수의 최솟값 (작을수록 가려내기 어렵다) */
  minDifference: number;
  /** 뒤집지 않고 보면 자국과 똑같아 보이는 도장 (좌우 반전을 잊으면 고르게 되는 함정) */
  mirrorTraps: string[];
}

/**
 * 그림 자료 점검: 격자가 반듯한지, 도장끼리 점의 수가 같은지(점을 세는 것만으로 가려지지 않게),
 * 어느 도장도 돌려서 같은 자국이 두 번 나오지 않는지, 좌우 반전을 잊은 사람이 빠지는 함정이 있는지.
 */
export function auditSpatial(rules: SpatialRules): SealAudit {
  const issues: string[] = [];
  const { size, imprint, stamps } = rules;
  const wellFormed = (grid: Grid, cells: string) =>
    grid.length === size && grid.every((row) => row.length === size && [...row].every((ch) => cells.includes(ch)));

  if (!wellFormed(imprint, "#.?")) issues.push("자국의 격자가 반듯하지 않다");
  stamps.forEach((stamp) => {
    if (!wellFormed(stamp.face, "#.")) issues.push(`${stamp.name}: 도장 면의 격자가 반듯하지 않다`);
  });
  if (new Set(stamps.map((s) => s.id)).size !== stamps.length) issues.push("도장의 이름표가 겹친다");
  // 시험 종이가 0장인 문제도 있다(높은 등급의 시험: 머릿속으로만 돌리고 뒤집는다)
  if (!Number.isInteger(rules.trials) || rules.trials < 0) issues.push("시험 종이의 수가 맞지 않는다");
  if (issues.length > 0) return { issues, minDifference: 0, mirrorTraps: [] };

  const counts = new Set(stamps.map((s) => dotCount(s.face)));
  if (counts.size !== 1) issues.push("도장마다 점의 수가 달라, 점만 세어도 가려진다");

  // 어느 두 (도장, 방향)도 같은 자국을 내면 안 된다: 대칭인 도장이나 똑같은 도장이 섞이면 답이 갈린다.
  const prints = enumerateSeals(rules).map((answer) => ({
    answer,
    print: pressSeal(stamps.find((s) => s.id === answer.stamp)!.face, answer.turn).join("/"),
  }));
  for (let i = 0; i < prints.length; i++) {
    for (let j = i + 1; j < prints.length; j++) {
      if (prints[i].print === prints[j].print) {
        issues.push(`${prints[i].answer.stamp}(${prints[i].answer.turn})와 ${prints[j].answer.stamp}(${prints[j].answer.turn})가 같은 자국을 낸다`);
      }
    }
  }

  const solutions = solveSpatial(rules);
  const wrong = enumerateSeals(rules).filter((a) => !solutions.some((s) => s.stamp === a.stamp && s.turn === a.turn));
  const minDifference = Math.min(
    ...wrong.map((a) => sealDifference(imprint, pressSeal(stamps.find((s) => s.id === a.stamp)!.face, a.turn))),
  );

  // 함정: 찍지 않고(뒤집지 않고) 도장 면을 돌려 보기만 하면 자국과 같아 보이는 도장
  const mirrorTraps = stamps
    .filter((stamp) => TURNS.some((turn) => imprintMatches(imprint, rotateGrid(stamp.face, turn))))
    .map((stamp) => stamp.id);
  if (mirrorTraps.length === 0) issues.push("좌우 반전을 잊은 사람이 고르게 되는 도장이 없다");
  if (mirrorTraps.some((id) => solutions.some((s) => s.stamp === id))) {
    issues.push("자국이 좌우 대칭이라 뒤집어도 같은 도장이 답이 된다");
  }

  return { issues, minDifference, mirrorTraps };
}
