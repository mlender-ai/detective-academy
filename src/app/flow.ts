/** 지금 사용자가 해야 할 '다음 행동'. 홈과 결과 화면의 주 버튼이 이것을 따른다. */
import { getDailyPuzzle, PRACTICE_PUZZLES } from "../data/puzzles";
import { examStatus, getProgress } from "../engine/progressEngine";
import { seoulDateKey } from "../engine/time";
import type { GameState } from "../engine/types";
import type { Route } from "./router";

export type NextStep = "daily" | "practice" | "exam" | "none";

export function nextStep(state: GameState): NextStep {
  const daily = getDailyPuzzle(seoulDateKey());
  if (getProgress(state, daily.id).status !== "solved") return "daily";
  const exam = examStatus(state);
  if (!exam.rule) return "none";
  if (exam.unlocked) return "exam";
  if (PRACTICE_PUZZLES.some((p) => getProgress(state, p.id).status !== "solved")) return "practice";
  return "none";
}

export const NEXT_STEP_ACTION: Record<Exclude<NextStep, "none">, { label: string; route: Route }> = {
  daily: { label: "오늘의 추리 풀기", route: { name: "daily" } },
  practice: { label: "연습실로 이동", route: { name: "practice" } },
  exam: { label: "승급 시험 응시", route: { name: "exam" } },
};
