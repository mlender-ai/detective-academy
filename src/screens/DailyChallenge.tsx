import { todayKey } from "../app/clock";
import { goBack } from "../app/router";
import { getDailyPuzzle } from "../data/puzzles";
import { CaseSession } from "./CaseSession";

/** 오늘의 추리. 날짜(Asia/Seoul)마다 정해진 문제가 붙는다. */
export function DailyChallenge() {
  const puzzle = getDailyPuzzle(todayKey());
  return <CaseSession key={puzzle.id} puzzle={puzzle} onExit={() => goBack({ name: "home" })} />;
}
