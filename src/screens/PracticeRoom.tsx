import { useEffect } from "react";
import { goBack, navigate } from "../app/router";
import { useGame } from "../app/store";
import { PUZZLE_BY_ID } from "../data/puzzles";
import { practiceUnlocked } from "../engine/progressEngine";
import { CaseSession } from "./CaseSession";

/** 연습 과제 하나의 풀이. 연습실(등급별 서류함이 선 쿼터뷰 방)은 PracticeIso 다. */
export function PracticePlay({ id }: { id: string }) {
  const game = useGame();
  const puzzle = PUZZLE_BY_ID[id];
  // 잠긴 서랍의 과제는 주소로 직접 들어와도 열리지 않는다
  const valid = !!puzzle && puzzle.category === "practice" && practiceUnlocked(game, puzzle);

  useEffect(() => {
    if (!valid) navigate({ name: "practice" }, { replace: true });
  }, [valid]);

  if (!valid) return null;
  return <CaseSession puzzle={puzzle} onExit={() => goBack({ name: "practice" })} />;
}
