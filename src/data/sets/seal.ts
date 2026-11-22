/**
 * 공간 추론 · 인장 대조 여섯 문제 (V3 GATE 05).
 * 연습실 셋(F · C · A)과 승급 시험 셋(C→B · B→A · A→S).
 *
 * 도장을 찍으면 자국은 도장 면의 좌우가 뒤집힌 모양이고, 도장은 네 방향으로 돌려 찍을 수 있다.
 * 여섯 문제는 크기, 도장의 수, 번진 칸의 수, 시험 종이의 수가 서로(그리고 일일 문제의 두 문제와도) 다르고,
 * 오답 도장이 답과 맺는 관계가 문제마다 다르다(문제 위의 "푸는 길").
 *
 * solution 은 개발·검증용이다. 화면에는 플레이어가 해결한 뒤에만 노출한다.
 * 정답이 하나뿐인지, 그림과 해설이 맞는지는 src/tests/sets-seal.test.ts 가 전수 탐색으로 확인한다.
 */
import type { SpatialPuzzle } from "../../engine/types";

const TYPE_LABEL = "공간 추론 · 인장 대조";

/* ───────── 연습 F · 깃발 ─────────
 * 푸는 길: 좌우 반전을 배우는 입문. 도장은 셋뿐이다. 자국과 똑같아 보이는 서문 도장(답의 거울상)을 지우고,
 * 깃발이 장대 가운데 달린 정문 도장을 지우면 동문 도장이 남는다. 시험 종이가 넉넉해(세 장) 찍어 보며 규칙을 익힌다.
 */
export const PRACTICE_SEAL_F: SpatialPuzzle = {
  id: "practice-seal-f",
  type: "spatial",
  category: "practice",
  title: "밤 통행증의 인장",
  typeLabel: TYPE_LABEL,
  difficulty: 1,
  rank: "F",
  minutes: 2,
  intro: "복도에 떨어진 야간 통행증 한 장. 깃발 무늬 인장이 옆으로 누운 채 찍혀 있다.",
  description:
    "도장을 찍으면 자국은 좌우가 뒤집힙니다. 도장을 돌려 보며 자국을 낸 도장과 방향을 찾으세요. 시험 종이 세 장에 먼저 찍어 볼 수 있습니다.",
  outro: "자국은 동문 도장의 것이다. 통행증은 정문이 아니라 동문에서 찍혔다.",
  rules: {
    size: 5,
    imprint: ["....#", "#####", "###.#", ".#...", "....."],
    trials: 3,
    stamps: [
      { id: "main", name: "정문 도장", face: [".#...", ".##..", ".###.", ".##..", "###.."] },
      { id: "west", name: "서문 도장", face: ["..##.", ".###.", "..##.", "...#.", "..###"] },
      { id: "east", name: "동문 도장", face: [".##..", ".###.", ".##..", ".#...", "###.."] },
    ],
  },
  hints: [
    {
      text: "시험 종이에 도장을 하나 찍어 보세요. 도장 면의 깃발과 자국의 깃발은 나부끼는 쪽이 서로 반대입니다. 그래서 돌려 보았을 때 자국과 똑같아 보이는 도장은 오히려 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "west" }],
    },
    {
      text: "자국의 깃발은 장대의 맨 끝에 달려 있습니다. 깃발이 장대 가운데에 달린 도장은 어느 방향으로 찍어도 맞지 않습니다.",
      facts: [{ kind: "stampIsNot", stamp: "main" }],
    },
  ],
  explanation: [
    {
      text: "도장을 찍으면 좌우가 뒤집힙니다. 서문 도장은 세 번 돌려 보면 자국과 똑같아 보이지만, 찍으면 뒤집힌 무늬가 나오므로 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "west" }],
    },
    {
      text: "정문 도장은 깃발이 장대 가운데에 달려 있습니다. 자국의 깃발은 장대 맨 끝에 달려 있으므로 어느 방향으로 찍어도 맞지 않습니다.",
      facts: [{ kind: "stampIsNot", stamp: "main" }],
    },
    {
      text: "동문 도장은 깃발이 장대 끝에서 오른쪽으로 나부낍니다. 한 번 돌려 찍으면 자국과 정확히 겹칩니다.",
      facts: [
        { kind: "turnIsNot", turn: 0 },
        { kind: "turnIsNot", turn: 2 },
        { kind: "turnIsNot", turn: 3 },
      ],
    },
  ],
  solution: { stamp: "east", turn: 1 },
  reward: 30,
};

/* ───────── 연습 C · 등불 ─────────
 * 푸는 길: 네 도장이 같은 등불 무늬를 네 방향으로 놓은 것처럼 보인다. 받침을 아래로 오게 돌려 놓고 견준다.
 * 팔이 뻗는 쪽이 혼자 반대인 열람실 도장(거울상)을 지우고, 같은 쪽인 셋은 팔이 붙은 높이(제본실, 네 칸 차이)와
 * 등줄·받침의 길이(서고, 두 칸 차이)를 세어 가른다.
 */
export const PRACTICE_SEAL_C: SpatialPuzzle = {
  id: "practice-seal-c",
  type: "spatial",
  category: "practice",
  title: "대출표의 등불 인장",
  typeLabel: TYPE_LABEL,
  difficulty: 3,
  rank: "C",
  minutes: 4,
  intro: "돌아오지 않은 책의 대출표. 등불 무늬 인장이 찍혀 있고, 도서관의 도장 넷은 서로 닮았다.",
  description:
    "네 도장은 모두 기둥에 등이 달린 무늬이고, 놓인 방향이 제각각입니다. 찍으면 좌우가 뒤집힙니다. 자국을 낸 도장과 방향을 찾으세요. 시험 종이는 두 장뿐입니다.",
  outro: "자국은 필사실 도장의 것이다. 책은 열람실이 아니라 필사실에서 나갔다.",
  rules: {
    size: 5,
    imprint: ["....#", "#####", "#...#", "###..", "....."],
    trials: 2,
    stamps: [
      { id: "reading", name: "열람실 도장", face: [".....", "..###", "#...#", "#####", "#...."] },
      { id: "stacks", name: "서고 도장", face: [".####", "...#.", "...#.", ".#.#.", ".###."] },
      { id: "scribe", name: "필사실 도장", face: [".....", "###..", "#...#", "#####", "....#"] },
      { id: "bindery", name: "제본실 도장", face: [".#...", ".###.", ".#.#.", ".#.#.", "###.."] },
    ],
  },
  hints: [
    {
      text: "도장마다 받침이 아래로 오게 돌려 놓고 견주어 보세요. 등이 달린 팔이 기둥의 어느 쪽으로 뻗는지 보면, 한 도장만 나머지 셋과 반대입니다. 찍으면 좌우가 뒤집힌다는 것을 떠올리세요.",
      facts: [{ kind: "stampIsNot", stamp: "reading" }],
    },
    {
      text: "팔이 같은 쪽으로 뻗는 세 도장은 팔이 붙은 높이, 등줄의 길이, 받침의 길이가 조금씩 다릅니다. 자국에서 팔은 기둥 맨 꼭대기에서 뻗고, 등줄은 두 칸입니다.",
      facts: [
        { kind: "stampIsNot", stamp: "bindery" },
        { kind: "stampIsNot", stamp: "stacks" },
      ],
    },
  ],
  explanation: [
    {
      text: "네 도장을 받침이 아래로 오게 돌려 놓으면, 열람실 도장만 팔이 왼쪽으로 뻗고 나머지 셋은 오른쪽으로 뻗습니다. 열람실 도장은 두 번 돌려 보면 자국과 똑같아 보이지만, 찍으면 뒤집히므로 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "reading" }],
    },
    {
      text: "제본실 도장은 팔이 기둥 꼭대기보다 한 칸 아래에서 뻗습니다. 자국의 팔은 기둥 맨 끝에서 뻗으므로 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "bindery" }],
    },
    {
      text: "서고 도장은 등줄이 한 칸이고 받침이 네 칸입니다. 자국은 등줄이 두 칸, 받침이 세 칸입니다. 가장 가깝게 찍어도 두 칸이 다릅니다.",
      facts: [{ kind: "stampIsNot", stamp: "stacks" }],
    },
    {
      text: "필사실 도장을 두 번 돌려 찍으면 자국과 정확히 겹칩니다.",
      facts: [
        { kind: "turnIsNot", turn: 0 },
        { kind: "turnIsNot", turn: 1 },
        { kind: "turnIsNot", turn: 3 },
      ],
    },
  ],
  solution: { stamp: "scribe", turn: 2 },
  reward: 40,
};

/* ───────── 시험 C→B · 촛대 ─────────
 * 푸는 길: 돌려도 뒤집어도 변하지 않는 관계를 본다. 손잡이와 불꽃이 초의 같은 쪽에 있는가, 반대쪽에 있는가.
 * 자국은 반대쪽이므로 같은 쪽인 두 도장이 한꺼번에 지워지고, 남은 둘 가운데 자국과 똑같아 보이는 쪽(거울상)을 지운다.
 * 제한 시간이 있는 시험이라 칸을 세지 않고도 풀리게 지었다. 시험 종이는 한 장.
 */
export const EXAM_SEAL_C_B: SpatialPuzzle = {
  id: "exam-seal-c-b",
  type: "spatial",
  category: "exam",
  title: "소등 점검표의 인장",
  typeLabel: TYPE_LABEL,
  difficulty: 3,
  rank: "C",
  minutes: 3,
  intro: "소등 점검표의 마지막 칸에 촛대 무늬 인장이 누운 채 찍혀 있다. 시험 종이는 한 장뿐이다.",
  description:
    "네 도장은 손잡이가 달린 쪽과 불꽃이 기운 쪽이 서로 다릅니다. 찍으면 좌우가 뒤집힙니다. 자국을 낸 도장과 방향을 찾으세요. 시험 종이는 한 장뿐입니다.",
  outro: "자국은 종탑 도장의 것이다. 그 밤 마지막으로 불을 끈 곳은 종탑이었다.",
  rules: {
    size: 5,
    imprint: [".....", "#...#", "####.", "#....", "##..."],
    trials: 1,
    stamps: [
      { id: "greenhouse", name: "온실 도장", face: [".#...", "..#..", "..#..", "#.#..", "####."] },
      { id: "dining", name: "식당 도장", face: [".#...", "..#..", "..#..", "..#.#", ".####"] },
      { id: "belfry", name: "종탑 도장", face: ["...#.", "..#..", "..#..", "#.#..", "####."] },
      { id: "storage", name: "창고 도장", face: ["...#.", "..#..", "..#..", "..#.#", ".####"] },
    ],
  },
  hints: [
    {
      text: "돌려도 뒤집어도 변하지 않는 것을 찾으세요. 손잡이와 불꽃이 초의 같은 쪽에 있는지, 서로 반대쪽에 있는지는 찍어도 바뀌지 않습니다.",
      facts: [
        { kind: "stampIsNot", stamp: "greenhouse" },
        { kind: "stampIsNot", stamp: "storage" },
      ],
    },
    {
      text: "자국에서 손잡이와 불꽃은 서로 반대쪽에 있습니다. 그런 도장은 둘인데, 돌려 보았을 때 자국과 똑같아 보이는 쪽은 찍으면 뒤집히므로 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "dining" }],
    },
  ],
  explanation: [
    {
      text: "손잡이와 불꽃이 초의 같은 쪽에 있는지 반대쪽에 있는지는 돌려도, 찍어서 뒤집혀도 바뀌지 않습니다. 자국에서는 둘이 서로 반대쪽에 있습니다. 온실 도장과 창고 도장은 둘이 같은 쪽에 있으므로 답이 아닙니다.",
      facts: [
        { kind: "stampIsNot", stamp: "greenhouse" },
        { kind: "stampIsNot", stamp: "storage" },
      ],
    },
    {
      text: "식당 도장은 한 번 돌려 보면 자국과 똑같아 보입니다. 찍으면 좌우가 뒤집히므로 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "dining" }],
    },
    {
      text: "종탑 도장은 손잡이가 왼쪽, 불꽃이 오른쪽입니다. 세 번 돌려 찍으면 자국과 정확히 겹칩니다.",
      facts: [
        { kind: "turnIsNot", turn: 0 },
        { kind: "turnIsNot", turn: 1 },
        { kind: "turnIsNot", turn: 2 },
      ],
    },
  ],
  solution: { stamp: "belfry", turn: 3 },
  reward: 0,
};

/* ───────── 연습 A · 돋보기 ─────────
 * 푸는 길: 서른여섯 칸 가운데 열네 칸이 번졌다. 보이는 것은 렌즈의 테 일부와 자루 끝뿐이고 빛점은 보이지 않는다.
 * "빛점은 번진 곳에 있다"에서 출발한다. 닮은꼴 둘(감식실·분석실)은 답과 두 칸씩 다르지만 그 한 칸이 번져서,
 * 각각 서로 다른 보이는 빈칸 하나로만 가려진다. 시험 종이는 한 장이라 어디에 쓸지도 골라야 한다.
 */
export const PRACTICE_SEAL_A: SpatialPuzzle = {
  id: "practice-seal-a",
  type: "spatial",
  category: "practice",
  title: "젖은 감정서의 인장",
  typeLabel: TYPE_LABEL,
  difficulty: 5,
  rank: "A",
  minutes: 5,
  intro: "비에 젖은 감정서 한 장. 돋보기 무늬 인장의 절반 가까이가 빗물에 번졌다.",
  description:
    "네 도장은 모두 돋보기와 빛점 하나의 무늬입니다. 번진 칸은 어떤 모양이었는지 알 수 없습니다. 보이는 칸이 모두 맞는 도장과 방향을 찾으세요. 찍으면 좌우가 뒤집힙니다. 시험 종이는 한 장뿐입니다.",
  outro: "자국은 표본실 도장의 것이다. 감정서는 감식실이 아니라 표본실에서 나왔다.",
  rules: {
    size: 6,
    imprint: [".##??.", "#..??.", "#..??.", ".????#", ".??...", ".??..."],
    trials: 1,
    stamps: [
      { id: "lab", name: "감식실 도장", face: ["...##.", "..#..#", "..#..#", "#####.", "......", "..#..."] },
      { id: "dark", name: "암실 도장", face: [".##...", "#..#..", "#..#..", ".#####", "......", ".#...."] },
      { id: "sample", name: "표본실 도장", face: ["..#...", "..#...", "..###.", "..#..#", "#.#..#", "...##."] },
      { id: "analysis", name: "분석실 도장", face: [".##...", "#..#..", "#..#..", ".###..", "...#..", ".#.#.."] },
    ],
  },
  hints: [
    {
      text: "보이는 것은 렌즈의 테 일부와 자루의 끝뿐입니다. 빛점은 어디에도 보이지 않습니다. 그렇다면 빛점은 번진 곳 어딘가에 있어야 합니다.",
      facts: [],
    },
    {
      text: "렌즈와 자루를 자국에 맞춰 찍었을 때 빛점이 어느 칸에 찍히는지 도장마다 따져 보세요. 빛점이 번지지 않은 빈칸에 찍히는 도장은 답이 아닙니다.",
      facts: [
        { kind: "stampIsNot", stamp: "lab" },
        { kind: "stampIsNot", stamp: "analysis" },
      ],
    },
  ],
  explanation: [
    {
      text: "암실 도장은 돌리지 않아도 보이는 칸이 자국과 모두 같습니다. 찍으면 좌우가 뒤집히므로 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "dark" }],
    },
    {
      text: "자국에는 렌즈의 테와 자루 끝이 보이고 빛점은 보이지 않습니다. 빛점은 번진 열네 칸 가운데 있어야 합니다. 감식실 도장은 돌리지 않고 찍으면 렌즈와 자루가 맞지만, 빛점이 맨 아랫줄의 왼쪽에서 넷째 칸에 찍힙니다. 자국에서 그 칸은 번지지 않았고 비어 있습니다.",
      facts: [{ kind: "stampIsNot", stamp: "lab" }],
    },
    {
      text: "분석실 도장은 한 번 돌려 찍으면 렌즈와 자루가 맞지만, 빛점이 위에서 둘째 줄의 맨 오른쪽 칸에 찍힙니다. 그 칸도 번지지 않았고 비어 있습니다.",
      facts: [{ kind: "stampIsNot", stamp: "analysis" }],
    },
    {
      text: "표본실 도장을 세 번 돌려 찍으면 빛점이 맨 아랫줄의 왼쪽에서 둘째 칸, 번진 곳에 들어가고 보이는 스물두 칸이 모두 맞습니다.",
      facts: [
        { kind: "turnIsNot", turn: 0 },
        { kind: "turnIsNot", turn: 1 },
        { kind: "turnIsNot", turn: 2 },
      ],
    },
  ],
  solution: { stamp: "sample", turn: 3 },
  reward: 50,
};

/* ───────── 시험 B→A · 우산 ─────────
 * 푸는 길: 시험 종이가 없다. 네 도장 가운데 셋이 자국과 닮았다(하나는 똑같고, 둘은 두 칸씩만 다르다).
 * 닮았다는 것은 뒤집히지 않았다는 뜻이므로 셋 다 답이 아니다. 손잡이가 굽는 쪽이 자국과 반대인 하나가 답이다.
 * 칸을 맞춰 보는 사람은 닮은 셋 사이에서 헤매고, 뒤집힘을 따지는 사람은 곧장 간다.
 */
export const EXAM_SEAL_B_A: SpatialPuzzle = {
  id: "exam-seal-b-a",
  type: "spatial",
  category: "exam",
  title: "주인 없는 보관증",
  typeLabel: TYPE_LABEL,
  difficulty: 4,
  rank: "B",
  minutes: 4,
  intro: "비 오는 밤, 현관에 주인 없는 보관증 한 장. 우산 무늬 인장은 또렷한데 시험 종이가 없다.",
  description:
    "시험 종이가 없습니다. 머릿속으로 도장을 돌리고 뒤집어, 자국을 낸 도장과 방향을 찾으세요. 찍으면 좌우가 뒤집힙니다.",
  outro: "자국은 별관 도장의 것이다. 우산의 주인은 그 밤 별관에 있었다.",
  rules: {
    size: 6,
    imprint: [".##...", "#.#...", "..#...", "######", ".####.", "..##.."],
    trials: 0,
    stamps: [
      { id: "mainhall", name: "본관 도장", face: ["..#..#", ".##..#", "######", "###...", ".##...", "..#..."] },
      { id: "annex", name: "별관 도장", face: [".#.#..", "#..##.", "######", "...###", "...##.", "...#.."] },
      { id: "auditorium", name: "강당 도장", face: [".##...", "#.#...", "..#...", "######", ".####.", "..##.."] },
      { id: "gym", name: "체육관 도장", face: ["...##.", ".####.", "######", "...#..", "...#.#", "...##."] },
    ],
  },
  hints: [],
  explanation: [
    {
      text: "강당 도장은 돌리지 않아도 자국과 똑같습니다. 찍으면 좌우가 뒤집히므로 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "auditorium" }],
    },
    {
      text: "본관 도장과 체육관 도장도 돌려 보면 자국과 두 칸씩만 다릅니다. 본관 도장은 손잡이 끝이 누워 있고, 체육관 도장은 우산 꼭지가 한 칸 치우쳐 있습니다. 자국과 닮았다는 것은 찍으면 뒤집혀 달라진다는 뜻이므로 둘 다 답이 아닙니다.",
      facts: [
        { kind: "stampIsNot", stamp: "mainhall" },
        { kind: "stampIsNot", stamp: "gym" },
      ],
    },
    {
      text: "자국의 우산을 바로 세우면 손잡이가 오른쪽으로 굽습니다. 도장 면에서는 왼쪽으로 굽어야 하고, 그런 도장은 별관 도장뿐입니다. 한 번 돌려 찍으면 자국과 정확히 겹칩니다.",
      facts: [
        { kind: "turnIsNot", turn: 0 },
        { kind: "turnIsNot", turn: 2 },
        { kind: "turnIsNot", turn: 3 },
      ],
    },
  ],
  solution: { stamp: "annex", turn: 1 },
  reward: 0,
};

/* ───────── 시험 A→S · 달과 별 ─────────
 * 푸는 길: 거의 대칭인 무늬다. 달은 뒤집어도 같고 별 둘의 자리만 바뀐다. 번진 여덟 칸이 별 하나를 가렸고, 시험 종이도 없다.
 * 보이는 별 하나와 그 아래의 보이는 빈칸이 실마리다. 봄 도장은 보이는 별의 자리가 비어서, 여름 도장은 보이는 빈칸에 별이 찍혀서
 * 저마다 다른 한 칸으로 지워진다. 거울상(겨울)은 찍어도 두 칸만 다르다.
 */
export const EXAM_SEAL_A_S: SpatialPuzzle = {
  id: "exam-seal-a-s",
  type: "spatial",
  category: "exam",
  title: "번진 관측 일지의 인장",
  typeLabel: TYPE_LABEL,
  difficulty: 5,
  rank: "A",
  minutes: 5,
  intro: "천문대 관측 일지의 마지막 장. 달과 별 무늬 인장의 한 귀퉁이가 번졌고, 시험 종이는 없다.",
  description:
    "네 도장은 달 곁에 놓인 별 둘의 자리만 다릅니다. 번진 칸은 알 수 없고 시험 종이도 없습니다. 보이는 칸이 모두 맞는 도장과 방향을 찾으세요. 찍으면 좌우가 뒤집힙니다.",
  outro: "자국은 가을 도장의 것이다. 마지막 관측은 겨울이 아니라 가을에 적혔다.",
  rules: {
    size: 6,
    imprint: ["??.##.", "???.##", "???..#", ".#...#", "....##", "...##."],
    trials: 0,
    stamps: [
      { id: "spring", name: "봄 도장", face: [".##...", "##..#.", "#...#.", "#.....", "##....", ".##..."] },
      { id: "summer", name: "여름 도장", face: [".####.", "##..##", "#....#", "......", ".##...", "......"] },
      { id: "autumn", name: "가을 도장", face: ["......", ".#.#..", "......", "#....#", "##..##", ".####."] },
      { id: "winter", name: "겨울 도장", face: ["...##.", ".#..##", ".....#", ".#...#", "....##", "...##."] },
    ],
  },
  hints: [],
  explanation: [
    {
      text: "겨울 도장은 돌리지 않아도 보이는 칸이 자국과 모두 같습니다. 찍으면 좌우가 뒤집히므로 답이 아닙니다.",
      facts: [{ kind: "stampIsNot", stamp: "winter" }],
    },
    {
      text: "자국에서 달은 왼쪽으로 열려 있고, 보이는 별은 위에서 넷째 줄의 왼쪽에서 둘째 칸에 하나뿐입니다. 다른 별은 번진 곳에 있어야 합니다. 봄 도장은 달이 맞게 찍으면 별 둘이 모두 번진 곳에 들어가고, 보이는 별의 자리는 비게 됩니다.",
      facts: [{ kind: "stampIsNot", stamp: "spring" }],
    },
    {
      text: "여름 도장은 세 번 돌려 찍으면 별 하나가 보이는 별의 자리에 맞지만, 다른 별이 그 바로 아래 칸에 찍힙니다. 자국에서 그 칸은 번지지 않았고 비어 있습니다.",
      facts: [{ kind: "stampIsNot", stamp: "summer" }],
    },
    {
      text: "가을 도장을 한 번 돌려 찍으면 별 하나는 보이는 자리에, 다른 하나는 번진 곳에 들어가고, 보이는 스물여덟 칸이 모두 맞습니다.",
      facts: [
        { kind: "turnIsNot", turn: 0 },
        { kind: "turnIsNot", turn: 2 },
        { kind: "turnIsNot", turn: 3 },
      ],
    },
  ],
  solution: { stamp: "autumn", turn: 1 },
  reward: 0,
};

/** 연습 F · 연습 C · 시험 C→B · 연습 A · 시험 B→A · 시험 A→S */
export const SEAL_SET: SpatialPuzzle[] = [
  PRACTICE_SEAL_F,
  PRACTICE_SEAL_C,
  EXAM_SEAL_C_B,
  PRACTICE_SEAL_A,
  EXAM_SEAL_B_A,
  EXAM_SEAL_A_S,
];
