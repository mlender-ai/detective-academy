/**
 * 스토리 진행 엔진. GameState 를 받아 새 GameState 를 돌려주는 순수 함수들이다(저장과 화면을 모른다).
 * 장면은 차례로 열린다: 앞 장면에서 얻어야 할 것(증거, 맞는 기록, 확정한 사실)을 얻어야 다음 장면에 들어갈 수 있다.
 * 장을 해결한 뒤에는 모든 장면을 다시 볼 수 있고, 보상은 처음 한 번만 받는다.
 */
import { rankIndex } from "../../data/ranks";
import { hintCost, spend } from "../../engine/creditEngine";
import type { GameState } from "../../engine/types";
import { chapterKey, logicOf } from "../cases";
import type { ChapterProgress, StoryCase, StoryChapter, StoryFact, StoryScene, StoryState } from "./storyTypes";

export function emptyStory(): StoryState {
  return { chapters: {} };
}

export function emptyChapter(): ChapterProgress {
  return {
    status: "new",
    scene: "intro",
    introSeen: false,
    visited: [],
    notes: [],
    evidence: [],
    picked: {},
    facts: [],
    deduction: { choice: null, basis: null },
    wrong: 0,
    hintsUsed: 0,
    rewardClaimed: false,
    endingSeen: false,
    clearedAt: null,
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

/** 이 사건을 맡을 수 있는 등급인가 */
export function storyUnlocked(state: GameState, c: StoryCase): boolean {
  return state.enrolled && rankIndex(state.rank) >= rankIndex(c.rank);
}

/** 사건이 지금 어떤 상태인가 (홈의 사건 접수함이 이것을 비춘다) */
export function caseStatus(state: GameState, c: StoryCase): "locked" | "new" | "open" | "cleared" {
  if (!storyUnlocked(state, c)) return "locked";
  const all = c.chapters.map((ch) => getChapter(state, c, ch));
  if (all.every((p) => p.status === "cleared")) return "cleared";
  return all.some((p) => p.status !== "new") ? "open" : "new";
}

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
  }
}

/** 그 곳("intro", 장면 id, "ending", "record")에 지금 들어갈 수 있는가 */
export function sceneReachable(p: ChapterProgress, ch: StoryChapter, id: string): boolean {
  if (id === "intro") return true;
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
  if (!storyUnlocked(state, c)) return state;
  return withChapter(state, c, ch, (p) => {
    if (!sceneReachable(p, ch, id)) return p;
    const visited = p.visited.includes(id) ? p.visited : [...p.visited, id];
    if (p.scene === id && visited === p.visited) return p;
    return { ...p, scene: id, visited, status: p.status === "new" ? "in_progress" : p.status };
  });
}

/** 도입을 다 봤다(또는 건너뛰었다): 첫 장면으로 */
export function seeIntro(state: GameState, c: StoryCase, ch: StoryChapter): GameState {
  if (!storyUnlocked(state, c)) return state;
  const seen = withChapter(state, c, ch, (p) => (p.introSeen ? p : { ...p, introSeen: true, status: p.status === "new" ? "in_progress" : p.status }));
  return goScene(seen, c, ch, ch.scenes[0].id);
}

/* ───────── 조사 ───────── */

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
  if (!scene || scene.kind !== "timeline" || !storyUnlocked(state, c)) return none;
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
  if (!scene || scene.kind !== "records" || !storyUnlocked(state, c) || !sceneReachable(before, ch, sceneId)) {
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

export type LinkOutcome =
  | { kind: "fact"; fact: StoryFact; text: string; all: boolean }
  | { kind: "known"; fact: StoryFact; text: string; all: boolean }
  | { kind: "none"; text: string; all: boolean };

/** 두 문서의 항목을 잇는다. 이어서 나오는 사실이 있으면 확정하고, 없으면 까닭을 돌려준다(채점하지 않는다). */
export function linkItems(state: GameState, c: StoryCase, ch: StoryChapter, sceneId: string, a: string, b: string): { state: GameState; outcome: LinkOutcome } {
  const scene = sceneOf(ch, sceneId);
  const before = getChapter(state, c, ch);
  if (!scene || scene.kind !== "link" || !storyUnlocked(state, c) || !sceneReachable(before, ch, sceneId)) {
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

export interface DeduceOutcome {
  /** correct 맞음 · weak 결론은 맞지만 근거가 받치지 못함 · unsupported 그 결론은 확정할 수 없음 · incomplete 고르지 않은 것이 있음 */
  verdict: "correct" | "weak" | "unsupported" | "incomplete";
  text: string;
  /** 이번 제출로 받은 크레딧 */
  reward: number;
}

/** 결론과 근거를 함께 낸다. 맞으면 장이 해결되고, 처음 해결했을 때만 보상을 받는다. */
export function submitDeduction(
  state: GameState,
  c: StoryCase,
  ch: StoryChapter,
  sceneId: string,
  choice: string | null,
  basis: string | null,
  now: Date,
): { state: GameState; outcome: DeduceOutcome } {
  const scene = sceneOf(ch, sceneId);
  const before = getChapter(state, c, ch);
  if (!scene || scene.kind !== "deduce" || !storyUnlocked(state, c) || !sceneReachable(before, ch, sceneId)) {
    return { state, outcome: { verdict: "incomplete", text: "", reward: 0 } };
  }
  if (!choice || !basis || !scene.choices.some((x) => x.id === choice) || !scene.basis.includes(basis)) {
    return { state, outcome: { verdict: "incomplete", text: "결론 하나와 그 근거가 되는 증거 하나를 고르세요.", reward: 0 } };
  }
  const verdict = logicOf(chapterKey(c, ch)).judgeDeduction(choice, basis, before);
  const picked = { choice, basis };

  if (verdict !== "correct") {
    const text =
      verdict === "weak"
        ? (scene.weak[basis] ?? "결론은 가진 기록과 어긋나지 않지만, 이 증거는 그 결론을 받치지 못합니다. 다른 증거를 근거로 드세요.")
        : scene.choices.find((x) => x.id === choice)!.unsupported;
    // 이미 해결한 장을 다시 풀 때는 기록을 건드리지 않는다
    const next = before.status === "cleared" ? state : withChapter(state, c, ch, (p) => ({ ...p, deduction: picked, wrong: p.wrong + 1 }));
    return { state: next, outcome: { verdict, text, reward: 0 } };
  }

  if (before.status === "cleared") return { state, outcome: { verdict, text: "", reward: 0 } };
  const reward = before.rewardClaimed ? 0 : ch.reward;
  const ending = ch.ending.evidence;
  const next = withChapter({ ...state, credits: state.credits + reward }, c, ch, (p) => ({
    ...p,
    status: "cleared",
    deduction: picked,
    rewardClaimed: true,
    clearedAt: now.toISOString(),
    evidence: p.evidence.includes(ending) ? p.evidence : [...p.evidence, ending],
    scene: "ending",
    visited: p.visited.includes("ending") ? p.visited : [...p.visited, "ending"],
  }));
  return { state: next, outcome: { verdict, text: "", reward } };
}

/** 장의 끝 장면을 다 봤다: 다음에 들어오면 사건 기록이 열린다 */
export function finishEnding(state: GameState, c: StoryCase, ch: StoryChapter): GameState {
  return withChapter(state, c, ch, (p) => (p.status !== "cleared" || (p.endingSeen && p.scene === "record") ? p : { ...p, endingSeen: true, scene: "record" }));
}

export type StoryHintOutcome =
  | { kind: "opened"; tier: number; cost: number }
  | { kind: "insufficient"; tier: number; cost: number; shortBy: number }
  | { kind: "exhausted" };

/** 수사 지원: 문제의 힌트와 같은 값으로 연다. 크레딧이 모자라면 열리지 않는다(그래도 사건은 풀 수 있다). */
export function requestStoryHint(state: GameState, c: StoryCase, ch: StoryChapter): { state: GameState; outcome: StoryHintOutcome } {
  const before = getChapter(state, c, ch);
  const tier = before.hintsUsed;
  const cost = hintCost(tier);
  if (!storyUnlocked(state, c) || cost === null || tier >= ch.hints.length) return { state, outcome: { kind: "exhausted" } };
  const paid = spend(state.credits, cost);
  if (!paid.ok) return { state, outcome: { kind: "insufficient", tier, cost, shortBy: cost - state.credits } };
  const next = withChapter({ ...state, credits: paid.credits }, c, ch, (p) => ({ ...p, hintsUsed: tier + 1, status: p.status === "new" ? "in_progress" : p.status }));
  return { state: next, outcome: { kind: "opened", tier, cost } };
}

/* ───────── 저장 데이터 복원 ───────── */

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : []);

/** 저장소에서 읽은 스토리 진행을 지금의 사건 자료에 맞춰 보정한다. 없는 사건·장·증거는 버린다. */
export function hydrateStory(raw: unknown, cases: StoryCase[]): StoryState {
  const out = emptyStory();
  const saved = raw && typeof raw === "object" ? (raw as Partial<StoryState>).chapters : null;
  if (!saved || typeof saved !== "object") return out;
  for (const c of cases)
    for (const ch of c.chapters) {
      const key = chapterKey(c, ch);
      const value = (saved as Record<string, unknown>)[key];
      if (!value || typeof value !== "object") continue;
      const data = value as Partial<ChapterProgress>;
      const base = emptyChapter();
      const evidenceIds = new Set(ch.evidence.map((e) => e.id));
      const pointIds = new Set(ch.scenes.flatMap((s) => (s.kind === "timeline" ? s.points.map((point) => point.id) : [])));
      const factIds = new Set(ch.scenes.flatMap((s) => (s.kind === "link" ? s.facts.map((f) => f.id) : [])));
      const places = new Set(["intro", "ending", "record", ...ch.scenes.map((s) => s.id)]);
      const cleared = data.status === "cleared";
      const p: ChapterProgress = {
        ...base,
        status: cleared ? "cleared" : data.status === "in_progress" ? "in_progress" : "new",
        introSeen: data.introSeen === true,
        visited: strings(data.visited).filter((id) => places.has(id)),
        notes: strings(data.notes).filter((id) => pointIds.has(id)),
        evidence: strings(data.evidence).filter((id) => evidenceIds.has(id)),
        picked: Object.fromEntries(
          Object.entries(data.picked && typeof data.picked === "object" ? data.picked : {}).filter(
            ([scene, record]) => ch.scenes.some((s) => s.id === scene && s.kind === "records") && typeof record === "string",
          ),
        ) as Record<string, string>,
        facts: strings(data.facts).filter((id) => factIds.has(id)),
        deduction: {
          choice: typeof data.deduction?.choice === "string" ? data.deduction.choice : null,
          basis: typeof data.deduction?.basis === "string" ? data.deduction.basis : null,
        },
        wrong: typeof data.wrong === "number" && Number.isFinite(data.wrong) ? Math.max(0, Math.floor(data.wrong)) : 0,
        hintsUsed: typeof data.hintsUsed === "number" && Number.isFinite(data.hintsUsed) ? Math.max(0, Math.min(ch.hints.length, Math.floor(data.hintsUsed))) : 0,
        rewardClaimed: data.rewardClaimed === true || cleared,
        endingSeen: data.endingSeen === true,
        clearedAt: typeof data.clearedAt === "string" ? data.clearedAt : null,
      };
      // 있던 곳이 지금 들어갈 수 없는 곳이면(자료가 바뀌었거나 값이 깨졌으면) 들어갈 수 있는 가장 앞선 곳으로 돌린다
      const wanted = typeof data.scene === "string" && places.has(data.scene) ? data.scene : "intro";
      p.scene = sceneReachable(p, ch, wanted) ? wanted : p.introSeen ? ch.scenes[0].id : "intro";
      out.chapters[key] = p;
    }
  return out;
}
