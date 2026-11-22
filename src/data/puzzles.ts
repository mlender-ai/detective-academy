/**
 * 문제 등록부. 처음의 세 문제는 이 파일에, 일일 문제 일곱은 dailySet.ts 에, 연습실·승급 시험의 문제는 sets/ 에 있다.
 *
 * solution 은 개발·검증용이다. 화면에는 플레이어가 해결한 뒤에만 노출한다.
 * solution 이 맞는지는 src/tests 가 전수 탐색으로 확인한다.
 */
import type { CodePuzzle, Puzzle, RankId, SchedulePuzzle, TruthPuzzle } from "../engine/types";
import { daysBetween, isDateKey } from "../engine/time";
import { DAILY_SET } from "./dailySet";
import { daon, doyun, hana, harin, junho, minjae, sea, sera } from "./people";
import { RANKS } from "./ranks";
import { GROWTH_SET } from "./sets";

export const DAILY_CODE: CodePuzzle = {
  id: "daily-code-001",
  type: "code",
  category: "daily",
  title: "자료실 금고의 암호",
  typeLabel: "조건 추론 · 암호 해독",
  difficulty: 2,
  description:
    "자료실 금고는 1부터 9까지 서로 다른 숫자 3개로 잠겨 있습니다. 앞서 시도한 다섯 번의 기록을 단서로 암호를 찾아내세요.",
  rules: {
    length: 3,
    digits: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    clues: [
      { guess: [1, 9, 6], match: 1, inPlace: 1 },
      { guess: [5, 7, 9], match: 0, inPlace: 0 },
      { guess: [1, 6, 5], match: 1, inPlace: 0 },
      { guess: [6, 5, 2], match: 2, inPlace: 0 },
      { guess: [4, 6, 3], match: 2, inPlace: 1 },
    ],
  },
  hints: [
    {
      text: "일치하는 숫자가 하나도 없는 기록부터 보세요. 그 기록에 쓰인 숫자 세 개는 암호에서 완전히 지울 수 있습니다.",
      facts: [{ kind: "absent", digits: [5, 7, 9] }],
    },
    {
      text: "196과 165를 나란히 놓아 보세요. 9와 5를 지우면 두 기록 모두 1과 6 중 하나만 맞습니다. 그런데 1은 두 기록에서 같은 자리에 있습니다. 한쪽에서는 '위치 정확', 다른 쪽에서는 '위치 틀림'이 될 수 있는 숫자는 자리가 바뀐 숫자뿐입니다.",
      facts: [
        { kind: "absent", digits: [1, 5, 9] },
        { kind: "present", digit: 6 },
      ],
    },
  ],
  explanation: [
    {
      text: "579는 일치하는 숫자가 없으므로 5, 7, 9는 암호에 없습니다.",
      facts: [{ kind: "absent", digits: [5, 7, 9] }],
    },
    {
      text: "196과 165에서 맞는 숫자는 각각 1 또는 6 하나뿐입니다. 1은 두 기록에서 같은 첫째 자리인데 결과가 '위치 정확'과 '위치 틀림'으로 갈리므로 1은 암호에 없습니다. 맞는 숫자는 6이고, 196에 따라 셋째 자리입니다.",
      facts: [
        { kind: "absent", digits: [1] },
        { kind: "at", digit: 6, position: 2 },
      ],
    },
    {
      text: "652에서 5는 없으니 일치하는 두 숫자는 6과 2입니다. 2는 셋째 자리가 아니므로 첫째 또는 둘째 자리입니다.",
      facts: [
        { kind: "present", digit: 2 },
        { kind: "notAt", digit: 2, position: 2 },
      ],
    },
    {
      text: "463에서 6은 위치가 틀린 일치 숫자입니다. 나머지 하나는 위치까지 맞아야 하는데, 3이 맞으려면 셋째 자리여야 하지만 그 자리는 6입니다. 따라서 4가 첫째 자리이고 3은 암호에 없습니다.",
      facts: [
        { kind: "at", digit: 4, position: 0 },
        { kind: "absent", digits: [3] },
      ],
    },
    {
      text: "첫째 자리 4, 셋째 자리 6, 남은 둘째 자리에 2가 들어갑니다. 암호는 426입니다.",
      facts: [
        { kind: "at", digit: 4, position: 0 },
        { kind: "at", digit: 2, position: 1 },
        { kind: "at", digit: 6, position: 2 },
      ],
    },
  ],
  solution: [4, 2, 6],
  reward: 60,
  rank: "F",
  minutes: 4,
};

export const PRACTICE_TRUTH: TruthPuzzle = {
  id: "practice-truth-001",
  type: "truth",
  category: "practice",
  title: "사라진 시험 답안지",
  typeLabel: "진실·거짓 추리",
  difficulty: 2,
  description:
    "네 명의 학생 중 한 명이 시험 답안지를 숨겼습니다. 네\u00A0사람의 진술 가운데 정확히 하나만 참입니다. 답안지를 숨긴 사람은 누구일까요?",
  rules: {
    people: [hana, junho, sera, daon],
    statements: [
      { speaker: "hana", text: "준호가 숨겼다.", claim: { kind: "culpritIs", who: "junho" } },
      { speaker: "junho", text: "세라는 숨기지 않았다.", claim: { kind: "culpritIsNot", who: "sera" } },
      { speaker: "sera", text: "다온이나 하나가 숨겼다.", claim: { kind: "culpritAmong", who: ["daon", "hana"] } },
      { speaker: "daon", text: "하나는 숨기지 않았다.", claim: { kind: "culpritIsNot", who: "hana" } },
    ],
    trueCount: 1,
  },
  hints: [
    {
      text: "한 사람씩 범인이라고 가정해 보세요. 가정마다 네 진술의 참·거짓을 표시하고, 참이 정확히 하나인 경우만 남기면 됩니다.",
      facts: [],
    },
    {
      text: "하나의 진술이 참이라면 준호가 숨긴 것입니다. 그 경우 준호의 진술과 다온의 진술도 함께 참이 되어 '참은 하나뿐'이라는 조건이 깨집니다. 즉 하나의 진술은 거짓이고, 준호는 숨기지 않았습니다.",
      facts: [
        { kind: "statementIs", speaker: "hana", value: false },
        { kind: "culpritIsNot", who: "junho" },
        { kind: "trueCountIf", culprit: "junho", count: 3 },
      ],
    },
  ],
  explanation: [
    {
      text: "하나가 숨겼다면 준호와 세라의 진술이 참입니다. 참이 2개라 조건에 맞지 않습니다.",
      facts: [{ kind: "trueCountIf", culprit: "hana", count: 2 }],
    },
    {
      text: "준호가 숨겼다면 하나, 준호, 다온의 진술이 참입니다. 참이 3개라 맞지 않습니다.",
      facts: [{ kind: "trueCountIf", culprit: "junho", count: 3 }],
    },
    {
      text: "다온이 숨겼다면 준호, 세라, 다온의 진술이 참입니다. 참이 3개라 맞지 않습니다.",
      facts: [{ kind: "trueCountIf", culprit: "daon", count: 3 }],
    },
    {
      text: "세라가 숨겼다면 다온의 진술만 참입니다. 참이 정확히 1개인 경우는 이것뿐이므로 답안지를 숨긴 사람은 세라입니다.",
      facts: [
        { kind: "trueCountIf", culprit: "sera", count: 1 },
        { kind: "statementIs", speaker: "daon", value: true },
        { kind: "statementIs", speaker: "sera", value: false },
      ],
    },
  ],
  solution: "sera",
  reward: 30,
  rank: "F",
  minutes: 3,
};

export const EXAM_SCHEDULE: SchedulePuzzle = {
  id: "exam-schedule-f-d",
  type: "schedule",
  category: "exam",
  title: "발표 순서 재구성",
  typeLabel: "다중 조건 순서 추론",
  difficulty: 3,
  description:
    "학생 네 명이 오전 9시, 10시, 11시, 12시에 한 명씩 발표합니다. 네 조건을 모두 만족하는 발표 순서를 찾아 배치하세요.",
  rules: {
    people: [doyun, minjae, sea, harin],
    slots: [
      { label: "9시", ordinal: "첫 번째" },
      { label: "10시", ordinal: "두 번째" },
      { label: "11시", ordinal: "세 번째" },
      { label: "12시", ordinal: "네 번째" },
    ],
    constraints: [
      { kind: "before", a: "doyun", b: "minjae", text: "도윤은 민재보다 먼저 발표한다." },
      { kind: "notAtSlot", who: "sea", slot: 0, text: "세아는 첫 번째 순서가 아니다." },
      { kind: "immediatelyAfter", who: "harin", after: "sea", text: "하린은 세아의 바로 다음 순서에 발표한다." },
      { kind: "notAtSlot", who: "minjae", slot: 3, text: "민재는 마지막 순서가 아니다." },
    ],
  },
  hints: [
    {
      text: "조건 3부터 보세요. 세아와 하린은 항상 붙어 있는 한 묶음입니다. 이 묶음이 들어갈 수 있는 자리가 몇 군데인지 먼저 세어 보세요.",
      facts: [{ kind: "adjacent", first: "sea", second: "harin" }],
    },
    {
      text: "세아가 첫 번째가 아니므로 '세아 다음 하린' 묶음은 10시·11시 또는 11시·12시에만 들어갑니다. 경우마다 남은 두 자리에 도윤과 민재를 넣고 조건 1과 조건 4를 확인해 보세요.",
      facts: [
        { kind: "slotAmong", who: "sea", slots: [1, 2] },
        { kind: "slotAmong", who: "harin", slots: [2, 3] },
      ],
    },
  ],
  explanation: [
    {
      text: "조건 3에 따라 세아와 하린은 '세아 다음 하린'으로 연속한 두 자리를 차지합니다.",
      facts: [{ kind: "adjacent", first: "sea", second: "harin" }],
    },
    {
      text: "조건 2에 따라 세아는 첫 번째가 아니므로 이 묶음은 10시·11시 또는 11시·12시에 놓입니다.",
      facts: [{ kind: "slotAmong", who: "sea", slots: [1, 2] }],
    },
    {
      text: "묶음이 10시·11시라면 남는 자리는 9시와 12시입니다. 조건 1에 따라 도윤이 9시, 민재가 12시가 되는데, 민재가 마지막이 되어 조건 4에 어긋납니다.",
      facts: [{ kind: "slotNot", who: "sea", slot: 1 }],
    },
    {
      text: "묶음이 11시·12시라면 도윤이 9시, 민재가 10시로 모든 조건을 만족합니다. 발표 순서는 도윤, 민재, 세아, 하린입니다.",
      facts: [
        { kind: "slotIs", who: "doyun", slot: 0 },
        { kind: "slotIs", who: "minjae", slot: 1 },
        { kind: "slotIs", who: "sea", slot: 2 },
        { kind: "slotIs", who: "harin", slot: 3 },
      ],
    },
  ],
  solution: ["doyun", "minjae", "sea", "harin"],
  // 합격 보상은 시험 규칙(data/ranks.ts)이 준다
  reward: 0,
  rank: "F",
  minutes: 4,
};

/** 처음부터 있던 세 문제 (오늘의 추리 · 연습실 · F→D 승급 시험에 하나씩) */
export const PUZZLES: Puzzle[] = [DAILY_CODE, PRACTICE_TRUTH, EXAM_SCHEDULE];

/** 모든 문제. 저장된 진행은 이 안의 문제에 대해서만 읽고 쓴다. */
export const ALL_PUZZLES: Puzzle[] = [...PUZZLES, ...DAILY_SET, ...GROWTH_SET];

export const PUZZLE_BY_ID: Record<string, Puzzle> = Object.fromEntries(
  ALL_PUZZLES.map((p) => [p.id, p]),
);

/** 문제 데이터의 판. 문제의 규칙·정답이 바뀌면 올린다(저장된 풀이 중 입력값을 버릴지 판단하는 기준이 된다). */
export const CONTENT_VERSION = 2;

/* ───────── 오늘의 추리: 날짜별 배정 ─────────
 * 모든 사용자가 같은 날 같은 문제를 받는다(Asia/Seoul 날짜 기준). 서버가 없으므로 정해 둔 순서를 날짜로 센다.
 * 지금은 여덟 문제가 차례로 돈다. 아흐레째부터는 풀었던 문제가 다시 붙는다(해결로 표시된다).
 */
export const DAILY_CALENDAR = {
  /** 이 날 첫 문제가 붙는다 */
  start: "2026-11-22",
  order: [DAILY_CODE, ...DAILY_SET].map((p) => p.id),
} as const;

/** 그 날짜에 붙는 문제의 순번 (0부터). 시작일 이전의 날짜도 같은 주기로 센다. */
export function dailyIndex(dateKey: string): number {
  const length = DAILY_CALENDAR.order.length;
  const days = isDateKey(dateKey) ? daysBetween(DAILY_CALENDAR.start, dateKey) : 0;
  return ((days % length) + length) % length;
}

/**
 * 검수용 일차 전환. 주소가 ?demo=1&day=3 이면 오늘의 추리 자리에 일일 문제 3일차가 놓인다(1~7 은 dailySet 의 순서).
 * 일반 사용자 주소에는 영향을 주지 않는다. 날짜 자체를 바꿔 보려면 ?demo=1&date=2026-11-25 를 쓴다(app/clock.ts).
 */
function previewDay(): number | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("demo") !== "1") return null;
  const day = Number(params.get("day"));
  return Number.isInteger(day) && day >= 1 && day <= DAILY_SET.length ? day : null;
}

const PREVIEW_DAY = previewDay();

/** 그 날짜(Asia/Seoul, YYYY-MM-DD)의 오늘의 추리 */
export function getDailyPuzzle(dateKey: string): Puzzle {
  if (PREVIEW_DAY) return DAILY_SET[PREVIEW_DAY - 1];
  return PUZZLE_BY_ID[DAILY_CALENDAR.order[dailyIndex(dateKey)]];
}

/* ───────── 연습실 · 승급 시험 ───────── */

const rankOrder = (rank: RankId | undefined) => RANKS.findIndex((r) => r.id === (rank ?? "F"));

/** 연습실의 문제: 등급 순서대로 */
export const PRACTICE_PUZZLES: Puzzle[] = ALL_PUZZLES.filter((p) => p.category === "practice")
  .map((p, i) => ({ p, i }))
  .sort((a, b) => rankOrder(a.p.rank) - rankOrder(b.p.rank) || a.i - b.i)
  .map(({ p }) => p);

/** 그 등급의 서랍에 든 연습 문제 */
export function practiceOfRank(rank: RankId): Puzzle[] {
  return PRACTICE_PUZZLES.filter((p) => (p.rank ?? "F") === rank);
}

export const EXAM_PUZZLES: Puzzle[] = ALL_PUZZLES.filter((p) => p.category === "exam");
