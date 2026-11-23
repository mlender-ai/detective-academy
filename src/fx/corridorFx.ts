/**
 * 복도의 환경 애니메이션 (실험: ?fx=ascii 일 때만 켜진다).
 * ASCII Magic 의 조각을 점 격자용으로 고쳐 옮긴 것(src/fx/ascii)을 복도 장면의 밝기 층과 먹 층에 얹는다.
 *  - 창: 블라인드를 걷어 올리고, 드러난 유리에 비가 흐른다
 *  - 바닥: 블라인드 살 모양의 달빛 대신, 그 창으로 든 빛이 창살의 그림자와 함께 두 쪽으로 눕는다
 *  - 기록 보관함 위: 서류철 상자에 세운 촛불(불꽃과, 그 둘레의 벽에서 숨 쉬는 빛)
 * 장면은 정해진 박자(초당 12번)로만 다시 그린다: 움직임을 끊어서 보여 주고, 그리는 비용도 줄인다.
 */
import { BOX, FLOOR } from "../scene/sideArt";
import type { InkOp, ToneOp } from "../scene/stage";
import { CANDLE, createRain, drawCandle } from "./ascii";
import { DotCanvas, DotGrid, InkCanvas, ToneCanvas } from "./dots";

/** 다시 그리는 박자(초당) */
const RATE = 12;

/** 창: 위쪽 12점은 걷어 올린 블라인드로 남기고, 그 아래의 유리에 비를 그린다 */
const BLIND = 12;
const GLASS = { x: BOX.window[0], y: BOX.window[1] + BLIND, w: BOX.window[2], h: BOX.window[3] - BLIND };
/** 유리 가운데의 창살 */
const BAR = Math.floor(GLASS.w / 2);

/**
 * 바닥에 눕는 창의 빛. 기본 화면의 달빛(sideArt 의 tone.moon)과 같은 자리 · 같은 기울기 · 같은 밝기다:
 * 벽에서 6점 떨어진 줄에서 시작해 한 줄 내려갈 때마다 왼쪽으로 1.5점씩 민다. 폭은 창보다 14점 넓다.
 * 걷어 올린 블라인드가 가리는 만큼(창의 위쪽 = 바닥의 먼 쪽)은 빛이 닿지 않아, 달빛의 여섯 줄 가운데 앞의 넉 줄 자리만 쓴다.
 * 빛은 멈춰 있다: 물줄기의 그림자까지 떨어뜨려 보았으나 이 크기에서는 점묘가 깨진 것처럼 보여 뺐다.
 */
const LIGHT = { rows: 24, w: BOX.window[2] + 14, lean: 1.5, tone: 0.5 };
const LIGHT_SPAN = Math.ceil((LIGHT.rows - 1) * LIGHT.lean);
const LIGHT_AT = { x: BOX.window[0] - 8 - LIGHT_SPAN, y: FLOOR + 6 };

/**
 * 초: 보관함 위의 서류철 상자에 세운다(상자의 윗줄과는 검은 테 한 줄로 갈린다).
 * 휴대폰 폭에서 전경의 기둥과 여덟 점 떨어지고, 벽시계의 왼쪽 아래 · 전등의 빛이 닿지 않는 어두운 벽 앞이라 촛불의 빛이 벽에 보인다.
 */
const CANDLE_AT = { x: BOX.archive[0] + 8 - CANDLE.cx, y: BOX.archive[1] - 11 - CANDLE.base };

export class CorridorFx {
  private step = -1;
  private rainGrid = new DotGrid(GLASS.w, GLASS.h);
  private rain = createRain(GLASS.w, GLASS.h, { lights: 0 });
  private rainCanvas = new DotCanvas(document.createElement("canvas"), this.rainGrid);
  private rainPhase = -1;

  private lightGrid = new DotGrid(LIGHT.w + LIGHT_SPAN, LIGHT.rows);
  private light = new ToneCanvas(this.lightGrid);

  private candleGrid = new DotGrid(CANDLE.w, CANDLE.h);
  private candleGlow = new ToneCanvas(this.candleGrid);
  private candleInk = new InkCanvas(this.candleGrid);

  constructor() {
    this.drawLight();
  }

  /** time: 장면의 시간(초). cam: 카메라의 x(점). 박자가 바뀌었을 때만 다시 그린다. */
  update(time: number, cam: number) {
    const step = Math.floor(time * RATE);
    const t = step / RATE;
    // 유리는 화면의 점묘 격자에 맞춰 찍는다: 카메라가 밀리면 다시 찍는다
    const phase = (((GLASS.x - cam) % 4) + 4) % 4;
    if (step !== this.step) {
      this.rain(this.rainGrid, t);
      // 걷어 올린 블라인드의 아랫단과 창살. 창살의 양옆은 비워, 곁을 지나는 물줄기와 붙지 않게 한다.
      this.rainGrid.rect(BAR - 1, 0, 3, GLASS.h, -1);
      this.rainGrid.rect(BAR, 0, 1, GLASS.h, 1);
      this.rainGrid.rect(0, 0, GLASS.w, 1, 1);
      drawCandle(this.candleGrid, t);
      this.candleGlow.draw();
      this.candleInk.draw();
    }
    if (step !== this.step || phase !== this.rainPhase) this.rainCanvas.draw(phase, GLASS.y & 3);
    this.step = step;
    this.rainPhase = phase;
  }

  /**
   * 바닥의 빛: 유리의 한 점이 바닥의 한 점으로 떨어진다(유리의 아래쪽이 벽 가까이, 위쪽이 멀리).
   * 가운데의 창살은 빛을 가려 비스듬한 그림자가 된다. 카메라와 상관없는 그림이라 한 번만 그린다.
   */
  private drawLight() {
    const g = this.lightGrid;
    g.clear(0);
    for (let r = 0; r < LIGHT.rows; r++) {
      const x0 = LIGHT_SPAN - Math.round(r * LIGHT.lean);
      for (let c = 0; c < LIGHT.w; c++) if (Math.min(GLASS.w - 1, Math.floor((c * GLASS.w) / LIGHT.w)) !== BAR) g.set(x0 + c, r, LIGHT.tone);
    }
    this.light.draw();
  }

  /** 바닥에 더하는 빛 (기본 화면의 달빛 자리에 놓는다) */
  floor(cam: number): ToneOp {
    return { canvas: this.light.canvas, alpha: 1, op: "add", x: LIGHT_AT.x - cam, y: LIGHT_AT.y };
  }

  /** 벽에 더하는 빛 (촛불의 둘레) */
  tone(cam: number): ToneOp[] {
    return [{ canvas: this.candleGlow.canvas, alpha: 1, op: "add", x: CANDLE_AT.x - cam, y: CANDLE_AT.y }];
  }

  /** 먹 층에 얹는 것들. 복도의 먹선 다음, 탐정보다 앞서 그린다. */
  ink(cam: number): InkOp[] {
    return [
      { canvas: this.rainCanvas.canvas, x: GLASS.x - cam, y: GLASS.y },
      { canvas: this.candleInk.canvas, x: CANDLE_AT.x - cam, y: CANDLE_AT.y },
    ];
  }
}
