// 같은 장면을 제품(React + Canvas 2D)과 Godot 웹 내보내기에서 같은 크기로 찍어 나란히 붙인다.
//   node lab/godot/capture-product.mjs      (제품 쪽: docs/compare/godot/raw/product-*.png)
//   node lab/godot/compare.mjs [--sizes 390x844,390x664,375x629]
// 준비: 제품의 개발 서버(5183), Godot 웹 내보내기의 정적 서버(5190).
// 결과: docs/compare/godot/pair-<장면>-<크기>.png 와 colors.json(두 색이 아닌 화소의 비율).
import { chromium } from "../../node_modules/@playwright/test/index.mjs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const outDir = resolve(here, "../../docs/compare/godot");
const raw = resolve(outDir, "raw");
mkdirSync(raw, { recursive: true });
const sizes = opt("sizes", "390x844,390x664,375x629").split("x").join("x").split(",").map((s) => s.split("x").map(Number));
const GODOT = opt("godot", "http://localhost:5190");
const DEV = opt("dev", "http://localhost:5183");

const browser = await chromium.launch();
const tool = await browser.newPage();
await tool.goto(`${DEV}/lab/godot/bake.html`).catch(() => {});

const state = (page) => page.evaluate(() => window.__da);
const until = async (page, test, what) => {
  const t0 = Date.now();
  for (;;) {
    const s = await state(page);
    let ok = false;
    try {
      ok = !!test(s);
    } catch {
      ok = false;
    }
    if (ok) return s;
    if (Date.now() - t0 > 20000) throw new Error(`기다리다 그만둠: ${what}`);
    await page.waitForTimeout(50);
  }
};
const tap = async (page, name) => {
  const r = (await state(page)).rects[name];
  await page.touchscreen.tap(r[0] + r[2] / 2, r[1] + r[3] / 2);
};

/** Godot 쪽 장면을 제품과 같은 차례로 찍는다. closeup: 금고 앞에서 카메라가 다가가는가(제품에는 없는 연출) */
async function godot(width, height, closeup) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  const tag = closeup ? "godot-closeup" : "godot";
  const shot = async (name) => {
    const path = `${raw}/${tag}-${name}-${width}x${height}.png`;
    await page.screenshot({ path });
    console.log("저장", path);
  };
  await page.goto(`${GODOT}/index.html${closeup ? "" : "?closeup=0"}`);
  await until(page, (s) => s.screen === "hall" && s.hall.here === "board" && !s.hall.busy, "복도");
  await page.waitForTimeout(1600);
  if (!closeup) await shot("01-corridor");
  await tap(page, "row-board");
  await until(page, (s) => s.screen === "vault" && s.vault.arrived && !s.vault.busy && !s.busy && s.vault.typed, "자료실");
  await page.waitForTimeout(300);
  if (!closeup) await shot("02-vault-desk");
  await tap(page, "right");
  await until(page, (s) => s.vault.spot === "safe" && s.vault.arrived && !s.vault.busy && s.rects["dial-0"] && s.vault.typed, "금고 앞");
  await page.waitForTimeout(500);
  await shot("03-vault-safe");
  const digits = [4, 2, 6];
  for (let i = 0; i < 3; i++)
    for (let k = 0; k < 9; k++) {
      const v = (await state(page)).vault.dials[i];
      if (v === digits[i]) break;
      await tap(page, `dial-${i}-next`);
      await until(page, (s) => s.vault.dials[i] !== v, "다이얼");
    }
  await page.waitForTimeout(300);
  if (!closeup) await shot("03b-vault-dialed");
  await tap(page, "right");
  await until(page, (s) => s.vault.phase === "checking", "정답");
  await page.waitForTimeout(1150);
  await shot("04-solved");
  await until(page, (s) => s.vault.phase === "result", "결과");
  await page.waitForTimeout(500);
  if (!closeup) await shot("05-result");
  await context.close();
}

/** 두 그림을 나란히 붙이고 이름표를 단다. 두 색이 아닌 화소도 센다. */
const pair = (leftB64, rightB64, leftLabel, rightLabel, title) =>
  tool.evaluate(
    async ({ leftB64, rightB64, leftLabel, rightLabel, title }) => {
      const load = async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        return img;
      };
      try {
        const face = new FontFace("NeoDGMPair", "url(/node_modules/@kfonts/neodgm/neodgm.woff2)");
        await face.load();
        document.fonts.add(face);
      } catch {
        // 글꼴을 못 읽으면 기본 글꼴로 적는다
      }
      const a = await load(leftB64);
      const b = await load(rightB64);
      const gap = 32;
      const head = 96;
      const c = document.createElement("canvas");
      c.width = a.width + b.width + gap * 3;
      c.height = Math.max(a.height, b.height) + head + gap;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#f1f1ea";
      ctx.font = "32px NeoDGMPair, monospace";
      ctx.textBaseline = "top";
      ctx.fillText(title, gap, 12);
      ctx.fillText(leftLabel, gap, 52);
      ctx.fillText(rightLabel, gap * 2 + a.width, 52);
      ctx.drawImage(a, gap, head);
      ctx.drawImage(b, gap * 2 + a.width, head);
      ctx.strokeStyle = "#f1f1ea";
      ctx.lineWidth = 2;
      ctx.strokeRect(gap - 1, head - 1, a.width + 2, a.height + 2);
      ctx.strokeRect(gap * 2 + a.width - 1, head - 1, b.width + 2, b.height + 2);
      const count = (img) => {
        const k = document.createElement("canvas");
        k.width = img.width;
        k.height = img.height;
        const kc = k.getContext("2d", { willReadFrequently: true });
        kc.drawImage(img, 0, 0);
        const d = kc.getImageData(0, 0, img.width, img.height).data;
        let other = 0;
        for (let i = 0; i < d.length; i += 4) {
          const two = (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 0) || (d[i] === 241 && d[i + 1] === 241 && d[i + 2] === 234);
          if (!two) other++;
        }
        return { total: d.length / 4, other, ratio: other / (d.length / 4) };
      };
      return { url: c.toDataURL("image/png"), left: count(a), right: count(b) };
    },
    { leftB64, rightB64, leftLabel, rightLabel, title },
  );

const SCENES = [
  ["01-corridor", "복도"],
  ["02-vault-desk", "자료실 · 책상"],
  ["03-vault-safe", "자료실 · 금고 앞"],
  ["03b-vault-dialed", "금고 앞 · 숫자를 맞춤"],
  ["04-solved", "정답 순간 · 금고가 열림"],
];
const colors = [];
for (const [width, height] of sizes) {
  await godot(width, height, false);
  await godot(width, height, true);
  const size = `${width}x${height}`;
  for (const [scene, label] of SCENES) {
    const left = `${raw}/product-${scene}-${size}.png`;
    const right = `${raw}/godot-${scene}-${size}.png`;
    if (!existsSync(left) || !existsSync(right)) {
      console.log("건너뜀(그림 없음):", scene, size);
      continue;
    }
    const r = await pair(readFileSync(left).toString("base64"), readFileSync(right).toString("base64"), "제품 · React + Canvas 2D", "Godot 4.7.2 · 웹 내보내기", `${label} · ${width}×${height}`);
    writeFileSync(`${outDir}/pair-${scene}-${size}.png`, Buffer.from(r.url.slice(r.url.indexOf(",") + 1), "base64"));
    colors.push({ scene, size, product: r.left, godot: r.right });
    console.log(`pair-${scene}-${size}.png · 두 색이 아닌 화소: 제품 ${(r.left.ratio * 100).toFixed(4)}% / Godot ${(r.right.ratio * 100).toFixed(4)}%`);
  }
  // 제품에 없는 연출(금고로 다가가는 카메라)은 Godot 의 두 판을 나란히 둔다
  for (const [scene, label] of [
    ["03-vault-safe", "금고 앞"],
    ["04-solved", "정답 순간"],
  ]) {
    const left = `${raw}/godot-${scene}-${size}.png`;
    const right = `${raw}/godot-closeup-${scene}-${size}.png`;
    if (!existsSync(left) || !existsSync(right)) continue;
    const r = await pair(readFileSync(left).toString("base64"), readFileSync(right).toString("base64"), "Godot · 제품과 같은 구도", "Godot · 카메라가 금고로 다가감", `${label} · ${width}×${height} · 카메라 클로즈업`);
    writeFileSync(`${outDir}/closeup-${scene}-${size}.png`, Buffer.from(r.url.slice(r.url.indexOf(",") + 1), "base64"));
    colors.push({ scene: `${scene}-closeup`, size, godot: r.right });
  }
}
writeFileSync(`${outDir}/colors.json`, JSON.stringify(colors, null, 1));
await browser.close();
