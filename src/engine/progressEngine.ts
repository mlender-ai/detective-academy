/**
 * 진행 상태 엔진. 모든 함수는 GameState 를 받아 새 GameState 를 돌려주는 순수 함수다.
 * 저장(localStorage)과 화면은 이 파일을 모른다.
 */
import { ALL_PUZZLES, PRACTICE_PUZZLES, PUZZLE_BY_ID, getDailyPuzzle } from "../data/puzzles";
import { PROMOTION_RULES, RANKS, rankIndex, submitLimit, type PromotionRule } from "../data/ranks";
import { CREDIT_POLICY, hintCost, rewardFor, spend } from "./creditEngine";
import { checkAnswer } from "./puzzleValidator";
import { seoulDateKey } from "./time";
import type {
  ExamSession,
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
    exam: null,
    examDays: {},
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
  | { kind: "exhausted" }
  /** 수사 지원을 쓸 수 없는 시험이다 */
  | { kind: "forbidden" };

/** 이 문제에서 수사 지원을 쓸 수 있는가. 시험 문제는 그 시험의 규칙을 따른다. */
export function hintsAllowed(puzzle: Puzzle): boolean {
  if (puzzle.category !== "exam") return true;
  return examRuleOf(puzzle.id)?.exam.hints ?? true;
}

export function requestHint(
  state: GameState,
  puzzle: Puzzle,
): { state: GameState; outcome: HintOutcome } {
  if (!hintsAllowed(puzzle)) return { state, outcome: { kind: "forbidden" } };
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

/** 지금까지 처음 해결한 과제의 수: 오늘의 추리 + 연습실 (승급 시험의 응시 조건) */
export function tasksSolved(state: GameState): number {
  return solvedCount(state, "daily") + solvedCount(state, "practice");
}

export function promotionRuleFor(rank: RankId): PromotionRule | null {
  return PROMOTION_RULES.find((r) => r.from === rank) ?? null;
}

/** 이 문제가 나오는 시험 */
export function examRuleOf(puzzleId: string): PromotionRule | null {
  return PROMOTION_RULES.find((r) => r.examPuzzleIds.includes(puzzleId)) ?? null;
}

/** 연습 문제는 그 문제의 권장 등급에 올라야 열린다. 이미 푼 문제는 언제든 다시 본다. */
export function practiceUnlocked(state: GameState, puzzle: Puzzle): boolean {
  if (getProgress(state, puzzle.id).status === "solved") return true;
  return rankIndex(puzzle.rank ?? "F") <= rankIndex(state.rank);
}

/** 남은 시험 시간(ms). 제한이 없으면 null */
export function examRemainingMs(session: ExamSession, now: Date): number | null {
  if (session.remainingMs === null) return null;
  const running = session.runningSince === null ? 0 : Math.max(0, now.getTime() - session.runningSince);
  return Math.max(0, session.remainingMs - running);
}

/** 그 등급의 시험을 오늘 몇 번 응시했는가 */
export function examAttemptsToday(state: GameState, from: RankId, now: Date): number {
  const record = state.examDays[from];
  return record && record.dateKey === seoulDateKey(now) ? record.count : 0;
}

export interface ExamStatus {
  /** 지금 등급에서 치를 시험. 최고 등급이면 null */
  rule: PromotionRule | null;
  /** 응시 조건: 처음 해결한 과제 solved / required */
  required: number;
  solved: number;
  /** 응시 조건을 채웠는가 */
  unlocked: boolean;
  /** 더 치를 시험이 없는가 (최고 등급) */
  passed: boolean;
  /** 치르고 있는(또는 방금 떨어진) 시험 */
  session: ExamSession | null;
  /** 오늘 남은 응시 횟수. 제한이 없으면 null */
  attemptsLeft: number | null;
  /** 지금 새로 응시할 수 있는가 */
  canStart: boolean;
}

/** 현재 등급에서 치를 승급 시험의 상태 */
export function examStatus(state: GameState, now: Date = new Date()): ExamStatus {
  const rule = promotionRuleFor(state.rank);
  if (!rule) {
    return { rule: null, required: 0, solved: 0, unlocked: false, passed: state.promotions.length > 0, session: null, attemptsLeft: null, canStart: false };
  }
  const solved = Math.min(tasksSolved(state), rule.requiredSolved);
  const unlocked = solved >= rule.requiredSolved;
  const session = state.exam && state.exam.from === rule.from ? state.exam : null;
  const limit = rule.exam.attemptsPerDay;
  const attemptsLeft = limit === null ? null : Math.max(0, limit - examAttemptsToday(state, rule.from, now));
  const active = session?.status === "active";
  return {
    rule,
    required: rule.requiredSolved,
    solved,
    unlocked,
    passed: false,
    session,
    attemptsLeft,
    canStart: unlocked && !active && (attemptsLeft === null || attemptsLeft > 0),
  };
}

/** 이 문제를 지금 풀 수 있는가 */
export function canPlay(state: GameState, puzzle: Puzzle): boolean {
  if (!state.enrolled) return false;
  if (puzzle.category === "practice") return practiceUnlocked(state, puzzle);
  if (puzzle.category !== "exam") return true;
  // 시험 문제는 응시 중이고 지금 차례인 문제만 풀 수 있다
  const session = state.exam;
  if (!session || session.status !== "active" || session.stage !== "playing") return false;
  return promotionRuleFor(session.from)?.examPuzzleIds[session.index] === puzzle.id;
}

/* ───────── 승급 시험 응시 ───────── */

/**
 * 시험을 시작한다(봉투를 연다). 응시 횟수는 이때 하나 쓴다: 새로고침하거나 나갔다 와도 되돌아가지 않는다.
 * graceMs 는 첫 문제의 도입 장면만큼 시계를 늦게 돌리는 시간이다.
 */
export function startExam(state: GameState, now: Date, graceMs = 0): GameState {
  const status = examStatus(state, now);
  const rule = status.rule;
  if (!rule || !status.canStart) return state;
  if (!rule.examPuzzleIds.every((id) => PUZZLE_BY_ID[id])) return state;

  const dateKey = seoulDateKey(now);
  const puzzles = { ...state.puzzles };
  // 응시할 때마다 시험 문제의 풀이 기록을 새로 쓴다
  for (const id of rule.examPuzzleIds) puzzles[id] = { ...emptyProgress(), opened: true };

  const timed = rule.exam.timeLimitSec !== null;
  return {
    ...state,
    puzzles,
    exam: {
      from: rule.from,
      startedAt: now.toISOString(),
      dateKey,
      index: 0,
      stage: "playing",
      submits: 0,
      remainingMs: timed ? rule.exam.timeLimitSec! * 1000 : null,
      runningSince: timed ? now.getTime() + Math.max(0, graceMs) : null,
      status: "active",
      failedBy: null,
    },
    examDays: { ...state.examDays, [rule.from]: { dateKey, count: examAttemptsToday(state, rule.from, now) + 1 } },
  };
}

/** 다음 시험지를 펼친다: 문제 사이에서 멈춰 있던 시계가 다시 돈다 */
export function openExamSheet(state: GameState, now: Date, graceMs = 0): GameState {
  const session = state.exam;
  if (!session || session.status !== "active" || session.stage !== "ready") return state;
  return {
    ...state,
    exam: {
      ...session,
      stage: "playing",
      runningSince: session.remainingMs === null ? null : now.getTime() + Math.max(0, graceMs),
    },
  };
}

/** 시계를 멈추고 남은 시간을 적어 둔다 */
function pauseClock(session: ExamSession, now: Date): ExamSession {
  return { ...session, remainingMs: examRemainingMs(session, now), runningSince: null };
}

function failExam(state: GameState, session: ExamSession, by: "time" | "submits", now: Date): GameState {
  return { ...state, exam: { ...pauseClock(session, now), status: "failed", failedBy: by } };
}

/** 제한 시간이 끝났는지 본다. 끝났으면 그 응시는 실패로 바뀐다(등급은 그대로다). */
export function tickExam(state: GameState, now: Date): GameState {
  const session = state.exam;
  if (!session || session.status !== "active") return state;
  const remaining = examRemainingMs(session, now);
  if (remaining === null || remaining > 0) return state;
  return failExam(state, session, "time", now);
}

/** 떨어진 시험의 결과를 확인하고 닫는다. 다시 응시할 수 있게 된다(오늘 횟수가 남아 있다면). */
export function dismissExam(state: GameState): GameState {
  if (!state.exam || state.exam.status !== "failed") return state;
  return { ...state, exam: null };
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
  /** 승급 시험에서의 제출이면 그 뒤의 상태 */
  exam: null | {
    /** 이 응시가 끝났는가: 합격 · 시간 초과 · 제출 횟수 소진 */
    ended: "passed" | "time" | "submits" | null;
    /** 이 문제에 남은 제출 횟수. 제한이 없으면 null */
    submitsLeft: number | null;
  };
}

const REJECTED: SubmitOutcome = {
  accepted: false,
  correct: false,
  reward: 0,
  firstSolve: false,
  noHint: false,
  promotedTo: null,
  exam: null,
};

function submitExamAnswer(
  state: GameState,
  puzzle: Puzzle,
  answer: unknown,
  now: Date,
): { state: GameState; outcome: SubmitOutcome } {
  // 시간이 이미 끝났으면 채점하지 않는다
  const ticked = tickExam(state, now);
  if (ticked !== state) {
    return { state: ticked, outcome: { ...REJECTED, exam: { ended: "time", submitsLeft: null } } };
  }
  if (!canPlay(state, puzzle)) return { state, outcome: REJECTED };

  const session = state.exam!;
  const rule = promotionRuleFor(session.from)!;
  const limit = submitLimit(rule.exam, puzzle.type);
  const before = getProgress(state, puzzle.id);
  const attempts = before.attempts + 1;
  const submits = session.submits + 1;
  const correct = checkAnswer(puzzle, answer);

  if (!correct) {
    const next = withProgress(state, puzzle.id, (p) => ({ ...p, attempts, status: "in_progress" }));
    const counted = { ...session, submits };
    if (limit !== null && submits >= limit) {
      return {
        state: failExam(next, counted, "submits", now),
        outcome: { ...REJECTED, accepted: true, exam: { ended: "submits", submitsLeft: 0 } },
      };
    }
    return {
      state: { ...next, exam: counted },
      outcome: { ...REJECTED, accepted: true, exam: { ended: null, submitsLeft: limit === null ? null : limit - submits } },
    };
  }

  let next = withProgress(state, puzzle.id, (p) => ({
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
  const noHint = before.hintsUsed === 0;
  const last = session.index >= rule.examPuzzleIds.length - 1;

  if (!last) {
    // 다음 시험지를 펼치기 전까지 시계가 멈춘다
    next = { ...next, exam: { ...pauseClock(session, now), index: session.index + 1, stage: "ready", submits: 0 } };
    return {
      state: next,
      outcome: { accepted: true, correct: true, reward: 0, firstSolve: true, noHint, promotedTo: null, exam: { ended: null, submitsLeft: null } },
    };
  }

  // 마지막 문제까지 맞혔다 → 합격. 힌트·크레딧 사용 여부와 무관하다. 보상은 승급할 때 한 번뿐이다.
  next = {
    ...next,
    exam: null,
    rank: rule.to,
    credits: next.credits + rule.reward,
    promotions: [...next.promotions, { from: rule.from, to: rule.to, at: now.toISOString() }],
  };
  return {
    state: next,
    outcome: { accepted: true, correct: true, reward: rule.reward, firstSolve: true, noHint, promotedTo: rule.to, exam: { ended: "passed", submitsLeft: null } },
  };
}

export function submitAnswer(
  state: GameState,
  puzzle: Puzzle,
  answer: unknown,
  now: Date,
): { state: GameState; outcome: SubmitOutcome } {
  if (puzzle.category === "exam") return submitExamAnswer(state, puzzle, answer, now);
  if (!canPlay(state, puzzle)) return { state, outcome: REJECTED };

  const before = getProgress(state, puzzle.id);
  const correct = checkAnswer(puzzle, answer);
  const alreadySolved = before.status === "solved";

  // 이미 해결한 문제를 다시 풀 때는 기록·보상을 건드리지 않는다.
  if (alreadySolved) {
    return { state, outcome: { ...REJECTED, accepted: true, correct } };
  }

  const attempts = before.attempts + 1;

  if (!correct) {
    const next = withProgress(state, puzzle.id, (p) => ({
      ...p,
      attempts,
      status: "in_progress",
    }));
    return { state: next, outcome: { ...REJECTED, accepted: true } };
  }

  const reward = rewardFor(before, puzzle.reward);
  const next = withProgress({ ...state, credits: state.credits + reward }, puzzle.id, (p) => ({
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

  return {
    state: next,
    outcome: {
      accepted: true,
      correct: true,
      reward,
      firstSolve: true,
      noHint: before.hintsUsed === 0,
      promotedTo: null,
      exam: null,
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
    rank: RANK_IDS.includes(data.rank as RankId) ? (data.rank as RankId) : "F",
    credits: Math.max(0, Math.floor(credits)),
    puzzles,
    promotions: Array.isArray(data.promotions) ? data.promotions : [],
    exam: hydrateExam(data.exam),
    examDays: hydrateExamDays(data.examDays),
    settings: { sound: data.settings?.sound === true },
  };
}

const RANK_IDS = RANKS.map((r) => r.id);

function hydrateExam(raw: unknown): ExamSession | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<ExamSession>;
  const rule = RANK_IDS.includes(data.from as RankId) ? promotionRuleFor(data.from as RankId) : null;
  if (!rule) return null;
  const index = typeof data.index === "number" && Number.isInteger(data.index) ? data.index : -1;
  if (index < 0 || index >= rule.examPuzzleIds.length) return null;
  const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const failed = data.status === "failed";
  return {
    from: rule.from,
    startedAt: typeof data.startedAt === "string" ? data.startedAt : new Date(0).toISOString(),
    dateKey: typeof data.dateKey === "string" ? data.dateKey : "",
    index,
    stage: data.stage === "ready" ? "ready" : "playing",
    submits: Math.max(0, Math.floor(num(data.submits) ?? 0)),
    // 제한 시간이 있는 시험인데 남은 시간이 없으면(값이 깨졌으면) 0 으로 본다: 되살아나지 않는다
    remainingMs: rule.exam.timeLimitSec === null ? null : Math.max(0, Math.min(num(data.remainingMs) ?? 0, rule.exam.timeLimitSec * 1000)),
    runningSince: rule.exam.timeLimitSec === null ? null : num(data.runningSince),
    status: failed ? "failed" : "active",
    failedBy: failed ? (data.failedBy === "submits" ? "submits" : "time") : null,
  };
}

function hydrateExamDays(raw: unknown): GameState["examDays"] {
  const out: GameState["examDays"] = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [rank, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!RANK_IDS.includes(rank as RankId) || !value || typeof value !== "object") continue;
    const { dateKey, count } = value as { dateKey?: unknown; count?: unknown };
    if (typeof dateKey !== "string" || typeof count !== "number" || !Number.isFinite(count)) continue;
    out[rank as RankId] = { dateKey, count: Math.max(0, Math.floor(count)) };
  }
  return out;
}

/* ───────── 데모(QA) 프리셋 ───────── */

export type DemoPreset =
  | "first-run"
  | "daily-unsolved"
  | "daily-solved"
  | "exam-ready"
  | "promoted"
  | "ready-c"
  | "ready-b"
  | "ready-a"
  | "ready-s"
  | "rank-s";

export const DEMO_PRESETS: { id: DemoPreset; label: string }[] = [
  { id: "first-run", label: "첫 실행 상태로 초기화" },
  { id: "daily-unsolved", label: "오늘의 문제 미해결" },
  { id: "daily-solved", label: "오늘의 문제 해결" },
  { id: "exam-ready", label: "D급 시험 가능 (F급)" },
  { id: "promoted", label: "D급 승급 완료" },
  { id: "ready-c", label: "C급 시험 가능 (D급)" },
  { id: "ready-b", label: "B급 시험 가능 (C급)" },
  { id: "ready-a", label: "A급 시험 가능 (B급)" },
  { id: "ready-s", label: "S급 시험 가능 (A급)" },
  { id: "rank-s", label: "S급 달성" },
];

/** 프리셋이 닿는 곳: 그 등급까지 올라가고, ready 이면 그 등급의 시험 응시 조건까지 채운다 */
const PRESET_TARGET: Partial<Record<DemoPreset, { rank: RankId; ready: boolean }>> = {
  "exam-ready": { rank: "F", ready: true },
  promoted: { rank: "D", ready: false },
  "ready-c": { rank: "D", ready: true },
  "ready-b": { rank: "C", ready: true },
  "ready-a": { rank: "B", ready: true },
  "ready-s": { rank: "A", ready: true },
  "rank-s": { rank: "S", ready: false },
};

/** 실제 엔진 함수를 순서대로 호출해 만든다. 손으로 짜 맞춘 상태가 아니다. */
export function buildDemoState(preset: DemoPreset, now: Date = new Date()): GameState {
  let state = createInitialState();
  if (preset === "first-run") return state;

  state = enroll(state, "데모 탐정", "DA-000000", now);
  if (preset === "daily-unsolved") return state;

  const solve = (puzzle: Puzzle) => {
    if (getProgress(state, puzzle.id).status === "solved") return;
    state = addElapsed(state, puzzle.id, 95_000);
    state = submitAnswer(state, puzzle, puzzle.solution, now).state;
  };

  solve(getDailyPuzzle(seoulDateKey(now)));
  if (preset === "daily-solved") return state;

  const target = PRESET_TARGET[preset];
  if (!target) return state;

  /** 지금 등급에서 열린 연습 문제를 풀어 응시 조건을 채운다 */
  const fillTasks = (rule: PromotionRule) => {
    for (const puzzle of PRACTICE_PUZZLES) {
      if (tasksSolved(state) >= rule.requiredSolved) break;
      if (practiceUnlocked(state, puzzle)) solve(puzzle);
    }
  };

  for (let guard = 0; guard < RANKS.length; guard++) {
    const rule = promotionRuleFor(state.rank);
    if (!rule) break;
    const climbing = rankIndex(state.rank) < rankIndex(target.rank);
    if (!climbing && !target.ready) break;
    fillTasks(rule);
    if (!climbing) break;
    // 시험을 치러 올라간다. 프리셋은 하루 응시 횟수를 쓰지 않은 상태로 남긴다.
    state = startExam(state, now);
    for (const id of rule.examPuzzleIds) {
      state = openExamSheet(state, now);
      const puzzle = PUZZLE_BY_ID[id];
      if (!puzzle) return state;
      state = addElapsed(state, id, 95_000);
      state = submitAnswer(state, puzzle, puzzle.solution, now).state;
    }
    state = { ...state, examDays: {} };
  }
  // 최고 등급의 프리셋은 연습 과제도 모두 풀어 둔다
  if (preset === "rank-s") PRACTICE_PUZZLES.forEach(solve);
  return state;
}
