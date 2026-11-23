import { expect, test, type Page } from "@playwright/test";
import { getDailyPuzzle } from "../src/data/puzzles";
import { TEST_DATE, expectLayoutOk, offToneRatio, preset } from "./helpers";
import { solve } from "./solve";

/**
 * 쿼터뷰 홈(?view=iso). 화면의 대부분이 방이고, 갈 곳의 목록 대신 방 안의 문과 물건을 누른다.
 * 기본 홈(옆에서 본 복도)은 그대로이고 다른 테스트들이 본다. 여기서는 쿼터뷰 홈이 실제로 플레이되는지,
 * 낮은 화면에서 넘치지 않는지, 두 색 규칙을 지키는지 본다.
 */

const ISO = "&view=iso";
const SHOTS = "docs/compare/iso";

const home = (page: Page) => page.getByTestId("home-screen");

/** 탐정이 그곳에 도착할 때까지 기다린다 */
const arrived = (page: Page, spot: string) => expect(home(page)).toHaveAttribute("data-at", spot);

/** 장면의 한 자리를 누른다 (x, y 는 방 그림의 점 좌표: 196×300점) */
async function tapWorld(page: Page, x: number, y: number) {
  const box = (await page.getByTestId("iso-canvas").boundingBox())!;
  await page.touchscreen.tap(box.x + (x / 196) * box.width, box.y + (y / 300) * box.height);
}

test("주소에 view=iso 가 없으면 지금의 홈 그대로다", async ({ page }) => {
  await preset(page, "daily-unsolved");
  await expect(home(page)).toHaveAttribute("data-home", "b");
  await expect(page.getByTestId("iso-stage")).toHaveCount(0);
});

test("들어서면 탐정이 오늘 할 일 앞에 서고, 큰 단추 한 번으로 들어간다", async ({ page }) => {
  await preset(page, "daily-unsolved", ISO);
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
  await preset(page, "daily-unsolved", ISO);
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
  await preset(page, "promoted", ISO);
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
  await preset(page, "promoted", ISO);
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

test("오늘의 추리를 풀고 돌아오면 쿼터뷰 홀 그대로이고, 게시판은 해결로 바뀌고 탐정은 다음 할 일로 간다", async ({ page }) => {
  await preset(page, "daily-unsolved", ISO);
  await arrived(page, "board");
  await page.getByTestId("daily-file-cta").click();
  await solve(page, getDailyPuzzle(TEST_DATE));
  await expect(page.getByTestId("reward")).toBeVisible();
  await page.goto("/?demo=1&view=iso#/");
  await expect(home(page)).toHaveAttribute("data-home", "iso");
  await expect(page.getByTestId("daily-file-status")).toHaveText("해결");
  await expect(home(page)).toHaveAttribute("data-next", "practice");
  await arrived(page, "practice");
  expect(page.url()).toContain("view=iso");
});

test("가는 중에 같은 곳을 한 번 더 누르면 걸음을 건너뛴다", async ({ page }) => {
  await preset(page, "daily-unsolved", ISO);
  await arrived(page, "board");
  const spot = page.getByTestId("exam-wait");
  await spot.tap();
  await spot.tap();
  // 건너뛰어 도착했고, 들어가지는 않았다(들어가는 것은 도착한 뒤의 누름이다)
  await arrived(page, "exam");
  await expect(page).not.toHaveURL(/#\/exam/);
  await expect(page.locator(".isocard")).toContainText("승급 시험실");
});

test("바닥을 누르면 그리로 걷고, 아래 창은 안내로 바뀐다", async ({ page }) => {
  await preset(page, "daily-unsolved", ISO);
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
  await preset(page, "daily-unsolved", ISO);
  await arrived(page, "board");
  await tapWorld(page, 149, 150);
  await expect(home(page)).toHaveAttribute("data-at", "");
  await expect(page.locator(".isostage .narr")).toContainText("빗물");
  // 들어갈 곳이 아니므로 아래 창에는 할 일이 뜨지 않는다
  await expect(page.locator(".isocard")).toHaveCount(0);
});

test("음악은 꺼진 채 시작하고, 방 구석의 단추로 켜고 끈다", async ({ page }) => {
  await preset(page, "daily-unsolved", ISO);
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
  await preset(page, "daily-unsolved", ISO);
  await arrived(page, "board");
  await expect(page.getByTestId("story-entry")).toHaveCount(0);
  await preset(page, "promoted", ISO);
  await expect(page.getByTestId("story-entry")).toBeVisible();
  await page.getByTestId("story-entry").tap();
  await arrived(page, "case");
  await expect(page.getByTestId("story-entry-status")).toHaveText("새 사건");
  await page.screenshot({ path: `${SHOTS}/home-iso-case.png`, style: ".demo { visibility: hidden !important; }" });
  await page.getByTestId("story-entry-go").click();
  await expect(page).toHaveURL(/#\/story\/d001/);
});

test("시험을 볼 수 있으면 탐정이 시험실 문 앞에 서고 응시로 이어진다", async ({ page }) => {
  await preset(page, "exam-ready", ISO);
  await arrived(page, "exam");
  await expect(page.locator(".isocard")).toContainText("D급 응시 가능");
  await page.screenshot({ path: `${SHOTS}/home-iso-exam.png`, style: ".demo { visibility: hidden !important; }" });
  await page.getByTestId("exam-cta-go").click();
  await expect(page.getByTestId("exam-gate")).toBeVisible();
});

test("키보드로도 간다: 누르는 자리로 옮겨 가 Enter", async ({ page }) => {
  await preset(page, "daily-unsolved", ISO);
  await arrived(page, "board");
  await page.getByTestId("practice-entry").focus();
  await page.keyboard.press("Enter");
  await arrived(page, "practice");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/practice/);
});

test("두 색뿐이다: 방, 이름표, 아래 창", async ({ page }) => {
  await preset(page, "promoted", ISO);
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

for (const [w, h] of [
  [390, 664],
  [375, 629],
] as const) {
  test.describe(`낮은 화면 ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test("넘치지 않고, 방의 문과 물건이 모두 화면 안에서 눌린다", async ({ page }) => {
      await preset(page, "promoted", ISO);
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
      await page.screenshot({ path: `${SHOTS}/home-iso-${w}x${h}.png`, style: ".demo { visibility: hidden !important; }" });
    });
  });
}

test.describe("모션 줄이기", () => {
  test.use({ reducedMotion: "reduce" });

  test("걷지 않고 곧바로 그 앞에 서며, 장면은 멈춘 한 장이다", async ({ page }) => {
    await preset(page, "daily-unsolved", ISO);
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
