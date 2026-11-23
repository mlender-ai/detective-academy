/**
 * ascii-magic-art 의 lib/kit.js 에서 필요한 것만 옮겼다(난수, 잡음, 작은 수학 도구).
 * 원본: https://github.com/kailashsr38/ascii-magic-art (MIT, © 2026 ASCII Magic). 라이선스는 LICENSE.ascii-magic-art.txt.
 * 글자 격자(Grid)와 색 팔레트는 옮기지 않았다: 탐정학원은 글자가 아니라 점 격자(src/fx/dots.ts)에 그린다.
 */
export const TAU = Math.PI * 2;
export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const fract = (v: number) => v - Math.floor(v);

/** 정해진 씨앗에서 늘 같은 수열이 나오는 난수 (mulberry32) */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 0~1 의 2차원 값 잡음 */
export function noise2(x: number, y: number, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
}

/** 잡음을 몇 겹 쌓은 것, 0~1 */
export function fbm(x: number, y: number, octaves = 4, seed = 0) {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * noise2(x * f, y * f, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return v / norm;
}
