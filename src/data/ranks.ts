/**
 * 탐정 등급과 승급 조건.
 * 데모 전용 수치다. 등급·조건·필요 문제 수는 이 파일만 바꾸면 된다.
 */
import type { PuzzleCategory, RankId } from "../engine/types";

export interface RankDef {
  id: RankId;
  title: string;
  /** 배지 재질 이름 (신분증·등급표에 표기) */
  material: string;
}

export const RANKS: RankDef[] = [
  { id: "F", title: "견습 탐정", material: "무쇠" },
  { id: "D", title: "초급 탐정", material: "청동" },
  { id: "C", title: "정식 탐정", material: "강철" },
  { id: "B", title: "상급 탐정", material: "은" },
  { id: "A", title: "수석 탐정", material: "금" },
  { id: "S", title: "명예 탐정", material: "흑요석과 금" },
];

export const RANK_BY_ID: Record<RankId, RankDef> = Object.fromEntries(
  RANKS.map((r) => [r.id, r]),
) as Record<RankId, RankDef>;

export interface PromotionRequirement {
  /** 이 분류의 문제를 */
  category: PuzzleCategory;
  /** 이만큼 해결해야 한다 */
  count: number;
  label: string;
}

export interface PromotionRule {
  from: RankId;
  to: RankId;
  /** 시험에 출제되는 문제. 정식 버전에서는 여러 문제로 늘릴 수 있다. */
  examPuzzleIds: string[];
  requirements: PromotionRequirement[];
}

export const PROMOTION_RULES: PromotionRule[] = [
  {
    from: "F",
    to: "D",
    examPuzzleIds: ["exam-schedule-f-d"],
    requirements: [
      { category: "daily", count: 1, label: "오늘의 추리 해결" },
      { category: "practice", count: 1, label: "연습실 문제 해결" },
    ],
  },
];

export function nextRank(rank: RankId): RankId | null {
  const index = RANKS.findIndex((r) => r.id === rank);
  return RANKS[index + 1]?.id ?? null;
}

export function rankLabel(rank: RankId): string {
  return `${rank}급 ${RANK_BY_ID[rank].title}`;
}
