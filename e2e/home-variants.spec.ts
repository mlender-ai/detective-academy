import { expect, test, type Page } from "@playwright/test";
import { expectLayoutOk, offToneRatio, preset } from "./helpers";

/**
 * 메인 홈 비교안 (V3 GATE 02). 확정된 홈은 그대로이고, 주소에 ?home=a · ?home=b 를 붙였을 때만 열린다.
 * - A안 시네마틱 복도: 구성은 그대로, 복도가 살아 움직이고 갈 곳을 고르면 탐정이 걸어간다.
 * - B안 플레이 가능한 복도: 복도의 물건을 눌러 걸어가 살펴보거나, 명령 창으로 바로 들어간다.
 */

/** B안의 복도에서 물건의 자리를 누른다. x 는 복도 좌표(점), y 는 점 화면의 세로 좌표. 카메라가 왼쪽 끝에 있을 때만 맞는다. */
async function tapCorridor(page: Page, worldX: number, dotY: number) {
  const scene = (await page.getByTestId("live-scene").boundingBox())!;
  const canvas = (await page.locator('[data-testid="live-scene"] canvas').boundingBox())!;
  // 카메라가 왼쪽 끝이면 복도의 x=0 이 장면 창의 왼쪽 끝에 온다
  await page.touchscreen.tap(scene.x + worldX * 2, canvas.y + dotY * 2);
}

test("확정된 홈에는 비교안이 섞이지 않는다", async ({ page }) => {
  await preset(page, "daily-unsolved");
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(page.getByTestId("live-scene")).toHaveCount(0);
  await expect(page.locator(".hall__scene img")).toBeVisible();
});

test.describe("A안 · 시네마틱 복도", () => {
  test("구성은 그대로이고, 공고를 누르면 탐정이 걸어간 뒤 시험지가 펼쳐진다", async ({ page }) => {
    await preset(page, "daily-unsolved", "&home=a");
    await expect(page.getByTestId("home-screen")).toHaveAttribute("data-home", "a");
    await expect(page.locator('[data-testid="live-scene"][data-kind="depth"] canvas')).toBeVisible();
    // 지금 홈의 것들이 그대로 있다
    await expect(page.getByTestId("daily-file-status")).toHaveText("미해결");
    await expect(page.getByTestId("practice-entry")).toBeVisible();
    await expect(page.getByTestId("identity")).toBeVisible();
    await expect(page.getByTestId("credit-balance")).toBeVisible();
    await expectLayoutOk(page, '[data-testid="daily-file-cta"]');

    const started = Date.now();
    await page.getByTestId("daily-file").click();
    await expect(page.getByTestId("play-screen")).toBeVisible();
    // 걷는 연출은 1.2초 안쪽이다 (화면 전환 시간을 더해도 넉넉히 3초 안)
    expect(Date.now() - started).toBeLessThan(3000);
  });

  test("걷는 중에 한 번 더 누르면 건너뛴다", async ({ page }) => {
    await preset(page, "exam-ready", "&home=a");
    await expect(page.getByTestId("exam-cta")).toBeVisible();
    // 끝 방까지는 가장 먼 길이다. 두 번 누르면 곧바로 넘어간다.
    await page.getByTestId("exam-cta").click();
    await page.getByTestId("exam-cta").click();
    await expect(page.getByTestId("exam-gate")).toBeVisible({ timeout: 2000 });
  });

  test("연습실과 신분증으로도 걸어서 들어간다", async ({ page }) => {
    await preset(page, "daily-solved", "&home=a");
    await page.getByTestId("practice-entry").click();
    await expect(page).toHaveURL(/#\/practice$/);
    await page.goBack();
    await expect(page.getByTestId("home-screen")).toBeVisible();
    await page.getByTestId("identity").click();
    await expect(page).toHaveURL(/#\/profile$/);
  });

  test("두 가지 색으로만 그려진다", async ({ page }) => {
    await preset(page, "exam-ready", "&home=a");
    await expect(page.getByTestId("live-scene")).toBeVisible();
    await page.waitForTimeout(600);
    expect(await offToneRatio(page)).toBeLessThan(0.005);
  });
});

test.describe("B안 · 플레이 가능한 복도", () => {
  test("들어서면 탐정이 오늘 할 일 앞으로 가 서고, 명령 창의 줄을 누르면 곧바로 들어간다", async ({ page }) => {
    await preset(page, "daily-unsolved", "&home=b");
    const home = page.getByTestId("home-screen");
    await expect(home).toHaveAttribute("data-home", "b");
    await expect(page.locator('[data-testid="live-scene"][data-kind="side"] canvas')).toBeVisible();
    await expect(page.getByTestId("narration")).toContainText("오늘의 사건");
    // 오늘의 추리가 있는 게시판 줄이 펼쳐져 있다
    await expect(page.getByTestId("cmd-board")).toHaveAttribute("data-on", "true");
    await expect(page.getByTestId("cmd-board-state")).toContainText("미해결");
    await expect(page.getByTestId("cmd-board-go")).toHaveText("시험지 펼치기");
    await expect(page.getByTestId("home-rank")).toBeVisible();
    await expect(page.getByTestId("credit-balance")).toBeVisible();
    // 탐정이 게시판 앞에 선다
    await expect(home).toHaveAttribute("data-at", "board");
    await expectLayoutOk(page, '[data-testid="cmd-board-go"]');

    // 이미 그 앞이므로 걷지 않고 바로 들어간다
    await page.getByTestId("cmd-board").click();
    await expect(page.getByTestId("play-screen")).toBeVisible();
  });

  test("다른 곳의 줄을 누르면 걸어가서 들어간다 (1.2초 안쪽)", async ({ page }) => {
    await preset(page, "daily-unsolved", "&home=b");
    await expect(page.getByTestId("home-screen")).toHaveAttribute("data-at", "board");
    const started = Date.now();
    await page.getByTestId("cmd-practice").click();
    // 누르자마자 그 줄이 펼쳐진다
    await expect(page.getByTestId("cmd-practice")).toHaveAttribute("data-on", "true");
    await expect(page).toHaveURL(/#\/practice$/);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  test("복도의 물건을 누르면 걸어가 살펴보고, 한 번 더 누르면 들어간다", async ({ page }) => {
    await preset(page, "daily-unsolved", "&home=b");
    const home = page.getByTestId("home-screen");
    await expect(home).toHaveAttribute("data-at", "board");

    // 기록 보관함(복도 x 26~66, 세로 64~104)을 누른다
    await tapCorridor(page, 46, 84);
    await expect(home).toHaveAttribute("data-at", "archive");
    // 들어가지 않고 그 앞에서 살펴본다
    await expect(home).toBeVisible();
    await expect(page.getByTestId("cmd-archive")).toHaveAttribute("data-on", "true");
    await expect(page.getByTestId("narration")).toContainText("기록 보관함");
    await expect(page.getByTestId("cmd-archive-go")).toHaveText("신분증 보기");

    // 같은 물건을 한 번 더 누르면 들어간다
    await tapCorridor(page, 46, 84);
    await expect(page).toHaveURL(/#\/profile$/);

    // 돌아오면 다시 홈이고, 눌림이 살아 있다
    await page.goBack();
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute("data-at", "board");
    await page.getByTestId("cmd-board").click();
    await expect(page.getByTestId("play-screen")).toBeVisible();
  });

  test("걷는 중에 빠르게 여러 번 눌러도 한 번만 들어간다", async ({ page }) => {
    await preset(page, "exam-ready", "&home=b");
    const home = page.getByTestId("home-screen");
    await expect(home).toHaveAttribute("data-at", "exam");
    const row = page.getByTestId("cmd-archive");
    // 가장 먼 길: 시험실 앞 → 기록 보관함. 두 번째 누름은 걷기를 건너뛴다.
    await row.click();
    await row.click({ force: true }).catch(() => undefined);
    await expect(page).toHaveURL(/#\/profile$/);
    await page.waitForTimeout(500);
    await page.goBack();
    // 한 번만 들어갔으므로 한 번 뒤로 가면 홈이다
    await expect(home).toBeVisible();
  });

  test("시험을 볼 수 있으면 시험실 줄이 펼쳐지고 응시로 이어진다", async ({ page }) => {
    await preset(page, "exam-ready", "&home=b");
    await expect(page.getByTestId("cmd-exam")).toHaveAttribute("data-on", "true");
    await expect(page.getByTestId("cmd-exam-state")).toContainText("응시 가능");
    await expect(page.getByTestId("home-screen")).toHaveAttribute("data-at", "exam");
    await page.getByTestId("cmd-exam").click();
    await expect(page).toHaveURL(/#\/exam$/);
  });

  test("모션 줄이기 설정에서는 걷지 않고 곧바로 들어간다", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await preset(page, "daily-unsolved", "&home=b");
    await expect(page.locator('[data-testid="live-scene"] canvas')).toBeVisible();
    const started = Date.now();
    await page.getByTestId("cmd-practice").click();
    await expect(page).toHaveURL(/#\/practice$/);
    expect(Date.now() - started).toBeLessThan(1500);
  });

  test("두 가지 색으로만 그려진다", async ({ page }) => {
    await preset(page, "exam-ready", "&home=b");
    await expect(page.getByTestId("home-screen")).toHaveAttribute("data-at", "exam");
    await page.waitForTimeout(400);
    expect(await offToneRatio(page)).toBeLessThan(0.005);
  });
});

for (const size of [
  { width: 375, height: 667 },
  { width: 390, height: 664 },
  { width: 375, height: 812 },
  { width: 430, height: 932 },
]) {
  test.describe(`${size.width}×${size.height}`, () => {
    test.use({ viewport: size });

    test("A안: 주 버튼이 화면 안에 있다", async ({ page }) => {
      await preset(page, "daily-unsolved", "&home=a");
      await expect(page.getByTestId("live-scene")).toBeVisible();
      await expectLayoutOk(page, '[data-testid="daily-file-cta"]');
    });

    test("B안: 펼쳐진 줄과 나머지 줄이 모두 화면 안에 있다", async ({ page }) => {
      await preset(page, "daily-unsolved", "&home=b");
      await expect(page.getByTestId("home-screen")).toHaveAttribute("data-at", "board");
      await expectLayoutOk(page, '[data-testid="cmd-board-go"]');
      for (const id of ["cmd-practice", "cmd-exam", "cmd-archive"]) {
        const box = (await page.getByTestId(id).boundingBox())!;
        expect(box.y + box.height, `${id} 가 화면 아래로 잘린다`).toBeLessThanOrEqual(size.height);
        expect(box.height, `${id} 의 터치 영역이 44px 보다 작다`).toBeGreaterThanOrEqual(44);
      }
    });
  });
}
