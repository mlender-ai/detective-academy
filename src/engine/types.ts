/**
 * 탐정학원 게임 엔진 타입.
 * 문제 데이터(rules)와 정답 검사(puzzleValidator)는 분리되어 있고,
 * 힌트·해설은 사람이 읽는 글(text)과 기계가 검사하는 사실(facts)을 함께 가진다.
 */

export type RankId = "F" | "D" | "C" | "B" | "A" | "S";
export type PuzzleCategory = "daily" | "practice" | "exam";
export type PuzzleType = "code" | "truth" | "schedule";

export type PersonMark = "circle" | "shield" | "hex" | "diamond";

export interface Person {
  id: string;
  name: string;
  /** 인물 고유 색상 */
  color: string;
  /** 색각 이상에서도 구분되도록 색과 함께 쓰는 고유 실루엣 */
  mark: PersonMark;
}

/* ───────── 암호 해독 ───────── */

export interface CodeClue {
  guess: number[];
  /** 암호에 포함된 숫자 개수 */
  match: number;
  /** 그중 자리까지 맞는 개수 */
  inPlace: number;
}

export interface CodeRules {
  length: number;
  /** 사용할 수 있는 숫자 (중복 없이 사용) */
  digits: number[];
  clues: CodeClue[];
}

export type CodeFact =
  | { kind: "absent"; digits: number[] }
  | { kind: "present"; digit: number }
  | { kind: "at"; digit: number; position: number }
  | { kind: "notAt"; digit: number; position: number };

/* ───────── 거짓 진술 찾기 ───────── */

export type TruthClaim =
  | { kind: "culpritIs"; who: string }
  | { kind: "culpritIsNot"; who: string }
  | { kind: "culpritAmong"; who: string[] };

export interface TruthStatement {
  speaker: string;
  text: string;
  claim: TruthClaim;
}

export interface TruthRules {
  people: Person[];
  statements: TruthStatement[];
  /** 참인 진술의 정확한 개수 */
  trueCount: number;
}

export type TruthFact =
  | { kind: "statementIs"; speaker: string; value: boolean }
  | { kind: "culpritIsNot"; who: string }
  | { kind: "trueCountIf"; culprit: string; count: number };

/* ───────── 발표 순서 재구성 ───────── */

export type ScheduleConstraint =
  | { kind: "before"; a: string; b: string; text: string }
  | { kind: "notAtSlot"; who: string; slot: number; text: string }
  | { kind: "immediatelyAfter"; who: string; after: string; text: string };

export interface ScheduleSlot {
  label: string;
  ordinal: string;
}

export interface ScheduleRules {
  people: Person[];
  slots: ScheduleSlot[];
  constraints: ScheduleConstraint[];
}

export type ScheduleFact =
  | { kind: "adjacent"; first: string; second: string }
  | { kind: "slotAmong"; who: string; slots: number[] }
  | { kind: "slotNot"; who: string; slot: number }
  | { kind: "slotIs"; who: string; slot: number };

/* ───────── 공통 ───────── */

export interface Hint<F> {
  text: string;
  /** 이 힌트가 단정하는 사실. 정답과 모순되지 않는지 테스트가 검사한다. */
  facts: F[];
}

export interface ExplanationStep<F> {
  text: string;
  facts: F[];
}

interface PuzzleBase<T extends PuzzleType, R, S, F> {
  id: string;
  type: T;
  category: PuzzleCategory;
  title: string;
  typeLabel: string;
  difficulty: number;
  description: string;
  rules: R;
  hints: Hint<F>[];
  explanation: ExplanationStep<F>[];
  /** 선언된 정답. 전수 탐색 결과와 일치해야 테스트가 통과한다. */
  solution: S;
  reward: number;
}

export type CodePuzzle = PuzzleBase<"code", CodeRules, number[], CodeFact>;
export type TruthPuzzle = PuzzleBase<"truth", TruthRules, string, TruthFact>;
export type SchedulePuzzle = PuzzleBase<
  "schedule",
  ScheduleRules,
  string[],
  ScheduleFact
>;
export type Puzzle = CodePuzzle | TruthPuzzle | SchedulePuzzle;

/* ───────── 풀이 중 입력값 ───────── */

export type DigitMemo = "out" | "maybe";

export interface CodeInput {
  type: "code";
  dials: number[];
  memo: Record<string, DigitMemo>;
}

export interface TruthInput {
  type: "truth";
  /** 지금 범인이라고 가정 중인 사람 */
  suspect: string | null;
  /** 가정(용의자)별 · 진술(화자)별 참/거짓 메모 */
  memos: Record<string, Record<string, boolean>>;
  /** 비교하려고 골라 둔 진술 카드 */
  pinned: string[];
}

export interface ScheduleInput {
  type: "schedule";
  /** 시간 슬롯 순서대로 배치된 사람 (비어 있으면 null) */
  placement: (string | null)[];
}

export type PuzzleInput = CodeInput | TruthInput | ScheduleInput;

/* ───────── 저장되는 게임 상태 ───────── */

export type PuzzleStatus = "new" | "in_progress" | "solved";

export interface PuzzleProgress {
  status: PuzzleStatus;
  input: PuzzleInput | null;
  hintsUsed: number;
  elapsedMs: number;
  attempts: number;
  rewardClaimed: boolean;
  /** 승급 시험 봉투를 뜯었는지 */
  opened: boolean;
  solvedAt: string | null;
  /** 해결한 날짜 (Asia/Seoul 기준 YYYY-MM-DD) */
  solvedDateKey: string | null;
  solvedElapsedMs: number | null;
  solvedAttempts: number | null;
  solvedHints: number | null;
}

export interface PromotionRecord {
  from: RankId;
  to: RankId;
  at: string;
}

export interface GameState {
  version: 1;
  enrolled: boolean;
  nickname: string;
  detectiveNo: string;
  enrolledAt: string | null;
  rank: RankId;
  credits: number;
  puzzles: Record<string, PuzzleProgress>;
  promotions: PromotionRecord[];
  settings: { sound: boolean };
}
