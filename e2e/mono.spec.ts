import { expect, test } from "@playwright/test";
import { expectLayoutOk, offToneRatio, placeByTap, preset, setCode, shot, stored } from "./helpers";

/**
 * 1비트 흑백 도트로 그렸는지 확인한다: 비트맵 글꼴, 스프라이트, 점으로 찍는 표시, 두 가지 색, 자막 화면.
 * 문제·판정·보상의 흐름은 flow.spec.ts 가 따로 확인한다.
 */

test("공고를 펼쳐 암호를 풀고 채점 결과까지 간다", async ({ page }) => {
  await preset(page, "daily-unsolved");
  await expect(page.getByTestId("home-screen")).toBeVisible();
  // 비트맵 글꼴과 점 그림이 실제로 쓰였는가
  expect(await page.getByTestId("daily-file-cta").evaluate((el) => getComputedStyle(el).fontFamily)).toContain("NeoDGM");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  expect(await page.evaluate(() => document.fonts.check('16px "NeoDGM"') && document.fonts.check('12px "Galmuri11"'))).toBe(true);
  // 장면 아래의 서술 한 줄
  await expect(page.getByTestId("narration")).toContainText("오늘의 사건");
  await expect(page.locator(".hall__sign .sprite")).toBeVisible();
  await expect(page.getByTestId("daily-file-status")).toHaveText("미해결");
  await shot(page, "mono-01-home");

  await page.getByTestId("daily-file").click();
  await expect(page.getByTestId("play-screen")).toBeVisible();
  await expect(page.getByTestId("dial-0")).toBeVisible();

  // 오답: 정답은 드러나지 않는다
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("notice-wrong")).toBeVisible();
  await expect(page.getByTestId("solution")).toHaveCount(0);

  // 메모는 시도 기록에 점 표시로 반영된다
  await page.getByTestId("memo-5").click();
  await expect(page.locator('.clue__digit[data-memo="out"]')).toHaveCount(3);
  await expect(page.locator('.clue__digit[data-memo="out"] .pxmark svg').first()).toBeVisible();

  // 릴을 밀어서 1 → 4
  const dial = (await page.getByTestId("dial-0").boundingBox())!;
  await page.mouse.move(dial.x + dial.width / 2, dial.y + dial.height / 2);
  await page.mouse.down();
  await page.mouse.move(dial.x + dial.width / 2, dial.y + dial.height / 2 - 150, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId("dial-0")).toHaveAttribute("aria-valuenow", "4");

  await setCode(page, [4, 2, 6]);
  await shot(page, "mono-02-code");

  await page.getByTestId("submit").click();
  await expect(page.getByTestId("result-screen")).toBeVisible();
  await expect(page.getByTestId("result-lead")).toContainText("추론이 정확했습니다");
  await expect(page.getByTestId("reward")).toContainText("+100");
  await expect(page.getByTestId("no-hint")).toBeVisible();
  await expect(page.getByTestId("solution")).toBeVisible();
  expect((await stored(page)).credits).toBe(140);
  await expect(page.locator(".pxcaret")).toHaveCount(0); // 문구 출력이 끝났다
  await shot(page, "mono-03-result");

  await expect(page.getByTestId("result-next")).toHaveText("연습실로 이동");
  await page.getByTestId("result-home").click();
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(page.getByTestId("daily-file-status")).toHaveText("해결");
  await expect(page.getByTestId("credit-balance")).toHaveText("140");
});

for (const viewport of [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 390, height: 664 },
]) {
  const tag = `${viewport.width}x${viewport.height}`;

  test.describe(`화면 크기 ${tag}`, () => {
    test.use({ viewport });

    test("홈과 암호 해독이 한 화면에 들어온다", async ({ page }) => {
      await preset(page, "daily-unsolved");
      await expect(page.getByTestId("home-screen")).toBeVisible();
      await expectLayoutOk(page, '[data-testid="daily-file-cta"]');
      expect(await page.getByTestId("home-screen").evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
      const tile = (await page.getByTestId("practice-entry").boundingBox())!;
      expect(tile.y + tile.height).toBeLessThanOrEqual(viewport.height);
      await shot(page, `mono-viewport-${tag}-home`);

      await page.getByTestId("daily-file").click();
      await expect(page.getByTestId("dial-0")).toBeVisible();
      await expectLayoutOk(page, '[data-testid="submit"]');
      const submitTop = (await page.getByTestId("submit").boundingBox())!.y;
      const clues = (await page.locator(".clues").boundingBox())!;
      const dials = (await page.locator(".lock__dials").boundingBox())!;
      expect(clues.y).toBeGreaterThanOrEqual(0);
      expect(dials.y + dials.height).toBeLessThanOrEqual(submitTop);
      expect(await page.locator(".play__scroll").evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
      await shot(page, `mono-viewport-${tag}-code`);

      // 숫자가 겹쳐 경고가 떠도 화살표 단추는 그대로 눌린다
      await page.getByTestId("dial-1-next").click();
      await expect(page.locator(".lock__status")).toContainText("겹쳐");
      for (const index of [0, 1, 2]) {
        const before = await page.getByTestId(`dial-${index}`).getAttribute("aria-valuenow");
        await page.getByTestId(`dial-${index}-next`).click();
        await expect(page.getByTestId(`dial-${index}`)).not.toHaveAttribute("aria-valuenow", before!);
      }
    });
  });
}

test("입학해서 진술 추리와 승급 시험을 풀고 신분증까지 확인한다", async ({ page }) => {
  /* 입학 */
  await preset(page, "first-run");
  await expect(page.getByTestId("admission-screen")).toBeVisible();
  await expect(page.locator(".idcard .portrait.sprite")).toBeVisible();
  await page.getByTestId("nickname-input").fill("도트 탐정");
  await page.getByTestId("enroll").click();
  await expect(page.getByTestId("admission-grant")).toContainText("40");
  await expect(page.getByTestId("id-rank")).toHaveText("F급 견습 탐정");
  await shot(page, "mono-11-admission-issued");
  await page.getByTestId("enter-academy").click();
  await expect(page.getByTestId("home-screen")).toBeVisible();

  /* 연습실 → 진술 추리 */
  await preset(page, "daily-solved");
  await page.getByTestId("practice-entry").click();
  await expect(page.getByTestId("practice-room")).toBeVisible();
  await shot(page, "mono-12-practice");
  await page.getByTestId("practice-file-cta").click();
  await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", "truth");
  await expect(page.locator(".suspect .portrait.sprite")).toHaveCount(4);

  await page.getByTestId("suspect-hana").click();
  await page.getByTestId("memo-junho-true").click();
  await page.getByTestId("memo-hana-false").click();
  await expect(page.getByTestId("suspect-hana")).toContainText("참 1 · 거짓 1");
  // 참은 동그라미, 거짓은 가위표를 점으로 찍는다
  await expect(page.getByTestId("memo-junho-true").locator('.pxmark[data-kind="circle"] svg')).toBeVisible();
  await expect(page.getByTestId("memo-hana-false").locator('.pxmark[data-kind="cross"] svg')).toBeVisible();
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("notice-wrong")).toBeVisible();
  await shot(page, "mono-13-truth");

  await page.getByTestId("suspect-sera").click();
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("result-screen")).toBeVisible();
  await expect(page.getByTestId("solution")).toContainText("세라");
  await expect(page.getByTestId("reward")).toContainText("+60");
  await shot(page, "mono-14-truth-result");

  /* 승급 시험 */
  await page.getByTestId("result-next").click();
  await expect(page.getByTestId("exam-gate")).toBeVisible();
  await expect(page.locator(".envelope .sprite")).toHaveCount(4);
  await shot(page, "mono-15-exam-gate");
  await page.getByTestId("open-envelope").click();
  await expect(page.getByTestId("play-screen")).toHaveAttribute("data-variant", "exam");
  await placeByTap(page, "doyun", 0);
  await placeByTap(page, "minjae", 1);
  await placeByTap(page, "sea", 2);
  await placeByTap(page, "harin", 3);
  await shot(page, "mono-16-schedule");
  await page.getByTestId("submit").click();

  /* 승급 */
  await expect(page.getByTestId("ceremony")).toBeVisible();
  await expect(page.getByTestId("ceremony-title")).toHaveText("D급 초급 탐정");
  await expect(page.getByTestId("ceremony")).toHaveAttribute("data-done", "true", { timeout: 10_000 });
  await expect(page.getByTestId("id-rank")).toHaveText("D급 초급 탐정");
  await expect(page.getByTestId("reward")).toContainText("+150");
  await shot(page, "mono-17-ceremony");
  expect((await stored(page)).rank).toBe("D");

  /* 신분증 */
  await page.getByTestId("ceremony-card").click();
  await expect(page.getByTestId("profile-screen")).toBeVisible();
  await expect(page.getByTestId("record-exam")).toContainText("제출 1회");
  await expect(page.getByTestId("rank-note")).toContainText("현재 D급 초급 탐정");
  expect(await page.getByTestId("rank-note").evaluate((el) => getComputedStyle(el).fontFamily)).toContain("NeoDGM");
  await shot(page, "mono-18-profile");
});

for (const viewport of [
  { width: 375, height: 812 },
  { width: 390, height: 664 },
]) {
  const tag = `${viewport.width}x${viewport.height}`;

  test.describe(`나머지 화면 ${tag}`, () => {
    test.use({ viewport });

    test("입학, 진술 추리, 승급 시험, 신분증의 주 단추가 화면 안에 있다", async ({ page }) => {
      await preset(page, "first-run");
      await expect(page.getByTestId("admission-screen")).toBeVisible();
      await expectLayoutOk(page, '[data-testid="enroll"]');

      await preset(page, "daily-solved");
      await page.getByTestId("practice-entry").click();
      await expectLayoutOk(page, '[data-testid="practice-file-cta"]');
      await page.getByTestId("practice-file-cta").click();
      await page.getByTestId("suspect-junho").click();
      await expectLayoutOk(page, '[data-testid="submit"]');
      for (const button of await page.locator(".statement__memo button").all()) {
        const box = (await button.boundingBox())!;
        expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
      }

      await preset(page, "exam-ready");
      await page.getByTestId("exam-cta").click();
      await expectLayoutOk(page, '[data-testid="open-envelope"]');
      await page.getByTestId("open-envelope").click();
      await placeByTap(page, "doyun", 0);
      await expectLayoutOk(page, '[data-testid="submit"]');
      const submitTop = (await page.getByTestId("submit").boundingBox())!.y;
      const tray = (await page.locator(".board__tray").boundingBox())!;
      expect(tray.y + tray.height).toBeLessThanOrEqual(submitTop);

      await preset(page, "promoted");
      await page.getByTestId("identity").click();
      await expectLayoutOk(page, '[data-testid="rename"]');
    });
  });
}

test("?save= 로 연 화면은 별도 저장 칸을 써서 다른 화면의 진행을 건드리지 않는다", async ({ page }) => {
  await preset(page, "daily-unsolved");
  const before = await page.evaluate(() => window.localStorage.getItem("detective-academy:v1"));

  await preset(page, "promoted", "&save=b");
  await expect(page.getByTestId("home-rank")).toHaveText("D급 초급 탐정");
  const slots = await page.evaluate(() => ({
    main: window.localStorage.getItem("detective-academy:v1"),
    b: window.localStorage.getItem("detective-academy:v1:b"),
  }));
  expect(slots.main).toBe(before);
  expect(JSON.parse(slots.b!).rank).toBe("D");
});


test("모든 화면이 검정과 흰색 두 가지로만 그려진다", async ({ page }) => {
  const check = async (name: string) => {
    await page.waitForTimeout(500); // 화면 전환이 끝난 뒤에 찍는다
    expect(await offToneRatio(page), `${name}: 두 색이 아닌 화소가 너무 많다`).toBeLessThan(0.005);
  };

  await preset(page, "first-run");
  await expect(page.getByTestId("admission-screen")).toBeVisible();
  await check("입학");

  await preset(page, "daily-unsolved");
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await check("홈");
  await page.getByTestId("daily-file").click();
  await expect(page.getByTestId("dial-0")).toBeVisible();
  await check("암호 풀이");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("notice-wrong")).toBeVisible();
  await check("오답 쪽지");
  await page.getByTestId("hint-button").click();
  await expect(page.getByTestId("hint-drawer")).toBeVisible();
  await check("수사 지원 서랍");

  await preset(page, "daily-solved");
  await page.getByTestId("practice-entry").click();
  await expect(page.getByTestId("practice-room")).toBeVisible();
  await check("연습실");
  await page.getByTestId("practice-file-cta").click();
  await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", "truth");
  await page.getByTestId("suspect-hana").click();
  await page.getByTestId("memo-junho-true").click();
  await check("진술 추리");

  await preset(page, "exam-ready");
  await page.getByTestId("exam-cta").click();
  await expect(page.getByTestId("exam-gate")).toBeVisible();
  await check("시험실");
  await page.getByTestId("open-envelope").click();
  await expect(page.getByTestId("play-screen")).toHaveAttribute("data-variant", "exam");
  await placeByTap(page, "doyun", 0);
  await check("승급 시험 풀이");

  await preset(page, "promoted");
  await page.getByTestId("identity").click();
  await expect(page.getByTestId("profile-screen")).toBeVisible();
  await check("신분증");
  await page.goto("/?demo=1#/daily");
  await expect(page.getByTestId("result-screen")).toBeVisible();
  await check("채점 기록");
});

test.describe("자막 화면", () => {
  // 다른 테스트에서는 꺼 둔 자막 화면을 여기서만 켠다 (저장소의 끔 표시를 비운다)
  test.use({ storageState: { cookies: [], origins: [] } });

  test("사건을 열면 제목이 찍힌 검은 화면이 뜨고, 누르면 바로 걷힌다", async ({ page }) => {
    await preset(page, "daily-unsolved");
    await page.getByTestId("daily-file").click();
    const card = page.getByTestId("cine-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText("사건 기록");
    await card.click();
    await expect(card).toHaveCount(0);
    // 걷힌 뒤에는 바로 조작된다
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("notice-wrong")).toBeVisible();
  });

  test("누르지 않아도 제목이 다 찍히면 스스로 걷힌다", async ({ page }) => {
    await preset(page, "daily-unsolved");
    await page.getByTestId("daily-file").click();
    const card = page.getByTestId("cine-card");
    await expect(card).toContainText("자료실 금고의 암호");
    await expect(card).toHaveCount(0, { timeout: 6_000 });
    await expect(page.getByTestId("dial-0")).toBeVisible();
  });

  test.describe("모션 줄이기 설정", () => {
    test.use({ reducedMotion: "reduce" });

    test("자막 화면이 뜨지 않고 서술은 한 번에 나온다", async ({ page }) => {
      await preset(page, "daily-unsolved");
      await expect(page.locator(".narr__line")).toContainText("붙어 있다.");
      await page.getByTestId("daily-file").click();
      await expect(page.getByTestId("dial-0")).toBeVisible();
      await expect(page.getByTestId("cine-card")).toHaveCount(0);
    });
  });
});
