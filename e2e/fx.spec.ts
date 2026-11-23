import { expect, test, type Locator, type Page } from "@playwright/test";
import { getDailyPuzzle } from "../src/data/puzzles";
import { TEST_DATE, enterFromHome, gameNowMs, offToneRatio, preset, stored } from "./helpers";
import { patchState, solve } from "./solve";

/**
 * 보상·시간 애니메이션 실험(?fx=ascii). ASCII Magic 의 조각을 1비트 점으로 고쳐 옮긴 것(src/fx/ascii)이
 * 켰을 때만 화면에 놓이고(채점 결과의 주화, 시험 시간 칸의 모래시계), 켜도 두 색 규칙과 조작·보상이 그대로인지 본다.
 * 기본(끔)의 화면은 다른 테스트들이 그대로 본다. 복도의 비와 촛불은 예전 홈(옆에서 본 복도)과 함께 걷어냈다.
 */

const SHOTS = "docs/compare/ascii";

/** 캔버스에 흰 점이 몇 개 찍혔는가 */
const litDots = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 3] > 0) n++;
    return n;
  });

/** 캔버스의 한 점(점 좌표)이 흰 점인가 */
const dotLit = (canvas: Locator, x: number, y: number) =>
  canvas.evaluate(
    (el, [px, py]) => {
      const d = (el as HTMLCanvasElement).getContext("2d")!.getImageData(px, py, 1, 1).data;
      return d[0] > 200 && d[3] > 0;
    },
    [x, y] as const,
  );

/**
 * 화면에 실제로 찍힌 색: 화면의 점(CSS px) 여럿이 각각 흰색인가. 깜빡이는 것을 견줄 수 있게 한 장으로 찍어 읽는다.
 */
async function shownWhite(page: Page, points: { x: number; y: number }[]) {
  const x0 = Math.min(...points.map((p) => p.x));
  const y0 = Math.min(...points.map((p) => p.y));
  const clip = { x: x0, y: y0, width: Math.max(...points.map((p) => p.x)) - x0 + 1, height: Math.max(...points.map((p) => p.y)) - y0 + 1 };
  const png = await page.screenshot({ clip });
  return page.evaluate(
    async ([base64, at, w]) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      const k = image.naturalWidth / w;
      return at.map(([x, y]) => ctx.getImageData(Math.floor(x * k), Math.floor(y * k), 1, 1).data[0] > 200);
    },
    [png.toString("base64"), points.map((p) => [p.x - x0, p.y - y0] as const), clip.width] as const,
  );
}

/** 2px 격자 위에 놓였는가(반 화소에 걸리면 회색이 생긴다) */
async function expectOnGrid(target: Locator) {
  const box = (await target.boundingBox())!;
  expect(box.x % 2, `x=${box.x}`).toBe(0);
  expect(box.y % 2, `y=${box.y}`).toBe(0);
}

async function toExam(page: Page, query: string) {
  await preset(page, "ready-b", query);
  await enterFromHome(page, "exam-cta");
  await expect(page.getByTestId("exam-gate")).toBeVisible();
  await page.getByTestId("open-envelope").click();
  await page.getByTestId("open-envelope").click({ timeout: 800 }).catch(() => undefined);
  await expect(page.getByTestId("countdown")).toBeVisible();
}

test("기본값은 꺼져 있다: 효과의 캔버스가 어디에도 놓이지 않는다", async ({ page }) => {
  await preset(page, "daily-unsolved");
  await enterFromHome(page, "daily-file");
  await solve(page, getDailyPuzzle(TEST_DATE)!);
  await expect(page.getByTestId("reward")).toBeVisible();
  await expect(page.locator(".fxcanvas")).toHaveCount(0);
  await expect(page.getByTestId("reward")).not.toHaveAttribute("data-fx", /.*/);
  await toExam(page, "");
  await expect(page.locator(".fxcanvas")).toHaveCount(0);
  await expect(page.getByTestId("countdown")).not.toHaveAttribute("data-glass", /.*/);
});

test.describe("?fx=ascii", () => {
  test("홈: 효과를 켜도 학원 홀은 그대로다(두 색이고, 효과의 캔버스가 놓이지 않고, 들어가는 것도 그대로다)", async ({ page }) => {
    await preset(page, "promoted", "&fx=ascii");
    const home = page.getByTestId("home-screen");
    await expect(home).toHaveAttribute("data-home", "iso");
    await expect(home).toHaveAttribute("data-at", "practice");
    await expect(page.locator(".fxcanvas")).toHaveCount(0);
    await page.waitForTimeout(700);
    expect(await offToneRatio(page)).toBeLessThan(0.005);
    await enterFromHome(page, "daily-file");
    await expect(page.getByTestId("play-screen").or(page.getByTestId("result-screen"))).toBeVisible();
  });

  test("채점 결과: 크레딧 한 닢이 한 바퀴 돌고 멈추며, 보상은 그대로 한 번만 들어온다", async ({ page }) => {
    await preset(page, "daily-unsolved", "&fx=ascii");
    const before = (await stored(page)).credits as number;
    await enterFromHome(page, "daily-file");
    await solve(page, getDailyPuzzle(TEST_DATE)!);
    await expect(page.getByTestId("reward")).toContainText("+60");
    // 보상은 저장된 크레딧에 한 번 더해진다
    expect((await stored(page)).credits).toBe(before + 60);
    const coin = page.locator(".graded__coins.fxcoin");
    await expect(coin).toBeVisible();
    await expect.poll(() => litDots(page, ".graded__coins.fxcoin")).toBeGreaterThan(40);
    await expectOnGrid(coin);
    // 돈다: 처음 장면과 다른 그림이 나온다
    const first = await coin.screenshot();
    await expect.poll(async () => (await coin.screenshot()).equals(first), { intervals: [60] }).toBe(false);
    // 한 바퀴 돌고 정면에서 멈춘다: 가운데의 "I" 기둥은 검고 그 옆의 면은 희며, 그림이 더 바뀌지 않는다
    // (옆의 반짝이는 따로 깜빡이므로 화면 캡처가 아니라 주화 캔버스의 내용으로 견준다)
    const drawn = () => coin.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
    await page.waitForTimeout(2600);
    const still = await drawn();
    await page.waitForTimeout(450);
    expect(await drawn()).toBe(still);
    expect(await dotLit(coin, 13, 13)).toBe(false);
    expect(await dotLit(coin, 9, 13)).toBe(true);
    expect(await offToneRatio(page)).toBeLessThan(0.005);
    await page.screenshot({ path: `${SHOTS}/result-fx.png`, style: ".demo { visibility: hidden !important; }" });

    // 결과 화면을 다시 읽어도, 홈을 거쳐 다시 들어와도 한 번 더 들어오지 않는다
    await page.reload();
    await expect(page.getByTestId("result-screen")).toBeVisible();
    expect((await stored(page)).credits).toBe(before + 60);
    await page.goto("/?demo=1&fx=ascii");
    await expect(page.getByTestId("credit-balance")).toHaveText(String(before + 60));
    await enterFromHome(page, "daily-file");
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await expect(page.getByTestId("reward-claimed")).toContainText("수령 완료");
    await expect(page.getByTestId("reward")).toHaveCount(0);
    expect((await stored(page)).credits).toBe(before + 60);
  });

  test("제한 시간 시험: 시간 칸 안에 모래시계가 놓이고, 1분 아래에서 칸과 함께 뒤집혀 깜빡인다", async ({ page }) => {
    await toExam(page, "&fx=ascii");
    const glass = page.locator(".deskbar .fxglass");
    const cell = page.getByTestId("countdown");
    await expect(glass).toBeVisible();
    await expect.poll(() => litDots(page, ".deskbar .fxglass")).toBeGreaterThan(30);
    await expect(cell).toHaveText(/^1[45]:\d\d$/);
    // 처음에는 위 칸이 가득하고 아래 칸은 비어 있다
    expect(await dotLit(glass, 3, 3)).toBe(true);
    expect(await dotLit(glass, 3, 11)).toBe(false);
    await expectOnGrid(glass);
    expect(await offToneRatio(page)).toBeLessThan(0.005);
    await page.screenshot({ path: `${SHOTS}/exam-fx.png`, style: ".demo { visibility: hidden !important; }" });
    // 위 막대가 넘치지 않는다
    const bar = (await page.locator(".deskbar").boundingBox())!;
    const tag = (await page.locator(".deskbar__tag").boundingBox())!;
    expect(tag.x + tag.width).toBeLessThanOrEqual(bar.x + bar.width);
    const calm = (await glass.boundingBox())!;

    // 1분 아래: 위 칸에는 마지막 한 점만 남고 아래 칸에 쌓였다. 칸이 뒤집혀도 모래시계의 자리는 그대로다.
    const now = gameNowMs();
    await patchState(page, (state) => {
      const exam = state.exam as { remainingMs: number; runningSince: number };
      exam.remainingMs = 50_000;
      exam.runningSince = now;
    });
    await expect(cell).toHaveAttribute("data-low", "true");
    await expect(glass).toBeVisible();
    expect(await dotLit(glass, 3, 3)).toBe(false);
    expect(await dotLit(glass, 5, 6)).toBe(true);
    expect(await dotLit(glass, 3, 11)).toBe(true);
    const low = (await glass.boundingBox())!;
    expect([low.x, low.y]).toEqual([calm.x, calm.y]);
    // 함께 깜빡인다: 칸이 흰 바탕일 때 받침은 검게, 검은 바탕일 때 희게 찍힌다(받침의 한 점과 그 바로 왼쪽의 칸 바탕을 견준다)
    const cellBox = (await cell.boundingBox())!;
    const seen = new Set<string>();
    await expect
      .poll(
        async () => {
          const [cap, ground] = await shownWhite(page, [
            { x: low.x + 5, y: low.y + 1 },
            { x: cellBox.x + 1, y: cellBox.y + 16 },
          ]);
          expect(cap).toBe(!ground);
          seen.add(ground ? "inverted" : "plain");
          return seen.size;
        },
        { intervals: [90] },
      )
      .toBe(2);
    expect(await offToneRatio(page)).toBeLessThan(0.005);
    await page.screenshot({ path: `${SHOTS}/exam-fx-low.png`, style: ".demo { visibility: hidden !important; }" });
  });

  test("모션 줄이기 설정에서는 멈춘 한 장면을 보여 준다", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await preset(page, "daily-unsolved", "&fx=ascii");
    await enterFromHome(page, "daily-file");
    await solve(page, getDailyPuzzle(TEST_DATE)!);
    const coin = page.locator(".graded__coins.fxcoin");
    await expect(coin).toBeVisible();
    expect(await litDots(page, ".graded__coins.fxcoin")).toBeGreaterThan(40);
    // 처음부터 정면이고, 돌지 않는다
    expect(await dotLit(coin, 13, 13)).toBe(false);
    expect(await dotLit(coin, 9, 13)).toBe(true);
    const a = await coin.screenshot();
    await page.waitForTimeout(450);
    expect(a.equals(await coin.screenshot())).toBe(true);
  });
});
