/**
 * ascii-magic-art 의 lib/kit.js 에서 필요한 것만 옮겼다(씨앗을 주는 난수).
 * 원본: https://github.com/kailashsr38/ascii-magic-art (MIT, © 2026 ASCII Magic). 라이선스는 LICENSE.ascii-magic-art.txt.
 * 글자 격자(Grid)와 색 팔레트는 옮기지 않았다: 탐정학원은 글자가 아니라 점 격자(src/fx/dots.ts)에 그린다.
 */

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
