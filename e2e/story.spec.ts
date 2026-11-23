import { expect, test, type Page } from "@playwright/test";
import { enterFromHome, expectLayoutOk, offToneRatio, preset, stored } from "./helpers";

/**
 * 사건 수사(스토리) · CASE D-001 「BJ 토끼의 마지막 방송」 제1장을 화면의 조작으로 확인한다.
 * 사건의 논리(정답이 하나인가, 근거가 받치는가)는 src/tests/story/d001.test.ts 가 따로 본다.
 */

const CHAPTER = "d001/ch1";
const chapter = async (page: Page, key = "detective-academy:v1") =>
  page.evaluate(([k, ch]) => JSON.parse(window.localStorage.getItem(k) ?? "null")?.story?.chapters?.[ch] ?? null, [key, CHAPTER] as const);

/** D급 홈에서 사건을 열어 도입까지 넘긴다 → 방송 장면 */
async function openCase(page: Page) {
  await preset(page, "promoted");
  await expect(page.getByTestId("story-entry-status")).toHaveText("새 사건");
  await enterFromHome(page, "story-entry");
  await expect(page.getByTestId("story-file")).toBeVisible();
  await expect(page.getByTestId("story-case-title")).toHaveText("BJ 토끼의 마지막 방송");
  await page.getByTestId("story-accept").click();
  await expect(page.getByTestId("story-intro")).toBeVisible();
  await page.getByTestId("story-intro-skip").click();
  await expect(page.getByTestId("stream")).toBeVisible();
}

/** 방송 화면에서 필요한 네 가지를 조사한다 → 증거 01 */
async function investigate(page: Page) {
  await page.getByTestId("point-live").click();
  await page.getByTestId("point-start").click();
  await page.getByTestId("point-length").click();
  await page.getByTestId("tick-t0700").click();
  await expect(page.getByTestId("stream")).toHaveAttribute("data-frame", "t0700");
  await page.getByTestId("point-end").click();
  await expect(page.getByTestId("evidence-gain")).toBeVisible();
  await page.getByTestId("evidence-gain-ok").click();
}

async function pickRecord(page: Page) {
  await page.getByTestId("story-next").click();
  await expect(page.getByTestId("record-A")).toBeVisible();
  await page.getByTestId("record-B").click();
  await page.getByTestId("record-confirm").click();
  await expect(page.getByTestId("evidence-gain")).toBeVisible();
  await page.getByTestId("evidence-gain-ok").click();
}

async function linkFacts(page: Page) {
  await page.getByTestId("story-next").click();
  await expect(page.getByTestId("item-a-time")).toBeVisible();
  for (const [a, b] of [
    ["a-time", "b-time"],
    ["a-length", "b-file"],
    ["a-live", "b-rule"],
  ]) {
    await page.getByTestId(`item-${a}`).click();
    await page.getByTestId(`item-${b}`).click();
    await page.getByTestId("link-items").click();
  }
  await expect(page.getByTestId("fact-count")).toHaveText("3/3");
}

async function toDeduction(page: Page) {
  await openCase(page);
  await investigate(page);
  await pickRecord(page);
  await linkFacts(page);
  await page.getByTestId("story-next").click();
  await expect(page.getByTestId("choice-scheduled")).toBeVisible();
}

async function solve(page: Page) {
  await page.getByTestId("choice-scheduled").click();
  await page.getByTestId("basis-e02").click();
  await page.getByTestId("deduce-submit").click();
  await expect(page.getByTestId("story-ending")).toBeVisible();
}

/** 홈(쿼터뷰 학원 홀)의 방 안에 놓인 곳들: 테스트 이름과 탐정이 선 곳(data-at) */
const HALL = [
  ["daily-file", "board"],
  ["practice-entry", "practice"],
  ["exam-wait", "exam"],
  ["story-entry", "case"],
  ["identity", "archive"],
] as const;

test.describe("홈의 사건 수사", () => {
  test("F급의 홈에는 사건 접수함이 없고, 주소로 열어도 홈으로 돌아간다", async ({ page }) => {
    await preset(page, "daily-unsolved");
    await expect(page.getByTestId("home-screen")).toHaveAttribute("data-at", "board");
    await expect(page.getByTestId("story-entry")).toHaveCount(0);
    await expect(page.locator(".isospot")).toHaveCount(4);
    await page.goto("/?demo=1#/story/d001");
    await expect(page.getByTestId("home-screen")).toBeVisible();
    await expect(page.getByTestId("story-screen")).toHaveCount(0);
    expect(await chapter(page)).toBeNull();
  });

  test("D급부터 사건 접수함이 놓이고, 기존 네 곳과 오늘의 추리는 그대로다", async ({ page }) => {
    await preset(page, "promoted");
    await expect(page.locator(".isospot")).toHaveCount(5);
    for (const [id] of HALL) await expect(page.getByTestId(id)).toBeVisible();
    // 들어서면 탐정이 가는 곳(오늘 할 일)은 사건이 아니다: 사건이 생겨도 주 동선은 바뀌지 않는다
    await expect(page.getByTestId("home-screen")).toHaveAttribute("data-at", "practice");
    await expect(page.getByTestId("story-entry")).toHaveAttribute("data-primary", "false");
    await expect(page.getByTestId("practice-entry")).toHaveAttribute("data-primary", "true");
    await enterFromHome(page, "story-entry");
    await expect(page.getByTestId("story-file")).toBeVisible();
    await page.getByTestId("story-back").click();
    await expect(page.getByTestId("home-screen")).toBeVisible();
    // 사건을 수락하기 전에는 기록이 남지 않는다
    await expect(page.getByTestId("story-entry-status")).toHaveText("새 사건");
  });

  test("방 안의 사건 접수함(텔레비전)을 누르면 걸어가 살펴보고, 한 번 더 누르면 들어간다", async ({ page }) => {
    await preset(page, "promoted");
    const home = page.getByTestId("home-screen");
    await expect(home).toHaveAttribute("data-at", "practice");
    // 텔레비전을 손가락으로 누른다: 들어가지 않고 그 앞에서 살펴본다
    await page.getByTestId("story-entry").tap();
    await expect(home).toHaveAttribute("data-at", "case");
    await expect(page.getByTestId("story-entry")).toHaveAttribute("data-on", "true");
    await expect(page.getByTestId("narration")).toContainText("텔레비전");
    await expect(page.getByTestId("story-entry-go")).toHaveText("사건 파일 열기");
    await expect(page.getByTestId("story-file")).toHaveCount(0);
    // 같은 물건을 한 번 더 누르면 들어간다
    await page.getByTestId("story-entry").tap();
    await expect(page.getByTestId("story-file")).toBeVisible();
  });
});

test.describe("제1장 · 마지막 7분", () => {
  test("방송 조사 → 전송 기록 → 증거 분석 → 최종 추론 → 끝 장면 → 사건 기록까지 플레이한다", async ({ page }) => {
    await openCase(page);
    const before = await stored(page);

    // SCENE 01: 필요한 네 가지를 조사해야 다음으로 갈 수 있다
    await expect(page.getByTestId("story-next")).toBeDisabled();
    await expect(page.getByTestId("broadcast-tally")).toContainText("0/4");
    for (const id of ["log", "analysis", "deduction"]) await expect(page.getByTestId(`step-${id}`)).toBeDisabled();
    await page.getByTestId("point-live").click();
    await expect(page.getByTestId("narration")).toContainText("LIVE 표시");
    await expect(page.getByTestId("broadcast-tally")).toContainText("1/4");
    // 타임라인: 시점을 옮기면 화면이 바뀌고, 그 시점에만 있는 것을 조사할 수 있다
    await page.getByTestId("timeline-next").click();
    await expect(page.getByTestId("stream")).toHaveAttribute("data-frame", "t0310");
    await expect(page.getByTestId("timeline-now")).toHaveText("03:10");
    await expect(page.getByTestId("point-start")).toHaveCount(0);
    await page.getByTestId("timeline-prev").click();
    await page.getByTestId("point-start").click();
    await page.getByTestId("point-mask").click(); // 필요하지 않은 조사: 수사 노트에만 적힌다
    await expect(page.getByTestId("broadcast-tally")).toContainText("2/4");
    await page.getByTestId("point-length").click();
    await page.getByTestId("tick-t0700").click();
    await page.getByTestId("point-end").click();
    await expect(page.getByTestId("evidence-gain")).toContainText("마지막 방송 기록");
    await expect(page.getByTestId("evidence-e01")).toContainText("23:47");
    await page.getByTestId("evidence-gain-ok").click();
    await expect(page.getByTestId("story-next")).toBeEnabled();

    // 수사 노트는 언제든 펼쳐 본다
    await page.getByTestId("notebook-open").click();
    await expect(page.getByTestId("notebook")).toContainText("가면 때문에 얼굴은");
    await expect(page.getByTestId("notebook").getByTestId("evidence-e01")).toBeVisible();
    await page.getByTestId("notebook-close").click();

    // SCENE 02: 틀린 기록을 고르면 그 까닭을 듣고 다시 고른다
    await page.getByTestId("story-next").click();
    await expect(page.getByTestId("platform-rules")).toContainText("LIVE 표시는");
    await page.getByTestId("record-C").click();
    await page.getByTestId("record-confirm").click();
    await expect(page.getByTestId("record-wrong")).toContainText("23:48");
    await expect(page.getByTestId("record-file")).toHaveCount(0);
    await page.getByTestId("record-A").click();
    await page.getByTestId("record-confirm").click();
    await expect(page.getByTestId("record-wrong")).toContainText("21:47");
    await page.getByTestId("record-B").click();
    await page.getByTestId("record-confirm").click();
    await expect(page.getByTestId("evidence-gain")).toContainText("TORI_FINAL_07.mp4");
    await page.getByTestId("evidence-gain-ok").click();
    await expect(page.getByTestId("record-file")).toContainText("18:20");

    // SCENE 03: 맞대어 나오는 것이 없으면 까닭을 듣고, 사실 셋을 직접 확정해야 결론으로 간다
    await page.getByTestId("story-next").click();
    await expect(page.getByTestId("story-next")).toHaveCount(0);
    await page.getByTestId("item-a-time").click();
    await page.getByTestId("item-b-fail").click();
    await page.getByTestId("link-items").click();
    await expect(page.getByTestId("link-status")).toContainText("끊겼다");
    await expect(page.getByTestId("fact-count")).toHaveText("0/3");
    await page.getByTestId("item-b-fail").click(); // 고른 것을 한 번 더 누르면 내려놓는다
    await page.getByTestId("item-b-time").click();
    await page.getByTestId("link-items").click();
    await expect(page.getByTestId("fact-f01")).toContainText("전송 B");
    for (const [a, b] of [
      ["a-length", "b-file"],
      ["a-live", "b-rule"],
    ]) {
      await page.getByTestId(`item-${a}`).click();
      await page.getByTestId(`item-${b}`).click();
      await page.getByTestId("link-items").click();
    }
    await expect(page.getByTestId("fact-count")).toHaveText("3/3");

    // SCENE 04: 결론과 근거를 함께 본다
    await page.getByTestId("story-next").click();
    await page.getByTestId("deduce-submit").click();
    await expect(page.getByTestId("deduce-notice")).toContainText("고르세요");
    await page.getByTestId("choice-dead").click();
    await page.getByTestId("basis-e03").click();
    await page.getByTestId("deduce-submit").click();
    await expect(page.getByTestId("deduce-notice")).toContainText("생사");
    await page.getByTestId("choice-manager").click();
    await page.getByTestId("deduce-submit").click();
    await expect(page.getByTestId("deduce-notice")).toContainText("누가 영상을 예약했는지");
    // 결론이 맞아도 근거가 받치지 못하면 통과하지 못한다
    await page.getByTestId("choice-scheduled").click();
    await page.getByTestId("basis-e01").click();
    await page.getByTestId("deduce-submit").click();
    await expect(page.getByTestId("deduce-notice")).toContainText("근거가 약합니다");
    await expect(page.getByTestId("story-ending")).toHaveCount(0);
    expect((await chapter(page)).status).toBe("in_progress");
    expect((await chapter(page)).wrong).toBe(5); // 틀린 기록 둘 + 틀린 결론 둘 + 약한 근거 하나
    await page.getByTestId("deduce-review").click();
    await expect(page.getByTestId("notebook")).toBeVisible();
    await page.getByTestId("notebook-close").click();
    await page.getByTestId("basis-e03").click();
    await page.getByTestId("deduce-submit").click();

    // 끝 장면: LIVE 표시가 꺼진 자리에 "예약 영상"이 찍힌다
    await expect(page.getByTestId("story-ending")).toBeVisible();
    await expect(page.getByTestId("ending-label")).toHaveText("예약 영상", { timeout: 6_000 });
    await page.getByTestId("ending-skip").click();
    const result = page.getByTestId("story-result");
    await expect(result).toContainText("CHAPTER 01 CLEARED");
    await expect(result).toContainText("마지막 7분");
    await expect(page.getByTestId("result-records")).toHaveText("3개 확인");
    await expect(page.getByTestId("result-reward")).toHaveText("+120");
    await expect(result).toContainText("그렇다면 이 영상을 예약한 사람은 누구인가?");
    // 다음 장은 제목만 적힌다: 들어가는 단추는 없다
    await expect(page.getByTestId("result-next")).toContainText("제2장 · 사라진 원본");
    await expect(page.getByRole("button", { name: /제2장|사라진 원본|다음 장/ })).toHaveCount(0);

    const after = await stored(page);
    expect(after.credits).toBe(before.credits + 120);
    // 사건 해결은 등급과 승급 시험의 응시 조건을 바꾸지 않는다
    expect(after.rank).toBe(before.rank);
    expect(after.progress).toEqual(before.progress);
    expect(after.exam).toEqual(before.exam);

    await page.getByTestId("result-record").click();
    const record = page.getByTestId("story-record");
    await expect(record).toBeVisible();
    await expect(page.getByTestId("record-conclusion")).toContainText("예약 송출");
    await expect(page.getByTestId("record-open")).toContainText("살아 있는가");
    await expect(page.getByTestId("record-open")).toContainText("예약한 사람은 누구인가");
    await expect(record.getByTestId("evidence-e04")).toContainText("운영팀 공용 계정");
    await expect(page.getByRole("button", { name: /제2장|사라진 원본|다음 장/ })).toHaveCount(0);

    await page.getByTestId("story-back").click();
    await expect(page.getByTestId("story-entry-status")).toHaveText("1장 해결");
    await expect(page.getByTestId("credit-balance")).toHaveAttribute("aria-label", `보유 수사 크레딧 ${before.credits + 120}`);
    // 승급 시험의 응시 조건은 그대로다
    await expect(page.getByTestId("exam-wait")).toBeVisible();
  });

  test("해결한 뒤 다시 들어오면 사건 기록이 열리고, 장면을 다시 봐도 보상은 한 번뿐이다", async ({ page }) => {
    await toDeduction(page);
    await solve(page);
    await page.getByTestId("ending-skip").click();
    await page.getByTestId("result-home").click();
    await expect(page.getByTestId("home-screen")).toBeVisible();
    const credits = (await stored(page)).credits;

    await enterFromHome(page, "story-entry");
    await expect(page.getByTestId("story-record")).toBeVisible();
    await page.getByTestId("record-replay").click();
    await expect(page.getByTestId("stream")).toBeVisible();
    // 해결한 뒤에는 모든 장면이 열려 있다
    await page.getByTestId("step-deduction").click();
    await expect(page.getByTestId("deduce-seal")).toBeVisible();
    await expect(page.getByTestId("choice-dead")).toBeDisabled();
    await page.getByTestId("story-next").click();
    await expect(page.getByTestId("story-ending")).toBeVisible();
    await page.getByTestId("ending-skip").click();
    await expect(page.getByTestId("result-reward")).toHaveText("+120 받음");
    await page.getByTestId("result-record").click();
    await expect(page.getByTestId("story-record")).toBeVisible();
    expect((await stored(page)).credits).toBe(credits);
    // 뒤로 단추: 장면에서는 사건 기록으로, 사건 기록에서는 복도로
    await page.getByTestId("record-replay").click();
    await page.getByTestId("story-back").click();
    await expect(page.getByTestId("story-record")).toBeVisible();
    await page.getByTestId("story-back").click();
    await expect(page.getByTestId("home-screen")).toBeVisible();
  });

  test("도중에 나갔다 와도 있던 장면에서 잇고, 도입은 다시 나오지 않는다", async ({ page }) => {
    await openCase(page);
    await page.getByTestId("point-live").click();
    await page.getByTestId("point-chat").click();
    await page.reload();
    await expect(page.getByTestId("stream")).toBeVisible();
    await expect(page.getByTestId("story-intro")).toHaveCount(0);
    await expect(page.getByTestId("broadcast-tally")).toContainText("1/4");
    await expect(page.getByTestId("point-live")).toHaveAttribute("data-noted", "true");

    await page.getByTestId("point-start").click();
    await page.getByTestId("point-length").click();
    await page.getByTestId("tick-t0700").click();
    await page.getByTestId("point-end").click();
    await page.getByTestId("evidence-gain-ok").click();
    await pickRecord(page);
    await page.getByTestId("story-back").click();
    await expect(page.getByTestId("story-entry-status")).toHaveText("수사 중");
    await enterFromHome(page, "story-entry");
    // 전송 기록 장면에서 잇는다: 고른 기록과 원본 파일이 그대로 있다
    await expect(page.getByTestId("record-file")).toBeVisible();
    await expect(page.getByTestId("record-B")).toHaveAttribute("data-picked", "true");
    // 이미 본 장면으로 곧바로 돌아간다
    await page.getByTestId("step-broadcast").click();
    await expect(page.getByTestId("stream")).toBeVisible();
    await expect(page.getByTestId("story-next")).toBeEnabled();
    await expect(page.getByTestId("step-analysis")).toBeEnabled();
    await expect(page.getByTestId("step-deduction")).toBeDisabled();
  });

  test("수사 지원은 수사 크레딧으로 열고, 모자라면 열리지 않는다", async ({ page }) => {
    await openCase(page);
    const credits = (await stored(page)).credits;
    await page.getByTestId("story-hint-button").click();
    await expect(page.getByTestId("story-hints")).toBeVisible();
    await page.getByTestId("story-hint-1-open").click();
    await expect(page.getByTestId("story-hint-1")).toContainText("전송 기록 세 줄");
    expect((await stored(page)).credits).toBe(credits - 20);
    await page.getByTestId("story-hint-2-open").click();
    await expect(page.getByTestId("story-hint-2")).toContainText("전송 방식");
    expect((await stored(page)).credits).toBe(credits - 60);
    expect((await chapter(page)).hintsUsed).toBe(2);
  });

  test("모션 줄이기 설정에서도 끝까지 간다 (연출 없이 결과가 바로 나온다)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await toDeduction(page);
    await solve(page);
    await expect(page.getByTestId("story-result")).toBeVisible();
    await expect(page.getByTestId("result-reward")).toHaveText("+120");
  });

  test("끝 장면은 화면을 눌러 넘긴다: 끝 글 두 줄, 새 기록, 결과", async ({ page }) => {
    await toDeduction(page);
    await solve(page);
    const next = page.getByTestId("ending-next");
    await next.click(); // 테이프 → 끝 글
    await next.click(); // 첫 줄을 다 찍는다
    await expect(next).toContainText("그날 밤 방송은 생방송이 아니었다.");
    await next.click(); // 둘째 줄
    await next.click(); // 둘째 줄을 다 찍는다
    await expect(next).toContainText("그렇다면 이 영상을 예약한 사람은 누구인가?");
    await next.click(); // 새 기록
    await expect(page.getByTestId("evidence-e04")).toContainText("등록 기록 없음");
    await next.click();
    await expect(page.getByTestId("story-result")).toBeVisible();
  });
});

test.describe("QA · 사건 바로 열기", () => {
  test("등급과 상관없이 별도 저장 칸에서 열리고, 실제 기록은 그대로다", async ({ page }) => {
    await preset(page, "daily-unsolved"); // 실제 기록: F급
    const real = await stored(page);
    await page.getByTestId("demo-toggle").click();
    await page.getByTestId("demo-story-d001").click();
    await expect(page.getByTestId("story-file")).toBeVisible();
    expect(page.url()).toContain("save=qa-story");
    await page.getByTestId("story-accept").click();
    await page.getByTestId("story-intro-skip").click();
    await page.getByTestId("point-live").click();
    expect((await chapter(page, "detective-academy:v1:qa-story")).notes).toEqual(["live"]);
    // 실제 기록에는 아무것도 남지 않았다
    expect(await stored(page)).toEqual(real);
    await page.getByTestId("demo-toggle").click();
    await expect(page.getByTestId("demo-slot")).toContainText("실제 기록과 분리됨");
    await page.getByTestId("demo-real-save").click();
    await expect(page.getByTestId("home-screen")).toBeVisible();
    await expect(page.getByTestId("home-rank")).toContainText("F급");
    await expect(page.getByTestId("story-entry")).toHaveCount(0);
  });
});

test("사건 화면은 두 가지 색으로만 그려진다", async ({ page }) => {
  const check = async (name: string) => {
    await page.waitForTimeout(500);
    expect(await offToneRatio(page), `${name}: 두 색이 아닌 화소가 너무 많다`).toBeLessThan(0.005);
  };
  await preset(page, "promoted");
  await enterFromHome(page, "story-entry");
  await expect(page.getByTestId("story-file")).toBeVisible();
  await check("사건 접수");
  await page.getByTestId("story-accept").click();
  await check("도입");
  await page.getByTestId("story-intro-skip").click();
  await expect(page.getByTestId("stream")).toBeVisible();
  await check("방송 화면");
  await page.getByTestId("timeline-next").click();
  await check("방송 화면 03:10");
  await page.getByTestId("tick-t0640").click();
  await check("방송 화면 06:40");
  await page.getByTestId("tick-t0015").click();
  await investigate(page);
  await check("방송 화면 종료");
  await pickRecord(page);
  await check("전송 기록");
  await linkFacts(page);
  await check("증거 분석");
  await page.getByTestId("story-next").click();
  await page.getByTestId("choice-dead").click();
  await page.getByTestId("basis-e01").click();
  await page.getByTestId("deduce-submit").click();
  await check("최종 추론 · 알림");
  await solve(page);
  await check("끝 장면");
  await page.getByTestId("ending-skip").click();
  await check("결과");
  await page.getByTestId("result-record").click();
  await check("사건 기록");
  await page.getByTestId("story-back").click();
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await enterFromHome(page, "story-entry");
  await check("홈에서 다시");
});

for (const size of [
  { width: 390, height: 664 },
  { width: 375, height: 629 },
  { width: 430, height: 932 },
]) {
  test.describe(`${size.width}×${size.height}`, () => {
    test.use({ viewport: size });

    test("홈: 사건 접수함까지 다섯 곳이 방 안에서 눌리고, 접수함을 고른 아래 창이 화면 안에 있다", async ({ page }) => {
      // 홈의 배치를 크기별로 샅샅이 보는 것은 iso.spec.ts 다. 여기서는 사건 접수함이 더해진 D급의 홈만 본다.
      await preset(page, "promoted");
      const home = page.getByTestId("home-screen");
      await expect(home).toHaveAttribute("data-at", "practice");
      const stage = (await page.getByTestId("iso-stage").boundingBox())!;
      for (const [id] of HALL) {
        const box = (await page.getByTestId(id).boundingBox())!;
        expect(box.width, `${id} 의 터치 영역이 좁다`).toBeGreaterThanOrEqual(44);
        expect(box.height, `${id} 의 터치 영역이 낮다`).toBeGreaterThanOrEqual(44);
        expect(box.y + box.height / 2, `${id} 가 방 아래로 잘린다`).toBeLessThan(stage.y + stage.height);
        expect(box.x + box.width / 2, `${id} 가 화면 오른쪽으로 잘린다`).toBeLessThan(size.width);
        expect(box.x + box.width / 2, `${id} 가 화면 왼쪽으로 잘린다`).toBeGreaterThan(0);
      }
      const overflow = () => home.evaluate((el) => el.scrollHeight - el.clientHeight);
      expect(await overflow()).toBeLessThanOrEqual(0);
      await page.getByTestId("story-entry").tap();
      await expect(home).toHaveAttribute("data-at", "case");
      await expectLayoutOk(page, '[data-testid="story-entry-go"]');
      expect(await overflow(), "접수함을 골랐을 때 홈이 세로로 넘친다").toBeLessThanOrEqual(0);
    });

    test("사건: 장면마다 주 단추가 화면 안에 있고, 조사할 곳은 손가락에 맞는다", async ({ page }) => {
      const noScroll = async (name: string) =>
        expect(
          await page.evaluate(() => {
            const el = document.querySelector(".story__scroll");
            return el ? el.scrollHeight - el.clientHeight : 0;
          }),
          `${name}: 세로로 넘친다`,
        ).toBeLessThanOrEqual(0);

      await openCase(page);
      await expectLayoutOk(page, '[data-testid="timeline-next"]');
      // 방송 화면은 점 하나 2px 그대로(328×184), 조사할 곳은 높이 44px 이상
      const screen = (await page.getByTestId("stream").boundingBox())!;
      expect([screen.width, screen.height]).toEqual([328, 184]);
      for (const id of ["point-live", "point-start", "point-mask", "point-title", "point-chat", "point-length"]) {
        const box = (await page.getByTestId(id).boundingBox())!;
        expect(box.height, `${id} 의 터치 영역이 낮다`).toBeGreaterThanOrEqual(id === "point-length" ? 28 : 44);
        expect(box.y + box.height, `${id} 가 화면 아래로 잘린다`).toBeLessThanOrEqual(size.height);
      }
      // 조사할 곳이 아래 단추 줄에 가려지지 않는다
      const foot = (await page.locator(".deskfoot").boundingBox())!;
      const track = (await page.getByTestId("timeline").boundingBox())!;
      expect(track.y + track.height).toBeLessThanOrEqual(foot.y);
      expect(foot.y + foot.height).toBeLessThanOrEqual(size.height);

      await investigate(page);
      await expectLayoutOk(page, '[data-testid="story-next"]');
      await page.getByTestId("story-next").click();
      await expect(page.getByTestId("record-A")).toBeVisible();
      await expectLayoutOk(page, '[data-testid="record-C"]');
      await noScroll("전송 기록");
      await page.getByTestId("record-B").click();
      await page.getByTestId("record-confirm").click();
      await page.getByTestId("evidence-gain-ok").click();
      await noScroll("전송 기록 · 원본 파일");
      await linkFacts(page);
      await expectLayoutOk(page, '[data-testid="story-next"]');
      await noScroll("증거 분석 · 사실 셋");
      await page.getByTestId("story-next").click();
      await expectLayoutOk(page, '[data-testid="deduce-submit"]');
      await noScroll("최종 추론");
      await solve(page);
      await page.getByTestId("ending-skip").click();
      await expectLayoutOk(page, '[data-testid="result-home"]');
      const result = (await page.getByTestId("story-result").boundingBox())!;
      const next = (await page.getByTestId("result-next").boundingBox())!;
      expect(next.y + next.height, "결과의 다음 장 제목이 화면 밖이다").toBeLessThanOrEqual(result.y + result.height);
    });
  });
}
