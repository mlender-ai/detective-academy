import { useState } from "react";
import { withTransition } from "../app/router";
import { useGame } from "../app/store";
import { getProgress, type SubmitOutcome } from "../engine/progressEngine";
import type { Puzzle } from "../engine/types";
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

  return (
    <DeskPlay
      key={replay ? "replay" : "play"}
      puzzle={puzzle}
      replay={replay}
      onExit={replay ? () => withTransition(() => setReplay(false), "back") : onExit}
      onSolved={(result) =>
        withTransition(() => {
          setReplay(false);
          setOutcome(result);
        })
      }
    />
  );
}
