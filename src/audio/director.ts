/** 지금 화면에 어떤 곡이 흐르는가. 화면마다 따로 정하지 않고 여기 한 곳에서 정한다. */
import type { Route } from "../app/router";
import type { GameState } from "../engine/types";
import type { TrackId } from "./tracks";

export function trackFor(route: Route, game: GameState, admitting: boolean): TrackId {
  if (admitting) return "theme";
  switch (route.name) {
    case "home":
      return "corridor";
    case "daily":
    case "daily-past-play":
    case "practice-play":
    case "story":
      return "deduction";
    case "exam": {
      const exam = game.exam;
      // 시험지를 펼쳐 푸는 동안에만: 제한 시간이 있으면 카운트다운, 없으면 풀이의 곡
      if (exam && exam.status === "active" && exam.stage === "playing") return exam.remainingMs !== null ? "countdown" : "deduction";
      return "theme";
    }
    default:
      return "theme";
  }
}
