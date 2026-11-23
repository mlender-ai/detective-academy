import { expect, test, type Page } from "@playwright/test";
import { CINE_ON, dialValue, enterFromHome, expectLayoutOk, offToneRatio, preset, setCode, setDial, stored, toSafe } from "./helpers";

/**
 * 암호 풀이 화면 (V3 GATE 03). 사용자가 B안 · 장면 전개를 골라 암호 해독의 기본 화면이 되었다.
 * - 기본(B안 장면 전개): 자료실(쿼터뷰 방)에서 책상(기록)과 금고(자물쇠) 사이를 오가며 푼다.
 * - ?play=c  C안 혼합형: 자물쇠를 크게 두고 조건은 수사 수첩(접힘 · 간편 보기 · 전체 보기)에 담는다. 다른 문제에 쓸 UI 후보로 남겨 두었다.
 * 예전 풀이 화면과 A안(접기·펼치기)은 걷어냈다. 보관본은 저장소 밖의 백업에 있다.
 * 둘 다 같은 엔진으로 판정하고 보상한다. 정답은 426 이다.
 */

type Ux = "b" | "c";

/** 그 안으로 열 때 주소에 덧붙일 값. B안은 기본이라 아무것도 붙이지 않는다. */
const query = (ux: Ux) => (ux === "b" ? "" : `&play=${ux}`);

/** 오늘의 추리(암호 해독)를 그 안으로 연다 */
async function open(page: Page, ux: Ux, id: Parameters<typeof preset>[1] = "daily-unsolved") {
  await preset(page, id, query(ux));
  await enterFromHome(page, "daily-file");
  await expect(page.getByTestId("play-screen")).toHaveAttribute("data-ux", ux);
}

/** 자료실의 방(쿼터뷰)이 그려진 캔버스 */
const vaultRoom = (page: Page) => page.locator('.vaultscene [data-testid="iso-canvas"]');

test("암호 해독의 기본 화면은 자료실 장면이다", async ({ page }) => {
  await preset(page, "daily-unsolved");
  await enterFromHome(page, "daily-file");
  await expect(page).not.toHaveURL(/play=/);
  await expect(page.getByTestId("play-screen")).toHaveAttribute("data-ux", "b");
  await expect(vaultRoom(page)).toBeVisible();
  await expect(page.getByTestId("record")).toBeVisible();
});

test("걷어낸 화면의 주소(?play=old · ?play=a · ?view=side)로 열어도 자료실 장면이 열린다", async ({ page }) => {
  for (const old of ["play=old", "play=a", "view=side"]) {
    await preset(page, "daily-unsolved", `&${old}`);
    await enterFromHome(page, "daily-file");
    await expect(page.getByTestId("play-screen")).toHaveAttribute("data-ux", "b");
    await expect(vaultRoom(page)).toBeVisible();
    await expect(page.getByTestId("live-scene")).toHaveCount(0);
    await expect(page.getByTestId("record")).toBeVisible();
  }
});

test("진술 추리는 그대로 추리 책상에서 푼다", async ({ page }) => {
  await preset(page, "daily-solved");
  await enterFromHome(page, "practice-entry");
  await page.getByTestId("practice-file-practice-truth-001").click();
  const screen = page.getByTestId("play-screen");
  await expect(screen).toHaveAttribute("data-type", "truth");
  expect(await screen.getAttribute("data-ux")).toBeNull();
  // 살아 있는 장면(방)은 놓이지 않는다
  await expect(page.getByTestId("iso-stage")).toHaveCount(0);
  await expect(page.getByTestId("live-scene")).toHaveCount(0);
});

test.describe("기본 · 장면 전개(자료실)", () => {
  test("책상의 기록과 금고의 자물쇠 사이를 오가도 다이얼과 메모가 그대로다", async ({ page }) => {
    await open(page, "b");
    const screen = page.getByTestId("play-screen");
    await expect(vaultRoom(page)).toBeVisible();
    // 들어서면 책상 앞: 기록이 보이고 자물쇠는 아직 없다
    await expect(screen).toHaveAttribute("data-at", "desk");
    await expect(page.getByTestId("record")).toBeVisible();
    await expect(page.locator(".clue")).toHaveCount(5);
    await expect(page.getByTestId("dial-0")).toHaveCount(0);
    await expect(page.getByTestId("submit")).toHaveCount(0);
    await page.getByTestId("memo-5").click();

    // 금고 앞으로: 누른 즉시 자물쇠가 나온다. 책상에서 적은 메모를 들고 간다.
    await page.getByTestId("to-safe").click();
    await expect(screen).toHaveAttribute("data-at", "safe");
    await expect(page.getByTestId("dial-0")).toBeVisible();
    await expect(page.getByTestId("carry-memo")).toContainText("제외 5");
    await setDial(page, 0, 7);

    // 기록을 다시 보러 갔다 와도 돌리던 숫자 그대로다
    await page.getByTestId("to-desk").click();
    await expect(page.getByTestId("record")).toBeVisible();
    await expect(page.locator('.clue__digit[data-memo="out"]')).toHaveCount(3);
    await page.getByTestId("to-safe").click();
    expect(await dialValue(page, 0)).toBe(7);

    // 나갔다 와도 금고 앞에서 잇는다
    await page.getByTestId("play-back").click();
    await expect(page.getByTestId("home-screen")).toBeVisible();
    await enterFromHome(page, "daily-file");
    await expect(page.getByTestId("play-screen")).toHaveAttribute("data-at", "safe");
    expect(await dialValue(page, 0)).toBe(7);
  });

  test("장면의 물건을 눌러도 오간다", async ({ page }) => {
    await open(page, "b");
    const screen = page.getByTestId("play-screen");
    await expect(screen).toHaveAttribute("data-at", "desk");
    // 방 안의 금고와 책상은 손가락으로 누르는 자리다(가운데를 실제로 두드린다)
    const tapSpot = async (id: "scene-safe" | "scene-desk") => {
      const box = (await page.getByTestId(id).boundingBox())!;
      const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      // 화면 전환이 끝날 때까지는 전환 층이 위에 있어 눌리지 않는다. 좌표로 누르는 것은 스스로 기다리지 않으므로 여기서 기다린다.
      await expect.poll(() => page.evaluate(({ x, y, id }) => document.elementFromPoint(x, y)?.closest("[data-testid]")?.getAttribute("data-testid") === id, { ...at, id })).toBe(true);
      await page.touchscreen.tap(at.x, at.y);
    };
    await tapSpot("scene-safe");
    await expect(screen).toHaveAttribute("data-at", "safe");
    await expect(page.getByTestId("dial-0")).toBeVisible();
    await page.waitForTimeout(900);
    await tapSpot("scene-desk");
    await expect(screen).toHaveAttribute("data-at", "desk");
    await expect(page.getByTestId("record")).toBeVisible();
  });

  test("수사 지원은 책상에서 받고, 금고 앞에서 정답을 내면 금고가 열린 뒤 결과로 이어진다", async ({ page }) => {
    await open(page, "b");
    await page.getByTestId("hint-button").click();
    await expect(page.getByTestId("hint-drawer")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByTestId("to-safe").click();
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("notice-wrong")).toBeVisible();
    await setCode(page, [4, 2, 6]);
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("narration")).toContainText("금고가 열렸다");
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await expect(page.getByTestId("reward")).toContainText("+60");
  });
});

test.describe("C안 · 혼합형(수사 수첩) (?play=c)", () => {
  test("수첩을 접고, 간편 보기로 보고, 전체 보기로 펴도 자물쇠의 숫자가 그대로다", async ({ page }) => {
    await open(page, "c");
    const screen = page.getByTestId("play-screen");
    // 처음: 간편 보기. 기록 다섯 건이 숫자와 표시로 보인다.
    await expect(screen).toHaveAttribute("data-note", "peek");
    await expect(page.getByTestId("note-peek")).toContainText("서로 다른 숫자 3개");
    await expect(page.locator(".cluestrip .cluestrip__item")).toHaveCount(5);
    await setDial(page, 1, 8);

    // 전체 보기: 사건, 시도 기록, 숫자 메모, 수사 지원
    await page.getByTestId("note-full").click();
    const pageEl = page.getByTestId("note-page");
    await expect(pageEl).toBeVisible();
    await expect(pageEl).toContainText("자료실 금고는");
    await expect(pageEl.locator(".clue")).toHaveCount(5);
    await expect(pageEl).toContainText("받은 수사 지원이 없다");
    await page.getByTestId("memo-9").click();
    // 579 기록을 중요로 표시한다
    await page.getByTestId("flag-1").click();
    await expect(page.getByTestId("flag-1")).toHaveAttribute("aria-pressed", "true");

    // 닫으면 돌리던 숫자 그대로이고, 간편 보기에는 표시한 기록이 글과 함께 먼저 보인다
    await page.getByTestId("note-back").click();
    await expect(pageEl).toHaveCount(0);
    expect(await dialValue(page, 1)).toBe(8);
    await expect(page.locator(".notebook__flagged .clue")).toHaveCount(1);
    await expect(page.locator(".notebook__flagged")).toContainText("일치하는 숫자 없음");
    await expect(page.getByTestId("note-memo")).toContainText("제외 9");

    // 접으면 표지만 남고, 그 상태는 새로고침해도 남는다
    await page.getByTestId("note-toggle").click();
    await expect(screen).toHaveAttribute("data-note", "closed");
    await expect(page.getByTestId("note-peek")).toHaveCount(0);
    await expect(page.getByTestId("note-toggle")).toContainText("중요 1");
    await page.reload();
    await expect(page.getByTestId("play-screen")).toHaveAttribute("data-note", "closed");
    expect(await dialValue(page, 1)).toBe(8);
  });

  test("받은 수사 지원은 수첩에 남고, 정답이면 결과로 이어진다", async ({ page }) => {
    await open(page, "c");
    await page.getByTestId("hint-button").click();
    await expect(page.getByTestId("hint-drawer")).toBeVisible();
    await page.getByTestId("hint-1-open").click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("hint-drawer")).toHaveCount(0);
    await expect(page.getByTestId("note-toggle")).toContainText("지원 1");
    await page.getByTestId("note-full").click();
    await expect(page.getByTestId("brief-hint-1")).toBeVisible();
    await page.getByTestId("note-close").click();

    await setCode(page, [4, 2, 6]);
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("result-screen")).toBeVisible();
  });

  test.describe("도입 장면", () => {
    // 자막 화면을 켠 상태(일반 사용자의 기본)로 본다
    test.use({ storageState: CINE_ON });

    test("처음 여는 사건은 자료실의 도입 장면으로 시작하고, 누르면 바로 넘어간다", async ({ page }) => {
      await preset(page, "daily-unsolved", "&play=c");
      await enterFromHome(page, "daily-file");
      const intro = page.getByTestId("intro");
      await expect(intro).toBeVisible();
      await expect(intro).toContainText("자료실 금고의 암호");
      await expect(intro.getByTestId("narration")).toContainText("자료실 구석");
      await intro.click();
      await expect(intro).toHaveCount(0);
      await expect(page.getByTestId("dial-0")).toBeVisible();
    });
  });
});

test.describe("두 화면의 공통 약속", () => {
  for (const ux of ["b", "c"] as const) {
    test(`${ux === "b" ? "기본(자료실)" : "C안"}: 두 가지 색으로만 그려진다`, async ({ page }) => {
      await open(page, ux);
      await page.waitForTimeout(900);
      expect(await offToneRatio(page)).toBeLessThan(0.005);
      if (ux === "b") {
        await page.getByTestId("to-safe").click();
        await page.waitForTimeout(900);
        expect(await offToneRatio(page)).toBeLessThan(0.005);
      }
      if (ux === "c") {
        await page.getByTestId("note-full").click();
        await page.waitForTimeout(400);
        expect(await offToneRatio(page)).toBeLessThan(0.005);
      }
    });

    test(`${ux === "b" ? "기본(자료실)" : "C안"}: 이미 해결한 사건은 기록으로 열리고, 다시 풀어도 보상은 한 번이다`, async ({ page }) => {
      await preset(page, "daily-solved", query(ux));
      await enterFromHome(page, "daily-file");
      await expect(page.getByTestId("result-screen")).toBeVisible();
      await page.getByTestId("replay").click();
      await expect(page.getByTestId("play-screen")).toHaveAttribute("data-ux", ux);
      if (ux === "b") await toSafe(page);
      await setCode(page, [4, 2, 6]);
      await page.getByTestId("submit").click();
      await expect(page.getByTestId("result-screen")).toBeVisible();
      expect((await stored(page)).credits).toBe(100);
    });
  }

  test.describe("모션 줄이기 설정", () => {
    test.use({ reducedMotion: "reduce" });

    test("기본(자료실): 걷는 연출 없이도 오가고 풀 수 있다", async ({ page }) => {
      await open(page, "b");
      await expect(page.getByTestId("play-screen")).toHaveAttribute("data-at", "desk");
      await page.getByTestId("to-safe").click();
      await setCode(page, [4, 2, 6]);
      await page.getByTestId("submit").click();
      await expect(page.getByTestId("result-screen")).toBeVisible();
    });
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

    test("기본(자료실): 책상에서는 기록 다섯 건과 메모가, 금고 앞에서는 드럼과 제출 단추가 화면 안에 있다", async ({ page }) => {
      await open(page, "b");
      await expectLayoutOk(page, '[data-testid="to-safe"]');
      const go = (await page.getByTestId("to-safe").boundingBox())!.y;
      const memo = (await page.getByTestId("memo-9").boundingBox())!;
      expect(memo.y + memo.height, "숫자 메모가 단추 줄에 가려진다").toBeLessThanOrEqual(go);
      // 방이 책상과 금고가 보일 만큼 남는다: 띠의 높이가 196px(98점) 아래로 줄지 않고, 두 물건의 누르는 자리가 띠 안에서 서술 한 줄에 가리지 않는다
      const stage = (await page.getByTestId("iso-stage").boundingBox())!;
      expect(stage.height).toBeGreaterThanOrEqual(196);
      const caption = (await page.locator(".isostage .narr").boundingBox())!;
      for (const id of ["scene-desk", "scene-safe"]) {
        const box = (await page.getByTestId(id).boundingBox())!;
        expect(box.y + box.height / 2, `${id} 가 서술 한 줄에 가린다`).toBeGreaterThan(caption.y + caption.height);
        expect(box.y + box.height / 2, `${id} 가 띠 아래로 잘린다`).toBeLessThan(stage.y + stage.height);
      }

      await page.getByTestId("to-safe").click();
      await expectLayoutOk(page, '[data-testid="submit"]');
      const submitTop = (await page.getByTestId("submit").boundingBox())!.y;
      const dials = (await page.locator(".lock__dials").boundingBox())!;
      expect(dials.y + dials.height, "드럼이 제출 단추에 가려진다").toBeLessThanOrEqual(submitTop);
    });

    test("C안: 간편 보기와 드럼, 제출 단추가 한 화면에 있고 전체 보기의 닫는 단추가 화면 안에 있다", async ({ page }) => {
      await open(page, "c");
      await expectLayoutOk(page, '[data-testid="submit"]');
      const submitTop = (await page.getByTestId("submit").boundingBox())!.y;
      const dials = (await page.locator(".lock__dials").boundingBox())!;
      expect(dials.y + dials.height, "드럼이 제출 단추에 가려진다").toBeLessThanOrEqual(submitTop);
      const peek = (await page.getByTestId("note-peek").boundingBox())!;
      expect(peek.y + peek.height, "수첩이 드럼을 가린다").toBeLessThanOrEqual(dials.y);

      await page.getByTestId("note-full").click();
      await expectLayoutOk(page, '[data-testid="note-back"]');
    });
  });
}
