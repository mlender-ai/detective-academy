import { expect, test, type Page } from "@playwright/test";
import { practiceOfRank } from "../src/data/puzzles";
import { offToneRatio, preset, shot } from "./helpers";

/**
 * 연습실의 과제 목록 (V3 RELEASE: 서류함의 과제가 셋에서 대여섯으로 늘었다).
 * 아래 창의 높이는 못박혀 있다. 목록은 그 안에서 위아래로 밀리고(터치), 창은 화면 아래로도 방 쪽으로도 넘치지 않는다.
 * 밀린다는 것은 화면에 보인다: 넷째 줄이 창의 아래 변에 잘려 있고, 머리에 ▼(아래에 더 있다) · ▲(위에 더 있다)가 뜬다.
 * 특수 도전 과제의 줄에는 뒤집힌 꼬리표가 붙는다.
 */

const SIZES = [
  [390, 844],
  [390, 664],
  [375, 629],
] as const;

const room = (page: Page) => page.getByTestId("practice-room");
const list = (page: Page) => page.getByTestId("practice-list");

async function toCabinet(page: Page, rank: string) {
  if ((await room(page).getAttribute("data-at")) !== rank) await page.getByTestId(`drawer-${rank}`).tap();
  await expect(room(page)).toHaveAttribute("data-at", rank);
}

/** 목록 위에서 손가락으로 민다(크로미움의 터치 스크롤 제스처). distance 가 음수면 내용이 위로 올라간다(아래쪽을 본다). */
async function swipe(page: Page, distance: number) {
  const box = (await list(page).boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.synthesizeScrollGesture", {
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
    yDistance: distance,
    gestureSourceType: "touch",
    speed: 1200,
  });
  await cdp.detach();
}

/** 목록에서 온전히 보이는 줄의 수와, 아래 변에 잘린 줄이 있는가 */
async function visibleRows(page: Page) {
  return list(page).evaluate((el) => {
    const frame = el.getBoundingClientRect();
    const rows = [...el.querySelectorAll(".isotask")].map((row) => row.getBoundingClientRect());
    return {
      whole: rows.filter((r) => r.top >= frame.top - 0.5 && r.bottom <= frame.bottom + 0.5).length,
      // 아래 변에 걸린 줄이 얼마나 보이는가(px)
      cutBelow: Math.max(0, ...rows.filter((r) => r.top < frame.bottom && r.bottom > frame.bottom + 0.5).map((r) => frame.bottom - r.top)),
      cutAbove: Math.max(0, ...rows.filter((r) => r.top < frame.top - 0.5 && r.bottom > frame.top).map((r) => r.bottom - frame.top)),
    };
  });
}

/** 아래 창이 제 자리를 지키는가: 화면 아래로도, 위의 방 쪽으로도 넘치지 않는다 */
async function expectWindowFits(page: Page, height: number, name: string) {
  const win = (await page.locator(".isowin--tasks").boundingBox())!;
  const card = (await page.locator(".isowin--tasks .isocard").boundingBox())!;
  const frame = (await list(page).boundingBox())!;
  const stage = (await page.getByTestId("iso-stage").boundingBox())!;
  expect(win.y + win.height, `${name}: 아래 창이 화면 아래로 넘친다`).toBeLessThanOrEqual(height);
  expect(card.y, `${name}: 아래 창의 내용이 방 쪽으로 넘친다`).toBeGreaterThanOrEqual(win.y);
  expect(card.y, `${name}: 아래 창의 내용이 방을 덮는다`).toBeGreaterThanOrEqual(stage.y + stage.height);
  expect(card.y + card.height, `${name}: 아래 창의 내용이 화면 아래로 넘친다`).toBeLessThanOrEqual(height);
  expect(frame.y + frame.height, `${name}: 목록이 창 밖으로 나간다`).toBeLessThanOrEqual(win.y + win.height);
  expect(await room(page).evaluate((el) => el.scrollHeight - el.clientHeight), `${name}: 연습실이 세로로 넘친다`).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${name}: 가로로 넘친다`).toBeLessThanOrEqual(0);
  return { win, stage };
}

for (const [w, h] of SIZES) {
  test.describe(`화면 크기 ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test("과제 여섯 줄의 서류함: 창은 넘치지 않고, 목록을 손가락으로 밀어 마지막 줄(특수 도전)까지 눌러 연다", async ({ page }) => {
      // C급: F · D · C 서류함이 열려 있다. C 서류함에 과제 여섯(마지막이 특수 도전)
      await preset(page, "ready-b");
      await page.goto("/?demo=1#/practice");
      await expect(room(page)).toBeVisible();
      await toCabinet(page, "C");
      const sheets = practiceOfRank("C");
      expect(sheets).toHaveLength(6);
      expect(sheets[5]).toMatchObject({ id: "special-code-001", special: true });
      await expect(page.locator(".isotask")).toHaveCount(6);
      await expect(page.getByTestId("drawer-count")).toHaveText("해결 0/6");

      // 방은 과제가 셋인 서류함(B)일 때와 같은 자리다: 과제가 늘어도 아래 창의 높이가 그대로라 방이 밀리지 않는다
      const { win, stage } = await expectWindowFits(page, h, "C 서류함");
      expect(win.height).toBeGreaterThanOrEqual(184);

      // 목록은 스스로 밀리는 자리다(세로만, 터치로)
      const style = await list(page).evaluate((el) => {
        const cs = getComputedStyle(el);
        return { overflowY: cs.overflowY, touchAction: cs.touchAction, room: el.scrollHeight - el.clientHeight, top: el.scrollTop };
      });
      expect(style.overflowY).toBe("auto");
      expect(style.touchAction).toBe("pan-y");
      expect(style.room, "여섯 줄은 창보다 길다").toBeGreaterThan(80);
      expect(style.top).toBe(0);

      // 줄의 누르는 높이는 44px 이상이고, 화면 폭 안에 있다
      for (const box of await page.locator(".isotask").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as { height: number; left: number; right: number }))) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(w);
      }

      // 밀린다는 것이 보인다: 세 줄이 온전히 보이고, 넷째 줄이 아래 변에 잘려 있고(제목의 윗부분이 보일 만큼), 머리에 ▼ 가 떠 있다
      const top = await visibleRows(page);
      expect(top.whole).toBe(3);
      expect(top.cutBelow, "넷째 줄이 잘려 보이는 높이").toBeGreaterThanOrEqual(12);
      await expect(page.getByTestId("practice-more")).toHaveText("▼");
      // 마지막 줄은 아직 창 밖이다
      const special = page.getByTestId("practice-file-special-code-001");
      const before = (await special.boundingBox())!;
      const frame = (await list(page).boundingBox())!;
      expect(before.y).toBeGreaterThanOrEqual(frame.y + frame.height - 1);
      expect(await offToneRatio(page), "C 서류함(위): 두 색이 아닌 화소").toBeLessThan(0.005);
      await shot(page, `practice-list-${w}x${h}-top`);

      // 손가락으로 조금 민다: 가운데에서는 위아래 모두 더 있다
      await swipe(page, -70);
      await expect.poll(() => list(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(30);
      await expect(page.getByTestId("practice-more")).toHaveText("▲▼");
      // 끝까지 민다: 마지막 줄이 온전히 창 안에 들어오고, 머리에는 ▲ 만 남는다
      await swipe(page, -400);
      await expect.poll(() => list(page).evaluate((el) => Math.round(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThanOrEqual(1);
      await expect(page.getByTestId("practice-more")).toHaveText("▲");
      const after = (await special.boundingBox())!;
      expect(after.y).toBeGreaterThanOrEqual(frame.y - 1);
      expect(after.y + after.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
      const bottom = await visibleRows(page);
      expect(bottom.whole).toBe(3);
      expect(bottom.cutAbove).toBeGreaterThanOrEqual(12);

      // 목록을 밀어도 방과 창은 그 자리다(화면이 따라 밀리지 않는다)
      const moved = await expectWindowFits(page, h, "C 서류함(끝까지 민 뒤)");
      expect(moved.win.y).toBe(win.y);
      expect(moved.stage.height).toBe(stage.height);

      // 특수 도전의 꼬리표: 그 줄에만 붙고, 뒤집힌 색(흰 바탕에 검은 글자)이다
      const flag = page.getByTestId("practice-special-special-code-001");
      await expect(flag).toHaveText("특수 도전");
      await expect(page.locator(".isotask__flag")).toHaveCount(1);
      await expect(special).toHaveAttribute("data-special", "true");
      await expect(special).toHaveAttribute("aria-label", /^특수 도전, /);
      expect(await flag.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor])).toEqual(["rgb(0, 0, 0)", "rgb(241, 241, 234)"]);
      expect(await flag.evaluate((el) => getComputedStyle(el).fontSize)).toBe("12px");
      await expect(page.getByTestId("practice-status-special-code-001")).toHaveText("+60");
      expect(await offToneRatio(page), "C 서류함(아래): 두 색이 아닌 화소").toBeLessThan(0.005);
      await shot(page, `practice-list-${w}x${h}-bottom`);

      // 마지막 줄을 눌러 연다(가려지지 않았다)
      await special.tap();
      await expect(page).toHaveURL(/#\/practice\/special-code-001$/);
      await expect(page.getByTestId("play-screen")).toBeVisible();
    });

    test("과제 다섯 줄의 서류함: 권하는 과제가 창 밖에 있으면 거기까지 밀어 놓고, 셋뿐인 서류함은 밀리지 않는다", async ({ page }) => {
      // D급에서 C급 시험을 앞둔 상태: F 서류함의 앞 넷을 풀었다. 풀지 않은 것은 다섯째(엎질러진 잉크병)
      await preset(page, "ready-c");
      await page.goto("/?demo=1#/practice");
      // 들어섰을 때 서는 곳의 규칙은 그대로다: 풀지 않은 과제가 남은 가장 낮은 등급의 서류함
      await expect(room(page)).toHaveAttribute("data-at", "F");
      await expect(page.locator(".isotask")).toHaveCount(5);
      await expect(page.getByTestId("drawer-count")).toHaveText("해결 4/5");
      const next = page.getByTestId("practice-file-practice-evidence-f");
      await expect(next).toHaveAttribute("data-primary", "true");
      // 다섯째 줄은 처음 창(세 줄 남짓)의 밖이지만, 서류함을 열면 거기까지 밀려 있다
      await expect.poll(() => list(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(40);
      const frame = (await list(page).boundingBox())!;
      const box = (await next.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(frame.y - 1);
      expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
      await expect(page.getByTestId("practice-more")).toHaveText("▲");
      await expectWindowFits(page, h, "F 서류함");
      // 특수 도전이 없는 서류함에는 꼬리표가 없다
      await expect(page.locator(".isotask__flag")).toHaveCount(0);
      // 손가락으로 되밀어 첫 줄을 다시 본다
      await swipe(page, 400);
      await expect.poll(() => list(page).evaluate((el) => el.scrollTop)).toBe(0);
      await expect(page.getByTestId("practice-more")).toHaveText("▼");
      await shot(page, `practice-list-${w}x${h}-five`);

      // 다른 서류함으로 가면 목록은 처음부터다(D 서류함: 풀지 않은 첫 과제가 맨 위)
      await toCabinet(page, "D");
      await expect(page.locator(".isotask")).toHaveCount(5);
      await expect.poll(() => list(page).evaluate((el) => el.scrollTop)).toBe(0);
      await expectWindowFits(page, h, "D 서류함");
    });

    test("과제가 셋인 서류함은 밀리지 않고 세모도 뜨지 않는다", async ({ page }) => {
      await preset(page, "ready-a");
      await page.goto("/?demo=1#/practice");
      await toCabinet(page, "B");
      await expect(page.locator(".isotask")).toHaveCount(3);
      expect(await list(page).evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
      await expect(page.getByTestId("practice-more")).toHaveCount(0);
      const rows = await visibleRows(page);
      expect(rows).toEqual({ whole: 3, cutBelow: 0, cutAbove: 0 });
      await expectWindowFits(page, h, "B 서류함");
    });
  });
}
