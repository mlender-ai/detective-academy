// 복도 이동 — PixiJS(WebGL)로 그린다. 결과는 Canvas 2D 판(corridor-canvas.ts)과 화소까지 같아야 한다.
// 밝기 층은 스프라이트의 혼합 방식으로 RenderTexture 에 합치고, 그 결과를 프래그먼트 셰이더가 점묘로 바꾼다. 먹 층은 그 위의 스프라이트다.
import { Application, BufferImageSource, CanvasSource, Container, GlProgram, Mesh, MeshGeometry, RenderTexture, Shader, Sprite, Texture, Ticker } from "pixi.js";
import { BAYER4, INK_RGB } from "./shared/dot";
import { H, W, type FrameOut } from "./shared/game";
import { mount } from "./shared/shell";

const shell = mount("PixiJS", "PixiJS 8 · WebGL · 밝기 합성과 점묘는 GPU");
const { game } = shell;

/** 캐릭터 스프라이트는 장면마다 새 key 가 생긴다. 이 수를 넘으면 오래 안 쓴 텍스처부터 버린다. */
const MAX_TEXTURES = 256;
const BLEND = { over: "normal", add: "add", mul: "multiply" } as const;

const fromCanvas = (canvas: HTMLCanvasElement) => new Texture({ source: new CanvasSource({ resource: canvas, resolution: 1, scaleMode: "nearest" }) });

// key → 텍스처. Map 은 넣은 순서를 지키므로, 쓸 때마다 다시 넣으면 맨 앞이 가장 오래 안 쓴 것이다.
const textures = new Map<string, Texture>();
function textureOf(key: string, make: () => Texture): Texture {
  let t = textures.get(key);
  if (t) textures.delete(key);
  else t = make();
  textures.set(key, t);
  return t;
}
function trimTextures() {
  for (const [key, t] of textures) {
    if (textures.size <= MAX_TEXTURES) break;
    textures.delete(key);
    t.destroy(true);
  }
}

// ── 그림자 ──
// 타원은 Canvas 로 그린다: Pixi 의 Graphics 는 가장자리를 다르게 깎아서 가장자리 화소가 어긋난다.
// 가장자리 값은 캔버스가 CPU 로 그려지느냐 GPU 로 그려지느냐에 따라 다르다. 그래서 Canvas 판의 밝기 캔버스와 같은 조건을 만든다:
// willReadFrequently 로 열고(사파리는 이것으로 CPU 가 된다), 밝기 층을 한 번 받아 그린다(GPU 를 쓰는 크롬은 이때 이 캔버스도 GPU 로 바꾼다).
function shadowContext(w: number, h: number, bg?: string) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(game.art.tone.base, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  return (rx: number, ry: number) => {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    return ctx.getImageData(0, 0, w, h).data;
  };
}
// 어둡게 하는 계산을 GPU 의 혼합에 맡기면 반올림이 Canvas 와 달라 걷는 동안 가끔 점 하나가 어긋난다(크로미움의 Canvas 는 버림, GPU 는 반올림).
// 그래서 텍스처에는 (흰색, 255 - 불투명도)를 담아 'min' 혼합으로 얹는다: 밝기(RGB)는 그대로 두고 밝기 버퍼의 알파에 그림자만 적힌다. 계산은 점묘 셰이더가 한다.
function shadowTexture(rx: number, ry: number): Texture {
  const w = Math.ceil(rx) * 2 + 4;
  const h = Math.ceil(ry) * 2 + 4;
  const drawn = shadowContext(w, h)(rx, ry);
  const px = new Uint8Array(drawn.length).fill(255);
  for (let i = 3; i < px.length; i += 4) px[i] = 255 - drawn[i];
  return new Texture({ source: new BufferImageSource({ resource: px, width: w, height: h, format: "rgba8unorm", alphaMode: "premultiplied-alpha", scaleMode: "nearest" }) });
}
// 이 브라우저의 Canvas 가 어느 쪽으로 반올림하는지 한 화소로 잰다: 밝기 26 에 그림자를 얹으면 버림은 7, 반올림은 8 이다.
// 남은 차이: GPU 로 그리는 크롬의 Canvas 는 표본 4개에 따로 섞은 뒤 평균을 내서 반올림 식과 드물게 1 이 어긋난다(걷는 108장면 중 6장면에서 점 하나).
function shadowRule(): string {
  return shadowContext(8, 8, "rgb(26,26,26)")(6, 6)[(4 * 8 + 4) * 4] === 7 ? "floor(v * (256.0 - a) / 256.0)" : "floor(v * (255.0 - a) / 255.0 + 0.5)";
}

// 4×4 베이어 문턱값을 텍스처로 넘긴다(프래그먼트 셰이더의 배열 색인은 WebGL1 에서 보장되지 않는다). 값은 16b+8.
function bayerTexture(): Texture {
  const px = new Uint8Array(64).fill(255);
  BAYER4.forEach((b, i) => px.fill(b * 16 + 8, i * 4, i * 4 + 3));
  return new Texture({ source: new BufferImageSource({ resource: px, width: 4, height: 4, format: "rgba8unorm", alphaMode: "premultiplied-alpha", scaleMode: "nearest" }) });
}

const VERTEX = `attribute vec2 aPosition;
attribute vec2 aUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
varying vec2 vUV;
void main() {
  gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}`;
// 화소 좌표를 gl_FragCoord 가 아니라 UV 에서 얻는다: WebGL 은 y 가 뒤집혀 있지만 UV 는 왼쪽 위가 0,0 이다.
// 값은 모두 0~255 의 정수로 되돌려 셈한다(부동소수 오차로 점이 뒤집히지 않게). v/255 > (b+0.5)/16 은 256v > 255(16b+8) 과 같다.
const fragment = (shadow: string) => `precision highp float;
precision highp sampler2D;
varying vec2 vUV;
uniform sampler2D uTone;
uniform sampler2D uBayer;
void main() {
  vec2 size = vec2(${W}.0, ${H}.0);
  vec2 p = floor(vUV * size);
  vec4 tone = texture2D(uTone, (p + 0.5) / size);
  float v = floor(tone.r * 255.0 + 0.5);
  float a = 255.0 - floor(tone.a * 255.0 + 0.5);
  v = ${shadow};
  float t = floor(texture2D(uBayer, (mod(p, 4.0) + 0.5) / 4.0).r * 255.0 + 0.5);
  float on = step(255.0 * t + 0.5, 256.0 * v);
  gl_FragColor = vec4(vec3(${INK_RGB.map((n) => `${n}.0`).join(", ")}) / 255.0 * on, 1.0);
}`;

/** 스프라이트를 필요한 만큼만 만들어 두고 장면마다 다시 쓴다 */
function pool(parent: Container) {
  const list: Sprite[] = [];
  let used = 0;
  return {
    next(texture: Texture, x: number, y: number): Sprite {
      const s = list[used] ?? parent.addChild((list[used] = new Sprite()));
      used++;
      s.texture = texture;
      s.position.set(x, y);
      s.visible = true;
      return s;
    },
    // 남은 것은 숨기고 텍스처를 놓는다(버려진 텍스처를 붙들고 있지 않게)
    end() {
      for (let i = used; i < list.length; i++) {
        list[i].visible = false;
        list[i].texture = Texture.EMPTY;
      }
      used = 0;
    },
  };
}

async function start() {
  const app = new Application();
  await app.init({ width: W, height: H, resolution: 1, autoDensity: false, antialias: false, preference: "webgl", background: 0x000000, autoStart: false, sharedTicker: false });
  // 누르기는 화면 틀이 받는다. Pixi 가 캔버스에 touch-action: none 을 걸어 쓸어 넘기기를 막지 않게 한다.
  // (null 은 Pixi 문서에 있는 사용법인데 형 선언에는 빠져 있어 ! 를 붙였다)
  app.renderer.events.setTargetElement(null!);
  shell.host.prepend(app.canvas);

  // 1) 밝기 버퍼: RGB 는 밝기, 알파는 255 - 그림자의 불투명도
  const toneTarget = RenderTexture.create({ width: W, height: H, resolution: 1, antialias: false, scaleMode: "nearest" });
  const toneStage = new Container();
  const tones = pool(toneStage);
  const bayer = bayerTexture();

  // 2) 화면: 점묘 판 한 장 + 먹 층
  const shader = new Shader({ glProgram: GlProgram.from({ vertex: VERTEX, fragment: fragment(shadowRule()), name: "bayer-dither" }), resources: { uTone: toneTarget.source, uBayer: bayer.source } });
  const dither = new Mesh({
    geometry: new MeshGeometry({
      positions: new Float32Array([0, 0, W, 0, W, H, 0, H]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    }),
    shader,
  });
  const inkStage = new Container();
  const inks = pool(inkStage);
  app.stage.addChild(dither, inkStage);

  function draw(f: FrameOut) {
    for (const op of f.tone) {
      if (op.alpha <= 0) continue;
      const s = tones.next(textureOf(`tone|${op.key}`, () => fromCanvas(game.art.tone[op.key])), -f.camX, 0);
      s.blendMode = BLEND[op.op];
      s.alpha = op.alpha;
    }
    for (const sh of f.shadows) {
      const t = textureOf(`shadow|${sh.rx}|${sh.ry}`, () => shadowTexture(sh.rx, sh.ry));
      const s = tones.next(t, sh.x - f.camX - t.width / 2, sh.y - t.height / 2);
      s.blendMode = "min";
      s.alpha = 1;
    }
    tones.end();
    app.renderer.render({ container: toneStage, target: toneTarget, clear: true, clearColor: 0x000000 });

    for (const i of f.ink) inks.next(textureOf(i.key, () => fromCanvas(i.canvas)), i.x - f.camX, i.y);
    const fgShift = Math.round(f.camX * 1.5);
    for (const i of f.fg) inks.next(textureOf(i.key, () => fromCanvas(i.canvas)), i.x - fgShift, i.y);
    inks.end();
    app.renderer.render({ container: app.stage });
    trimTextures();
  }

  let last = performance.now();
  let raf = 0;
  function loop(now: number) {
    const t0 = performance.now();
    game.update((now - last) / 1000);
    last = now;
    draw(game.frame());
    shell.tick(performance.now() - t0);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  // 화면을 떠나면 그리기를 멈춘다. Pixi 가 따로 돌리는 관리용 틱(자원 수거)도 함께 세운다.
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(raf);
    if (document.hidden) {
      Ticker.system.stop();
    } else {
      Ticker.system.start();
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  });
  // 페이지를 떠나면 GPU 자원을 돌려준다. 셰이더가 쥔 텍스처를 먼저 놓게 셰이더부터 정리한다.
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(raf);
    shader.destroy(true);
    for (const t of textures.values()) t.destroy(true);
    textures.clear();
    bayer.destroy(true);
    toneTarget.destroy(true);
    app.destroy(true, { children: true });
  });
  // 정리한 뒤에 "뒤로 가기"로 되살아난 페이지는 빈 캔버스다. 다시 연다.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) window.location.reload();
  });
}

void start();
