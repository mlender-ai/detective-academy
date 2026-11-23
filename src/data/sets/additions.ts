/**
 * 첫 공개 버전에서 더한 연습실 여섯 문제, D→C 승급 시험의 셋째 문제, 특수 도전 하나.
 *
 * 연습실은 서랍마다 없던 유형을 채웠다: F 에 순서·증거, D 에 암호·인장, C 에 진술·증거.
 * 여덟 문제는 같은 유형의 기존 문제와 푸는 길이 다르다(문제마다 "푸는 길"을 적었다):
 *   연습 F 순서  고정된 자리에서 출발해 한 줄씩 채운다(경우를 나누지 않는다)
 *   연습 F 증거  물건의 때를 기록 하나로 정한다                 (위치 + 물건 → 위치)
 *   연습 D 암호  크기 순서가 자리를 정한다                     (새겨진 글: 뒤로 갈수록 커진다)
 *   연습 D 인장  그림이 아니라 흩어진 점 일곱 개                (붙어 있는 네 점을 기준 삼는다)
 *   연습 C 진술  자백과, 겹겹이 포개진 말                      (좁은 말이 참이면 넓은 말도 참)
 *   연습 C 증거  구간 기록 + 동행 → 두 명으로 찬 방             (구간 + 함께 → 둘의 자리 → 인원)
 *   시험 D→C 증거 혼자였던 방 → 물건의 때                     (위치 + 인원 → 혼자 → 물건)
 *   특수 도전 암호 네 번의 시도가 한 번도 위치를 맞히지 못했다     (겹침으로 숫자를, 지우기로 자리를)
 *
 * solution 은 개발·검증용이다. 화면에는 플레이어가 해결한 뒤에만 노출한다.
 * 정답이 하나뿐인지, 군더더기가 없는지, 해설의 중간 사실이 맞는지는 src/tests/content-v3.test.ts 가 전수 탐색으로 확인한다.
 */
import type { CodePuzzle, EvidencePuzzle, Puzzle, SchedulePuzzle, SpatialPuzzle, TruthPuzzle } from "../../engine/types";
import { daon, doyun, hana, harin, junho, minjae, sea, sera } from "../people";

const D9 = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/* ───────── 연습 F · 순서 추론 ─────────
 * 푸는 길: 순서 조건 세 가지(고정된 자리 · 바로 다음 · 금지 자리)를 한 번씩 읽는 입문.
 * 조건을 적힌 차례대로 놓기만 하면 풀린다. 경우를 나눌 일이 없다. (F→D 시험의 "묶음을 놓을 곳 세기"로 가기 전의 한 걸음)
 */
export const PRACTICE_SCHEDULE_F: SchedulePuzzle = {
  id: "practice-schedule-f",
  type: "schedule",
  category: "practice",
  title: "입학 선서의 순서",
  typeLabel: "다중 조건 순서 추론",
  difficulty: 1,
  rank: "F",
  minutes: 2,
  intro: "입학식 아침, 사회자의 쪽지가 물에 젖었다. 읽을 수 있는 것은 세 줄뿐이다.",
  description:
    "신입생 네 명이 1번부터 4번까지 한 명씩 선서합니다. 세 조건을 모두 만족하는 선서 순서를 찾아 배치하세요.",
  outro: "쪽지를 새로 썼다. 첫 선서는 하린, 마지막 선서는 다온이다.",
  rules: {
    people: [sera, junho, daon, harin],
    title: "선서 순서",
    slots: [
      { label: "1번", ordinal: "첫 번째" },
      { label: "2번", ordinal: "두 번째" },
      { label: "3번", ordinal: "세 번째" },
      { label: "4번", ordinal: "네 번째" },
    ],
    constraints: [
      { kind: "slotAmong", who: "harin", slots: [0], text: "하린은 첫 번째 순서다." },
      { kind: "immediatelyAfter", who: "junho", after: "harin", text: "준호는 하린의 바로 다음이다." },
      { kind: "notAtSlot", who: "sera", slot: 3, text: "세라는 네 번째 순서가 아니다." },
    ],
  },
  hints: [
    {
      text: "자리가 정해진 사람부터 놓으세요. 조건 1이 한 사람의 자리를 그대로 알려 줍니다.",
      facts: [{ kind: "slotIs", who: "harin", slot: 0 }],
    },
    {
      text: "조건 2의 '바로 다음'은 두 사람이 붙어 선다는 뜻입니다. 하린의 자리를 알았으니 준호의 자리도 정해집니다. 남은 두 자리는 조건 3으로 가르세요.",
      facts: [{ kind: "adjacent", first: "harin", second: "junho" }],
    },
  ],
  explanation: [
    {
      text: "조건 1에 따라 하린이 1번입니다.",
      facts: [{ kind: "slotIs", who: "harin", slot: 0 }],
    },
    {
      text: "조건 2에 따라 준호는 하린의 바로 다음이므로 2번입니다.",
      facts: [
        { kind: "adjacent", first: "harin", second: "junho" },
        { kind: "slotIs", who: "junho", slot: 1 },
      ],
    },
    {
      text: "남은 3번과 4번에 세라와 다온이 섭니다. 조건 3에 따라 세라는 네 번째가 아니므로 세라가 3번, 다온이 4번입니다. 선서 순서는 하린, 준호, 세라, 다온입니다.",
      facts: [
        { kind: "slotIs", who: "harin", slot: 0 },
        { kind: "slotIs", who: "junho", slot: 1 },
        { kind: "slotIs", who: "sera", slot: 2 },
        { kind: "slotIs", who: "daon", slot: 3 },
      ],
    },
  ],
  solution: ["harin", "junho", "sera", "daon"],
  reward: 30,
};

/* ───────── 연습 F · 증거 조합 ─────────
 * 푸는 길: 물건은 "그때까지의 어느 때엔가 거기 있었다"는 뜻이다. 시각이 둘뿐이고 그 가운데 하나에 다른 곳에 있었다는 기록이 있으면,
 * 물건을 둔 때가 정해진다(한 번 잇기). 물건을 함정으로만 보던 눈을 뒤집어, 물건으로 사실을 얻는 첫 문제.
 * 견주어 보라고 놓은 것: 세아의 머리핀은 때를 정해 줄 기록이 없어 누구의 말도 깨지 못한다.
 */
export const PRACTICE_EVIDENCE_F: EvidencePuzzle = {
  id: "practice-evidence-f",
  type: "evidence",
  category: "practice",
  title: "엎질러진 잉크병",
  typeLabel: "증거 조합",
  difficulty: 1,
  rank: "F",
  minutes: 2,
  intro: "제도실의 잉크병이 엎질러져 있었다. 9시부터 9시 10분 사이의 일이다.",
  description:
    "세 사람의 진술 가운데 하나는 기록과 맞지 않습니다. 증거 두 개를 이어 새 사실을 찾고, 거짓 진술과 그것을 깨는 증거를 짝지어 제출하세요.",
  outro: "도윤의 말이 무너졌다. 9:00, 도윤은 식당이 아니라 제도실에 있었다.",
  rules: {
    people: [doyun, sea, harin],
    places: [
      { id: "drafting", name: "제도실" },
      { id: "classroom", name: "강의실" },
      { id: "dining", name: "식당" },
    ],
    times: ["9:00", "9:10"],
    cards: [
      {
        id: "roll",
        kind: "log",
        label: "출석부",
        text: "9:10 강의실 출석부: 도윤이 자리에 앉아 있었다.",
        claim: { kind: "at", who: "doyun", place: "classroom", time: 1 },
      },
      {
        id: "ruler",
        kind: "object",
        label: "떨어진 자",
        text: "9:10, 제도실 바닥에서 도윤의 자가 나왔다.",
        claim: { kind: "visited", who: "doyun", place: "drafting", until: 1 },
      },
      {
        id: "pin",
        kind: "object",
        label: "머리핀",
        text: "9:10, 식당 문 앞에서 세아의 머리핀이 나왔다.",
        claim: { kind: "visited", who: "sea", place: "dining", until: 1 },
      },
      {
        id: "meal",
        kind: "log",
        label: "배식 기록",
        text: "9:00 식당 배식 기록: 하린이 식판을 받았다.",
        claim: { kind: "at", who: "harin", place: "dining", time: 0 },
      },
      {
        id: "say-doyun",
        kind: "statement",
        speaker: "doyun",
        label: "도윤의 진술",
        text: "9:00에 나는 식당에 있었어. 제도실엔 안 갔어.",
        claim: { kind: "at", who: "doyun", place: "dining", time: 0 },
      },
      {
        id: "say-sea",
        kind: "statement",
        speaker: "sea",
        label: "세아의 진술",
        text: "9:10에 나는 강의실에 있었어.",
        claim: { kind: "at", who: "sea", place: "classroom", time: 1 },
      },
      {
        id: "say-harin",
        kind: "statement",
        speaker: "harin",
        label: "하린의 진술",
        text: "9:00에 나는 식당에서 밥을 받았어.",
        claim: { kind: "at", who: "harin", place: "dining", time: 0 },
      },
    ],
    derivations: [
      {
        from: ["roll", "ruler"],
        card: {
          id: "fact-doyun",
          kind: "derived",
          label: "자를 둔 때",
          text: "도윤은 9:00에 제도실에 있었다.",
          claim: { kind: "at", who: "doyun", place: "drafting", time: 0 },
        },
      },
    ],
  },
  hints: [
    {
      text: "물건은 발견된 시각에 놓였다고 단정할 수 없습니다. 9:00이나 9:10 가운데 한 번은 거기 있었다는 뜻일 뿐입니다. 머리핀만으로는 세아의 말이 깨지지 않습니다.",
      facts: [{ kind: "consistent", a: "say-sea", b: "pin" }],
    },
    {
      text: "도윤의 자는 9:10에 제도실에서 나왔습니다. 그런데 9:10에 도윤이 어디 있었는지 말해 주는 기록이 있습니다. 둘을 이으면 자를 둔 때가 정해집니다.",
      facts: [{ kind: "derives", from: ["roll", "ruler"], card: "fact-doyun" }],
    },
  ],
  explanation: [
    {
      text: "자 때문에 도윤은 9:00이나 9:10에 제도실에 있었습니다. 출석부에 따르면 9:10에는 강의실에 있었습니다. 둘을 이으면 도윤이 제도실에 있던 때는 9:00입니다.",
      facts: [{ kind: "derives", from: ["roll", "ruler"], card: "fact-doyun" }],
    },
    {
      text: "세아의 머리핀도 9:10에 발견됐지만, 세아가 9:10에 어디 있었는지 말해 주는 기록이 없어 때를 정할 수 없습니다. 9:10에 강의실에 있었다는 말과 어긋나지 않습니다. 하린의 말은 배식 기록과 맞습니다.",
      facts: [
        { kind: "consistent", a: "say-sea", b: "pin" },
        { kind: "statementHolds", statement: "say-sea" },
        { kind: "statementHolds", statement: "say-harin" },
      ],
    },
    {
      text: "도윤은 9:00에 식당에 있었다고 했습니다. 그때 도윤은 제도실에 있었으므로 함께 성립할 수 없습니다. 기록과 맞지 않는 것은 도윤의 진술입니다.",
      facts: [{ kind: "contradicts", a: "say-doyun", b: "fact-doyun" }],
    },
  ],
  solution: { statement: "say-doyun", against: "fact-doyun" },
  reward: 30,
};

/* ───────── 연습 D · 암호 해독 ─────────
 * 푸는 길: 새겨진 두 줄을 합치면 "뒤로 갈수록 커진다"가 된다. 그러면 자리가 곧 크기 순위다(첫째는 가장 작고 셋째는 가장 크다).
 * 789 의 "둘이 위치까지 맞았다"에서, 7 이 첫째라면 나머지가 8·9 뿐이라 셋이 다 맞아 버린다는 것으로 7 을 지운다.
 * 기록은 두 줄뿐이고 '일치 없음'은 없다. (조건을 계산이 아니라 자리의 뜻을 바꾸는 데 쓴다)
 */
export const PRACTICE_CODE_D: CodePuzzle = {
  id: "practice-code-d",
  type: "code",
  category: "practice",
  title: "점점 커지는 숫자",
  typeLabel: "조건 추론 · 암호 해독",
  difficulty: 2,
  rank: "D",
  minutes: 3,
  intro: "자료실. 금고 문에 두 줄이 새겨져 있다. 숫자는 뒤로 갈수록 커진다.",
  description:
    "금고의 암호는 1부터 9까지 서로 다른 숫자 3개입니다. 문에 새겨진 두 줄에 따르면 숫자는 뒤로 갈수록 커집니다. 두 번의 시도 기록과 함께 써서 암호를 찾아내세요.",
  outro: "철컥. 금고 안에는 눈금이 새겨진 자 하나와 쪽지. '순서가 곧 단서다.'",
  rules: {
    length: 3,
    digits: D9,
    clues: [
      { guess: [2, 3, 4], match: 1, inPlace: 1 },
      { guess: [7, 8, 9], match: 2, inPlace: 2 },
    ],
    conditions: [
      { kind: "greater", a: 1, b: 0, text: "둘째 숫자는 첫째 숫자보다 크다." },
      { kind: "greater", a: 2, b: 1, text: "셋째 숫자는 둘째 숫자보다 크다." },
    ],
  },
  hints: [
    {
      text: "새겨진 두 줄을 합치면 첫째, 둘째, 셋째 순으로 숫자가 커집니다. 첫째 자리는 가장 작은 숫자, 셋째 자리는 가장 큰 숫자입니다. 그러니 '위치도 정확'이라는 결과는 그 숫자의 크기 순위까지 알려 줍니다.",
      facts: [],
    },
    {
      text: "789는 두 숫자가 위치까지 맞았습니다. 7이 첫째 자리라면 나머지 두 숫자는 7보다 커야 하니 8과 9뿐이고, 그러면 세 숫자가 다 맞아 버립니다. 7은 암호에 없습니다.",
      facts: [
        { kind: "absent", digits: [7] },
        { kind: "present", digit: 8 },
        { kind: "present", digit: 9 },
      ],
    },
  ],
  explanation: [
    {
      text: "새겨진 두 줄에 따라 숫자는 뒤로 갈수록 커집니다. 789는 두 숫자가 위치까지 맞았습니다. 7이 첫째 자리라면 둘째와 셋째는 7보다 큰 8과 9뿐이라 세 숫자가 다 맞게 됩니다. 둘만 맞았으므로 7은 암호에 없습니다.",
      facts: [{ kind: "absent", digits: [7] }],
    },
    {
      text: "맞은 둘은 8과 9이고 적힌 자리 그대로입니다. 8이 둘째, 9가 셋째 자리입니다.",
      facts: [
        { kind: "at", digit: 8, position: 1 },
        { kind: "at", digit: 9, position: 2 },
      ],
    },
    {
      text: "234는 숫자 하나가 위치까지 맞았습니다. 3은 둘째, 4는 셋째 자리에 적혀 있는데 그 자리는 8과 9입니다. 맞은 것은 첫째 자리의 2입니다. 암호는 289입니다.",
      facts: [
        { kind: "absent", digits: [3, 4] },
        { kind: "at", digit: 2, position: 0 },
        { kind: "at", digit: 8, position: 1 },
        { kind: "at", digit: 9, position: 2 },
      ],
    },
  ],
  solution: [2, 8, 9],
  reward: 35,
};

/* ───────── 연습 D · 공간 추론(인장 대조) ─────────
 * 푸는 길: 무늬가 그림이 아니라 흩어진 점 일곱 개다(깃발·열쇠처럼 이름 붙일 모양이 없다).
 * 붙어 있는 네 점(세 점이 나란하고 한 끝에서 하나가 꺾여 붙었다)을 기준으로 방향을 잡고, 떨어진 세 점의 자리를 센다.
 * 오답은 거울상 하나와, 뒤집힘은 맞지만 외딴 점 하나가 한 칸 어긋난 닮은꼴 하나(두 칸 차이).
 */
export const PRACTICE_SEAL_D: SpatialPuzzle = {
  id: "practice-seal-d",
  type: "spatial",
  category: "practice",
  title: "관측 허가증의 일곱 별",
  typeLabel: "공간 추론 · 인장 대조",
  difficulty: 2,
  rank: "D",
  minutes: 3,
  intro: "천문대 관측 허가증 한 장. 별 일곱 개가 흩어진 인장이 찍혀 있다.",
  description:
    "무늬는 그림이 아니라 흩어진 점 일곱 개입니다. 찍으면 좌우가 뒤집힙니다. 붙어 있는 점들을 기준 삼아 자국을 낸 도장과 방향을 찾으세요. 시험 종이는 두 장입니다.",
  outro: "자국은 별빛 도장의 것이다. 허가증은 달빛 반이 아니라 별빛 반에서 나왔다.",
  rules: {
    size: 5,
    imprint: ["#...#", "..#..", "###..", ".....", "...#."],
    trials: 2,
    stamps: [
      { id: "dawn", name: "새벽 도장", face: ["....#", ".....", "#.##.", "..#..", "..#.#"] },
      { id: "moon", name: "달빛 도장", face: [".#...", ".....", "..###", "..#..", "#...#"] },
      { id: "star", name: "별빛 도장", face: ["#.#..", "..#..", ".##..", "....#", "#...."] },
    ],
  },
  hints: [
    {
      text: "붙어 있는 네 점을 먼저 찾으세요. 세 점이 한 줄로 나란하고, 한쪽 끝에서 한 점이 꺾여 붙어 있습니다. 도장을 돌려 이 덩어리를 자국과 같은 자리에 놓으면 방향이 정해집니다.",
      facts: [],
    },
    {
      text: "덩어리를 맞춘 뒤 떨어진 세 점을 봅니다. 뒤집지 않았는데도 일곱 점이 자국과 똑같아 보이는 도장은, 찍으면 좌우가 바뀌므로 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "moon" }],
    },
  ],
  explanation: [
    {
      text: "달빛 도장은 두 번 돌려 보면 일곱 점이 자국과 똑같습니다. 찍으면 좌우가 뒤집히므로 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "moon" }],
    },
    {
      text: "새벽 도장은 세 번 돌려 찍으면 붙어 있는 네 점과 위쪽의 두 점이 맞지만, 맨 아랫줄의 외딴 점이 한 칸 왼쪽에 찍힙니다. 자국에서 그 점은 왼쪽에서 넷째 칸에 있습니다.",
      facts: [{ kind: "stampIsNot", stamp: "dawn" }],
    },
    {
      text: "별빛 도장을 한 번 돌려 찍으면 일곱 점이 자국과 정확히 겹칩니다.",
      facts: [
        { kind: "turnIsNot", turn: 0 },
        { kind: "turnIsNot", turn: 2 },
        { kind: "turnIsNot", turn: 3 },
      ],
    },
  ],
  solution: { stamp: "star", turn: 1 },
  reward: 35,
};

/* ───────── 연습 C · 진술 추리 ─────────
 * 푸는 길: 민재가 자백했다. 자백이 참이면 "민재나 ○○"라는 두 말과 "세아는 아니다"까지 넷이 다 참이 된다(좁은 말이 참이면 그것을 품는 넓은 말도 참).
 * 참은 둘뿐이니 자백은 거짓이다. 남은 세 말에서 참은 정확히 둘: 세아의 말이 거짓이라고 가정하면 준호의 말과 하린의 말이 서로 부딪친다.
 * 가정을 사람이 아니라 진술에 세우고, 두 가정을 견준다. 숨긴 사람은 참말을 했고, 자백한 사람은 숨기지 않았다.
 */
export const PRACTICE_TRUTH_C: TruthPuzzle = {
  id: "practice-truth-c",
  type: "truth",
  category: "practice",
  title: "제 발로 나선 자백",
  typeLabel: "진실·거짓 추리",
  difficulty: 3,
  rank: "C",
  minutes: 4,
  intro: "감식 실습 날 붓이 사라지자 민재가 제 발로 나섰다. 그런데 참말을 한 사람은 둘뿐이다.",
  description:
    "네 명의 학생 중 한 명이 감식 붓을 숨겼습니다. 네 사람의 진술 가운데 정확히 둘만 참입니다. 자백도 진술로 셉니다. 감식 붓을 숨긴 사람은 누구일까요?",
  outro: "붓은 하린의 사물함에 있었다. 민재의 자백은 친구를 감싸려는 거짓이었다.",
  rules: {
    people: [junho, minjae, harin, sea],
    item: "감식 붓",
    statements: [
      { speaker: "junho", text: "민재나 세아가 숨겼다.", claim: { kind: "culpritAmong", who: ["minjae", "sea"] } },
      { speaker: "minjae", text: "내가 숨겼다.", claim: { kind: "culpritIs", who: "minjae" } },
      { speaker: "harin", text: "세아는 숨기지 않았다.", claim: { kind: "culpritIsNot", who: "sea" } },
      { speaker: "sea", text: "민재나 하린이 숨겼다.", claim: { kind: "culpritAmong", who: ["minjae", "harin"] } },
    ],
    trueCount: 2,
  },
  hints: [
    {
      text: "자백부터 따져 보세요. 민재의 자백이 참이라면 민재가 숨긴 것입니다. 그때 나머지 세 사람의 말이 참인지 거짓인지 세어 보면 참이 둘을 넘습니다.",
      facts: [
        { kind: "trueCountIf", culprit: "minjae", count: 4 },
        { kind: "statementIs", speaker: "minjae", value: false },
        { kind: "culpritIsNot", who: "minjae" },
      ],
    },
    {
      text: "자백이 거짓이므로 나머지 세 말 가운데 정확히 둘이 참입니다. 세아의 말이 참인 경우와 거짓인 경우로 나눠 보세요. 한쪽에서는 남은 두 사람의 말이 서로 부딪칩니다.",
      facts: [],
    },
  ],
  explanation: [
    {
      text: "민재의 자백이 참이라면 민재가 숨긴 것입니다. 그러면 준호의 말(민재나 세아), 세아의 말(민재나 하린), 하린의 말(세아는 아니다)까지 네 진술이 모두 참이 됩니다. 참은 둘뿐이므로 자백은 거짓이고, 민재는 숨기지 않았습니다.",
      facts: [
        { kind: "trueCountIf", culprit: "minjae", count: 4 },
        { kind: "statementIs", speaker: "minjae", value: false },
        { kind: "culpritIsNot", who: "minjae" },
      ],
    },
    {
      text: "남은 세 말 가운데 정확히 둘이 참입니다. 세아의 말(민재나 하린)이 거짓이라면 준호와 하린의 말이 모두 참이어야 합니다. 준호의 말대로면 민재가 아니니 세아가 숨겼는데, 하린의 말은 세아가 아니라고 합니다. 두 말이 부딪치므로 세아의 말은 참입니다.",
      facts: [
        { kind: "statementIs", speaker: "sea", value: true },
        { kind: "culpritIsNot", who: "sea" },
      ],
    },
    {
      text: "세아의 말이 참이고 민재는 아니므로 하린이 숨겼습니다. 이때 하린의 말(세아는 숨기지 않았다)은 참, 준호의 말은 거짓이라 참이 정확히 2개입니다. 감식 붓을 숨긴 사람은 하린입니다.",
      facts: [
        { kind: "trueCountIf", culprit: "harin", count: 2 },
        { kind: "statementIs", speaker: "harin", value: true },
        { kind: "statementIs", speaker: "junho", value: false },
        { kind: "culpritIsNot", who: "junho" },
      ],
    },
  ],
  solution: "harin",
  reward: 40,
};

/* ───────── 연습 C · 증거 조합 ─────────
 * 푸는 길: 19:10에 열람실에는 두 명. 한 명은 자리를 지킨 다온이고, 남은 한 자리를 두고 하나와 준호가 서로 자기였다고 한다(두 가정을 견준다).
 * 좌석 기록은 구간이다: 19:00부터 19:20까지 줄곧이니 19:10에도 열람실이다. 사진의 동행과 이으면 하나와 다온이 19:10에 열람실에 있었다(첫 번째 잇기).
 * 두 명뿐인 열람실이 그 둘로 찼으니 준호는 거기 없었다(두 번째 잇기: 채워진 방).
 * 함정: 대출 기록은 19:20의 것이다. 준호가 열람실에 온 것은 맞지만 19:10의 일을 말해 주지 않는다.
 * 네 번째 사람(세라)이 없으면 사진과 계수기만으로도 준호의 말이 무너져 좌석 기록이 군더더기가 된다(테스트가 본다).
 */
export const PRACTICE_EVIDENCE_C: EvidencePuzzle = {
  id: "practice-evidence-c",
  type: "evidence",
  category: "practice",
  title: "빌린 알리바이",
  typeLabel: "증거 조합",
  difficulty: 3,
  rank: "C",
  minutes: 4,
  intro: "암실의 필름이 빛에 탔다. 19시 10분, 다온의 옆자리에 있었다는 사람이 둘이다.",
  description:
    "그 시간 학원에는 네 사람뿐이었습니다. 진술 하나는 기록과 맞지 않습니다. 두 번 이어야 그것을 깨는 증거가 나옵니다.",
  outro: "준호의 말이 무너졌다. 19:10, 다온의 옆자리에는 하나가 앉아 있었다.",
  rules: {
    people: [hana, junho, sera, daon],
    places: [
      { id: "reading", name: "열람실" },
      { id: "darkroom", name: "암실" },
      { id: "shop", name: "매점" },
    ],
    times: ["19:00", "19:10", "19:20"],
    cards: [
      {
        id: "seat",
        kind: "log",
        label: "좌석 기록",
        text: "열람실 좌석 기록: 다온, 19:00부터 19:20까지 자리를 지켰다.",
        claim: { kind: "stayed", who: "daon", place: "reading", from: 0, to: 2 },
      },
      {
        id: "photo",
        kind: "time",
        label: "찍힌 사진",
        text: "19:10에 찍힌 사진: 하나와 다온이 한 책상에 앉아 있다.",
        claim: { kind: "together", a: "hana", b: "daon", time: 1 },
      },
      {
        id: "counter",
        kind: "log",
        label: "입구 계수기",
        text: "19:10 열람실 입구 계수기: 안에 있던 사람은 두 명.",
        claim: { kind: "count", place: "reading", time: 1, count: 2 },
      },
      {
        id: "loan",
        kind: "time",
        label: "대출 기록",
        text: "19:20 열람실 대출 기록: 준호가 책을 빌렸다.",
        claim: { kind: "at", who: "junho", place: "reading", time: 2 },
      },
      {
        id: "say-hana",
        kind: "statement",
        speaker: "hana",
        label: "하나의 진술",
        text: "19:10에 나는 열람실에서 다온 옆에 앉아 있었어.",
        claim: { kind: "at", who: "hana", place: "reading", time: 1 },
      },
      {
        id: "say-junho",
        kind: "statement",
        speaker: "junho",
        label: "준호의 진술",
        text: "19:10에 나는 열람실에 있었어. 다온 옆자리였어.",
        claim: { kind: "at", who: "junho", place: "reading", time: 1 },
      },
      {
        id: "say-sera",
        kind: "statement",
        speaker: "sera",
        label: "세라의 진술",
        text: "19:10에 나는 매점에 있었어.",
        claim: { kind: "at", who: "sera", place: "shop", time: 1 },
      },
      {
        id: "say-daon",
        kind: "statement",
        speaker: "daon",
        label: "다온의 진술",
        text: "19:10에 열람실에 있었어. 옆자리는 못 봤어.",
        claim: { kind: "at", who: "daon", place: "reading", time: 1 },
      },
    ],
    derivations: [
      {
        from: ["seat", "photo"],
        card: {
          id: "fact-pair",
          kind: "derived",
          label: "둘의 자리",
          text: "19:10에 하나와 다온은 열람실에 있었다.",
          claim: {
            kind: "all",
            of: [
              { kind: "at", who: "hana", place: "reading", time: 1 },
              { kind: "at", who: "daon", place: "reading", time: 1 },
            ],
          },
        },
      },
      {
        from: ["fact-pair", "counter"],
        card: {
          id: "fact-full",
          kind: "derived",
          label: "열람실의 둘",
          text: "19:10에 열람실에는 하나와 다온 둘뿐이었다.",
          claim: {
            kind: "all",
            of: [
              { kind: "at", who: "hana", place: "reading", time: 1 },
              { kind: "at", who: "daon", place: "reading", time: 1 },
              { kind: "notAt", who: "junho", place: "reading", time: 1 },
              { kind: "notAt", who: "sera", place: "reading", time: 1 },
            ],
          },
        },
      },
    ],
  },
  hints: [
    {
      text: "대출 기록은 19:20의 일이라, 19:10에 준호가 어디 있었는지 말해 주지 않습니다. 계수기에 따르면 19:10에 열람실에는 두 명뿐이었습니다. 그 둘이 누구인지 기록만으로 정해 보세요.",
      facts: [{ kind: "consistent", a: "say-junho", b: "loan" }],
    },
    {
      text: "다온은 19:00부터 19:20까지 열람실 자리를 지켰습니다. 19:10도 그 사이입니다. 좌석 기록과 사진을 이으면 사진 속 두 사람이 있던 곳이 나옵니다. 그 사실을 계수기와 한 번 더 이어 보세요.",
      facts: [{ kind: "derives", from: ["seat", "photo"], card: "fact-pair" }],
    },
  ],
  explanation: [
    {
      text: "좌석 기록에 따르면 다온은 19:00부터 19:20까지 열람실에 있었습니다. 19:10도 그 사이입니다. 사진에서 하나와 다온은 19:10에 한 책상에 앉아 있습니다. 둘을 이으면 19:10에 하나와 다온은 열람실에 있었습니다.",
      facts: [{ kind: "derives", from: ["seat", "photo"], card: "fact-pair" }],
    },
    {
      text: "계수기에 따르면 19:10에 열람실에 있던 사람은 두 명입니다. 그 둘이 하나와 다온이므로 준호와 세라는 그때 열람실에 없었습니다.",
      facts: [{ kind: "derives", from: ["fact-pair", "counter"], card: "fact-full" }],
    },
    {
      text: "대출 기록은 19:20의 일입니다. 준호가 19:20에 열람실에 온 것은 맞지만 19:10의 일을 말해 주지 않습니다. 하나, 세라, 다온의 말은 기록과 어긋나지 않습니다.",
      facts: [
        { kind: "consistent", a: "say-junho", b: "loan" },
        { kind: "statementHolds", statement: "say-hana" },
        { kind: "statementHolds", statement: "say-sera" },
        { kind: "statementHolds", statement: "say-daon" },
      ],
    },
    {
      text: "준호는 19:10에 열람실에서 다온 옆자리에 있었다고 했습니다. 그때 열람실에는 하나와 다온 둘뿐이었으므로 함께 성립할 수 없습니다. 기록과 맞지 않는 것은 준호의 진술입니다.",
      facts: [{ kind: "contradicts", a: "say-junho", b: "fact-full" }],
    },
  ],
  solution: { statement: "say-junho", against: "fact-full" },
  reward: 40,
};

/* ───────── 시험 D→C · 증거 조합 ─────────
 * 푸는 길: 준호의 명찰이 17:10에 기록실에서 나왔다. 준호가 거기 있던 때는 17:00 아니면 17:10이다.
 * 17:10에 기록실에는 한 명뿐이었고 그 한 명은 서명한 하린이다(첫 번째 잇기: 혼자였던 방).
 * 그러니 명찰은 17:00에 떨어졌다(두 번째 잇기: 남이 혼자 있던 때를 지워 물건의 때를 정한다).
 * 함정: 다온의 말("17:10에 준호와 같이 있었다")은 참이지만 17:10의 일이라 17:00의 알리바이가 되지 못한다.
 * 진술은 이을 수 없으므로, 준호의 17:10은 계수기와 열람 대장으로만 정해야 한다. 사물함 기록은 다온의 자리만 말한다.
 */
export const EXAM_EVIDENCE_D_C: EvidencePuzzle = {
  id: "exam-evidence-d-c",
  type: "evidence",
  category: "exam",
  title: "사라진 사건 파일",
  typeLabel: "증거 조합",
  difficulty: 3,
  rank: "D",
  minutes: 4,
  intro: "기록실의 사건 파일 한 권이 사라졌다. 17시부터 17시 10분 사이의 일이다.",
  description:
    "진술 하나는 기록과 맞지 않습니다. 증거를 이어 얻은 사실을 한 번 더 이어야 그것을 깨는 증거가 나옵니다. 거짓 진술과 그 증거를 함께 제출하세요.",
  outro: "준호의 말이 무너졌다. 17:00, 준호는 휴게실이 아니라 기록실에 있었다.",
  rules: {
    people: [junho, harin, daon],
    places: [
      { id: "archive", name: "기록실" },
      { id: "lounge", name: "휴게실" },
      { id: "gym", name: "체육관" },
    ],
    times: ["17:00", "17:10"],
    cards: [
      {
        id: "counter",
        kind: "log",
        label: "문 계수기",
        text: "17:10 기록실 문 계수기: 안에 있던 사람은 한 명.",
        claim: { kind: "count", place: "archive", time: 1, count: 1 },
      },
      {
        id: "desk",
        kind: "time",
        label: "열람 대장",
        text: "17:10 기록실 열람 대장: 하린이 서명했다.",
        claim: { kind: "at", who: "harin", place: "archive", time: 1 },
      },
      {
        id: "badge",
        kind: "object",
        label: "명찰",
        text: "17:10, 기록실 서가 아래에서 준호의 명찰이 나왔다.",
        claim: { kind: "visited", who: "junho", place: "archive", until: 1 },
      },
      {
        id: "locker",
        kind: "log",
        label: "사물함",
        text: "17:00 휴게실 사물함 기록: 다온이 문을 열었다.",
        claim: { kind: "at", who: "daon", place: "lounge", time: 0 },
      },
      {
        id: "say-junho",
        kind: "statement",
        speaker: "junho",
        label: "준호의 진술",
        text: "17:00에 나는 휴게실에 있었어. 다온한테 물어봐.",
        claim: { kind: "at", who: "junho", place: "lounge", time: 0 },
      },
      {
        id: "say-harin",
        kind: "statement",
        speaker: "harin",
        label: "하린의 진술",
        text: "17:10에 나는 기록실에서 서명했어.",
        claim: { kind: "at", who: "harin", place: "archive", time: 1 },
      },
      {
        id: "say-daon",
        kind: "statement",
        speaker: "daon",
        label: "다온의 진술",
        text: "17:10에 나는 준호와 같이 있었어.",
        claim: { kind: "together", a: "daon", b: "junho", time: 1 },
      },
    ],
    derivations: [
      {
        from: ["counter", "desk"],
        card: {
          id: "fact-alone",
          kind: "derived",
          label: "하린 혼자",
          text: "17:10에 기록실에는 하린 혼자 있었다.",
          claim: { kind: "alone", who: "harin", place: "archive", time: 1 },
        },
      },
      {
        from: ["fact-alone", "badge"],
        card: {
          id: "fact-junho",
          kind: "derived",
          label: "명찰의 때",
          text: "준호는 17:00에 기록실에 있었다.",
          claim: { kind: "at", who: "junho", place: "archive", time: 0 },
        },
      },
    ],
  },
  hints: [
    {
      text: "명찰은 17:10에 발견됐을 뿐입니다. 준호가 기록실에 있던 때는 17:00일 수도 17:10일 수도 있어, 명찰만으로는 누구의 말도 깨지지 않습니다. 17:10에 기록실 안에 누가 있었는지부터 정해 보세요.",
      facts: [{ kind: "consistent", a: "say-junho", b: "badge" }],
    },
    {
      text: "문 계수기와 열람 대장을 이으면 17:10에 기록실에 있던 한 명이 누구인지 나옵니다. 그 사실을 명찰과 한 번 더 이어 보세요. 다온의 말은 17:10의 일이라는 점도 눈여겨보세요.",
      facts: [{ kind: "derives", from: ["counter", "desk"], card: "fact-alone" }],
    },
  ],
  explanation: [
    {
      text: "문 계수기: 17:10에 기록실에는 한 명뿐이었습니다. 열람 대장: 그때 하린이 기록실에서 서명했습니다. 둘을 이으면 17:10에 기록실에는 하린 혼자 있었습니다.",
      facts: [{ kind: "derives", from: ["counter", "desk"], card: "fact-alone" }],
    },
    {
      text: "명찰 때문에 준호는 17:00이나 17:10에 기록실에 있었습니다. 17:10에는 하린 혼자였으므로, 준호가 기록실에 있던 때는 17:00입니다.",
      facts: [{ kind: "derives", from: ["fact-alone", "badge"], card: "fact-junho" }],
    },
    {
      text: "다온은 17:10에 준호와 같이 있었다고 했습니다. 기록과 어긋나지 않지만 17:10의 일이라 17:00의 알리바이가 되지 못합니다. 사물함 기록도 다온의 자리만 말해 줍니다. 하린의 말은 열람 대장과 맞습니다.",
      facts: [
        { kind: "statementHolds", statement: "say-daon" },
        { kind: "statementHolds", statement: "say-harin" },
        { kind: "consistent", a: "say-junho", b: "locker" },
      ],
    },
    {
      text: "준호는 17:00에 휴게실에 있었다고 했습니다. 그때 준호는 기록실에 있었으므로 함께 성립할 수 없습니다. 기록과 맞지 않는 것은 준호의 진술입니다.",
      facts: [{ kind: "contradicts", a: "say-junho", b: "fact-junho" }],
    },
  ],
  solution: { statement: "say-junho", against: "fact-junho" },
  reward: 0,
};

/* ───────── 특수 도전 · 암호 해독 ─────────
 * 푸는 길: 네 번의 시도가 모두 '위치 0'이다. '일치 없음'도, 새겨진 글도 없어 바로 지울 숫자가 하나도 없다.
 * ① 9352 와 2497 은 셋씩 맞았는데 암호는 네 자리뿐이라, 두 기록이 함께 가진 9 와 2 가 모두 들어 있어야 한다(겹침으로 숫자를 정한다).
 * ② 1283 이 3 을 정하면 숫자는 2·3·9 와 "4 아니면 7"로 좁혀진다. 맞은 수만으로는 여기서 더 갈 수 없다.
 * ③ 숫자마다 적혔던 자리를 지우면 9 · 2 · 3 의 자리가 차례로 하나씩만 남는다.
 * ④ 마지막 자리에서 7 은 바로 그 자리에 적혀 틀렸던 숫자다. 자리가 숫자를 정한다.
 * 숫자를 정하는 단계와 자리를 정하는 단계가 서로를 마무리한다. (다른 네 자리 문제: 연습 B 는 두 기록의 차이, 시험 A→S 는 합으로 묶음 세우기)
 */
export const SPECIAL_CODE_1: CodePuzzle = {
  id: "special-code-001",
  type: "code",
  category: "practice",
  special: true,
  title: "한 번도 못 맞힌 자리",
  typeLabel: "조건 추론 · 암호 해독",
  difficulty: 5,
  rank: "C",
  minutes: 6,
  intro: "자료실 깊은 곳의 낡은 금고. 네 번의 시도는 한 번도 자리를 맞히지 못했다.",
  description:
    "금고의 암호는 1부터 9까지 서로 다른 숫자 4개입니다. 네 번의 시도는 숫자를 맞히고도 위치는 한 번도 맞히지 못했습니다. 어떤 숫자가 들었는지부터 가려내고, 틀린 자리를 지워 가며 암호를 찾아내세요.",
  outro: "철컥. 문 안쪽에 새겨진 한 줄. '틀린 자리도 지우면 길이 된다.'",
  rules: {
    length: 4,
    digits: D9,
    clues: [
      { guess: [9, 3, 5, 2], match: 3, inPlace: 0 },
      { guess: [2, 4, 9, 7], match: 3, inPlace: 0 },
      { guess: [1, 2, 8, 3], match: 2, inPlace: 0 },
      { guess: [8, 3, 6, 9], match: 2, inPlace: 0 },
    ],
  },
  hints: [
    {
      text: "9352와 2497은 숫자가 셋씩 맞았습니다. 암호는 네 자리뿐이라, 두 기록에서 맞은 숫자가 서로 겹쳐야 합니다. 두 기록에 함께 적힌 숫자를 찾아보세요.",
      facts: [
        { kind: "present", digit: 9 },
        { kind: "present", digit: 2 },
      ],
    },
    {
      text: "숫자를 가려냈다면 자리입니다. 9는 세 기록에 적혔고 적힌 자리가 모두 다릅니다. 위치가 한 번도 맞지 않았으니 그 세 자리에는 9가 없습니다. 남는 자리는 한 곳뿐입니다.",
      facts: [{ kind: "at", digit: 9, position: 1 }],
    },
  ],
  explanation: [
    {
      text: "9352와 2497은 숫자가 셋씩 맞았습니다. 두 기록이 함께 가진 숫자는 9와 2뿐인데, 암호는 네 자리뿐이라 맞은 숫자가 둘은 겹쳐야 합니다. 9와 2가 모두 암호에 있고, 3과 5 가운데 하나, 4와 7 가운데 하나가 더 있습니다.",
      facts: [
        { kind: "present", digit: 9 },
        { kind: "present", digit: 2 },
        { kind: "absent", digits: [1, 6, 8] },
      ],
    },
    {
      text: "1283은 숫자 둘이 맞았습니다. 1과 8은 암호에 없으니 맞은 둘은 2와 3입니다. 3이 있으므로 5는 없습니다. 8369에서 맞은 둘도 3과 9로 들어맞습니다.",
      facts: [
        { kind: "present", digit: 3 },
        { kind: "absent", digits: [5] },
      ],
    },
    {
      text: "이제 자리입니다. 위치는 한 번도 맞지 않았습니다. 9는 첫째(9352), 셋째(2497), 넷째(8369) 자리에 적혔으므로 둘째 자리입니다. 2는 넷째, 첫째, 둘째 자리에 적혔으므로 셋째 자리입니다.",
      facts: [
        { kind: "at", digit: 9, position: 1 },
        { kind: "at", digit: 2, position: 2 },
      ],
    },
    {
      text: "3은 둘째와 넷째 자리에 적혔으므로 남은 첫째 자리입니다. 넷째 자리에는 4 아니면 7이 오는데, 7은 2497에서 바로 그 넷째 자리에 적혀 위치가 틀렸습니다. 넷째 자리는 4입니다. 암호는 3924입니다.",
      facts: [
        { kind: "absent", digits: [7] },
        { kind: "at", digit: 3, position: 0 },
        { kind: "at", digit: 9, position: 1 },
        { kind: "at", digit: 2, position: 2 },
        { kind: "at", digit: 4, position: 3 },
      ],
    },
  ],
  solution: [3, 9, 2, 4],
  reward: 60,
};

/**
 * 연습실에서 같은 등급 안의 순서가 된다(기존 과제 뒤에 놓인다): F 순서·증거 · D 암호·인장 · C 진술·증거·특수 도전.
 * 시험 문제는 data/ranks.ts 의 D→C 시험 목록이 가리킨다.
 */
export const ADDED_SET: Puzzle[] = [
  PRACTICE_SCHEDULE_F,
  PRACTICE_EVIDENCE_F,
  PRACTICE_CODE_D,
  PRACTICE_SEAL_D,
  PRACTICE_TRUTH_C,
  PRACTICE_EVIDENCE_C,
  EXAM_EVIDENCE_D_C,
  SPECIAL_CODE_1,
];
