/** 사건 등록부. 사건마다 자료(case.ts)와 추론 판정(logic.ts)이 한 묶음이다. */
import type { ChapterProgress, StoryCase, StoryChapter } from "../engine/storyTypes";
import { D001 } from "./d001/case";
import { judgeDeduction, judgeRecord } from "./d001/logic";

/** 장마다의 판정: 기록 고르기와 최종 추론을 사건의 논리로 채점한다 */
export interface ChapterLogic {
  judgeRecord(sceneId: string, recordId: string): { correct: boolean; reason: string };
  judgeDeduction(choice: string, basis: string, progress: Pick<ChapterProgress, "evidence" | "facts">): "correct" | "weak" | "unsupported";
}

export const CASES: StoryCase[] = [D001];
export const CASE_BY_ID: Record<string, StoryCase> = Object.fromEntries(CASES.map((c) => [c.id, c]));

const LOGIC: Record<string, ChapterLogic> = {
  "d001/ch1": {
    judgeRecord: (_scene, recordId) => judgeRecord(recordId),
    judgeDeduction: (choice, basis, progress) => judgeDeduction(choice, basis, progress),
  },
};

export const chapterKey = (c: StoryCase, ch: StoryChapter): string => `${c.id}/${ch.id}`;

export function logicOf(key: string): ChapterLogic {
  const logic = LOGIC[key];
  if (!logic) throw new Error(`판정이 없는 장: ${key}`);
  return logic;
}

/** 지금 플레이할 수 있는 장: 사건의 첫 장부터, 앞 장을 끝내야 다음 장이 열린다 */
export function playableChapters(c: StoryCase): StoryChapter[] {
  return c.chapters;
}
