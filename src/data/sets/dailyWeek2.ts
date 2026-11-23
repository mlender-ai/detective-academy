/**
 * 일일 문제 · 둘째 주 여섯 개 (첫 공개 버전).
 *
 * dailySet.ts 의 일곱 문제 뒤에 그대로 이어 붙는다(달력의 9~14일째). 앞 여덟 날의 배정은 바뀌지 않는다.
 * 여섯 문제는 같은 유형의 기존 문제와 푸는 길이 다르다(문제마다 "푸는 길"을 적었다):
 *   순서  한 줄 조립                (사이 + 연달아 서지 않는다 + 먼저)
 *   진술  지목된 횟수 세기           (네 사람이 모두 남을 가리킨다)
 *   암호  숫자는 다 알고 자리만 모른다 (셋 다 맞고 위치는 하나도 맞지 않은 기록)
 *   인장  귀퉁이 한 조각만 남은 자국   (서른여섯 칸 가운데 아홉 칸)
 *   증거  두 물건이 두 시각을 채운다   (물건 + 물건 → 있을 틈이 없다)
 *   순서  두 묶음과 한 사람           (다섯 명, 바로 다음 × 2)
 *
 * solution 은 개발·검증용이다. 화면에는 플레이어가 해결한 뒤에만 노출한다.
 * 정답이 하나뿐인지, 군더더기가 없는지, 해설의 중간 사실이 맞는지는 src/tests/content-v3.test.ts 가 전수 탐색으로 확인한다.
 */
import type { CodePuzzle, EvidencePuzzle, Puzzle, SchedulePuzzle, SpatialPuzzle, TruthPuzzle } from "../../engine/types";
import { daon, doyun, harin, junho, minjae, sea, sera } from "../people";

/* ───────── 9일째 · 순서 추론 ─────────
 * 푸는 길: 경우를 나누지 않고 한 줄을 조립한다. 세라는 하린과 민재 사이인데 하린의 바로 옆은 아니다.
 * 그러면 둘 사이에 한 사람이 끼어야 하고 남은 사람은 다온뿐이다(하린·다온·세라·민재 또는 그 반대).
 * '먼저' 조건이 방향을 정한다.
 */
export const DAILY_SCHEDULE_2: SchedulePuzzle = {
  id: "daily-schedule-002",
  type: "schedule",
  category: "daily",
  title: "번진 출발 명단",
  typeLabel: "다중 조건 순서 추론",
  difficulty: 2,
  rank: "F",
  minutes: 3,
  intro: "야간 실습의 출발 명단이 이슬에 번졌다. 인솔 교사가 기억하는 것은 세 가지다.",
  description:
    "학생 네 명이 1번부터 4번까지 한 명씩 숲길로 출발했습니다. 세 조건을 모두 만족하는 출발 순서를 찾아 배치하세요. '사이'는 바로 옆이 아니어도 됩니다.",
  outro: "명단을 다시 적었다. 숲길에 가장 먼저 들어선 사람은 하린이다.",
  rules: {
    people: [sera, minjae, daon, harin],
    title: "출발 순서",
    slots: [
      { label: "1번", ordinal: "첫 번째" },
      { label: "2번", ordinal: "두 번째" },
      { label: "3번", ordinal: "세 번째" },
      { label: "4번", ordinal: "네 번째" },
    ],
    constraints: [
      { kind: "between", who: "sera", a: "harin", b: "minjae", text: "세라는 하린과 민재 사이의 순서다." },
      { kind: "notAdjacent", a: "sera", b: "harin", text: "세라와 하린은 연달아 서지 않았다." },
      { kind: "before", a: "daon", b: "minjae", text: "다온은 민재보다 먼저 출발했다." },
    ],
  },
  hints: [
    {
      text: "조건 1과 2를 함께 보세요. 세라는 하린과 민재 사이에 서지만 하린의 바로 옆은 아닙니다. 그렇다면 세라와 하린 사이에 누군가 끼어 있어야 합니다.",
      facts: [{ kind: "slotAmong", who: "sera", slots: [1, 2] }],
    },
    {
      text: "끼어들 사람은 다온뿐이라 다온과 세라가 가운데 두 자리를 차지합니다. 양 끝은 하린과 민재입니다. 조건 3에서 다온이 민재보다 먼저라는 것으로 어느 쪽이 앞인지 정하세요.",
      facts: [
        { kind: "slotAmong", who: "daon", slots: [1, 2] },
        { kind: "slotAmong", who: "harin", slots: [0, 3] },
      ],
    },
  ],
  explanation: [
    {
      text: "조건 1에 따라 세라는 하린과 민재 사이입니다. 조건 2에 따라 세라는 하린의 바로 옆이 아니므로, 세라와 하린 사이에 한 사람이 끼어 있습니다. 남은 사람은 다온뿐입니다.",
      facts: [
        { kind: "slotAmong", who: "sera", slots: [1, 2] },
        { kind: "slotAmong", who: "daon", slots: [1, 2] },
      ],
    },
    {
      text: "그래서 네 사람은 하린·다온·세라·민재 순이거나 그 반대로 늘어섭니다. 하린과 민재가 양 끝에 섭니다.",
      facts: [
        { kind: "slotAmong", who: "harin", slots: [0, 3] },
        { kind: "slotAmong", who: "minjae", slots: [0, 3] },
      ],
    },
    {
      text: "조건 3에 따라 다온은 민재보다 먼저입니다. 민재가 1번이면 다온이 먼저일 수 없으므로 민재는 4번입니다. 출발 순서는 하린, 다온, 세라, 민재입니다.",
      facts: [
        { kind: "slotIs", who: "harin", slot: 0 },
        { kind: "slotIs", who: "daon", slot: 1 },
        { kind: "slotIs", who: "sera", slot: 2 },
        { kind: "slotIs", who: "minjae", slot: 3 },
      ],
    },
  ],
  solution: ["harin", "daon", "sera", "minjae"],
  reward: 60,
};

/* ───────── 10일째 · 진술 추리 ─────────
 * 푸는 길: 네 진술이 모두 누군가를 가리킨다. 숨긴 사람을 가리킨 말만 참이므로 "참의 수 = 숨긴 사람이 가리켜진 횟수"다.
 * 가정을 하나씩 세우는 대신 이름이 불린 횟수를 센다(준호 1 · 도윤 3 · 세라 2 · 민재 0). 가장 많이 가리켜진 사람은 답이 아니다.
 */
export const DAILY_TRUTH_2: TruthPuzzle = {
  id: "daily-truth-002",
  type: "truth",
  category: "daily",
  title: "사라진 나침반",
  typeLabel: "진실·거짓 추리",
  difficulty: 2,
  rank: "F",
  minutes: 3,
  intro: "야외 실습 전날, 장비함의 나침반이 사라졌다. 네 사람은 저마다 남을 가리켰다.",
  description:
    "네 명의 학생 중 한 명이 나침반을 숨겼습니다. 네 사람의 진술 가운데 정확히 둘만 참입니다. 나침반을 숨긴 사람은 누구일까요?",
  outro: "나침반은 세라의 배낭에 있었다. 세 번이나 지목된 도윤은 숨긴 사람이 아니었다.",
  rules: {
    people: [junho, doyun, sera, minjae],
    item: "나침반",
    statements: [
      { speaker: "junho", text: "도윤이 숨겼다.", claim: { kind: "culpritIs", who: "doyun" } },
      { speaker: "doyun", text: "세라가 숨겼다.", claim: { kind: "culpritIs", who: "sera" } },
      { speaker: "sera", text: "준호나 도윤이 숨겼다.", claim: { kind: "culpritAmong", who: ["junho", "doyun"] } },
      { speaker: "minjae", text: "도윤이나 세라가 숨겼다.", claim: { kind: "culpritAmong", who: ["doyun", "sera"] } },
    ],
    trueCount: 2,
  },
  hints: [
    {
      text: "네 진술은 모두 누군가를 가리킵니다. 숨긴 사람을 가리킨 말은 참이고, 다른 사람만 가리킨 말은 거짓입니다. 그러니 참인 진술의 수는 숨긴 사람이 가리켜진 횟수와 같습니다.",
      facts: [],
    },
    {
      text: "사람마다 몇 번 가리켜졌는지 세어 보세요. 도윤은 세 사람에게 가리켜졌습니다. 도윤이 숨겼다면 참이 셋이 되어 조건에 맞지 않습니다.",
      facts: [
        { kind: "trueCountIf", culprit: "doyun", count: 3 },
        { kind: "culpritIsNot", who: "doyun" },
      ],
    },
  ],
  explanation: [
    {
      text: "네 진술은 모두 누군가를 가리킵니다. 숨긴 사람을 가리킨 말만 참이므로, 참인 진술의 수는 숨긴 사람이 가리켜진 횟수와 같습니다. 정확히 두 번 가리켜진 사람을 찾으면 됩니다.",
      facts: [{ kind: "trueCountIf", culprit: "minjae", count: 0 }],
    },
    {
      text: "준호는 세라에게 한 번, 도윤은 준호·세라·민재에게 세 번 가리켜졌습니다. 민재를 가리킨 사람은 없습니다. 세 사람은 숨긴 사람이 아닙니다.",
      facts: [
        { kind: "trueCountIf", culprit: "junho", count: 1 },
        { kind: "trueCountIf", culprit: "doyun", count: 3 },
        { kind: "culpritIsNot", who: "junho" },
        { kind: "culpritIsNot", who: "doyun" },
        { kind: "culpritIsNot", who: "minjae" },
      ],
    },
    {
      text: "세라는 도윤과 민재에게 두 번 가리켜졌습니다. 세라가 숨겼다면 도윤과 민재의 말이 참이고 준호와 세라의 말이 거짓이라 참이 정확히 2개입니다. 나침반을 숨긴 사람은 세라입니다.",
      facts: [
        { kind: "trueCountIf", culprit: "sera", count: 2 },
        { kind: "statementIs", speaker: "doyun", value: true },
        { kind: "statementIs", speaker: "minjae", value: true },
        { kind: "statementIs", speaker: "junho", value: false },
        { kind: "statementIs", speaker: "sera", value: false },
      ],
    },
  ],
  solution: "sera",
  reward: 60,
};

/* ───────── 11일째 · 암호 해독 ─────────
 * 푸는 길: 첫 기록이 세 숫자를 모두 맞히고 위치는 하나도 맞히지 못했다. 숫자는 그 자리에서 정해지고,
 * "제자리가 아닌 자리에 놓는 방법"은 둘뿐이다. 둘째 기록의 '위치 틀림' 하나가 둘을 가른다.
 * 기록은 두 줄, 어느 줄도 위치를 맞히지 못했다. ('위치 틀림'을 지우는 데 쓰는 법을 익히는 가벼운 날)
 */
export const DAILY_CODE_3: CodePuzzle = {
  id: "daily-code-003",
  type: "code",
  category: "daily",
  title: "자리만 틀린 기록",
  typeLabel: "조건 추론 · 암호 해독",
  difficulty: 1,
  rank: "F",
  minutes: 2,
  intro: "자료실. 책상의 기록은 두 줄뿐이다. 첫 줄은 숫자를 다 맞히고도 자리를 다 틀렸다.",
  description:
    "금고의 암호는 1부터 9까지 서로 다른 숫자 3개입니다. 시도 기록은 두 번뿐입니다. 첫 기록은 세 숫자를 모두 맞혔지만 위치는 하나도 맞지 않았습니다. 숫자가 놓일 자리를 찾아내세요.",
  outro: "철컥. 금고 안에는 쪽지 한 장. '무엇인지 아는 것과 어디인지 아는 것은 다르다.'",
  rules: {
    length: 3,
    digits: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    clues: [
      { guess: [2, 7, 4], match: 3, inPlace: 0 },
      { guess: [7, 5, 9], match: 1, inPlace: 0 },
    ],
  },
  hints: [
    {
      text: "274는 세 숫자가 모두 맞았습니다. 암호는 2, 4, 7로 이루어집니다. 남은 일은 자리를 정하는 것뿐입니다.",
      facts: [
        { kind: "present", digit: 2 },
        { kind: "present", digit: 4 },
        { kind: "present", digit: 7 },
      ],
    },
    {
      text: "274는 위치가 하나도 맞지 않았습니다. 2는 첫째 자리가 아니고, 7은 둘째 자리가 아니고, 4는 셋째 자리가 아닙니다. 세 숫자를 이렇게 놓는 방법은 두 가지뿐입니다.",
      facts: [
        { kind: "notAt", digit: 2, position: 0 },
        { kind: "notAt", digit: 7, position: 1 },
        { kind: "notAt", digit: 4, position: 2 },
      ],
    },
  ],
  explanation: [
    {
      text: "274는 세 숫자가 모두 맞았으므로 암호의 숫자는 2, 4, 7입니다. 다른 숫자는 들어갈 자리가 없습니다.",
      facts: [
        { kind: "present", digit: 2 },
        { kind: "present", digit: 4 },
        { kind: "present", digit: 7 },
        { kind: "absent", digits: [1, 3, 5, 6, 8, 9] },
      ],
    },
    {
      text: "위치는 하나도 맞지 않았습니다. 2는 첫째, 7은 둘째, 4는 셋째 자리가 아닙니다. 세 숫자를 이렇게 놓는 방법은 4·2·7과 7·4·2 둘뿐입니다.",
      facts: [
        { kind: "notAt", digit: 2, position: 0 },
        { kind: "notAt", digit: 7, position: 1 },
        { kind: "notAt", digit: 4, position: 2 },
      ],
    },
    {
      text: "759에서 맞은 숫자는 7이고 위치가 틀렸습니다. 7은 첫째 자리가 아니므로 7·4·2는 될 수 없습니다. 암호는 427입니다.",
      facts: [
        { kind: "notAt", digit: 7, position: 0 },
        { kind: "at", digit: 4, position: 0 },
        { kind: "at", digit: 2, position: 1 },
        { kind: "at", digit: 7, position: 2 },
      ],
    },
  ],
  solution: [4, 2, 7],
  reward: 60,
};

/* ───────── 12일째 · 공간 추론(인장 대조) ─────────
 * 푸는 길: 자국은 왼쪽 위 아홉 칸만 남았다. 찍기 전의 도장 면에서는 "오른쪽 위 귀퉁이에 조각의 거울상"이 와야 한다.
 * 네 도장의 귀퉁이 열여섯 곳을 그 자리에 가져와 견준다. 오답 셋은 저마다 다른 이유로 떨어진다:
 *   추적  돌려 보면 왼쪽 위가 조각과 똑같다(뒤집히지 않았다)
 *   변장  거울상 장식이 그대로 있지만, 오른쪽 위로 가져오면 장식도 함께 돌아간다
 *   감식  한 번 돌려 찍으면 한 칸만 다르다
 */
export const DAILY_SEAL_3: SpatialPuzzle = {
  id: "daily-seal-003",
  type: "spatial",
  category: "daily",
  title: "깨진 봉랍의 한 조각",
  typeLabel: "공간 추론 · 인장 대조",
  difficulty: 4,
  rank: "C",
  minutes: 5,
  intro: "익명의 제보 편지. 봉랍이 깨져 인장은 왼쪽 위 귀퉁이만 남았다.",
  description:
    "자국은 왼쪽 위 아홉 칸만 남았고 나머지는 알 수 없습니다. 네 도장은 귀퉁이마다 다른 장식이 있습니다. 남은 칸이 모두 맞는 도장과 방향을 찾으세요. 찍으면 좌우가 뒤집힙니다. 시험 종이는 두 장뿐입니다.",
  outro: "자국은 암호 도장의 것이다. 편지는 암호 연구실에서 봉해졌다.",
  rules: {
    size: 6,
    imprint: ["##.???", ".#.???", "..#???", "??????", "??????", "??????"],
    trials: 2,
    stamps: [
      { id: "forensic", name: "감식 도장", face: ["#.#.#.", "##.#.#", "..#...", "#.##..", "...##.", "#.##.."] },
      { id: "cipher", name: "암호 도장", face: [".#.#.#", "###...", "...#.#", "..##..", ".#.#.#", "##...#"] },
      { id: "trace", name: "추적 도장", face: [".....#", "###.##", "#..#..", "#.###.", ".#....", "#...##"] },
      { id: "disguise", name: "변장 도장", face: ["#.###.", ".#....", "#...##", ".#..##", "###.#.", "...#.."] },
    ],
  },
  hints: [
    {
      text: "남은 조각은 자국의 왼쪽 위 귀퉁이입니다. 찍으면 좌우가 뒤집히므로, 찍기 전의 도장 면에서는 오른쪽 위 귀퉁이에 조각의 거울상이 와야 합니다. 돌려 보았을 때 왼쪽 위가 조각과 똑같은 도장은 오히려 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "trace" }],
    },
    {
      text: "도장을 돌려 가며 귀퉁이 넷을 차례로 오른쪽 위에 놓아 보세요. 도장을 돌리면 장식도 함께 돕니다. 거울상 장식이 있어도, 오른쪽 위로 가져왔을 때 돌아가 있으면 맞지 않습니다.",
      facts: [{ kind: "stampIsNot", stamp: "disguise" }],
    },
  ],
  explanation: [
    {
      text: "추적 도장은 세 번 돌려 보면 왼쪽 위 귀퉁이가 조각과 똑같습니다. 찍으면 좌우가 뒤집히므로 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "trace" }],
    },
    {
      text: "찍기 전의 도장 면에서는 오른쪽 위 귀퉁이에 조각의 거울상이 있어야 합니다. 변장 도장은 오른쪽 아래 귀퉁이에 그 거울상이 그대로 있지만, 오른쪽 위로 가져오려면 세 번 돌려야 하고 그러면 장식도 함께 돌아가 맞지 않습니다.",
      facts: [{ kind: "stampIsNot", stamp: "disguise" }],
    },
    {
      text: "감식 도장은 한 번 돌려 찍으면 한 칸만 다릅니다. 조각의 셋째 줄 맨 왼쪽 칸은 비어 있는데 감식 도장은 그 칸이 찍힙니다.",
      facts: [{ kind: "stampIsNot", stamp: "forensic" }],
    },
    {
      text: "암호 도장을 두 번 돌려 찍으면 남은 아홉 칸이 모두 맞습니다.",
      facts: [
        { kind: "turnIsNot", turn: 0 },
        { kind: "turnIsNot", turn: 1 },
        { kind: "turnIsNot", turn: 3 },
      ],
    },
  ],
  solution: { stamp: "cipher", turn: 2 },
  reward: 60,
};

/* ───────── 13일째 · 증거 조합 ─────────
 * 푸는 길: 물건 하나는 "언제"를 말해 주지 않는다(앞선 문제들의 함정). 그런데 따져 볼 시각이 둘뿐이고 물건이 두 곳에서 나왔다면,
 * 한 시각에 한 곳씩 두 시각이 모두 찬다. 그 사람에게는 다른 곳에 있을 틈이 없다(물건 + 물건 → 거기 없었다).
 * 거짓말은 자기 자리가 아니라 남의 자리에 대한 것이다(목격담).
 * 함정: 세아의 기숙사 출입 기록은 18:10의 것이라, 18:00에 민재를 봤다는 말을 받쳐 주지 않는다.
 */
export const DAILY_EVIDENCE_3: EvidencePuzzle = {
  id: "daily-evidence-003",
  type: "evidence",
  category: "daily",
  title: "두 곳에 남은 흔적",
  typeLabel: "증거 조합",
  difficulty: 3,
  rank: "D",
  minutes: 4,
  intro: "실습실의 현미경 렌즈가 사라졌다. 18시와 18시 10분, 두 시각의 행적을 따진다.",
  description:
    "따져 볼 시각은 18:00과 18:10 둘뿐입니다. 진술 하나는 기록과 맞지 않습니다. 증거를 이어 새 사실을 찾고, 거짓 진술과 그것을 깨는 증거를 함께 제출하세요.",
  outro: "세아의 말이 무너졌다. 민재에게는 기숙사에 있을 틈이 없었다.",
  rules: {
    people: [minjae, sea, harin],
    places: [
      { id: "lab", name: "실습실" },
      { id: "dining", name: "식당" },
      { id: "dorm", name: "기숙사" },
    ],
    times: ["18:00", "18:10"],
    cards: [
      {
        id: "glove",
        kind: "object",
        label: "실습 장갑",
        text: "18:10, 실습실 선반에서 민재의 장갑이 나왔다.",
        claim: { kind: "visited", who: "minjae", place: "lab", until: 1 },
      },
      {
        id: "ticket",
        kind: "object",
        label: "식권",
        text: "18:10, 식당 식탁에서 민재의 식권이 나왔다.",
        claim: { kind: "visited", who: "minjae", place: "dining", until: 1 },
      },
      {
        id: "rollcall",
        kind: "time",
        label: "기숙사 점호",
        text: "18:00 기숙사 점호: 하린이 방에 있었다.",
        claim: { kind: "at", who: "harin", place: "dorm", time: 0 },
      },
      {
        id: "gate",
        kind: "log",
        label: "기숙사 출입",
        text: "18:10 기숙사 출입 기록: 세아 입실.",
        claim: { kind: "at", who: "sea", place: "dorm", time: 1 },
      },
      {
        id: "say-minjae",
        kind: "statement",
        speaker: "minjae",
        label: "민재의 진술",
        text: "18:10에 나는 식당에서 밥을 먹고 있었어.",
        claim: { kind: "at", who: "minjae", place: "dining", time: 1 },
      },
      {
        id: "say-sea",
        kind: "statement",
        speaker: "sea",
        label: "세아의 진술",
        text: "18:00에 민재는 기숙사에 있었어. 내가 봤어.",
        claim: { kind: "at", who: "minjae", place: "dorm", time: 0 },
      },
      {
        id: "say-harin",
        kind: "statement",
        speaker: "harin",
        label: "하린의 진술",
        text: "18:00에 나는 기숙사 방에 있었어.",
        claim: { kind: "at", who: "harin", place: "dorm", time: 0 },
      },
    ],
    derivations: [
      {
        from: ["glove", "ticket"],
        card: {
          id: "fact-route",
          kind: "derived",
          label: "민재의 동선",
          text: "민재는 두 시각을 실습실과 식당에서 보냈다. 기숙사엔 없었다.",
          claim: {
            kind: "all",
            of: [
              { kind: "notAt", who: "minjae", place: "dorm", time: 0 },
              { kind: "notAt", who: "minjae", place: "dorm", time: 1 },
            ],
          },
        },
      },
    ],
  },
  hints: [
    {
      text: "물건은 발견된 시각에 놓였다고 단정할 수 없습니다. 장갑 하나만으로는 민재가 실습실에 있던 때가 18:00인지 18:10인지 알 수 없어, 누구의 말도 깨지지 않습니다. 식권도 마찬가지입니다.",
      facts: [
        { kind: "consistent", a: "say-sea", b: "glove" },
        { kind: "consistent", a: "say-sea", b: "ticket" },
      ],
    },
    {
      text: "따져 볼 시각은 둘뿐인데 민재의 물건은 두 곳에서 나왔습니다. 한 시각에는 한 곳에만 있을 수 있습니다. 장갑과 식권을 이어 보세요.",
      facts: [{ kind: "derives", from: ["glove", "ticket"], card: "fact-route" }],
    },
  ],
  explanation: [
    {
      text: "장갑은 민재가 18:00이나 18:10에 실습실에 있었다는 뜻이고, 식권은 그 두 시각 가운데 한 번은 식당에 있었다는 뜻입니다. 따로 보면 언제인지 알 수 없어 누구의 말도 깨지지 않습니다.",
      facts: [
        { kind: "consistent", a: "say-sea", b: "glove" },
        { kind: "consistent", a: "say-sea", b: "ticket" },
      ],
    },
    {
      text: "시각은 둘뿐이고 한 시각에는 한 곳에만 있을 수 있습니다. 둘을 이으면 민재는 한 시각은 실습실에서, 다른 시각은 식당에서 보냈습니다. 기숙사에 있던 때는 없습니다.",
      facts: [{ kind: "derives", from: ["glove", "ticket"], card: "fact-route" }],
    },
    {
      text: "민재와 하린의 말은 기록과 어긋나지 않습니다. 세아의 출입 기록은 18:10의 것이라 18:00의 일을 말해 주지 않습니다.",
      facts: [
        { kind: "statementHolds", statement: "say-minjae" },
        { kind: "statementHolds", statement: "say-harin" },
        { kind: "consistent", a: "say-sea", b: "gate" },
      ],
    },
    {
      text: "세아는 18:00에 민재가 기숙사에 있었다고 했습니다. 민재는 어느 시각에도 기숙사에 없었으므로 함께 성립할 수 없습니다. 기록과 맞지 않는 것은 세아의 진술입니다.",
      facts: [{ kind: "contradicts", a: "say-sea", b: "fact-route" }],
    },
  ],
  solution: { statement: "say-sea", against: "fact-route" },
  reward: 60,
};

/* ───────── 14일째 · 순서 추론 ─────────
 * 푸는 길: '바로 다음' 둘이 다섯 사람을 세 덩어리(도윤·민재 / 세아·하린 / 다온)로 묶는다. 다섯 자리가 아니라 세 덩어리를 줄 세운다.
 * 맨 앞 덩어리부터 정한다: 도윤·민재가 맨 앞이면 민재가 2번(조건 3), 다온이 맨 앞이면 세아가 먼저일 수 없다(조건 4).
 * 남은 둘은 '연달아 서지 않는다'가 가른다. "민재는 두 번째가 아니다"는 묶음으로 읽어야 뜻이 드러난다.
 */
export const DAILY_SCHEDULE_3: SchedulePuzzle = {
  id: "daily-schedule-003",
  type: "schedule",
  category: "daily",
  title: "찢긴 잠복 교대표",
  typeLabel: "다중 조건 순서 추론",
  difficulty: 4,
  rank: "C",
  minutes: 4,
  intro: "밤샘 잠복 실습. 교대표가 찢어져 다섯 사람의 순번을 알 수 없다.",
  description: "다섯 명이 한 명씩 교대로 망을 봅니다. 다섯 조건을 모두 지키는 교대 순서를 찾으세요.",
  outro: "교대표를 다시 붙였다. 첫 망은 세아, 마지막 망은 민재다.",
  rules: {
    people: [doyun, minjae, sea, harin, daon],
    title: "교대 순서",
    slots: [
      { label: "1번", ordinal: "첫 번째" },
      { label: "2번", ordinal: "두 번째" },
      { label: "3번", ordinal: "세 번째" },
      { label: "4번", ordinal: "네 번째" },
      { label: "5번", ordinal: "다섯 번째" },
    ],
    constraints: [
      { kind: "immediatelyAfter", who: "minjae", after: "doyun", text: "민재는 도윤의 바로 다음이다." },
      { kind: "immediatelyAfter", who: "harin", after: "sea", text: "하린은 세아의 바로 다음이다." },
      { kind: "notAtSlot", who: "minjae", slot: 1, text: "민재는 두 번째 순서가 아니다." },
      { kind: "before", a: "sea", b: "daon", text: "세아는 다온보다 먼저 망을 본다." },
      { kind: "notAdjacent", a: "doyun", b: "harin", text: "도윤과 하린은 연달아 서지 않는다." },
    ],
  },
  hints: [
    {
      text: "조건 1과 2는 사람을 둘씩 묶어 줍니다. 도윤·민재 묶음, 세아·하린 묶음, 그리고 다온. 다섯 자리가 아니라 세 덩어리를 줄 세우는 문제입니다.",
      facts: [
        { kind: "adjacent", first: "doyun", second: "minjae" },
        { kind: "adjacent", first: "sea", second: "harin" },
      ],
    },
    {
      text: "맨 앞에 설 덩어리부터 정하세요. 도윤·민재 묶음이 맨 앞이면 민재가 두 번째가 됩니다. 다온이 맨 앞이면 세아가 다온보다 먼저일 수 없습니다.",
      facts: [
        { kind: "slotNot", who: "doyun", slot: 0 },
        { kind: "slotNot", who: "daon", slot: 0 },
      ],
    },
  ],
  explanation: [
    {
      text: "조건 1과 2에 따라 도윤·민재, 세아·하린이 저마다 붙어 섭니다. 두 묶음과 다온, 세 덩어리를 줄 세우면 됩니다.",
      facts: [
        { kind: "adjacent", first: "doyun", second: "minjae" },
        { kind: "adjacent", first: "sea", second: "harin" },
      ],
    },
    {
      text: "맨 앞 덩어리를 따집니다. 도윤·민재 묶음이 맨 앞이면 민재가 2번이라 조건 3에 어긋납니다. 다온이 맨 앞이면 세아가 다온보다 먼저일 수 없어 조건 4에 어긋납니다. 맨 앞은 세아·하린 묶음입니다.",
      facts: [
        { kind: "slotIs", who: "sea", slot: 0 },
        { kind: "slotIs", who: "harin", slot: 1 },
      ],
    },
    {
      text: "남은 것은 도윤·민재 묶음과 다온입니다. 묶음이 바로 이어지면 하린 다음이 도윤이라 조건 5에 어긋납니다. 그러므로 다온이 3번에 끼고 도윤이 4번, 민재가 5번입니다. 교대 순서는 세아, 하린, 다온, 도윤, 민재입니다.",
      facts: [
        { kind: "slotIs", who: "sea", slot: 0 },
        { kind: "slotIs", who: "harin", slot: 1 },
        { kind: "slotIs", who: "daon", slot: 2 },
        { kind: "slotIs", who: "doyun", slot: 3 },
        { kind: "slotIs", who: "minjae", slot: 4 },
      ],
    },
  ],
  solution: ["sea", "harin", "daon", "doyun", "minjae"],
  reward: 60,
};

/** 둘째 주. 순서가 곧 달력의 9~14일째다. 한 번 정한 순서와 이름표는 바꾸지 않는다(날짜별 기록이 뒤바뀐다). */
export const DAILY_WEEK_2: Puzzle[] = [
  DAILY_SCHEDULE_2,
  DAILY_TRUTH_2,
  DAILY_CODE_3,
  DAILY_SEAL_3,
  DAILY_EVIDENCE_3,
  DAILY_SCHEDULE_3,
];
