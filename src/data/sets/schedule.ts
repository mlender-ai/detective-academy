/**
 * 순서 추론 여섯 문제 (V3 GATE 05): 연습실 D·C·A, 승급 시험 C→B·B→A·A→S.
 *
 * 조건 후보를 전수 탐색해, 답이 하나이고 어느 조건을 빼도 답이 여럿이 되는 세트 가운데서 골랐다.
 * 여섯 문제와 기존 두 문제(발표 순서 재구성, 찢어진 면담 순서표)는 조건 종류의 조합이 모두 다르다.
 *
 * solution 은 개발·검증용이다. 화면에는 플레이어가 해결한 뒤에만 노출한다.
 * 정답이 하나뿐인지, 군더더기가 없는지, 해설의 글이 맞는지는 src/tests/sets-schedule.test.ts 가 확인한다.
 */
import type { SchedulePuzzle, ScheduleSlot } from "../../engine/types";
import { daon, doyun, hana, harin, junho, minjae, sea, sera } from "../people";

const ORDINALS = ["첫 번째", "두 번째", "세 번째", "네 번째", "다섯 번째"];

/** "18시", "19시" … */
const hours = (from: number, count: number): ScheduleSlot[] =>
  Array.from({ length: count }, (_, i) => ({ label: `${from + i}시`, ordinal: ORDINALS[i] }));

/** "1번", "2번" … */
const turns = (count: number): ScheduleSlot[] => Array.from({ length: count }, (_, i) => ({ label: `${i + 1}번`, ordinal: ORDINALS[i] }));

const TYPE_LABEL = "다중 조건 순서 추론";

/* ───────── 연습 D · 처음 아니면 마지막 ─────────
 * 푸는 길: 두 사람이 양 끝을 나눠 가지면 가운데 두 자리의 주인도 정해진다(조건 둘을 합친다).
 * 그 뒤 '먼저' 조건 둘이 끝과 가운데의 앞뒤를 하나씩 정한다. 경우를 나눌 일은 없다.
 */
export const PRACTICE_SCHEDULE_D: SchedulePuzzle = {
  id: "practice-schedule-d",
  type: "schedule",
  category: "practice",
  title: "비에 젖은 종탑 당번표",
  typeLabel: TYPE_LABEL,
  difficulty: 2,
  rank: "D",
  minutes: 2,
  intro: "비에 젖은 종탑 당번표. 번진 글씨 사이로 메모 네 줄만 읽힌다.",
  description:
    "학생 네 명이 18시, 19시, 20시, 21시에 한 명씩 종을 칩니다. 네 조건을 모두 만족하는 당번 순서를 찾아 배치하세요.",
  outro: "당번표를 다시 채웠다. 오늘 밤 첫 종은 준호가 친다.",
  rules: {
    people: [junho, harin, daon, sea],
    title: "당번 순서",
    slots: hours(18, 4),
    constraints: [
      { kind: "slotAmong", who: "junho", slots: [0, 3], text: "준호는 처음 아니면 마지막이다." },
      { kind: "slotAmong", who: "harin", slots: [0, 3], text: "하린은 처음 아니면 마지막이다." },
      { kind: "before", a: "junho", b: "daon", text: "준호는 다온보다 먼저 종을 친다." },
      { kind: "before", a: "sea", b: "daon", text: "세아는 다온보다 먼저 종을 친다." },
    ],
  },
  hints: [
    {
      text: "조건 1과 2를 함께 보세요. 처음과 마지막, 두 자리를 두 사람이 나눠 갖습니다. 그러면 가운데 두 자리에 설 사람도 정해집니다.",
      facts: [
        { kind: "slotAmong", who: "daon", slots: [1, 2] },
        { kind: "slotAmong", who: "sea", slots: [1, 2] },
      ],
    },
    {
      text: "준호와 하린 가운데 누가 첫 번째일까요? 조건 3에서 준호는 다온보다 먼저 종을 칩니다. 마지막 당번은 누구보다도 먼저일 수 없습니다.",
      facts: [{ kind: "slotNot", who: "junho", slot: 3 }],
    },
  ],
  explanation: [
    {
      text: "조건 1과 2에 따라 준호와 하린이 18시와 21시를 나눠 갖습니다. 가운데 19시와 20시는 세아와 다온의 자리입니다.",
      facts: [
        { kind: "slotAmong", who: "junho", slots: [0, 3] },
        { kind: "slotAmong", who: "harin", slots: [0, 3] },
        { kind: "slotAmong", who: "sea", slots: [1, 2] },
        { kind: "slotAmong", who: "daon", slots: [1, 2] },
      ],
    },
    {
      text: "조건 3에 따라 준호는 다온보다 먼저 종을 치므로 마지막 당번일 수 없습니다. 준호가 18시, 하린이 21시입니다.",
      facts: [
        { kind: "slotIs", who: "junho", slot: 0 },
        { kind: "slotIs", who: "harin", slot: 3 },
      ],
    },
    {
      text: "조건 4에 따라 세아가 다온보다 먼저이므로 세아가 19시, 다온이 20시입니다. 당번 순서는 준호, 세아, 다온, 하린입니다.",
      facts: [
        { kind: "slotIs", who: "junho", slot: 0 },
        { kind: "slotIs", who: "sea", slot: 1 },
        { kind: "slotIs", who: "daon", slot: 2 },
        { kind: "slotIs", who: "harin", slot: 3 },
      ],
    },
  ],
  solution: ["junho", "sea", "daon", "harin"],
  reward: 35,
};

/* ───────── 연습 C · 사이에 정확히 한 명 ─────────
 * 푸는 길: '한 자리 건너'의 네 가지 경우를 놓고 비교한다. 도윤이 가운데 자리면 남는 두 자리가 모두 도윤의 옆이라
 * 민재가 설 곳이 없다(모순으로 두 경우를 지운다). 남은 두 경우는 '먼저' 조건이 가른다.
 */
export const PRACTICE_SCHEDULE_C: SchedulePuzzle = {
  id: "practice-schedule-c",
  type: "schedule",
  category: "practice",
  title: "순찰 일지의 빈칸",
  typeLabel: TYPE_LABEL,
  difficulty: 3,
  rank: "C",
  minutes: 3,
  intro: "야간 순찰 일지의 이름 칸이 비어 있다. 네 사람이 기억하는 것은 세 가지뿐이다.",
  description:
    "학생 네 명이 20시, 21시, 22시, 23시에 한 명씩 복도를 순찰했습니다. 세 조건을 모두 만족하는 순찰 순서를 찾아 배치하세요.",
  outro: "일지의 빈칸이 채워졌다. 20시의 첫 순찰은 도윤이었다.",
  rules: {
    people: [doyun, hana, minjae, sera],
    title: "순찰 순서",
    slots: hours(20, 4),
    constraints: [
      { kind: "gap", a: "doyun", b: "hana", between: 1, text: "도윤과 하나 사이에 딱 한 명이다." },
      { kind: "notAdjacent", a: "doyun", b: "minjae", text: "도윤과 민재는 연달아 서지 않았다." },
      { kind: "before", a: "doyun", b: "sera", text: "도윤은 세라보다 먼저 순찰했다." },
    ],
  },
  hints: [
    {
      text: "조건 1부터 보세요. 사이에 한 명을 두는 두 자리는 20시·22시 아니면 21시·23시뿐입니다. 도윤과 하나가 그 두 자리를 어느 쪽으로 나눠 갖는지, 네 가지 경우를 차례로 놓아 보세요.",
      facts: [],
    },
    {
      text: "도윤이 21시나 22시에 선다고 해 보세요. 하나가 한 자리를 건너 서면, 남는 두 자리는 모두 도윤의 바로 옆입니다. 민재가 어디에 서도 조건 2에 어긋납니다.",
      facts: [{ kind: "slotAmong", who: "doyun", slots: [0, 3] }],
    },
  ],
  explanation: [
    {
      text: "조건 1에 따라 도윤과 하나는 20시·22시 또는 21시·23시를 나눠 갖습니다. 도윤이 21시나 22시라면 남는 두 자리가 모두 도윤의 바로 옆이라, 민재가 도윤과 연달아 서게 됩니다. 조건 2에 어긋나므로 도윤은 20시 아니면 23시입니다.",
      facts: [{ kind: "slotAmong", who: "doyun", slots: [0, 3] }],
    },
    {
      text: "조건 3에 따라 도윤은 세라보다 먼저이므로 23시일 수 없습니다. 도윤이 20시이고, 한 자리 건너 22시가 하나입니다.",
      facts: [
        { kind: "slotIs", who: "doyun", slot: 0 },
        { kind: "slotIs", who: "hana", slot: 2 },
      ],
    },
    {
      text: "남은 21시와 23시에 세라와 민재가 섭니다. 민재는 도윤의 바로 다음인 21시에 설 수 없으므로 민재가 23시, 세라가 21시입니다.",
      facts: [
        { kind: "slotIs", who: "minjae", slot: 3 },
        { kind: "slotIs", who: "sera", slot: 1 },
      ],
    },
    {
      text: "순찰 순서는 도윤, 세라, 하나, 민재입니다. 도윤과 하나 사이에는 세라 한 명이 있고, 민재는 도윤과 떨어져 있습니다.",
      facts: [
        { kind: "slotIs", who: "doyun", slot: 0 },
        { kind: "slotIs", who: "sera", slot: 1 },
        { kind: "slotIs", who: "hana", slot: 2 },
        { kind: "slotIs", who: "minjae", slot: 3 },
      ],
    },
  ],
  solution: ["doyun", "sera", "hana", "minjae"],
  reward: 40,
};

/* ───────── 시험 C→B · 두 사람 사이 ─────────
 * 푸는 길: '사이' 조건 둘에 모두 나오는 다온이 하나의 한쪽에 서고, 나머지 둘은 함께 반대쪽에 선다
 * (다온·하나·둘 또는 둘·하나·다온의 두 갈래). '바로 다음' 조건이 갈래와 둘의 앞뒤를 한 번에 정한다.
 */
export const EXAM_SCHEDULE_C_B: SchedulePuzzle = {
  id: "exam-schedule-c-b",
  type: "schedule",
  category: "exam",
  title: "지워진 열람 대장",
  typeLabel: TYPE_LABEL,
  difficulty: 3,
  rank: "C",
  minutes: 3,
  intro: "서고 열람 대장의 순번이 지워졌다. 사서가 남긴 메모는 세 줄이다.",
  description:
    "학생 네 명이 1번부터 4번까지 한 명씩 서고에 들어갔습니다. 세 조건을 모두 만족하는 열람 순서를 찾아 배치하세요. '사이'는 바로 옆이 아니어도 됩니다.",
  outro: "대장의 순번이 되살아났다. 서고에 가장 먼저 들어간 사람은 하린이다.",
  rules: {
    people: [hana, daon, doyun, harin],
    title: "열람 순서",
    slots: turns(4),
    constraints: [
      { kind: "between", who: "hana", a: "daon", b: "doyun", text: "하나는 다온과 도윤 사이의 순서다." },
      { kind: "between", who: "hana", a: "daon", b: "harin", text: "하나는 다온과 하린 사이의 순서다." },
      { kind: "immediatelyAfter", who: "hana", after: "doyun", text: "하나는 도윤의 바로 다음이다." },
    ],
  },
  hints: [
    {
      text: "조건 1과 2에 모두 나오는 사람을 찾으세요. 하나를 가운데 두고, 다온은 두 번 다 맞은편에 섭니다. 그렇다면 도윤과 하린은 하나의 어느 쪽에 서야 할까요?",
      facts: [{ kind: "slotAmong", who: "hana", slots: [1, 2] }],
    },
    {
      text: "다온이 하나의 한쪽에 있으면 도윤과 하린은 둘 다 반대쪽입니다. 그래서 다온은 1번 아니면 4번입니다. 조건 3에서 도윤이 하나보다 앞이라는 것으로 다온의 쪽을 정하세요.",
      facts: [
        { kind: "slotAmong", who: "daon", slots: [0, 3] },
        { kind: "adjacent", first: "doyun", second: "hana" },
      ],
    },
  ],
  explanation: [
    {
      text: "조건 1과 2에서 하나는 두 번 다 다온과 다른 한 사람의 사이입니다. 다온이 하나의 한쪽에 있으므로 도윤과 하린은 둘 다 반대쪽에 섭니다. 다온은 1번 아니면 4번이고, 하나는 다온의 바로 옆인 2번 아니면 3번입니다.",
      facts: [
        { kind: "slotAmong", who: "daon", slots: [0, 3] },
        { kind: "slotAmong", who: "hana", slots: [1, 2] },
      ],
    },
    {
      text: "조건 3에 따라 도윤은 하나의 바로 앞입니다. 도윤이 하나보다 앞이므로 도윤과 하린은 하나의 앞쪽, 다온은 뒤쪽입니다. 다온이 4번, 하나가 3번입니다.",
      facts: [
        { kind: "slotIs", who: "daon", slot: 3 },
        { kind: "slotIs", who: "hana", slot: 2 },
      ],
    },
    {
      text: "하나의 바로 앞인 2번이 도윤이고, 남은 1번이 하린입니다. 열람 순서는 하린, 도윤, 하나, 다온입니다.",
      facts: [
        { kind: "slotIs", who: "harin", slot: 0 },
        { kind: "slotIs", who: "doyun", slot: 1 },
        { kind: "slotIs", who: "hana", slot: 2 },
        { kind: "slotIs", who: "daon", slot: 3 },
      ],
    },
  ],
  solution: ["harin", "doyun", "hana", "daon"],
  reward: 0,
};

/* ───────── 연습 A · 엇갈린 두 쌍 ─────────
 * 푸는 길: '한 자리 건너' 두 쌍을 다섯 자리에 겹치지 않게 놓는 방법은 둘뿐이고, 어느 쪽이든 남는 자리는 맨 앞 아니면 맨 뒤다
 * (쌍에 들지 않는 사람의 자리가 먼저 좁혀진다). 그 뒤 '먼저'가 방향을, '사이'가 쌍 안의 앞뒤를 정하고,
 * 쌍의 자리를 두 경우로 나눠 '연달아 서지 않는다'로 하나를 지운다.
 */
export const PRACTICE_SCHEDULE_A: SchedulePuzzle = {
  id: "practice-schedule-a",
  type: "schedule",
  category: "practice",
  title: "그을린 낭독 순서지",
  typeLabel: TYPE_LABEL,
  difficulty: 5,
  rank: "A",
  minutes: 5,
  intro: "촛불에 그을린 낭독회 순서지. 다섯 이름의 자리는 타 버렸고 메모만 남았다.",
  description:
    "다섯 명이 한 명씩 낭독합니다. 다섯 조건을 모두 지키는 낭독 순서를 찾으세요. '사이'는 바로 옆이 아니어도 됩니다.",
  outro: "순서지를 새로 썼다. 첫 낭독은 하나, 마지막 낭독은 도윤이다.",
  rules: {
    people: [hana, junho, sera, daon, doyun],
    title: "낭독 순서",
    slots: turns(5),
    constraints: [
      { kind: "gap", a: "sera", b: "junho", between: 1, text: "세라와 준호 사이에 딱 한 명이다." },
      { kind: "gap", a: "daon", b: "doyun", between: 1, text: "다온과 도윤 사이에 딱 한 명이다." },
      { kind: "between", who: "sera", a: "junho", b: "hana", text: "세라는 준호와 하나 사이의 순서다." },
      { kind: "notAdjacent", a: "sera", b: "doyun", text: "세라와 도윤은 연달아 서지 않는다." },
      { kind: "before", a: "hana", b: "daon", text: "하나는 다온보다 먼저 낭독한다." },
    ],
  },
  hints: [
    {
      text: "조건 1과 2는 같은 모양입니다. 한 자리를 건너 서는 두 자리는 1번·3번, 2번·4번, 3번·5번뿐입니다. 두 쌍을 서로 겹치지 않게 놓는 방법을 세어 보고, 그때마다 남는 한 자리가 어디인지 보세요.",
      facts: [{ kind: "slotAmong", who: "hana", slots: [0, 4] }],
    },
    {
      text: "남는 자리는 1번 아니면 5번이고, 거기에 서는 사람은 어느 쌍에도 들지 않는 하나입니다. 조건 5에서 하나는 다온보다 먼저이므로 5번일 수 없습니다. 이제 조건 3으로 세라와 준호의 앞뒤를 정하세요.",
      facts: [{ kind: "slotIs", who: "hana", slot: 0 }],
    },
  ],
  explanation: [
    {
      text: "조건 1과 2에 따라 두 쌍이 저마다 한 자리를 건너 섭니다. 그런 두 자리는 1번·3번, 2번·4번, 3번·5번뿐이고, 겹치지 않게 두 쌍을 놓으면 1번·3번과 2번·4번, 또는 2번·4번과 3번·5번입니다. 남는 자리는 5번 아니면 1번이고, 거기가 하나의 자리입니다.",
      facts: [{ kind: "slotAmong", who: "hana", slots: [0, 4] }],
    },
    {
      text: "조건 5에 따라 하나는 다온보다 먼저이므로 5번일 수 없습니다. 하나가 1번이고, 두 쌍은 2번·4번과 3번·5번에 섭니다.",
      facts: [{ kind: "slotIs", who: "hana", slot: 0 }],
    },
    {
      text: "조건 3에 따라 세라는 준호와 하나 사이입니다. 하나가 1번이니 세라가 준호보다 앞입니다. 세라와 준호가 3번·5번이라면 다온과 도윤이 2번·4번인데, 둘 다 세라의 바로 옆이라 조건 4에 어긋납니다. 세라가 2번, 준호가 4번입니다.",
      facts: [
        { kind: "slotIs", who: "sera", slot: 1 },
        { kind: "slotIs", who: "junho", slot: 3 },
      ],
    },
    {
      text: "다온과 도윤은 3번과 5번입니다. 조건 4에 따라 도윤은 세라의 바로 옆인 3번에 설 수 없으므로 도윤이 5번, 다온이 3번입니다. 낭독 순서는 하나, 세라, 다온, 준호, 도윤입니다.",
      facts: [
        { kind: "slotIs", who: "hana", slot: 0 },
        { kind: "slotIs", who: "sera", slot: 1 },
        { kind: "slotIs", who: "daon", slot: 2 },
        { kind: "slotIs", who: "junho", slot: 3 },
        { kind: "slotIs", who: "doyun", slot: 4 },
      ],
    },
  ],
  solution: ["hana", "sera", "daon", "junho", "doyun"],
  reward: 50,
};

/* ───────── 시험 B→A · 먼저의 사슬과 끝자리 ─────────
 * 푸는 길: 세 사람의 사슬(민재 → 세아 → 도윤)을 한 줄로 두고, 하린이 맨 앞인 경우와 맨 뒤인 경우를 나눈다.
 * 맨 뒤라면 하나가 어디에 서든 사슬의 가운데(세아)가 세 번째로 밀린다. 끝자리 조건 둘과 금지 자리 하나를 차례로 겹쳐야 풀린다.
 */
export const EXAM_SCHEDULE_B_A: SchedulePuzzle = {
  id: "exam-schedule-b-a",
  type: "schedule",
  category: "exam",
  title: "얼룩진 암실 예약표",
  typeLabel: TYPE_LABEL,
  difficulty: 4,
  rank: "B",
  minutes: 4,
  intro: "암실 예약표에 현상액이 튀었다. 다섯 사람의 순번은 얼룩 아래에 있다.",
  description:
    "다섯 명이 한 명씩 암실을 씁니다. 다섯 조건을 모두 지키는 사용 순서를 찾으세요.",
  outro: "얼룩 아래의 순번을 되찾았다. 암실의 첫 차례는 하린이다.",
  rules: {
    people: [doyun, minjae, sea, harin, hana],
    title: "사용 순서",
    slots: turns(5),
    constraints: [
      { kind: "before", a: "minjae", b: "sea", text: "민재는 세아보다 먼저 암실을 쓴다." },
      { kind: "before", a: "sea", b: "doyun", text: "세아는 도윤보다 먼저 암실을 쓴다." },
      { kind: "slotAmong", who: "harin", slots: [0, 4], text: "하린은 처음 아니면 마지막이다." },
      { kind: "slotAmong", who: "hana", slots: [0, 1], text: "하나는 첫 번째 아니면 두 번째다." },
      { kind: "notAtSlot", who: "sea", slot: 2, text: "세아는 세 번째 순서가 아니다." },
    ],
  },
  hints: [],
  explanation: [
    {
      text: "조건 1과 2에 따라 민재, 세아, 도윤은 이 순서대로 섭니다. 세아의 앞에는 민재가, 뒤에는 도윤이 있어야 하므로 세아는 1번도 5번도 아닙니다.",
      facts: [{ kind: "slotAmong", who: "sea", slots: [1, 2, 3] }],
    },
    {
      text: "조건 3에서 하린이 5번이라고 해 봅니다. 조건 4에 따라 하나는 1번 아니면 2번이고, 남은 세 자리에 민재, 세아, 도윤이 순서대로 섭니다. 하나가 1번이면 2·3·4번, 하나가 2번이면 1·3·4번이라 어느 쪽이든 세아가 3번이 됩니다. 조건 5에 어긋나므로 하린은 1번입니다.",
      facts: [{ kind: "slotIs", who: "harin", slot: 0 }],
    },
    {
      text: "하린이 1번이므로 조건 4의 하나는 2번입니다. 남은 3·4·5번에 민재, 세아, 도윤이 순서대로 서고, 세아는 4번이라 조건 5도 지킵니다. 사용 순서는 하린, 하나, 민재, 세아, 도윤입니다.",
      facts: [
        { kind: "slotIs", who: "harin", slot: 0 },
        { kind: "slotIs", who: "hana", slot: 1 },
        { kind: "slotIs", who: "minjae", slot: 2 },
        { kind: "slotIs", who: "sea", slot: 3 },
        { kind: "slotIs", who: "doyun", slot: 4 },
      ],
    },
  ],
  solution: ["harin", "hana", "minjae", "sea", "doyun"],
  reward: 0,
};

/* ───────── 시험 A→S · 다섯 가지 조건 ─────────
 * 푸는 길: 조건 다섯이 모두 다른 종류다. '바로 다음'과 '연달아 서지 않는다'를 겹쳐 '한 자리 건너'의 방향을 먼저 정하면
 * 네 사람이 이어진 한 덩어리가 된다. 덩어리를 놓을 곳은 두 군데이고, '사이'가 하나를 지운 뒤 '처음 아니면 마지막'이 남은 둘을 가른다.
 */
export const EXAM_SCHEDULE_A_S: SchedulePuzzle = {
  id: "exam-schedule-a-s",
  type: "schedule",
  category: "exam",
  title: "모의 법정의 증인들",
  typeLabel: TYPE_LABEL,
  difficulty: 5,
  rank: "A",
  minutes: 5,
  intro: "마지막 심사는 모의 법정. 증인 다섯의 순서는 재판장의 쪽지 다섯 줄에 숨어 있다.",
  description:
    "다섯 명이 한 명씩 증언합니다. 다섯 조건을 모두 지키는 증언 순서를 찾으세요. '사이'는 바로 옆이 아니어도 됩니다.",
  outro: "증인석의 순서가 정해졌다. 첫 증인은 민재, 마지막 증인은 준호다.",
  rules: {
    people: [junho, sera, minjae, harin, daon],
    title: "증언 순서",
    slots: turns(5),
    constraints: [
      { kind: "gap", a: "sera", b: "junho", between: 1, text: "세라와 준호 사이에 딱 한 명이다." },
      { kind: "between", who: "sera", a: "minjae", b: "harin", text: "세라는 민재와 하린 사이의 순서다." },
      { kind: "slotAmong", who: "minjae", slots: [0, 4], text: "민재는 처음 아니면 마지막이다." },
      { kind: "notAdjacent", a: "junho", b: "daon", text: "준호와 다온은 연달아 서지 않는다." },
      { kind: "immediatelyAfter", who: "sera", after: "daon", text: "세라는 다온의 바로 다음이다." },
    ],
  },
  hints: [],
  explanation: [
    {
      text: "조건 5에 따라 다온과 세라는 '다온 다음 세라'로 붙어 있습니다. 준호가 세라보다 앞이라면 조건 1에 따라 준호, 한 명, 세라 순인데, 그 한 명이 다온이라 준호와 다온이 연달아 서게 됩니다. 조건 4에 어긋나므로 준호는 세라보다 뒤입니다.",
      facts: [{ kind: "adjacent", first: "daon", second: "sera" }],
    },
    {
      text: "따라서 다온, 세라, 한 명, 준호가 이어진 네 자리를 차지합니다. 이 덩어리가 놓일 곳은 1~4번 아니면 2~5번입니다.",
      facts: [
        { kind: "slotAmong", who: "daon", slots: [0, 1] },
        { kind: "slotAmong", who: "junho", slots: [3, 4] },
      ],
    },
    {
      text: "조건 2에 따라 민재와 하린은 세라의 앞뒤로 갈라 섭니다. 덩어리가 1~4번이면 세라의 앞에는 다온뿐이라 그럴 수 없습니다. 덩어리는 2~5번이고, 다온이 2번, 세라가 3번, 준호가 5번입니다.",
      facts: [
        { kind: "slotIs", who: "daon", slot: 1 },
        { kind: "slotIs", who: "sera", slot: 2 },
        { kind: "slotIs", who: "junho", slot: 4 },
      ],
    },
    {
      text: "조건 3에 따라 민재는 1번 아니면 5번인데 5번은 준호입니다. 민재가 1번, 하린이 세라와 준호 사이의 4번입니다. 증언 순서는 민재, 다온, 세라, 하린, 준호입니다.",
      facts: [
        { kind: "slotIs", who: "minjae", slot: 0 },
        { kind: "slotIs", who: "daon", slot: 1 },
        { kind: "slotIs", who: "sera", slot: 2 },
        { kind: "slotIs", who: "harin", slot: 3 },
        { kind: "slotIs", who: "junho", slot: 4 },
      ],
    },
  ],
  solution: ["minjae", "daon", "sera", "harin", "junho"],
  reward: 0,
};

/** 표의 순서: 연습 D · 연습 C · 시험 C→B · 연습 A · 시험 B→A · 시험 A→S */
export const SCHEDULE_SET: SchedulePuzzle[] = [
  PRACTICE_SCHEDULE_D,
  PRACTICE_SCHEDULE_C,
  EXAM_SCHEDULE_C_B,
  PRACTICE_SCHEDULE_A,
  EXAM_SCHEDULE_B_A,
  EXAM_SCHEDULE_A_S,
];
