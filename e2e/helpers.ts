import { expect, type Page } from "@playwright/test";

export const STORAGE_KEY = "detective-academy:v1";

/** 테스트에서 고정해 둔 게임 날짜: 달력의 첫날. 오늘의 추리는 '자료실 금고의 암호'다. */
export const TEST_DATE = "2026-11-22";

/**
 * 게임의 "지금"(ms). 테스트는 게임 날짜를 TEST_DATE 로 옮겨 놓고 돌므로, 게임의 시계는 실제 시각에서 날짜만큼 밀려 있다
 * (src/app/clock.ts 의 gameNow 와 같은 셈). 저장된 상태에 시각을 써 넣을 때는 Date.now() 가 아니라 이것을 쓴다:
 * 실제 날짜가 TEST_DATE 와 다른 날에는 둘이 하루 넘게 어긋나, 제한 시간이 영영 끝나지 않는다(2026-11-23 에 실제로 겪었다).
 */
export function gameNowMs(): number {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const days = Math.round((Date.parse(`${TEST_DATE}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return Date.now() + days * 86_400_000;
}

/** 브라우저 테스트가 여는 빌드본의 주소. playwright.config.ts 와 같은 값이다(E2E_PORT 로 포트를 나눈다). */
export const ORIGIN = `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4183)}`;

/**
 * 자막 화면을 켜고 돌릴 때의 저장소: 자막을 끄는 값만 빼고, 게임 날짜는 그대로 고정한다.
 * (playwright.config.ts 의 기본값은 자막을 끄고 날짜를 고정한다)
 */
export const CINE_ON = {
  cookies: [],
  origins: [{ origin: ORIGIN, localStorage: [{ name: "detective-academy:date", value: TEST_DATE }] }],
};
export const SHOTS = "docs/screenshots";

/** 저장된 게임 상태를 그대로 읽는다 */
export async function stored(page: Page) {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "null"), STORAGE_KEY);
}

export async function shot(page: Page, name: string) {
  // 글자 조각(웹폰트)이 다 내려온 뒤, 유한한 CSS 애니메이션·전환은 끝 상태로 넘겨서 찍는다.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // QA 손잡이는 일반 사용자 화면에 없는 것이므로 기록에서 뺀다.
  await page.screenshot({
    path: `${SHOTS}/${name}.png`,
    animations: "disabled",
    style: ".demo { visibility: hidden !important; }",
  });
}

/** 첫 실행 → 입학 → 학원 홈 */
export async function enroll(page: Page, nickname?: string) {
  await page.goto("/");
  await expect(page.getByTestId("admission-screen")).toBeVisible();
  if (nickname) await page.getByTestId("nickname-input").fill(nickname);
  await page.getByTestId("enroll").click();
  await expect(page.getByTestId("admission-grant")).toBeVisible();
  await page.getByTestId("enter-academy").click();
  await expect(page.getByTestId("home-screen")).toBeVisible();
}

/** 홈(쿼터뷰 학원 홀)에서 누르는 곳: 방 안의 문과 물건 */
export type HomeSpot = "daily-file" | "practice-entry" | "exam-cta" | "exam-wait" | "exam-record" | "story-entry" | "identity";

/** 홈의 아래 창에 있는 큰 단추: 지금 고른 곳으로 들어간다 */
export const homeGo = (page: Page, id: HomeSpot) => page.getByTestId(id === "daily-file" ? "daily-file-cta" : `${id}-go`);

/**
 * 홈에서 그곳으로 들어간다: 방 안의 문이나 물건을 눌러 고르고(탐정이 걸어간다), 아래 창의 큰 단추를 누른다.
 * 이미 골라져 있으면(들어서면 오늘 할 일이 골라져 있다) 큰 단추만 누른다. 탐정이 아직 걷는 중이면 도착하는 대로 들어간다.
 */
export async function enterFromHome(page: Page, id: HomeSpot) {
  const spot = page.getByTestId(id);
  await expect(spot).toBeVisible();
  if ((await spot.getAttribute("data-on")) !== "true") await spot.click();
  await homeGo(page, id).click();
}

/** QA 패널(?demo=1)로 원하는 진행 상태를 만든다 */
export async function preset(
  page: Page,
  id: "first-run" | "daily-unsolved" | "daily-solved" | "exam-ready" | "promoted" | "ready-c" | "ready-b" | "ready-a" | "ready-s" | "rank-s",
  /** 주소에 덧붙일 값. 예: "&save=b" (다른 저장 칸으로 열기) */
  query = "",
) {
  await page.goto(`/?demo=1${query}`);
  await page.getByTestId("demo-toggle").click();
  await page.getByTestId(`demo-${id}`).click();
  await expect(page.getByTestId("demo-toggle")).toHaveAttribute("aria-expanded", "false");
}

/**
 * 암호 해독은 자료실 장면에서 푼다: 책상에 시도 기록·숫자 메모·수사 지원이 있고, 금고 앞에 자물쇠와 제출 단추가 있다.
 * 금고 앞으로 간다. 이미 금고 앞이면(풀다가 나갔다 온 경우) 그대로 둔다.
 */
export async function toSafe(page: Page) {
  const screen = page.getByTestId("play-screen");
  await expect(screen).toHaveAttribute("data-ux", "b");
  if ((await screen.getAttribute("data-at")) !== "safe") await page.getByTestId("to-safe").click();
  await expect(screen).toHaveAttribute("data-at", "safe");
  await expect(page.getByTestId("dial-0")).toBeVisible();
}

/** 책상 앞으로 간다(기록을 다시 본다). 이미 책상 앞이면 그대로 둔다. */
export async function toDesk(page: Page) {
  const screen = page.getByTestId("play-screen");
  await expect(screen).toHaveAttribute("data-ux", "b");
  if ((await screen.getAttribute("data-at")) !== "desk") await page.getByTestId("to-desk").click();
  await expect(screen).toHaveAttribute("data-at", "desk");
  await expect(page.getByTestId("record")).toBeVisible();
}

export async function dialValue(page: Page, index: number) {
  return Number(await page.getByTestId(`dial-${index}`).getAttribute("aria-valuenow"));
}

/** 아래 화살표를 눌러 다이얼을 원하는 숫자로 맞춘다 */
export async function setDial(page: Page, index: number, digit: number) {
  for (let i = 0; i < 9; i++) {
    if ((await dialValue(page, index)) === digit) return;
    const before = await dialValue(page, index);
    await page.getByTestId(`dial-${index}-next`).click();
    await expect(page.getByTestId(`dial-${index}`)).not.toHaveAttribute("aria-valuenow", String(before));
  }
  expect(await dialValue(page, index)).toBe(digit);
}

export async function setCode(page: Page, code: [number, number, number]) {
  for (let i = 0; i < 3; i++) await setDial(page, i, code[i]);
}

/**
 * 자리로 가는 움직임이 끝나 위치가 멈출 때까지 기다린 뒤 좌표를 돌려준다.
 * 이름표는 세 장면으로 끊겨 움직이므로(장면 사이에 잠깐 멈춘다), 한 번 같다고 멈춘 것으로 보지 않고
 * 네 번 연속(약 200ms) 같은 자리에 있을 때만 멈췄다고 본다.
 */
export async function settledBox(page: Page, testId: string) {
  const locator = page.getByTestId(testId);
  let previous = await locator.boundingBox();
  let still = 0;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(50);
    const current = await locator.boundingBox();
    const same = !!previous && !!current && Math.abs(current.x - previous.x) < 0.5 && Math.abs(current.y - previous.y) < 0.5;
    still = same ? still + 1 : 0;
    if (still >= 4 && current) return current;
    previous = current;
  }
  throw new Error(`${testId} 위치가 멈추지 않습니다`);
}

/** 카드를 누른 뒤 시간 슬롯을 눌러 배치한다 */
export async function placeByTap(page: Page, person: string, slot: number) {
  await page.getByTestId(`card-${person}`).click();
  await expect(page.getByTestId(`card-${person}`)).toHaveAttribute("aria-pressed", "true");
  // 빈 슬롯은 슬롯을, 찬 슬롯은 그 위의 카드를 누르게 되므로 좌표로 누른다.
  const box = await settledBox(page, `slot-${slot}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId(`slot-${slot}`)).toHaveAttribute("aria-label", /배치됨/);
}

/** 카드를 끌어서 시간 슬롯에 놓는다 */
export async function placeByDrag(page: Page, person: string, slot: number) {
  const from = await settledBox(page, `card-${person}`);
  const to = await settledBox(page, `slot-${slot}`);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 20, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
}

/** 화면이 가로로 넘치지 않고, 주 버튼이 화면 안에서 가려지지 않았는지 확인한다 */
export async function expectLayoutOk(page: Page, primarySelector: string) {
  const viewport = page.viewportSize()!;
  await page.waitForTimeout(450); // 화면 전환·진입 모션이 끝난 뒤에 잰다
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    inner: window.innerWidth,
    // 앱 안에서 화면 폭을 넘는 요소 (가로 스크롤·잘림의 원인)
    wide: [...document.querySelectorAll(".app *")]
      .filter((el): el is HTMLElement => el instanceof HTMLElement)
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        // 일부러 화면 밖으로 내보낸 장식(절대 위치)과 그 안쪽은 제외한다.
        for (let node: HTMLElement | null = el; node && !node.classList.contains("app"); node = node.parentElement) {
          const position = getComputedStyle(node).position;
          if (position === "absolute" || position === "fixed") return false;
        }
        return r.right > window.innerWidth + 1 || r.left < -1;
      })
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`)
      .slice(0, 5),
  }));
  expect(overflow.doc, "문서가 가로로 넘친다").toBeLessThanOrEqual(overflow.inner);
  expect(overflow.wide, "화면 폭을 넘는 요소가 있다").toEqual([]);

  const button = page.locator(primarySelector).first();
  await expect(button).toBeVisible();

  // 버튼 한가운데를 눌렀을 때 실제로 그 버튼이 눌리는가 (다른 요소에 가려지지 않았는가).
  // 화면 전환이 끝날 때까지는 전환 층이 위에 있으므로 잠시 기다린다.
  await expect
    .poll(
      () =>
        button.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!hit && (hit === el || el.contains(hit));
        }),
      { message: "주 버튼이 다른 요소에 가려져 있다" },
    )
    .toBe(true);

  const box = (await button.boundingBox())!;
  expect(box.y + box.height, "주 버튼이 화면 아래로 잘린다").toBeLessThanOrEqual(viewport.height);
  expect(box.x, "주 버튼이 왼쪽으로 잘린다").toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, "주 버튼이 오른쪽으로 잘린다").toBeLessThanOrEqual(viewport.width);
  expect(box.height, "주 버튼 터치 영역이 44px 보다 작다").toBeGreaterThanOrEqual(44);
}

/**
 * 화면에서 검정(#000)도 흰색(#f1f1ea)도 아닌 화소의 비율(0~1).
 * 회색·투명도·흐림을 쓰면 이 값이 커진다. 점선의 끝처럼 반 화소에 걸린 자리는 조금 남을 수 있다.
 */
export async function offToneRatio(page: Page): Promise<number> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const png = await page.screenshot({ animations: "disabled", style: ".demo { visibility: hidden !important; }" });
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let off = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const black = r < 16 && g < 16 && b < 16;
      const white = Math.abs(r - 241) < 16 && Math.abs(g - 241) < 16 && Math.abs(b - 234) < 16;
      if (!black && !white) off++;
    }
    return off / (data.length / 4);
  }, png.toString("base64"));
}
