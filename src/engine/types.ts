/**
 * 탐정학원 게임 엔진 타입.
 * 문제 데이터(rules)와 정답 검사(puzzleValidator)는 분리되어 있고,
 * 힌트·해설은 사람이 읽는 글(text)과 기계가 검사하는 사실(facts)을 함께 가진다.
 */

export type RankId = "F" | "D" | "C" | "B" | "A" | "S";
export type PuzzleCategory = "daily" | "practice" | "exam";
export type PuzzleType = "code" | "truth" | "schedule" | "evidence" | "spatial";

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

/** 금고 문에 새겨진 조건. 자리는 0부터 센다. */
export type CodeCondition =
  /** 모든 자리 숫자의 합이 value 다 */
  | { kind: "sum"; value: number; text: string }
  /** a 자리의 숫자가 b 자리의 숫자보다 크다 */
  | { kind: "greater"; a: number; b: number; text: string }
  /** 홀수가 정확히 count 개다 */
  | { kind: "oddCount"; count: number; text: string };

export interface CodeRules {
  length: number;
  /** 사용할 수 있는 숫자 (중복 없이 사용) */
  digits: number[];
  clues: CodeClue[];
  /** 금고 문에 새겨진 조건. 시도 기록과 함께 모두 만족해야 한다. */
  conditions?: CodeCondition[];
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
  | { kind: "culpritAmong"; who: string[] }
  /** who 의 진술은 참이다 (다른 사람의 진술을 가리킨다. 서로 물고 물리게 가리킬 수는 없다) */
  | { kind: "speakerTruthful"; who: string }
  /** who 의 진술은 거짓이다 */
  | { kind: "speakerLying"; who: string };

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
  /** 누군가 숨긴 물건의 이름. 적지 않으면 "답안지" */
  item?: string;
}

export type TruthFact =
  | { kind: "statementIs"; speaker: string; value: boolean }
  | { kind: "culpritIsNot"; who: string }
  | { kind: "trueCountIf"; culprit: string; count: number };

/* ───────── 발표 순서 재구성 ───────── */

export type ScheduleConstraint =
  | { kind: "before"; a: string; b: string; text: string }
  | { kind: "notAtSlot"; who: string; slot: number; text: string }
  | { kind: "immediatelyAfter"; who: string; after: string; text: string }
  /** a 와 b 는 이웃한 순서가 아니다 */
  | { kind: "notAdjacent"; a: string; b: string; text: string }
  /** a 와 b 사이에 정확히 between 명이 있다 (누가 먼저인지는 정하지 않는다) */
  | { kind: "gap"; a: string; b: string; between: number; text: string }
  /** who 의 순서는 slots 가운데 하나다 (예: 처음 아니면 마지막) */
  | { kind: "slotAmong"; who: string; slots: number[]; text: string }
  /** who 는 a 와 b 사이의 어딘가다 (a 와 b 의 순서는 정하지 않는다) */
  | { kind: "between"; who: string; a: string; b: string; text: string };

export interface ScheduleSlot {
  label: string;
  ordinal: string;
}

export interface ScheduleRules {
  people: Person[];
  slots: ScheduleSlot[];
  constraints: ScheduleConstraint[];
  /** 맞춘 순서의 이름. 적지 않으면 "발표 순서" */
  title?: string;
}

export type ScheduleFact =
  | { kind: "adjacent"; first: string; second: string }
  | { kind: "slotAmong"; who: string; slots: number[] }
  | { kind: "slotNot"; who: string; slot: number }
  | { kind: "slotIs"; who: string; slot: number };

/* ───────── 증거 조합 ─────────
 * 사람마다 시각마다 한 곳에 있다. 기록·물건·진술은 모두 "누가 언제 어디에 있었는가"에 대한 주장이다.
 * 기록과 물건은 믿을 수 있고, 진술은 거짓일 수 있다. 기록 두 개를 이어 새 사실을 얻고, 그 사실로 거짓 진술을 깬다.
 */

export interface EvidencePlace {
  id: string;
  name: string;
}

export type EvidenceClaim =
  /** who 는 time 에 place 에 있었다 */
  | { kind: "at"; who: string; place: string; time: number }
  | { kind: "notAt"; who: string; place: string; time: number }
  /** who 는 from 부터 to 까지 줄곧 place 에 있었다 */
  | { kind: "stayed"; who: string; place: string; from: number; to: number }
  /** who 는 until 까지의 어느 시각엔가 place 에 있었다 (물건이 남았다) */
  | { kind: "visited"; who: string; place: string; until: number }
  /** time 에 place 에는 아무도 없었다 */
  | { kind: "empty"; place: string; time: number }
  /** time 에 place 에는 who 혼자 있었다 */
  | { kind: "alone"; who: string; place: string; time: number }
  /** a 와 b 는 time 에 같은 곳에 있었다 */
  | { kind: "together"; a: string; b: string; time: number }
  /** time 에 place 에 있던 사람은 정확히 count 명이다 (누구인지는 모른다) */
  | { kind: "count"; place: string; time: number; count: number }
  /** 한 장의 기록이 여러 가지를 말할 때: 모두 성립한다 */
  | { kind: "all"; of: EvidenceClaim[] };

/** log 출입 기록 · time 시간 기록 · object 발견된 물건 · statement 인물의 진술 · derived 두 증거를 이어 얻은 사실 */
export type EvidenceKind = "log" | "time" | "object" | "statement" | "derived";

export interface EvidenceCard {
  id: string;
  kind: EvidenceKind;
  /** 게시판의 카드에 적히는 짧은 이름 */
  label: string;
  /** 카드를 집었을 때 읽는 글 */
  text: string;
  /** 진술이면 말한 사람 */
  speaker?: string;
  claim: EvidenceClaim;
}

export interface EvidenceDerivation {
  /** 이 두 증거를 이으면 */
  from: [string, string];
  /** 이 사실이 나온다. 같은 사실에 이르는 길이 둘이면 같은 카드를 두 번 적는다. */
  card: EvidenceCard;
}

export interface EvidenceRules {
  people: Person[];
  places: EvidencePlace[];
  /** 시각의 이름. 앞에서부터 0, 1, 2 … */
  times: string[];
  /** 처음부터 게시판에 있는 증거 */
  cards: EvidenceCard[];
  derivations: EvidenceDerivation[];
}

/** 정답: 거짓 진술과, 그것을 깨는 증거 */
export interface EvidenceSolution {
  statement: string;
  against: string;
}

export type EvidenceFact =
  | { kind: "derives"; from: [string, string]; card: string }
  /** 두 증거는 함께 성립할 수 있다 */
  | { kind: "consistent"; a: string; b: string }
  /** 이 진술은 기록 전체와 어긋나지 않는다 */
  | { kind: "statementHolds"; statement: string }
  | { kind: "contradicts"; a: string; b: string };

/* ───────── 공간 추론 · 인장 대조 ─────────
 * 도장을 찍으면 자국은 도장 면의 좌우가 뒤집힌 모양이 된다. 도장은 네 방향으로 돌려 찍을 수 있다.
 * 종이에 남은 자국을 낸 도장과 그 방향을 찾는다.
 */

export interface SealStamp {
  id: string;
  name: string;
  /** 도장 면을 정면에서 본 모양. '#' 은 돋은 곳(찍히는 곳), '.' 은 파인 곳 */
  face: string[];
}

export interface SpatialRules {
  size: number;
  /** 종이에 남은 자국. '#' 찍힌 곳 · '.' 빈 곳 · '?' 번져서 알 수 없는 곳 */
  imprint: string[];
  stamps: SealStamp[];
  /** 시험 삼아 찍어 볼 수 있는 종이의 수 */
  trials: number;
}

/** 정답: 도장과, 시계 방향으로 돌린 횟수(0~3) */
export interface SpatialSolution {
  stamp: string;
  turn: number;
}

export type SpatialFact =
  | { kind: "stampIsNot"; stamp: string }
  | { kind: "turnIsNot"; turn: number };

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
  /** 사건을 여는 한두 문장 (풀이 화면의 서술 한 줄) */
  intro?: string;
  /** 사건을 닫는 한두 문장 (채점 결과에 찍힌다) */
  outro?: string;
  /** 권장 탐정 등급 */
  rank?: RankId;
  /** 예상 풀이 시간(분) */
  minutes?: number;
}

export type CodePuzzle = PuzzleBase<"code", CodeRules, number[], CodeFact>;
export type TruthPuzzle = PuzzleBase<"truth", TruthRules, string, TruthFact>;
export type SchedulePuzzle = PuzzleBase<
  "schedule",
  ScheduleRules,
  string[],
  ScheduleFact
>;
export type EvidencePuzzle = PuzzleBase<"evidence", EvidenceRules, EvidenceSolution, EvidenceFact>;
export type SpatialPuzzle = PuzzleBase<"spatial", SpatialRules, SpatialSolution, SpatialFact>;
export type Puzzle = CodePuzzle | TruthPuzzle | SchedulePuzzle | EvidencePuzzle | SpatialPuzzle;

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

export interface EvidenceInput {
  type: "evidence";
  /** 맞대어 보려고 집은 증거 (많아야 둘) */
  picked: string[];
  /** 지금까지 이어서 얻은 사실 */
  found: string[];
}

export interface SpatialInput {
  type: "spatial";
  /** 손에 든 도장 */
  stamp: string | null;
  /** 도장마다 시계 방향으로 돌려 둔 횟수(0~3) */
  turns: Record<string, number>;
  /** 시험 종이에 찍어 본 것 */
  trials: { stamp: string; turn: number }[];
}

export type PuzzleInput = CodeInput | TruthInput | ScheduleInput | EvidenceInput | SpatialInput;

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

/**
 * 치르고 있는 승급 시험 한 번. 새로고침해도 남은 시간과 제출 횟수가 되돌아가지 않도록 저장한다.
 * 시계는 문제를 푸는 동안에만 돈다(문제 사이의 장면에서는 멈춘다). 도는 중에 화면을 떠나도 시간은 흐른다.
 */
export interface ExamSession {
  /** 응시하는 등급 (F 이면 F→D 시험) */
  from: RankId;
  startedAt: string;
  /** 시작한 날 (Asia/Seoul). 하루 응시 횟수를 세는 기준 */
  dateKey: string;
  /** 지금 문제의 순번 (0부터) */
  index: number;
  /** ready: 다음 시험지를 펼치기 전(시계가 멈춰 있다) · playing: 문제를 푸는 중 */
  stage: "ready" | "playing";
  /** 지금 문제에서 쓴 제출 횟수 */
  submits: number;
  /** 남은 시간(ms). 시계가 도는 중이면 runningSince 부터 흐른 만큼이 아직 빠지지 않은 값이다. 제한이 없으면 null */
  remainingMs: number | null;
  /** 시계가 도는 중이면 돌기 시작한 시각(epoch ms) */
  runningSince: number | null;
  status: "active" | "failed";
  failedBy: "time" | "submits" | null;
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
  /** 치르고 있는(또는 방금 떨어진) 승급 시험. 없으면 null */
  exam: ExamSession | null;
  /** 등급별 오늘의 응시 횟수. 날짜가 바뀌면 다시 센다. */
  examDays: Partial<Record<RankId, { dateKey: string; count: number }>>;
  settings: { sound: boolean };
}
