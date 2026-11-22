import { expect, test, type Page } from "@playwright/test";
import { preset, settledBox, toSafe } from "./helpers";

/**
 * 실제 손가락 입력(터치 이벤트)으로 조작이 되는지 확인한다.
 * 마우스로는 통과해도 터치에서는 브라우저가 스크롤로 가로채 조작이 끊기는 경우가 있다.
 */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 8) {
  // 화면 전환(View Transition)이 진행되는 동안에는 입력이 전환 층으로 가므로, 끝난 뒤에 손을 댄다.
  await page.waitForFunction(() => !document.documentElement.matches(":active-view-transition"));
  const client = await page.context().newCDPSession(page);
  const send = (type: "touchStart" | "touchMove" | "touchEnd", points: { x: number; y: number }[]) =>
    client.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  await send("touchStart", [from]);
  for (let i = 1; i <= steps; i++) {
    await send("touchMove", [
      { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps },
    ]);
  }
  await send("touchEnd", []);
  await client.detach();
}

const centre = (box: { x: number; y: number; width: number; height: number }) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

test("손가락으로 다이얼을 밀고 눌러서 숫자를 바꾼다", async ({ page }) => {
  await preset(page, "daily-unsolved");
  await page.getByTestId("daily-file").click();
  await toSafe(page);
  await expect(page.getByTestId("dial-1")).toHaveAttribute("aria-valuenow", "2");

  // 위로 두 칸 밀기: 2 → 4
  const dial = centre(await settledBox(page, "dial-1"));
  await touchDrag(page, dial, { x: dial.x, y: dial.y - 100 });
  await expect(page.getByTestId("dial-1")).toHaveAttribute("aria-valuenow", "4");

  // 아래로 다섯 칸 밀기: 4 → 8 (1 다음은 9로 이어진다)
  await touchDrag(page, dial, { x: dial.x, y: dial.y + 250 }, 12);
  await expect(page.getByTestId("dial-1")).toHaveAttribute("aria-valuenow", "8");

  // 숫자를 누르면 다음 숫자
  await page.touchscreen.tap(dial.x, dial.y);
  await expect(page.getByTestId("dial-1")).toHaveAttribute("aria-valuenow", "9");

  // 다이얼을 미는 동안 화면이 같이 스크롤되지 않는다
  expect(await page.locator(".sceneplay__panel").evaluate((el) => el.scrollTop)).toBe(0);
});

test("손가락으로 카드를 끌어 시간표에 놓고, 눌러서도 배치한다", async ({ page }) => {
  await preset(page, "exam-ready");
  await page.getByTestId("exam-cta").click();
  await page.getByTestId("open-envelope").click();
  await expect(page.getByTestId("card-sea")).toBeVisible();

  // 끌어서 놓기
  await touchDrag(page, centre(await settledBox(page, "card-sea")), centre(await settledBox(page, "slot-2")));
  await expect(page.getByTestId("slot-2")).toHaveAttribute("aria-label", /세아 배치됨/);

  // 슬롯에서 슬롯으로 옮기기
  await touchDrag(page, centre(await settledBox(page, "card-sea")), centre(await settledBox(page, "slot-0")));
  await expect(page.getByTestId("slot-0")).toHaveAttribute("aria-label", /세아 배치됨/);
  await expect(page.getByTestId("slot-2")).toHaveAttribute("aria-label", /비어 있음/);

  // 눌러서 고르고, 시간을 눌러 배치
  const card = centre(await settledBox(page, "card-harin"));
  await page.touchscreen.tap(card.x, card.y);
  await expect(page.getByTestId("card-harin")).toHaveAttribute("aria-pressed", "true");
  const slot = centre(await settledBox(page, "slot-1"));
  await page.touchscreen.tap(slot.x, slot.y);
  await expect(page.getByTestId("slot-1")).toHaveAttribute("aria-label", /하린 배치됨/);

  // 대기석으로 끌어 되돌리기
  const tray = (await page.locator(".board__tray").boundingBox())!;
  await touchDrag(page, centre(await settledBox(page, "card-sea")), { x: tray.x + tray.width / 2, y: tray.y + tray.height - 30 });
  await expect(page.getByTestId("slot-0")).toHaveAttribute("aria-label", /비어 있음/);
  await expect(page.getByTestId("placed-count")).toHaveText("배치 1/4");
});
