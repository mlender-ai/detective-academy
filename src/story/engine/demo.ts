/**
 * 검수용 지름길: 사건을 "해결한 상태"로 만든다(QA 프리셋 전용. 실제 플레이는 이 함수를 거치지 않는다).
 * 등급 프리셋이 D급 너머로 올라가려면 사건 해결이 응시 조건이라, 장을 하나씩 조작해 푸는 대신 해결한 기록을 적는다.
 * 보상은 실제로 풀었을 때와 같은 값을 한 번 더한다. 장면별 풀이 기록(고른 증거 등)은 비어 있다.
 */
import type { GameState } from "../../engine/types";
import { chapterKey, findCase } from "../cases";
import { caseSolved, emptyChapter, getChapter } from "./storyEngine";

export function demoSolveCase(state: GameState, caseId: string, now: Date): GameState {
  const c = findCase(caseId);
  if (!c || caseSolved(state, caseId)) return state;
  let credits = state.credits;
  const chapters = { ...state.story.chapters };
  for (const ch of c.chapters) {
    const before = getChapter(state, c, ch);
    if (before.status === "cleared") continue;
    if (!before.rewardClaimed) credits += ch.reward;
    chapters[chapterKey(c, ch)] = {
      ...emptyChapter(),
      ...before,
      status: "cleared",
      scene: "record",
      introSeen: true,
      endingSeen: true,
      rewardClaimed: true,
      clearedAt: before.clearedAt ?? now.toISOString(),
      archive: null,
    };
  }
  const claimed = state.story.cases?.[c.id]?.rewardClaimed === true;
  if (!claimed) credits += c.reward ?? 0;
  return {
    ...state,
    credits,
    story: { ...state.story, chapters, cases: { ...state.story.cases, [c.id]: { solvedAt: state.story.cases?.[c.id]?.solvedAt ?? now.toISOString(), rewardClaimed: true } } },
  };
}
