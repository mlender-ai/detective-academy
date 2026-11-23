/**
 * 스토리 진행 엔진. GameState 를 받아 새 GameState 를 돌려주는 순수 함수들이다(저장과 화면을 모른다).
 *
 *  - 장은 차례로 열린다: 앞 장을 해결해야 다음 장에 들어갈 수 있다(chapterUnlocked).
 *  - 장면도 차례로 열린다: 앞 장면에서 얻어야 할 것(증거, 맞는 기록, 확정한 사실…)을 얻어야 다음 장면에 들어갈 수 있다.
 *  - 장을 해결한 뒤에는 모든 장면을 다시 볼 수 있고, 처음부터 다시 풀 수도 있다(restartChapter). 보상은 처음 한 번만 받는다.
 *  - 사건의 모든 장을 해결하면 사건 해결 보상을 한 번 받는다. 사건 해결은 등급을 건드리지 않는다
 *    (승급 시험의 응시 조건으로 쓰려면 caseSolved 를 읽는다).
 *
 * 판정은 엔진이 하지 않는다: 장마다의 판정(cases/index.ts 의 logicOf)에 묻는다.
 */
import { rankIndex } from "../../data/ranks";
import { hintCost, spend } from "../../engine/creditEngine";
import type { GameState } from "../../engine/types";
import { chapterKey, findCase, hasLogic, logicOf, playableChapters } from "../cases";
import type {
  AssignScene,
  CaseProgress,
  ChapterProgress,
  ChapterRun,
  CompareField,
  CompareScene,
  DeduceScene,
  Evidence,
  OrderScene,
  StoryCase,
  StoryChapter,
  StoryFact,
  StoryScene,
  StoryState,
} from "./storyTypes";

export function emptyStory(): StoryState {
  return { chapters: {} };
}

function emptyRun(): ChapterRun {
  return {
    visited: [],
    notes: [],
    evidence: [],
    picked: {},
    facts: [],
    deduction: { choice: null, basis: null, bases: [] },
    placed: {},
    assigned: {},
    exposed: [],
    verified: [],
    solved: [],
    wrong: 0,
  };
}

export function emptyChapter(): ChapterProgress {
  return {
    ...emptyRun(),
    status: "new",
    scene: "intro",
    introSeen: false,
    hintsUsed: 0,
    sceneHints: {},
    rewardClaimed: false,
    endingSeen: false,
    clearedAt: null,
    archive: null,
  };
}

export function getChapter(state: GameState, c: StoryCase, ch: StoryChapter): ChapterProgress {
  return state.story.chapters[chapterKey(c, ch)] ?? emptyChapter();
}

function withChapter(state: GameState, c: StoryCase, ch: StoryChapter, update: (p: ChapterProgress) => ChapterProgress): GameState {
  const key = chapterKey(c, ch);
  const before = getChapter(state, c, ch);
  const after = update(before);
  if (after === before) return state;
  return { ...state, story: { ...state.story, chapters: { ...state.story.chapters, [key]: after } } };
}

const union = (have: readonly string[], more: readonly string[]): string[] => {
  const fresh = more.filter((id) => !have.includes(id));
  return fresh.length > 0 ? [...have, ...fresh] : (have as string[]);
};

/* ───────── 사건과 장이 열려 있는가 ───────── */

/** 이 사건을 맡을 수 있는 등급인가 */
export function storyUnlocked(state: GameState, c: StoryCase): boolean {
  return state.enrolled && rankIndex(state.rank) >= rankIndex(c.rank);
}

/** 그 장을 해결한 적이 있는가. 다시 푸는 동안에도 참이다. */
export function chapterCleared(p: ChapterProgress): boolean {
  return p.status === "cleared" || p.archive !== null;
}

/** 그 장에 들어갈 수 있는가: 사건을 맡을 수 있고, 그 사건의 장이고, 앞 장을 모두 해결했다 */
export function chapterUnlocked(state: GameState, c: StoryCase, ch: StoryChapter): boolean {
  if (!storyUnlocked(state, c)) return false;
  const index = c.chapters.findIndex((x) => x.id === ch.id);
  if (index < 0 || !hasLogic(chapterKey(c, ch))) return false;
  return c.chapters.slice(0, index).every((prev) => chapterCleared(getChapter(state, c, prev)));
}

/** 장 하나의 상태 (장을 고르는 화면이 비춘다) */
export function chapterStatus(state: GameState, c: StoryCase, ch: StoryChapter): "locked" | "new" | "open" | "cleared" {
  if (!chapterUnlocked(state, c, ch)) return "locked";
  const p = getChapter(state, c, ch);
  if (chapterCleared(p)) return "cleared";
  return p.status === "new" ? "new" : "open";
}

/** 풀지 않은 첫 장. 열 수 있는 장을 모두 해결했으면 null */
export function nextChapter(state: GameState, c: StoryCase): StoryChapter | null {
  return playableChapters(c).find((ch) => !chapterCleared(getChapter(state, c, ch))) ?? null;
}

/**
 * 사건에 들어가면 열 장: 풀지 않은 첫 장, 다 풀었으면 마지막 장(사건 기록).
 * 장을 골라 들어올 때(wanted)는 그 장이 열려 있으면 그 장을, 없는 장·잠긴 장이면 위의 장을 돌려준다.
 */
export function chapterToOpen(state: GameState, c: StoryCase, wanted?: string | null): StoryChapter | null {
  const open = playableChapters(c);
  if (open.length === 0) return null;
  const asked = wanted ? open.find((ch) => ch.id === wanted) : undefined;
  if (asked && chapterUnlocked(state, c, asked)) return asked;
  return nextChapter(state, c) ?? open[open.length - 1];
}

/** 사건이 지금 어떤 상태인가 (홈의 사건 접수함이 이것을 비춘다). 지금 열 수 있는 장들로 본다. */
export function caseStatus(state: GameState, c: StoryCase): "locked" | "new" | "open" | "cleared" {
  if (!storyUnlocked(state, c)) return "locked";
  const all = playableChapters(c).map((ch) => getChapter(state, c, ch));
  if (all.every(chapterCleared)) return "cleared";
  return all.some((p) => p.status !== "new" || p.archive !== null) ? "open" : "new";
}

/**
 * 사건을 끝까지 해결했는가: 사건의 모든 장(아직 화면이 없는 장까지)을 해결했다.
 * 승급 시험의 응시 조건 같은 곳에서 사건 id 로 묻는다. 없는 사건이면 false.
 */
export function caseSolved(state: GameState, caseId: string): boolean {
  const c = findCase(caseId);
  if (!c || c.chapters.length === 0) return false;
  return c.chapters.every((ch) => chapterCleared(getChapter(state, c, ch)));
}

/** 사건 해결 보상을 받았는가 */
export function caseRewardClaimed(state: GameState, caseId: string): boolean {
  return state.story.cases?.[caseId]?.rewardClaimed === true;
}

/* ───────── 증거와 기록 ───────── */

/** 처음 해결했을 때의 풀이 기록. 다시 푸는 중이면 보관해 둔 것을, 아니면 지금 것을 돌려준다(사건 기록 화면이 읽는다). */
export function recordOf(p: ChapterProgress): ChapterProgress {
  return p.archive ? { ...p, ...p.archive, status: "cleared", archive: null } : p;
}

/**
 * 그 장에서 손에 쥔 증거: 앞 장들의 증거 전부(앞 장을 해결해야 이 장이 열린다) + 이 장에서 얻은 것.
 * 수사 노트가 이것을 보여 준다.
 */
export function heldEvidence(state: GameState, c: StoryCase, ch: StoryChapter): Evidence[] {
  const index = c.chapters.findIndex((x) => x.id === ch.id);
  if (index < 0) return [];
  const before = c.chapters.slice(0, index).flatMap((prev) => (chapterCleared(getChapter(state, c, prev)) ? prev.evidence : []));
  const mine = getChapter(state, c, ch).evidence;
  return [...before, ...ch.evidence.filter((e) => mine.includes(e.id))];
}

/** 사건 전체의 증거 기록: 해결한 장은 그 장의 증거 전부, 풀고 있는 장은 지금까지 얻은 것 (다시 열람하는 화면이 읽는다) */
export function caseEvidence(state: GameState, c: StoryCase): { chapter: StoryChapter; evidence: Evidence[] }[] {
  return c.chapters.map((ch) => {
    const p = getChapter(state, c, ch);
    const have = chapterCleared(p) ? ch.evidence.map((e) => e.id) : p.evidence;
    return { chapter: ch, evidence: ch.evidence.filter((e) => have.includes(e.id)) };
  });
}

/* ───────── 장면 ───────── */

const sceneOf = (ch: StoryChapter, id: string): StoryScene | undefined => ch.scenes.find((s) => s.id === id);

/** 그 장면에서 얻어야 할 것을 다 얻었는가 */
export function sceneDone(p: ChapterProgress, scene: StoryScene): boolean {
  switch (scene.kind) {
    case "timeline":
      return p.evidence.includes(scene.grants);
    case "records":
      return !!p.picked[scene.id];
    case "link":
      return scene.facts.every((fact) => p.facts.includes(fact.id));
    case "deduce":
      return p.status === "cleared";
    case "compare":
    case "order":
    case "testimony":
    case "assign":
      return p.solved.includes(scene.id);
  }
}

/** 그 곳("intro", 장면 id, "ending", "record")에 지금 들어갈 수 있는가 */
export function sceneReachable(p: ChapterProgress, ch: StoryChapter, id: string): boolean {
  if (id === "intro") return true;
  // 다시 푸는 동안에는 끝 장면과 사건 기록으로 "가지" 않는다(있던 장면을 잃지 않게). 그동안의 사건 기록은 recordOf 로 읽는다.
  if (id === "ending" || id === "record") return p.status === "cleared";
  const index = ch.scenes.findIndex((s) => s.id === id);
  if (index < 0 || !p.introSeen) return false;
  if (p.status === "cleared") return true;
  return ch.scenes.slice(0, index).every((scene) => sceneDone(p, scene));
}

/** 그 장면 다음에 갈 곳 */
export function sceneAfter(ch: StoryChapter, id: string): string {
  if (id === "intro") return ch.scenes[0].id;
  const index = ch.scenes.findIndex((s) => s.id === id);
  return ch.scenes[index + 1]?.id ?? "ending";
}

/** 그 곳으로 간다. 아직 열리지 않은 곳이면 그대로다. */
export function goScene(state: GameState, c: StoryCase, ch: StoryChapter, id: string): GameState {
  if (!chapterUnlocked(state, c, ch)) return state;
  return withChapter(state, c, ch, (p) => {
    if (!sceneReachable(p, ch, id)) return p;
    const visited = p.visited.includes(id) ? p.visited : [...p.visited, id];
    if (p.scene === id && visited === p.visited) return p;
    return { ...p, scene: id, visited, status: p.status === "new" ? "in_progress" : p.status };
  });
}

/** 도입을 다 봤다(또는 건너뛰었다): 도착해 있는 기록을 받고 첫 장면으로 */
export function seeIntro(state: GameState, c: StoryCase, ch: StoryChapter): GameState {
  if (!chapterUnlocked(state, c, ch)) return state;
  const seen = withChapter(state, c, ch, (p) =>
    p.introSeen ? p : { ...p, introSeen: true, status: p.status === "new" ? "in_progress" : p.status, evidence: union(p.evidence, ch.given ?? []) },
  );
  return goScene(seen, c, ch, ch.scenes[0].id);
}

/** 장면을 끝냈다고 적고, 그 장면이 주는 증거를 넣는다 */
const finishScene = (p: ChapterProgress, scene: StoryScene, grants: readonly string[]): ChapterProgress => ({
  ...p,
  solved: union(p.solved, [scene.id]),
  evidence: union(p.evidence, grants),
});

/* ───────── 조사 (timeline) ───────── */

export interface InvestigateOutcome {
  /** 처음 조사한 곳인가 */
  fresh: boolean;
  /** 이번 조사로 얻은 증거 */
  granted: string | null;
}

/** 방송 화면의 한 곳을 조사한다. 필요한 곳을 모두 조사하면 증거가 완성된다. */
export function investigate(state: GameState, c: StoryCase, ch: StoryChapter, sceneId: string, pointId: string): { state: GameState; outcome: InvestigateOutcome } {
  const scene = sceneOf(ch, sceneId);
  const none = { state, outcome: { fresh: false, granted: null } };
  if (!scene || scene.kind !== "timeline" || !chapterUnlocked(state, c, ch)) return none;
  if (!scene.points.some((point) => point.id === pointId)) return none;
  const before = getChapter(state, c, ch);
  if (!sceneReachable(before, ch, sceneId) || before.notes.includes(pointId)) return none;

  const notes = [...before.notes, pointId];
  const complete = scene.points.filter((point) => point.required).every((point) => notes.includes(point.id));
  const granted = complete && !before.evidence.includes(scene.grants) ? scene.grants : null;
  const next = withChapter(state, c, ch, (p) => ({
    ...p,
    notes,
    evidence: granted ? [...p.evidence, granted] : p.evidence,
    status: p.status === "new" ? "in_progress" : p.status,
  }));
  return { state: next, outcome: { fresh: true, granted } };
}

/* ───────── 기록 고르기 (records) ───────── */

export interface PickOutcome {
  correct: boolean;
  /** 맞든 틀리든, 왜 그런지 */
  reason: string;
  granted: string[];
}

/** 여러 기록 가운데 하나를 고른다. 틀리면 그 기록이 아닌 까닭을 돌려준다(맞는 기록은 말하지 않는다). */
export function pickRecord(state: GameState, c: StoryCase, ch: StoryChapter, sceneId: string, recordId: string): { state: GameState; outcome: PickOutcome } {
  const scene = sceneOf(ch, sceneId);
  const before = getChapter(state, c, ch);
  if (!scene || scene.kind !== "records" || !chapterUnlocked(state, c, ch) || !sceneReachable(before, ch, sceneId)) {
    return { state, outcome: { correct: false, reason: "", granted: [] } };
  }
  const verdict = logicOf(chapterKey(c, ch)).judgeRecord(sceneId, recordId);
  if (before.picked[sceneId]) {
    // 이미 맞는 기록을 골라 둔 뒤에는 다시 채점하지 않는다(까닭만 다시 읽는다)
    return { state, outcome: { ...verdict, granted: [] } };
  }
  if (!verdict.correct) {
    return { state: withChapter(state, c, ch, (p) => ({ ...p, wrong: p.wrong + 1 })), outcome: { ...verdict, granted: [] } };
  }
  const granted = scene.grants.filter((id) => !before.evidence.includes(id));
  const next = withChapter(state, c, ch, (p) => ({ ...p, picked: { ...p.picked, [sceneId]: recordId }, evidence: [...p.evidence, ...granted] }));
  return { state: next, outcome: { ...verdict, granted } };
}

/* ───────── 잇기 (link) ───────── */

export type LinkOutcome =
  | { kind: "fact"; fact: StoryFact; text: string; all: boolean }
  | { kind: "known"; fact: StoryFact; text: string; all: boolean }
  | { kind: "none"; text: string; all: boolean };

/** 두 문서의 항목을 잇는다. 이어서 나오는 사실이 있으면 확정하고, 없으면 까닭을 돌려준다(채점하지 않는다). */
export function linkItems(state: GameState, c: StoryCase, ch: StoryChapter, sceneId: string, a: string, b: string): { state: GameState; outcome: LinkOutcome } {
  const scene = sceneOf(ch, sceneId);
  const before = getChapter(state, c, ch);
  if (!scene || scene.kind !== "link" || !chapterUnlocked(state, c, ch) || !sceneReachable(before, ch, sceneId)) {
    return { state, outcome: { kind: "none", text: "", all: false } };
  }
  const rule = scene.links.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
  const all = (facts: string[]) => scene.facts.every((fact) => facts.includes(fact.id));
  if (!rule) {
    const [first, second] = scene.docs[0].items.some((item) => item.id === a) ? [a, b] : [b, a];
    const text = scene.misses[`${first}|${second}`] ?? scene.misses[`${first}|*`] ?? "두 항목은 서로 말해 주는 것이 없다.";
    return { state, outcome: { kind: "none", text, all: all(before.facts) } };
  }
  const fact = scene.facts.find((f) => f.id === rule.fact)!;
  if (before.facts.includes(fact.id)) return { state, outcome: { kind: "known", fact, text: "이미 확정해 둔 사실이다.", all: all(before.facts) } };
  const facts = [...before.facts, fact.id];
  return {
    state: withChapter(state, c, ch, (p) => ({ ...p, facts })),
    outcome: { kind: "fact", fact, text: fact.text, all: all(facts) },
  };
}

/* ───────── 비교 (compare) ───────── */

/** 수사 노트와 저장에 쓰는, 달라진 곳의 이름 */
export const differenceKey = (frameId: string, fieldId: string): string => `${frameId}.${fieldId}`;

/** 두 판의 값이 다른 곳 전부. 값으로 판정한다. */
export function differencesOf(scene: CompareScene): { key: string; frame: string; field: CompareField }[] {
  return scene.frames.flatMap((frame) => frame.fields.filter((field) => field.a !== field.b).map((field) => ({ key: differenceKey(frame.id, field.id), frame: frame.id, field })));
}

export interface CompareOutcome {
  /** found 달라진 곳을 새로 찾음 · known 이미 찾은 곳 · same 두 판이 같은 곳 · none 받지 않음 */
  kind: "found" | "known" | "same" | "none";
  text: string;
  /** 지금까지 찾은 수와 찾아야 하는 수 */
  found: number;
  total: number;
  granted: string[];
}

/** "여기가 달라졌다"고 짚는다. 두 판의 값이 같으면 틀린 것이다. 달라진 곳을 모두 찾으면 증거를 얻는다. */
export function markDifference(state: GameState, c: StoryCase, ch: StoryChapter, sceneId: string, frameId: string, fieldId: string): { state: GameState; outcome: CompareOutcome } {
  const scene = sceneOf(ch, sceneId);
  const before = getChapter(state, c, ch);
  const none = { state, outcome: { kind: "none" as const, text: "", found: 0, total: 0, granted: [] } };
  if (!scene || scene.kind !== "compare" || !chapterUnlocked(state, c, ch) || !sceneReachable(before, ch, sceneId)) return none;
  const field = scene.frames.find((frame) => frame.id === frameId)?.fields.find((x) => x.id === fieldId);
  if (!field) return none;

  const all = differencesOf(scene);
  const count = (notes: readonly string[]) => all.filter((d) => notes.includes(d.key)).length;
  const key = differenceKey(frameId, fieldId);
  if (field.a === field.b) {
    // 끝낸 장면을 다시 볼 때는 틀린 횟수를 늘리지 않는다
    const next = sceneDone(before, scene) ? state : withChapter(state, c, ch, (p) => ({ ...p, wrong: p.wrong + 1 }));
    return { state: next, outcome: { kind: "same", text: field.same, found: count(before.notes), total: all.length, granted: [] } };
  }
  if (before.notes.includes(key)) return { state, outcome: { kind: "known", text: field.found, found: count(before.notes), total: all.length, granted: [] } };

  const notes = [...before.notes, key];
  const complete = count(notes) === all.length;
  const granted = complete ? scene.grants.filter((id) => !before.evidence.includes(id)) : [];
  const next = withChapter(state, c, ch, (p) => {
    const noted = { ...p, notes };
    return complete ? finishScene(noted, scene, scene.grants) : noted;
  });
  return { state: next, outcome: { kind: "found", text: field.found, found: count(notes), total: all.length, granted } };
}

/* ───────── 순서 (order) ───────── */

/** 지금 놓여 있는 순서. 아직 손대지 않았으면 카드가 적힌 순서다. */
export function orderOf(p: ChapterProgress, scene: OrderScene): string[] {
  const ids = scene.cards.map((card) => card.id);
  const saved = p.placed[scene.id];
  return saved && saved.length === ids.length && ids.every((id) => saved.includes(id)) ? saved : ids;
}

const wellFormedOrder = (scene: OrderScene, order: readonly string[]): boolean =>
  order.length === scene.cards.length && new Set(order).size === order.length && order.every((id) => scene.cards.some((card) => card.id === id));

/** 카드를 옮겨 놓은 순서를 적어 둔다(채점하지 않는다). 나갔다 와도 그 순서에서 잇는다. */
export function arrangeOrder(state: GameState, c: StoryCase, ch: StoryChapter, sceneId: string, order: readonly string[]): GameState {
  const scene = sceneOf(ch, sceneId);
  const before = getChapter(state, c, ch);
  if (!scene || scene.kind !== "order" || !chapterUnlocked(state, c, ch) || !sceneReachable(before, ch, sceneId)) return state;
  if (!wellFormedOrder(scene, order) || sceneDone(before, scene)) return state;
  return withChapter(state, c, ch, (p) => ({ ...p, placed: { ...p.placed, [sceneId]: [...order] } }));
}

export interface OrderOutcome {
  correct: boolean;
  /** 틀렸으면 어느 기록과 어긋나는지 (맞는 순서는 말하지 않는다) */
  reason: string;
  granted: string[];
}

/** 놓은 순서를 낸다. 틀리면 어긋나는 까닭 하나를 듣고 다시 놓는다. */
export function submitOrder(state: GameState, c: StoryCase, ch: StoryChapter, sceneId: string, order: readonly string[]): { state: GameState; outcome: OrderOutcome } {
  const scene = sceneOf(ch, sceneId);
  const before = getChapter(state, c, ch);
  const logic = hasLogic(chapterKey(c, ch)) ? logicOf(chapterKey(c, ch)) : null;
  if (!scene || scene.kind !== "order" || !logic?.judgeOrder || !chapterUnlocked(state, c, ch) || !sceneReachable(before, ch, sceneId)) {
    return { state, outcome: { correct: false, reason: "", granted: [] } };
  }
  if (!wellFormedOrder(scene, order)) return { state, outcome: { correct: false, reason: "카드를 모두 한 번씩 놓으세요.", granted: [] } };
  const verdict = logic.judgeOrder(sceneId, order);
  if (sceneDone(before, scene)) return { state, outcome: { ...verdict, granted: [] } };
  if (!verdict.correct) {
    const next = withChapter(state, c, ch, (p) => ({ ...p, placed: { ...p.placed, [sceneId]: [...order] }, wrong: p.wrong + 1 }));
    return { state: next, outcome: { ...verdict, granted: [] } };
  }
  const granted = scene.grants.filter((id) => !before.evidence.includes(id));
  const next = withChapter(state, c, ch, (p) => finishScene({ ...p, placed: { ...p.placed, [sceneId]: [...order] } }, scene, scene.grants));
  return { state: next, outcome: { ...verdict, granted } };
}

/* ───────── 진술 대조 (testimony) ───────── */

export interface ConfrontOutcome {
  /** contradiction 어긋남을 새로 찾음 · known 이미 찾은 어긋남 · supports 기록이 진술을 받침 · nothing 말해 주는 것이 없음 */
  kind: "contradiction" | "known" | "supports" | "nothing";
  text: string;
  /** 어긋남이 드러난 뒤에 고쳐 하는 말 */
  retort: string | null;
  found: number;
  goal: number;
  granted: string[];
}

/**
 * 진술 하나와 기록 하나를 맞대어 본다. 조사다(채점하지 않는다): 어긋나면 그 진술이 깨지고,
 * 기록이 진술을 받치면 그렇다고 적히고, 아무것도 아니면 까닭을 듣는다. 어긋나는 진술을 모두 찾으면 장면이 끝난다.
 */
export function confront(state: GameState, c: StoryCase, ch: StoryChapter, sceneId: string, statementId: string, recordId: string): { state: GameState; outcome: ConfrontOutcome } {
  const scene = sceneOf(ch, sceneId);
  const before = getChapter(state, c, ch);
  const logic = hasLogic(chapterKey(c, ch)) ? logicOf(chapterKey(c, ch)) : null;
  const none = { state, outcome: { kind: "nothing" as const, text: "", retort: null, found: 0, goal: 0, granted: [] } };
  if (!scene || scene.kind !== "testimony" || !logic?.judgeConfront || !chapterUnlocked(state, c, ch) || !sceneReachable(before, ch, sceneId)) return none;
  const statement = scene.statements.find((s) => s.id === statementId);
  if (!statement || !scene.records.some((r) => r.id === recordId)) return none;

  const mine = (ids: readonly string[]) => scene.statements.filter((s) => ids.includes(s.id)).length;
  const base = { retort: null, found: mine(before.exposed), goal: scene.goal, granted: [] as string[] };
  const verdict = logic.judgeConfront(sceneId, statementId, recordId);
  if (verdict.kind === "nothing") {
    const text = scene.misses[`${statementId}|${recordId}`] ?? scene.misses[`${statementId}|*`] ?? scene.misses[`*|${recordId}`] ?? "이 기록은 이 진술과 어긋나지도, 이 진술을 받치지도 않는다.";
    return { state, outcome: { ...base, kind: "nothing", text } };
  }
  if (verdict.kind === "supports") {
    const next = before.verified.includes(statementId) ? state : withChapter(state, c, ch, (p) => ({ ...p, verified: [...p.verified, statementId] }));
    return { state: next, outcome: { ...base, kind: "supports", text: verdict.text } };
  }
  const retort = statement.retort ?? null;
  if (before.exposed.includes(statementId)) return { state, outcome: { ...base, kind: "known", text: verdict.text, retort } };

  const exposed = [...before.exposed, statementId];
  const complete = mine(exposed) >= scene.goal;
  const granted = complete ? scene.grants.filter((id) => !before.evidence.includes(id)) : [];
  const next = withChapter(state, c, ch, (p) => {
    const noted = { ...p, exposed };
    return complete ? finishScene(noted, scene, scene.grants) : noted;
  });
  return { state: next, outcome: { kind: "contradiction", text: verdict.text, retort, found: mine(exposed), goal: scene.goal, granted } };
}

/* ───────── 배정 (assign) ───────── */

/** 한 줄에 넣을 것을 고른다(채점하지 않는다). optionId 가 null 이면 비운다. */
export function setAssign(state: GameState, c: StoryCase, ch: StoryChapter, sceneId: string, rowId: string, optionId: string | null): GameState {
  const scene = sceneOf(ch, sceneId);
  const before = getChapter(state, c, ch);
  if (!scene || scene.kind !== "assign" || !chapterUnlocked(state, c, ch) || !sceneReachable(before, ch, sceneId)) return state;
  if (!scene.rows.some((row) => row.id === rowId) || sceneDone(before, scene)) return state;
  if (optionId !== null && !scene.options.some((option) => option.id === optionId)) return state;
  const now = before.assigned[sceneId] ?? {};
  if ((now[rowId] ?? null) === optionId) return state;
  const row = { ...now };
  if (optionId === null) delete row[rowId];
  else row[rowId] = optionId;
  return withChapter(state, c, ch, (p) => ({ ...p, assigned: { ...p.assigned, [sceneId]: row } }));
}

export interface AssignOutcome {
  /** correct 모두 맞음 · wrong 기록과 어긋나는 줄이 있음 · incomplete 비어 있는 줄이 있음 */
  verdict: "correct" | "wrong" | "incomplete";
  /** 기록과 어긋나는 줄 */
  rows: string[];
  /** 어긋나는 첫 줄의 까닭 (누가 맞는지는 말하지 않는다) */
  reason: string;
  granted: string[];
}

/** 넣어 둔 것을 낸다. 줄마다 기록으로 확정되는 사람과 같아야 한다. */
export function submitAssign(state: GameState, c: StoryCase, ch: StoryChapter, sceneId: string): { state: GameState; outcome: AssignOutcome } {
  const scene = sceneOf(ch, sceneId);
  const before = getChapter(state, c, ch);
  const logic = hasLogic(chapterKey(c, ch)) ? logicOf(chapterKey(c, ch)) : null;
  if (!scene || scene.kind !== "assign" || !logic?.judgeAssign || !chapterUnlocked(state, c, ch) || !sceneReachable(before, ch, sceneId)) {
    return { state, outcome: { verdict: "incomplete", rows: [], reason: "", granted: [] } };
  }
  const assigned = before.assigned[sceneId] ?? {};
  const empty = scene.rows.filter((row) => !assigned[row.id]).map((row) => row.id);
  if (empty.length > 0) return { state, outcome: { verdict: "incomplete", rows: empty, reason: "모든 줄에 사람을 넣으세요.", granted: [] } };
  const verdict = logic.judgeAssign(sceneId, assigned, before);
  if (sceneDone(before, scene)) return { state, outcome: { verdict: verdict.correct ? "correct" : "wrong", rows: verdict.wrong, reason: verdict.reason, granted: [] } };
  if (!verdict.correct) {
    return { state: withChapter(state, c, ch, (p) => ({ ...p, wrong: p.wrong + 1 })), outcome: { verdict: "wrong", rows: verdict.wrong, reason: verdict.reason, granted: [] } };
  }
  const granted = scene.grants.filter((id) => !before.evidence.includes(id));
  return { state: withChapter(state, c, ch, (p) => finishScene(p, scene, scene.grants)), outcome: { verdict: "correct", rows: [], reason: "", granted } };
}

/** 그 장면에 지금 넣어 둔 것 */
export function assignedOf(p: ChapterProgress, scene: AssignScene): Record<string, string> {
  return p.assigned[scene.id] ?? {};
}

/* ───────── 최종 추론 (deduce) ───────── */

export interface DeduceOutcome {
  /** correct 맞음 · weak 결론은 맞지만 근거가 받치지 못함 · unsupported 그 결론은 확정할 수 없음 · incomplete 고르지 않은 것이 있음 */
  verdict: "correct" | "weak" | "unsupported" | "incomplete";
  text: string;
  /** 이번 제출로 받은 장의 보상 */
  reward: number;
  /** 이번 제출로 사건을 처음 끝까지 해결했을 때만: 사건 해결 보상 */
  caseReward?: number;
}

const incompleteText = (scene: DeduceScene): string =>
  (scene.need ?? 1) === 1 ? "결론 하나와 그 근거가 되는 증거 하나를 고르세요." : `결론 하나와 그 근거가 되는 증거 ${["", "하나", "둘", "셋"][scene.need ?? 1] ?? `${scene.need}개`}을 고르세요.`;

/**
 * 결론과 근거를 함께 낸다. 근거는 장면이 정한 수만큼(need) 낸다: 하나면 글자 하나, 여럿이면 목록.
 * 맞으면 장이 해결되고, 처음 해결했을 때만 보상을 받는다. 사건의 마지막 장이 처음 해결되면 사건 해결 보상도 함께 받는다.
 */
export function submitDeduction(
  state: GameState,
  c: StoryCase,
  ch: StoryChapter,
  sceneId: string,
  choice: string | null,
  basis: string | readonly string[] | null,
  now: Date,
): { state: GameState; outcome: DeduceOutcome } {
  const scene = sceneOf(ch, sceneId);
  const before = getChapter(state, c, ch);
  if (!scene || scene.kind !== "deduce" || !chapterUnlocked(state, c, ch) || !sceneReachable(before, ch, sceneId)) {
    return { state, outcome: { verdict: "incomplete", text: "", reward: 0 } };
  }
  const bases = basis === null ? [] : typeof basis === "string" ? [basis] : [...basis];
  const need = scene.need ?? 1;
  if (!choice || !scene.choices.some((x) => x.id === choice) || bases.length !== need || new Set(bases).size !== bases.length || !bases.every((id) => scene.basis.includes(id))) {
    return { state, outcome: { verdict: "incomplete", text: incompleteText(scene), reward: 0 } };
  }
  const verdict = logicOf(chapterKey(c, ch)).judgeDeduction(choice, need === 1 ? bases[0] : bases, before);
  const picked = { choice, basis: bases[0], bases };

  if (verdict !== "correct") {
    const lacking = bases.find((id) => scene.weak[id]);
    const text =
      verdict === "weak"
        ? ((lacking && scene.weak[lacking]) ?? "결론은 가진 기록과 어긋나지 않지만, 이 증거는 그 결론을 받치지 못합니다. 다른 증거를 근거로 드세요.")
        : scene.choices.find((x) => x.id === choice)!.unsupported;
    // 이미 해결한 장을 다시 볼 때는 기록을 건드리지 않는다
    const next = before.status === "cleared" ? state : withChapter(state, c, ch, (p) => ({ ...p, deduction: picked, wrong: p.wrong + 1 }));
    return { state: next, outcome: { verdict, text, reward: 0 } };
  }

  if (before.status === "cleared") return { state, outcome: { verdict, text: "", reward: 0 } };
  const reward = before.rewardClaimed ? 0 : ch.reward;
  const ending = ch.ending.evidence;
  let next = withChapter({ ...state, credits: state.credits + reward }, c, ch, (p) => ({
    ...p,
    status: "cleared",
    deduction: picked,
    rewardClaimed: true,
    // 다시 풀어 끝냈을 때는 처음 해결한 때를 그대로 둔다
    clearedAt: p.clearedAt ?? now.toISOString(),
    archive: null,
    evidence: p.evidence.includes(ending) ? p.evidence : [...p.evidence, ending],
    scene: "ending",
    visited: p.visited.includes("ending") ? p.visited : [...p.visited, "ending"],
  }));

  // 사건의 모든 장이 해결됐으면 사건 해결 보상을 한 번 준다
  let caseReward = 0;
  const solved = c.chapters.every((x) => chapterCleared(getChapter(next, c, x)));
  if (solved && !next.story.cases?.[c.id]?.rewardClaimed) {
    caseReward = c.reward ?? 0;
    const record: CaseProgress = { solvedAt: next.story.cases?.[c.id]?.solvedAt ?? now.toISOString(), rewardClaimed: true };
    next = { ...next, credits: next.credits + caseReward, story: { ...next.story, cases: { ...next.story.cases, [c.id]: record } } };
  }
  return { state: next, outcome: caseReward > 0 ? { verdict, text: "", reward, caseReward } : { verdict, text: "", reward } };
}

/** 장의 끝 장면을 다 봤다: 다음에 들어오면 사건 기록이 열린다 */
export function finishEnding(state: GameState, c: StoryCase, ch: StoryChapter): GameState {
  return withChapter(state, c, ch, (p) => (p.status !== "cleared" || (p.endingSeen && p.scene === "record") ? p : { ...p, endingSeen: true, scene: "record" }));
}

/* ───────── 다시 풀기 ───────── */

const runOf = (p: ChapterRun): ChapterRun => ({
  visited: p.visited,
  notes: p.notes,
  evidence: p.evidence,
  picked: p.picked,
  facts: p.facts,
  deduction: p.deduction,
  placed: p.placed,
  assigned: p.assigned,
  exposed: p.exposed,
  verified: p.verified,
  solved: p.solved,
  wrong: p.wrong,
});

/**
 * 해결한 장을 처음 장면부터 다시 푼다. 처음 해결했을 때의 기록은 따로 보관되어 사건 기록에서 계속 읽을 수 있고,
 * 보상은 다시 받지 않는다. 이미 본 도입은 다시 나오지 않고, 열어 둔 수사 지원은 열린 채다.
 * 다음 장은 그대로 열려 있다(다시 푸는 중에도 그 장은 해결한 장이다).
 */
export function restartChapter(state: GameState, c: StoryCase, ch: StoryChapter): GameState {
  if (!chapterUnlocked(state, c, ch)) return state;
  return withChapter(state, c, ch, (p) => {
    if (p.status !== "cleared") return p;
    const first = ch.scenes[0].id;
    return { ...p, ...emptyRun(), archive: runOf(p), status: "in_progress", scene: first, visited: [first], evidence: [...(ch.given ?? [])] };
  });
}

/** 다시 풀던 것을 그만두고 처음 해결했을 때의 기록으로 돌아간다 */
export function cancelReplay(state: GameState, c: StoryCase, ch: StoryChapter): GameState {
  return withChapter(state, c, ch, (p) => (p.archive ? { ...p, ...p.archive, archive: null, status: "cleared", scene: "record" } : p));
}

/* ───────── 수사 지원 ───────── */

/** 그 장면에서 쓰는 수사 지원의 글과 연 단계 수. 장면에 따로 없으면 장 전체의 것이다. */
export function hintsFor(p: ChapterProgress, ch: StoryChapter, sceneId?: string | null): { texts: string[]; used: number; perScene: boolean } {
  const own = sceneId ? sceneOf(ch, sceneId)?.hints : undefined;
  if (own) return { texts: own.map((hint) => hint.text), used: Math.min(own.length, p.sceneHints[sceneId!] ?? 0), perScene: true };
  return { texts: ch.hints, used: Math.min(ch.hints.length, p.hintsUsed), perScene: false };
}

export type StoryHintOutcome =
  | { kind: "opened"; tier: number; cost: number }
  | { kind: "insufficient"; tier: number; cost: number; shortBy: number }
  | { kind: "exhausted" };

/**
 * 수사 지원: 문제의 힌트와 같은 값으로 연다. 크레딧이 모자라면 열리지 않는다(그래도 사건은 풀 수 있다).
 * sceneId 를 주면 그 장면의 수사 지원을(장면에 따로 있을 때), 주지 않으면 장 전체의 것을 연다.
 */
export function requestStoryHint(state: GameState, c: StoryCase, ch: StoryChapter, sceneId?: string | null): { state: GameState; outcome: StoryHintOutcome } {
  const before = getChapter(state, c, ch);
  const { texts, used: tier, perScene } = hintsFor(before, ch, sceneId);
  const cost = hintCost(tier);
  if (!chapterUnlocked(state, c, ch) || cost === null || tier >= texts.length) return { state, outcome: { kind: "exhausted" } };
  const paid = spend(state.credits, cost);
  if (!paid.ok) return { state, outcome: { kind: "insufficient", tier, cost, shortBy: cost - state.credits } };
  const next = withChapter({ ...state, credits: paid.credits }, c, ch, (p) => ({
    ...p,
    ...(perScene ? { sceneHints: { ...p.sceneHints, [sceneId!]: tier + 1 } } : { hintsUsed: tier + 1 }),
    status: p.status === "new" ? "in_progress" : p.status,
  }));
  return { state: next, outcome: { kind: "opened", tier, cost } };
}

/* ───────── 저장 데이터 복원 ───────── */

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : []);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);

/** 저장된 풀이 기록 하나를 지금의 장 자료에 맞춰 읽는다. 없는 증거·사실·장면은 버린다. */
function hydrateRun(raw: unknown, ch: StoryChapter): ChapterRun {
  const data = record(raw);
  const scenes = <K extends StoryScene["kind"]>(kind: K) => ch.scenes.filter((s): s is Extract<StoryScene, { kind: K }> => s.kind === kind);
  const evidenceIds = new Set(ch.evidence.map((e) => e.id));
  const noteIds = new Set([...scenes("timeline").flatMap((s) => s.points.map((point) => point.id)), ...scenes("compare").flatMap((s) => differencesOf(s).map((d) => d.key))]);
  const factIds = new Set(scenes("link").flatMap((s) => s.facts.map((f) => f.id)));
  const statementIds = new Set(scenes("testimony").flatMap((s) => s.statements.map((x) => x.id)));
  const places = new Set(["intro", "ending", "record", ...ch.scenes.map((s) => s.id)]);
  const deduce = scenes("deduce")[0];
  const deduction = record(data.deduction);
  const choice = typeof deduction.choice === "string" ? deduction.choice : null;
  // 근거가 하나뿐이던 때의 저장에는 bases 가 없다
  const bases = Array.isArray(deduction.bases) ? strings(deduction.bases) : typeof deduction.basis === "string" ? [deduction.basis] : [];

  const placed: Record<string, string[]> = {};
  for (const scene of scenes("order")) {
    const order = strings(record(data.placed)[scene.id]);
    if (wellFormedOrder(scene, order)) placed[scene.id] = order;
  }
  const assigned: Record<string, Record<string, string>> = {};
  for (const scene of scenes("assign")) {
    const saved = record(record(data.assigned)[scene.id]);
    const rows = Object.entries(saved).filter(
      (entry): entry is [string, string] => scene.rows.some((row) => row.id === entry[0]) && typeof entry[1] === "string" && scene.options.some((option) => option.id === entry[1]),
    );
    if (rows.length > 0) assigned[scene.id] = Object.fromEntries(rows);
  }
  const solvable = new Set(ch.scenes.filter((s) => s.kind === "compare" || s.kind === "order" || s.kind === "testimony" || s.kind === "assign").map((s) => s.id));

  return {
    visited: strings(data.visited).filter((id) => places.has(id)),
    notes: strings(data.notes).filter((id) => noteIds.has(id)),
    evidence: strings(data.evidence).filter((id) => evidenceIds.has(id)),
    picked: Object.fromEntries(
      Object.entries(record(data.picked)).filter(([scene, value]) => ch.scenes.some((s) => s.id === scene && s.kind === "records") && typeof value === "string"),
    ) as Record<string, string>,
    facts: strings(data.facts).filter((id) => factIds.has(id)),
    deduction: {
      choice: choice && (!deduce || deduce.choices.some((x) => x.id === choice)) ? choice : null,
      basis: bases[0] ?? null,
      bases,
    },
    placed,
    assigned,
    exposed: strings(data.exposed).filter((id) => statementIds.has(id)),
    verified: strings(data.verified).filter((id) => statementIds.has(id)),
    solved: strings(data.solved).filter((id) => solvable.has(id)),
    wrong: count(data.wrong),
  };
}

/**
 * 저장소에서 읽은 스토리 진행을 지금의 사건 자료에 맞춰 보정한다. 없는 사건·장·증거는 버린다.
 * 스토리가 없던 때의 저장, 제1장만 있던 때의 저장(새 칸이 없다)도 그대로 읽는다.
 */
export function hydrateStory(raw: unknown, cases: StoryCase[]): StoryState {
  const out = emptyStory();
  const saved = record(record(raw).chapters);
  for (const c of cases)
    for (const ch of c.chapters) {
      const key = chapterKey(c, ch);
      const value = saved[key];
      if (!value || typeof value !== "object") continue;
      const data = value as Record<string, unknown>;
      const cleared = data.status === "cleared";
      // 다시 풀던 중의 저장: 처음 해결했을 때의 기록이 따로 들어 있다
      const archive = !cleared && data.archive && typeof data.archive === "object" ? hydrateRun(data.archive, ch) : null;
      const hints = record(data.sceneHints);
      const p: ChapterProgress = {
        ...emptyChapter(),
        ...hydrateRun(data, ch),
        status: cleared ? "cleared" : data.status === "in_progress" || archive ? "in_progress" : "new",
        introSeen: data.introSeen === true,
        hintsUsed: Math.min(ch.hints.length, count(data.hintsUsed)),
        sceneHints: Object.fromEntries(
          ch.scenes.filter((s) => s.hints && count(hints[s.id]) > 0).map((s) => [s.id, Math.min(s.hints!.length, count(hints[s.id]))]),
        ),
        rewardClaimed: data.rewardClaimed === true || cleared || archive !== null,
        endingSeen: data.endingSeen === true,
        clearedAt: typeof data.clearedAt === "string" ? data.clearedAt : null,
        archive,
      };
      // 있던 곳이 지금 들어갈 수 없는 곳이면(자료가 바뀌었거나 값이 깨졌으면) 들어갈 수 있는 가장 앞선 곳으로 돌린다
      const places = new Set(["intro", "ending", "record", ...ch.scenes.map((s) => s.id)]);
      const wanted = typeof data.scene === "string" && places.has(data.scene) ? data.scene : "intro";
      p.scene = sceneReachable(p, ch, wanted) ? wanted : p.introSeen ? ch.scenes[0].id : "intro";
      out.chapters[key] = p;
    }

  // 사건 해결 기록: 그 사건의 장이 모두 해결돼 있을 때만 받아들인다
  const savedCases = record(record(raw).cases);
  for (const c of cases) {
    const data = record(savedCases[c.id]);
    const solved = c.chapters.length > 0 && c.chapters.every((ch) => out.chapters[chapterKey(c, ch)] && chapterCleared(out.chapters[chapterKey(c, ch)]));
    if (!solved || Object.keys(data).length === 0) continue;
    out.cases = { ...out.cases, [c.id]: { solvedAt: typeof data.solvedAt === "string" ? data.solvedAt : null, rewardClaimed: data.rewardClaimed === true } };
  }
  return out;
}
