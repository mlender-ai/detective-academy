import { useState } from "react";
import { withTransition } from "../app/router";
import { useGame } from "../app/store";
import { getProgress, type SubmitOutcome } from "../engine/progressEngine";
import type { Puzzle } from "../engine/types";
import { PLAY_VARIANT } from "../app/variant";
import { NotebookPlay } from "./codeux/NotebookPlay";
import { ScenePlay } from "./codeux/ScenePlay";
import { EvidencePlay } from "./cases/EvidencePlay";
import { SealPlay } from "./cases/SealPlay";
import { DeskPlay } from "./DeskPlay";
import { DeskResult } from "./DeskResult";

interface Props {
  puzzle: Puzzle;
  onExit: () => void;
}

/**
 * 문제 하나의 흐름: 풀이 → 결과. 진술 추리·순서 추론은 추리 책상에서, 암호 해독은 자료실 장면에서 풀고,
 * 결과는 모두 추리 책상의 채점 기록으로 이어진다.
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

  // 암호 해독은 자료실 장면에서 푼다 (V3 GATE 03 에서 사용자가 고른 B안).
  // 수사 수첩(C안)은 다른 문제에 쓸 후보로 남겨 둔 화면이라 주소에 ?play=c 를 붙였을 때만 열린다. 판정·힌트·보상은 같은 엔진을 쓴다.
  if (puzzle.type === "code") {
    const Play = PLAY_VARIANT === "notebook" ? NotebookPlay : ScenePlay;
    return <Play key={key} puzzle={puzzle} replay={replay} onExit={exit} onSolved={solved} />;
  }

  // 새 유형 둘은 추리 책상 위에 저마다의 물건(증거 게시판, 도장과 자국)을 놓는다
  if (puzzle.type === "evidence") return <EvidencePlay key={key} puzzle={puzzle} replay={replay} onExit={exit} onSolved={solved} />;
  if (puzzle.type === "spatial") return <SealPlay key={key} puzzle={puzzle} replay={replay} onExit={exit} onSolved={solved} />;

  return <DeskPlay key={key} puzzle={puzzle} replay={replay} onExit={exit} onSolved={solved} />;
}
