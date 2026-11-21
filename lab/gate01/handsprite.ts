// 방식 1 · 직접 찍은 2D 스프라이트 (견본).
// 문자 격자에 한 점씩 적었다: # 검은 점, o 흰 점, . 빈칸. 16×28점, 오른쪽을 본 옆모습.
// 서 있기 2장면, 걷기 4장면. 사람이 도트 편집기(LibreSprite 등)로 찍는 방식을 흉내 낸 것이라 장면 수가 적다.
import { haloDots, makeSprite, type Sprite } from "./shared/dot";

const HEAD = [
  "....######......",
  "...########.....",
  "...########.....",
  "...oooooooo.....",
  ".##############.",
  "...#########....",
  "....####ooo.....",
  "....####oo#.....",
  "....####oo......",
  "...#########....",
  "..##########....",
];
const COAT = [
  "..###########...",
  "..###########...",
  "..###########...",
  "..###########...",
  "..###########...",
  "..###########...",
  "..############..",
  "..############..",
  ".#############..",
  ".#############..",
];
const HEM_STILL = [".##############.", ".##############."];
const HEM_BACK = ["###############.", "##############.."];
const HEM_FRONT = [".###############", "..##############"];
const LEGS = {
  stand: ["....###.###.....", "....###.###.....", "....###.###.....", "....###.###.....", "....####.####..."],
  apart: ["...###...###....", "..###.....###...", "..###......###..", ".###.......###..", ".####......####."],
  pass: ["....###.###.....", "....###.##......", "....###.###.....", "....###..##.....", "....####.###...."],
};

function build(rows: string[], drop = 0): Sprite {
  const h = rows.length + drop;
  const s = makeSprite(16, h, 8, h - 1);
  rows.forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      const ch = row[x];
      if (ch === "#") s.px[(y + drop) * 16 + x] = -1;
      else if (ch === "o") s.px[(y + drop) * 16 + x] = 1;
    }
  });
  return haloDots(s, 1);
}

export const HAND_IDLE: Sprite[] = [
  build([...HEAD, ...COAT, ...HEM_STILL, ...LEGS.stand]),
  // 숨: 어깨 아래가 한 점 내려간다
  build([...HEAD.slice(0, 9), HEAD[8], ...HEAD.slice(9), ...COAT.slice(1), ...HEM_STILL, ...LEGS.stand]),
];

export const HAND_WALK: Sprite[] = [
  build([...HEAD, ...COAT, ...HEM_BACK, ...LEGS.apart], 1),
  build([...HEAD, ...COAT, ...HEM_STILL, ...LEGS.pass]),
  build([...HEAD, ...COAT, ...HEM_FRONT, ...LEGS.apart], 1),
  build([...HEAD, ...COAT, ...HEM_STILL, ...LEGS.pass]),
];
