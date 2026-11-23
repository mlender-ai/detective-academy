import { expect, test, type Page } from "@playwright/test";
import { DAILY_CALENDAR, getDailyPuzzle } from "../src/data/puzzles";
import { TEST_DATE, expectLayoutOk, offToneRatio, preset } from "./helpers";
import { solve } from "./solve";

/**
 * 홈 · 쿼터뷰 학원 홀. 화면의 대부분이 방이고, 갈 곳의 목록 대신 방 안의 문과 물건을 누른다.
 * 홈이 실제로 플레이되는지(걸어가 살펴보기, 큰 단추로 들어가기, 걷는 중의 누름), 여러 화면 크기에서 넘치지 않는지, 두 색 규칙을 지키는지 본다.
 * 예전 홈(옆에서 본 복도 + 명령 창, ?view=side)은 걷어냈다: 그 주소로 열어도 이 홈이 열린다.
 */

const SHOTS = "docs/compare/iso";

const home = (page: Page) => page.getByTestId("home-screen");

/** 탐정이 그곳에 도착할 때까지 기다린다 */
const arrived = (page: Page, spot: string) => expect(home(page)).toHaveAttribute("data-at", spot);

/** 장면의 한 자리를 누른다 (x, y 는 방 그림의 점 좌표: 196×300점) */
async function tapWorld(page: Page, x: number, y: number) {
  const box = (await page.getByTestId("iso-canvas").boundingBox())!;
  await page.touchscreen.tap(box.x + (x / 196) * box.width, box.y + (y / 300) * box.height);
}

test("걷어낸 홈의 주소(?view=side · ?home=old · ?home=a)로 열어도, 저장소에 예전 값이 남아 있어도 지금의 홈이 열린다", async ({ page }) => {
  for (const old of ["view=side", "home=old", "home=a"]) {
    await preset(page, "daily-unsolved", `&${old}`);
    await expect(home(page)).toHaveAttribute("data-home", "iso");
    await expect(page.getByTestId("iso-canvas")).toBeVisible();
    await expect(page.locator(".cmd")).toHaveCount(0);
    await expect(page.getByTestId("live-scene")).toHaveCount(0);
  }
  // 예전 홈으로 돌리던 저장소의 값(detective-academy:view)은 더는 듣지 않는다
  await page.evaluate(() => window.localStorage.setItem("detective-academy:view", "side"));
  await page.goto("/?demo=1");
  await expect(home(page)).toHaveAttribute("data-home", "iso");
  await arrived(page, "board");
  await page.getByTestId("daily-file-cta").click();
  await expect(page).toHaveURL(/#\/daily/);
  // 들어간 곳(자료실)도 방이다
  await expect(page.getByTestId("play-screen")).toHaveAttribute("data-view", "iso");
});

test("들어서면 탐정이 오늘 할 일 앞에 서고, 큰 단추 한 번으로 들어간다", async ({ page }) => {
  await preset(page, "daily-unsolved");
  await expect(home(page)).toHaveAttribute("data-home", "iso");
  await arrived(page, "board");
  // 갈 곳의 목록(명령 창)은 없다. 아래 창에는 지금 선 곳의 할 일 하나만 있다.
  await expect(page.locator(".cmd")).toHaveCount(0);
  await expect(page.locator(".isocard")).toHaveCount(1);
  await expect(page.locator(".isocard")).toContainText("시험 게시판");
  await expect(page.getByTestId("daily-file-status")).toHaveText("미해결");
  await page.screenshot({ path: `${SHOTS}/home-iso-board.png`, style: ".demo { visibility: hidden !important; }" });
  await page.getByTestId("daily-file-cta").click();
  await expect(page).toHaveURL(/#\/daily/);
});

test("문을 누르면 걸어가 살펴보고, 한 번 더 누르면 들어간다", async ({ page }) => {
  await preset(page, "daily-unsolved");
  await arrived(page, "board");
  await page.getByTestId("practice-entry").tap();
  await arrived(page, "practice");
  await expect(page.locator(".isocard")).toContainText("연습실");
  await expect(page.locator(".isocard")).toContainText("해결 0/15");
  await expect(page).toHaveURL(/#\/$|\/\?[^#]*$/);
  await page.getByTestId("practice-entry").tap();
  await expect(page).toHaveURL(/#\/practice/);
});

test("이름표를 눌러도 그곳으로 간다(창이나 의자로 새지 않는다)", async ({ page }) => {
  await preset(page, "promoted");
  await arrived(page, "practice");
  for (const [id, spot] of [
    ["story-entry", "case"],
    ["identity", "archive"],
    ["exam-wait", "exam"],
    ["daily-file", "board"],
    ["practice-entry", "practice"],
  ] as const) {
    // 바닥을 눌러 아무 곳도 고르지 않은 상태로 돌아가면 이름표가 모두 보인다
    await tapWorld(page, 110, 250);
    await expect(home(page)).toHaveAttribute("data-at", "");
    const tag = page.getByTestId(id).locator(".isotag");
    await expect(tag).toBeVisible();
    const box = (await tag.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await arrived(page, spot);
  }
});

test("이름표는 오늘 할 일과 고른 곳에만 남고, 둘러볼 때는 모두 보인다. 할 일 단추로 돌아간다.", async ({ page }) => {
  await preset(page, "promoted");
  await arrived(page, "practice");
  // 들어선 직후에는 모두 보인다
  await expect(page.getByTestId("identity").locator(".isotag")).toBeVisible();
  await page.getByTestId("identity").tap();
  await arrived(page, "archive");
  // 잠시 뒤에는 고른 곳(보관함)과 오늘 할 일(연습실)의 것만 남는다
  await expect(page.getByTestId("daily-file").locator(".isotag")).toBeHidden();
  await expect(page.getByTestId("identity").locator(".isotag")).toBeVisible();
  await expect(page.getByTestId("practice-entry").locator(".isotag")).toBeVisible();
  await expect(page.getByTestId("practice-entry").locator(".isotag")).toContainText("!");
  // 가려진 이름표의 물건도 그대로 눌린다
  await page.getByTestId("daily-file").tap();
  await arrived(page, "board");
  // 바닥으로 나오면 모두 보이고, 아래 창에 오늘 할 일로 가는 단추가 있다
  await tapWorld(page, 110, 250);
  await expect(home(page)).toHaveAttribute("data-at", "");
  await expect(page.getByTestId("exam-wait").locator(".isotag")).toBeVisible();
  await page.getByTestId("iso-todo").tap();
  await arrived(page, "practice");
});

test("오늘의 추리를 풀고 돌아오면 게시판은 해결로 바뀌고 탐정은 다음 할 일로 간다", async ({ page }) => {
  await preset(page, "daily-unsolved");
  await arrived(page, "board");
  await page.getByTestId("daily-file-cta").click();
  await solve(page, getDailyPuzzle(TEST_DATE));
  await expect(page.getByTestId("reward")).toBeVisible();
  await page.goto("/?demo=1#/");
  await expect(home(page)).toHaveAttribute("data-home", "iso");
  await expect(page.getByTestId("daily-file-status")).toHaveText("해결");
  await expect(home(page)).toHaveAttribute("data-next", "practice");
  await arrived(page, "practice");
});

test("가는 중에 같은 곳을 한 번 더 누르면 걸음을 건너뛴다", async ({ page }) => {
  await preset(page, "daily-unsolved");
  await arrived(page, "board");
  const spot = page.getByTestId("exam-wait");
  await spot.tap();
  await spot.tap();
  // 건너뛰어 도착했고, 들어가지는 않았다(들어가는 것은 도착한 뒤의 누름이다)
  await arrived(page, "exam");
  await expect(page).not.toHaveURL(/#\/exam/);
  await expect(page.locator(".isocard")).toContainText("승급 시험실");
});

test("가는 중에 아래 창의 큰 단추를 누르면 도착하는 대로 들어간다 (3초 안쪽)", async ({ page }) => {
  await preset(page, "daily-unsolved");
  await arrived(page, "board");
  const started = Date.now();
  await page.getByTestId("practice-entry").tap();
  // 누르자마자 아래 창이 그곳으로 바뀐다(탐정은 아직 걷는 중이다)
  await expect(page.locator(".isocard")).toContainText("연습실");
  await page.getByTestId("practice-entry-go").click();
  await expect(page).toHaveURL(/#\/practice$/);
  expect(Date.now() - started).toBeLessThan(3000);
});

test("걷는 중에 큰 단추를 빠르게 여러 번 눌러도 한 번만 들어간다", async ({ page }) => {
  await preset(page, "exam-ready");
  await arrived(page, "exam");
  // 가장 먼 길: 시험실 문 앞 → 기록 보관함
  await page.getByTestId("identity").tap();
  const go = page.getByTestId("identity-go");
  await go.click();
  await go.click({ force: true, timeout: 1000 }).catch(() => undefined);
  await expect(page).toHaveURL(/#\/profile$/);
  await page.waitForTimeout(500);
  await page.goBack();
  // 한 번만 들어갔으므로 한 번 뒤로 가면 홈이고, 눌림이 살아 있다
  await expect(home(page)).toBeVisible();
  await arrived(page, "exam");
  await page.getByTestId("exam-cta-go").click();
  await expect(page.getByTestId("exam-gate")).toBeVisible();
});

test("탐정이 걷는 중에 할 일이 바뀌어도, 새 할 일의 큰 단추를 누르면 그곳으로 들어간다", async ({ page }) => {
  // 연습실로 걸어가는 중에(들어선 지 0.42초 뒤에 출발한다) 할 일을 시험실로 바꾼다.
  // 아래 창은 곧바로 시험실로 바뀌지만 탐정은 아직 연습실로 가는 중이다. 이때 눌러도 시험실로 가야 한다.
  await preset(page, "daily-solved");
  await expect(home(page)).toHaveAttribute("data-next", "practice");
  await page.waitForTimeout(550);
  await page.getByTestId("demo-toggle").click();
  await page.getByTestId("demo-exam-ready").click();
  await page.getByTestId("exam-cta-go").click();
  await expect(page).toHaveURL(/#\/exam$/);
  await expect(page.getByTestId("exam-gate")).toBeVisible();
});

test("바닥을 누르면 그리로 걷고, 아래 창은 안내로 바뀐다", async ({ page }) => {
  await preset(page, "daily-unsolved");
  await arrived(page, "board");
  await tapWorld(page, 110, 250);
  await expect(home(page)).toHaveAttribute("data-at", "");
  await expect(page.locator(".isocard")).toHaveCount(0);
  await expect(page.locator(".isowin__hint")).toBeVisible();
  // 방 밖(어둠)을 눌러도 아무 일이 없다
  await tapWorld(page, 20, 80);
  await expect(home(page)).toHaveAttribute("data-at", "");
  // 벽을 누르면 그 벽 아래의 바닥으로 걷는다(물건으로 새지 않는다)
  await tapWorld(page, 70, 215);
  await page.waitForTimeout(900);
  await expect(home(page)).toHaveAttribute("data-at", "");
  // 다시 물건을 누르면 그 앞으로 간다
  await page.getByTestId("identity").tap();
  await arrived(page, "archive");
  await page.getByTestId("identity-go").click();
  await expect(page).toHaveURL(/#\/profile/);
});

test("창을 누르면 다가가 살펴본다: 서술 한 줄이 그 이야기로 바뀐다", async ({ page }) => {
  await preset(page, "daily-unsolved");
  await arrived(page, "board");
  await tapWorld(page, 149, 150);
  await expect(home(page)).toHaveAttribute("data-at", "");
  await expect(page.locator(".isostage .narr")).toContainText("빗물");
  // 들어갈 곳이 아니므로 아래 창에는 할 일이 뜨지 않는다
  await expect(page.locator(".isocard")).toHaveCount(0);
});

test("음악은 꺼진 채 시작하고, 방 구석의 단추로 켜고 끈다", async ({ page }) => {
  await preset(page, "daily-unsolved");
  await arrived(page, "board");
  const music = page.getByTestId("iso-music");
  await expect(music).toHaveAttribute("aria-checked", "false");
  expect(await page.evaluate(() => document.documentElement.dataset.music ?? "")).toBe("");
  const box = (await music.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await music.tap();
  await expect(music).toHaveAttribute("aria-checked", "true");
  // 홈의 곡이 흐른다. 단추는 방의 물건이나 바닥으로 새지 않는다(탐정은 그대로 게시판 앞이다).
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.music ?? "")).toBe("corridor");
  await expect(home(page)).toHaveAttribute("data-at", "board");
  await music.tap();
  await expect(music).toHaveAttribute("aria-checked", "false");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.music ?? "")).toBe("");
});

test("사건 접수함(텔레비전)은 D급부터 방에 놓인다", async ({ page }) => {
  await preset(page, "daily-unsolved");
  await arrived(page, "board");
  await expect(page.getByTestId("story-entry")).toHaveCount(0);
  await preset(page, "promoted");
  await expect(page.getByTestId("story-entry")).toBeVisible();
  await page.getByTestId("story-entry").tap();
  await arrived(page, "case");
  await expect(page.getByTestId("story-entry-status")).toHaveText("새 사건");
  await page.screenshot({ path: `${SHOTS}/home-iso-case.png`, style: ".demo { visibility: hidden !important; }" });
  await page.getByTestId("story-entry-go").click();
  await expect(page).toHaveURL(/#\/story\/d001/);
});

test("시험을 볼 수 있으면 탐정이 시험실 문 앞에 서고 응시로 이어진다", async ({ page }) => {
  await preset(page, "exam-ready");
  await arrived(page, "exam");
  await expect(page.locator(".isocard")).toContainText("D급 응시 가능");
  await page.screenshot({ path: `${SHOTS}/home-iso-exam.png`, style: ".demo { visibility: hidden !important; }" });
  await page.getByTestId("exam-cta-go").click();
  await expect(page.getByTestId("exam-gate")).toBeVisible();
});

test("키보드로도 간다: 누르는 자리로 옮겨 가 Enter", async ({ page }) => {
  await preset(page, "daily-unsolved");
  await arrived(page, "board");
  await page.getByTestId("practice-entry").focus();
  await page.keyboard.press("Enter");
  await arrived(page, "practice");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/practice/);
});

test("두 색뿐이다: 방, 이름표, 아래 창", async ({ page }) => {
  await preset(page, "promoted");
  await arrived(page, "practice");
  expect(await offToneRatio(page)).toBeLessThan(0.0005);
  await page.getByTestId("exam-wait").tap();
  await arrived(page, "exam");
  expect(await offToneRatio(page)).toBeLessThan(0.0005);
  await tapWorld(page, 110, 250);
  await expect(home(page)).toHaveAttribute("data-at", "");
  await page.waitForTimeout(1200);
  expect(await offToneRatio(page)).toBeLessThan(0.0005);
});

/**
 * 주소창이 보이는 휴대폰의 크기들(390×664 아이폰 12~14 · 375×629 13 미니 · 393×659 15·16 · 375×667 · 390×720 · 428×746 프로 맥스)과
 * 주소창이 없을 때의 크기 둘(375×812 · 430×932). 예전 홈의 네 줄·다섯 줄 배치를 보던 크기들을 그대로 물려받았다.
 */
/** 2026년 11월의 그날을 오늘로 놓고, 게시판을 고른 홈의 아래 창이 제 자리(못박힌 높이) 안에 있는지 본다 */
async function expectBoardFits(page: Page, dateKey: string, height: number) {
  await page.goto(`/?demo=1&date=${dateKey}`);
  await expect(home(page)).toHaveAttribute("data-at", /\w/);
  // 이미 푼 문제의 날은 탐정이 다른 곳에 선다: 게시판을 눌러 고른다
  if ((await home(page).getAttribute("data-at")) !== "board") await page.getByTestId("daily-file").tap();
  await arrived(page, "board");
  const name = `${dateKey} 의 게시판`;
  await expectLayoutOk(page, '[data-testid="daily-file-cta"]');
  expect(await home(page).evaluate((el) => el.scrollHeight - el.clientHeight), `${name}: 홈이 세로로 넘친다`).toBeLessThanOrEqual(0);
  // 아래 창은 높이가 못박혀 있다: 제목이 길어 줄이 늘면 창 위로(방 쪽으로) 넘친다
  const win = (await page.locator(".isowin").boundingBox())!;
  const card = (await page.locator(".isocard").boundingBox())!;
  expect(card.y, `${name}: 아래 창의 내용이 방 쪽으로 넘친다`).toBeGreaterThanOrEqual(win.y);
  expect(card.y + card.height, `${name}: 아래 창의 내용이 화면 아래로 넘친다`).toBeLessThanOrEqual(height);
}

/** 달력의 i 번째 날짜 (0 = 시작일) */
function calendarDate(i: number): string {
  return new Date(Date.parse(`${DAILY_CALENDAR.start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
}

const SIZES = [
  [390, 664],
  [375, 629],
  [393, 659],
  [375, 667],
  [390, 720],
  [428, 746],
  [375, 812],
  [430, 932],
] as const;

for (const [w, h] of SIZES) {
  test.describe(`화면 크기 ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test("F급(갈 곳 넷): 오늘의 추리가 붙은 게시판의 큰 단추와 방 안의 누르는 자리가 화면 안에 있다", async ({ page }) => {
      await preset(page, "daily-unsolved");
      await arrived(page, "board");
      await expectLayoutOk(page, '[data-testid="daily-file-cta"]');
      expect(await home(page).evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
      const stage = (await page.getByTestId("iso-stage").boundingBox())!;
      for (const id of ["daily-file", "practice-entry", "exam-wait", "identity"]) {
        const box = (await page.getByTestId(id).boundingBox())!;
        expect(box.width, `${id} 의 터치 영역이 좁다`).toBeGreaterThanOrEqual(44);
        expect(box.height, `${id} 의 터치 영역이 낮다`).toBeGreaterThanOrEqual(44);
        expect(box.y + box.height / 2, `${id} 가 방 아래로 잘린다`).toBeLessThan(stage.y + stage.height);
      }
      // 사건 접수함은 D급부터 놓인다
      await expect(page.getByTestId("story-entry")).toHaveCount(0);
    });

    test("오늘의 추리가 달력의 어느 문제든, 게시판을 고른 아래 창이 제 자리를 넘지 않는다", async ({ page }) => {
      test.setTimeout(90_000);
      await page.emulateMedia({ reducedMotion: "reduce" }); // 걷는 시간을 기다리지 않는다(배치는 같다)
      await preset(page, "promoted");
      // 좁은 화면(폭 384px 아래)에서는 제목이 16px 로 낮아져 긴 제목도 한 줄이다. 새 문제의 제목이 길어 넘치면 여기서 걸린다.
      for (let i = 0; i < DAILY_CALENDAR.order.length; i++) await expectBoardFits(page, calendarDate(i), h);
    });

    test("D급(갈 곳 다섯): 넘치지 않고, 방의 문과 물건이 모두 화면 안에서 눌린다", async ({ page }) => {
      await preset(page, "promoted");
      await arrived(page, "practice");
      const overflow = await home(page).evaluate((el) => el.scrollHeight - el.clientHeight);
      expect(overflow).toBeLessThanOrEqual(0);
      await expectLayoutOk(page, '[data-testid="practice-entry-go"]');
      const stage = (await page.getByTestId("iso-stage").boundingBox())!;
      const caption = (await page.locator(".isostage .narr").boundingBox())!;
      for (const id of ["daily-file", "practice-entry", "exam-wait", "story-entry", "identity"]) {
        const box = (await page.getByTestId(id).boundingBox())!;
        expect(box.width, id).toBeGreaterThanOrEqual(44);
        expect(box.height, id).toBeGreaterThanOrEqual(44);
        // 누르는 자리의 한가운데가 방 안이고 서술 띠에 가리지 않는다
        const cy = box.y + box.height / 2;
        expect(cy, id).toBeGreaterThan(caption.y + caption.height);
        expect(cy, id).toBeLessThan(stage.y + stage.height);
      }
      // 서술 띠는 누름을 삼킨다: 띠 밑에 가려진 창으로 걸어가지 않는다
      await page.touchscreen.tap(caption.x + caption.width * 0.6, caption.y + caption.height / 2);
      await page.waitForTimeout(300);
      await expect(home(page)).toHaveAttribute("data-at", "practice");
      await expect(page.locator(".isocard")).toHaveCount(1);
      // 곳마다 가서 아래 창이 화면 안에 다 들어오는지 본다(창의 높이는 못박혀 있어 방이 밀리지 않는다)
      const before = (await page.getByTestId("iso-canvas").boundingBox())!;
      for (const [id, spot, go] of [
        ["daily-file", "board", "daily-file-cta"],
        ["exam-wait", "exam", "exam-wait-go"],
        ["story-entry", "case", "story-entry-go"],
        ["identity", "archive", "identity-go"],
      ] as const) {
        await page.getByTestId(id).tap();
        await arrived(page, spot);
        await expectLayoutOk(page, `[data-testid="${go}"]`);
        const now = (await page.getByTestId("iso-canvas").boundingBox())!;
        expect(now.y).toBe(before.y);
      }
      expect(await home(page).evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
      if ((w === 390 && h === 664) || (w === 375 && h === 629)) await page.screenshot({ path: `${SHOTS}/home-iso-${w}x${h}.png`, style: ".demo { visibility: hidden !important; }" });
    });
  });
}

test.describe("모션 줄이기", () => {
  test.use({ reducedMotion: "reduce" });

  test("걷지 않고 곧바로 그 앞에 서며, 장면은 멈춘 한 장이다", async ({ page }) => {
    await preset(page, "daily-unsolved");
    await arrived(page, "board");
    await page.getByTestId("practice-entry").tap();
    await arrived(page, "practice");
    const canvas = page.getByTestId("iso-canvas");
    const a = await canvas.screenshot();
    await page.waitForTimeout(700);
    const b = await canvas.screenshot();
    expect(a.equals(b)).toBe(true);
    await page.getByTestId("practice-entry-go").click();
    await expect(page).toHaveURL(/#\/practice/);
  });
});
