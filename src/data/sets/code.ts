/**
 * 암호 해독 · 연습실 셋과 승급 시험 셋 (V3 GATE 05).
 *
 * 화면은 모두 자료실의 금고 장면이다. 여섯 문제는 푸는 길이 서로, 그리고 일일 문제의 두 암호와 다르다
 * (문제마다 "푸는 길"을 적어 두었고, 그 길이 맞는지는 src/tests/sets-code.test.ts 가 전수 탐색으로 본다).
 * 기록과 조건은 어느 한 줄을 빼도 답이 여럿이 된다.
 *
 * solution 은 개발·검증용이다. 화면에는 플레이어가 해결한 뒤에만 노출한다.
 */
import type { CodePuzzle } from "../../engine/types";

const TYPE_LABEL = "조건 추론 · 암호 해독";
const D9 = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/*
 * 푸는 길: 숫자가 여섯 개뿐이라 '일치 없음' 한 줄이 암호의 숫자 셋을 그대로 남긴다.
 * 그 뒤 두 줄은 '위치도 정확'과 '위치 틀림'을 한 번씩 읽는 연습이다. (기록의 세 가지 결과를 하나씩 배운다)
 */
export const PRACTICE_CODE_F: CodePuzzle = {
  id: "practice-code-f",
  type: "code",
  category: "practice",
  title: "신입생의 연습 금고",
  typeLabel: TYPE_LABEL,
  difficulty: 1,
  rank: "F",
  minutes: 2,
  intro: "자료실 구석의 작은 금고. 신입생이 처음 여는 연습용이다.",
  description:
    "신입생 연습용 금고는 1부터 6까지 서로 다른 숫자 3개로 잠겨 있습니다. 앞서 시도한 세 번의 기록을 단서로 암호를 찾아내세요.",
  outro: "철컥. 금고 안에는 쪽지 한 장. '기록 읽는 법은 익혔군.'",
  rules: {
    length: 3,
    digits: [1, 2, 3, 4, 5, 6],
    clues: [
      { guess: [2, 4, 6], match: 0, inPlace: 0 },
      { guess: [3, 2, 4], match: 1, inPlace: 1 },
      { guess: [2, 1, 6], match: 1, inPlace: 0 },
    ],
  },
  hints: [
    {
      text: "일치하는 숫자가 없는 기록부터 보세요. 쓸 수 있는 숫자는 여섯 개뿐이라, 그 기록의 세 숫자를 지우면 암호에 쓰인 숫자 세 개가 그대로 남습니다.",
      facts: [{ kind: "absent", digits: [2, 4, 6] }],
    },
    {
      text: "324에서 맞는 숫자는 하나입니다. 2와 4는 이미 지웠으니 맞는 숫자는 3이고, '위치도 정확'이므로 3은 적힌 자리 그대로입니다.",
      facts: [{ kind: "at", digit: 3, position: 0 }],
    },
  ],
  explanation: [
    {
      text: "246은 일치하는 숫자가 없으므로 2, 4, 6은 암호에 없습니다. 쓸 수 있는 숫자는 여섯 개뿐이니 암호는 1, 3, 5로 이루어집니다.",
      facts: [
        { kind: "absent", digits: [2, 4, 6] },
        { kind: "present", digit: 1 },
        { kind: "present", digit: 3 },
        { kind: "present", digit: 5 },
      ],
    },
    {
      text: "324에서 2와 4는 없으므로 맞는 숫자는 3입니다. 위치도 정확하므로 3은 첫째 자리입니다.",
      facts: [{ kind: "at", digit: 3, position: 0 }],
    },
    {
      text: "216에서 2와 6은 없으므로 맞는 숫자는 1입니다. 위치가 틀렸으므로 1은 둘째 자리가 아닙니다. 첫째 자리는 3이니 1은 셋째 자리입니다.",
      facts: [
        { kind: "notAt", digit: 1, position: 1 },
        { kind: "at", digit: 1, position: 2 },
      ],
    },
    {
      text: "남은 둘째 자리에 5가 들어갑니다. 암호는 351입니다.",
      facts: [
        { kind: "at", digit: 3, position: 0 },
        { kind: "at", digit: 5, position: 1 },
        { kind: "at", digit: 1, position: 2 },
      ],
    },
  ],
  solution: [3, 5, 1],
  reward: 30,
};

/*
 * 푸는 길: 472 에서 두 숫자가 맞았으니 암호는 "그 둘 + 하나"다. 새겨진 합으로 그 하나를 계산하면
 * 가능한 묶음이 둘(2·4·9, 2·6·7)로 줄고(4와 7은 4가 겹쳐 안 된다), 915 가 하나를 지운다. 그 뒤에 자리를 정한다.
 * (조건을 계산에 쓴다. '일치 없음' 기록은 없다)
 */
export const EXAM_CODE_D_C: CodePuzzle = {
  id: "exam-code-d-c",
  type: "code",
  category: "exam",
  title: "글이 새겨진 금고",
  typeLabel: TYPE_LABEL,
  difficulty: 3,
  rank: "D",
  minutes: 4,
  intro: "자료실. 금고 문에 못 보던 글 한 줄이 새겨져 있다.",
  description:
    "금고의 암호는 1부터 9까지 서로 다른 숫자 3개입니다. 이번에는 금고 문에 조건 한 줄이 새겨져 있습니다. 세 번의 시도 기록과 새겨진 글을 함께 써서 암호를 찾아내세요.",
  outro: "철컥. 안쪽 문에도 한 줄이 새겨져 있다. '셈은 거짓말을 하지 않는다.'",
  rules: {
    length: 3,
    digits: D9,
    clues: [
      { guess: [4, 7, 2], match: 2, inPlace: 0 },
      { guess: [9, 1, 5], match: 1, inPlace: 0 },
      { guess: [3, 8, 9], match: 1, inPlace: 0 },
    ],
    conditions: [{ kind: "sum", value: 15, text: "세 숫자의 합은 15다." }],
  },
  hints: [
    {
      text: "472부터 보세요. 두 숫자가 맞았고 암호는 세 자리이니, 4·7·2 가운데 둘에 숫자 하나를 더한 것이 암호입니다. 새겨진 합으로 그 하나를 계산할 수 있습니다.",
      facts: [],
    },
    {
      text: "4와 7이라면 남은 숫자가 4가 되어 겹칩니다. 4와 2라면 9, 7과 2라면 6입니다. 어느 쪽이든 2는 암호에 있습니다. 915에 맞는 숫자가 하나 있다는 점으로 둘 중 하나를 지우세요.",
      facts: [{ kind: "present", digit: 2 }],
    },
  ],
  explanation: [
    {
      text: "472는 두 숫자가 맞습니다. 암호는 세 자리이므로 4·7·2 가운데 둘과, 그 밖의 숫자 하나로 이루어집니다.",
      facts: [],
    },
    {
      text: "합이 15가 되도록 남은 하나를 계산합니다. 4와 7이면 4가 한 번 더 필요해 불가능하고, 4와 2면 9, 7과 2면 6입니다. 어느 쪽이든 2는 암호에 있습니다.",
      facts: [{ kind: "present", digit: 2 }],
    },
    {
      text: "915는 숫자 하나가 맞습니다. 2·6·7에는 9, 1, 5가 없으므로 암호의 숫자는 2, 4, 9입니다.",
      facts: [
        { kind: "present", digit: 4 },
        { kind: "present", digit: 9 },
        { kind: "absent", digits: [1, 3, 5, 6, 7, 8] },
      ],
    },
    {
      text: "9는 915에서 첫째 자리, 389에서 셋째 자리에 적혔는데 둘 다 위치가 틀렸습니다. 9는 둘째 자리입니다.",
      facts: [{ kind: "at", digit: 9, position: 1 }],
    },
    {
      text: "472에서 4는 위치가 틀렸으므로 첫째 자리가 아니고, 남은 셋째 자리에 들어갑니다. 첫째 자리가 2입니다. 암호는 294입니다.",
      facts: [
        { kind: "at", digit: 2, position: 0 },
        { kind: "at", digit: 9, position: 1 },
        { kind: "at", digit: 4, position: 2 },
      ],
    },
  ],
  solution: [2, 9, 4],
  reward: 0,
};

/*
 * 푸는 길: '일치 없음' 기록이 하나도 없어 바로 지울 숫자가 없다. 358 의 "둘이 맞았다"에서 세 가정
 * (3·5 / 3·8 / 5·8)을 세우고, 531 과 816 에 비추어 둘을 모순으로 지운다. (가정 → 모순)
 */
export const PRACTICE_CODE_C: CodePuzzle = {
  id: "practice-code-c",
  type: "code",
  category: "practice",
  title: "빗나간 적 없는 기록",
  typeLabel: TYPE_LABEL,
  difficulty: 3,
  rank: "C",
  minutes: 4,
  intro: "자료실. 책상의 기록 네 줄은 모두 무언가를 맞혔다.",
  description:
    "금고의 암호는 1부터 9까지 서로 다른 숫자 3개입니다. 네 번의 시도는 모두 숫자를 하나 이상 맞혔습니다. 바로 지울 숫자가 없으니, 가정을 세우고 기록과 어긋나는지 따져 보세요.",
  outro: "철컥. 금고가 열렸다. 안에는 세 번 접힌 시험 감독 일지가 있다.",
  rules: {
    length: 3,
    digits: D9,
    clues: [
      { guess: [3, 5, 8], match: 2, inPlace: 0 },
      { guess: [5, 3, 1], match: 1, inPlace: 1 },
      { guess: [8, 1, 6], match: 1, inPlace: 0 },
      { guess: [4, 2, 9], match: 1, inPlace: 1 },
    ],
  },
  hints: [
    {
      text: "358은 두 숫자가 맞았습니다. 3과 5, 3과 8, 5와 8의 세 가지 가정을 하나씩 세우고, 다른 기록과 어긋나는지 보세요.",
      facts: [],
    },
    {
      text: "3과 5가 함께 있다면 531에서도 둘이 맞아야 하는데, 531은 하나만 맞았습니다. 그러니 8은 반드시 암호에 있고, 3과 5 가운데 하나만 있습니다. 531의 1은 암호에 없습니다.",
      facts: [
        { kind: "present", digit: 8 },
        { kind: "absent", digits: [1] },
      ],
    },
  ],
  explanation: [
    {
      text: "358은 두 숫자가 맞습니다. 3과 5가 함께 암호에 있다면 531에서도 두 숫자가 맞아야 하는데 하나만 맞았습니다. 따라서 8은 암호에 있고, 3과 5 가운데 하나만 있습니다. 531의 1은 암호에 없습니다.",
      facts: [
        { kind: "present", digit: 8 },
        { kind: "absent", digits: [1] },
      ],
    },
    {
      text: "816에서 맞는 숫자는 하나뿐이므로 8이 그 숫자이고 6은 없습니다. 8은 816의 첫째 자리도, 358의 셋째 자리도 아니므로 둘째 자리입니다.",
      facts: [
        { kind: "absent", digits: [6] },
        { kind: "at", digit: 8, position: 1 },
      ],
    },
    {
      text: "남은 하나가 3이라고 가정해 봅니다. 531에서 맞는 숫자는 위치까지 정확해야 하므로 3은 둘째 자리여야 하는데, 그 자리는 8입니다. 모순이므로 남은 하나는 5이고, 531에 따라 첫째 자리입니다.",
      facts: [
        { kind: "absent", digits: [3] },
        { kind: "at", digit: 5, position: 0 },
      ],
    },
    {
      text: "429는 숫자 하나가 위치까지 맞습니다. 비어 있는 자리는 셋째뿐이므로 맞는 숫자는 셋째 자리의 9입니다. 암호는 589입니다.",
      facts: [
        { kind: "at", digit: 5, position: 0 },
        { kind: "at", digit: 8, position: 1 },
        { kind: "at", digit: 9, position: 2 },
      ],
    },
  ],
  solution: [5, 8, 9],
  reward: 40,
};

/*
 * 푸는 길: 네 자리. 마지막 숫자만 다른 두 기록(1234 · 1235)의 차이에서 "4는 있고 5는 없다"를 얻고,
 * 위치 정보(4는 넷째가 아니다)를 챙긴 뒤, '일치 없음'으로 숫자 넷을 확정하고, 마지막 기록에서 자리를 모순으로 가른다.
 * 어느 기록에도 적히지 않은 7 은 남는 숫자로 드러난다. (기록의 차이 → 자리를 여러 단계로 좁히기)
 */
export const PRACTICE_CODE_B: CodePuzzle = {
  id: "practice-code-b",
  type: "code",
  category: "practice",
  title: "네 자리로 바뀐 금고",
  typeLabel: TYPE_LABEL,
  difficulty: 4,
  rank: "B",
  minutes: 5,
  intro: "자료실. 금고의 숫자 드럼이 하나 늘어 네 개가 되어 있다.",
  description:
    "금고의 암호가 1부터 9까지 서로 다른 숫자 4개로 바뀌었습니다. 네 번의 시도 기록이 남아 있습니다. 거의 같은 두 기록의 차이에서 시작해, 숫자가 놓일 자리를 차례로 좁혀 보세요.",
  outro: "철컥. 네 번째 드럼이 멈추고 문이 열렸다. 안에는 야간 순찰표가 있다.",
  rules: {
    length: 4,
    digits: D9,
    clues: [
      { guess: [1, 2, 3, 4], match: 2, inPlace: 1 },
      { guess: [1, 2, 3, 5], match: 1, inPlace: 1 },
      { guess: [6, 8, 1, 3], match: 0, inPlace: 0 },
      { guess: [9, 5, 4, 8], match: 2, inPlace: 1 },
    ],
  },
  hints: [
    {
      text: "1234와 1235는 마지막 숫자만 다릅니다. 4를 5로 바꾸자 맞는 숫자가 하나 줄었습니다. 4와 5 가운데 무엇이 암호에 있는지 알 수 있습니다.",
      facts: [
        { kind: "present", digit: 4 },
        { kind: "absent", digits: [5] },
      ],
    },
    {
      text: "1235에서 맞은 숫자 하나는 1, 2, 3 가운데 있고 위치도 정확합니다. 6813에 일치하는 숫자가 없다는 것으로 그 숫자를 가려내세요. 그 숫자는 적힌 자리 그대로입니다.",
      facts: [
        { kind: "absent", digits: [1, 3, 6, 8] },
        { kind: "at", digit: 2, position: 1 },
      ],
    },
  ],
  explanation: [
    {
      text: "1234와 1235는 넷째 숫자만 다릅니다. 4를 5로 바꾸자 맞는 숫자가 둘에서 하나로 줄었으므로 4는 암호에 있고 5는 없습니다. 1, 2, 3 가운데서는 정확히 하나만 암호에 있습니다.",
      facts: [
        { kind: "present", digit: 4 },
        { kind: "absent", digits: [5] },
      ],
    },
    {
      text: "1235에서 맞은 하나는 위치도 정확합니다. 그 숫자는 1234에서도 같은 자리에 적혀 있으니, 1234에서 위치가 정확한 하나가 바로 그 숫자입니다. 따라서 4는 넷째 자리가 아닙니다.",
      facts: [{ kind: "notAt", digit: 4, position: 3 }],
    },
    {
      text: "6813은 일치하는 숫자가 없으므로 1과 3은 없고, 남은 2가 둘째 자리에 있습니다. 1, 3, 5, 6, 8이 모두 빠졌으니 나머지 두 숫자는 7과 9입니다.",
      facts: [
        { kind: "absent", digits: [1, 3, 6, 8] },
        { kind: "at", digit: 2, position: 1 },
        { kind: "present", digit: 7 },
        { kind: "present", digit: 9 },
      ],
    },
    {
      text: "9548에서 5와 8은 없으므로 맞은 둘은 9와 4이고, 하나만 위치가 정확합니다. 9가 첫째 자리라면 4는 셋째 자리에 올 수 없는데, 둘째 자리는 2이고 넷째 자리는 앞에서 지웠으니 갈 곳이 없습니다. 그러므로 4가 셋째 자리이고 9는 첫째 자리가 아닙니다.",
      facts: [
        { kind: "at", digit: 4, position: 2 },
        { kind: "notAt", digit: 9, position: 0 },
      ],
    },
    {
      text: "9는 남은 넷째 자리, 7은 첫째 자리입니다. 암호는 7249입니다.",
      facts: [
        { kind: "at", digit: 7, position: 0 },
        { kind: "at", digit: 2, position: 1 },
        { kind: "at", digit: 4, position: 2 },
        { kind: "at", digit: 9, position: 3 },
      ],
    },
  ],
  solution: [7, 2, 4, 9],
  reward: 45,
};

/*
 * 푸는 길: 새겨진 두 줄이 기록만큼 일한다. "홀수는 하나뿐"으로 513 의 하나가 유일한 홀수임을 알고(7·9 가 빠진다),
 * 839 로 그 홀수가 3 임을 정한 뒤, "첫째 > 셋째"로 첫째 자리의 짝수를 걸러 낸다. (홀짝 세기 + 크기 비교)
 */
export const EXAM_CODE_B_A: CodePuzzle = {
  id: "exam-code-b-a",
  type: "code",
  category: "exam",
  title: "두 줄이 새겨진 금고",
  typeLabel: TYPE_LABEL,
  difficulty: 4,
  rank: "B",
  minutes: 4,
  intro: "자료실. 금고 문의 글이 두 줄로 늘었다. 기록은 세 번뿐이다.",
  description:
    "금고의 암호는 1부터 9까지 서로 다른 숫자 3개입니다. 금고 문에는 조건 두 줄이 새겨져 있고, 시도 기록은 세 번뿐입니다. 기록과 새겨진 글을 모두 만족하는 암호를 찾아내세요.",
  outro: "철컥. 금고가 열렸다. 안에는 봉인된 상급 과정 명단이 들어 있다.",
  rules: {
    length: 3,
    digits: D9,
    clues: [
      { guess: [5, 1, 3], match: 1, inPlace: 1 },
      { guess: [6, 4, 2], match: 1, inPlace: 0 },
      { guess: [8, 3, 9], match: 2, inPlace: 0 },
    ],
    conditions: [
      { kind: "oddCount", count: 1, text: "홀수는 하나뿐이다." },
      { kind: "greater", a: 0, b: 2, text: "첫째 숫자는 셋째 숫자보다 크다." },
    ],
  },
  hints: [],
  explanation: [
    {
      text: "홀수는 하나뿐인데 513에서 숫자 하나가 맞았습니다. 513은 모두 홀수이므로 그 하나가 암호의 유일한 홀수이고, 7과 9는 암호에 없습니다.",
      facts: [{ kind: "absent", digits: [7, 9] }],
    },
    {
      text: "839에서 9는 없으므로 맞은 둘은 8과 3입니다. 암호의 홀수는 3이고, 513에서 위치까지 정확하므로 3은 셋째 자리입니다. 1과 5는 없습니다.",
      facts: [
        { kind: "present", digit: 8 },
        { kind: "at", digit: 3, position: 2 },
        { kind: "absent", digits: [1, 5] },
      ],
    },
    {
      text: "8은 839에서 위치가 틀렸으므로 첫째 자리가 아니고, 셋째 자리는 3이므로 둘째 자리입니다.",
      facts: [{ kind: "at", digit: 8, position: 1 }],
    },
    {
      text: "첫째 자리는 남은 짝수 2, 4, 6 가운데 하나이고, 셋째 자리의 3보다 커야 하므로 4 또는 6입니다. 642는 하나만 맞고 위치가 틀렸는데, 6이 첫째 자리라면 위치가 정확해집니다. 따라서 첫째 자리는 4입니다. 암호는 483입니다.",
      facts: [
        { kind: "absent", digits: [2, 6] },
        { kind: "at", digit: 4, position: 0 },
        { kind: "at", digit: 8, position: 1 },
        { kind: "at", digit: 3, position: 2 },
      ],
    },
  ],
  solution: [4, 8, 3],
  reward: 0,
};

/*
 * 푸는 길: 네 자리에 기록은 세 줄, 그나마 맞은 숫자도 적다. 먼저 합 28 로 숫자 묶음을 둘(4·7·8·9, 5·6·8·9)로 세운다.
 * 기록 두 줄과 "첫째 > 넷째"로 9 와 8 의 자리를 모순으로 정하고, 마지막 기록의 4 와 5(서로 다른 묶음)로 묶음과 나머지 자리를 가른다.
 * (조건으로 묶음부터 세우기 → 크기 비교로 자리 정하기 → 묶음 가르기)
 */
export const EXAM_CODE_A_S: CodePuzzle = {
  id: "exam-code-a-s",
  type: "code",
  category: "exam",
  title: "학원장의 금고",
  typeLabel: TYPE_LABEL,
  difficulty: 5,
  rank: "A",
  minutes: 6,
  intro: "자료실 가장 안쪽. 학원장의 금고에는 기록이 세 줄뿐이다.",
  description:
    "학원장의 금고는 1부터 9까지 서로 다른 숫자 4개로 잠겨 있습니다. 금고 문에는 조건 두 줄이 새겨져 있고, 시도 기록은 세 번뿐입니다. 이 금고에서는 기록보다 새겨진 글이 더 많은 것을 말해 줍니다.",
  outro: "철컥. 마지막 금고가 열렸다. 안에는 이름이 비어 있는 증서 한 장.",
  rules: {
    length: 4,
    digits: D9,
    clues: [
      { guess: [9, 8, 1, 2], match: 2, inPlace: 0 },
      { guess: [2, 9, 3, 1], match: 1, inPlace: 0 },
      { guess: [1, 4, 5, 2], match: 1, inPlace: 1 },
    ],
    conditions: [
      { kind: "sum", value: 28, text: "네 숫자의 합은 28이다." },
      { kind: "greater", a: 0, b: 3, text: "첫째 숫자는 넷째 숫자보다 크다." },
    ],
  },
  hints: [],
  explanation: [
    {
      text: "서로 다른 네 숫자의 합이 28이 되려면 큰 숫자가 필요합니다. 가장 큰 네 숫자 9, 8, 7, 6의 합이 30이므로 2만 덜어내면 됩니다. 6을 4로 바꾼 4·7·8·9, 또는 7을 5로 바꾼 5·6·8·9 둘뿐입니다. 어느 쪽이든 8과 9는 있고 1, 2, 3은 없습니다.",
      facts: [
        { kind: "present", digit: 8 },
        { kind: "present", digit: 9 },
        { kind: "absent", digits: [1, 2, 3] },
      ],
    },
    {
      text: "9812에서 맞은 둘은 9와 8이고 모두 위치가 틀렸습니다. 9는 첫째 자리가 아니고 8은 둘째 자리가 아닙니다. 2931에서 맞은 하나는 9이고 위치가 틀렸으므로 9는 둘째 자리도 아닙니다.",
      facts: [
        { kind: "notAt", digit: 9, position: 0 },
        { kind: "notAt", digit: 8, position: 1 },
        { kind: "notAt", digit: 9, position: 1 },
      ],
    },
    {
      text: "첫째 숫자가 넷째 숫자보다 커야 하므로 가장 큰 9는 넷째 자리에 올 수 없습니다. 9는 셋째 자리입니다. 8이 넷째 자리라면 첫째 자리에 9가 와야 하므로, 8은 첫째 자리입니다.",
      facts: [
        { kind: "at", digit: 9, position: 2 },
        { kind: "at", digit: 8, position: 0 },
      ],
    },
    {
      text: "1452에서 4와 5는 서로 다른 묶음의 숫자이므로 맞은 하나는 4 아니면 5이고, 위치까지 정확합니다. 5라면 셋째 자리여야 하는데 그 자리는 9입니다. 따라서 묶음은 4·7·8·9이고 4는 둘째 자리, 남은 7이 넷째 자리입니다. 암호는 8497입니다.",
      facts: [
        { kind: "absent", digits: [5, 6] },
        { kind: "at", digit: 8, position: 0 },
        { kind: "at", digit: 4, position: 1 },
        { kind: "at", digit: 9, position: 2 },
        { kind: "at", digit: 7, position: 3 },
      ],
    },
  ],
  solution: [8, 4, 9, 7],
  reward: 0,
};

/** 표의 순서: 연습 F · 시험 D→C · 연습 C · 연습 B · 시험 B→A · 시험 A→S */
export const CODE_SET: CodePuzzle[] = [PRACTICE_CODE_F, EXAM_CODE_D_C, PRACTICE_CODE_C, PRACTICE_CODE_B, EXAM_CODE_B_A, EXAM_CODE_A_S];
