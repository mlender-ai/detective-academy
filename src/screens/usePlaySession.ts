import { useEffect, useRef, useState } from "react";
import { motionMs } from "../app/motion";
import { haptic, playSound } from "../app/sound";
import { gameStore, useGame } from "../app/store";
import { getProgress, type SubmitOutcome } from "../engine/progressEngine";
import type { Puzzle, PuzzleInput } from "../engine/types";
import { initialInput, josa, readiness, restoreInput, toAnswer, type Verdict } from "../games/logic";

export type PlayNotice = { kind: "invalid"; text: string } | { kind: "wrong" };

const WRONG_TEXT: Record<Puzzle["type"], string> = {
  code: "이 암호는 시도 기록과 맞지 않는 곳이 있습니다. 기록을 하나씩 다시 대조해 보세요.",
  truth: "이 사람이 숨겼다면 참인 진술이 하나가 되지 않습니다. 다른 가정을 확인해 보세요.",
  schedule: "이 순서는 조건 가운데 어긋나는 것이 있습니다. 조건을 하나씩 다시 확인해 보세요.",
  evidence: "이 진술은 그 증거와 함께 성립할 수 있습니다. 두 카드의 사람·시각·장소를 다시 맞대어 보세요.",
  spatial: "이 도장을 이 방향으로 찍으면 자국과 다른 곳이 있습니다. 찍으면 좌우가 뒤집힌다는 것을 떠올려 보세요.",
};

const COUNT_WORD = ["", "하나", "둘", "셋", "넷"];

/** 오답 쪽지의 글. 무엇이 틀렸는지는 알려 주지 않고, 다시 볼 곳만 가리킨다. */
export function wrongText(puzzle: Puzzle): string {
  if (puzzle.type === "truth" && puzzle.rules.trueCount !== 1) {
    const word = COUNT_WORD[puzzle.rules.trueCount] ?? `${puzzle.rules.trueCount}개`;
    return `이 사람이 숨겼다면 참인 진술이 ${word}${josa(word, "이", "가")} 되지 않습니다. 다른 가정을 확인해 보세요.`;
  }
  return WRONG_TEXT[puzzle.type];
}

interface Options {
  /** 이미 해결한 문제를 기록·보상 없이 다시 푼다 */
  replay: boolean;
  /** 정답 직후 퍼즐이 반응하는 시간(ms). 화면을 누르면 건너뛴다. */
  reactionMs: number;
  /** 정답 연출이 끝나면 호출된다 */
  onSolved: (outcome: SubmitOutcome) => void;
}

/**
 * 문제 한 판의 진행: 입력 저장, 경과 시간, 제출과 판정, 힌트 서랍.
 * 화면(책상·시험실)은 이 값을 받아 그리기만 한다.
 */
export function usePlaySession(puzzle: Puzzle, { replay, reactionMs, onSolved }: Options) {
  const game = useGame();
  const progress = getProgress(game, puzzle.id);

  const [input, setInput] = useState<PuzzleInput>(() =>
    replay ? initialInput(puzzle) : restoreInput(puzzle, progress.input),
  );
  const [phase, setPhase] = useState<"playing" | "checking">("playing");
  const [wrongCount, setWrongCount] = useState(0);
  const [notice, setNotice] = useState<PlayNotice | null>(null);
  const [hintsOpen, setHintsOpen] = useState(false);
  const outcomeRef = useRef<SubmitOutcome | null>(null);
  const finished = useRef(false);

  /* ── 경과 시간: 화면이 보이는 동안만 1초 단위로 쌓아 저장한다 ── */
  const timing = phase === "playing" && !replay && progress.status !== "solved";
  useEffect(() => {
    if (!timing) return;
    let last = performance.now();
    const flush = () => {
      const now = performance.now();
      if (!document.hidden) gameStore.addElapsed(puzzle.id, now - last);
      last = now;
    };
    const interval = window.setInterval(flush, 1000);
    const onVisibility = () => {
      if (document.hidden) gameStore.addElapsed(puzzle.id, performance.now() - last);
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flush();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [timing, puzzle.id]);

  // 가장 최근 입력값. 같은 순간에 조작이 연달아 들어와도 앞선 변경을 잃지 않는다.
  const inputRef = useRef(input);
  const change = (next: PuzzleInput | ((previous: PuzzleInput) => PuzzleInput)) => {
    if (phase !== "playing") return;
    const value = typeof next === "function" ? next(inputRef.current) : next;
    if (value === inputRef.current) return;
    inputRef.current = value;
    setInput(value);
    setNotice(null);
    if (!replay) gameStore.recordInput(puzzle.id, value);
  };

  const finish = () => {
    if (finished.current || !outcomeRef.current) return;
    finished.current = true;
    onSolved(outcomeRef.current);
  };

  const submit = () => {
    // 정답이 한 번 접수되면 즉시 잠근다. 같은 순간에 연달아 눌려도 결과와 보상은 한 번만 처리된다.
    if (phase !== "playing" || outcomeRef.current) return;
    const ready = readiness(puzzle, input);
    if (!ready.ok) {
      setNotice({ kind: "invalid", text: ready.reason });
      return;
    }
    const outcome = gameStore.submit(puzzle, toAnswer(puzzle, input));
    if (!outcome.accepted) return;
    if (outcome.correct) {
      outcomeRef.current = outcome;
      setNotice(null);
      setHintsOpen(false);
      setPhase("checking");
      playSound("success");
      haptic(18);
    } else {
      setWrongCount((count) => count + 1);
      setNotice({ kind: "wrong" });
      playSound("wrong");
      haptic(30);
    }
  };

  useEffect(() => {
    if (phase !== "checking") return;
    const id = window.setTimeout(finish, motionMs(reactionMs) + 80);
    return () => window.clearTimeout(id);
    // finish 는 ref 만 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reactionMs]);

  const locked = phase !== "playing";
  const verdict: Verdict = phase === "checking" ? "correct" : "idle";

  return {
    game,
    progress,
    input,
    phase,
    wrongCount,
    notice,
    hintsOpen,
    setHintsOpen,
    change,
    submit,
    finish,
    locked,
    verdict,
    hintsLeft: puzzle.hints.length - progress.hintsUsed,
    openedHints: puzzle.hints.slice(0, progress.hintsUsed),
    ready: readiness(puzzle, input),
  };
}
