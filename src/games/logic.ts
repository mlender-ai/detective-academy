/** 퍼즐 화면과 엔진 사이의 얇은 연결부: 초기 입력값, 답안 변환, 제출 가능 여부 */
import { isCodeWellFormed } from "../engine/puzzleValidator";
import type {
  CodeInput,
  CodePuzzle,
  Puzzle,
  PuzzleInput,
  ScheduleInput,
  TruthInput,
  TruthPuzzle,
} from "../engine/types";

export type Verdict = "idle" | "wrong" | "correct";

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
  }
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
  return saved;
}

export function toAnswer(input: PuzzleInput): unknown {
  switch (input.type) {
    case "code":
      return input.dials;
    case "truth":
      return input.suspect;
    case "schedule":
      return input.placement;
  }
}

export type Readiness = { ok: true } | { ok: false; reason: string };

export function readiness(puzzle: Puzzle, input: PuzzleInput): Readiness {
  if (puzzle.type === "code" && input.type === "code") {
    if (!isCodeWellFormed((puzzle as CodePuzzle).rules, input.dials)) {
      return { ok: false, reason: "암호는 서로 다른 숫자 3개입니다. 겹치는 숫자를 바꿔 주세요." };
    }
    return { ok: true };
  }
  if (puzzle.type === "truth" && input.type === "truth") {
    if (!input.suspect || !(puzzle as TruthPuzzle).rules.people.some((p) => p.id === input.suspect)) {
      return { ok: false, reason: "답안지를 숨겼다고 생각하는 사람을 먼저 고르세요." };
    }
    return { ok: true };
  }
  if (puzzle.type === "schedule" && input.type === "schedule") {
    const empty = input.placement.filter((id) => id === null).length;
    if (empty > 0) {
      return { ok: false, reason: `아직 비어 있는 시간이 ${empty}개 있습니다. 네 명을 모두 배치하세요.` };
    }
    return { ok: true };
  }
  return { ok: false, reason: "입력값을 확인할 수 없습니다." };
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
  return "추론 제출";
}
