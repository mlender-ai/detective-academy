// D안(1비트 흑백 도트) 시안의 배경 그림을 굽는다.
//   node scripts/mono-art.mjs [corridor|examroom|desk]
// 밝기(0~1)를 캔버스에 그린 뒤 4×4 베이어 격자로 흰 점·검은 점 두 가지로만 바꾼다.
// 문틀·실루엣처럼 또렷해야 하는 것은 밝기와 따로, 점 단위로 직접 찍는다(force).
// 점 하나는 화면의 2px. 그림은 늘이지 않고 제 크기 그대로 놓는다(480px 폭).
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("../src/assets/art/mono/", import.meta.url).pathname;
const only = process.argv[2];

function paint(INK) {
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const SS = 4;

  function make(W, H) {
    const cv = document.createElement("canvas");
    cv.width = W * SS;
    cv.height = H * SS;
    const c = cv.getContext("2d");
    c.scale(SS, SS);
    c.fillStyle = "#000";
    c.fillRect(0, 0, W, H);
    const force = new Int8Array(W * H);
    const g = (v, a = 1) => {
      const n = Math.round(Math.max(0, Math.min(1, v)) * 255);
      return `rgba(${n},${n},${n},${a})`;
    };
    const S = { W, H, c, g, force };

    /* 밝기 그리기 */
    S.poly = (pts, fill, op = "source-over") => {
      c.save();
      c.globalCompositeOperation = op;
      c.fillStyle = fill;
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fill();
      c.restore();
    };
    S.clip = (pts, fn) => {
      c.save();
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.clip();
      fn();
      c.restore();
    };
    /** 타원 모양으로 번지는 빛. stops: [[자리, 밝기], …] */
    S.glow = (cx, cy, rx, ry, stops, op = "lighter") => {
      c.save();
      c.globalCompositeOperation = op;
      c.translate(cx, cy);
      c.scale(rx, ry);
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      stops.forEach(([t, v]) => gr.addColorStop(t, g(v)));
      c.fillStyle = gr;
      c.beginPath();
      c.arc(0, 0, 1, 0, Math.PI * 2);
      c.fill();
      c.restore();
    };
    S.lin = (x0, y0, x1, y1, stops) => {
      const gr = c.createLinearGradient(x0, y0, x1, y1);
      stops.forEach(([t, v, a = 1]) => gr.addColorStop(t, g(v, a)));
      return gr;
    };

    /* 점 찍기: v = 1 흰 점, -1 검은 점, 0 지움 */
    S.dot = (x, y, v) => {
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      force[y * W + x] = v;
    };
    S.rect = (x, y, w, h, v) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) S.dot(x + i, y + j, v);
    };
    S.frame = (x, y, w, h, v) => {
      S.rect(x, y, w, 1, v);
      S.rect(x, y + h - 1, w, 1, v);
      S.rect(x, y, 1, h, v);
      S.rect(x + w - 1, y, 1, h, v);
    };
    S.line = (x0, y0, x1, y1, v, skip = 0) => {
      x0 = Math.round(x0);
      y0 = Math.round(y0);
      x1 = Math.round(x1);
      y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      let n = 0;
      for (;;) {
        if (!skip || n % (skip + 1) === 0) S.dot(x0, y0, v);
        n++;
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y0 += sy;
        }
      }
    };
    S.fill = (pts, v) => {
      const ys = pts.map((p) => p[1]);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
          const [x0, y0] = pts[i];
          const [x1, y1] = pts[(i + 1) % pts.length];
          if (y0 === y1) continue;
          const yy = y + 0.5;
          if (yy < Math.min(y0, y1) || yy >= Math.max(y0, y1)) continue;
          xs.push(x0 + ((yy - y0) / (y1 - y0)) * (x1 - x0));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) S.dot(x, y, v);
      }
    };
    S.disc = (cx, cy, rx, ry, v) => {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx;
          const dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) S.dot(x, y, v);
        }
    };
    S.ring = (cx, cy, r, v) => {
      for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
        for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (d <= r && d > r - 1.05) S.dot(x, y, v);
        }
    };

    /** 밝기를 줄여 읽고 두 색으로 바꿔 PNG 로 낸다 */
    S.bake = (curve = (v) => v) => {
      const small = document.createElement("canvas");
      small.width = W;
      small.height = H;
      const sc = small.getContext("2d");
      sc.imageSmoothingQuality = "high";
      sc.drawImage(cv, 0, 0, W, H);
      const d = sc.getImageData(0, 0, W, H).data;
      const out = document.createElement("canvas");
      out.width = W * 2;
      out.height = H * 2;
      const oc = out.getContext("2d");
      oc.fillStyle = "#000";
      oc.fillRect(0, 0, W * 2, H * 2);
      oc.fillStyle = INK;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const f = force[y * W + x];
          const v = curve(d[(y * W + x) * 4] / 255, x, y);
          const on = f === 1 || (f === 0 && v > (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16);
          if (on) oc.fillRect(x * 2, y * 2, 2, 2);
        }
      return out.toDataURL("image/png");
    };
    return S;
  }

  /* ───────── 복도: 한 점으로 모이는 긴 복도. 전등마다 빛 웅덩이가 있고, 끝 방에만 불이 켜져 있다. ───────── */
  function corridor({ nearLamp = true, figure = false, farLight = true } = {}) {
    const W = 240;
    const H = 160;
    const S = make(W, H);
    const { c, g } = S;
    const vx = 120;
    const vy = 72;
    const hw = 18;
    const up = 17;
    const dn = 22;
    const KM = 7;
    const X = (k, s) => vx + s * hw * k;
    const T = (k) => vy - up * k;
    const B = (k) => vy + dn * k;

    const wall = (s) => [
      [X(1, s), T(1)],
      [X(KM, s), T(KM)],
      [X(KM, s), B(KM)],
      [X(1, s), B(1)],
    ];
    const ceil = [
      [X(1, -1), T(1)],
      [X(1, 1), T(1)],
      [X(KM, 1), T(KM)],
      [X(KM, -1), T(KM)],
    ];
    const floor = [
      [X(1, -1), B(1)],
      [X(1, 1), B(1)],
      [X(KM, 1), B(KM)],
      [X(KM, -1), B(KM)],
    ];

    // 바탕: 어둠 속에서도 면이 구분되는 만큼만
    S.poly(wall(-1), g(0.07));
    S.poly(wall(1), g(0.07));
    S.poly(ceil, g(0.02));
    S.poly(floor, g(0.05));

    const lamps = [1.36, 2.05, 3.05];
    lamps.forEach((k, i) => {
      const lit = i < 2 || nearLamp;
      const p = lit ? 1 : 0;
      // 바닥의 빛 웅덩이
      S.clip(floor, () => S.glow(vx, B(k) + 1.2 * k, hw * k * 1.05, dn * k * 0.3, [[0, 0.95 * p], [0.45, 0.6 * p], [1, 0]]));
      // 천장에 번진 빛
      S.clip(ceil, () => S.glow(vx, T(k), hw * k * 0.8, up * k * 0.24, [[0, 0.7 * p], [0.5, 0.3 * p], [1, 0]]));
      // 양쪽 벽을 훑는 빛
      for (const s of [-1, 1])
        S.clip(wall(s), () => {
          c.save();
          c.globalCompositeOperation = "lighter";
          c.fillStyle = S.lin(X(k * 0.72, s), 0, X(k * 1.34, s), 0, [[0, 0], [0.42, 0.62 * p], [0.6, 0.5 * p], [1, 0]]);
          c.fillRect(0, 0, W, H);
          c.restore();
          // 위에서 내려온 빛이라 아래로 갈수록 준다
          c.save();
          c.globalCompositeOperation = "multiply";
          c.fillStyle = S.lin(0, T(k), 0, B(k), [[0, 1], [0.55, 0.8], [1, 0.42]]);
          c.fillRect(Math.min(X(k * 0.72, s), X(k * 1.34, s)), 0, Math.abs(X(k * 1.34, s) - X(k * 0.72, s)), H);
          c.restore();
        });
    });

    // 융단: 가운데 긴 줄. 가로 줄무늬가 멀어질수록 촘촘해진다.
    const rw = 7.6;
    const runner = [
      [vx - rw, B(1)],
      [vx + rw, B(1)],
      [vx + rw * KM, B(KM)],
      [vx - rw * KM, B(KM)],
    ];
    S.clip(runner, () => {
      let k = 1;
      let odd = false;
      while (k < KM) {
        const k2 = k * 1.085;
        if (odd) {
          c.save();
          c.globalCompositeOperation = "multiply";
          c.fillStyle = g(0.22);
          c.fillRect(0, B(k), W, B(k2) - B(k));
          c.restore();
        } else {
          c.save();
          c.globalCompositeOperation = "lighter";
          c.fillStyle = g(0.1);
          c.fillRect(0, B(k), W, B(k2) - B(k));
          c.restore();
        }
        odd = !odd;
        k = k2;
      }
    });
    for (const s of [-1, 1]) S.line(vx + s * rw, B(1), vx + s * rw * 4.6, B(4.6), -1);

    // 허리 몰딩과 걸레받이
    for (const s of [-1, 1]) {
      S.clip(wall(s), () => {
        c.save();
        c.globalCompositeOperation = "lighter";
        c.strokeStyle = g(0.5);
        c.lineWidth = 0.9;
        c.beginPath();
        c.moveTo(X(1, s), vy + 6.5);
        c.lineTo(X(KM, s), vy + 6.5 * KM);
        c.stroke();
        c.restore();
      });
      S.line(X(1, s), B(1), X(4.8, s), B(4.8), -1);
      S.line(X(1, s), T(1), X(4.8, s), T(4.8), -1);
    }

    // 문: 양쪽 벽에 세 개씩. 어둡고, 틀만 또렷하다.
    const doors = [
      [1.16, 1.36],
      [1.62, 2.02],
      [2.5, 3.3],
    ];
    for (const s of [-1, 1])
      doors.forEach(([k1, k2], i) => {
        const top = (k) => vy - up * k * 0.56;
        const quad = [
          [X(k1, s), top(k1)],
          [X(k2, s), top(k2)],
          [X(k2, s), B(k2)],
          [X(k1, s), B(k1)],
        ];
        S.poly(quad, g(0.16), "multiply");
        // 문틀
        S.line(X(k1, s), top(k1), X(k2, s), top(k2), 1);
        S.line(X(k1, s), top(k1), X(k1, s), B(k1) - 1, 1);
        S.line(X(k2, s), top(k2), X(k2, s), B(k2) - 1, 1);
        // 문 안쪽 판
        if (i > 0) {
          const a = k1 + (k2 - k1) * 0.22;
          const b = k1 + (k2 - k1) * 0.8;
          S.line(X(a, s), vy - up * a * 0.42, X(b, s), vy - up * b * 0.42, 1, 1);
          S.line(X(a, s), vy + dn * a * 0.2, X(b, s), vy + dn * b * 0.2, 1, 1);
        }
        // 손잡이
        const kk = s < 0 ? k1 + (k2 - k1) * 0.82 : k1 + (k2 - k1) * 0.82;
        S.dot(X(kk, s), vy + 3.2 * kk, 1);
        if (i === 2) S.dot(X(kk, s), vy + 3.2 * kk + 1, 1);
        // 문 위의 교실 표찰
        const km = (k1 + k2) / 2;
        const px = X(km, s) - s * 1.2 * km;
        const py = vy - up * km * 0.72;
        const pw = Math.max(2, Math.round(1.6 * km));
        const ph = Math.max(1, Math.round(0.8 * km));
        S.rect(Math.round(px - (s > 0 ? pw : 0)), Math.round(py), pw, ph, 1);
      });

    // 끝 벽과 불 켜진 방
    S.rect(X(1, -1), T(1), hw * 2, up + dn, -1);
    const dw = 7;
    const dt = vy - 11;
    if (farLight) {
      S.rect(vx - dw, dt, dw * 2, B(1) - dt, 1);
      // 문 둘레로 새는 빛
      for (let i = 0; i < 2; i++) S.frame(vx - dw - 2 - i * 2, dt - 2 - i * 2, dw * 2 + 4 + i * 4, B(1) - dt + 2 + i * 2, 0);
      S.clip(floor, () => {
        c.save();
        c.globalCompositeOperation = "lighter";
        c.fillStyle = S.lin(0, B(1), 0, B(1.9), [[0, 0.95], [0.5, 0.5], [1, 0]]);
        c.beginPath();
        c.moveTo(vx - dw, B(1));
        c.lineTo(vx + dw, B(1));
        c.lineTo(vx + dw * 2.6, B(1.9));
        c.lineTo(vx - dw * 2.6, B(1.9));
        c.closePath();
        c.fill();
        c.restore();
      });
    } else {
      S.frame(vx - dw, dt, dw * 2, B(1) - dt, 1);
    }
    if (figure) {
      // 문간에 선 사람: 중절모와 외투
      S.rect(vx - 2, dt + 5, 5, 3, -1);
      S.rect(vx - 4, dt + 8, 9, 1, -1);
      S.rect(vx - 2, dt + 9, 5, 3, -1);
      S.fill(
        [
          [vx - 3, dt + 12],
          [vx + 4, dt + 12],
          [vx + 6, dt + 16],
          [vx + 5.5, B(1)],
          [vx - 4.5, B(1)],
          [vx - 5, dt + 16],
        ],
        -1,
      );
      // 바닥에 길게 드리운 그림자
      S.fill(
        [
          [vx - 4, B(1)],
          [vx + 5, B(1)],
          [vx + 3, B(1.7)],
          [vx - 2, B(1.7)],
        ],
        -1,
      );
    }

    // 천장 전등
    lamps.forEach((k, i) => {
      const lit = i < 2 || nearLamp;
      const rx = Math.max(1.5, 2.3 * k);
      const ry = Math.max(0.8, 0.62 * k);
      S.disc(vx, T(k) + ry + 0.6, rx + 1, ry + 0.8, -1);
      if (lit) S.disc(vx, T(k) + ry + 0.6, rx, ry, 1);
      else {
        S.disc(vx, T(k) + ry + 0.6, rx, ry, 1);
        S.disc(vx, T(k) + ry + 0.6, rx - 1, ry - 0.7, -1);
      }
    });

    return S.bake((v) => Math.pow(v, 1.12));
  }

  /* ───────── 시험실: 밤의 빈 교실. 등 하나가 책상 하나만 비춘다. ───────── */
  function examroom() {
    const W = 240;
    const H = 128;
    const S = make(W, H);
    const { c, g } = S;
    const floorY = 92;

    // 벽과 바닥
    c.fillStyle = g(0.06);
    c.fillRect(0, 0, W, floorY);
    c.fillStyle = g(0.03);
    c.fillRect(0, floorY, W, H - floorY);

    // 등불의 원뿔
    const lx = 120;
    const ly = 22;
    const cone = [
      [lx - 7, ly + 4],
      [lx + 7, ly + 4],
      [lx + 62, H],
      [lx - 62, H],
    ];
    S.clip(cone, () => {
      c.save();
      c.globalCompositeOperation = "lighter";
      c.fillStyle = S.lin(0, ly, 0, H, [[0, 0.78], [0.45, 0.42], [1, 0.2]]);
      c.fillRect(0, 0, W, H);
      c.restore();
    });
    // 바닥에 떨어진 빛
    S.glow(lx, floorY + 16, 74, 15, [[0, 0.75], [0.6, 0.34], [1, 0]]);
    // 벽에 번진 빛
    S.glow(lx, 46, 96, 54, [[0, 0.2], [1, 0]]);

    // 창: 블라인드 사이로 든 달빛
    const wx = 186;
    const wy = 30;
    const ww = 40;
    const wh = 44;
    S.rect(wx - 2, wy - 2, ww + 4, wh + 4, -1);
    for (let y = 0; y < wh; y++) if (y % 4 < 2) S.rect(wx, wy + y, ww, 1, 1);
    S.rect(wx + ww / 2 - 1, wy, 2, wh, -1);
    S.frame(wx - 2, wy - 2, ww + 4, wh + 4, 1);
    S.rect(wx - 4, wy + wh + 2, ww + 8, 2, 1);
    // 창살 그림자가 바닥에 비스듬히 눕는다
    for (let i = 0; i < 9; i++) {
      const y = floorY + 4 + i * 4;
      const x0 = 150 - i * 11;
      S.poly(
        [
          [x0, y],
          [x0 + 54, y],
          [x0 + 50, y + 2],
          [x0 - 4, y + 2],
        ],
        g(0.5),
        "lighter",
      );
    }

    // 칠판
    const bx = 24;
    const by = 12;
    const bw = 134;
    const bh = 52;
    S.rect(bx, by, bw, bh, -1);
    S.frame(bx, by, bw, bh, 1);
    S.frame(bx - 2, by - 2, bw + 4, bh + 4, 1);
    S.rect(bx - 2, by + bh + 2, bw + 4, 2, 1);
    // 분필 글씨: 지우다 만 표와 물음표
    for (let i = 0; i < 4; i++) S.line(bx + 10, by + 10 + i * 8, bx + 58, by + 10 + i * 8, 1, 1);
    for (let i = 0; i < 4; i++) S.line(bx + 10 + i * 16, by + 10, bx + 10 + i * 16, by + 34, 1, 1);
    S.line(bx + 14, by + 14, bx + 20, by + 16, 1);
    S.line(bx + 30, by + 22, bx + 36, by + 24, 1);
    S.line(bx + 46, by + 30, bx + 52, by + 32, 1);
    // 물음표
    const qx = bx + 64;
    S.line(qx, by + 14, qx + 4, by + 10, 1);
    S.line(qx + 4, by + 10, qx + 10, by + 10, 1);
    S.line(qx + 10, by + 10, qx + 14, by + 14, 1);
    S.line(qx + 14, by + 14, qx + 14, by + 18, 1);
    S.line(qx + 14, by + 18, qx + 7, by + 24, 1);
    S.line(qx + 7, by + 24, qx + 7, by + 28, 1);
    S.rect(qx + 6, by + 32, 3, 3, 1);
    // 지우다 만 글줄
    for (let i = 0; i < 4; i++) S.line(bx + 108, by + 24 + i * 5, bx + 126 - (i % 2) * 6, by + 24 + i * 5, 1, 2);
    // 분필받이의 분필
    S.rect(bx + 20, by + bh + 1, 5, 1, 1);
    S.rect(bx + 96, by + bh + 1, 3, 1, 1);

    // 시계: 열두 시 오 분 전
    S.disc(202, 13, 8, 8, -1);
    S.ring(202, 13, 8, 1);
    S.line(202, 13, 202, 7, 1);
    S.line(202, 13, 199, 8, 1);
    for (const [dx, dy] of [
      [0, -6],
      [6, 0],
      [0, 6],
      [-6, 0],
    ])
      S.dot(202 + dx, 13 + dy, 1);

    // 바닥 선
    S.rect(0, floorY, W, 1, -1);
    S.line(0, floorY - 1, W, floorY - 1, 1, 2);

    // 어둠 속의 빈 책상들
    for (const [x, y, w] of [
      [8, 88, 40],
      [182, 88, 44],
      [-6, 104, 52],
      [196, 106, 56],
    ]) {
      S.rect(x, y, w, 4, -1);
      S.rect(x, y, w, 1, 1);
      S.rect(x + 3, y + 4, 2, 26, -1);
      S.rect(x + w - 5, y + 4, 2, 26, -1);
      S.rect(x + 4, y + 4, 1, 26, 1);
      // 의자 등받이
      S.rect(x + w / 2 - 7, y - 12, 14, 9, -1);
      S.frame(x + w / 2 - 7, y - 12, 14, 9, 1);
    }

    // 등: 줄, 갓, 전구
    S.rect(lx, 0, 1, ly - 6, 1);
    S.fill(
      [
        [lx - 3, ly - 6],
        [lx + 4, ly - 6],
        [lx + 10, ly + 2],
        [lx - 9, ly + 2],
      ],
      -1,
    );
    S.line(lx - 3, ly - 6, lx + 3, ly - 6, 1);
    S.line(lx - 3, ly - 6, lx - 9, ly + 1, 1);
    S.line(lx + 3, ly - 6, lx + 9, ly + 1, 1);
    S.rect(lx - 9, ly + 2, 19, 1, 1);
    S.rect(lx - 2, ly + 3, 5, 2, 1);

    // 불빛 아래의 책상 하나와 의자
    const dx = 88;
    const dy = 96;
    const dw = 64;
    // 의자
    S.rect(lx - 9, dy - 20, 18, 14, -1);
    S.frame(lx - 9, dy - 20, 18, 14, 1);
    S.rect(lx - 6, dy - 17, 12, 8, 1);
    S.rect(lx - 6, dy - 17, 12, 8, 0);
    // 책상
    S.rect(dx - 2, dy - 1, dw + 4, 7, -1);
    S.rect(dx, dy, dw, 4, 1);
    S.rect(dx, dy + 4, dw, 1, -1);
    S.rect(dx + 2, dy + 5, dw - 4, 3, 0);
    S.rect(dx + 4, dy + 6, 3, 30, -1);
    S.rect(dx + dw - 7, dy + 6, 3, 30, -1);
    S.rect(dx + 5, dy + 6, 1, 30, 1);
    S.rect(dx + dw - 6, dy + 6, 1, 30, 1);
    // 책상 위의 봉투
    S.rect(lx - 9, dy - 3, 18, 3, -1);
    S.rect(lx - 8, dy - 3, 16, 2, 1);

    return S.bake((v) => Math.pow(v, 1.08));
  }

  /* ───────── 책상: 위에서 내려다본 어두운 책상. 등불이 닿는 위쪽만 나뭇결이 보인다. ───────── */
  function desk() {
    const W = 240;
    const H = 480;
    const S = make(W, H);
    const { c, g } = S;
    // 등불
    S.glow(120, 30, 190, 250, [[0, 0.34], [0.35, 0.2], [0.7, 0.08], [1, 0.02]]);
    // 널 사이의 틈: 점선
    for (const y of [86, 206, 326]) S.line(0, y, W, y, -1);
    return S.bake((v, x, y) => v * (1 - Math.max(0, (y - 250) / 200)));
  }

  return {
    corridor: () => ({
      "corridor.png": corridor({ figure: true }),
      "corridor-empty.png": corridor(),
      "corridor-dim.png": corridor({ nearLamp: false }),
    }),
    examroom: () => ({ "examroom.png": examroom() }),
    desk: () => ({ "desk.png": desk() }),
  };
}

const browser = await chromium.launch();
const page = await browser.newPage();
mkdirSync(OUT, { recursive: true });
for (const name of ["corridor", "examroom", "desk"]) {
  if (only && only !== name) continue;
  const files = await page.evaluate(`(${paint.toString()})("#f1f1ea").${name}()`);
  for (const [file, url] of Object.entries(files)) {
    const buf = Buffer.from(url.split(",")[1], "base64");
    writeFileSync(OUT + file, buf);
    console.log(file, buf.length, "bytes");
  }
}
await browser.close();
