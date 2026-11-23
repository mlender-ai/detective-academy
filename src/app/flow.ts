/** 지금 사용자가 해야 할 '다음 행동'. 홈과 결과 화면의 주 버튼이 이것을 따른다. */
import { getDailyPuzzle, PRACTICE_PUZZLES } from "../data/puzzles";
import { examStatus, getProgress, practiceUnlocked } from "../engine/progressEngine";
import type { GameState } from "../engine/types";
import { gameNow, todayKey } from "./clock";
import type { Route } from "./router";

export type NextStep = "daily" | "practice" | "exam" | "case" | "none";

export function nextStep(state: GameState): NextStep {
  // 달력이 끝난 날에는 오늘의 추리가 없다: 시험과 연습실로 넘어간다
  const daily = getDailyPuzzle(todayKey());
  if (daily && getProgress(state, daily.id).status !== "solved") return "daily";
  const exam = examStatus(state, gameNow());
  // 치르던 시험이 있거나(떨어진 결과를 아직 보지 않은 것 포함), 지금 응시할 수 있으면 시험실이 먼저다
  if (exam.session || exam.canStart) return "exam";
  // 다음 시험이 사건 해결을 기다리고 있으면(D→C) 사건 수사가 할 일이다. 오늘의 추리가 먼저인 것은 그대로다
  if (exam.rule && exam.caseRequired && exam.tasksDone && !exam.caseDone) return "case";
  if (PRACTICE_PUZZLES.some((p) => practiceUnlocked(state, p) && getProgress(state, p.id).status !== "solved")) return "practice";
  return "none";
}

/** 그 할 일로 가는 단추(결과 화면의 주 단추). 할 일이 없으면 null */
export function nextAction(state: GameState): { label: string; route: Route } | null {
  const step = nextStep(state);
  if (step === "none") return null;
  if (step === "case") {
    const id = examStatus(state, gameNow()).caseRequired;
    return id ? { label: "사건 수사로 이동", route: { name: "story", id } } : null;
  }
  return NEXT_STEP_ACTION[step];
}

export const NEXT_STEP_ACTION: Record<Exclude<NextStep, "none" | "case">, { label: string; route: Route }> = {
  daily: { label: "오늘의 추리 풀기", route: { name: "daily" } },
  practice: { label: "연습실로 이동", route: { name: "practice" } },
  exam: { label: "승급 시험 응시", route: { name: "exam" } },
};
