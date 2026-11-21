// 개발 서버 화면을 찍는다 (그림 검수용).
//   node scripts/shot.mjs <out.png> <preset|-> [#/route] [--w 390] [--h 844] [--click a,b] [--wait 600] [--engine webkit] [--q home=b] [--base http://localhost:5183]
import { chromium, webkit } from "@playwright/test";

const args = process.argv.slice(2);
const [out, preset = "-", route = ""] = args;
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const width = Number(opt("w", 390));
const height = Number(opt("h", 844));
const base = opt("base", "http://localhost:5183");
const clicks = (opt("click", "") || "").split(",").filter(Boolean);
const wait = Number(opt("wait", 700));
// --q home=b 처럼 주소에 덧붙일 것
const query = "?demo=1" + (opt("q", "") ? `&${opt("q", "")}` : "");

const browser = await (opt("engine", "chromium") === "webkit" ? webkit : chromium).launch();
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
});
const page = await context.newPage();
page.on("console", (m) => {
  if (m.type() === "error") console.log("[console.error]", m.text());
});
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

await page.goto(`${base}/${query}`);
if (preset !== "-") {
  await page.getByTestId("demo-toggle").click();
  await page.getByTestId(`demo-${preset}`).click();
}
if (route) {
  await page.goto(`${base}/${query}${route}`);
}
for (const id of clicks) {
  if (id.startsWith("sleep:")) {
    await page.waitForTimeout(Number(id.slice(6)));
    continue;
  }
  if (id.startsWith("code:")) {
    // 다이얼을 원하는 숫자로 맞춘다: code:426
    const digits = id.slice(5).split("").map(Number);
    for (let i = 0; i < digits.length; i++) {
      for (let k = 0; k < 9; k++) {
        const now = Number(await page.getByTestId(`dial-${i}`).getAttribute("aria-valuenow"));
        if (now === digits[i]) break;
        await page.getByTestId(`dial-${i}-next`).click();
        await page.waitForTimeout(40);
      }
    }
    continue;
  }
  await page.getByTestId(id).first().click();
  await page.waitForTimeout(250);
}
await page.evaluate(() => document.fonts.ready.then(() => undefined));
await page.waitForTimeout(wait);
// QA 손잡이는 검수 화면에서 뺀다
await page.addStyleTag({ content: ".demo{display:none!important}" });
await page.screenshot({ path: out });
await browser.close();
console.log("saved", out);
