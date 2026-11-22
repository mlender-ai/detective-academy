/**
 * 일일 문제 7개 (V3 GATE 04).
 *
 * 새 유형 둘(증거 조합, 인장 대조)과 기존 유형 셋을 섞어 일주일치를 지었다.
 * 아직 날짜에 배정하지 않았다(GATE 05 의 일). 지금은 QA 주소의 ?day=1~7 로만 오늘의 추리 자리에 놓인다.
 *
 * solution 은 개발·검증용이다. 화면에는 플레이어가 해결한 뒤에만 노출한다.
 * 정답이 하나뿐인지, 힌트와 해설이 규칙과 맞는지는 src/tests/dailySet.test.ts 가 전수 탐색으로 확인한다.
 */
import type { CodePuzzle, EvidencePuzzle, Puzzle, SchedulePuzzle, SpatialPuzzle, TruthPuzzle } from "../engine/types";
import { daon, doyun, hana, harin, junho, minjae, sea, sera } from "./people";

/* ───────── 1일차 · 증거 조합 ───────── */

export const DAILY_EVIDENCE_1: EvidencePuzzle = {
  id: "daily-evidence-001",
  type: "evidence",
  category: "daily",
  title: "사라진 자료실 열쇠",
  typeLabel: "증거 조합",
  difficulty: 2,
  rank: "F",
  minutes: 3,
  intro: "교무실 열쇠함에서 자료실 열쇠가 사라졌다. 15시부터 15시 20분 사이의 일이다.",
  description:
    "세 사람의 진술 가운데 하나는 기록과 맞지 않습니다. 증거 두 개를 이어 새 사실을 찾고, 거짓 진술과 그것을 깨는 증거를 짝지어 제출하세요.",
  outro: "세라의 말이 무너졌다. 15:10, 세라는 도서관이 아니라 교무실 앞 복도에 있었다.",
  rules: {
    people: [hana, junho, sera],
    places: [
      { id: "office", name: "교무실" },
      { id: "library", name: "도서관" },
      { id: "hall", name: "복도" },
    ],
    times: ["15:00", "15:10", "15:20"],
    cards: [
      {
        id: "roster",
        kind: "log",
        label: "조별 출석부",
        text: "15:10 조별 활동 출석부에 하나와 세라가 나란히 서명했다. 그때 두 사람은 같은 곳에 있었다.",
        claim: { kind: "together", a: "hana", b: "sera", time: 1 },
      },
      {
        id: "photo",
        kind: "time",
        label: "복도 사진",
        text: "복도 게시판 앞에서 찍힌 사진. 찍힌 시각은 15:10이고, 하나가 서 있다.",
        claim: { kind: "at", who: "hana", place: "hall", time: 1 },
      },
      {
        id: "case",
        kind: "object",
        label: "떨어진 필통",
        text: "15:20, 교무실 열쇠함 아래에서 준호의 필통이 나왔다.",
        claim: { kind: "visited", who: "junho", place: "office", until: 2 },
      },
      {
        id: "gate",
        kind: "log",
        label: "도서관 출입 기록",
        text: "15:00 도서관 출입 카드: 세라 입실.",
        claim: { kind: "at", who: "sera", place: "library", time: 0 },
      },
      {
        id: "say-hana",
        kind: "statement",
        speaker: "hana",
        label: "하나의 진술",
        text: "15:10에 나는 복도에 있었어. 게시판을 보고 있었거든.",
        claim: { kind: "at", who: "hana", place: "hall", time: 1 },
      },
      {
        id: "say-junho",
        kind: "statement",
        speaker: "junho",
        label: "준호의 진술",
        text: "15:20에 나는 도서관에 있었어. 필통은 그 전에 흘린 거야.",
        claim: { kind: "at", who: "junho", place: "library", time: 2 },
      },
      {
        id: "say-sera",
        kind: "statement",
        speaker: "sera",
        label: "세라의 진술",
        text: "나는 15:00부터 15:10까지 줄곧 도서관에 있었어.",
        claim: { kind: "stayed", who: "sera", place: "library", from: 0, to: 1 },
      },
    ],
    derivations: [
      {
        from: ["roster", "photo"],
        card: {
          id: "fact-sera",
          kind: "derived",
          label: "세라의 15:10",
          text: "세라는 15:10에 복도에 있었다.",
          claim: { kind: "at", who: "sera", place: "hall", time: 1 },
        },
      },
    ],
  },
  hints: [
    {
      text: "떨어진 필통은 준호의 말과 어긋나지 않습니다. 15:20에 발견됐을 뿐, 그보다 앞서 흘렸을 수 있으니까요. 기록 하나만으로는 누구의 말도 깨지지 않습니다. 같은 사람이 나오는 기록 두 개를 먼저 이어 보세요.",
      facts: [{ kind: "consistent", a: "say-junho", b: "case" }],
    },
    {
      text: "조별 출석부와 복도 사진을 이으면 15:10에 세라가 있던 곳이 나옵니다. 그 사실을 세 사람의 진술과 하나씩 맞대어 보세요.",
      facts: [{ kind: "derives", from: ["roster", "photo"], card: "fact-sera" }],
    },
  ],
  explanation: [
    {
      text: "조별 출석부: 15:10에 하나와 세라는 같은 곳에 있었습니다. 복도 사진: 그때 하나는 복도에 있었습니다. 둘을 이으면 세라도 15:10에 복도에 있었습니다.",
      facts: [{ kind: "derives", from: ["roster", "photo"], card: "fact-sera" }],
    },
    {
      text: "하나는 15:10에 복도에 있었다고 했고, 사진과 맞습니다.",
      facts: [{ kind: "statementHolds", statement: "say-hana" }],
    },
    {
      text: "준호의 필통은 15:20에 발견됐을 뿐, 언제 떨어졌는지는 알 수 없습니다. 15:20에 도서관에 있었다는 말과 어긋나지 않습니다.",
      facts: [
        { kind: "consistent", a: "say-junho", b: "case" },
        { kind: "statementHolds", statement: "say-junho" },
      ],
    },
    {
      text: "세라는 15:00부터 15:10까지 줄곧 도서관에 있었다고 했습니다. 15:10에 복도에 있었다는 사실과 함께 성립할 수 없습니다. 기록과 맞지 않는 것은 세라의 진술입니다.",
      facts: [{ kind: "contradicts", a: "say-sera", b: "fact-sera" }],
    },
  ],
  solution: { statement: "say-sera", against: "fact-sera" },
  reward: 100,
};

/* ───────── 2일차 · 공간 추론(인장 대조) ───────── */

export const DAILY_SEAL_1: SpatialPuzzle = {
  id: "daily-seal-001",
  type: "spatial",
  category: "daily",
  title: "추천서의 인장",
  typeLabel: "공간 추론 · 인장 대조",
  difficulty: 2,
  rank: "F",
  minutes: 3,
  intro: "학원장 추천서 한 장이 가짜로 의심된다. 종이에는 열쇠 무늬 인장이, 책상에는 학원 안의 도장 넷이 있다.",
  description:
    "도장을 찍으면 자국은 좌우가 뒤집힙니다. 도장을 돌려 보며 자국을 낸 도장과 방향을 찾으세요. 시험 종이는 세 장뿐입니다.",
  outro: "자국은 서기실 도장의 것이다. 추천서는 학원장실이 아니라 서기실에서 찍혔다.",
  rules: {
    size: 5,
    imprint: [".....", "#..#.", "###.#", "..#.#", "...#."],
    trials: 3,
    stamps: [
      { id: "office", name: "교무실 도장", face: [".....", ".#.#.", "#.###", "#.#..", ".#..."] },
      { id: "archive", name: "자료실 도장", face: ["..##.", ".#..#", "..##.", "..#..", ".##.."] },
      { id: "clerk", name: "서기실 도장", face: ["...#.", "..#.#", "###.#", "#..#.", "....."] },
      { id: "dorm", name: "기숙사 도장", face: ["..##.", "..#..", "..##.", ".#..#", "..##."] },
    ],
  },
  hints: [
    {
      text: "도장 면과 자국은 거울에 비친 사이입니다. 도장 면에서 왼쪽에 있는 점은 자국에서는 오른쪽에 찍힙니다. 그래서 돌려 보았을 때 자국과 똑같아 보이는 도장은 오히려 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "archive" }],
    },
    {
      text: "무늬는 고리에 자루가 달린 열쇠입니다. 자국에서 톱니는 자루의 맨 끝에 붙어 있습니다. 톱니가 자루 중간에 달린 도장은 어느 방향으로 찍어도 맞지 않습니다.",
      facts: [{ kind: "stampIsNot", stamp: "office" }],
    },
  ],
  explanation: [
    {
      text: "도장을 찍으면 좌우가 뒤집힙니다. 자료실 도장은 돌려 보면 자국과 똑같아 보이지만, 찍으면 뒤집힌 무늬가 나오므로 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "archive" }],
    },
    {
      text: "교무실 도장은 톱니가 자루 중간에 달려 있습니다. 자국의 톱니는 자루 끝에 있으므로 어느 방향으로 찍어도 맞지 않습니다.",
      facts: [{ kind: "stampIsNot", stamp: "office" }],
    },
    {
      text: "남은 둘은 톱니가 자루 끝에 있습니다. 자국을 고리가 위로 오게 놓으면 톱니는 자루의 왼쪽에 있습니다. 뒤집히기 전인 도장 면에서는 오른쪽이어야 하는데, 기숙사 도장은 고리를 위로 놓았을 때 톱니가 왼쪽에 있습니다.",
      facts: [{ kind: "stampIsNot", stamp: "dorm" }],
    },
    {
      text: "서기실 도장을 두 번 돌려 찍으면 자국과 정확히 겹칩니다.",
      facts: [
        { kind: "turnIsNot", turn: 0 },
        { kind: "turnIsNot", turn: 1 },
        { kind: "turnIsNot", turn: 3 },
      ],
    },
  ],
  solution: { stamp: "clerk", turn: 2 },
  reward: 100,
};

/* ───────── 3일차 · 암호 해독 ───────── */

export const DAILY_CODE_2: CodePuzzle = {
  id: "daily-code-002",
  type: "code",
  category: "daily",
  title: "다시 잠긴 금고",
  typeLabel: "조건 추론 · 암호 해독",
  difficulty: 3,
  rank: "F",
  minutes: 4,
  intro: "자료실. 금고가 다시 잠겨 있다. 책상 위에는 새 기록이 놓여 있다.",
  description:
    "누군가 자료실 금고의 암호를 바꿔 놓았습니다. 1부터 9까지 서로 다른 숫자 3개입니다. 새로 시도한 네 번의 기록을 단서로 암호를 찾아내세요.",
  outro: "철컥. 금고가 열렸다. 출입 기록부에서 찢겨 나간 한 장이 들어 있다.",
  rules: {
    length: 3,
    digits: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    clues: [
      { guess: [1, 2, 3], match: 1, inPlace: 0 },
      { guess: [4, 5, 6], match: 1, inPlace: 0 },
      { guess: [1, 8, 5], match: 2, inPlace: 1 },
      { guess: [3, 7, 8], match: 2, inPlace: 0 },
    ],
  },
  hints: [
    {
      text: "123과 456에서는 숫자가 하나씩만 맞습니다. 암호는 세 자리이므로, 남은 한 자리는 7, 8, 9 가운데 하나입니다.",
      facts: [],
    },
    {
      text: "378을 보세요. 7과 8은 함께 들어갈 수 없으니 둘 중 하나만 맞습니다. 그렇다면 3은 반드시 암호에 있습니다. 3이 놓일 수 없는 자리를 123과 378에서 지워 보세요.",
      facts: [
        { kind: "present", digit: 3 },
        { kind: "notAt", digit: 3, position: 2 },
        { kind: "notAt", digit: 3, position: 0 },
      ],
    },
  ],
  explanation: [
    {
      text: "123과 456에서는 숫자가 하나씩만 맞습니다. 암호는 세 자리이므로 나머지 한 자리는 7, 8, 9 가운데 정확히 하나입니다.",
      facts: [],
    },
    {
      text: "378은 두 숫자가 맞습니다. 7과 8은 함께 들어갈 수 없으니 둘 중 하나만 맞고, 따라서 3이 암호에 있습니다. 123에서 맞는 숫자가 3이므로 1과 2는 없습니다.",
      facts: [
        { kind: "present", digit: 3 },
        { kind: "absent", digits: [1, 2] },
      ],
    },
    {
      text: "3은 123에서 셋째 자리, 378에서 첫째 자리인데 둘 다 '위치 틀림'입니다. 3은 둘째 자리입니다.",
      facts: [{ kind: "at", digit: 3, position: 1 }],
    },
    {
      text: "185에서 1은 없으므로 맞는 두 숫자는 8과 5입니다. 4, 6, 7, 9는 암호에 없습니다.",
      facts: [
        { kind: "present", digit: 8 },
        { kind: "present", digit: 5 },
        { kind: "absent", digits: [4, 6, 7, 9] },
      ],
    },
    {
      text: "185는 하나만 위치가 맞습니다. 8은 둘째 자리에 적혀 있는데 그 자리는 3이므로, 위치가 맞는 것은 셋째 자리의 5입니다. 남은 첫째 자리가 8입니다. 암호는 835입니다.",
      facts: [
        { kind: "at", digit: 8, position: 0 },
        { kind: "at", digit: 3, position: 1 },
        { kind: "at", digit: 5, position: 2 },
      ],
    },
  ],
  solution: [8, 3, 5],
  reward: 100,
};

/* ───────── 4일차 · 진실·거짓 추리 ───────── */

export const DAILY_TRUTH_1: TruthPuzzle = {
  id: "daily-truth-001",
  type: "truth",
  category: "daily",
  title: "숨겨진 출석부",
  typeLabel: "진실·거짓 추리",
  difficulty: 3,
  rank: "F",
  minutes: 4,
  intro: "아침 조회 전, 교탁 위의 출석부가 사라졌다. 네 사람이 한마디씩 했다.",
  description:
    "네 명의 학생 중 한 명이 출석부를 숨겼습니다. 네 사람의 진술 가운데 정확히 둘만 참입니다. 출석부를 숨긴 사람은 누구일까요?",
  outro: "출석부는 민재의 사물함에서 나왔다. 숨기지 않았다던 말은 거짓이었다.",
  rules: {
    people: [doyun, minjae, sea, harin],
    item: "출석부",
    statements: [
      { speaker: "doyun", text: "민재나 세아가 숨겼다.", claim: { kind: "culpritAmong", who: ["minjae", "sea"] } },
      { speaker: "minjae", text: "나는 숨기지 않았다.", claim: { kind: "culpritIsNot", who: "minjae" } },
      { speaker: "sea", text: "하린이 숨겼다.", claim: { kind: "culpritIs", who: "harin" } },
      { speaker: "harin", text: "도윤은 숨기지 않았다.", claim: { kind: "culpritIsNot", who: "doyun" } },
    ],
    trueCount: 2,
  },
  hints: [
    {
      text: "한 사람씩 숨겼다고 가정해 보세요. 가정마다 네 진술의 참·거짓을 표시하고, 참이 정확히 둘인 경우만 남기면 됩니다.",
      facts: [],
    },
    {
      text: "세아의 진술이 참이라면 하린이 숨긴 것입니다. 그 경우 민재와 하린의 진술도 함께 참이 되어 참이 셋입니다. 즉 세아의 진술은 거짓이고, 하린은 숨기지 않았습니다.",
      facts: [
        { kind: "statementIs", speaker: "sea", value: false },
        { kind: "culpritIsNot", who: "harin" },
        { kind: "trueCountIf", culprit: "harin", count: 3 },
      ],
    },
  ],
  explanation: [
    {
      text: "하린이 숨겼다면 민재, 세아, 하린의 진술이 참입니다. 참이 3개라 조건에 맞지 않습니다.",
      facts: [{ kind: "trueCountIf", culprit: "harin", count: 3 }],
    },
    {
      text: "세아가 숨겼다면 도윤, 민재, 하린의 진술이 참입니다. 참이 3개라 맞지 않습니다.",
      facts: [{ kind: "trueCountIf", culprit: "sea", count: 3 }],
    },
    {
      text: "도윤이 숨겼다면 민재의 진술만 참입니다. 참이 1개라 맞지 않습니다.",
      facts: [{ kind: "trueCountIf", culprit: "doyun", count: 1 }],
    },
    {
      text: "민재가 숨겼다면 도윤과 하린의 진술이 참이고, 민재와 세아의 진술이 거짓입니다. 참이 정확히 2개인 경우는 이것뿐이므로 출석부를 숨긴 사람은 민재입니다.",
      facts: [
        { kind: "trueCountIf", culprit: "minjae", count: 2 },
        { kind: "statementIs", speaker: "doyun", value: true },
        { kind: "statementIs", speaker: "minjae", value: false },
      ],
    },
  ],
  solution: "minjae",
  reward: 100,
};

/* ───────── 5일차 · 증거 조합 (두 번 잇기) ───────── */

export const DAILY_EVIDENCE_2: EvidencePuzzle = {
  id: "daily-evidence-002",
  type: "evidence",
  category: "daily",
  title: "비어 있던 진열장",
  typeLabel: "증거 조합",
  difficulty: 3,
  rank: "D",
  minutes: 5,
  intro: "강당 진열장의 우승컵이 사라졌다. 16시부터 16시 20분 사이의 일이다.",
  description:
    "네 사람의 진술 가운데 하나는 기록과 맞지 않습니다. 증거를 이어 얻은 사실을 다른 증거와 한 번 더 이어야 거짓 진술을 깨는 증거가 나옵니다.",
  outro: "민재의 말이 무너졌다. 16:10, 강당에는 도윤 한 사람뿐이었다. 민재는 그 시각에 다른 곳에 있었다.",
  rules: {
    people: [doyun, minjae, sea, harin],
    places: [
      { id: "hall", name: "강당" },
      { id: "art", name: "미술실" },
      { id: "music", name: "음악실" },
    ],
    times: ["16:00", "16:10", "16:20"],
    cards: [
      {
        id: "patrol",
        kind: "time",
        label: "순찰 일지",
        text: "순찰 일지: 16:00과 16:20에 강당을 돌아보았다. 두 번 모두 강당에는 아무도 없었다.",
        claim: {
          kind: "all",
          of: [
            { kind: "empty", place: "hall", time: 0 },
            { kind: "empty", place: "hall", time: 2 },
          ],
        },
      },
      {
        id: "tag",
        kind: "object",
        label: "떨어진 이름표",
        text: "16:20, 강당 진열장 앞에서 도윤의 이름표가 나왔다.",
        claim: { kind: "visited", who: "doyun", place: "hall", until: 2 },
      },
      {
        id: "counter",
        kind: "log",
        label: "강당 출입 계수기",
        text: "강당 출입문 계수기 기록: 16:10에 강당 안에 있던 사람은 한 명.",
        claim: { kind: "count", place: "hall", time: 1, count: 1 },
      },
      {
        id: "gate",
        kind: "log",
        label: "음악실 출입 기록",
        text: "16:10 음악실 출입 카드: 하린 입실.",
        claim: { kind: "at", who: "harin", place: "music", time: 1 },
      },
      {
        id: "brush",
        kind: "object",
        label: "남겨진 붓",
        text: "16:20, 미술실 개수대에서 민재의 붓이 나왔다.",
        claim: { kind: "visited", who: "minjae", place: "art", until: 2 },
      },
      {
        id: "say-doyun",
        kind: "statement",
        speaker: "doyun",
        label: "도윤의 진술",
        text: "16:10에 강당에 들른 건 맞아. 진열장은 그때도 비어 있었어.",
        claim: { kind: "at", who: "doyun", place: "hall", time: 1 },
      },
      {
        id: "say-minjae",
        kind: "statement",
        speaker: "minjae",
        label: "민재의 진술",
        text: "16:10에는 나도 강당에 있었어. 도윤이 옆에.",
        claim: { kind: "at", who: "minjae", place: "hall", time: 1 },
      },
      {
        id: "say-sea",
        kind: "statement",
        speaker: "sea",
        label: "세아의 진술",
        text: "나는 16:00부터 16:20까지 미술실에서 그림을 그렸어.",
        claim: { kind: "stayed", who: "sea", place: "art", from: 0, to: 2 },
      },
      {
        id: "say-harin",
        kind: "statement",
        speaker: "harin",
        label: "하린의 진술",
        text: "16:10에 나는 음악실에 있었어.",
        claim: { kind: "at", who: "harin", place: "music", time: 1 },
      },
    ],
    derivations: [
      {
        from: ["patrol", "tag"],
        card: {
          id: "fact-doyun",
          kind: "derived",
          label: "도윤의 16:10",
          text: "도윤은 16:10에 강당에 있었다.",
          claim: { kind: "at", who: "doyun", place: "hall", time: 1 },
        },
      },
      {
        from: ["fact-doyun", "counter"],
        card: {
          id: "fact-alone",
          kind: "derived",
          label: "16:10의 강당",
          text: "16:10에 강당에는 도윤 혼자 있었다.",
          claim: { kind: "alone", who: "doyun", place: "hall", time: 1 },
        },
      },
    ],
  },
  hints: [
    {
      text: "이름표는 16:20에 발견됐을 뿐입니다. 도윤이 강당에 있었던 때는 16:00, 16:10, 16:20 가운데 하나입니다. 순찰 일지와 이어서 가능한 때를 줄여 보세요.",
      facts: [{ kind: "derives", from: ["patrol", "tag"], card: "fact-doyun" }],
    },
    {
      text: "계수기에 따르면 16:10에 강당에 있던 사람은 한 명뿐입니다. 그 한 명이 누구인지 알았다면 그 사실과 계수기를 이어 보세요. 남겨진 붓은 민재가 언제 미술실에 있었는지 말해 주지 않으니, 그것만으로는 누구의 말도 깨지지 않습니다.",
      facts: [
        { kind: "derives", from: ["fact-doyun", "counter"], card: "fact-alone" },
        { kind: "consistent", a: "say-minjae", b: "brush" },
      ],
    },
  ],
  explanation: [
    {
      text: "이름표 때문에 도윤은 16:20까지의 어느 때엔가 강당에 있었습니다. 순찰 일지에 따르면 16:00과 16:20에는 강당에 아무도 없었습니다. 둘을 이으면 도윤은 16:10에 강당에 있었습니다.",
      facts: [{ kind: "derives", from: ["patrol", "tag"], card: "fact-doyun" }],
    },
    {
      text: "계수기에 따르면 16:10에 강당 안에 있던 사람은 한 명입니다. 그때 도윤이 강당에 있었으므로, 16:10에 강당에는 도윤 혼자였습니다.",
      facts: [{ kind: "derives", from: ["fact-doyun", "counter"], card: "fact-alone" }],
    },
    {
      text: "도윤, 세아, 하린의 진술은 기록과 어긋나지 않습니다. 하린의 말은 음악실 출입 기록과 맞고, 도윤의 말은 방금 얻은 사실과 같습니다.",
      facts: [
        { kind: "statementHolds", statement: "say-doyun" },
        { kind: "statementHolds", statement: "say-sea" },
        { kind: "statementHolds", statement: "say-harin" },
      ],
    },
    {
      text: "민재는 16:10에 자기도 강당에 있었다고 했습니다. 그 시각 강당에는 도윤 혼자였으므로 함께 성립할 수 없습니다. 기록과 맞지 않는 것은 민재의 진술입니다.",
      facts: [{ kind: "contradicts", a: "say-minjae", b: "fact-alone" }],
    },
  ],
  solution: { statement: "say-minjae", against: "fact-alone" },
  reward: 100,
};

/* ───────── 6일차 · 순서 추론 ───────── */

export const DAILY_SCHEDULE_1: SchedulePuzzle = {
  id: "daily-schedule-001",
  type: "schedule",
  category: "daily",
  title: "찢어진 면담 순서표",
  typeLabel: "다중 조건 순서 추론",
  difficulty: 3,
  rank: "D",
  minutes: 4,
  intro: "면담 순서표가 찢어져 네 조각이 났다. 남은 메모로 순서를 다시 맞춘다.",
  description:
    "학생 네 명이 13시, 14시, 15시, 16시에 한 명씩 면담합니다. 네 조건을 모두 만족하는 면담 순서를 찾아 배치하세요.",
  outro: "순서표가 복원됐다. 첫 면담은 세라, 마지막은 하나다.",
  rules: {
    people: [hana, junho, sera, daon],
    title: "면담 순서",
    slots: [
      { label: "13시", ordinal: "첫 번째" },
      { label: "14시", ordinal: "두 번째" },
      { label: "15시", ordinal: "세 번째" },
      { label: "16시", ordinal: "네 번째" },
    ],
    constraints: [
      { kind: "notAdjacent", a: "hana", b: "junho", text: "하나와 준호는 연달아 면담하지 않는다." },
      { kind: "notAdjacent", a: "hana", b: "sera", text: "하나와 세라는 연달아 면담하지 않는다." },
      { kind: "before", a: "junho", b: "hana", text: "준호는 하나보다 먼저 면담한다." },
      { kind: "notAtSlot", who: "junho", slot: 0, text: "준호는 첫 번째 순서가 아니다." },
    ],
  },
  hints: [
    {
      text: "조건 1과 2를 함께 보세요. 하나의 바로 앞이나 바로 뒤에 올 수 있는 사람은 다온뿐입니다. 이웃이 될 수 있는 사람이 한 명뿐이라면, 하나는 양옆에 사람이 있는 가운데 자리에 설 수 없습니다.",
      facts: [{ kind: "slotAmong", who: "hana", slots: [0, 3] }],
    },
    {
      text: "하나는 맨 앞 아니면 맨 뒤입니다. 조건 3에서 준호가 하나보다 먼저이므로 하나는 맨 앞일 수 없습니다. 그리고 하나의 바로 앞자리는 다온입니다.",
      facts: [
        { kind: "slotNot", who: "hana", slot: 0 },
        { kind: "adjacent", first: "daon", second: "hana" },
      ],
    },
  ],
  explanation: [
    {
      text: "조건 1과 2에 따라 하나의 이웃이 될 수 있는 사람은 다온뿐입니다. 가운데 자리(14시, 15시)는 이웃이 둘이므로 하나는 13시 아니면 16시입니다.",
      facts: [{ kind: "slotAmong", who: "hana", slots: [0, 3] }],
    },
    {
      text: "조건 3에 따라 준호가 하나보다 먼저이므로 하나는 13시가 될 수 없습니다. 하나는 16시이고, 바로 앞인 15시는 다온입니다.",
      facts: [
        { kind: "slotIs", who: "hana", slot: 3 },
        { kind: "slotIs", who: "daon", slot: 2 },
      ],
    },
    {
      text: "남은 13시와 14시에 준호와 세라가 들어갑니다. 조건 4에 따라 준호는 첫 번째가 아니므로 세라가 13시, 준호가 14시입니다.",
      facts: [
        { kind: "slotIs", who: "sera", slot: 0 },
        { kind: "slotIs", who: "junho", slot: 1 },
      ],
    },
    {
      text: "면담 순서는 세라, 준호, 다온, 하나입니다. 하나의 이웃은 다온뿐이고 준호는 하나보다 먼저이며 첫 번째가 아닙니다.",
      facts: [
        { kind: "slotIs", who: "sera", slot: 0 },
        { kind: "slotIs", who: "junho", slot: 1 },
        { kind: "slotIs", who: "daon", slot: 2 },
        { kind: "slotIs", who: "hana", slot: 3 },
      ],
    },
  ],
  solution: ["sera", "junho", "daon", "hana"],
  reward: 100,
};

/* ───────── 7일차 · 공간 추론(번진 인장) ───────── */

export const DAILY_SEAL_2: SpatialPuzzle = {
  id: "daily-seal-002",
  type: "spatial",
  category: "daily",
  title: "다시 붙은 봉투의 인장",
  typeLabel: "공간 추론 · 인장 대조",
  difficulty: 3,
  rank: "D",
  minutes: 5,
  intro: "봉인된 서류 봉투가 한 번 뜯겼다가 다시 붙었다. 새로 찍힌 인장은 한쪽이 번져 있다.",
  description:
    "번진 칸은 어떤 모양이었는지 알 수 없습니다. 보이는 칸이 모두 맞는 도장과 방향을 찾으세요. 찍으면 좌우가 뒤집힙니다. 시험 종이는 두 장뿐입니다.",
  outro: "자국은 교감 도장의 것이다. 봉투를 다시 봉한 사람은 교감실에 드나들 수 있었다.",
  rules: {
    size: 6,
    imprint: ["#.####", "#....#", "#.#???", "#..???", "####.#", ".....#"],
    trials: 2,
    stamps: [
      { id: "principal", name: "학원장 도장", face: ["######", ".....#", ".#.#.#", ".###.#", ".#....", ".#####"] },
      { id: "vice", name: "교감 도장", face: ["#####.", "....#.", "#.#.#.", "#.###.", "#.....", "######"] },
      { id: "steward", name: "사감 도장", face: ["#.....", "#.####", "#.#..#", "#.##.#", "#....#", "####.#"] },
      { id: "librarian", name: "사서 도장", face: [".....#", "####.#", "#..#.#", "#.##.#", "#....#", "####.#"] },
    ],
  },
  hints: [
    {
      text: "사감 도장은 돌려 보면 보이는 칸이 자국과 모두 같습니다. 그러나 찍으면 좌우가 뒤집히므로 그 도장은 답이 아닙니다. 답인 도장의 면은 자국을 거울에 비친 모양입니다.",
      facts: [{ kind: "stampIsNot", stamp: "steward" }],
    },
    {
      text: "자국의 맨 윗줄에는 빈칸이 하나 있고, 왼쪽에서 둘째 칸입니다. 사서 도장은 나머지 줄이 모두 맞는 방향으로 찍어도 맨 윗줄의 빈칸이 오른쪽에서 둘째 칸에 옵니다.",
      facts: [{ kind: "stampIsNot", stamp: "librarian" }],
    },
  ],
  explanation: [
    {
      text: "도장을 찍으면 좌우가 뒤집힙니다. 사감 도장은 돌려 보면 자국과 같아 보이지만, 찍으면 뒤집힌 무늬가 나오므로 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "steward" }],
    },
    {
      text: "사서 도장은 두 번 돌려 찍으면 아래 다섯 줄이 맞지만, 맨 윗줄의 빈칸이 오른쪽에서 둘째 칸에 옵니다. 자국의 빈칸은 왼쪽에서 둘째 칸이므로 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "librarian" }],
    },
    {
      text: "학원장 도장은 세 번 돌려 찍으면 한 칸만 다릅니다. 위에서 넷째 줄의 왼쪽에서 셋째 칸입니다. 자국에서 그 칸은 비어 있는데 학원장 도장은 그 칸이 찍힙니다. 번진 곳이 아니므로 학원장 도장도 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "principal" }],
    },
    {
      text: "교감 도장을 한 번 돌려 찍으면 번지지 않은 서른 칸이 모두 맞습니다.",
      facts: [
        { kind: "turnIsNot", turn: 0 },
        { kind: "turnIsNot", turn: 2 },
        { kind: "turnIsNot", turn: 3 },
      ],
    },
  ],
  solution: { stamp: "vice", turn: 1 },
  reward: 100,
};

/** 일주일치. 순서가 곧 일차(1~7)다. */
export const DAILY_SET: Puzzle[] = [
  DAILY_EVIDENCE_1,
  DAILY_SEAL_1,
  DAILY_CODE_2,
  DAILY_TRUTH_1,
  DAILY_EVIDENCE_2,
  DAILY_SCHEDULE_1,
  DAILY_SEAL_2,
];
