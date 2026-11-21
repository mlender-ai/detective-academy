import { expect, test } from "@playwright/test";
import { expectLayoutOk, placeByTap, preset, shot } from "./helpers";

/** 지시서가 정한 최소 확인 화면 크기 */
const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

for (const viewport of VIEWPORTS) {
  const tag = `${viewport.width}x${viewport.height}`;

  test.describe(`화면 크기 ${tag}`, () => {
    test.use({ viewport });

    test("입학 화면", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByTestId("admission-screen")).toBeVisible();
      await expectLayoutOk(page, '[data-testid="enroll"]');
      await shot(page, `viewport-${tag}-admission`);
    });

    test("홈 화면: 오늘의 문제와 주 버튼이 첫 화면에 보인다", async ({ page }) => {
      await preset(page, "daily-unsolved");
      await expect(page.getByTestId("home-screen")).toBeVisible();
      await expectLayoutOk(page, '[data-testid="daily-file-cta"]');
      await shot(page, `viewport-${tag}-home`);
    });

    test("암호 해독: 시도 기록과 다이얼, 제출 버튼이 한 화면에 들어온다", async ({ page }) => {
      await preset(page, "daily-unsolved");
      await page.getByTestId("daily-file").click();
      await expect(page.getByTestId("dial-0")).toBeVisible();
      await expectLayoutOk(page, '[data-testid="submit"]');

      // 스크롤하지 않은 상태에서 시도 기록 전체와 다이얼이 제출 버튼 위에 다 보여야 한다.
      const submitTop = (await page.getByTestId("submit").boundingBox())!.y;
      const clues = (await page.locator(".clues").boundingBox())!;
      const dials = (await page.locator(".lock__dials").boundingBox())!;
      expect(clues.y).toBeGreaterThanOrEqual(0);
      expect(dials.y + dials.height).toBeLessThanOrEqual(submitTop);
      for (const button of await page.locator(".dial__step").all()) {
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
      await shot(page, `viewport-${tag}-code`);
    });

    test("거짓 진술 찾기: 진술 네 장과 제출 버튼이 한 화면에 들어온다", async ({ page }) => {
      await preset(page, "daily-solved");
      await page.getByTestId("practice-entry").click();
      await page.getByTestId("practice-file-cta").click();
      await expect(page.getByTestId("statement-daon")).toBeVisible();
      await page.getByTestId("suspect-junho").click();
      await expectLayoutOk(page, '[data-testid="submit"]');

      const submitTop = (await page.getByTestId("submit").boundingBox())!.y;
      const last = (await page.getByTestId("statement-daon").boundingBox())!;
      expect(last.y + last.height).toBeLessThanOrEqual(submitTop);
      for (const button of await page.locator(".statement__memo button").all()) {
        const box = (await button.boundingBox())!;
        expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
      }
      await shot(page, `viewport-${tag}-truth`);
    });

    test("승급 시험: 조건, 시간표, 대기 카드와 제출 버튼이 한 화면에 들어온다", async ({ page }) => {
      await preset(page, "exam-ready");
      await page.getByTestId("exam-cta").click();
      await expect(page.getByTestId("exam-gate")).toBeVisible();
      await expectLayoutOk(page, '[data-testid="open-envelope"]');
      await shot(page, `viewport-${tag}-exam-gate`);

      await page.getByTestId("open-envelope").click();
      await expect(page.getByTestId("card-harin")).toBeVisible();
      await placeByTap(page, "doyun", 0);
      await expectLayoutOk(page, '[data-testid="submit"]');

      const submitTop = (await page.getByTestId("submit").boundingBox())!.y;
      const tray = (await page.locator(".board__tray").boundingBox())!;
      expect(tray.y + tray.height).toBeLessThanOrEqual(submitTop);

      // 카드는 슬롯 안에 정확히 들어가고 서로 겹치지 않는다
      const slot = (await page.getByTestId("slot-0").boundingBox())!;
      const card = (await page.getByTestId("card-doyun").boundingBox())!;
      expect(Math.abs(card.x - slot.x)).toBeLessThan(2);
      expect(Math.abs(card.y - slot.y)).toBeLessThan(2);
      expect(card.width).toBeGreaterThanOrEqual(64);
      await shot(page, `viewport-${tag}-schedule`);
    });

    test("결과와 신분증 화면", async ({ page }) => {
      await preset(page, "promoted");
      await page.getByTestId("daily-file").click();
      await expect(page.getByTestId("result-screen")).toBeVisible();
      await expectLayoutOk(page, '[data-testid="result-home"]');
      await shot(page, `viewport-${tag}-record`);

      await page.goto("/?demo=1#/profile");
      await expect(page.getByTestId("profile-screen")).toBeVisible();
      await expectLayoutOk(page, '[data-testid="rename"]');
      await shot(page, `viewport-${tag}-profile`);
    });
  });
}

/**
 * 주소창과 도구 막대가 보이는 모바일 브라우저에서는 화면 높이가 664px 안팎으로 줄어든다.
 * 그 높이에서도 오늘의 공고와 선반, 그리고 시험지·자물쇠·제출 단추가 스크롤 없이 한 화면에 들어와야 한다.
 */
test.describe("낮은 화면 390x664 (주소창이 보이는 모바일 브라우저)", () => {
  test.use({ viewport: { width: 390, height: 664 } });

  test("홈: 복도, 서술, 갈 곳 네 줄이 한 화면에 보인다", async ({ page }) => {
    await preset(page, "daily-unsolved");
    await expect(page.getByTestId("home-screen")).toBeVisible();
    await expectLayoutOk(page, '[data-testid="daily-file-cta"]');

    const home = page.getByTestId("home-screen");
    expect(await home.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    // 복도 장면이 게시판과 문 위의 표찰까지 보일 만큼 남는다 (232px = 116점)
    const scene = (await page.getByTestId("live-scene").boundingBox())!;
    expect(scene.height).toBeGreaterThanOrEqual(232);
    // 맨 아래 줄(기록 보관함)까지 화면 안에 있다
    const last = (await page.getByTestId("identity").boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(664);
    await shot(page, "viewport-390x664-home");
  });

  test("암호 해독: 시도 기록을 읽으면서 드럼을 굴릴 수 있다", async ({ page }) => {
    await preset(page, "daily-unsolved");
    await page.getByTestId("daily-file").click();
    await expect(page.getByTestId("dial-0")).toBeVisible();
    await expectLayoutOk(page, '[data-testid="submit"]');

    const submitTop = (await page.getByTestId("submit").boundingBox())!.y;
    const clues = (await page.locator(".clues").boundingBox())!;
    const dials = (await page.locator(".lock__dials").boundingBox())!;
    expect(clues.y).toBeGreaterThanOrEqual(0);
    expect(dials.y + dials.height).toBeLessThanOrEqual(submitTop);
    expect(await page.locator(".play__scroll").evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    for (const chip of await page.locator(".memo__chip").all()) {
      expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    }
    await shot(page, "viewport-390x664-code");

    // 숫자가 겹쳐 경고가 떠도 화살표 단추는 가려지지 않고 그대로 눌린다
    await page.getByTestId("dial-1-next").click();
    await expect(page.getByTestId("dial-1")).toHaveAttribute("aria-valuenow", "3");
    await expect(page.locator(".lock__status")).toContainText("겹쳐");
    for (const index of [0, 1, 2]) {
      const before = await page.getByTestId(`dial-${index}`).getAttribute("aria-valuenow");
      await page.getByTestId(`dial-${index}-next`).click();
      await expect(page.getByTestId(`dial-${index}`)).not.toHaveAttribute("aria-valuenow", before!);
    }
  });

  test("입학, 진술 추리, 승급 시험, 신분증의 주 단추가 화면 안에 있다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("admission-screen")).toBeVisible();
    await expectLayoutOk(page, '[data-testid="enroll"]');

    await preset(page, "daily-solved");
    await page.getByTestId("practice-entry").click();
    await expectLayoutOk(page, '[data-testid="practice-file-cta"]');
    await page.getByTestId("practice-file-cta").click();
    await page.getByTestId("suspect-junho").click();
    await expectLayoutOk(page, '[data-testid="submit"]');

    await preset(page, "exam-ready");
    await page.getByTestId("exam-cta").click();
    await expectLayoutOk(page, '[data-testid="open-envelope"]');
    await shot(page, "viewport-390x664-exam-gate");
    await page.getByTestId("open-envelope").click();
    await placeByTap(page, "doyun", 0);
    await expectLayoutOk(page, '[data-testid="submit"]');
    const submitTop = (await page.getByTestId("submit").boundingBox())!.y;
    const tray = (await page.locator(".board__tray").boundingBox())!;
    expect(tray.y + tray.height).toBeLessThanOrEqual(submitTop);
    await shot(page, "viewport-390x664-schedule");

    await preset(page, "promoted");
    await page.getByTestId("identity").click();
    await expectLayoutOk(page, '[data-testid="rename"]');
  });
});
