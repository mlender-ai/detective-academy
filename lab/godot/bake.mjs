// Godot 실험용 에셋을 파일로 받는다. 개발 서버(http://localhost:5183)가 떠 있어야 한다.
//   node lab/godot/bake.mjs [--out /…/detective-academy-rnd/godot/da-godot] [--base http://localhost:5183]
// 1) lab/godot/bake.html 이 제품의 장면 코드로 구운 층·탐정·기준 장면을 받아 쓴다.
// 2) 제품 화면의 작은 그림(엠블럼·화살표·주화·드럼의 꺾쇠·메모 표시)을 화면에서 그대로 찍어 온다(2배로 찍어 반으로 줄인다).
import { chromium } from "../../node_modules/@playwright/test/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const OUT = resolve(opt("out", resolve(here, "../../../detective-academy-rnd/godot/da-godot")));
const BASE = opt("base", "http://localhost:5183");
/** 기준 장면은 게임 꾸러미에 싣지 않는다: 프로젝트 밖(godot/ref)에 둔다 */
const REF = resolve(OUT, "../ref");

const write = (path, data) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
};
const fromDataUrl = (url) => Buffer.from(url.slice(url.indexOf(",") + 1), "base64");

const browser = await chromium.launch();

/* ───────── 1) 장면 코드로 구운 것 ───────── */
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("console", (m) => m.type() === "error" && console.log("[console.error]", m.text()));
  await page.goto(`${BASE}/lab/godot/bake.html`);
  await page.waitForFunction(() => !!window.__bake, null, { timeout: 120000 });
  const { files, json, text } = await page.evaluate(() => window.__bake);
  let bytes = 0;
  for (const [name, url] of Object.entries(files)) {
    const buf = fromDataUrl(url);
    bytes += buf.length;
    const path = name.startsWith("ref/") ? resolve(REF, name.slice(4)) : name.startsWith("font/") ? resolve(OUT, "fonts", name.slice(5)) : resolve(OUT, "assets", name);
    write(path, buf);
  }
  for (const [name, value] of Object.entries(json)) {
    const text = JSON.stringify(value, null, 1);
    if (name.startsWith("font/")) {
      console.log(`글꼴 ${name}: ${JSON.stringify(value)}`);
      continue;
    }
    const path = name.startsWith("ref/") ? resolve(REF, name.slice(4)) : name.startsWith("data/") ? resolve(OUT, name) : resolve(OUT, "assets", name);
    write(path, text);
  }
  // 글꼴은 프로젝트의 fonts/ 에 둔다(글자 그림과 차례표가 같은 폴더에 있어야 Godot 가 함께 가져온다)
  for (const [name, value] of Object.entries(text ?? {})) write(resolve(OUT, name.replace(/^font\//, "fonts/")), value);
  console.log(`구운 층: PNG ${Object.keys(files).length}개 ${(bytes / 1024).toFixed(1)}KB, JSON ${Object.keys(json).length}개 → ${OUT}`);
  await page.close();
}

/* ───────── 2) 제품 화면의 작은 그림 ───────── */
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });
  const page = await context.newPage();
  const tool = await context.newPage();
  await tool.goto("about:blank");

  /** 2배로 찍은 그림을 반으로 줄인다(가장 가까운 화소). 두 색만 남았는지도 센다. */
  const halve = (buf) =>
    tool.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const w = Math.round(img.width / 2);
      const h = Math.round(img.height / 2);
      const src = document.createElement("canvas");
      src.width = img.width;
      src.height = img.height;
      const sctx = src.getContext("2d");
      sctx.drawImage(img, 0, 0);
      const sd = sctx.getImageData(0, 0, img.width, img.height).data;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      const im = ctx.createImageData(w, h);
      let odd = 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const s = (y * 2 * img.width + x * 2) * 4;
          const o = (y * w + x) * 4;
          const white = sd[s] > 120;
          if (!((sd[s] === 241 && sd[s + 1] === 241 && sd[s + 2] === 234) || (sd[s] === 0 && sd[s + 1] === 0 && sd[s + 2] === 0))) odd++;
          im.data[o] = white ? 241 : 0;
          im.data[o + 1] = white ? 241 : 0;
          im.data[o + 2] = white ? 234 : 0;
          im.data[o + 3] = 255;
        }
      ctx.putImageData(im, 0, 0);
      return { url: c.toDataURL("image/png"), w, h, odd };
    }, buf.toString("base64"));

  // pad: 그림 둘레에 두른 흰 점은 상자 밖(2px)에 찍힌다. 그만큼 넓혀 찍는다(Godot 쪽은 pad 만큼 왼쪽 위로 당겨 놓는다).
  const grab = async (name, locator, pad = 0) => {
    const box = await locator.boundingBox();
    const clip = { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 };
    const buf = await page.screenshot({ clip, style: ".demo { visibility: hidden !important; }" });
    const { url, w, h, odd } = await halve(buf);
    write(resolve(OUT, "assets/ui", `${name}.png`), fromDataUrl(url));
    console.log(`화면에서 찍음: ui/${name}.png ${w}×${h} (둘레 ${pad}px)${odd ? ` · 두 색이 아닌 화소 ${odd}개를 가까운 색으로 옮김` : ""}`);
  };

  const Q = "?demo=1&save=godot-bake&preset=daily-unsolved&apply=1&cine=0";
  await page.goto(`${BASE}/${Q}`);
  await page.getByTestId("home-screen").waitFor();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(1200);
  await grab("crest", page.locator(".hall__sign svg.sprite"), 2);

  await page.getByTestId("daily-file").click();
  await page.getByTestId("play-screen").waitFor();
  await page.waitForTimeout(2200);
  await grab("back", page.locator(".deskbar .tilebtn"));
  await grab("coin", page.locator(".credittag svg.sprite"), 2);

  // 메모 표시: 글자를 숨기고 표시만 찍는다
  await page.addStyleTag({ content: ".memo__chip { -webkit-text-fill-color: transparent !important; }" });
  await page.getByTestId("memo-5").click();
  await page.getByTestId("memo-6").click();
  await page.getByTestId("memo-6").click();
  await page.waitForTimeout(900);
  await grab("mark-out", page.getByTestId("memo-5"));
  await grab("mark-maybe", page.getByTestId("memo-6"));

  await page.getByTestId("to-safe").click();
  await page.getByTestId("dial-0").waitFor();
  await page.waitForTimeout(900);
  await grab("chevron-up", page.locator(".dial__step svg.sprite").nth(0));
  await grab("chevron-down", page.locator(".dial__step svg.sprite").nth(1));
  await context.close();
}

await browser.close();
