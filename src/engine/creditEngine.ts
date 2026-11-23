/**
 * 수사 크레딧 정책과 계산.
 * 초기 실험값이다. 결제·광고·상점 없이 기본 지급분과 해결 보상만 쓰고, 쓰는 곳은 수사 지원(힌트)뿐이다.
 *
 * 밸런스의 뼈대 (GATE 05 에서 검토):
 *  - 문제 하나의 보상은 힌트 두 단계의 값(60)보다 작거나 같다. 문제마다 힌트를 끝까지 여는 사람은 잔액이 줄고,
 *    한 단계만 여는 사람은 조금씩 는다. 힌트를 "다음 추리를 위해 아껴 쓰는 자원"으로 두기 위해서다.
 *  - 보상은 언제나 1단계 힌트의 값(20)보다 크다. 문제를 풀면 다음 문제의 첫 힌트는 살 수 있다.
 *  - 크레딧이 없어도 모든 문제를 풀 수 있다(힌트만 못 연다).
 */
import type { PuzzleCategory, PuzzleProgress, RankId } from "./types";

export const CREDIT_POLICY = {
  /** 입학 시 최초 지급 */
  initial: 40,
  /** 힌트 단계별 비용 (1단계, 2단계) */
  hintCosts: [20, 40],
  /** 오늘의 추리 최초 해결 */
  daily: 60,
  /** 연습 문제 최초 해결: 그 문제의 권장 등급에 따라 */
  practice: { F: 30, D: 35, C: 40, B: 45, A: 50, S: 50 } as Record<RankId, number>,
  /**
   * 특수 도전(special 로 표시한 연습 과제) 최초 해결. 놓인 서랍의 등급과 무관하게 이 값이다.
   * 가장 높은 연습 보상(50)보다 크고 가장 낮은 합격 보상(80)보다 작게, 오늘의 추리와 같은 60 으로 두었다:
   * 힌트 두 단계의 값(60)을 넘지 않아 "힌트를 끝까지 열면 남는 것이 없다"는 뼈대가 그대로 선다.
   */
  special: 60,
  /**
   * 연습실에서 하루에 받을 수 있는 신규 보상의 횟수. null 이면 제한이 없다.
   * 검토 결과: 연습 문제가 15개로 한정된 지금은 받을 수 있는 총액(600)이 정해져 있어 두지 않는다.
   * 문제가 계속 늘어나는 구조가 되면 숫자를 넣는다.
   */
  practiceRewardsPerDay: null as number | null,
} as const;

/** 문제 하나의 최초 해결 보상. 시험 문제는 0 이다(합격 보상은 시험 규칙이 준다). 특수 도전은 등급과 무관하게 special 값이다. */
export function policyReward(category: PuzzleCategory, rank: RankId | undefined, special = false): number {
  if (category === "daily") return CREDIT_POLICY.daily;
  if (category === "practice") return special ? CREDIT_POLICY.special : CREDIT_POLICY.practice[rank ?? "F"];
  return 0;
}

export function hintCost(tierIndex: number): number | null {
  return CREDIT_POLICY.hintCosts[tierIndex] ?? null;
}

export function canAfford(credits: number, cost: number): boolean {
  return cost >= 0 && credits >= cost;
}

export type SpendResult = { ok: true; credits: number } | { ok: false; credits: number };

/** 잔액이 모자라면 차감하지 않는다. 잔액은 음수가 되지 않는다. */
export function spend(credits: number, cost: number): SpendResult {
  if (!canAfford(credits, cost)) return { ok: false, credits };
  return { ok: true, credits: credits - cost };
}

/** 문제별 최초 해결 보상. 이미 받았다면 0을 돌려준다. */
export function rewardFor(progress: PuzzleProgress, reward: number): number {
  return progress.rewardClaimed ? 0 : Math.max(0, reward);
}
