/** 퍼즐 화면과 엔진 사이의 얇은 연결부: 초기 입력값, 답안 변환, 제출 가능 여부 */
import { allCards } from "../engine/evidence";
import { isCodeWellFormed } from "../engine/puzzleValidator";
import type {
  CodeInput,
  CodePuzzle,
  EvidenceInput,
  EvidencePuzzle,
  EvidenceSolution,
  Puzzle,
  PuzzleInput,
  ScheduleInput,
  SpatialInput,
  TruthInput,
  TruthPuzzle,
} from "../engine/types";

export type Verdict = "idle" | "wrong" | "correct";

/** 유형의 한 낱말 이름 (시험 안내의 좁은 칸) */
export const TYPE_WORD: Record<Puzzle["type"], string> = {
  code: "암호",
  truth: "진술",
  schedule: "순서",
  evidence: "증거",
  spatial: "인장",
};

/** 유형의 짧은 이름 (연습실의 서랍, 시험 안내) */
export const TYPE_NAME: Record<Puzzle["type"], string> = {
  code: "암호 해독",
  truth: "진술 추리",
  schedule: "순서 추론",
  evidence: "증거 조합",
  spatial: "인장 대조",
};

export interface GameProps<P extends Puzzle, I extends PuzzleInput> {
  puzzle: P;
  input: I;
  /** 새 값, 또는 직전 값에서 새 값을 만드는 함수. 연달아 들어온 조작이 서로를 덮어쓰지 않게 한다. */
  onChange: (next: I | ((previous: I) => I)) => void;
  /** 정답 판정 중·후에는 조작을 막는다 */
  locked: boolean;
  verdict: Verdict;
  /** 오답 제출 횟수. 바뀔 때마다 퍼즐이 한 번 흔들린다. */
  wrongCount: number;
}

export function initialInput(puzzle: Puzzle): PuzzleInput {
  switch (puzzle.type) {
    case "code":
      return {
        type: "code",
        dials: puzzle.rules.digits.slice(0, puzzle.rules.length),
        memo: {},
      } satisfies CodeInput;
    case "truth":
      return { type: "truth", suspect: null, memos: {}, pinned: [] } satisfies TruthInput;
    case "schedule":
      return {
        type: "schedule",
        placement: puzzle.rules.slots.map(() => null),
      } satisfies ScheduleInput;
    case "evidence":
      return { type: "evidence", picked: [], found: [] } satisfies EvidenceInput;
    case "spatial":
      return { type: "spatial", stamp: null, turns: {}, trials: [] } satisfies SpatialInput;
  }
}

/** 집어 든 두 증거가 "진술 하나 + 증거 하나"이면 그 짝을 답안으로 만든다 */
export function evidencePair(puzzle: EvidencePuzzle, picked: readonly string[]): EvidenceSolution | null {
  if (picked.length !== 2) return null;
  const cards = allCards(puzzle.rules);
  const [a, b] = picked.map((id) => cards.find((card) => card.id === id));
  if (!a || !b) return null;
  const statements = [a, b].filter((card) => card.kind === "statement");
  if (statements.length !== 1) return null;
  const against = a === statements[0] ? b : a;
  return { statement: statements[0].id, against: against.id };
}

/** 저장된 입력값이 이 문제의 것이 맞으면 그대로 쓰고, 아니면 초기값을 쓴다. */
export function restoreInput(puzzle: Puzzle, saved: PuzzleInput | null): PuzzleInput {
  if (!saved || saved.type !== puzzle.type) return initialInput(puzzle);
  if (saved.type === "code" && puzzle.type === "code") {
    return saved.dials.length === puzzle.rules.length ? saved : initialInput(puzzle);
  }
  if (saved.type === "schedule" && puzzle.type === "schedule") {
    return saved.placement.length === puzzle.rules.slots.length ? saved : initialInput(puzzle);
  }
  if (saved.type === "evidence" && puzzle.type === "evidence") {
    // 문제가 고쳐져 없어진 카드를 가리키는 값은 버린다
    const ids = new Set(allCards(puzzle.rules).map((card) => card.id));
    const base = new Set(puzzle.rules.cards.map((card) => card.id));
    const found = saved.found.filter((id) => ids.has(id) && !base.has(id));
    const have = new Set([...base, ...found]);
    return { type: "evidence", picked: saved.picked.filter((id) => have.has(id)).slice(0, 2), found };
  }
  if (saved.type === "spatial" && puzzle.type === "spatial") {
    const ids = new Set(puzzle.rules.stamps.map((stamp) => stamp.id));
    return {
      type: "spatial",
      stamp: saved.stamp && ids.has(saved.stamp) ? saved.stamp : null,
      turns: Object.fromEntries(Object.entries(saved.turns).filter(([id]) => ids.has(id))),
      trials: saved.trials.filter((trial) => ids.has(trial.stamp)).slice(0, puzzle.rules.trials),
    };
  }
  return saved;
}

export function toAnswer(puzzle: Puzzle, input: PuzzleInput): unknown {
  switch (input.type) {
    case "code":
      return input.dials;
    case "truth":
      return input.suspect;
    case "schedule":
      return input.placement;
    case "evidence":
      return puzzle.type === "evidence" ? evidencePair(puzzle, input.picked) : null;
    case "spatial":
      return input.stamp ? { stamp: input.stamp, turn: input.turns[input.stamp] ?? 0 } : null;
  }
}

export type Readiness = { ok: true } | { ok: false; reason: string };

export function readiness(puzzle: Puzzle, input: PuzzleInput): Readiness {
  if (puzzle.type === "code" && input.type === "code") {
    if (!isCodeWellFormed((puzzle as CodePuzzle).rules, input.dials)) {
      return { ok: false, reason: `암호는 서로 다른 숫자 ${puzzle.rules.length}개입니다. 겹치는 숫자를 바꿔 주세요.` };
    }
    return { ok: true };
  }
  if (puzzle.type === "truth" && input.type === "truth") {
    if (!input.suspect || !(puzzle as TruthPuzzle).rules.people.some((p) => p.id === input.suspect)) {
      const item = (puzzle as TruthPuzzle).rules.item ?? "답안지";
      return { ok: false, reason: `${item}${josa(item, "을", "를")} 숨겼다고 생각하는 사람을 먼저 고르세요.` };
    }
    return { ok: true };
  }
  if (puzzle.type === "schedule" && input.type === "schedule") {
    const empty = input.placement.filter((id) => id === null).length;
    if (empty > 0) {
      return { ok: false, reason: `아직 비어 있는 자리가 ${empty}개 있습니다. ${headCount(puzzle.rules.people.length)}을 모두 배치하세요.` };
    }
    return { ok: true };
  }
  if (puzzle.type === "evidence" && input.type === "evidence") {
    if (input.picked.length < 2) return { ok: false, reason: "증거 두 개를 골라 맞대어 보세요." };
    if (!evidencePair(puzzle, input.picked)) {
      return { ok: false, reason: "거짓이라고 생각하는 진술 하나와, 그 진술을 깨는 증거 하나를 고르세요." };
    }
    return { ok: true };
  }
  if (puzzle.type === "spatial" && input.type === "spatial") {
    if (!input.stamp) return { ok: false, reason: "자국을 낸 도장을 먼저 집으세요." };
    return { ok: true };
  }
  return { ok: false, reason: "입력값을 확인할 수 없습니다." };
}

const HEADS = ["", "한 명", "두 명", "세 명", "네 명", "다섯 명", "여섯 명"];
const COUNTS = ["", "한", "두", "세", "네", "다섯", "여섯"];

/** "네 명", "다섯 명" */
export function headCount(n: number): string {
  return HEADS[n] ?? `${n}명`;
}

/** "네", "다섯" (뒤에 단위가 붙는다: 네 진술) */
export function countWord(n: number): string {
  return COUNTS[n] ?? String(n);
}

/** 받침 유무에 따라 조사를 고른다: josa("다온", "이", "가") → "이" */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return withoutFinal;
  return (code - 0xac00) % 28 === 0 ? withoutFinal : withFinal;
}

export function submitLabel(puzzle: Puzzle, input: PuzzleInput): string {
  if (puzzle.type === "truth" && input.type === "truth" && input.suspect) {
    const name = puzzle.rules.people.find((p) => p.id === input.suspect)?.name;
    if (name) return `${name} 지목하고 제출`;
  }
  if (puzzle.type === "evidence") return "모순으로 제출";
  if (puzzle.type === "spatial") return "이 도장으로 제출";
  return "추론 제출";
}
