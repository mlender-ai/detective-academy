/** 사건 등록부. 사건마다 자료(case.ts, ch2.ts …)와 추론 판정(logic.ts, logic2.ts …)이 한 묶음이다. */
import type { ChapterProgress, StoryCase, StoryChapter } from "../engine/storyTypes";
import { D001 } from "./d001/case";
import { judgeDeduction, judgeRecord } from "./d001/logic";
import { CHECKS2, judgeDeduction2, judgeOrder } from "./d001/logic2";
import { CHECKS3, judgeConfront3, judgeDeduction3, judgeRecord3 } from "./d001/logic3";
import { CHECKS4, judgeAssign4, judgeDeduction4 } from "./d001/logic4";

type Held = Pick<ChapterProgress, "evidence" | "facts">;

/**
 * 장마다의 판정. 엔진은 맞고 틀림을 스스로 정하지 않고 여기에 묻는다.
 * 장면의 종류가 없는 장은 그 종류의 판정을 비워 둔다(엔진은 그 조작을 받지 않는다).
 */
export interface ChapterLogic {
  /** records: 그 기록이 맞는가, 왜 그런가 */
  judgeRecord(sceneId: string, recordId: string): { correct: boolean; reason: string };
  /** deduce: 결론과 근거(하나면 글자, 여럿이면 목록) */
  judgeDeduction(choice: string, basis: string | readonly string[], progress: Held): "correct" | "weak" | "unsupported";
  /** order: 놓은 순서가 기록과 맞는가. 틀리면 어긋나는 까닭 하나 */
  judgeOrder?(sceneId: string, order: readonly string[]): { correct: boolean; reason: string };
  /** testimony: 진술과 기록이 어긋나는가, 기록이 진술을 받치는가 */
  judgeConfront?(sceneId: string, statementId: string, recordId: string): { kind: "contradiction" | "supports" | "nothing"; text: string };
  /** assign: 줄마다 넣은 것이 기록으로 확정되는 것과 같은가. 어긋나는 줄과 첫 까닭 */
  judgeAssign?(sceneId: string, assigned: Readonly<Record<string, string>>, progress: Held): { correct: boolean; wrong: string[]; reason: string };
  /** 힌트와 해설이 기대는 사실들 (이름 → 사건 자료에서 참인가) */
  checks?: Record<string, () => boolean>;
}

export const CASES: StoryCase[] = [D001];
/** 사건 id → 사건. 주소로 들어온 이름("__proto__" 같은 것)이 사건으로 읽히지 않도록 바탕이 없는 표로 둔다. */
export const CASE_BY_ID: Record<string, StoryCase> = Object.assign(Object.create(null) as Record<string, StoryCase>, Object.fromEntries(CASES.map((c) => [c.id, c])));

const noRecord = () => ({ correct: false, reason: "" });

const LOGIC: Record<string, ChapterLogic> = {
  "d001/ch1": {
    judgeRecord: (_scene, recordId) => judgeRecord(recordId),
    judgeDeduction: (choice, basis, progress) => (typeof basis === "string" ? judgeDeduction(choice, basis, progress) : basis.length === 1 ? judgeDeduction(choice, basis[0], progress) : "unsupported"),
  },
  "d001/ch2": {
    judgeRecord: noRecord,
    judgeDeduction: (choice, basis, progress) => judgeDeduction2(choice, basis, progress),
    judgeOrder: (_scene, order) => judgeOrder(order),
    checks: CHECKS2,
  },
  "d001/ch3": {
    judgeRecord: (_scene, recordId) => judgeRecord3(recordId),
    judgeDeduction: (choice, basis, progress) => judgeDeduction3(choice, basis, progress),
    judgeConfront: (_scene, statementId, recordId) => judgeConfront3(statementId, recordId),
    checks: CHECKS3,
  },
  "d001/ch4": {
    judgeRecord: noRecord,
    judgeDeduction: (choice, basis, progress) => judgeDeduction4(choice, basis, progress),
    judgeAssign: (_scene, assigned, progress) => judgeAssign4(assigned, progress),
    checks: CHECKS4,
  },
};

export const chapterKey = (c: StoryCase, ch: StoryChapter): string => `${c.id}/${ch.id}`;

/** 그 장의 판정이 올라와 있는가 (없는 사건·없는 장이면 false) */
export const hasLogic = (key: string): boolean => Object.prototype.hasOwnProperty.call(LOGIC, key);

export function logicOf(key: string): ChapterLogic {
  const logic = LOGIC[key];
  if (!logic) throw new Error(`판정이 없는 장: ${key}`);
  return logic;
}

/** 사건 id 로 사건을 찾는다. 없으면 null */
export const findCase = (id: string): StoryCase | null => CASE_BY_ID[id] ?? null;

/** 그 사건의 장을 id 로 찾는다. 없으면 null */
export const findChapter = (c: StoryCase, chapterId: string): StoryChapter | null => c.chapters.find((ch) => ch.id === chapterId) ?? null;

/**
 * 화면이 붙어 지금 열 수 있는 장들. 사건의 released 가 문이다(비어 있으면 전부).
 * 사건의 첫 장부터 차례로 열린다: 앞 장을 끝내야 다음 장이 열리는지는 엔진의 chapterUnlocked 가 본다.
 */
export function playableChapters(c: StoryCase): StoryChapter[] {
  return c.chapters.slice(0, c.released ?? c.chapters.length);
}
