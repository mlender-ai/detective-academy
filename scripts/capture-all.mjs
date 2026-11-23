// 전 화면(홈·암호 해독·입학·연습실·진술 추리·승급 시험·신분증)을 한 번에 찍는다. 개발 서버(5183)가 켜져 있어야 한다(다른 포트면 --base).
// 홈은 쿼터뷰 학원 홀이다: 들어선 모습과, 방 안의 곳을 하나씩 골랐을 때의 아래 창을 찍는다.
// 암호 해독은 자료실(책상 ↔ 금고)을 오가며 찍는다. 오가는 단추가 없는 화면(--q play=c 의 수사 수첩)에서는 그 단계를 건너뛴다.
// 연습실은 서류함을 골라 가며 찍는다.
//   node scripts/capture-all.mjs <out-dir> [--q cine=0] [--w 390] [--h 844] [--only 이름,이름] [--engine webkit] [--base http://localhost:5183]
// 사파리 엔진(WebKit)은 이 프로젝트의 Playwright 에 없다. 다른 곳에 설치된 Playwright 를 쓰려면
//   PW=/경로/node_modules/@playwright/test node scripts/capture-all.mjs <out-dir> --engine webkit
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW ?? "@playwright/test");

const args = process.argv.slice(2);
const [outDir] = args;
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const width = Number(opt("w", 390));
const height = Number(opt("h", 844));
const only = (opt("only", "") || "").split(",").filter(Boolean);
const base = opt("base", "http://localhost:5183");
// --page other.html: 다른 진입점을 찍는다 (시안을 별도 진입점으로 얹었을 때)
const entry = opt("page", "");
// --q cine=0: 주소에 덧붙일 값 (자막 화면을 끄고 찍을 때)
const extra = opt("q", "");
// 게임 날짜는 달력의 첫날로 고정한다(오늘의 추리가 날마다 바뀐다. 그날의 문제가 아래에서 푸는 '자료실 금고의 암호'다). --q date=… 로 바꿀 수 있다.
const date = /(^|&)date=/.test(extra) ? "" : "&date=2026-11-22";
const query = `${entry}?demo=1&save=shot${date}${extra ? `&${extra}` : ""}`;
mkdirSync(outDir, { recursive: true });

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

const wants = (name) => only.length === 0 || only.includes(name);
const tap = (id) => page.getByTestId(id).first().click();

async function open(preset, route = "") {
  await page.goto(`${base}/${query}`);
  await page.getByTestId("demo-toggle").click();
  await page.getByTestId(`demo-${preset}`).click();
  if (route) await page.goto(`${base}/${query}${route}`);
  await page.waitForTimeout(250);
}

async function snap(name, wait = 700) {
  if (!wants(name)) return;
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${outDir}/${name}.png`, style: ".demo { visibility: hidden !important; }" });
  console.log("saved", name);
}

async function place(person, slot) {
  await tap(`card-${person}`);
  const box = await page.getByTestId(`slot-${slot}`).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(320);
}

/* 홈(쿼터뷰 학원 홀): 들어서면 탐정이 오늘 할 일 앞으로 걸어가 선다 */
await open("daily-unsolved");
await snap("home", 1500);
await open("daily-solved");
await snap("home-solved", 1500);
await open("exam-ready");
await snap("home-exam-ready", 1500);
await open("promoted");
await snap("home-promoted", 1500);
// 방 안의 곳을 하나씩 고른다: 탐정이 걸어가고 아래 창이 그곳의 것으로 바뀐다
for (const [id, name] of [
  ["daily-file", "board"],
  ["exam-wait", "exam"],
  ["story-entry", "case"],
  ["identity", "archive"],
]) {
  await tap(id);
  await snap(`home-promoted-${name}`, 1500);
}

/* 암호 해독: 자료실의 책상(기록·메모·수사 지원)과 금고(자물쇠·제출) */
/** 그 자리로 가는 단추가 있으면 누른다(한 화면짜리 풀이 화면에는 없다) */
const walk = async (spot) => {
  const button = page.getByTestId(spot === "safe" ? "to-safe" : "to-desk");
  if ((await button.count()) === 0) return false;
  await button.click();
  return true;
};
await open("daily-unsolved", "#/daily");
await snap("code", 1500);
await tap("memo-5");
await tap("memo-2");
await tap("memo-2");
await snap("code-memo", 300);
if (await walk("safe")) await snap("code-safe", 1200);
await tap("submit");
await snap("code-wrong", 500);
await walk("desk");
await tap("hint-button");
await snap("code-hints", 500);
await page.keyboard.press("Escape");
await walk("safe");
for (const [i, digit] of [4, 2, 6].entries()) {
  for (let k = 0; k < 9; k++) {
    if (Number(await page.getByTestId(`dial-${i}`).getAttribute("aria-valuenow")) === digit) break;
    await tap(`dial-${i}-next`);
    await page.waitForTimeout(40);
  }
}
await snap("code-filled", 400);
await tap("submit");
await snap("code-open", 1000);
await page.waitForTimeout(1200);
await snap("code-result", 2600);
await tap("explain-toggle");
await snap("code-result-explain", 300);
await open("promoted", "#/daily");
await snap("code-record");

/* 입학 */
await open("first-run");
await page.getByTestId("nickname-input").fill("끈질긴 수달");
await snap("admission", 1500);
await tap("enroll");
await snap("admission-issued", 1600);

/* 연습실: 등급마다 서류함이 선 방. 들어서면 풀지 않은 과제가 남은 가장 낮은 등급의 서류함 앞에 선다 */
await open("promoted", "#/practice");
await snap("practice", 1500);
await tap("drawer-D");
await snap("practice-d", 1500);
await tap("drawer-C");
await snap("practice-locked", 1500);
await tap("practice-door");
await snap("practice-door", 1500);

/* 진술 추리 */
await open("daily-solved", "#/practice");
await tap("practice-file-practice-truth-001");
await page.waitForTimeout(700);
await snap("truth");
await tap("suspect-hana");
await tap("memo-hana-false");
await tap("memo-junho-true");
await tap("memo-sera-true");
await tap("memo-daon-false");
await page.getByTestId("statement-junho").locator(".statement__main").click();
await snap("truth-memo");
await page.getByTestId("statement-junho").locator(".statement__main").click();
await tap("submit");
await snap("truth-wrong", 500);
await tap("suspect-sera");
await tap("submit");
await snap("truth-reveal", 1500);
await page.waitForTimeout(900);
await snap("truth-result", 2600);

/* 승급 시험 */
await open("exam-ready", "#/exam");
await snap("exam-gate");
await tap("open-envelope");
await snap("exam-opening", 760);
await page.waitForTimeout(900);
await snap("schedule");
await place("doyun", 0);
await place("minjae", 1);
await snap("schedule-half");
await place("sea", 2);
await place("harin", 3);
await tap("submit");
await snap("schedule-correct", 700);
await page.waitForTimeout(1200);
await snap("ceremony-start", 300);
await snap("ceremony", 4200);

await open("daily-unsolved", "#/exam");
await snap("exam-locked");
await open("promoted", "#/exam");
await snap("exam-passed");

/* 신분증 */
await open("promoted", "#/profile");
await snap("profile");
await page.evaluate(() => document.querySelector(".profile__scroll")?.scrollTo(0, 9999));
await snap("profile-bottom", 300);

await browser.close();
