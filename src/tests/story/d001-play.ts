/**
 * CASE D-001 을 엔진으로 플레이하는 도우미 (테스트가 함께 쓴다).
 * 정답을 글자로 적어 두지 않는다: 장면마다 그 장의 판정(logicOf)에 물어, 맞는 기록·순서·모순·배정·결론을 찾아서 낸다.
 * 자료를 고쳐 답이 달라지면 이 도우미도 달라진 답을 낸다. 답이 없으면 오류로 멈춘다.
 */
import { permutations } from "../../engine/puzzleValidator";
import { buildDemoState } from "../../engine/progressEngine";
import type { GameState } from "../../engine/types";
import { chapterKey, logicOf } from "../../story/cases";
import { D001 } from "../../story/cases/d001/case";
import { SESSIONS } from "../../story/cases/d001/logic";
import {
  confront,
  differencesOf,
  finishEnding,
  getChapter,
  goScene,
  investigate,
  linkItems,
  markDifference,
  pickRecord,
  seeIntro,
  setAssign,
  submitAssign,
  submitDeduction,
  submitOrder,
} from "../../story/engine/storyEngine";
import type { ChapterProgress, DeduceScene, StoryChapter, StoryScene } from "../../story/engine/storyTypes";

export const NOW = new Date("2026-11-22T03:00:00Z");
export const c = D001;
export const [ch1, ch2, ch3, ch4] = c.chapters;

/** D급이 된 탐정 */
export const detective = (): GameState => buildDemoState("promoted", NOW);

export const logic = (ch: StoryChapter) => logicOf(chapterKey(c, ch));
export const progress = (state: GameState, ch: StoryChapter): ChapterProgress => getChapter(state, c, ch);
export const sceneOfKind = <K extends StoryScene["kind"]>(ch: StoryChapter, kind: K) => ch.scenes.find((s): s is Extract<StoryScene, { kind: K }> => s.kind === kind)!;

/** items 에서 size 개를 고르는 모든 조합 */
export function combos<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  return items.flatMap((item, i) => combos(items.slice(i + 1), size - 1).map((rest) => [item, ...rest]));
}

/** 그 장의 최종 추론에서 판정이 correct 인 (결론, 근거) 전부 */
export function correctDeductions(ch: StoryChapter, p: Pick<ChapterProgress, "evidence" | "facts">): { choice: string; bases: string[] }[] {
  const scene = sceneOfKind(ch, "deduce") as DeduceScene;
  const need = scene.need ?? 1;
  return scene.choices.flatMap((choice) =>
    combos(scene.basis, need)
      .filter((bases) => logic(ch).judgeDeduction(choice.id, need === 1 ? bases[0] : bases, p) === "correct")
      .map((bases) => ({ choice: choice.id, bases })),
  );
}

/** 장면 하나를 끝낸다. 최종 추론(deduce)은 내지 않는다(submitCorrect 가 낸다). */
export function playScene(state: GameState, ch: StoryChapter, scene: StoryScene): GameState {
  const judge = logic(ch);
  switch (scene.kind) {
    case "timeline":
      for (const point of scene.points.filter((x) => x.required)) state = investigate(state, c, ch, scene.id, point.id).state;
      return state;
    case "records": {
      const ids = scene.records?.map((r) => r.id) ?? SESSIONS.map((s) => s.id);
      const right = ids.filter((id) => judge.judgeRecord(scene.id, id).correct);
      if (right.length !== 1) throw new Error(`${scene.id}: 맞는 기록이 ${right.length}개다`);
      return pickRecord(state, c, ch, scene.id, right[0]).state;
    }
    case "link":
      for (const link of scene.links) state = linkItems(state, c, ch, scene.id, link.a, link.b).state;
      return state;
    case "compare":
      for (const d of differencesOf(scene)) state = markDifference(state, c, ch, scene.id, d.frame, d.field.id).state;
      return state;
    case "order": {
      const right = permutations(scene.cards.map((card) => card.id)).filter((order) => judge.judgeOrder!(scene.id, order).correct);
      if (right.length !== 1) throw new Error(`${scene.id}: 맞는 순서가 ${right.length}개다`);
      return submitOrder(state, c, ch, scene.id, right[0]).state;
    }
    case "testimony":
      for (const statement of scene.statements)
        for (const record of scene.records) if (judge.judgeConfront!(scene.id, statement.id, record.id).kind === "contradiction") state = confront(state, c, ch, scene.id, statement.id, record.id).state;
      return state;
    case "assign": {
      // 줄마다, 그 줄이 어긋나는 줄에 들지 않는 사람을 찾는다(나머지 줄은 무엇이 들어 있든 그 줄의 판정에 영향이 없다)
      const blank = Object.fromEntries(scene.rows.map((row) => [row.id, scene.options[0].id]));
      for (const row of scene.rows) {
        const right = scene.options.filter((option) => !judge.judgeAssign!(scene.id, { ...blank, [row.id]: option.id }, progress(state, ch)).wrong.includes(row.id));
        if (right.length !== 1) throw new Error(`${scene.id}/${row.id}: 맞는 사람이 ${right.length}명이다`);
        state = setAssign(state, c, ch, scene.id, row.id, right[0].id);
      }
      return submitAssign(state, c, ch, scene.id).state;
    }
    case "deduce":
      return state;
  }
}

/** 도입을 넘기고, 최종 추론 장면에 들어서기까지 모든 장면을 끝낸다 */
export function playToDeduction(state: GameState, ch: StoryChapter): GameState {
  state = seeIntro(state, c, ch);
  for (const scene of ch.scenes) {
    state = goScene(state, c, ch, scene.id);
    state = playScene(state, ch, scene);
  }
  return state;
}

/** 최종 추론을 맞게 낸다 */
export function submitCorrect(state: GameState, ch: StoryChapter, now: Date = NOW) {
  const scene = sceneOfKind(ch, "deduce");
  const right = correctDeductions(ch, progress(state, ch));
  if (right.length === 0) throw new Error(`${ch.id}: 맞는 결론이 없다`);
  const { choice, bases } = right[0];
  return submitDeduction(state, c, ch, scene.id, choice, (scene.need ?? 1) === 1 ? bases[0] : bases, now);
}

/** 장 하나를 처음부터 끝까지 해결하고 끝 장면까지 본다 */
export function clearChapter(state: GameState, ch: StoryChapter, now: Date = NOW): GameState {
  return finishEnding(submitCorrect(playToDeduction(state, ch), ch, now).state, c, ch);
}

/** 그 장 앞의 장들을 모두 해결한 상태 */
export function upTo(ch: StoryChapter, state: GameState = detective()): GameState {
  for (const prev of c.chapters.slice(0, c.chapters.indexOf(ch))) state = clearChapter(state, prev);
  return state;
}

/** 장의 글 전부 (도입, 장면, 증거, 힌트, 해설, 끝 장면) */
export function textsOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(textsOf);
  if (value && typeof value === "object") return Object.values(value).flatMap(textsOf);
  return [];
}

/** 글에 나오는 시각("17:52") 전부 */
export const clocksIn = (texts: readonly string[]): string[] => texts.flatMap((text) => text.match(/\d{1,2}:\d{2}/g) ?? []);
