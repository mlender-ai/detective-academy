// 복도 이동 — Phaser 4 (WebGL) 로 그린다.
// 밝기 층은 첫째 카메라가 화면 밖 버퍼에 블렌드 모드로 합치고, 그 카메라에 건 필터(프래그먼트 셰이더)가 GPU 에서 점묘로 바꾼다.
// 먹 층은 둘째 카메라가 그 위에 그대로 얹는다. 결과는 Canvas 판(corridor-canvas.ts)과 화소까지 같다.
import Phaser from "phaser";
import { BAYER4, INK_RGB } from "./shared/dot";
import { H, W } from "./shared/game";
import { mount } from "./shared/shell";

const shell = mount("Phaser", "Phaser 4.2.1 · WebGL · 점묘는 GPU 셰이더");
const { game } = shell;

const DITHER = "FilterBayerDither";
/** 덮기 계산표의 텍스처 key */
const SHADE = "shade";
const DITHER_FRAG = `
#pragma phaserTemplate(shaderName)
precision highp float;
uniform sampler2D uMainSampler;
uniform sampler2D uShade;
varying vec2 outTexCoord;
void main () {
  // 필터는 화면 밖 버퍼에 그리고, 그 버퍼는 아래가 0 이다. 격자는 왼쪽 위가 0 이라야 Canvas 판과 맞는다.
  vec2 p = floor(gl_FragCoord.xy);
  float i = mod(${H - 1}.0 - p.y, 4.0) * 4.0 + mod(p.x, 4.0);
  // WebGL1 의 프래그먼트 셰이더는 배열을 변수로 색인하지 못한다. 격자 값(BAYER4)을 조건문으로 풀어 굽는다.
  float b = 0.0;
  ${BAYER4.map((b, i) => `if (i == ${i}.0) b = ${b}.0;`).join("\n  ")}
  // 밝기와 "그림자에 덮인 정도"(버퍼의 알파에 적혀 있다)를 0~255 정수로 되돌리고, 덮은 뒤의 밝기를 계산표에서 읽는다.
  // 표는 캔버스의 위가 텍스처의 1 쪽에 놓이므로 세로를 뒤집어 읽는다.
  vec4 c = texture2D(uMainSampler, outTexCoord);
  float v = floor(c.r * 255.0 + 0.5);
  float cover = 255.0 - floor(c.a * 255.0 + 0.5);
  v = floor(texture2D(uShade, vec2(v + 0.5, 255.5 - cover) / 256.0).r * 255.0 + 0.5);
  // v/255 > (b+0.5)/16 의 양변에 255*16 을 곱해 정수끼리 비교한다.
  // 실수 그대로 비교하면 247/255 와 15.5/16 의 차이(0.0001)가 정밀도에 걸린다.
  float on = step(b * 255.0 + 127.5, v * 16.0);
  gl_FragColor = vec4(vec3(${INK_RGB.join(".0, ")}.0) / 255.0 * on, 1.0);
}`;

// Phaser 4 의 필터는 "렌더 노드(셰이더)"와 "컨트롤러(값)" 두 쪽이다. 값이 없는 필터라 컨트롤러는 기본형을 쓴다.
class DitherNode extends Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader {
  constructor(manager: Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager) {
    super(DITHER, manager, undefined, DITHER_FRAG);
    this.programManager.setUniform("uShade", 1);
  }
  setupTextures(_controller: Phaser.Filters.Controller, textures: Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper[]) {
    textures[1] = this.manager.renderer.game.textures.get(SHADE).source[0].glTexture!;
  }
}

/**
 * Canvas 판의 밝기 캔버스와 같은 조건의 캔버스. 그림자의 타원과 덮기 계산을 여기서 구워야 Canvas 판과 값이 같다.
 * 브라우저는 캔버스의 옵션과 내력에 따라 칠하는 방식(CPU·GPU, 가장자리 계산, 반올림)을 바꾼다.
 * 그래서 같은 옵션으로 만들고, 같은 일(밝기 층을 그려 넣기)을 한 번 겪게 한다.
 */
function likeToneCanvas(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(game.art.tone.base, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

const BLEND = { over: Phaser.BlendModes.NORMAL, add: Phaser.BlendModes.ADD, mul: Phaser.BlendModes.MULTIPLY } as const;
/** 텍스처 상한. 탐정 그림은 장면마다 새 key 가 생기므로(1초에 스무 개쯤) 오래 안 쓴 것부터 버린다. */
const TEX_MAX = 256;

/** 층 하나: 장면마다 앞에서부터 그림을 다시 쓴다(모자라면 만들고, 남으면 숨긴다) */
class Stack {
  readonly layer: Phaser.GameObjects.Layer;
  private items: Phaser.GameObjects.Image[] = [];
  private n = 0;
  constructor(private scene: Phaser.Scene) {
    this.layer = scene.add.layer();
  }
  put(key: string, x: number, y: number): Phaser.GameObjects.Image {
    let im = this.items[this.n];
    if (!im) this.layer.add((im = this.items[this.n] = new Phaser.GameObjects.Image(this.scene, 0, 0, key).setOrigin(0)));
    this.n++;
    return im.setTexture(key).setPosition(x, y).setVisible(true);
  }
  end() {
    for (let i = this.n; i < this.items.length; i++) this.items[i].setVisible(false);
    this.n = 0;
  }
}

class Corridor extends Phaser.Scene {
  private tone!: Stack;
  private shadow!: Stack;
  private ink!: Stack;
  private fg!: Stack;
  private inkCam!: Phaser.Cameras.Scene2D.Camera;
  /** 그림자용 블렌드 모드의 번호 */
  private cover = 0;
  /** 올려 둔 텍스처의 key. 쓴 순서대로 뒤로 보낸다(맨 앞이 가장 오래 안 쓴 것). */
  private live = new Set<string>();

  create() {
    // 틀의 딱지가 캔버스 위에 오도록 Canvas 판처럼 맨 앞에 둔다
    shell.host.prepend(this.game.canvas);
    const renderer = this.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    renderer.renderNodes.addNodeConstructor(DITHER, DitherNode);
    // 한 묶음에 텍스처를 하나만 쓴다(휴대폰에서는 Phaser 가 원래 그렇게 한다). 여러 개를 쓰게 두면 묶음 안의 텍스처 수가
    // 바뀔 때마다(등이 깜빡이거나 문이 열릴 때) 셰이더를 새로 번역해 장면이 끊긴다. 그릴 것이 스무 장 남짓이라 묶을 이득이 없다.
    renderer.renderNodes.setMaxParallelTextureUnits(1);

    // 그림자(검정을 알파로 덮기)만은 GPU 의 블렌드로 Canvas 와 같은 값을 낼 수 없다: GPU 는 반올림하고 크로미움의 Canvas 는 버린다.
    // 그래서 그림자는 밝기를 깎지 않고 "덮인 정도"만 버퍼의 알파에 남긴다(색은 그대로 두고 알파에 1-알파를 곱하는 블렌드 모드).
    // 깎은 뒤의 밝기는 이 브라우저의 Canvas 가 실제로 계산한 표(가로 = 밝기, 세로 = 덮는 알파)에서 점묘 셰이더가 읽는다.
    const gl = renderer.gl;
    renderer.addBlendMode([gl.ZERO, gl.ONE], gl.FUNC_ADD);
    this.cover = renderer.blendModes.length - 1; // 4.2.1 의 addBlendMode 는 하나 앞 번호를 돌려주므로 직접 센다
    renderer.updateBlendMode(this.cover, [gl.ZERO, gl.ONE, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA], gl.FUNC_ADD);
    const shade = likeToneCanvas(256, 256);
    for (let d = 0; d < 256; d++) {
      shade.fillStyle = `rgb(${d},${d},${d})`;
      shade.fillRect(d, 0, 1, 256);
    }
    shade.fillStyle = "#000";
    for (let a = 0; a < 256; a++) {
      shade.globalAlpha = a / 255;
      shade.fillRect(0, a, 256, 1);
    }
    this.textures.addCanvas(SHADE, shade.canvas);

    // 밝기 카메라: 검정으로 지운 버퍼에 층을 합치고(ADD·MULTIPLY 는 바탕이 불투명해야 Canvas 의 lighter·multiply 와 같다) 점묘 필터를 건다
    const toneCam = this.cameras.main.setBackgroundColor("#000000");
    toneCam.filters.internal.add(new Phaser.Filters.Controller(toneCam, DITHER));
    this.inkCam = this.cameras.add(0, 0, W, H);

    this.tone = new Stack(this);
    this.shadow = new Stack(this);
    this.ink = new Stack(this);
    this.fg = new Stack(this);
    this.inkCam.ignore([this.tone.layer, this.shadow.layer]);
    toneCam.ignore([this.ink.layer, this.fg.layer]);
  }

  /** key 의 그림을 텍스처로 올린다(한 번만). 상한을 넘으면 가장 오래 안 쓴 것을 GPU 에서 지운다. */
  private tex(key: string, canvas: HTMLCanvasElement | (() => HTMLCanvasElement)): string {
    if (!this.live.delete(key)) {
      // addCanvas 는 만들 때 캔버스 전체를 getImageData 로 읽어 둔다. GPU 가 그린 캔버스에서는 그 읽기가 느려서
      // (새 그림이 1초에 25~50장 생기는 이 화면에서 한 장면 평균이 절반쯤 된다) 읽지 않는 addImage 로 올린다.
      // 타입은 img 만 받지만 캔버스도 같은 길로 올라간다.
      this.textures.addImage(key, (typeof canvas === "function" ? canvas() : canvas) as unknown as HTMLImageElement);
      if (this.live.size >= TEX_MAX) {
        const old: string = this.live.values().next().value!;
        this.live.delete(old);
        this.textures.remove(old);
      }
    }
    this.live.add(key);
    return key;
  }

  update(_time: number, delta: number) {
    game.update(delta / 1000);
    const f = game.frame();
    // 좌우 밀림은 카메라가 맡는다
    this.cameras.main.scrollX = this.inkCam.scrollX = f.camX;

    for (const op of f.tone) {
      if (op.alpha <= 0) continue;
      this.tone
        .put(this.tex(`t:${op.key}`, game.art.tone[op.key]), 0, 0)
        .setAlpha(op.alpha)
        .setBlendMode(BLEND[op.op]);
    }
    for (const s of f.shadows) {
      // 가장자리의 반투명 화소까지 같아야 하므로 Phaser 의 도형이 아니라 같은 타원을 캔버스에 한 번 그려 텍스처로 쓴다.
      // (중심은 game.frame() 이 점 격자에 맞춰 주므로 모양은 반지름으로만 갈린다.)
      const ox = Math.ceil(s.rx) + 1;
      const oy = Math.ceil(s.ry) + 1;
      const key = this.tex(`s:${s.rx}|${s.ry}`, () => {
        const ctx = likeToneCanvas(ox * 2, oy * 2);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.ellipse(ox, oy, s.rx, s.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        return ctx.canvas;
      });
      this.shadow.put(key, s.x - ox, s.y - oy).setBlendMode(this.cover);
    }
    for (const i of f.ink) this.ink.put(this.tex(`i:${i.key}`, i.canvas), i.x, i.y);
    // 전경은 1.5배로 민다. setScrollFactor(1.5) 는 반 점일 때의 반올림이 달라(camX 가 홀수면 한 점 어긋난다) 직접 민다.
    for (const i of f.fg) this.fg.put(this.tex(`i:${i.key}`, i.canvas), i.x + f.camX - Math.round(f.camX * 1.5), i.y);

    for (const s of [this.tone, this.shadow, this.ink, this.fg]) s.end();
  }
}

const phaser = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: shell.host,
  width: W,
  height: H,
  pixelArt: true,
  backgroundColor: "#000000",
  banner: false,
  // 캔버스 크기는 240×160 그대로 둔다(2배 확대는 틀의 CSS 가 한다). 입력·소리는 틀이 맡으므로 끈다.
  scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER, expandParent: false },
  input: { keyboard: false, mouse: false, touch: false, gamepad: false },
  audio: { noAudio: true },
  autoFocus: false,
  // 지난 시간을 고르게 다듬지 않는다: Canvas 판처럼 실제로 흐른 시간만큼 굴린다
  fps: { smoothStep: false },
  scene: Corridor,
});

// 한 장면에 든 시간: 엔진의 한 걸음 전체(갱신 + 그리기 명령을 GPU 에 넘기기까지)
let t0 = 0;
phaser.events.on(Phaser.Core.Events.PRE_STEP, () => (t0 = performance.now()));
phaser.events.on(Phaser.Core.Events.POST_RENDER, () => shell.tick(performance.now() - t0));

// 화면을 떠나면 루프를 재운다. Phaser 는 숨겨져도 시간만 멈추고 rAF 는 계속 걸어 두기 때문이다.
document.addEventListener("visibilitychange", () => (document.hidden ? phaser.loop.sleep() : phaser.loop.wake()));
window.addEventListener("pagehide", () => {
  phaser.destroy(true);
  // 실제 정리는 다음 걸음에서 한다. 재워 둔 상태면 그 걸음이 오지 않으므로 한 번 밟아 준다.
  phaser.loop.tick();
});
