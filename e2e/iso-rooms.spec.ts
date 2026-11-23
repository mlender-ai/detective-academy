import { expect, test, type Page } from "@playwright/test";
import { getDailyPuzzle } from "../src/data/puzzles";
import { HOME_DEFAULT, TEST_DATE, expectLayoutOk, offToneRatio, preset } from "./helpers";
import { solve } from "./solve";

/**
 * 쿼터뷰 방들(자료실 · 연습실 · 시험실). 2026-11-23 에 사용자가 "나머지도 방으로"라고 해서 홈에 이어 방으로 바꿨다.
 * 다른 테스트들은 저장소의 값으로 예전 화면(?view=side)에서 돈다. 여기서는 그 값 없이 기본 화면으로 연다.
 */
test.use({ storageState: HOME_DEFAULT });

const SHOTS = "docs/compare/iso";
const hide = ".demo { visibility: hidden !important; }";

async function open(page: Page, id: Parameters<typeof preset>[1], hash: string) {
  await preset(page, id);
  await page.goto(`/?demo=1#/${hash}`);
}

test.describe("자료실(암호 풀이)", () => {
  test("방 안의 책상과 금고를 눌러 오가고, 풀면 금고가 열린다", async ({ page }) => {
    await open(page, "daily-unsolved", "daily");
    const play = page.getByTestId("play-screen");
    await expect(play).toHaveAttribute("data-view", "iso");
    await expect(play).toHaveAttribute("data-at", "desk");
    await expect(page.getByTestId("record")).toBeVisible();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SHOTS}/vault-iso-desk.png`, style: hide });
    // 방 안의 금고를 누르면 자물쇠가 뜬다
    await page.getByTestId("scene-safe").tap();
    await expect(play).toHaveAttribute("data-at", "safe");
    await expect(page.getByTestId("submit")).toBeVisible();
    expect(await offToneRatio(page)).toBeLessThan(0.0005);
    // 방 안의 책상을 누르면 기록으로 돌아온다
    await page.getByTestId("scene-desk").tap();
    await expect(play).toHaveAttribute("data-at", "desk");
    await expect(page.getByTestId("record")).toBeVisible();
    // 아래 단추로도 오간다(예전 화면과 같은 단추). 끝까지 풀면 보상이 들어온다.
    await solve(page, getDailyPuzzle(TEST_DATE));
    await expect(page.getByTestId("reward")).toContainText("+60");
  });

  for (const [w, h] of [
    [390, 664],
    [375, 629],
  ] as const) {
    test.describe(`${w}×${h}`, () => {
      test.use({ viewport: { width: w, height: h } });

      test("넘치지 않고 책상의 단추와 금고의 제출 단추가 화면 안에 있다", async ({ page }) => {
        await open(page, "daily-unsolved", "daily");
        const play = page.getByTestId("play-screen");
        await expect(play).toHaveAttribute("data-view", "iso");
        await expectLayoutOk(page, '[data-testid="to-safe"]');
        expect(await play.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
        for (const id of ["scene-desk", "scene-safe"]) {
          const box = (await page.getByTestId(id).boundingBox())!;
          expect(box.width, id).toBeGreaterThanOrEqual(44);
          expect(box.height, id).toBeGreaterThanOrEqual(44);
        }
        await page.getByTestId("scene-safe").tap();
        await expect(play).toHaveAttribute("data-at", "safe");
        await expectLayoutOk(page, '[data-testid="submit"]');
        expect(await play.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
        await page.screenshot({ path: `${SHOTS}/vault-iso-${w}x${h}.png`, style: hide });
      });
    });
  }
});

test.describe("연습실", () => {
  const room = (page: Page) => page.getByTestId("practice-room");

  test("서류함을 눌러 과제를 고르고, 잠긴 서류함은 열리지 않으며, 문으로 나간다", async ({ page }) => {
    await open(page, "promoted", "practice");
    await expect(room(page)).toHaveAttribute("data-view", "iso");
    // 들어서면 풀지 않은 과제가 남은 가장 낮은 등급의 서류함 앞에 선다
    await expect(room(page)).toHaveAttribute("data-at", "F");
    await expect(page.getByTestId("drawer-count")).toHaveText("해결 2/3");
    await expect(page.getByTestId("practice-total")).toContainText("해결 2/15");
    await page.screenshot({ path: `${SHOTS}/practice-iso.png`, style: hide });
    expect(await offToneRatio(page)).toBeLessThan(0.0005);
    // 잠긴 서류함
    await page.getByTestId("drawer-C").tap();
    await expect(room(page)).toHaveAttribute("data-at", "C");
    await expect(page.getByTestId("drawer-locked")).toContainText("C급 정식 탐정에 오르면");
    await expect(page.locator(".isotask")).toHaveCount(0);
    // 지금 등급의 서류함: 과제 셋. 하나를 누르면 풀이로 들어간다.
    await page.getByTestId("drawer-D").tap();
    await expect(room(page)).toHaveAttribute("data-at", "D");
    await expect(page.locator(".isotask")).toHaveCount(3);
    await page.locator(".isotask").first().tap();
    await expect(page).toHaveURL(/#\/practice\//);
    await expect(page.getByTestId("play-screen")).toBeVisible();
    // 돌아오면 그 서류함 앞이다
    await page.getByTestId("play-back").click();
    await expect(room(page)).toHaveAttribute("data-at", "D");
    // 문: 그 앞까지 가서, 아래 창의 단추로 홀로 나간다
    await page.getByTestId("practice-door").tap();
    await expect(room(page)).toHaveAttribute("data-at", "door");
    await page.getByTestId("practice-door-go").click();
    await expect(page.getByTestId("home-screen")).toHaveAttribute("data-home", "iso");
  });

  for (const [w, h] of [
    [390, 664],
    [375, 629],
  ] as const) {
    test.describe(`${w}×${h}`, () => {
      test.use({ viewport: { width: w, height: h } });

      test("넘치지 않고 서류함 다섯과 과제 셋이 화면 안에서 눌린다", async ({ page }) => {
        await open(page, "promoted", "practice");
        await expect(room(page)).toHaveAttribute("data-at", "F");
        expect(await room(page).evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
        const stage = (await page.getByTestId("iso-stage").boundingBox())!;
        for (const id of ["drawer-F", "drawer-D", "drawer-C", "drawer-B", "drawer-A", "practice-door"]) {
          const box = (await page.getByTestId(id).boundingBox())!;
          expect(box.width, id).toBeGreaterThanOrEqual(44);
          expect(box.height, id).toBeGreaterThanOrEqual(44);
          expect(box.y + box.height / 2, id).toBeGreaterThan(stage.y + 50);
          expect(box.y + box.height / 2, id).toBeLessThan(stage.y + stage.height);
        }
        await expectLayoutOk(page, ".isotask >> nth=2");
        await page.screenshot({ path: `${SHOTS}/practice-iso-${w}x${h}.png`, style: hide });
      });
    });
  }
});

test.describe("시험실", () => {
  test("봉투가 놓인 방이 보이고, 봉투를 열면 시험이 시작된다", async ({ page }) => {
    await open(page, "exam-ready", "exam");
    await expect(page.getByTestId("exam-gate")).toBeVisible();
    await expect(page.getByTestId("iso-stage")).toBeVisible();
    // 예전 화면의 큰 봉투 그림은 놓이지 않는다(봉투는 방 안의 책상 위에 있다)
    await expect(page.locator(".room__envelope")).toHaveCount(0);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/exam-iso-gate.png`, style: hide });
    expect(await offToneRatio(page)).toBeLessThan(0.0005);
    await page.getByTestId("open-envelope").click();
    await page.getByTestId("open-envelope").click({ timeout: 800 }).catch(() => undefined);
    await expect(page.getByTestId("play-screen")).toBeVisible();
  });

  test("조건을 채우지 못했으면 책상이 빈 방이고, 연습실로 보낸다", async ({ page }) => {
    await open(page, "daily-unsolved", "exam");
    await expect(page.getByTestId("exam-locked")).toBeVisible();
    await expect(page.getByTestId("iso-stage")).toBeVisible();
    await expect(page.getByTestId("exam-need")).toHaveText("0/3");
    await page.getByTestId("exam-to-practice").click();
    await expect(page.getByTestId("practice-room")).toHaveAttribute("data-view", "iso");
  });

  for (const [w, h] of [
    [390, 664],
    [375, 629],
  ] as const) {
    test.describe(`${w}×${h}`, () => {
      test.use({ viewport: { width: w, height: h } });

      test("가장 긴 응시 안내(S급)도 스크롤 없이 들어오고 단추가 화면 안에 있다", async ({ page }) => {
        await open(page, "ready-s", "exam");
        await expect(page.getByTestId("exam-gate")).toBeVisible();
        await expectLayoutOk(page, '[data-testid="open-envelope"]');
        expect(await page.locator(".room__scroll").evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
        const stage = (await page.getByTestId("iso-stage").boundingBox())!;
        expect(stage.height).toBeGreaterThanOrEqual(168);
        await page.screenshot({ path: `${SHOTS}/exam-iso-${w}x${h}.png`, style: hide });
      });
    });
  }
});

test.describe("모션 줄이기", () => {
  test.use({ reducedMotion: "reduce" });

  test("세 방 모두 걷지 않고 곧바로 서며, 조작은 그대로다", async ({ page }) => {
    await open(page, "promoted", "practice");
    await expect(page.getByTestId("practice-room")).toHaveAttribute("data-at", "F");
    await page.getByTestId("drawer-D").tap();
    await expect(page.getByTestId("practice-room")).toHaveAttribute("data-at", "D");
    const canvas = page.getByTestId("iso-canvas");
    const a = await canvas.screenshot();
    await page.waitForTimeout(600);
    expect((await canvas.screenshot()).equals(a)).toBe(true);
    await page.goto("/?demo=1#/exam");
    await expect(page.getByTestId("iso-stage")).toBeVisible();
    // 오늘의 추리를 아직 풀지 않은 상태에서 자료실로
    await open(page, "daily-unsolved", "daily");
    await page.getByTestId("scene-safe").tap();
    await expect(page.getByTestId("play-screen")).toHaveAttribute("data-at", "safe");
  });
});
