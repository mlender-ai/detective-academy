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

/**
 * 복도의 곳들(복도 좌표, 점): 탐정이 서는 자리, 누를 수 있는 가로 범위, 누를 세로 자리.
 * src/scene/sideScene.ts 의 SPOTS 와 같아야 한다(겹치는 영역은 한쪽만 적었다).
 */
const CORRIDOR = {
  archive: { stand: 77, hit: [20, 82], y: 84 },
  board: { stand: 89, hit: [86, 156], y: 60 },
  practice: { stand: 192, hit: [168, 216], y: 70 },
  exam: { stand: 264, hit: [236, 284], y: 70 },
  case: { stand: 279, hit: [296, 318], y: 92 },
} as const;
type Spot = keyof typeof CORRIDOR;
/** 복도 전체의 폭(점)과, 아직 어디에도 서지 않았을 때 탐정의 자리 */
const CORRIDOR_W = 340;
const ENTRANCE_X = 152;

/**
 * 복도의 그 물건을 누른다. 카메라가 탐정이 선 곳(data-at)을 따라가 멈춰 있다고 보고, 그 카메라에서 물건이 그려진 자리를 누른다.
 * 카메라가 따라가지 않았으면 엉뚱한 곳이 눌려 도착하지 못한다. 돌려주는 값은 그 카메라와 보이는 가로 범위(점).
 */
async function tapSpot(page: Page, id: Spot) {
  const target = await page.evaluate(
    ([spots, to, width, entrance]) => {
      const host = document.querySelector('[data-testid="live-scene"]')!.getBoundingClientRect();
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="live-scene"] canvas')!;
      const rect = canvas.getBoundingClientRect();
      const k = canvas.width / rect.width;
      const x0 = Math.max(0, (host.left - rect.left) * k);
      const x1 = Math.min(canvas.width, (host.right - rect.left) * k);
      const at = document.querySelector('[data-testid="home-screen"]')!.getAttribute("data-at") as keyof typeof spots | "";
      const stand = at ? spots[at].stand : entrance;
      const cam = Math.round(Math.max(-x0, Math.min(width - x1, stand - (x0 + x1) / 2)));
      const [from, upto] = spots[to].hit;
      // 물건의 가운데를 누르되, 화면 끝에 걸려 있으면 보이는 쪽을 누른다
      const x = Math.max(Math.max(from, cam + x0 + 3), Math.min(Math.min(upto, cam + x1 - 3), (from + upto) / 2));
      return { x: rect.left + (x - cam) / k, y: rect.top + spots[to].y / k, cam, x0, x1 };
    },
    [CORRIDOR, id, CORRIDOR_W, ENTRANCE_X] as const,
  );
  await page.touchscreen.tap(target.x, target.y);
  return target;
}

/** 장면에 지금 그려진 점들(밝기)과 캔버스의 폭 */
async function sceneDots(page: Page) {
  return page.locator('[data-testid="live-scene"] canvas').evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    const dots: number[] = [];
    for (let i = 0; i < data.length; i += 4) dots.push(data[i]);
    return { dots, w: canvas.width };
  });
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

  test("모션 줄이기 설정에서도 카메라가 탐정을 따라간다: 복도 끝으로 가도 탐정이 보이는 영역 안에 선다", async ({ page }) => {
    // 걷지 않고 한 장면만 그릴 때 카메라가 처음 자리에 남아, 복도 끝으로 간 탐정이 화면 밖에 서던 문제의 회귀 테스트
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 629 });
    await preset(page, "promoted");
    const home = page.getByTestId("home-screen");
    await expect(home).toHaveAttribute("data-at", "practice");
    await page.waitForTimeout(150);
    const atPractice = await sceneDots(page);

    // 시험실 문은 복도의 오른쪽 끝에 있다
    await tapSpot(page, "exam");
    await expect(home).toHaveAttribute("data-at", "exam");
    await page.waitForTimeout(150);
    const atExam = await sceneDots(page);
    expect(atExam.dots, "시험실로 간 뒤에도 장면이 그대로다").not.toEqual(atPractice.dots);

    // 카메라가 오른쪽 끝까지 따라왔으면 그 옆의 사건 접수함(텔레비전)이 제자리에서 눌린다
    const view = await tapSpot(page, "case");
    await expect(home).toHaveAttribute("data-at", "case");
    await page.waitForTimeout(150);
    const atCase = await sceneDots(page);

    // 두 장면은 카메라가 같고(복도의 오른쪽 끝) 탐정이 선 자리만 다르다: 달라진 점이 곧 탐정이 그려진 자리다
    const xs = atExam.dots.flatMap((dot, i) => (dot === atCase.dots[i] ? [] : [i % atExam.w]));
    expect(xs.length, "탐정이 그려지지 않았다").toBeGreaterThan(100);
    expect(Math.min(...xs), "탐정이 보이는 영역의 왼쪽 밖에 그려졌다").toBeGreaterThanOrEqual(view.x0);
    expect(Math.max(...xs), "탐정이 보이는 영역의 오른쪽 밖에 그려졌다").toBeLessThanOrEqual(view.x1);

    // 왼쪽 끝으로 돌아갈 때도 따라간다: 연습실 → 게시판 → 기록 보관함
    for (const id of ["practice", "board", "archive"] as const) {
      await tapSpot(page, id);
      await expect(home).toHaveAttribute("data-at", id);
    }
    await expect(page.getByTestId("identity")).toHaveAttribute("data-on", "true");
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
