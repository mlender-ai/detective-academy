/**
 * 수사 크레딧 정책과 계산.
 * 프로토타입 임시 수치다. 결제·광고 없이 기본 지급분과 해결 보상만 쓴다.
 */
import type { PuzzleProgress } from "./types";

export const CREDIT_POLICY = {
  /** 입학 시 최초 지급 */
  initial: 40,
  /** 힌트 단계별 비용 (1단계, 2단계) */
  hintCosts: [20, 40],
} as const;

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
