// 제품(React + Canvas 2D) 화면을 Godot 실험과 같은 크기로 찍는다.
// 개발 서버(http://localhost:5183)가 떠 있어야 한다. 저장 칸은 godot-ref 를 따로 쓴다(실제 기록은 건드리지 않는다).
//   node lab/godot/capture-product.mjs [--out docs/compare/godot/raw] [--sizes 390x844,390x664]
import { chromium } from "../../node_modules/@playwright/test/index.mjs";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const out = resolve(here, "../..", opt("out", "docs/compare/godot/raw"));
const sizes = opt("sizes", "390x844,390x664").split(",").map((s) => s.split("x").map(Number));
const BASE = opt("base", "http://localhost:5183");
// 게임 날짜를 달력의 첫날로 고정한다: 그날의 오늘의 추리가 '자료실 금고의 암호'다(날이 바뀌면 다른 문제가 붙는다)
const Q = "?demo=1&date=2026-11-22&save=godot-ref&preset=daily-unsolved&apply=1&cine=0";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const [width, height] of sizes) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  const shot = async (name) => {
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const path = `${out}/product-${name}-${width}x${height}.png`;
    await page.screenshot({ path, style: ".demo { visibility: hidden !important; }" });
    console.log("저장", path);
  };

  // 1. 복도(홈): 오늘의 사건을 아직 풀지 않은 상태
  await page.goto(`${BASE}/${Q}`);
  await page.getByTestId("home-screen").waitFor();
  await page.waitForTimeout(1600);
  await shot("01-corridor");

  // 2. 자료실 책상: 게시판 줄을 눌러 걸어가서 들어간다
  await page.getByTestId("daily-file").click();
  await page.getByTestId("play-screen").waitFor();
  await page.waitForTimeout(2600);
  await shot("02-vault-desk");

  // 3. 금고 앞
  await page.getByTestId("to-safe").click();
  await page.getByTestId("dial-0").waitFor();
  await page.waitForTimeout(1500);
  await shot("03-vault-safe");

  // 4. 정답 순간: 426 을 맞추고 제출한다. 금고가 열린 장면에서 찍는다.
  const digits = [4, 2, 6];
  for (let i = 0; i < digits.length; i++) {
    for (let k = 0; k < 9; k++) {
      const now = Number(await page.getByTestId(`dial-${i}`).getAttribute("aria-valuenow"));
      if (now === digits[i]) break;
      await page.getByTestId(`dial-${i}-next`).click();
      await page.waitForTimeout(60);
    }
  }
  await page.waitForTimeout(300);
  await shot("03b-vault-dialed");
  await page.getByTestId("submit").click();
  await page.waitForTimeout(1150);
  await shot("04-solved");
  await page.waitForTimeout(1600);
  await shot("05-result");
  await context.close();
}
await browser.close();
