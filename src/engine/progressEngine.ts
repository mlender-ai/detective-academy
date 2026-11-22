/**
 * 진행 상태 엔진. 모든 함수는 GameState 를 받아 새 GameState 를 돌려주는 순수 함수다.
 * 저장(localStorage)과 화면은 이 파일을 모른다.
 */
import { ALL_PUZZLES, PUZZLES, PUZZLE_BY_ID } from "../data/puzzles";
import { PROMOTION_RULES, type PromotionRule } from "../data/ranks";
import { CREDIT_POLICY, hintCost, rewardFor, spend } from "./creditEngine";
import { checkAnswer } from "./puzzleValidator";
import { seoulDateKey } from "./time";
import type {
  GameState,
  Puzzle,
  PuzzleCategory,
  PuzzleInput,
  PuzzleProgress,
  RankId,
} from "./types";

export const NICKNAME_MAX = 10;

export function emptyProgress(): PuzzleProgress {
  return {
    status: "new",
    input: null,
    hintsUsed: 0,
    elapsedMs: 0,
    attempts: 0,
    rewardClaimed: false,
    opened: false,
    solvedAt: null,
    solvedDateKey: null,
    solvedElapsedMs: null,
    solvedAttempts: null,
    solvedHints: null,
  };
}

export function createInitialState(): GameState {
  return {
    version: 1,
    enrolled: false,
    nickname: "",
    detectiveNo: "",
    enrolledAt: null,
    rank: "F",
    credits: 0,
    puzzles: {},
    promotions: [],
    settings: { sound: false },
  };
}

export function getProgress(state: GameState, puzzleId: string): PuzzleProgress {
  return state.puzzles[puzzleId] ?? emptyProgress();
}

function withProgress(
  state: GameState,
  puzzleId: string,
  update: (p: PuzzleProgress) => PuzzleProgress,
): GameState {
  return {
    ...state,
    puzzles: { ...state.puzzles, [puzzleId]: update(getProgress(state, puzzleId)) },
  };
}

export function sanitizeNickname(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, NICKNAME_MAX);
}

/* ───────── 입학 ───────── */

export function enroll(state: GameState, nickname: string, detectiveNo: string, now: Date): GameState {
  if (state.enrolled) return state;
  return {
    ...state,
    enrolled: true,
    nickname: sanitizeNickname(nickname) || "이름 없는 탐정",
    detectiveNo,
    enrolledAt: now.toISOString(),
    rank: "F",
    credits: CREDIT_POLICY.initial,
  };
}

export function rename(state: GameState, nickname: string): GameState {
  const next = sanitizeNickname(nickname);
  if (!next) return state;
  return { ...state, nickname: next };
}

/* ───────── 풀이 중 상태 ───────── */

/** 조작 중인 입력값 저장. 뒤로 갔다 와도 이어서 풀 수 있게 한다. */
export function recordInput(state: GameState, puzzleId: string, input: PuzzleInput): GameState {
  return withProgress(state, puzzleId, (p) => ({
    ...p,
    input,
    status: p.status === "new" ? "in_progress" : p.status,
  }));
}

export function addElapsed(state: GameState, puzzleId: string, ms: number): GameState {
  if (ms <= 0) return state;
  return withProgress(state, puzzleId, (p) =>
    p.status === "solved"
      ? p
      : { ...p, elapsedMs: p.elapsedMs + ms, status: "in_progress" },
  );
}

export function markOpened(state: GameState, puzzleId: string): GameState {
  return withProgress(state, puzzleId, (p) => ({
    ...p,
    opened: true,
    status: p.status === "new" ? "in_progress" : p.status,
  }));
}

/* ───────── 힌트 ───────── */

export type HintOutcome =
  | { kind: "opened"; tier: number; cost: number }
  | { kind: "insufficient"; tier: number; cost: number; shortBy: number }
  | { kind: "exhausted" };

export function requestHint(
  state: GameState,
  puzzle: Puzzle,
): { state: GameState; outcome: HintOutcome } {
  const progress = getProgress(state, puzzle.id);
  const tier = progress.hintsUsed;
  const cost = hintCost(tier);
  if (cost === null || tier >= puzzle.hints.length) {
    return { state, outcome: { kind: "exhausted" } };
  }
  const result = spend(state.credits, cost);
  if (!result.ok) {
    return {
      state,
      outcome: { kind: "insufficient", tier, cost, shortBy: cost - state.credits },
    };
  }
  const next = withProgress({ ...state, credits: result.credits }, puzzle.id, (p) => ({
    ...p,
    hintsUsed: tier + 1,
    status: p.status === "new" ? "in_progress" : p.status,
  }));
  return { state: next, outcome: { kind: "opened", tier, cost } };
}

/* ───────── 승급 조건 ───────── */

export function solvedCount(state: GameState, category: PuzzleCategory): number {
  return ALL_PUZZLES.filter(
    (p) => p.category === category && getProgress(state, p.id).status === "solved",
  ).length;
}

export function promotionRuleFor(rank: RankId): PromotionRule | null {
  return PROMOTION_RULES.find((r) => r.from === rank) ?? null;
}

export interface ExamStatus {
  rule: PromotionRule | null;
  requirements: { label: string; done: boolean; current: number; count: number }[];
  doneCount: number;
  /** 응시 조건을 모두 채웠는가 */
  unlocked: boolean;
  /** 이 등급의 시험을 이미 통과했는가 (= 다음 등급으로 올라갔는가) */
  passed: boolean;
}

/**
 * 현재 등급에서 치를 승급 시험의 상태.
 * 프로토타입은 F→D 규칙만 있으므로, D급이 되면 rule 이 null 이 된다.
 */
export function examStatus(state: GameState): ExamStatus {
  const rule = promotionRuleFor(state.rank);
  if (!rule) {
    return { rule: null, requirements: [], doneCount: 0, unlocked: false, passed: state.promotions.length > 0 };
  }
  const requirements = rule.requirements.map((req) => {
    const current = Math.min(solvedCount(state, req.category), req.count);
    return { label: req.label, done: current >= req.count, current, count: req.count };
  });
  const doneCount = requirements.filter((r) => r.done).length;
  return {
    rule,
    requirements,
    doneCount,
    unlocked: doneCount === requirements.length,
    passed: false,
  };
}

/** 이 문제를 지금 풀 수 있는가. 시험 문제는 응시 조건을 채워야 열린다. */
export function canPlay(state: GameState, puzzle: Puzzle): boolean {
  if (!state.enrolled) return false;
  if (puzzle.category !== "exam") return true;
  if (getProgress(state, puzzle.id).status === "solved") return true;
  const status = examStatus(state);
  return status.unlocked && !!status.rule?.examPuzzleIds.includes(puzzle.id);
}

/* ───────── 추론 제출 ───────── */

export interface SubmitOutcome {
  accepted: boolean;
  correct: boolean;
  /** 이번 제출로 실제 지급된 크레딧 */
  reward: number;
  /** 이 문제를 처음 해결한 제출인가 */
  firstSolve: boolean;
  noHint: boolean;
  promotedTo: RankId | null;
}

const REJECTED: SubmitOutcome = {
  accepted: false,
  correct: false,
  reward: 0,
  firstSolve: false,
  noHint: false,
  promotedTo: null,
};

export function submitAnswer(
  state: GameState,
  puzzle: Puzzle,
  answer: unknown,
  now: Date,
): { state: GameState; outcome: SubmitOutcome } {
  if (!canPlay(state, puzzle)) return { state, outcome: REJECTED };

  const before = getProgress(state, puzzle.id);
  const correct = checkAnswer(puzzle, answer);
  const alreadySolved = before.status === "solved";

  // 이미 해결한 문제를 다시 풀 때는 기록·보상을 건드리지 않는다.
  if (alreadySolved) {
    return {
      state,
      outcome: { accepted: true, correct, reward: 0, firstSolve: false, noHint: false, promotedTo: null },
    };
  }

  const attempts = before.attempts + 1;

  if (!correct) {
    const next = withProgress(state, puzzle.id, (p) => ({
      ...p,
      attempts,
      status: "in_progress",
    }));
    return {
      state: next,
      outcome: { accepted: true, correct: false, reward: 0, firstSolve: false, noHint: false, promotedTo: null },
    };
  }

  const reward = rewardFor(before, puzzle.reward);
  let next = withProgress({ ...state, credits: state.credits + reward }, puzzle.id, (p) => ({
    ...p,
    attempts,
    status: "solved",
    rewardClaimed: true,
    solvedAt: now.toISOString(),
    solvedDateKey: seoulDateKey(now),
    solvedElapsedMs: p.elapsedMs,
    solvedAttempts: attempts,
    solvedHints: p.hintsUsed,
  }));

  // 승급 시험 합격 → 등급 상승. 힌트·크레딧 사용 여부와 무관하다.
  let promotedTo: RankId | null = null;
  if (puzzle.category === "exam") {
    const rule = promotionRuleFor(state.rank);
    if (rule && rule.examPuzzleIds.includes(puzzle.id)) {
      const allPassed = rule.examPuzzleIds.every((id) => getProgress(next, id).status === "solved");
      if (allPassed) {
        promotedTo = rule.to;
        next = {
          ...next,
          rank: rule.to,
          promotions: [...next.promotions, { from: rule.from, to: rule.to, at: now.toISOString() }],
        };
      }
    }
  }

  return {
    state: next,
    outcome: {
      accepted: true,
      correct: true,
      reward,
      firstSolve: true,
      noHint: before.hintsUsed === 0,
      promotedTo,
    },
  };
}

/* ───────── 저장 데이터 복원 ───────── */

/** localStorage 에서 읽은 값을 현재 스키마로 보정한다. 깨진 값이면 초기 상태를 돌려준다. */
export function hydrate(raw: unknown): GameState {
  const base = createInitialState();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Partial<GameState>;
  if (data.version !== 1) return base;

  const puzzles: Record<string, PuzzleProgress> = {};
  if (data.puzzles && typeof data.puzzles === "object") {
    for (const [id, value] of Object.entries(data.puzzles)) {
      if (!PUZZLE_BY_ID[id] || !value || typeof value !== "object") continue;
      puzzles[id] = { ...emptyProgress(), ...(value as PuzzleProgress) };
    }
  }

  const credits = typeof data.credits === "number" && Number.isFinite(data.credits) ? data.credits : 0;

  return {
    ...base,
    enrolled: data.enrolled === true,
    nickname: typeof data.nickname === "string" ? data.nickname : "",
    detectiveNo: typeof data.detectiveNo === "string" ? data.detectiveNo : "",
    enrolledAt: typeof data.enrolledAt === "string" ? data.enrolledAt : null,
    rank: (["F", "D", "C", "B", "A", "S"] as RankId[]).includes(data.rank as RankId)
      ? (data.rank as RankId)
      : "F",
    credits: Math.max(0, Math.floor(credits)),
    puzzles,
    promotions: Array.isArray(data.promotions) ? data.promotions : [],
    settings: { sound: data.settings?.sound === true },
  };
}

/* ───────── 데모(QA) 프리셋 ───────── */

export type DemoPreset =
  | "first-run"
  | "daily-unsolved"
  | "daily-solved"
  | "exam-ready"
  | "promoted";

export const DEMO_PRESETS: { id: DemoPreset; label: string }[] = [
  { id: "first-run", label: "첫 실행 상태로 초기화" },
  { id: "daily-unsolved", label: "오늘의 문제 미해결" },
  { id: "daily-solved", label: "오늘의 문제 해결" },
  { id: "exam-ready", label: "승급 시험 가능" },
  { id: "promoted", label: "승급 완료" },
];

/** 실제 엔진 함수를 순서대로 호출해 만든다. 손으로 짜 맞춘 상태가 아니다. */
export function buildDemoState(preset: DemoPreset, now: Date = new Date()): GameState {
  let state = createInitialState();
  if (preset === "first-run") return state;

  state = enroll(state, "데모 탐정", "DA-000000", now);
  if (preset === "daily-unsolved") return state;

  const solve = (category: PuzzleCategory) => {
    for (const puzzle of PUZZLES.filter((p) => p.category === category)) {
      state = addElapsed(state, puzzle.id, 95_000);
      state = submitAnswer(state, puzzle, puzzle.solution, now).state;
    }
  };

  solve("daily");
  if (preset === "daily-solved") return state;

  solve("practice");
  if (preset === "exam-ready") return state;

  solve("exam");
  return state;
}
