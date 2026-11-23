/** 지금 사용자가 해야 할 '다음 행동'. 홈과 결과 화면의 주 버튼이 이것을 따른다. */
import { getDailyPuzzle, PRACTICE_PUZZLES } from "../data/puzzles";
import { examStatus, getProgress, practiceUnlocked } from "../engine/progressEngine";
import type { GameState } from "../engine/types";
import { gameNow, todayKey } from "./clock";
import type { Route } from "./router";

export type NextStep = "daily" | "practice" | "exam" | "none";

export function nextStep(state: GameState): NextStep {
  // 달력이 끝난 날에는 오늘의 추리가 없다: 시험과 연습실로 넘어간다
  const daily = getDailyPuzzle(todayKey());
  if (daily && getProgress(state, daily.id).status !== "solved") return "daily";
  const exam = examStatus(state, gameNow());
  // 치르던 시험이 있거나(떨어진 결과를 아직 보지 않은 것 포함), 지금 응시할 수 있으면 시험실이 먼저다
  if (exam.session || exam.canStart) return "exam";
  if (PRACTICE_PUZZLES.some((p) => practiceUnlocked(state, p) && getProgress(state, p.id).status !== "solved")) return "practice";
  return "none";
}

export const NEXT_STEP_ACTION: Record<Exclude<NextStep, "none">, { label: string; route: Route }> = {
  daily: { label: "오늘의 추리 풀기", route: { name: "daily" } },
  practice: { label: "연습실로 이동", route: { name: "practice" } },
  exam: { label: "승급 시험 응시", route: { name: "exam" } },
};
