import { chromium, expect, test, type Page } from "@playwright/test";
import { enterFromHome, expectLayoutOk, preset, stored } from "./helpers";

/**
 * 배경 음악(OST). 기본은 꺼짐이고, 신분증 화면에서 켜면 화면에 맞는 곡이 흐른다.
 * 소리 자체는 자동 테스트로 들을 수 없다: 여기서는 어느 곡이 흐르는지(<html data-music>), 언제 음원을 내려받는지, 설정이 저장되는지를 본다.
 */

const flowing = (page: Page) => page.locator("html");

/** 음원(.m4a) 요청을 모은다 */
function audioRequests(page: Page) {
  const list: string[] = [];
  page.on("request", (r) => {
    const name = new URL(r.url()).pathname.split("/").pop() ?? "";
    // 빌드본의 파일 이름에는 해시가 붙는다(academy-theme-AbCd1234.m4a): 곡 이름만 남긴다
    const track = ["academy-theme", "midnight-corridor", "deduction", "countdown"].find((t) => name.startsWith(t));
    if (/\.m4a$/.test(name) && r.resourceType() !== "script") list.push(`${track ?? name}.m4a`);
  });
  return list;
}

async function musicOn(page: Page, id: Parameters<typeof preset>[1] = "promoted") {
  await preset(page, id);
  await page.goto("/?demo=1#/profile");
  await page.getByTestId("music-toggle").click();
  await expect(page.getByTestId("music-toggle")).toHaveAttribute("aria-checked", "true");
}

test("음악은 기본이 꺼짐이다: 음원을 내려받지 않고, 아무 곡도 흐르지 않는다", async ({ page }) => {
  const requests = audioRequests(page);
  await preset(page, "daily-unsolved");
  await enterFromHome(page, "daily-file");
  await expect(page.getByTestId("play-screen")).toBeVisible();
  await page.goBack();
  await page.goto("/?demo=1#/profile");
  await expect(page.getByTestId("music-toggle")).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId("music-volume")).toBeDisabled();
  expect(requests).toEqual([]);
  expect(await flowing(page).getAttribute("data-music")).toBeFalsy();
});

test("신분증에서 음악을 켜면 테마가 흐르고, 화면을 따라 곡이 바뀐다", async ({ page }) => {
  const requests = audioRequests(page);
  await musicOn(page);
  await expect(flowing(page)).toHaveAttribute("data-music", "theme");
  expect(requests).toEqual(["academy-theme.m4a"]); // 지금 흐르는 곡만 받는다
  await page.getByTestId("story-back").or(page.getByTestId("profile-back")).or(page.locator(".deskbar .tilebtn")).first().click();
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(flowing(page)).toHaveAttribute("data-music", "corridor");
  await enterFromHome(page, "practice-entry");
  await expect(page).toHaveURL(/#\/practice$/);
  await expect(flowing(page)).toHaveAttribute("data-music", "theme");
  await page.locator('[data-testid^="practice-file-"]').first().click();
  await expect(flowing(page)).toHaveAttribute("data-music", "deduction");
  expect(requests).toContain("deduction.m4a");
  // 끄면 멈춘다
  await page.goto("/?demo=1#/profile");
  await page.getByTestId("music-toggle").click();
  await expect(flowing(page)).toHaveAttribute("data-music", "");
  expect((await stored(page)).settings.music).toBe(false);
});

test("제한 시간이 있는 시험: 봉투 앞에서는 테마, 시험지를 펼치면 카운트다운", async ({ page }) => {
  await musicOn(page, "ready-b");
  await page.goto("/?demo=1#/exam");
  await expect(page.getByTestId("exam-gate")).toBeVisible();
  await page.getByTestId("open-envelope").click(); // 사용자의 조작: 음악이 깨어난다
  await page.getByTestId("open-envelope").click({ timeout: 800 }).catch(() => undefined);
  await expect(page.getByTestId("countdown")).toBeVisible();
  await expect(flowing(page)).toHaveAttribute("data-music", "countdown");
});

test("새로고침 뒤에는 첫 조작에서 다시 흐른다(브라우저의 자동 재생 정책)", async ({ page }) => {
  await musicOn(page);
  await expect(flowing(page)).toHaveAttribute("data-music", "theme");
  await page.reload();
  await expect(page.getByTestId("music-toggle")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("profile-screen").click({ position: { x: 20, y: 120 } });
  await expect(flowing(page)).toHaveAttribute("data-music", "theme");
});

test("터치 한 번으로 깨어난다: 자동 재생을 막는 브라우저에서, 음악을 켜 둔 채 새로 열고 화면을 한 번 두드리면 흐른다", async ({ page, baseURL }, testInfo) => {
  // 모바일 브라우저는 사용자의 조작 뒤에만 소리를 낸다. 터치에서는 손가락이 닿는 순간(pointerdown · touchstart)이 아니라
  // 떼는 순간(pointerup · touchend)과 그 뒤의 click 이 조작으로 인정된다: 닿는 순간만 들으면 첫 두드림에 깨어나지 않는다.
  await musicOn(page);
  await expect(flowing(page)).toHaveAttribute("data-music", "theme");
  const saved = await page.context().storageState();

  // 자동 재생 정책을 켠 브라우저를 따로 띄운다. 저장 상태만 물려받고, 새 문서는 아직 어떤 조작도 받지 않았다.
  const browser = await chromium.launch({ args: ["--autoplay-policy=document-user-activation-required"] });
  try {
    const { viewport, deviceScaleFactor, hasTouch, isMobile, locale, timezoneId } = testInfo.project.use;
    const context = await browser.newContext({ baseURL, viewport, deviceScaleFactor, hasTouch, isMobile, locale, timezoneId, storageState: saved });
    const phone = await context.newPage();
    const requests = audioRequests(phone);
    // 두드리기 전에는 이 페이지에서 아무것도 읽지 않는다: Playwright 가 페이지 안에서 무언가를 평가하면(locator 확인도 그렇다)
    // 그것이 사용자의 조작으로 쳐져서, 손가락이 닿는 순간에 이미 소리가 깨어난다. 그러면 이 테스트는 아무것도 가려내지 못한다.
    await phone.goto("/?demo=1#/profile");
    await phone.waitForLoadState("networkidle");
    await phone.waitForTimeout(500);
    // 음원은 소리가 깨어난 뒤에만 내려받는다: 아직 받지 않았으면 조작 전에는 흐르지 않은 것이다
    expect(requests, "조작 전인데 음원을 받았다(자동 재생 정책이 걸리지 않았다)").toEqual([]);
    // 아무것도 없는 자리(화면 왼쪽 끝의 여백)를 손가락으로 한 번 두드린다
    await phone.touchscreen.tap(5, 300);
    await expect(flowing(phone)).toHaveAttribute("data-music", "theme");
    expect(requests).toEqual(["academy-theme.m4a"]);
    // 두드림이 다른 것을 누르지 않았다: 설정도 화면도 그대로다
    await expect(phone.getByTestId("music-toggle")).toHaveAttribute("aria-checked", "true");
    expect((await stored(phone)).settings.music).toBe(true);
  } finally {
    await browser.close();
  }
});

test("음량은 효과음과 음악이 따로다: 꺼져 있으면 누를 수 없고, 누르면 한 칸씩 올라 끝에서 처음으로 돌아온다", async ({ page }) => {
  await preset(page, "promoted");
  await page.goto("/?demo=1#/profile");
  await expect(page.getByTestId("sound-volume")).toBeDisabled();
  await expect(page.getByTestId("music-volume")).toBeDisabled();
  await page.getByTestId("music-toggle").click();
  const volume = page.getByTestId("music-volume");
  await expect(volume).toBeEnabled();
  await expect(volume).toHaveAttribute("data-level", "2");
  await volume.click();
  await volume.click();
  await expect(volume).toHaveAttribute("data-level", "4");
  await volume.click();
  await expect(volume).toHaveAttribute("data-level", "1");
  // 효과음의 음량은 그대로다
  await expect(page.getByTestId("sound-volume")).toHaveAttribute("data-level", "4");
  await page.reload();
  await expect(page.getByTestId("music-volume")).toHaveAttribute("data-level", "1");
  expect((await stored(page)).settings).toMatchObject({ sound: false, music: true, soundVolume: 4, musicVolume: 1 });
});

for (const size of [
  { width: 390, height: 664 },
  { width: 375, height: 629 },
]) {
  test(`${size.width}×${size.height}: 소리 설정의 두 줄이 화면 폭 안에 있고 눌린다`, async ({ page }) => {
    await page.setViewportSize(size);
    await preset(page, "promoted");
    await page.goto("/?demo=1#/profile");
    await page.getByTestId("music-toggle").scrollIntoViewIfNeeded();
    await expectLayoutOk(page, '[data-testid="music-toggle"]');
    for (const id of ["sound-toggle", "music-toggle", "sound-volume", "music-volume"]) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.height, `${id} 의 터치 영역이 낮다`).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    }
  });
}
