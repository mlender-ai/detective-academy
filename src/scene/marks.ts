// 장면 위에 얹는 표시: 지금 할 일이 있는 물건에 두르는 모서리 괄호.
import { makeSprite, rectDots, spriteCanvas } from "./dot";

/** 괄호 한 귀퉁이의 크기(점) */
export const BRACKET = 11;

/** 모서리 괄호 (0 왼쪽 위 · 1 오른쪽 위 · 2 왼쪽 아래 · 3 오른쪽 아래): 검은 받침 위에 두 점 굵기의 흰 ㄱ자 */
function bracket(corner: number): HTMLCanvasElement {
  const s = makeSprite(BRACKET, BRACKET);
  const right = corner % 2 === 1;
  const bottom = corner >= 2;
  rectDots(s, 0, bottom ? BRACKET - 4 : 0, BRACKET, 4, -1);
  rectDots(s, right ? BRACKET - 4 : 0, 0, 4, BRACKET, -1);
  rectDots(s, 1, bottom ? BRACKET - 3 : 1, BRACKET - 2, 2, 1);
  rectDots(s, right ? BRACKET - 3 : 1, 1, 2, BRACKET - 2, 1);
  return spriteCanvas(s);
}

export function cornerBrackets(): HTMLCanvasElement[] {
  return [0, 1, 2, 3].map(bracket);
}

/** 네모(x, y, w, h)의 네 귀퉁이에 괄호를 놓을 자리 */
export function bracketSpots([x, y, w, h]: readonly [number, number, number, number]): [number, number][] {
  return [
    [x, y],
    [x + w - BRACKET, y],
    [x, y + h - BRACKET],
    [x + w - BRACKET, y + h - BRACKET],
  ];
}
