// 오래된 금고 (탐정학원 V3 R&D · gate01 · gsplat 실험)
// 섬·풀·바닥 없이 오브젝트만 빚는다. 검정/흰색 두 색 + 디더로 보려는 장면이다.
//
// 이 저장소의 굽기(build-scene → light.js)는 스플랫마다 "팔레트에서 가장 가까운 색"을
// 저장한다. 팔레트가 두 색이면 모든 스플랫이 흰색이 되어 디더할 명암이 남지 않는다.
// 그래서 여기서는 빛을 직접 계산해 회색 값으로 칠하고 emissive 로 넘긴다
// (emissive 는 저장소의 빛 계산과 안개를 건너뛴다). 뷰어의 디더가 그 회색을
// 검정/흰색 점으로 바꾼다.
//
//   SAFE_SUN="x,y,z"   해 방향(정규화 전). 기본은 왼쪽 위 앞.
//   SAFE_YAW=도        해 방향을 y축으로 돌린다(카메라와 함께 도는 빛을 구울 때).
//   SAFE_TOOL_LIGHT=1  저장소의 빛 계산을 그대로 쓴다(두 색에서 어떻게 되는지 확인용).
//   SAFE_BG=#000000    배경색을 바꾼다(확인용. 기본은 #020202, 아래 설명).
//   SAFE_STEPS=0       명암을 8단계로 끊지 않는다(확인용).

import { box, cyl, cone, sphere } from "../sdf.js";
import { makeCtx } from "../island.js";

export const label = "Old safe (1-bit)";

const env = globalThis.process?.env ?? {};
const K = 1.5; // 크기 배율: 스플랫 간격(0.02)이 아트 픽셀보다 작아지도록 키운다
const H = 0.02; // 굽는 간격(build-scene 에 고정된 값)
const INK = "#000000", PAPER = "#f1f1ea";

const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((a) => a / l); };
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// z축을 향한 원기둥(다이얼·손잡이 축). cyl 은 y축으로 선 것만 있다.
const cylZ = (cx, cy, cz, radius, halfD, r = 0) => { const f = cyl(cx, cz, cy, radius, halfD, r); return (x, y, z) => f(x, z, y); };
// 치수는 배율 전 단위로 쓰고 한꺼번에 키운다
const scaled = (f) => (...a) => f(...a.map((v) => v * K));
const B = scaled(box), CY = scaled(cyl), CZ = scaled(cylZ), S = scaled(sphere);
const C = (a, b, r1, r2) => cone(a.map((v) => v * K), b.map((v) => v * K), r1 * K, r2 * K);

export function build(rnd) {
  const c = makeCtx(0.75, 0.3, () => 0.7, rnd), { s } = c;
  const M = { feet: 0, trim: 1, body: 2, door: 3, hinge: 4, dial: 5, knob: 6, handle: 7, inset: 8 };

  // 치수(배율 전): 몸통 0.84 × 1.00 × 0.72, 바닥에서 꼭대기까지 1.23
  const BODY = { y: 0.68, hx: 0.42, hy: 0.5, hz: 0.36 };
  const TOP = { y: 1.2, hx: 0.45, hy: 0.03, hz: 0.39 }, BASE = { y: 0.16, hx: 0.45, hy: 0.03, hz: 0.39 };
  const DOOR = { y: 0.68, hx: 0.34, hy: 0.42, z: 0.37 };
  const SIDE = { hy: 0.38, hz: 0.25 }, BACK = { hx: 0.3, hy: 0.38 };
  const DIAL = { x: 0.02, y: 0.9, r: 0.15 };
  const HAND = { x: 0.02, y: 0.47, r: 0.17 };

  // 다리 넷, 받침, 몸통, 덮개
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.add(CY(sx * 0.31, 0.07, sz * 0.25, 0.095, 0.07, 0.02), M.feet);
  s.add(B(0, BASE.y, 0, BASE.hx, BASE.hy, BASE.hz, 0.012), M.trim);
  s.add(B(0, BODY.y, 0, BODY.hx, BODY.hy, BODY.hz, 0.02), M.body);
  s.add(B(0, TOP.y, 0, TOP.hx, TOP.hy, TOP.hz, 0.012), M.trim);
  // 옆면과 뒷면의 들어간 판
  for (const sx of [-1, 1]) s.sub(B(sx * BODY.hx, BODY.y, 0, 0.02, SIDE.hy, SIDE.hz, 0.004), M.inset);
  s.sub(B(0, BODY.y, -BODY.hz, BACK.hx, BACK.hy, 0.02, 0.004), M.inset);

  // 문: 앞면보다 조금 튀어나온 판, 왼쪽에 경첩 둘
  s.add(B(0, DOOR.y, DOOR.z, DOOR.hx, DOOR.hy, 0.03, 0.012), M.door);
  for (const dy of [-0.27, 0.27]) s.add(CY(-0.385, DOOR.y + dy, 0.385, 0.026, 0.085, 0.008), M.hinge);

  // 둥근 다이얼과 가운데 꼭지
  s.add(CZ(DIAL.x, DIAL.y, 0.415, DIAL.r, 0.022, 0.008), M.dial);
  s.add(CZ(DIAL.x, DIAL.y, 0.46, 0.05, 0.035, 0.012), M.knob);

  // 손잡이: 축 하나에 살 셋, 끝마다 둥근 알
  s.add(CZ(HAND.x, HAND.y, 0.425, 0.045, 0.03, 0.008), M.handle);
  for (let k = 0; k < 3; k++) {
    const a = Math.PI / 2 + 0.35 + (k * Math.PI * 2) / 3;
    const tip = [HAND.x + Math.cos(a) * HAND.r, HAND.y + Math.sin(a) * HAND.r, 0.46];
    s.add(C([HAND.x, HAND.y, 0.46], tip, 0.02, 0.02), M.handle).add(S(tip[0], tip[1], tip[2], 0.038), M.handle);
  }

  c.grow(1.23 * K);

  // ---- 빛 ------------------------------------------------------------------
  let sun = (env.SAFE_SUN || "-0.3,0.75,0.6").split(",").map(Number);
  const yaw = (Number(env.SAFE_YAW || 0) * Math.PI) / 180;
  sun = unit([sun[0] * Math.cos(yaw) + sun[2] * Math.sin(yaw), sun[1], -sun[0] * Math.sin(yaw) + sun[2] * Math.cos(yaw)]);
  const AMB_LOW = 0.2, AMB_HIGH = 0.4, SUN_K = 0.85;

  // 해가 보이는 정도: 1 = 다 보임, 0 = 그늘 (SDF 를 따라 해 쪽으로 걸어간다)
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
  // 구석의 어두움: 법선 쪽으로 나가 보았을 때 표면이 얼마나 가까운가
  const occlusion = (x, y, z, n) => {
    let occ = 0;
    for (const k of [2, 5, 10]) occ += Math.max(0, 1 - s.dist(x + n[0] * k * H, y + n[1] * k * H, z + n[2] * k * H) / (k * H));
    return Math.max(0, 1 - occ / 2.2);
  };
  const light = (x, y, z, n) => {
    const ndl = n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2];
    const direct = ndl > 0 ? ndl * sunVis(x, y, z, n) : 0;
    const sky = AMB_LOW + (AMB_HIGH - AMB_LOW) * (n[1] * 0.5 + 0.5);
    return sky * (0.5 + 0.5 * occlusion(x, y, z, n)) + SUN_K * direct;
  };

  // ---- 칠 ------------------------------------------------------------------
  // 두 색 화면에서는 밝기가 곧 "흰 점의 비율"이다. 재질은 둘 중 하나로 답한다.
  //   lit: 빛을 받는 면의 바탕 밝기(빛을 곱한 뒤 8단계로 끊는다 → 4×4 베이어의 고른 무늬만 나온다)
  //   flat: 빛과 상관없이 고정된 밝기(0 = 검정 선, 1 = 흰 선). 놋쇠·금줄·모서리 선은 그림처럼 늘 또렷하게 둔다.
  const LINE = 0.035; // 선 굵기(배율 전). 아트 픽셀 두 칸쯤
  const nearEdge = (x, y, z, b, e) => (b.hx - Math.abs(x) < e) + (b.hy - Math.abs(y - b.y) < e) + (b.hz - Math.abs(z) < e) >= 2;
  const tone = (m, x, y, z, n) => {
    if (m === M.hinge || m === M.knob || m === M.handle) return { flat: 1 };
    if (m === M.feet) return { flat: 0.5 }; // 그늘에 묻히지 않게 고정된 중간 밝기
    if (m === M.trim) {
      const b = y > BODY.y ? TOP : BASE;
      if (Math.abs(n[1]) < 0.5 || nearEdge(x, y, z, b, LINE)) return { flat: 1 }; // 옆 띠와 윗면 테두리
      return { lit: 0.75 };
    }
    if (m === M.inset) {
      // 들어간 판의 가장자리를 따라 흰 금줄 한 줄
      const edge = Math.abs(n[2]) > 0.5 ? Math.min(BACK.hx - Math.abs(x), BACK.hy - Math.abs(y - BODY.y)) : Math.min(SIDE.hz - Math.abs(z), SIDE.hy - Math.abs(y - BODY.y));
      return edge < LINE ? { flat: 1 } : { lit: 0.45 };
    }
    if (m === M.dial) {
      const r = Math.hypot(x - DIAL.x, y - DIAL.y);
      return r > DIAL.r - 0.04 ? { flat: 1 } : { flat: 0 }; // 흰 테, 검은 판
    }
    if (m === M.door) {
      const edge = Math.min(DOOR.hx - Math.abs(x), DOOR.hy - Math.abs(y - DOOR.y));
      return n[2] < 0.5 || edge < 0.03 ? { flat: 0 } : { lit: 0.3 }; // 문 둘레의 검은 틈
    }
    return nearEdge(x, y, z, BODY, LINE) ? { flat: 1 } : { lit: 0.62 }; // 몸통: 모서리 선
  };

  const toolLight = env.SAFE_TOOL_LIGHT === "1";
  const STEPS = Number(env.SAFE_STEPS || 8); // 0 이면 끊지 않는다
  // 뷰어의 디더는 (검정→흰색 축 위의 위치) × 16 개의 문턱으로 점을 고른다. PAPER 가 순백이 아니라서 0.936 이 "전부 흰 점"이다.
  // emissive 스플랫은 뷰어에서 1.15 배가 되므로 미리 나눠 둔다.
  const store = (level) => { const g = (clamp01(level) * 0.936) / 1.15; return { c: [g, g, g], emissive: true }; };
  const paint = (m, X, Y, Z, n) => {
    const t = tone(m, X / K, Y / K, Z / K, n);
    if (toolLight) { const g = t.flat ?? t.lit; return { c: [g, g, g] }; }
    if (t.flat !== undefined) return store(t.flat);
    const g = clamp01(t.lit * light(X, Y, Z, n));
    return store(STEPS ? Math.round(g * STEPS) / STEPS : g);
  };

  return {
    c, paint, lights: [], free: [],
    palette: [INK, PAPER],
    // 뷰어는 "배경과 같은 색"을 물체에 쓰지 않는다. 배경을 팔레트의 검정과 아주 조금
    // 다르게 두면 물체도 검정을 쓸 수 있고, 배경 화소는 디더를 거쳐 그대로 #000000 이 된다.
    background: env.SAFE_BG || (toolLight ? INK : "#020202"),
    dither: 1,
    bottom: -0.05,
    elev: 0.38,
    particles: [],
  };
}
