/**
 * 진술 추리 5문제 (V3 GATE 05): 연습실 D·B, 승급 시험 D→C·B→A·A→S.
 *
 * 진술 네 개의 종류 조합을 전수 탐색해 골랐다. 고른 기준:
 *  - 답이 하나다.
 *  - 네 가정의 참·거짓 무늬가 모두 다르다(두 가정이 같은 이유로 떨어지지 않는다).
 *  - 어느 가정에서나 값이 같은 진술이 없다.
 *  - 어느 진술을 가려도(참인지 거짓인지 모른다고 해도) 답이 하나로 정해지지 않는다(군더더기 진술이 없다).
 * 이름 '하나'는 "참은 하나뿐" 같은 글과 헷갈려 쓰지 않았다.
 *
 * solution 은 개발·검증용이다. 화면에는 플레이어가 해결한 뒤에만 노출한다.
 * 검증은 src/tests/sets-truth.test.ts.
 */
import type { TruthPuzzle } from "../../engine/types";
import { daon, doyun, harin, junho, minjae, sea, sera } from "../people";

/* ───────── 연습 D · 거짓은 하나뿐 ─────────
 * 푸는 길: 정면으로 맞서는 두 진술(준호 "세라가 숨겼다" / 다온 "세라는 숨기지 않았다")을 찾는다.
 * 거짓말쟁이는 그 둘 중 하나이므로 나머지 두 사람의 말은 참이고, 두 말에 함께 든 사람이 답이다.
 */
export const PRACTICE_TRUTH_D: TruthPuzzle = {
  id: "practice-truth-d",
  type: "truth",
  category: "practice",
  title: "실습실의 돋보기",
  typeLabel: "진실·거짓 추리",
  difficulty: 2,
  rank: "D",
  minutes: 3,
  intro: "감식 실습을 앞두고 실습실의 돋보기가 사라졌다. 네 사람 가운데 거짓말은 한 사람만 했다.",
  description:
    "네 명의 학생 중 한 명이 돋보기를 숨겼습니다. 네 사람의 진술 가운데 거짓은 하나뿐이고 나머지 셋은 참입니다. 돋보기를 숨긴 사람은 누구일까요?",
  outro: "돋보기는 다온의 가방에서 나왔다. 거짓말을 한 사람은 엉뚱하게도 준호였다.",
  rules: {
    people: [junho, sera, daon, harin],
    item: "돋보기",
    statements: [
      { speaker: "junho", text: "세라가 숨겼다.", claim: { kind: "culpritIs", who: "sera" } },
      { speaker: "sera", text: "다온이나 하린이 숨겼다.", claim: { kind: "culpritAmong", who: ["daon", "harin"] } },
      { speaker: "daon", text: "세라는 숨기지 않았다.", claim: { kind: "culpritIsNot", who: "sera" } },
      { speaker: "harin", text: "세라나 다온이 숨겼다.", claim: { kind: "culpritAmong", who: ["sera", "daon"] } },
    ],
    trueCount: 3,
  },
  hints: [
    {
      text: "거짓은 하나뿐입니다. 두 사람의 말이 정면으로 부딪치는 곳을 찾아보세요. 둘 다 참일 수도, 둘 다 거짓일 수도 없다면 거짓말을 한 사람은 그 둘 가운데 있습니다.",
      facts: [],
    },
    {
      text: "준호는 세라가 숨겼다고 하고, 다온은 세라가 숨기지 않았다고 합니다. 두 말은 정반대라 하나만 참입니다. 거짓은 하나뿐이니 거짓말을 한 사람은 이 둘 중 하나이고, 세라의 말은 참입니다.",
      facts: [{ kind: "statementIs", speaker: "sera", value: true }],
    },
  ],
  explanation: [
    {
      text: "준호의 말(세라가 숨겼다)과 다온의 말(세라는 숨기지 않았다)은 정반대입니다. 둘 다 참일 수도, 둘 다 거짓일 수도 없습니다.",
      facts: [],
    },
    {
      text: "거짓은 하나뿐이므로 거짓말을 한 사람은 준호와 다온 가운데 있습니다. 세라와 하린의 말은 참입니다.",
      facts: [
        { kind: "statementIs", speaker: "sera", value: true },
        { kind: "statementIs", speaker: "harin", value: true },
      ],
    },
    {
      text: "세라의 말대로라면 다온이나 하린이, 하린의 말대로라면 세라나 다온이 숨겼습니다. 두 말에 함께 들어 있는 사람은 한 명뿐입니다.",
      facts: [
        { kind: "culpritIsNot", who: "junho" },
        { kind: "culpritIsNot", who: "sera" },
        { kind: "culpritIsNot", who: "harin" },
      ],
    },
    {
      text: "다온이 숨겼다면 다온의 말(세라는 숨기지 않았다)은 참이고 준호의 말만 거짓입니다. 참이 3개, 거짓이 1개로 조건에 맞습니다. 돋보기를 숨긴 사람은 다온입니다.",
      facts: [
        { kind: "trueCountIf", culprit: "daon", count: 3 },
        { kind: "statementIs", speaker: "junho", value: false },
        { kind: "statementIs", speaker: "daon", value: true },
      ],
    },
  ],
  solution: "daon",
  reward: 35,
};

/* ───────── 시험 D→C · 참은 하나뿐 ─────────
 * 푸는 길: 서로를 지목한 두 사람(도윤·세아)과 그 둘을 묶은 말(민재)은 한 덩어리다.
 * 둘 중 누가 숨겼어도 그 덩어리에서 참이 둘, 다온의 부인까지 셋이 된다. 그래서 둘은 아니고,
 * 남은 두 사람을 견주면 한쪽은 참이 0개, 한쪽은 1개다.
 */
export const EXAM_TRUTH_D_C: TruthPuzzle = {
  id: "exam-truth-d-c",
  type: "truth",
  category: "exam",
  title: "증거 봉투의 행방",
  typeLabel: "진실·거짓 추리",
  difficulty: 3,
  rank: "D",
  minutes: 3,
  intro: "시험 전날 밤, 감독관 책상의 증거 봉투가 없어졌다. 네 사람 가운데 참말은 한 사람만 했다.",
  description:
    "네 명의 학생 중 한 명이 증거 봉투를 숨겼습니다. 네 사람의 진술 가운데 정확히 하나만 참입니다. 증거 봉투를 숨긴 사람은 누구일까요?",
  outro: "봉투는 민재의 책 사이에서 나왔다. 도윤과 세아를 엮은 말은 눈을 돌리려는 것이었다.",
  rules: {
    people: [doyun, sea, daon, minjae],
    item: "증거 봉투",
    statements: [
      { speaker: "doyun", text: "세아가 숨겼다.", claim: { kind: "culpritIs", who: "sea" } },
      { speaker: "sea", text: "도윤이 숨겼다.", claim: { kind: "culpritIs", who: "doyun" } },
      { speaker: "daon", text: "나는 숨기지 않았다.", claim: { kind: "culpritIsNot", who: "daon" } },
      { speaker: "minjae", text: "도윤이나 세아가 숨겼다.", claim: { kind: "culpritAmong", who: ["doyun", "sea"] } },
    ],
    trueCount: 1,
  },
  hints: [
    {
      text: "도윤과 세아는 서로를 지목하고, 민재는 그 둘 중 하나라고 합니다. 세 사람의 말을 한 덩어리로 놓고, 도윤이나 세아가 숨겼다면 참이 몇 개가 되는지 세어 보세요.",
      facts: [],
    },
    {
      text: "도윤이 숨겼다면 세아와 민재의 말이 참이고, 다온의 부인도 참이라 참이 셋입니다. 세아가 숨겼다고 해도 마찬가지입니다. 도윤과 세아는 숨기지 않았습니다. 남은 두 사람을 견주어 보세요.",
      facts: [
        { kind: "trueCountIf", culprit: "doyun", count: 3 },
        { kind: "trueCountIf", culprit: "sea", count: 3 },
        { kind: "culpritIsNot", who: "doyun" },
        { kind: "culpritIsNot", who: "sea" },
      ],
    },
  ],
  explanation: [
    {
      text: "도윤이 숨겼다면 세아의 말(도윤이 숨겼다), 민재의 말(도윤이나 세아가 숨겼다), 다온의 말(나는 숨기지 않았다)이 참입니다. 참이 3개라 조건에 맞지 않습니다.",
      facts: [{ kind: "trueCountIf", culprit: "doyun", count: 3 }],
    },
    {
      text: "세아가 숨겼다면 도윤, 민재, 다온의 말이 참입니다. 역시 참이 3개라 맞지 않습니다.",
      facts: [{ kind: "trueCountIf", culprit: "sea", count: 3 }],
    },
    {
      text: "다온이 숨겼다면 다온의 부인은 거짓이고, 도윤·세아·민재의 말도 모두 거짓입니다. 참이 하나도 없어 맞지 않습니다.",
      facts: [{ kind: "trueCountIf", culprit: "daon", count: 0 }],
    },
    {
      text: "민재가 숨겼다면 다온의 말만 참입니다. 참이 정확히 1개인 경우는 이것뿐이므로 증거 봉투를 숨긴 사람은 민재입니다.",
      facts: [
        { kind: "trueCountIf", culprit: "minjae", count: 1 },
        { kind: "statementIs", speaker: "daon", value: true },
        { kind: "statementIs", speaker: "minjae", value: false },
      ],
    },
  ],
  solution: "minjae",
  reward: 0,
};

/* ───────── 연습 B · 남의 말을 가리키는 진술 하나, 참은 둘 ─────────
 * 푸는 길: 도윤은 민재의 말을 두고 말했으므로 두 사람의 말은 함께 참이거나 함께 거짓이다.
 * 함께 참이면 나머지 두 부인이 모두 거짓이어야 하는데, 그러면 숨긴 사람이 둘이 된다(모순).
 * 함께 거짓이면 민재가 감싼 사람이 숨긴 것이다.
 */
export const PRACTICE_TRUTH_B: TruthPuzzle = {
  id: "practice-truth-b",
  type: "truth",
  category: "practice",
  title: "야간 순찰의 랜턴",
  typeLabel: "진실·거짓 추리",
  difficulty: 4,
  rank: "B",
  minutes: 4,
  intro: "야간 순찰에 쓰는 랜턴이 보관대에서 사라졌다. 네 사람은 서로를 감싸는 말만 했다.",
  description:
    "네 명의 학생 중 한 명이 랜턴을 숨겼습니다. 네 사람의 진술 가운데 정확히 둘만 참입니다. 남의 말을 두고 한 말도 진술로 셉니다. 랜턴을 숨긴 사람은 누구일까요?",
  outro: "랜턴은 하린의 침대 밑에 있었다. 하린을 감싼 민재도, 민재를 거든 도윤도 틀렸다.",
  rules: {
    people: [minjae, harin, sera, doyun],
    item: "랜턴",
    statements: [
      { speaker: "minjae", text: "하린은 숨기지 않았다.", claim: { kind: "culpritIsNot", who: "harin" } },
      { speaker: "harin", text: "세라는 숨기지 않았다.", claim: { kind: "culpritIsNot", who: "sera" } },
      { speaker: "sera", text: "도윤은 숨기지 않았다.", claim: { kind: "culpritIsNot", who: "doyun" } },
      { speaker: "doyun", text: "민재의 말은 참이다.", claim: { kind: "speakerTruthful", who: "minjae" } },
    ],
    trueCount: 2,
  },
  hints: [
    {
      text: "도윤은 사건이 아니라 민재의 말에 대해 말했습니다. 민재의 말이 참이면 도윤의 말도 참이고, 거짓이면 도윤의 말도 거짓입니다. 두 사람을 한 묶음으로 놓고 경우를 둘로 나눠 보세요.",
      facts: [],
    },
    {
      text: "먼저 한 가지를 지웁니다. 민재가 숨겼다면 네 진술이 모두 참이 되어 맞지 않습니다. 다음으로 민재와 도윤의 말이 함께 참인 경우를 보세요. 참은 이미 둘이니 하린과 세라의 말은 둘 다 거짓이어야 하는데, '숨기지 않았다'가 거짓이면 그 사람이 숨긴 것입니다.",
      facts: [
        { kind: "trueCountIf", culprit: "minjae", count: 4 },
        { kind: "culpritIsNot", who: "minjae" },
      ],
    },
  ],
  explanation: [
    {
      text: "도윤의 말은 민재의 말에 달려 있습니다. 민재의 말이 참이면 도윤의 말도 참이고, 거짓이면 도윤의 말도 거짓입니다. 두 사람의 말은 함께 참이거나 함께 거짓입니다.",
      facts: [],
    },
    {
      text: "함께 참인 경우: 참은 이미 둘이므로 하린과 세라의 말은 모두 거짓이어야 합니다. 하린의 말(세라는 숨기지 않았다)이 거짓이면 세라가, 세라의 말(도윤은 숨기지 않았다)이 거짓이면 도윤이 숨긴 것이 되어 숨긴 사람이 둘이 됩니다. 이 경우는 있을 수 없습니다.",
      facts: [
        { kind: "statementIs", speaker: "minjae", value: false },
        { kind: "statementIs", speaker: "doyun", value: false },
      ],
    },
    {
      text: "함께 거짓인 경우: 민재의 말(하린은 숨기지 않았다)이 거짓이므로 하린이 숨겼습니다.",
      facts: [
        { kind: "culpritIsNot", who: "minjae" },
        { kind: "culpritIsNot", who: "sera" },
        { kind: "culpritIsNot", who: "doyun" },
      ],
    },
    {
      text: "하린이 숨겼다면 하린의 말과 세라의 말은 참이고, 민재와 도윤의 말은 거짓입니다. 참이 정확히 2개이므로 랜턴을 숨긴 사람은 하린입니다.",
      facts: [
        { kind: "trueCountIf", culprit: "harin", count: 2 },
        { kind: "statementIs", speaker: "harin", value: true },
        { kind: "statementIs", speaker: "sera", value: true },
      ],
    },
  ],
  solution: "harin",
  reward: 45,
};

/* ───────── 시험 B→A · 한 사람의 말을 두고 두 사람이 입을 모은다, 참은 하나뿐 ─────────
 * 푸는 길: 하린과 다온은 둘 다 준호의 말이 거짓이라고 한다. 두 말은 함께 참이거나 함께 거짓인데,
 * 참은 하나뿐이므로 둘 다 거짓이다. 그러면 준호의 말이 그 하나뿐인 참이고, 세아의 말은 거짓이다.
 * 준호가 꼽은 두 사람에서 세아가 꼽은 사람을 빼면 답이 남는다.
 * (지시의 "갑 → 을 → 사실" 사슬은 A→S 로 보냈다. 이유는 테스트 파일 머리의 주석.)
 */
export const EXAM_TRUTH_B_A: TruthPuzzle = {
  id: "exam-truth-b-a",
  type: "truth",
  category: "exam",
  title: "돌아오지 않은 암호표",
  typeLabel: "진실·거짓 추리",
  difficulty: 4,
  rank: "B",
  minutes: 4,
  intro: "해독 시험에 쓸 암호표가 돌아오지 않았다. 네 사람 가운데 참을 말한 사람은 하나뿐이다.",
  description:
    "네 명의 학생 중 한 명이 암호표를 숨겼습니다. 네 사람의 진술 가운데 정확히 하나만 참입니다. 남의 말을 두고 한 말도 진술로 셉니다. 암호표를 숨긴 사람은 누구일까요?",
  outro: "암호표는 세아의 필통에서 나왔다. 입을 모아 준호를 몰아세운 두 사람이 틀렸다.",
  rules: {
    people: [junho, sea, harin, daon],
    item: "암호표",
    statements: [
      { speaker: "junho", text: "세아나 하린이 숨겼다.", claim: { kind: "culpritAmong", who: ["sea", "harin"] } },
      { speaker: "sea", text: "준호나 하린이 숨겼다.", claim: { kind: "culpritAmong", who: ["junho", "harin"] } },
      { speaker: "harin", text: "준호의 말은 거짓이다.", claim: { kind: "speakerLying", who: "junho" } },
      { speaker: "daon", text: "준호는 거짓말을 했다.", claim: { kind: "speakerLying", who: "junho" } },
    ],
    trueCount: 1,
  },
  hints: [],
  explanation: [
    {
      text: "하린과 다온은 같은 말을 했습니다. 둘 다 준호의 말이 거짓이라고 합니다. 두 사람의 말은 함께 참이거나 함께 거짓입니다.",
      facts: [],
    },
    {
      text: "참은 하나뿐인데 두 사람의 말이 함께 참이면 참이 둘이 됩니다. 따라서 하린과 다온의 말은 모두 거짓이고, 준호의 말은 참입니다.",
      facts: [
        { kind: "statementIs", speaker: "harin", value: false },
        { kind: "statementIs", speaker: "daon", value: false },
        { kind: "statementIs", speaker: "junho", value: true },
      ],
    },
    {
      text: "하나뿐인 참이 준호의 말이므로 세아의 말은 거짓입니다. 준호의 말대로 세아나 하린이 숨겼고, 세아의 말이 거짓이니 준호도 하린도 아닙니다.",
      facts: [
        { kind: "statementIs", speaker: "sea", value: false },
        { kind: "culpritIsNot", who: "junho" },
        { kind: "culpritIsNot", who: "harin" },
      ],
    },
    {
      text: "남는 사람은 세아입니다. 세아가 숨겼다면 준호의 말만 참이 되어 조건에 맞습니다. 암호표를 숨긴 사람은 세아입니다.",
      facts: [
        { kind: "trueCountIf", culprit: "sea", count: 1 },
        { kind: "culpritIsNot", who: "daon" },
      ],
    },
  ],
  solution: "sea",
  reward: 0,
};

/* ───────── 시험 A→S · 가리키는 말의 사슬(세라 → 도윤 → 민재의 말), 거짓은 하나뿐 ─────────
 * 푸는 길: 도윤은 민재의 말이 거짓이라 하고, 세라는 그 도윤의 말이 참이라 한다.
 * 그래서 세 사람의 말 가운데 참은 1개(민재만)이거나 2개(세라와 도윤)다.
 * 참이 셋이려면 뒤쪽이어야 하고 다온의 말도 참이어야 한다. 민재가 꼽은 두 사람을 지우고 다온이 꼽은 두 사람에서 고른다.
 * 숨긴 사람은 참말을 했고, 거짓말을 한 사람은 숨기지 않았다.
 */
export const EXAM_TRUTH_A_S: TruthPuzzle = {
  id: "exam-truth-a-s",
  type: "truth",
  category: "exam",
  title: "멈춘 회중시계",
  typeLabel: "진실·거짓 추리",
  difficulty: 5,
  rank: "A",
  minutes: 5,
  intro: "학원장의 회중시계가 자정에 멈춘 채 사라졌다. 네 사람 가운데 거짓말은 한 사람만 했다.",
  description:
    "네 명의 학생 중 한 명이 회중시계를 숨겼습니다. 네 사람의 진술 가운데 거짓은 하나뿐이고 나머지 셋은 참입니다. 남의 말을 두고 한 말도 진술로 셉니다. 회중시계를 숨긴 사람은 누구일까요?",
  outro: "시계는 도윤의 외투 안주머니에 있었다. 숨긴 사람은 참말만 했고, 거짓말은 민재가 했다.",
  rules: {
    people: [minjae, daon, sera, doyun],
    item: "회중시계",
    statements: [
      { speaker: "minjae", text: "다온이나 세라가 숨겼다.", claim: { kind: "culpritAmong", who: ["daon", "sera"] } },
      { speaker: "daon", text: "세라나 도윤이 숨겼다.", claim: { kind: "culpritAmong", who: ["sera", "doyun"] } },
      { speaker: "sera", text: "도윤의 말은 참이다.", claim: { kind: "speakerTruthful", who: "doyun" } },
      { speaker: "doyun", text: "민재의 말은 거짓이다.", claim: { kind: "speakerLying", who: "minjae" } },
    ],
    trueCount: 3,
  },
  hints: [],
  explanation: [
    {
      text: "도윤은 민재의 말이 거짓이라고 하고, 세라는 그 도윤의 말이 참이라고 합니다. 민재의 말이 참이면 도윤의 말은 거짓이고 세라의 말도 거짓입니다. 민재의 말이 거짓이면 도윤과 세라의 말이 함께 참입니다.",
      facts: [],
    },
    {
      text: "그래서 민재·세라·도윤 세 사람의 말 가운데 참은 1개(민재만)이거나 2개(세라와 도윤)입니다. 참이 모두 3개가 되려면 세라와 도윤의 말이 참이고 다온의 말도 참이어야 합니다. 거짓은 민재의 말입니다.",
      facts: [
        { kind: "statementIs", speaker: "minjae", value: false },
        { kind: "statementIs", speaker: "doyun", value: true },
        { kind: "statementIs", speaker: "sera", value: true },
        { kind: "statementIs", speaker: "daon", value: true },
      ],
    },
    {
      text: "민재의 말이 거짓이니 다온도 세라도 숨기지 않았습니다. 다온의 말이 참이니 세라나 도윤이 숨겼습니다. 두 조건에 모두 맞는 사람은 한 명뿐입니다.",
      facts: [
        { kind: "culpritIsNot", who: "daon" },
        { kind: "culpritIsNot", who: "sera" },
        { kind: "culpritIsNot", who: "minjae" },
      ],
    },
    {
      text: "도윤이 숨겼다면 다온·세라·도윤의 말이 참이고 민재의 말만 거짓입니다. 참이 정확히 3개이므로 회중시계를 숨긴 사람은 도윤입니다.",
      facts: [{ kind: "trueCountIf", culprit: "doyun", count: 3 }],
    },
  ],
  solution: "doyun",
  reward: 0,
};

/** 표의 순서: 연습 D → 시험 D→C → 연습 B → 시험 B→A → 시험 A→S */
export const TRUTH_SET: TruthPuzzle[] = [PRACTICE_TRUTH_D, EXAM_TRUTH_D_C, PRACTICE_TRUTH_B, EXAM_TRUTH_B_A, EXAM_TRUTH_A_S];
