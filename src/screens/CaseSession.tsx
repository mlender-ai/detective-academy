import { useState } from "react";
import { withTransition } from "../app/router";
import { useGame } from "../app/store";
import { getProgress, type SubmitOutcome } from "../engine/progressEngine";
import type { Puzzle } from "../engine/types";
import { PLAY_VARIANT } from "../app/variant";
import { FoldPlay } from "./codeux/FoldPlay";
import { NotebookPlay } from "./codeux/NotebookPlay";
import { ScenePlay } from "./codeux/ScenePlay";
import { DeskPlay } from "./DeskPlay";
import { DeskResult } from "./DeskResult";

interface Props {
  puzzle: Puzzle;
  onExit: () => void;
}

/**
 * 문제 하나의 흐름: 풀이 → 결과. 둘 다 추리 책상에서 벌어지고, 같은 시험지가 이어진다.
 * 이미 해결한 문제는 기록을 먼저 보여 주고, 원하면 보상 없이 다시 풀 수 있다.
 */
export function CaseSession({ puzzle, onExit }: Props) {
  const game = useGame();
  const progress = getProgress(game, puzzle.id);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);
  const [replay, setReplay] = useState(false);
  // 들어올 때 이미 해결돼 있던 문제만 '기록 보기'로 연다.
  // 방금 맞힌 문제는 정답 연출이 끝난 뒤(onSolved) 결과 화면으로 넘어간다.
  const [solvedOnArrival] = useState(progress.status === "solved");

  if (outcome) return <DeskResult puzzle={puzzle} outcome={outcome} />;

  if (solvedOnArrival && !replay) {
    return <DeskResult puzzle={puzzle} outcome={null} onReplay={() => withTransition(() => setReplay(true))} />;
  }

  const exit = replay ? () => withTransition(() => setReplay(false), "back") : onExit;
  const solved = (result: SubmitOutcome) =>
    withTransition(() => {
      setReplay(false);
      setOutcome(result);
    });
  const key = replay ? "replay" : "play";

  // 암호 풀이 화면의 비교안 (V3 GATE 03). 주소에 ?play=a·b·c 를 붙였을 때만 열리고, 판정·힌트·보상은 같은 엔진을 쓴다.
  if (puzzle.type === "code" && PLAY_VARIANT !== "current") {
    const Play = PLAY_VARIANT === "a" ? FoldPlay : PLAY_VARIANT === "b" ? ScenePlay : NotebookPlay;
    return <Play key={key} puzzle={puzzle} replay={replay} onExit={exit} onSolved={solved} />;
  }

  return <DeskPlay key={key} puzzle={puzzle} replay={replay} onExit={exit} onSolved={solved} />;
}
