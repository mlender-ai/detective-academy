// 방패 꼴 탐정학원 엠블럼: 방패 + 돋보기 (탐정학원 V3 R&D · gate01 · gsplat 실험)
// safe.js 와 같은 방식이다: 빛을 직접 계산해 회색으로 칠하고 emissive 로 넘기면,
// 뷰어의 디더가 검정/흰색 점으로 바꾼다. 자세한 까닭은 safe.js 머리말.
//
//   EMBLEM_SUN="x,y,z"  해 방향(정규화 전). 기본은 왼쪽 위 앞.

import { cone } from "../sdf.js";
import { makeCtx } from "../island.js";

export const label = "Academy emblem (1-bit)";

const env = globalThis.process?.env ?? {};
const K = 1.5, H = 0.02;
const INK = "#000000", PAPER = "#f1f1ea";
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((a) => a / l); };
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// 방패의 옆모습(2D 거리). 위는 곧고, Y0 아래는 두 원호가 만나 뾰족해진다. shrink 만큼 안으로 줄인다.
const TOPY = 1.25, Y0 = 0.85, HW = 0.45, RR = 1.0;
const shield2 = (x, y, shrink = 0) => {
  const ax = Math.abs(x);
  const d = y > Y0 ? ax - HW : Math.hypot(ax + RR - HW, y - Y0) - RR;
  return Math.max(d, y - TOPY) + shrink;
};
// 2D 모양을 z 로 두께 T 만큼 밀어낸 것
const extrude = (d2, dz) => Math.hypot(Math.max(d2, 0), Math.max(dz, 0)) + Math.min(Math.max(d2, dz), 0);

export function build(rnd) {
  const c = makeCtx(0.75, 0.3, () => 0.7, rnd), { s } = c;
  const M = { plate: 0, field: 1, ring: 2, lens: 3, handle: 4 };
  const RIM = 0.075, T = 0.055; // 테두리 너비, 방패 두께의 절반
  const LENS = { x: -0.06, y: 0.8, r: 0.2 };
  const k = (v) => v / K; // 배율을 건 좌표 → 치수 단위

  // 방패 판, 그리고 앞면을 얕게 파낸 바탕(테두리가 도드라진다)
  s.add((x, y, z) => K * (extrude(shield2(k(x), k(y)), Math.abs(k(z)) - T) - 0.012), M.plate);
  s.sub((x, y, z) => K * extrude(shield2(k(x), k(y), RIM), Math.abs(k(z) - T - 0.012) - 0.024), M.field);

  // 돋보기: 고리, 알, 오른쪽 아래로 뻗은 자루
  const zr = T + 0.03;
  s.add((x, y, z) => K * (Math.hypot(Math.hypot(k(x) - LENS.x, k(y) - LENS.y) - LENS.r, k(z) - zr) - 0.04), M.ring);
  s.add((x, y, z) => K * extrude(Math.hypot(k(x) - LENS.x, k(y) - LENS.y) - LENS.r, Math.abs(k(z) - zr) - 0.012), M.lens);
  const a = -Math.PI / 4, from = [LENS.x + Math.cos(a) * (LENS.r + 0.03), LENS.y + Math.sin(a) * (LENS.r + 0.03), zr];
  const to = [from[0] + Math.cos(a) * 0.27, from[1] + Math.sin(a) * 0.27, zr];
  s.add(cone(from.map((v) => v * K), to.map((v) => v * K), 0.042 * K, 0.052 * K), M.handle);
  c.grow(TOPY * K);

  // ---- 빛 (safe.js 와 같다) ----------------------------------------------------
  const sun = unit((env.EMBLEM_SUN || "-0.3,0.75,0.6").split(",").map(Number));
  const AMB_LOW = 0.2, AMB_HIGH = 0.4, SUN_K = 0.85;
  const sunVis = (x, y, z, n) => {
    let t = 0.03, vis = 1;
    const ox = x + n[0] * 0.03, oy = y + n[1] * 0.03, oz = z + n[2] * 0.03;
    for (let i = 0; i < 64 && t < 6; i++) {
      const d = s.dist(ox + sun[0] * t, oy + sun[1] * t, oz + sun[2] * t);
      if (d < 0.002) return 0;
      vis = Math.min(vis, (10 * d) / t);
      t += Math.min(Math.max(d, 0.012), 0.3);
    }
    return clamp01(vis);
  };
  const occlusion = (x, y, z, n) => {
    let occ = 0;
    for (const m of [2, 5, 10]) occ += Math.max(0, 1 - s.dist(x + n[0] * m * H, y + n[1] * m * H, z + n[2] * m * H) / (m * H));
    return Math.max(0, 1 - occ / 2.2);
  };
  const light = (x, y, z, n) => {
    const ndl = n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2];
    const direct = ndl > 0 ? ndl * sunVis(x, y, z, n) : 0;
    const sky = AMB_LOW + (AMB_HIGH - AMB_LOW) * (n[1] * 0.5 + 0.5);
    return sky * (0.5 + 0.5 * occlusion(x, y, z, n)) + SUN_K * direct;
  };

  // ---- 칠: lit = 빛을 받는 바탕 밝기, flat = 고정된 밝기(0 검정 · 1 흰색) -----------
  const tone = (m, x, y, z, n) => {
    if (m === M.ring || m === M.handle) return { flat: 1 };
    if (m === M.lens) {
      // 검은 알에 왼쪽 위 흰 반짝임 한 줄
      const dx = x - LENS.x, dy = y - LENS.y, r = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      return n[2] > 0.5 && r > 0.085 && r < 0.13 && ang > 1.7 && ang < 2.9 ? { flat: 1 } : { flat: 0 };
    }
    if (m === M.field) {
      // 바탕: 위쪽 띠(방패의 머리)는 한 단계 밝게, 띠 아래에 흰 줄 하나
      if (y > 1.03 && y < 1.07) return { flat: 1 };
      return { lit: y >= 1.07 ? 0.62 : 0.3 };
    }
    // 방패 판: 앞 테두리는 흰 선, 옆 두께는 밝은 면, 뒷면은 어두운 면에 흰 테두리
    if (n[2] > 0.5) return { flat: 1 };
    if (n[2] < -0.5) return shield2(x, y) > -RIM ? { flat: 1 } : { lit: 0.45 };
    return { lit: 0.9 };
  };
  const STEPS = 8;
  const store = (level) => { const g = (clamp01(level) * 0.936) / 1.15; return { c: [g, g, g], emissive: true }; };
  const paint = (m, X, Y, Z, n) => {
    const t = tone(m, X / K, Y / K, Z / K, n);
    if (t.flat !== undefined) return store(t.flat);
    return store(Math.round(clamp01(t.lit * light(X, Y, Z, n)) * STEPS) / STEPS);
  };

  return {
    c, paint, lights: [], free: [],
    palette: [INK, PAPER],
    background: "#020202", // safe.js 참고: 팔레트의 검정과 아주 조금 달라야 물체가 검정을 쓸 수 있다
    dither: 1,
    bottom: -0.05,
    elev: 0.2,
    particles: [],
  };
}
