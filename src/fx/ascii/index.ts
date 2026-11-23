/**
 * ASCII Magic(https://github.com/kailashsr38/ascii-magic-art, MIT)에서 골라 탐정학원의 점 격자용으로 고쳐 옮긴 조각들.
 * 라이브러리 전체를 싣지 않는다: 여기 있는 세 조각(비 내리는 유리 · 회전하는 주화 · 모래시계)과 kit.ts 의 난수만 번들에 들어간다.
 * 원본의 글자 격자·색 팔레트·재생기는 쓰지 않는다.
 * (촛불 조각은 그것이 놓이던 예전 홈의 복도와 함께 걷어냈다.)
 */
export { createRain, type RainOptions } from "./rain";
export { COIN, drawCoin } from "./coin";
export { HOURGLASS, drawHourglass, hourglassStage } from "./hourglass";
