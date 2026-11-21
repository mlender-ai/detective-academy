import { goBack } from "../app/router";
import { getDailyPuzzle } from "../data/puzzles";
import { seoulDateKey } from "../engine/time";
import { CaseSession } from "./CaseSession";

/** 오늘의 추리. 날짜 기준은 Asia/Seoul 이다. */
export function DailyChallenge() {
  const puzzle = getDailyPuzzle(seoulDateKey());
  return <CaseSession puzzle={puzzle} onExit={() => goBack({ name: "home" })} />;
}
