// 탐정 캐릭터 — 코드로 찍는 관절 모형.
// 몸을 입체 캡슐(머리·모자·어깨·몸통·코트 자락·팔·다리)로 세우고, 보는 각도로 돌려 평면에 떨어뜨린 뒤
// 점 격자에 "검은 실루엣 + 흰 테 + 흰 세부(모자 띠·얼굴·손)"로 찍는다.
// 크기(h, 점 단위 키)와 각도를 아무 값으로나 줄 수 있어, 복도의 깊이에 따라 커지고 작아져도 점이 뭉개지지 않는다.

import { haloDots, makeSprite, putDot, type Sprite } from "./dot";

export type Action = "idle" | "walk" | "interact" | "examine" | "success" | "sit";

export interface Pose {
  action: Action;
  /** walk: 걸음 위상 0~1(한 바퀴 = 두 걸음). 그 밖: 초 */
  t: number;
  /** 몸이 향한 쪽. 0 = 등을 보임(멀어짐), π/2 = 오른쪽을 봄, π = 정면(다가옴), -π/2 = 왼쪽을 봄 */
  facing: number;
}

type V3 = [number, number, number];

interface Caps {
  a: V3;
  b: V3;
  /** 좌우 반지름(시작·끝), 앞뒤 반지름(시작·끝) */
  rx: [number, number];
  rz: [number, number];
  /** 이 높이(세계 좌표 y) 아래는 자른다: 코트 밑단, 구두 바닥 */
  floor?: number;
}

const PITCH = 0.14; // 카메라가 살짝 내려다본다(모자챙이 타원으로 보인다)
/** 쿼터뷰 장면의 내려다보는 각도(30도): 모자챙이 둥글게 보이고 걸음이 앞뒤로 벌어져 보인다 */
export const PITCH_ISO = Math.PI / 6;
const TAU = Math.PI * 2;

function rig(pose: Pose) {
  const { action, t } = pose;
  const walk = action === "walk";
  const p = walk ? t * TAU : 0;
  const s = Math.sin(p);
  const c = Math.cos(p);

  // 숨·무게 중심의 느린 움직임 (서 있을 때)
  const breath = walk ? 0 : Math.sin((t * TAU) / 3.4) * 0.004;
  const sway = walk ? Math.sin(p) * 0.008 : Math.sin((t * TAU) / 6.2) * 0.005;
  const bob = walk ? -Math.cos(p * 2) * 0.008 : 0;
  const lean = walk ? 0.03 : action === "examine" ? 0.09 : action === "interact" ? 0.03 : 0;

  let pelvisY = 0.47 + bob;
  let kneeBend = 0;
  if (action === "sit") {
    pelvisY = 0.33;
    kneeBend = 1;
  }
  const up = (y: number) => y + (pelvisY - 0.47) + breath * Math.max(0, (y - 0.47) / 0.3);
  const fwd = (y: number) => lean * Math.max(0, y - 0.4) * 2.2;
  const body = (x: number, y: number, z = 0): V3 => [x + sway * Math.max(0, (y - 0.3) / 0.6), up(y), z + fwd(y)];

  // 다리
  const stride = walk ? 0.085 : 0;
  const footL: V3 = [-0.05, walk ? 0.035 * Math.max(0, c) : 0, stride * s];
  const footR: V3 = [0.05, walk ? 0.035 * Math.max(0, -c) : 0, -stride * s];
  const hipL = body(-0.048, 0.42);
  const hipR = body(0.048, 0.42);
  if (kneeBend) {
    footL[2] = 0.14;
    footR[2] = 0.14;
  }
  const knee = (hip: V3, foot: V3): V3 => [
    (hip[0] + foot[0]) / 2,
    (hip[1] + foot[1]) / 2 + (kneeBend ? 0.06 : 0),
    (hip[2] + foot[2]) / 2 + (kneeBend ? 0.1 : walk ? 0.025 : 0.004),
  ];

  // 팔
  const swing = walk ? 0.06 : 0;
  let handL: V3 = body(-0.138, 0.47, -swing * s);
  let handR: V3 = body(0.138, 0.47, swing * s);
  let elbowL: V3 = body(-0.142, 0.61, -swing * s * 0.3 - 0.01);
  let elbowR: V3 = body(0.142, 0.61, swing * s * 0.3 - 0.01);
  if (action === "interact") {
    // 오른손을 들어 눈높이의 것을 짚는다
    const k = 0.5 - 0.5 * Math.cos(Math.min(1, t / 0.35) * Math.PI);
    elbowR = body(0.15, 0.61 + 0.08 * k, 0.08 * k);
    handR = body(0.12, 0.47 + 0.33 * k, 0.17 * k);
  } else if (action === "examine") {
    // 턱에 손을 대고 들여다본다
    elbowR = body(0.13, 0.64, 0.07);
    handR = body(0.04, 0.8, 0.1);
  } else if (action === "success") {
    // 모자챙을 살짝 든다
    const k = Math.sin(Math.min(1, t / 0.9) * Math.PI);
    elbowR = body(0.16, 0.66 + 0.06 * k, 0.05 * k);
    handR = body(0.1, 0.5 + 0.4 * k, 0.08 * k);
  } else if (action === "sit") {
    handL = body(-0.1, 0.44, 0.1);
    handR = body(0.1, 0.44, 0.1);
    elbowL = body(-0.145, 0.58, 0.02);
    elbowR = body(0.145, 0.58, 0.02);
  }

  const hemSway = walk ? 0.016 * s : Math.sin((t * TAU) / 4.6) * 0.004;
  const hemY = up(0.265);

  const caps: Caps[] = [
    // 코트 자락: 허리에서 밑단으로 퍼진다
    { a: body(0, 0.5), b: [sway + hemSway * 0.6, hemY - 0.05, fwd(0.3) + hemSway], rx: [0.098, 0.142], rz: [0.09, 0.138], floor: hemY },
    // 몸통
    { a: body(0, 0.735), b: body(0, 0.5), rx: [0.1, 0.098], rz: [0.08, 0.09] },
    // 어깨
    { a: body(-0.092, 0.762), b: body(0.092, 0.762), rx: [0.046, 0.046], rz: [0.046, 0.046] },
    // 세운 깃
    { a: body(0, 0.79), b: body(0, 0.835), rx: [0.052, 0.058], rz: [0.05, 0.056] },
    // 팔
    { a: body(-0.128, 0.75), b: elbowL, rx: [0.036, 0.032], rz: [0.036, 0.032] },
    { a: elbowL, b: handL, rx: [0.032, 0.028], rz: [0.032, 0.028] },
    { a: body(0.128, 0.75), b: elbowR, rx: [0.036, 0.032], rz: [0.036, 0.032] },
    { a: elbowR, b: handR, rx: [0.032, 0.028], rz: [0.032, 0.028] },
    // 다리와 구두
    { a: hipL, b: knee(hipL, footL), rx: [0.04, 0.034], rz: [0.04, 0.034] },
    { a: knee(hipL, footL), b: [footL[0], footL[1] + 0.03, footL[2]], rx: [0.034, 0.027], rz: [0.034, 0.027] },
    { a: [footL[0], footL[1] + 0.026, footL[2]], b: [footL[0], footL[1] + 0.022, footL[2] + 0.06], rx: [0.03, 0.026], rz: [0.03, 0.026], floor: footL[1] },
    { a: hipR, b: knee(hipR, footR), rx: [0.04, 0.034], rz: [0.04, 0.034] },
    { a: knee(hipR, footR), b: [footR[0], footR[1] + 0.03, footR[2]], rx: [0.034, 0.027], rz: [0.034, 0.027] },
    { a: [footR[0], footR[1] + 0.026, footR[2]], b: [footR[0], footR[1] + 0.022, footR[2] + 0.06], rx: [0.03, 0.026], rz: [0.03, 0.026], floor: footR[1] },
    // 머리
    { a: body(0, 0.862, 0.004), b: body(0, 0.866, 0.004), rx: [0.058, 0.058], rz: [0.06, 0.06] },
    // 모자 꼭대기
    { a: body(0, 0.93), b: body(0, 0.972), rx: [0.062, 0.05], rz: [0.066, 0.054] },
  ];
  const head = body(0, 0.862, 0.004);
  const brim = body(0, 0.918);
  return { caps, head, brim, handL, handR, hemY };
}

const cache = new Map<string, Sprite>();

/** 걷기는 12장면, 그 밖의 동작은 시간에 따라 잘게 나눈 장면으로 미리 굳혀 둔다(같은 장면은 다시 그리지 않는다). */
export function detectiveSprite(h: number, pose: Pose, pitch = PITCH): Sprite {
  const dir = Math.round(((pose.facing % TAU) + TAU) / (TAU / 16)) % 16;
  const frame = pose.action === "walk" ? Math.floor((((pose.t % 1) + 1) % 1) * 12) : Math.round(pose.t * 12);
  const key = `${h}|${pose.action}|${dir}|${frame}${pitch === PITCH ? "" : `|${pitch}`}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sprite = raster(h, { action: pose.action, t: pose.action === "walk" ? frame / 12 : frame / 12, facing: (dir * TAU) / 16 }, pitch);
  if (cache.size > 4000) cache.clear();
  cache.set(key, sprite);
  return sprite;
}

function raster(h: number, pose: Pose, pitch: number): Sprite {
  const { caps, head, brim, handL, handR } = rig(pose);
  const phi = pose.facing;
  const cf = Math.cos(phi);
  const sf = Math.sin(phi);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const W = Math.ceil(h * 0.62) | 1;
  const H = Math.ceil(h * 1.1);
  const cx = (W - 1) / 2;
  const ground = H - 2;
  /** 세계 좌표 → 격자 좌표 (점 단위, 실수) */
  const proj = (v: V3): [number, number, number] => {
    const X = v[0] * cf + v[2] * sf;
    const D = -v[0] * sf + v[2] * cf;
    return [cx + X * h, ground - (v[1] * cp + D * sp) * h, D];
  };
  const radius = (rx: number, rz: number) => Math.hypot(rx * cf, rz * sf) * h;

  const prims = caps.map((k) => {
    const A = proj(k.a);
    const B = proj(k.b);
    return {
      ax: A[0],
      ay: A[1],
      bx: B[0],
      by: B[1],
      ra: radius(k.rx[0], k.rz[0]),
      rb: radius(k.rx[1], k.rz[1]),
      floorY: k.floor === undefined ? Infinity : ground - k.floor * cp * h,
    };
  });
  const brimP = proj(brim);
  const brimRx = 0.122 * h;
  const brimRy = Math.max(0.6, 0.122 * sp * h + 0.012 * h);

  const inside = (x: number, y: number): boolean => {
    // 모자챙: 납작한 원판 → 타원
    const ex = (x - brimP[0]) / brimRx;
    const ey = (y - brimP[1]) / brimRy;
    if (ex * ex + ey * ey <= 1) return true;
    for (const k of prims) {
      if (y > k.floorY) continue;
      const dx = k.bx - k.ax;
      const dy = k.by - k.ay;
      const len2 = dx * dx + dy * dy;
      let u = len2 > 0 ? ((x - k.ax) * dx + (y - k.ay) * dy) / len2 : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const px = k.ax + dx * u;
      const py = k.ay + dy * u;
      const r = k.ra + (k.rb - k.ra) * u;
      if ((x - px) * (x - px) + (y - py) * (y - py) <= r * r) return true;
    }
    return false;
  };

  const body = makeSprite(W, H, Math.round(cx), ground);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let n = 0;
      if (inside(x + 0.25, y + 0.25)) n++;
      if (inside(x + 0.75, y + 0.25)) n++;
      if (inside(x + 0.25, y + 0.75)) n++;
      if (inside(x + 0.75, y + 0.75)) n++;
      if (n >= 2) body.px[y * W + x] = -1;
    }

  const white = (x: number, y: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    if (body.px[y * W + x] === -1) body.px[y * W + x] = 1;
  };

  // 얼굴: 정면에 가까울수록 넓게, 등을 보이면 없다. 모자챙 아래에서 깃 위까지.
  const front = -cf; // 1 = 정면
  const faceW = 0.04 * Math.max(0, front) + 0.022 * Math.abs(sf) * (front > -0.35 ? 1 : 0);
  if (faceW > 0.008) {
    const hp = proj([head[0], head[1], head[2] + 0.02]);
    const fx = hp[0] + sf * 0.034 * h;
    const top = brimP[1] + brimRy + 0.5;
    const bottom = hp[1] + 0.052 * h;
    for (let y = Math.ceil(top); y <= bottom; y++) {
      const v = (y - top) / Math.max(1, bottom - top);
      const half = faceW * h * (1 - 0.45 * v * v);
      for (let x = Math.ceil(fx - half); x <= fx + half - 0.2; x++) white(x, y);
    }
    // 눈: 키가 클 때만. 챙 그늘 바로 아래의 검은 점.
    if (h >= 50 && front > 0.6) {
      const ey = Math.round(top + 0.016 * h);
      putDot(body, Math.round(fx - 0.02 * h), ey, -1);
      putDot(body, Math.round(fx + 0.02 * h), ey, -1);
    }
  }
  // 모자 띠
  if (h >= 30) {
    const y0 = Math.round(brimP[1] - brimRy - 0.006 * h);
    const rows = h >= 64 ? 2 : 1;
    for (let j = 0; j < rows; j++) for (let x = 0; x < W; x++) if (Math.abs(x - brimP[0]) < 0.07 * h) white(x, y0 - j);
  }
  // 정면: 코트 여밈 줄과 셔츠 깃
  if (front > 0.75) {
    const chest = proj([0, 0.77, 0.06]);
    const hem = proj([0, 0.3, 0.1]);
    for (let y = Math.round(chest[1] + 0.05 * h); y < hem[1]; y++) if ((y & 1) === 0 || h >= 56) white(Math.round(chest[0]), y);
    for (let j = 0; j < Math.max(2, Math.round(0.035 * h)); j++) {
      white(Math.round(chest[0]) - j, Math.round(chest[1]) + Math.round(0.045 * h) - j);
      white(Math.round(chest[0]) + j, Math.round(chest[1]) + Math.round(0.045 * h) - j);
    }
  }
  // 등: 코트 뒤트임
  if (front < -0.75) {
    const a = proj([0, 0.44, -0.08]);
    const b = proj([0, 0.3, -0.1]);
    for (let y = Math.round(a[1]); y < b[1]; y++) white(Math.round(a[0]), y);
  }
  // 손: 흰 점. 몸 뒤로 가린 손은 찍지 않는다.
  // 옆모습에서는 손이 몸과 겹쳐 단추처럼 보이므로, 손을 든 동작일 때만 찍는다.
  const raised = pose.action === "interact" || pose.action === "examine" || pose.action === "success";
  if (h >= 28 && (Math.abs(cf) > 0.6 || raised)) {
    for (const hand of raised && Math.abs(cf) <= 0.6 ? [handR] : [handL, handR]) {
      const hp = proj(hand);
      const rr = Math.max(1, Math.round(0.022 * h));
      for (let j = 0; j < rr; j++) for (let i = 0; i < rr; i++) white(hp[0] - rr / 2 + i + 0.5, hp[1] - rr / 2 + j + 0.5);
    }
  }
  return haloDots(body, 1);
}

/** 발밑 그림자의 반지름(점). 밝기 층에 어둡게 깐다. */
export function shadowRadius(h: number): [number, number] {
  return [Math.max(3, h * 0.2), Math.max(1.5, h * 0.045)];
}
