import { expect, test, type Page } from "@playwright/test";
import { expectLayoutOk, offToneRatio, preset } from "./helpers";

/**
 * 메인 홈 · 플레이 가능한 복도 (V3 GATE 02 에서 사용자가 고른 B안).
 * 복도의 물건을 눌러 걸어가 살펴보거나, 명령 창의 줄로 바로 들어간다.
 * 예전 홈과 A안(시네마틱 복도)은 걷어냈다. 다시 보려면 docs/archive/v3-gate03-all-app/ 을 연다.
 */

/** 복도에서 물건의 자리를 누른다. x 는 복도 좌표(점), y 는 점 화면의 세로 좌표. 카메라가 왼쪽 끝에 있을 때만 맞는다. */
async function tapCorridor(page: Page, worldX: number, dotY: number) {
  const scene = (await page.getByTestId("live-scene").boundingBox())!;
  const canvas = (await page.locator('[data-testid="live-scene"] canvas').boundingBox())!;
  // 카메라가 왼쪽 끝이면 복도의 x=0 이 장면 창의 왼쪽 끝에 온다
  await page.touchscreen.tap(scene.x + worldX * 2, canvas.y + dotY * 2);
}

test.describe("홈 · 플레이 가능한 복도", () => {
  test("들어서면 탐정이 오늘 할 일 앞으로 가 서고, 명령 창의 줄을 누르면 곧바로 들어간다", async ({ page }) => {
    await preset(page, "daily-unsolved");
    const home = page.getByTestId("home-screen");
    await expect(home).toHaveAttribute("data-home", "b");
    await expect(page).not.toHaveURL(/home=/);
    await expect(page.locator('[data-testid="live-scene"][data-kind="side"] canvas')).toBeVisible();
    await expect(page.getByTestId("narration")).toContainText("오늘의 사건");
    // 오늘의 추리가 있는 게시판 줄이 펼쳐져 있다
    await expect(page.getByTestId("daily-file")).toHaveAttribute("data-on", "true");
    await expect(page.getByTestId("daily-file-status")).toHaveText("미해결");
    await expect(page.getByTestId("daily-file-cta")).toHaveText("시험지 펼치기");
    await expect(page.getByTestId("home-rank")).toBeVisible();
    await expect(page.getByTestId("credit-balance")).toBeVisible();
    // 탐정이 게시판 앞에 선다
    await expect(home).toHaveAttribute("data-at", "board");
    await expectLayoutOk(page, '[data-testid="daily-file-cta"]');

    // 이미 그 앞이므로 걷지 않고 바로 들어간다
    await page.getByTestId("daily-file").click();
    await expect(page.getByTestId("play-screen")).toBeVisible();
  });

  test("다른 곳의 줄을 누르면 걸어가서 들어간다 (1.2초 안쪽)", async ({ page }) => {
    await preset(page, "daily-unsolved");
    await expect(page.getByTestId("home-screen")).toHaveAttribute("data-at", "board");
    const started = Date.now();
    await page.getByTestId("practice-entry").click();
    // 누르자마자 그 줄이 펼쳐진다
    await expect(page.getByTestId("practice-entry")).toHaveAttribute("data-on", "true");
    await expect(page).toHaveURL(/#\/practice$/);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  test("복도의 물건을 누르면 걸어가 살펴보고, 한 번 더 누르면 들어간다", async ({ page }) => {
    await preset(page, "daily-unsolved");
    const home = page.getByTestId("home-screen");
    await expect(home).toHaveAttribute("data-at", "board");

    // 기록 보관함(복도 x 26~66, 세로 64~104)을 누른다
    await tapCorridor(page, 46, 84);
    await expect(home).toHaveAttribute("data-at", "archive");
    // 들어가지 않고 그 앞에서 살펴본다
    await expect(home).toBeVisible();
    await expect(page.getByTestId("identity")).toHaveAttribute("data-on", "true");
    await expect(page.getByTestId("narration")).toContainText("기록 보관함");
    await expect(page.getByTestId("identity-go")).toHaveText("신분증 보기");

    // 같은 물건을 한 번 더 누르면 들어간다
    await tapCorridor(page, 46, 84);
    await expect(page).toHaveURL(/#\/profile$/);

    // 돌아오면 다시 홈이고, 눌림이 살아 있다
    await page.goBack();
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute("data-at", "board");
    await page.getByTestId("daily-file").click();
    await expect(page.getByTestId("play-screen")).toBeVisible();
  });

  test("걷는 중에 빠르게 여러 번 눌러도 한 번만 들어간다", async ({ page }) => {
    await preset(page, "exam-ready");
    const home = page.getByTestId("home-screen");
    await expect(home).toHaveAttribute("data-at", "exam");
    const row = page.getByTestId("identity");
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
    await preset(page, "exam-ready");
    await expect(page.getByTestId("exam-cta")).toHaveAttribute("data-on", "true");
    await expect(page.getByTestId("exam-cta")).toContainText("응시 가능");
    await expect(page.getByTestId("home-screen")).toHaveAttribute("data-at", "exam");
    await page.getByTestId("exam-cta").click();
    await expect(page).toHaveURL(/#\/exam$/);
  });

  test("모션 줄이기 설정에서는 걷지 않고 곧바로 들어간다", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await preset(page, "daily-unsolved");
    await expect(page.locator('[data-testid="live-scene"] canvas')).toBeVisible();
    const started = Date.now();
    await page.getByTestId("practice-entry").click();
    await expect(page).toHaveURL(/#\/practice$/);
    expect(Date.now() - started).toBeLessThan(1500);
  });

  test("탐정이 걷는 중에 할 일이 바뀌어도, 새 할 일의 줄을 누르면 그곳으로 들어간다", async ({ page }) => {
    // 연습실로 걸어가는 중에(들어선 지 0.42초 뒤에 출발해 0.45~0.9초 걷는다) 할 일을 시험실로 바꾼다
    await preset(page, "daily-solved");
    await page.waitForTimeout(550);
    await page.getByTestId("demo-toggle").click();
    await page.getByTestId("demo-exam-ready").click();
    // 줄은 곧바로 시험실로 펼쳐지지만 탐정은 아직 연습실로 가는 중이다. 이때 눌러도 시험실로 가야 한다.
    await page.getByTestId("exam-cta").click();
    await expect(page).toHaveURL(/#\/exam$/);
  });

  test("걷어낸 홈의 주소(?home=old · ?home=a)로 열어도 지금의 홈이 열린다", async ({ page }) => {
    for (const old of ["old", "a"]) {
      await preset(page, "daily-unsolved", `&home=${old}`);
      await expect(page.getByTestId("home-screen")).toHaveAttribute("data-home", "b");
      await expect(page.locator('[data-testid="live-scene"][data-kind="side"] canvas')).toBeVisible();
    }
  });

  test("두 가지 색으로만 그려진다", async ({ page }) => {
    await preset(page, "exam-ready");
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

    test("홈: 펼쳐진 줄과 나머지 줄이 모두 화면 안에 있다", async ({ page }) => {
      await preset(page, "daily-unsolved");
      await expect(page.getByTestId("home-screen")).toHaveAttribute("data-at", "board");
      await expectLayoutOk(page, '[data-testid="daily-file-cta"]');
      for (const id of ["practice-entry", "exam-wait", "identity"]) {
        const box = (await page.getByTestId(id).boundingBox())!;
        expect(box.y + box.height, `${id} 가 화면 아래로 잘린다`).toBeLessThanOrEqual(size.height);
        expect(box.height, `${id} 의 터치 영역이 44px 보다 작다`).toBeGreaterThanOrEqual(44);
      }
    });
  });
}
