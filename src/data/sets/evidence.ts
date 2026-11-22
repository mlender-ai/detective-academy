/**
 * 증거 조합 다섯 문제 (V3 GATE 05): 연습실 D·B·A, 승급 시험 C→B·A→S.
 *
 * 세계와 카드를 놓고 전수 탐색(auditEvidence·solveEvidence·entailedPositions)으로 돌려 보며 지었다.
 * 다섯 문제와 기존 두 문제(사라진 자료실 열쇠, 비어 있던 진열장)는 잇는 길이 모두 다르다:
 *   기존 1  같이 있던 사람의 자리                         (함께 + 위치 → 위치)
 *   기존 2  빈 시각을 지워 다녀간 때 → 한 명뿐인 곳의 한 사람   (빈 곳 + 물건 → 위치 → 혼자)
 *   연습 D  빈 곳을 지워 모두의 자리                       (빈 곳 + 빈 곳 → 모두의 위치)
 *   시험 C→B 같이 있던 둘은 한 명뿐인 곳에 있을 수 없다       (함께 + 인원 → 거기 없었다)
 *   연습 B  전체 인원에서 빼기 → 한 명뿐인 곳의 한 사람       (인원 + 인원 → 인원 → 혼자)
 *   연습 A  인원수로 자리 채우기 → 물건의 때 → 같이 있던 사람  (인원 + 위치 → 물건 → 함께, 세 번)
 *   시험 A→S 둘은 될 수 있어도 셋은 안 된다                  (함께 + 함께 → 셋 → 인원)
 * 거짓 진술의 꼴도 섞었다: 연습 D 는 "혼자였다", 연습 B 는 "그와 같이 있었다", 나머지는 "그때 그곳에 있었다".
 * 함정도 한 가지로 되풀이하지 않는다: 늦게 발견된 물건(D) / 다른 시각의 기록(C→B) / 다른 시각의 인원(B) /
 * 때가 정해지는 물건과 정해지지 않는 물건(A) / 모순처럼 보이지만 성립하는 진술 둘(A→S).
 *
 * 장소와 인원의 전체는 화면에 따로 적히지 않으므로, 그것을 써야 풀리는 문제는 description 에 적었다.
 * (연습 D 는 장소 세 곳, 시험 C→B·연습 A·시험 A→S 는 인원, 연습 B 는 둘 다.)
 *
 * solution 은 개발·검증용이다. 화면에는 플레이어가 해결한 뒤에만 노출한다.
 * 정답이 하나뿐인지, 잇기 표가 맞고 빠짐없는지, 해설의 글이 맞는지는 src/tests/sets-evidence.test.ts 가 확인한다.
 */
import type { EvidenceCard, EvidencePuzzle } from "../../engine/types";
import { daon, doyun, hana, harin, junho, minjae, sea, sera } from "../people";

const TYPE_LABEL = "증거 조합";

/* ───────── 연습 D · 빈 곳을 지운다 ─────────
 * 푸는 길: 14:10에 온실도 창고도 비어 있었다. 갈 곳은 세 곳뿐이니 세 사람은 모두 식당에 있었다(한 번 잇기).
 * 그러면 "식당에는 나 혼자였다"는 말이 무너진다. 사람이 아니라 장소에서 출발한다.
 * 함정: 온실에서 나온 모종삽(14:20 발견)은 14:10의 일을 말해 주지 않는다.
 */
export const PRACTICE_EVIDENCE_D: EvidencePuzzle = {
  id: "practice-evidence-d",
  type: "evidence",
  category: "practice",
  title: "깨진 난초 화분",
  typeLabel: TYPE_LABEL,
  difficulty: 2,
  rank: "D",
  minutes: 3,
  intro: "온실의 난초 화분이 깨져 있었다. 14시부터 14시 20분 사이의 일이다.",
  description:
    "세 사람이 있을 수 있던 곳은 온실, 창고, 식당뿐입니다. 진술 하나는 기록과 맞지 않습니다. 증거를 이어 새 사실을 찾고, 거짓 진술과 그것을 깨는 증거를 함께 제출하세요.",
  outro: "다온의 말이 무너졌다. 14:10, 식당에는 세 사람이 모두 있었다.",
  rules: {
    people: [daon, minjae, sea],
    places: [
      { id: "greenhouse", name: "온실" },
      { id: "shed", name: "창고" },
      { id: "dining", name: "식당" },
    ],
    times: ["14:00", "14:10", "14:20"],
    cards: [
      {
        id: "lock",
        kind: "log",
        label: "온실 잠금",
        text: "14:10 온실 문 기록: 안에 아무도 없어 잠겼다.",
        claim: { kind: "empty", place: "greenhouse", time: 1 },
      },
      {
        id: "check",
        kind: "time",
        label: "창고 점검",
        text: "14:10 창고 점검표: 창고에는 아무도 없었다.",
        claim: { kind: "empty", place: "shed", time: 1 },
      },
      {
        id: "trowel",
        kind: "object",
        label: "모종삽",
        text: "14:20, 온실 바닥에서 민재의 모종삽이 나왔다.",
        claim: { kind: "visited", who: "minjae", place: "greenhouse", until: 2 },
      },
      {
        id: "meal",
        kind: "log",
        label: "배식 기록",
        text: "14:00 식당 배식 기록: 세아가 식판을 받았다.",
        claim: { kind: "at", who: "sea", place: "dining", time: 0 },
      },
      {
        id: "say-daon",
        kind: "statement",
        speaker: "daon",
        label: "다온의 진술",
        text: "14:10에 식당에는 나 혼자였어. 아무도 못 봤어.",
        claim: { kind: "alone", who: "daon", place: "dining", time: 1 },
      },
      {
        id: "say-minjae",
        kind: "statement",
        speaker: "minjae",
        label: "민재의 진술",
        text: "14:10에는 식당에 있었어. 모종삽은 먼저 두고 왔어.",
        claim: { kind: "at", who: "minjae", place: "dining", time: 1 },
      },
      {
        id: "say-sea",
        kind: "statement",
        speaker: "sea",
        label: "세아의 진술",
        text: "14:00부터 14:10까지 줄곧 식당에 있었어.",
        claim: { kind: "stayed", who: "sea", place: "dining", from: 0, to: 1 },
      },
    ],
    derivations: [
      {
        from: ["lock", "check"],
        card: {
          id: "fact-all",
          kind: "derived",
          label: "모두의 자리",
          text: "14:10에 세 사람은 모두 식당에 있었다.",
          claim: {
            kind: "all",
            of: [
              { kind: "at", who: "daon", place: "dining", time: 1 },
              { kind: "at", who: "minjae", place: "dining", time: 1 },
              { kind: "at", who: "sea", place: "dining", time: 1 },
            ],
          },
        },
      },
    ],
  },
  hints: [
    {
      text: "모종삽은 14:20에 발견됐을 뿐이라, 14:10에 식당에 있었다는 민재의 말과 어긋나지 않습니다. 사람보다 장소를 먼저 보세요. 14:10에 비어 있던 곳이 몇 군데인가요?",
      facts: [{ kind: "consistent", a: "say-minjae", b: "trowel" }],
    },
    {
      text: "있을 수 있던 곳은 온실, 창고, 식당 세 곳뿐입니다. 온실 잠금 기록과 창고 점검표를 이으면 14:10에 세 사람이 있던 곳이 한 곳으로 정해집니다. 그 사실을 진술과 하나씩 맞대어 보세요.",
      facts: [{ kind: "derives", from: ["lock", "check"], card: "fact-all" }],
    },
  ],
  explanation: [
    {
      text: "온실 잠금 기록: 14:10에 온실에는 아무도 없었습니다. 창고 점검표: 그때 창고에도 아무도 없었습니다. 있을 수 있던 곳은 세 곳뿐이므로, 둘을 이으면 14:10에 세 사람은 모두 식당에 있었습니다.",
      facts: [{ kind: "derives", from: ["lock", "check"], card: "fact-all" }],
    },
    {
      text: "민재의 모종삽은 14:20에 발견됐을 뿐, 언제 두고 왔는지는 알 수 없습니다. 14:10에 식당에 있었다는 말과 어긋나지 않습니다. 세아의 말은 배식 기록과도 맞습니다.",
      facts: [
        { kind: "consistent", a: "say-minjae", b: "trowel" },
        { kind: "statementHolds", statement: "say-minjae" },
        { kind: "statementHolds", statement: "say-sea" },
      ],
    },
    {
      text: "다온은 14:10에 식당에 혼자였다고 했습니다. 그때 식당에는 세 사람이 모두 있었으므로 함께 성립할 수 없습니다. 기록과 맞지 않는 것은 다온의 진술입니다.",
      facts: [{ kind: "contradicts", a: "say-daon", b: "fact-all" }],
    },
  ],
  solution: { statement: "say-daon", against: "fact-all" },
  reward: 35,
};

/* ───────── 시험 C→B · 같이 있던 둘은 한 명뿐인 곳에 있을 수 없다 ─────────
 * 푸는 길: 하나가 음악실에 있었다고 가정하면 같이 서명한 준호도 음악실에 있어야 하고, 그러면 두 명이 된다.
 * 계수기는 한 명이라고 했으니 가정이 틀렸다(한 번 잇기, 얻는 것은 "거기 없었다"는 사실이다).
 * 세 사람뿐이었으니 음악실의 한 명은 하린이다.
 * 함정: 열쇠 대장은 15:00의 기록이다. 하나가 음악실에 들어간 것은 맞지만 15:10의 일을 말해 주지 않는다.
 * 제한 시간이 있는 시험에 들어가므로 기록은 석 장뿐이다.
 */
export const EXAM_EVIDENCE_C_B: EvidencePuzzle = {
  id: "exam-evidence-c-b",
  type: "evidence",
  category: "exam",
  title: "찢겨 나간 고서의 한 쪽",
  typeLabel: TYPE_LABEL,
  difficulty: 3,
  rank: "C",
  minutes: 3,
  intro: "도서관 고서의 한 쪽이 찢겨 나갔다. 15시 10분쯤의 일이다.",
  description:
    "그 시간 학원에는 세 사람뿐이었습니다. 진술 하나는 기록과 맞지 않습니다. 증거를 이어 새 사실을 찾고, 거짓 진술과 그것을 깨는 증거를 함께 제출하세요.",
  outro: "하나의 말이 무너졌다. 15:10, 음악실의 한 사람은 하나가 아니었다.",
  rules: {
    people: [hana, junho, harin],
    places: [
      { id: "music", name: "음악실" },
      { id: "library", name: "도서관" },
      { id: "hall", name: "강당" },
    ],
    times: ["15:00", "15:10"],
    cards: [
      {
        id: "duty",
        kind: "time",
        label: "청소 점검표",
        text: "15:10 청소 점검표: 하나와 준호가 한곳에서 서명했다.",
        claim: { kind: "together", a: "hana", b: "junho", time: 1 },
      },
      {
        id: "counter",
        kind: "log",
        label: "문 계수기",
        text: "15:10 음악실 문 계수기: 안에 있던 사람은 한 명.",
        claim: { kind: "count", place: "music", time: 1, count: 1 },
      },
      {
        id: "key",
        kind: "log",
        label: "열쇠 대장",
        text: "15:00 열쇠 대장: 하나가 음악실 열쇠를 받아 들어갔다.",
        claim: { kind: "at", who: "hana", place: "music", time: 0 },
      },
      {
        id: "say-hana",
        kind: "statement",
        speaker: "hana",
        label: "하나의 진술",
        text: "15:10에 나는 음악실에 있었어. 열쇠도 내가 받았잖아.",
        claim: { kind: "at", who: "hana", place: "music", time: 1 },
      },
      {
        id: "say-junho",
        kind: "statement",
        speaker: "junho",
        label: "준호의 진술",
        text: "15:10에 나는 도서관에 있었어.",
        claim: { kind: "at", who: "junho", place: "library", time: 1 },
      },
      {
        id: "say-harin",
        kind: "statement",
        speaker: "harin",
        label: "하린의 진술",
        text: "15:10에 나는 음악실에서 연습하고 있었어.",
        claim: { kind: "at", who: "harin", place: "music", time: 1 },
      },
    ],
    derivations: [
      {
        from: ["duty", "counter"],
        card: {
          id: "fact-pair",
          kind: "derived",
          label: "둘의 자리",
          text: "하나와 준호는 15:10에 음악실에 없었다. 한 명은 하린이다.",
          claim: {
            kind: "all",
            of: [
              { kind: "notAt", who: "hana", place: "music", time: 1 },
              { kind: "notAt", who: "junho", place: "music", time: 1 },
              { kind: "at", who: "harin", place: "music", time: 1 },
            ],
          },
        },
      },
    ],
  },
  hints: [
    {
      text: "열쇠 대장은 15:00의 기록이라, 15:10에 누가 음악실에 있었는지 말해 주지 않습니다. 15:10의 기록 두 개를 보세요. 한곳에서 같이 서명한 두 사람이 있습니다.",
      facts: [{ kind: "consistent", a: "say-hana", b: "key" }],
    },
    {
      text: "음악실 안에 있던 사람은 한 명뿐입니다. 같이 있던 두 사람이 음악실에 있었다면 두 명이 되어 버립니다. 청소 점검표와 문 계수기를 이어 보세요.",
      facts: [{ kind: "derives", from: ["duty", "counter"], card: "fact-pair" }],
    },
  ],
  explanation: [
    {
      text: "청소 점검표: 15:10에 하나와 준호는 한곳에 있었습니다. 문 계수기: 그때 음악실에는 한 명뿐이었습니다. 두 사람이 음악실에 있었다면 두 명이 되므로, 둘을 이으면 하나와 준호는 15:10에 음악실에 없었습니다. 학원에는 세 사람뿐이었으니 음악실의 한 명은 하린입니다.",
      facts: [{ kind: "derives", from: ["duty", "counter"], card: "fact-pair" }],
    },
    {
      text: "열쇠 대장은 15:00의 기록입니다. 하나가 15:00에 음악실에 들어간 것은 맞지만, 15:10에도 거기 있었다는 뜻은 아닙니다. 열쇠 대장만으로는 누구의 말도 깨지지 않습니다.",
      facts: [{ kind: "consistent", a: "say-hana", b: "key" }],
    },
    {
      text: "준호와 하린의 말은 기록과 어긋나지 않습니다. 하린의 말은 방금 얻은 사실과 같습니다.",
      facts: [
        { kind: "statementHolds", statement: "say-junho" },
        { kind: "statementHolds", statement: "say-harin" },
      ],
    },
    {
      text: "하나는 15:10에 음악실에 있었다고 했습니다. 그때 하나는 음악실에 없었으므로 함께 성립할 수 없습니다. 기록과 맞지 않는 것은 하나의 진술입니다.",
      facts: [{ kind: "contradicts", a: "say-hana", b: "fact-pair" }],
    },
  ],
  solution: { statement: "say-hana", against: "fact-pair" },
  reward: 0,
};

/* ───────── 연습 B · 전체 인원에서 빼기 ─────────
 * 푸는 길: 네 사람 가운데 도서관에 둘, 기숙사에 하나였으니 종탑에는 하나뿐이다(첫 번째 잇기: 인원 + 인원 → 인원).
 * 그 한 사람이 세라라는 기록과 이으면 종탑에는 세라 혼자였다(두 번째 잇기).
 * 그러면 "세라와 같이 있었다"는 말이 무너진다. 거짓말은 자기 자리가 아니라 누구와 있었는지에 대한 것이다.
 * 함정: 종탑 순찰 일지의 "두 명"은 21:20의 인원이다. 21:10의 일을 말해 주지 않는다.
 */
export const PRACTICE_EVIDENCE_B: EvidencePuzzle = {
  id: "practice-evidence-b",
  type: "evidence",
  category: "practice",
  title: "열려 있던 사감실 서랍",
  typeLabel: TYPE_LABEL,
  difficulty: 4,
  rank: "B",
  minutes: 4,
  intro: "기숙사 사감실의 서랍이 열려 있었다. 21시 10분의 일이다.",
  description:
    "그 시간 학원에는 네 사람뿐이었고, 있을 수 있던 곳은 종탑, 도서관, 기숙사뿐입니다. 진술 하나는 기록과 맞지 않습니다. 두 번 이어야 그것을 깨는 증거가 나옵니다.",
  outro: "하린의 말이 무너졌다. 21:10, 종탑에는 세라 혼자였다.",
  rules: {
    people: [sera, daon, doyun, harin],
    places: [
      { id: "tower", name: "종탑" },
      { id: "library", name: "도서관" },
      { id: "dorm", name: "기숙사" },
    ],
    times: ["21:10", "21:20"],
    cards: [
      {
        id: "seats",
        kind: "log",
        label: "좌석 기록",
        text: "21:10 도서관 좌석 기록: 앉아 있던 사람은 두 명.",
        claim: { kind: "count", place: "library", time: 0, count: 2 },
      },
      {
        id: "rollcall",
        kind: "time",
        label: "기숙사 점호",
        text: "21:10 기숙사 점호: 건물 안에 있던 사람은 한 명.",
        claim: { kind: "count", place: "dorm", time: 0, count: 1 },
      },
      {
        id: "towerlog",
        kind: "log",
        label: "종탑 출입",
        text: "21:10 종탑 출입 기록: 세라가 올라가 있었다.",
        claim: { kind: "at", who: "sera", place: "tower", time: 0 },
      },
      {
        id: "later",
        kind: "time",
        label: "종탑 순찰",
        text: "21:20 종탑 순찰 일지: 종탑에 있던 사람은 두 명.",
        claim: { kind: "count", place: "tower", time: 1, count: 2 },
      },
      {
        id: "say-sera",
        kind: "statement",
        speaker: "sera",
        label: "세라의 진술",
        text: "21:10에 나는 종탑에서 종을 닦고 있었어.",
        claim: { kind: "at", who: "sera", place: "tower", time: 0 },
      },
      {
        id: "say-daon",
        kind: "statement",
        speaker: "daon",
        label: "다온의 진술",
        text: "21:10에 나는 도서관에 있었어.",
        claim: { kind: "at", who: "daon", place: "library", time: 0 },
      },
      {
        id: "say-doyun",
        kind: "statement",
        speaker: "doyun",
        label: "도윤의 진술",
        text: "21:10부터 21:20까지 줄곧 도서관에 있었어.",
        claim: { kind: "stayed", who: "doyun", place: "library", from: 0, to: 1 },
      },
      {
        id: "say-harin",
        kind: "statement",
        speaker: "harin",
        label: "하린의 진술",
        text: "21:10에 나는 세라와 같이 있었어. 종탑엔 둘이었잖아.",
        claim: { kind: "together", a: "harin", b: "sera", time: 0 },
      },
    ],
    derivations: [
      {
        from: ["seats", "rollcall"],
        card: {
          id: "fact-one",
          kind: "derived",
          label: "종탑의 수",
          text: "21:10에 종탑에 있던 사람은 한 명뿐이다.",
          claim: { kind: "count", place: "tower", time: 0, count: 1 },
        },
      },
      {
        from: ["fact-one", "towerlog"],
        card: {
          id: "fact-alone",
          kind: "derived",
          label: "종탑의 세라",
          text: "21:10에 종탑에는 세라 혼자 있었다.",
          claim: { kind: "alone", who: "sera", place: "tower", time: 0 },
        },
      },
    ],
  },
  hints: [
    {
      text: "종탑 순찰 일지는 21:20의 기록이라, 21:10에 종탑에 몇 명이 있었는지 말해 주지 않습니다. 그 시간 학원에는 네 사람뿐이었습니다. 21:10에 도서관과 기숙사에 있던 사람의 수를 더해 보세요.",
      facts: [{ kind: "consistent", a: "say-harin", b: "later" }],
    },
    {
      text: "도서관에 두 명, 기숙사에 한 명이면 종탑에 남는 사람의 수가 정해집니다. 좌석 기록과 점호를 이어 얻은 사실을, 종탑에 누가 있었는지 말해 주는 기록과 한 번 더 이어 보세요.",
      facts: [{ kind: "derives", from: ["seats", "rollcall"], card: "fact-one" }],
    },
  ],
  explanation: [
    {
      text: "그 시간 학원에는 네 사람뿐이었습니다. 좌석 기록: 21:10에 도서관에 두 명. 점호: 그때 기숙사에 한 명. 둘을 이으면 21:10에 종탑에 있던 사람은 한 명뿐입니다.",
      facts: [{ kind: "derives", from: ["seats", "rollcall"], card: "fact-one" }],
    },
    {
      text: "종탑 출입 기록에 따르면 21:10에 세라가 종탑에 있었습니다. 종탑에는 한 명뿐이었으므로, 그때 종탑에는 세라 혼자였습니다.",
      facts: [{ kind: "derives", from: ["fact-one", "towerlog"], card: "fact-alone" }],
    },
    {
      text: "종탑 순찰 일지의 두 명은 21:20의 인원입니다. 21:10의 일을 말해 주지 않아, 그것만으로는 누구의 말도 깨지지 않습니다. 세라, 다온, 도윤의 말은 기록과 어긋나지 않습니다.",
      facts: [
        { kind: "consistent", a: "say-harin", b: "later" },
        { kind: "statementHolds", statement: "say-sera" },
        { kind: "statementHolds", statement: "say-daon" },
        { kind: "statementHolds", statement: "say-doyun" },
      ],
    },
    {
      text: "하린은 21:10에 세라와 같이 있었다고 했습니다. 그때 세라는 종탑에 혼자였으므로 함께 성립할 수 없습니다. 기록과 맞지 않는 것은 하린의 진술입니다.",
      facts: [{ kind: "contradicts", a: "say-harin", b: "fact-alone" }],
    },
  ],
  solution: { statement: "say-harin", against: "fact-alone" },
  reward: 45,
};

/* 연습 A 의 두 사실. 같은 사실에 이르는 길이 둘이라(되돌아가는 길) 잇기 표에 두 번 적힌다. */
const FACT_HANA: EvidenceCard = {
  id: "fact-hana",
  kind: "derived",
  label: "머리끈의 때",
  text: "하나는 18:00에 주방에 있었다.",
  claim: { kind: "at", who: "hana", place: "kitchen", time: 0 },
};

const FACT_SEA: EvidenceCard = {
  id: "fact-sea",
  kind: "derived",
  label: "세아의 자리",
  text: "세아는 18:00에 주방에 있었다.",
  claim: { kind: "at", who: "sea", place: "kitchen", time: 0 },
};

/* ───────── 연습 A · 세 번 잇기 ─────────
 * 푸는 길: 네 사람 가운데 식당에 셋, 민재는 기숙사였으니 식당의 셋은 하나·준호·세아다(인원수로 자리 채우기).
 * 하나의 머리끈은 18:10에 주방에서 나왔는데 하나는 18:10에 식당에 있었으니, 주방에 있던 때는 18:00이다(물건의 때).
 * 18:00에 하나와 세아는 한곳에서 일했으니 세아도 18:00에 주방에 있었다(같이 있던 사람).
 * 앞에서 얻은 사실이 있어야 다음 것이 나온다. 어느 하나도 건너뛸 수 없다.
 * 함정: 준호의 앞치마는 18:20에 발견돼, 식당에 있던 18:10을 지워도 때가 정해지지 않는다(18:00 또는 18:20).
 */
export const PRACTICE_EVIDENCE_A: EvidencePuzzle = {
  id: "practice-evidence-a",
  type: "evidence",
  category: "practice",
  title: "비어 버린 꿀단지",
  typeLabel: TYPE_LABEL,
  difficulty: 5,
  rank: "A",
  minutes: 6,
  intro: "주방 저장고의 꿀단지가 비어 있었다. 18시부터 18시 20분 사이의 일이다.",
  description:
    "그 시간 학원에는 네 사람뿐이었습니다. 진술 하나는 기록과 맞지 않습니다. 이어 얻은 사실을 거듭 이어 가야 그것을 깨는 증거가 나옵니다.",
  outro: "세아의 말이 무너졌다. 18:00, 세아는 하나와 함께 주방에 있었다.",
  rules: {
    people: [hana, junho, sea, minjae],
    places: [
      { id: "dining", name: "식당" },
      { id: "dorm", name: "기숙사" },
      { id: "kitchen", name: "주방" },
    ],
    times: ["18:00", "18:10", "18:20"],
    cards: [
      {
        id: "meal",
        kind: "log",
        label: "식권 기록",
        text: "18:10 식당 식권 기록: 식당에 있던 사람은 세 명.",
        claim: { kind: "count", place: "dining", time: 1, count: 3 },
      },
      {
        id: "rollcall",
        kind: "time",
        label: "기숙사 점호",
        text: "18:10 기숙사 점호: 민재는 방에 있었다.",
        claim: { kind: "at", who: "minjae", place: "dorm", time: 1 },
      },
      {
        id: "band",
        kind: "object",
        label: "머리끈",
        text: "18:10, 주방 저장고 앞에서 하나의 머리끈이 나왔다.",
        claim: { kind: "visited", who: "hana", place: "kitchen", until: 1 },
      },
      {
        id: "duty",
        kind: "log",
        label: "당번표",
        text: "18:00 당번표: 하나와 세아가 한곳에서 일했다.",
        claim: { kind: "together", a: "hana", b: "sea", time: 0 },
      },
      {
        id: "apron",
        kind: "object",
        label: "앞치마",
        text: "18:20, 주방 개수대에서 준호의 앞치마가 나왔다.",
        claim: { kind: "visited", who: "junho", place: "kitchen", until: 2 },
      },
      {
        id: "say-hana",
        kind: "statement",
        speaker: "hana",
        label: "하나의 진술",
        text: "18:10에 나는 식당에서 밥을 먹고 있었어.",
        claim: { kind: "at", who: "hana", place: "dining", time: 1 },
      },
      {
        id: "say-junho",
        kind: "statement",
        speaker: "junho",
        label: "준호의 진술",
        text: "18:00에는 기숙사에 있었어. 앞치마는 나중 일이야.",
        claim: { kind: "at", who: "junho", place: "dorm", time: 0 },
      },
      {
        id: "say-sea",
        kind: "statement",
        speaker: "sea",
        label: "세아의 진술",
        text: "18:00에 나는 기숙사에 있었어. 주방엔 안 갔어.",
        claim: { kind: "at", who: "sea", place: "dorm", time: 0 },
      },
      {
        id: "say-minjae",
        kind: "statement",
        speaker: "minjae",
        label: "민재의 진술",
        text: "18:10에 나는 기숙사 방에 있었어.",
        claim: { kind: "at", who: "minjae", place: "dorm", time: 1 },
      },
    ],
    derivations: [
      {
        from: ["meal", "rollcall"],
        card: {
          id: "fact-three",
          kind: "derived",
          label: "식당의 셋",
          text: "18:10에 하나, 준호, 세아는 식당에 있었다.",
          claim: {
            kind: "all",
            of: [
              { kind: "at", who: "hana", place: "dining", time: 1 },
              { kind: "at", who: "junho", place: "dining", time: 1 },
              { kind: "at", who: "sea", place: "dining", time: 1 },
            ],
          },
        },
      },
      {
        from: ["fact-three", "band"],
        card: FACT_HANA,
      },
      {
        from: ["fact-hana", "duty"],
        card: FACT_SEA,
      },
      // 되돌아가는 길: 세아의 자리와 당번표를 이으면 이미 얻은 하나의 자리가 다시 나온다
      {
        from: ["fact-sea", "duty"],
        card: FACT_HANA,
      },
    ],
  },
  hints: [
    {
      text: "앞치마는 18:20에 발견됐습니다. 준호가 주방에 간 때는 18:00일 수도 18:20일 수도 있어, 누구의 말도 깨지 못합니다. 머리끈은 다릅니다. 18:10에 하나가 어디 있었는지 알면 주방에 있던 때가 하나로 정해집니다.",
      facts: [{ kind: "consistent", a: "say-junho", b: "apron" }],
    },
    {
      text: "그 시간 학원에는 네 사람뿐이었습니다. 식권 기록과 점호를 이으면 식당의 세 명이 누구인지 나옵니다. 그 사실을 머리끈과 잇고, 거기서 나온 사실을 당번표와 한 번 더 이어 보세요.",
      facts: [{ kind: "derives", from: ["meal", "rollcall"], card: "fact-three" }],
    },
  ],
  explanation: [
    {
      text: "그 시간 학원에는 네 사람뿐이었습니다. 식권 기록: 18:10에 식당에 세 명. 점호: 그때 민재는 기숙사에 있었습니다. 둘을 이으면 식당의 세 명은 하나, 준호, 세아입니다.",
      facts: [{ kind: "derives", from: ["meal", "rollcall"], card: "fact-three" }],
    },
    {
      text: "머리끈은 18:10에 주방에서 나왔으므로 하나는 18:00이나 18:10에 주방에 있었습니다. 18:10에는 식당에 있었으니, 하나가 주방에 있던 때는 18:00입니다.",
      facts: [{ kind: "derives", from: ["fact-three", "band"], card: "fact-hana" }],
    },
    {
      text: "당번표: 18:00에 하나와 세아는 한곳에서 일했습니다. 그때 하나가 주방에 있었으므로 세아도 18:00에 주방에 있었습니다.",
      facts: [{ kind: "derives", from: ["fact-hana", "duty"], card: "fact-sea" }],
    },
    {
      text: "준호의 앞치마는 18:20에 발견됐습니다. 18:10을 지워도 18:00과 18:20이 남아, 18:00에 기숙사에 있었다는 말과 어긋나지 않습니다. 하나와 민재의 말도 기록과 맞습니다.",
      facts: [
        { kind: "consistent", a: "say-junho", b: "apron" },
        { kind: "statementHolds", statement: "say-junho" },
        { kind: "statementHolds", statement: "say-hana" },
        { kind: "statementHolds", statement: "say-minjae" },
      ],
    },
    {
      text: "세아는 18:00에 기숙사에 있었다고 했습니다. 그때 세아는 주방에 있었으므로 함께 성립할 수 없습니다. 기록과 맞지 않는 것은 세아의 진술입니다.",
      facts: [{ kind: "contradicts", a: "say-sea", b: "fact-sea" }],
    },
  ],
  solution: { statement: "say-sea", against: "fact-sea" },
  reward: 50,
};

/* ───────── 시험 A→S · 둘은 될 수 있어도 셋은 안 된다 ─────────
 * 푸는 길: 천문대에는 두 명이 있었다. 같이 서명한 준호와 세라 둘이라면 그 두 명일 수 있어, 그것만으로는 아무것도 나오지 않는다.
 * 순찰 서명과 사진을 먼저 이어 "준호·세라·다온 셋이 한곳에 있었다"를 얻어야 한다(첫 번째 잇기: 함께 + 함께 → 셋).
 * 셋은 두 명뿐인 천문대에 있을 수 없다. 다섯 사람뿐이니 천문대의 둘은 도윤과 하린이다(두 번째 잇기).
 * 모순처럼 보이지만 성립하는 진술이 둘:
 *   다온 "23:10에 도서관 앞에 있었다" — 장갑이 23:10에 천문대에서 나왔지만, 23:00에 두고 온 것이다.
 *   도윤 "23:00에 기숙사에 있었다" — 천문대에 있었다는 사실은 23:10의 일이다.
 * 진술하지 않는 사람(세라)이 기록에만 나온다. 시각은 둘뿐이다.
 */
export const EXAM_EVIDENCE_A_S: EvidencePuzzle = {
  id: "exam-evidence-a-s",
  type: "evidence",
  category: "exam",
  title: "금서 서가의 뜯긴 자물쇠",
  typeLabel: TYPE_LABEL,
  difficulty: 5,
  rank: "A",
  minutes: 5,
  intro: "도서관 금서 서가의 자물쇠가 뜯겨 있었다. 23시 10분의 일이다.",
  description:
    "그 시간 학원에는 준호, 세라, 다온, 도윤, 하린 다섯 사람뿐이었습니다. 진술 하나는 기록과 맞지 않습니다. 두 번 이어야 그것을 깨는 증거가 나옵니다.",
  outro: "준호의 말이 무너졌다. 23:10, 천문대의 두 사람은 도윤과 하린이었다.",
  rules: {
    people: [junho, sera, daon, doyun, harin],
    places: [
      { id: "observatory", name: "천문대" },
      { id: "library", name: "도서관" },
      { id: "dorm", name: "기숙사" },
    ],
    times: ["23:00", "23:10"],
    cards: [
      {
        id: "patrol",
        kind: "log",
        label: "순찰 서명",
        text: "23:10 순찰 서명: 준호와 세라가 한곳에서 서명했다.",
        claim: { kind: "together", a: "junho", b: "sera", time: 1 },
      },
      {
        id: "photo",
        kind: "time",
        label: "찍힌 사진",
        text: "23:10에 찍힌 사진: 세라와 다온이 나란히 서 있다.",
        claim: { kind: "together", a: "sera", b: "daon", time: 1 },
      },
      {
        id: "scope",
        kind: "log",
        label: "관측 일지",
        text: "23:10 천문대 관측 일지: 망원경 앞에 두 명.",
        claim: { kind: "count", place: "observatory", time: 1, count: 2 },
      },
      {
        id: "glove",
        kind: "object",
        label: "장갑",
        text: "23:10, 천문대 난간에서 다온의 장갑이 나왔다.",
        claim: { kind: "visited", who: "daon", place: "observatory", until: 1 },
      },
      {
        id: "say-junho",
        kind: "statement",
        speaker: "junho",
        label: "준호의 진술",
        text: "23:10에 나는 천문대에서 별을 보고 있었어.",
        claim: { kind: "at", who: "junho", place: "observatory", time: 1 },
      },
      {
        id: "say-daon",
        kind: "statement",
        speaker: "daon",
        label: "다온의 진술",
        text: "23:10에 나는 도서관 앞에 있었어.",
        claim: { kind: "at", who: "daon", place: "library", time: 1 },
      },
      {
        id: "say-doyun",
        kind: "statement",
        speaker: "doyun",
        label: "도윤의 진술",
        text: "23:00에 나는 기숙사에 있었어.",
        claim: { kind: "at", who: "doyun", place: "dorm", time: 0 },
      },
      {
        id: "say-harin",
        kind: "statement",
        speaker: "harin",
        label: "하린의 진술",
        text: "23:10에 나는 도윤과 같이 있었어.",
        claim: { kind: "together", a: "harin", b: "doyun", time: 1 },
      },
    ],
    derivations: [
      {
        from: ["patrol", "photo"],
        card: {
          id: "fact-trio",
          kind: "derived",
          label: "함께한 셋",
          text: "23:10에 준호, 세라, 다온은 한곳에 있었다.",
          claim: {
            kind: "all",
            of: [
              { kind: "together", a: "junho", b: "sera", time: 1 },
              { kind: "together", a: "sera", b: "daon", time: 1 },
            ],
          },
        },
      },
      {
        from: ["fact-trio", "scope"],
        card: {
          id: "fact-away",
          kind: "derived",
          label: "천문대의 둘",
          text: "셋은 23:10에 천문대에 없었다. 둘은 도윤과 하린이다.",
          claim: {
            kind: "all",
            of: [
              { kind: "notAt", who: "junho", place: "observatory", time: 1 },
              { kind: "notAt", who: "sera", place: "observatory", time: 1 },
              { kind: "notAt", who: "daon", place: "observatory", time: 1 },
              { kind: "at", who: "doyun", place: "observatory", time: 1 },
              { kind: "at", who: "harin", place: "observatory", time: 1 },
            ],
          },
        },
      },
      {
        from: ["fact-away", "glove"],
        card: {
          id: "fact-daon",
          kind: "derived",
          label: "장갑의 때",
          text: "다온은 23:00에 천문대에 있었다.",
          claim: { kind: "at", who: "daon", place: "observatory", time: 0 },
        },
      },
    ],
  },
  hints: [],
  explanation: [
    {
      text: "순찰 서명: 23:10에 준호와 세라는 한곳에 있었습니다. 사진: 그때 세라와 다온도 한곳에 있었습니다. 둘을 이으면 23:10에 준호, 세라, 다온 세 사람은 한곳에 있었습니다.",
      facts: [{ kind: "derives", from: ["patrol", "photo"], card: "fact-trio" }],
    },
    {
      text: "순찰 서명만으로는 준호의 말이 깨지지 않습니다. 준호와 세라 둘이라면 천문대의 두 명일 수 있기 때문입니다. 관측 일지 하나만으로도 마찬가지입니다.",
      facts: [
        { kind: "consistent", a: "say-junho", b: "patrol" },
        { kind: "consistent", a: "say-junho", b: "scope" },
      ],
    },
    {
      text: "관측 일지: 23:10에 천문대에는 두 명뿐이었습니다. 한곳에 있던 세 사람은 천문대에 있을 수 없습니다. 학원에는 다섯 사람뿐이었으므로 천문대의 두 명은 도윤과 하린입니다.",
      facts: [{ kind: "derives", from: ["fact-trio", "scope"], card: "fact-away" }],
    },
    {
      text: "다온의 장갑은 23:10에 천문대에서 나왔지만, 그때 다온은 천문대에 없었습니다. 장갑은 23:00에 두고 온 것입니다. 23:10에 도서관 앞에 있었다는 다온의 말과 어긋나지 않습니다.",
      facts: [
        { kind: "derives", from: ["fact-away", "glove"], card: "fact-daon" },
        { kind: "consistent", a: "say-daon", b: "glove" },
        { kind: "statementHolds", statement: "say-daon" },
      ],
    },
    {
      text: "도윤의 말은 23:00의 일이라, 23:10에 천문대에 있었다는 사실과 어긋나지 않습니다. 하린의 말도 기록과 맞습니다.",
      facts: [
        { kind: "consistent", a: "say-doyun", b: "fact-away" },
        { kind: "statementHolds", statement: "say-doyun" },
        { kind: "statementHolds", statement: "say-harin" },
      ],
    },
    {
      text: "준호는 23:10에 천문대에 있었다고 했습니다. 그때 준호는 천문대에 없었으므로 함께 성립할 수 없습니다. 기록과 맞지 않는 것은 준호의 진술입니다.",
      facts: [{ kind: "contradicts", a: "say-junho", b: "fact-away" }],
    },
  ],
  solution: { statement: "say-junho", against: "fact-away" },
  reward: 0,
};

/** 표의 순서: 연습 D → 시험 C→B → 연습 B → 연습 A → 시험 A→S */
export const EVIDENCE_SET: EvidencePuzzle[] = [
  PRACTICE_EVIDENCE_D,
  EXAM_EVIDENCE_C_B,
  PRACTICE_EVIDENCE_B,
  PRACTICE_EVIDENCE_A,
  EXAM_EVIDENCE_A_S,
];
