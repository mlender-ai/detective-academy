/**
 * 탐정 등급과 승급 조건.
 * 모든 수치는 초기 실험값이다(V3 지시서: "정식 밸런스로 확정하지 않는다"). 등급·조건·시험 규칙은 이 파일만 바꾸면 된다.
 */
import type { PuzzleType, RankId } from "../engine/types";

export interface RankDef {
  id: RankId;
  title: string;
  /** 배지 재질 이름 (신분증·등급표에 표기) */
  material: string;
  /** 이 등급에서 익히는 추리 (연습실의 서랍 이름표) */
  focus: string;
}

export const RANKS: RankDef[] = [
  { id: "F", title: "견습 탐정", material: "무쇠", focus: "기본 규칙 발견" },
  { id: "D", title: "초급 탐정", material: "청동", focus: "여러 조건 결합" },
  { id: "C", title: "정식 탐정", material: "강철", focus: "모순과 가설 비교" },
  { id: "B", title: "상급 탐정", material: "은", focus: "여러 단계의 추론" },
  { id: "A", title: "수석 탐정", material: "금", focus: "복잡한 논리와 전략" },
  { id: "S", title: "명예 탐정", material: "흑요석과 금", focus: "최상위 추론" },
];

export const RANK_BY_ID: Record<RankId, RankDef> = Object.fromEntries(
  RANKS.map((r) => [r.id, r]),
) as Record<RankId, RankDef>;

export function rankIndex(rank: RankId): number {
  return RANKS.findIndex((r) => r.id === rank);
}

/** 시험 한 번에 걸리는 제한. null 은 제한이 없다는 뜻이다. */
export interface ExamRules {
  /** 시험 전체의 제한 시간(초). 문제를 푸는 동안에만 흐른다. */
  timeLimitSec: number | null;
  /** 문제마다 제출할 수 있는 횟수. 다 쓰고도 틀리면 그 응시는 끝난다. */
  submitsPerPuzzle: number | null;
  /**
   * 유형에 따라 더 줄인 제출 횟수. 진술 추리는 후보가 네 명뿐이라 같은 횟수를 주면 찍어서 맞히기 쉽다
   * (세 번이면 75%). 그래서 제출 횟수가 걸린 시험에서는 진술 추리만 한 번 덜 준다.
   */
  submitsByType?: Partial<Record<PuzzleType, number>>;
  /** 수사 지원(힌트)을 쓸 수 있는가 */
  hints: boolean;
  /** 하루에 응시할 수 있는 횟수 (Asia/Seoul 날짜 기준) */
  attemptsPerDay: number | null;
}

export interface PromotionRule {
  from: RankId;
  to: RankId;
  /**
   * 응시 조건: 지금까지 처음 해결한 과제(오늘의 추리 + 연습실)의 수.
   * 등급마다 새로 세지 않고 입학부터 쌓인 수로 본다(지시서의 표 3·5·8·12·15 를 이렇게 읽었다).
   */
  requiredSolved: number;
  /** 시험에 차례로 나오는 문제. 모두 맞혀야 합격이다. */
  examPuzzleIds: string[];
  exam: ExamRules;
  /** 합격 보상 (한 번만) */
  reward: number;
}

const OPEN: ExamRules = { timeLimitSec: null, submitsPerPuzzle: null, hints: true, attemptsPerDay: null };

export const PROMOTION_RULES: PromotionRule[] = [
  {
    from: "F",
    to: "D",
    requiredSolved: 3,
    examPuzzleIds: ["exam-schedule-f-d"],
    exam: OPEN,
    reward: 80,
  },
  {
    from: "D",
    to: "C",
    requiredSolved: 5,
    examPuzzleIds: ["exam-code-d-c", "exam-truth-d-c"],
    exam: OPEN,
    reward: 100,
  },
  {
    // 일부 시간제한: 세 문제를 15분 안에
    from: "C",
    to: "B",
    requiredSolved: 8,
    examPuzzleIds: ["exam-evidence-c-b", "exam-seal-c-b", "exam-schedule-c-b"],
    exam: { timeLimitSec: 15 * 60, submitsPerPuzzle: null, hints: true, attemptsPerDay: 3 },
    reward: 120,
  },
  {
    // 시도 횟수 제한: 문제마다 세 번, 힌트 없이
    from: "B",
    to: "A",
    requiredSolved: 12,
    examPuzzleIds: ["exam-code-b-a", "exam-truth-b-a", "exam-schedule-b-a", "exam-seal-b-a"],
    exam: { timeLimitSec: null, submitsPerPuzzle: 3, submitsByType: { truth: 2 }, hints: false, attemptsPerDay: 2 },
    reward: 160,
  },
  {
    // 종합 시험: 다섯 유형을 25분 안에, 문제마다 두 번, 힌트 없이, 하루 한 번
    from: "A",
    to: "S",
    requiredSolved: 15,
    examPuzzleIds: ["exam-code-a-s", "exam-truth-a-s", "exam-schedule-a-s", "exam-evidence-a-s", "exam-seal-a-s"],
    exam: { timeLimitSec: 25 * 60, submitsPerPuzzle: 2, submitsByType: { truth: 1 }, hints: false, attemptsPerDay: 1 },
    reward: 200,
  },
];

export function nextRank(rank: RankId): RankId | null {
  return RANKS[rankIndex(rank) + 1]?.id ?? null;
}

export function rankLabel(rank: RankId): string {
  return `${rank}급 ${RANK_BY_ID[rank].title}`;
}

/** 그 유형의 문제에 주는 제출 횟수. 제한이 없으면 null */
export function submitLimit(rules: ExamRules, type: PuzzleType): number | null {
  if (rules.submitsPerPuzzle === null) return null;
  return Math.min(rules.submitsPerPuzzle, rules.submitsByType?.[type] ?? rules.submitsPerPuzzle);
}
