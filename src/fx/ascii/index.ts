/**
 * ASCII Magic(https://github.com/kailashsr38/ascii-magic-art, MIT)에서 골라 탐정학원의 점 격자용으로 고쳐 옮긴 조각들.
 * 라이브러리 전체를 싣지 않는다: 여기 있는 네 조각과 kit.ts 의 난수·잡음만 번들에 들어간다.
 * 원본의 글자 격자·색 팔레트·재생기는 쓰지 않는다. 원본과 나란히 보는 곳은 lab/ascii/.
 */
export { createRain, type RainOptions } from "./rain";
export { CANDLE, candleFlicker, drawCandle } from "./candle";
export { COIN, drawCoin } from "./coin";
export { HOURGLASS, drawHourglass, hourglassStage } from "./hourglass";
