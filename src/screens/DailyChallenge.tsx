import { useEffect, useState } from "react";
import { todayKey } from "../app/clock";
import { goBack, navigate } from "../app/router";
import { getDailyPuzzle } from "../data/puzzles";
import { CaseSession } from "./CaseSession";

/**
 * 오늘의 추리. 날짜(Asia/Seoul)마다 정해진 문제가 붙는다.
 * 들어선 때의 문제를 끝까지 붙든다: 푸는 중에 자정을 넘겨도 풀던 문제가 다음 날의 문제로 갈리지 않고,
 * 그 문제의 해결과 보상은 그대로 처리된다(새 날의 문제는 홀로 돌아가면 게시판에 붙어 있다).
 * 달력이 끝난 날에는 오늘의 추리가 없다: 주소(#/daily)로 바로 와도 지난 사건의 목록으로 돌려보낸다.
 */
export function DailyChallenge() {
  const [puzzle] = useState(() => getDailyPuzzle(todayKey()));

  useEffect(() => {
    if (!puzzle) navigate({ name: "daily-past" }, { replace: true });
  }, [puzzle]);

  if (!puzzle) return null;
  return <CaseSession puzzle={puzzle} onExit={() => goBack({ name: "home" })} />;
}
