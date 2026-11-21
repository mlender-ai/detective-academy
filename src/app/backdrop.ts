import corridor from "../assets/art/mono/corridor.png";
import desk from "../assets/art/mono/desk.png";
import examroom from "../assets/art/mono/examroom.png";

/**
 * 배경 그림. 검정과 흰색 두 가지로만 찍은 그림이고(scripts/mono-art.mjs),
 * 점묘에 물결무늬가 생기지 않도록 늘이지 않고 제 크기(480px 폭) 그대로 놓는다.
 */
export const CORRIDOR = { src: corridor, width: 480, height: 320 };
export const EXAMROOM = { src: examroom, width: 480, height: 256 };
export const DESK = desk;
