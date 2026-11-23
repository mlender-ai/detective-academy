// 방 안의 길 찾기. 바닥을 1/4 칸 크기의 눈으로 나눠, 걸을 수 있는 눈만 이어 간다(A*).
// 물건을 돌아서 가고, 모서리를 대각선으로 스치지 않는다. 찾은 길은 서로 보이는 꼭짓점만 남겨 곧게 편다.
import type { Footprint, Pt } from "./iso";

/** 한 칸을 몇 눈으로 나누는가 */
export const SUB = 4;

export class WalkGrid {
  readonly nx: number;
  readonly ny: number;
  private open: Uint8Array;

  /**
   * w × h 칸의 방. blocks 는 물건이 차지한 자리(칸), margin 은 벽과 물건에서 띄울 거리(탐정의 몸 반폭).
   */
  constructor(w: number, h: number, blocks: Footprint[], margin = 0.3) {
    this.nx = w * SUB;
    this.ny = h * SUB;
    this.open = new Uint8Array(this.nx * this.ny);
    for (let j = 0; j < this.ny; j++)
      for (let i = 0; i < this.nx; i++) {
        const x = (i + 0.5) / SUB;
        const y = (j + 0.5) / SUB;
        let ok = x >= margin && y >= margin && x <= w - margin * 0.5 && y <= h - margin * 0.5;
        if (ok) for (const b of blocks) if (x > b.x0 - margin && x < b.x1 + margin && y > b.y0 - margin && y < b.y1 + margin) ok = false;
        this.open[j * this.nx + i] = ok ? 1 : 0;
      }
  }

  private cell(x: number, y: number): [number, number] {
    return [Math.max(0, Math.min(this.nx - 1, Math.floor(x * SUB))), Math.max(0, Math.min(this.ny - 1, Math.floor(y * SUB)))];
  }

  private isOpen(i: number, j: number) {
    return i >= 0 && j >= 0 && i < this.nx && j < this.ny && this.open[j * this.nx + i] === 1;
  }

  /** 그 자리에 설 수 있는가 */
  walkable(x: number, y: number) {
    const [i, j] = this.cell(x, y);
    return x >= 0 && y >= 0 && x < this.nx / SUB && y < this.ny / SUB && this.isOpen(i, j);
  }

  /** 가장 가까운 설 수 있는 자리. reach(칸) 안에 없으면 null */
  nearest(x: number, y: number, reach = 1.5): Pt | null {
    if (this.walkable(x, y)) return [x, y];
    let best: Pt | null = null;
    let bestD = reach * reach;
    for (let j = 0; j < this.ny; j++)
      for (let i = 0; i < this.nx; i++) {
        if (!this.open[j * this.nx + i]) continue;
        const cx = (i + 0.5) / SUB;
        const cy = (j + 0.5) / SUB;
        const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
        if (d < bestD) {
          bestD = d;
          best = [cx, cy];
        }
      }
    return best;
  }

  /** 두 자리가 곧게 이어지는가(사이에 막힌 눈이 없다) */
  private clear(a: Pt, b: Pt) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * SUB * 2);
    for (let k = 0; k <= n; k++) {
      const t = n ? k / n : 0;
      if (!this.walkable(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false;
    }
    return true;
  }

  /** from 에서 to 까지의 길(꼭짓점들). 갈 수 없으면 null */
  find(from: Pt, to: Pt): Pt[] | null {
    const start = this.nearest(from[0], from[1], 3);
    const goal = this.nearest(to[0], to[1], 3);
    if (!start || !goal) return null;
    if (this.clear(start, goal)) return [start, goal];
    const [si, sj] = this.cell(start[0], start[1]);
    const [gi, gj] = this.cell(goal[0], goal[1]);
    const n = this.nx * this.ny;
    const cost = new Float32Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    const startK = sj * this.nx + si;
    const goalK = gj * this.nx + gi;
    cost[startK] = 0;
    const queue: number[] = [startK];
    const h = (k: number) => Math.hypot((k % this.nx) - gi, Math.floor(k / this.nx) - gj);
    while (queue.length) {
      let bi = 0;
      for (let q = 1; q < queue.length; q++) if (cost[queue[q]] + h(queue[q]) < cost[queue[bi]] + h(queue[bi])) bi = q;
      const k = queue.splice(bi, 1)[0];
      if (done[k]) continue;
      done[k] = 1;
      if (k === goalK) break;
      const i = k % this.nx;
      const j = Math.floor(k / this.nx);
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di;
          const nj = j + dj;
          if (!this.isOpen(ni, nj)) continue;
          // 대각선으로 갈 때는 양옆이 모두 비어 있어야 한다(모서리를 스치지 않는다)
          if (di && dj && (!this.isOpen(i + di, j) || !this.isOpen(i, j + dj))) continue;
          const nk = nj * this.nx + ni;
          const c = cost[k] + (di && dj ? Math.SQRT2 : 1);
          if (c < cost[nk]) {
            cost[nk] = c;
            prev[nk] = k;
            queue.push(nk);
          }
        }
    }
    if (prev[goalK] < 0) return null;
    const raw: Pt[] = [goal];
    for (let k = prev[goalK]; k >= 0 && k !== startK; k = prev[k]) raw.push([((k % this.nx) + 0.5) / SUB, (Math.floor(k / this.nx) + 0.5) / SUB]);
    raw.push(start);
    raw.reverse();
    // 서로 보이는 꼭짓점만 남긴다
    const out: Pt[] = [raw[0]];
    let at = 0;
    while (at < raw.length - 1) {
      let next = raw.length - 1;
      while (next > at + 1 && !this.clear(raw[at], raw[next])) next--;
      out.push(raw[next]);
      at = next;
    }
    return out;
  }
}

/** 길의 전체 길이(칸) */
export function pathLength(path: Pt[]) {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return d;
}

/** 길을 따라 s(칸)만큼 간 자리와 그때의 진행 방향 */
export function pathAt(path: Pt[], s: number): { at: Pt; dir: Pt } {
  let left = s;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i][0] - path[i - 1][0];
    const dy = path[i][1] - path[i - 1][1];
    const len = Math.hypot(dx, dy);
    if (left <= len || i === path.length - 1) {
      const t = len ? Math.min(1, left / len) : 1;
      return { at: [path[i - 1][0] + dx * t, path[i - 1][1] + dy * t], dir: len ? [dx / len, dy / len] : [0, 0] };
    }
    left -= len;
  }
  return { at: path[path.length - 1], dir: [0, 0] };
}
