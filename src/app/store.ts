/**
 * 게임 상태 저장소. 엔진(순수 함수)을 호출하고 결과를 localStorage 에 보존한다.
 * 새로고침하거나 브라우저를 닫았다 열어도 해결 기록과 크레딧이 유지된다.
 */
import { useSyncExternalStore } from "react";
import {
  addElapsed,
  buildDemoState,
  DEMO_PRESETS,
  createInitialState,
  enroll,
  hydrate,
  markOpened,
  recordInput,
  rename,
  requestHint,
  submitAnswer,
  type DemoPreset,
  type HintOutcome,
  type SubmitOutcome,
} from "../engine/progressEngine";
import type { GameState, Puzzle, PuzzleInput } from "../engine/types";

/**
 * 저장 위치. 주소에 ?save=이름 이 있으면 그 이름의 별도 저장 칸을 쓴다.
 * 두 화풍을 한 화면에 나란히 띄워 비교할 때 서로의 진행 상태를 덮어쓰지 않게 하기 위한 것이다.
 */
function storageKey(): string {
  const base = "detective-academy:v1";
  if (typeof window === "undefined") return base;
  const slot = new URLSearchParams(window.location.search).get("save");
  return slot && /^[a-z0-9-]{1,16}$/i.test(slot) ? `${base}:${slot}` : base;
}

export const STORAGE_KEY = storageKey();

function read(): GameState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return hydrate(raw ? JSON.parse(raw) : null);
  } catch {
    return createInitialState();
  }
}

/**
 * 비교·QA 화면용 시작 상태. 주소가 ?demo=1&preset=이름 이고 이 저장 칸에 아직 진행이 없을 때만,
 * 입학 화면을 건너뛰고 그 상태에서 시작한다. &apply=1 을 붙이면 진행이 있어도 그 상태로 바꾼다
 * (나란히 보기에서 장면을 바로 열 때 쓴다). 일반 사용자 주소에는 영향을 주지 않는다.
 */
function start(): GameState {
  const saved = read();
  const params = new URLSearchParams(window.location.search);
  const wanted = params.get("preset");
  if (params.get("demo") !== "1" || !DEMO_PRESETS.some((preset) => preset.id === wanted)) return saved;
  if (saved.enrolled && params.get("apply") !== "1") return saved;
  const seeded = buildDemoState(wanted as DemoPreset);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  } catch {
    // 저장하지 못해도 이번 세션은 그 상태로 진행한다
  }
  return seeded;
}

let state: GameState = typeof window === "undefined" ? createInitialState() : start();
const listeners = new Set<() => void>();

function commit(next: GameState) {
  if (next === state) return;
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 공간을 쓸 수 없어도(사생활 보호 모드 등) 이번 세션은 계속 플레이할 수 있다.
  }
  listeners.forEach((listener) => listener());
}

function newDetectiveNo(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `DA-${n}`;
}

export const gameStore = {
  getState: () => state,

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  enroll(nickname: string) {
    commit(enroll(state, nickname, newDetectiveNo(), new Date()));
  },

  rename(nickname: string) {
    commit(rename(state, nickname));
  },

  recordInput(puzzleId: string, input: PuzzleInput) {
    commit(recordInput(state, puzzleId, input));
  },

  addElapsed(puzzleId: string, ms: number) {
    commit(addElapsed(state, puzzleId, ms));
  },

  markOpened(puzzleId: string) {
    commit(markOpened(state, puzzleId));
  },

  requestHint(puzzle: Puzzle): HintOutcome {
    const result = requestHint(state, puzzle);
    commit(result.state);
    return result.outcome;
  },

  submit(puzzle: Puzzle, answer: unknown): SubmitOutcome {
    const result = submitAnswer(state, puzzle, answer, new Date());
    commit(result.state);
    return result.outcome;
  },

  setSound(on: boolean) {
    commit({ ...state, settings: { ...state.settings, sound: on } });
  },

  applyPreset(preset: DemoPreset) {
    commit(buildDemoState(preset));
  },
};

// 다른 탭에서 진행한 내용을 따라간다.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    state = read();
    listeners.forEach((listener) => listener());
  });
}

export function useGame(): GameState {
  return useSyncExternalStore(gameStore.subscribe, gameStore.getState, gameStore.getState);
}
