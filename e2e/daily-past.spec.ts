import { expect, test, type Page } from "@playwright/test";
import { DAILY_CALENDAR, PUZZLE_BY_ID } from "../src/data/puzzles";
import { enterFromHome, expectLayoutOk, offToneRatio, preset, shot, stored, TEST_DATE, toDesk, toSafe } from "./helpers";
import { solve, submitWrong } from "./solve";

/**
 * 오늘의 추리의 날짜 정책 (V3 RELEASE 지시서 3절 · 16절).
 * - 달력(14일)이 끝난 날: 첫 문제가 다시 붙지 않는다. 게시판은 "새 사건 준비 중"과 지난 사건 다시 보기를 내놓는다.
 * - 지난 사건: 오늘까지 붙었던 문제의 목록. 풀지 못한 사건은 처음 해결 보상을 한 번 받고, 푼 사건은 보상 없이 다시 본다.
 * - 자정: 푸는 중에 날짜가 넘어가도 풀던 문제가 갈리지 않는다.
 * - 직접 접근: 없는 문제 · 오지 않은 날의 문제 · 잠긴 과제 · 없는 주소는 안전하게 돌려보낸다. 뒤로 가기.
 * 날짜별 배정표와 보상 규칙은 단위 테스트(src/tests/daily-calendar.test.ts)가 엔진으로 따로 본다.
 */

/** 달력이 끝난 다음 날 */
const AFTER = "2026-12-06";

const SIZES = [
  [390, 844],
  [390, 664],
  [375, 629],
] as const;

/** 게임 날짜를 옮긴다(저장소의 값. 앱은 "지금"을 읽을 때마다 이 값을 본다) */
const setDate = (page: Page, date: string) => page.evaluate((d) => window.localStorage.setItem("detective-academy:date", d), date);

const pastScreen = (page: Page) => page.getByTestId("past-screen");
const row = (page: Page, id: string) => page.getByTestId(`past-file-${id}`);
const board = (page: Page) => page.locator('.isocard[data-spot="board"]');

/** 화면에서 난 오류를 모은다 */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** 오늘 할 일(홈의 data-next)마다 탐정이 들어서서 가 서는 곳 */
const REST: Record<string, string> = { daily: "board", practice: "practice", exam: "exam" };

/**
 * 홈에서 게시판 앞으로 간다. 들어서면 탐정이 오늘 할 일 앞으로 걸어가 서므로, 그 걸음이 끝난 뒤에 게시판을 고른다
 * (걷는 중에 고르면 프리셋을 막 바꾼 직후의 걸음과 엇갈린다. 게시판 앞에 선 채로 한 번 더 누르면 들어가 버린다).
 */
async function toBoard(page: Page) {
  const home = page.getByTestId("home-screen");
  await expect(home).toBeVisible();
  const rest = REST[(await home.getAttribute("data-next")) ?? ""];
  if (rest) await expect(home).toHaveAttribute("data-at", rest);
  if (rest !== "board") await page.getByTestId("daily-file").click();
  await expect(home).toHaveAttribute("data-at", "board");
  await expect(page.getByTestId("daily-file-cta")).toBeVisible();
}

test.describe("달력이 끝난 날", () => {
  test("게시판은 새 사건을 준비 중이라고 알리고, 첫 문제를 다시 붙이지 않는다", async ({ page }) => {
    const errors = watchErrors(page);
    // 11월 22일에 첫날 문제를 풀어 둔 사용자가 12월 6일에 돌아왔다
    await preset(page, "daily-solved");
    const before = await stored(page);
    expect(before.puzzles["daily-code-001"].status).toBe("solved");
    await setDate(page, AFTER);
    await page.goto("/?demo=1");

    const home = page.getByTestId("home-screen");
    await expect(home).toBeVisible();
    // 오늘 할 일은 오늘의 추리가 아니다(없다): 연습실로 넘어간다
    await expect(home).toHaveAttribute("data-next", "practice");
    await expect(page.getByTestId("daily-file-status")).toHaveText("준비 중");
    await expect(page.getByTestId("daily-file")).toHaveAttribute("aria-label", "시험 게시판, 오늘의 추리 [준비 중]");

    await toBoard(page);
    await expect(board(page)).toContainText("새 사건 준비 중");
    await expect(page.getByTestId("daily-past-count")).toHaveText("지난 사건 1/14 해결");
    // 풀었던 첫 문제가 새 문제처럼 다시 붙지 않는다(예전에는 열닷새째에 '자료실 금고의 암호'가 돌아왔다)
    await expect(board(page)).not.toContainText("자료실 금고의 암호");
    await expect(board(page)).not.toContainText("미해결");
    await expect(page.getByTestId("narration")).toContainText("새 사건은 아직 붙지 않았다");
    await expect(page.getByTestId("daily-file-cta")).toHaveText("지난 사건 다시 보기");
    await shot(page, "past-01-home-exhausted");

    // 큰 단추는 지난 사건으로 간다
    await page.getByTestId("daily-file-cta").click();
    await expect(page).toHaveURL(/#\/daily\/past$/);
    await expect(pastScreen(page)).toBeVisible();
    await expect(page.getByTestId("past-note")).toContainText("새 사건을 준비하고 있습니다");
    await expect(page.locator(".dailypast__list .isotask")).toHaveCount(14);
    await expect(page.getByTestId("past-total")).toHaveText("해결 1/14");
    // 최근 것이 위다. 오늘(12월 6일)에 붙은 줄은 없다.
    await expect(page.locator(".dailypast__list .isotask").first()).toHaveAttribute("data-testid", "past-file-daily-schedule-003");
    await expect(page.locator(".dailypast__list .isotask").last()).toHaveAttribute("data-testid", "past-file-daily-code-001");
    await expect(page.locator(".dailypast__list .isotask__flag")).toHaveCount(0);
    await expect(page.getByTestId("past-date-daily-schedule-003")).toHaveText("12월 5일");
    await expect(page.getByTestId("past-date-daily-code-001")).toHaveText("11월 22일");
    await expect(page.getByTestId("past-status-daily-code-001")).toHaveText("해결");
    await expect(page.getByTestId("past-status-daily-schedule-003")).toHaveText("미해결 +60");
    await shot(page, "past-02-list-exhausted");

    // 크레딧과 기록은 날짜가 지나도 그대로다
    const after = await stored(page);
    expect(after.credits).toBe(before.credits);
    expect(after.puzzles).toEqual(before.puzzles);
    expect(errors).toEqual([]);
  });

  test("주소(#/daily)로 바로 와도 문제를 열지 않고 지난 사건으로 돌려보낸다. 신분증과 결과의 다음 할 일도 안전하다", async ({ page }) => {
    const errors = watchErrors(page);
    await preset(page, "exam-ready", `&date=${AFTER}`);
    await page.goto(`/?demo=1&date=${AFTER}#/daily`);
    await expect(pastScreen(page)).toBeVisible();
    await expect(page).toHaveURL(/#\/daily\/past$/);
    await expect(page.getByTestId("play-screen")).toHaveCount(0);

    // 신분증의 수사 기록: 오늘의 추리 줄은 준비 중이고, 지난 사건으로 가는 단추가 있다
    await page.goto(`/?demo=1&date=${AFTER}#/profile`);
    await expect(page.getByTestId("record-daily")).toContainText("새 사건 준비 중");
    await expect(page.getByTestId("record-daily")).toHaveAttribute("data-status", "new");
    await page.getByTestId("record-past").click();
    await expect(pastScreen(page)).toBeVisible();

    // 지난 사건을 하나 풀면 결과의 다음 할 일은 오늘의 추리가 아니라 시험이다(오늘의 추리가 없는 날)
    await row(page, "daily-code-001").click();
    await solve(page, PUZZLE_BY_ID["daily-code-001"]);
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await expect(page.getByTestId("result-next")).toHaveText("승급 시험 응시");
    expect(errors).toEqual([]);
  });
});

test.describe("지난 사건", () => {
  test("풀지 못한 사건은 처음 해결 보상을 한 번 받고, 푼 사건은 보상 없이 다시 본다. 새로고침해도 다시 지급되지 않는다", async ({ page }) => {
    test.slow();
    const errors = watchErrors(page);
    await preset(page, "daily-solved");
    expect((await stored(page)).credits).toBe(100);
    await setDate(page, AFTER);
    await page.goto("/?demo=1");
    await enterFromHome(page, "daily-file");
    await expect(pastScreen(page)).toBeVisible();

    /* ── 이미 푼 사건: 채점 기록을 보고, 보상 없이 다시 푼다 ── */
    await row(page, "daily-code-001").click();
    await expect(page).toHaveURL(/#\/daily\/past\/daily-code-001$/);
    const result = page.getByTestId("result-screen");
    await expect(result).toHaveAttribute("data-fresh", "false");
    await expect(page.getByTestId("result-lead")).toContainText("11월 22일에 해결한");
    await expect(page.getByTestId("reward-claimed")).toContainText("수령 완료");
    await expect(page.getByTestId("reward")).toHaveCount(0);
    await page.getByTestId("replay").click();
    await expect(page.getByTestId("play-title")).toContainText("다시 풀기");
    await solve(page, PUZZLE_BY_ID["daily-code-001"]);
    await expect(result).toHaveAttribute("data-fresh", "true");
    await expect(page.getByTestId("result-lead")).toContainText("보상은 처음 해결했을 때 한 번만");
    await expect(page.getByTestId("reward")).toHaveCount(0);
    let saved = await stored(page);
    expect(saved.credits).toBe(100);
    // 기록은 처음 해결한 날의 것 그대로다
    expect(saved.puzzles["daily-code-001"]).toMatchObject({ solvedDateKey: TEST_DATE, solvedAttempts: 1 });
    // 결과에서는 지난 사건의 목록으로 돌아간다
    await expect(page.getByTestId("result-home")).toHaveText("지난 사건");
    await page.getByTestId("result-home").click();
    await expect(pastScreen(page)).toBeVisible();
    await expect(page).toHaveURL(/#\/daily\/past$/);

    /* ── 풀지 못하고 지나간 사건(11월 25일): 한 번 틀리고 맞힌다. 처음 해결 보상 +60 ── */
    const missed = PUZZLE_BY_ID["daily-code-002"];
    await expect(page.getByTestId(`past-status-${missed.id}`)).toHaveText("미해결 +60");
    await row(page, missed.id).click();
    await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", "code");
    await submitWrong(page, missed);
    await expect(page.getByTestId("notice-wrong")).toBeVisible();
    expect((await stored(page)).credits).toBe(100);
    await solve(page, missed);
    await expect(result).toHaveAttribute("data-fresh", "true");
    await expect(page.getByTestId("reward")).toContainText("+60");
    saved = await stored(page);
    expect(saved.credits).toBe(160);
    // 해결한 날은 붙었던 날(11월 25일)이 아니라 실제로 푼 날이다
    expect(saved.puzzles[missed.id]).toMatchObject({ status: "solved", rewardClaimed: true, solvedAttempts: 2, solvedDateKey: AFTER });
    await shot(page, "past-03-result-first-solve");

    /* ── 새로고침: 같은 주소에서 채점 기록으로 열리고, 보상은 다시 나오지 않는다 ── */
    await page.reload();
    await expect(result).toHaveAttribute("data-fresh", "false");
    await expect(page.getByTestId("reward-claimed")).toBeVisible();
    await expect(page.getByTestId("reward")).toHaveCount(0);
    expect((await stored(page)).credits).toBe(160);
    await page.getByTestId("replay").click();
    await solve(page, missed);
    await expect(page.getByTestId("result-lead")).toContainText("보상은 처음 해결했을 때 한 번만");
    expect((await stored(page)).credits).toBe(160);

    // 목록과 홈에 반영된다
    await page.getByTestId("result-home").click();
    await expect(page.getByTestId(`past-status-${missed.id}`)).toHaveText("해결");
    await expect(page.getByTestId("past-total")).toHaveText("해결 2/14");
    await page.getByTestId("past-back").click();
    await expect(page.getByTestId("credit-balance")).toHaveText("160");
    expect(errors).toEqual([]);
  });

  test("풀다 만 사건은 풀이 중으로 남아, 날이 지난 뒤 지난 사건에서 이어 푼다", async ({ page }) => {
    await preset(page, "daily-unsolved");
    await enterFromHome(page, "daily-file");
    await expect(page.getByTestId("play-screen")).toBeVisible();
    await page.getByTestId("memo-5").click();
    await submitWrong(page, PUZZLE_BY_ID["daily-code-001"]);
    await expect(page.getByTestId("notice-wrong")).toBeVisible();

    // 이틀 뒤(11월 24일)에 돌아왔다: 오늘의 추리는 다른 문제이고, 그제의 문제는 지난 사건에 풀이 중으로 남아 있다
    await setDate(page, "2026-11-24");
    await page.goto("/?demo=1");
    await expect(board(page)).toContainText("추천서의 인장");
    await page.goto("/?demo=1#/daily/past");
    await expect(page.locator(".dailypast__list .isotask")).toHaveCount(3);
    await expect(page.getByTestId("past-note")).toContainText("풀지 못한 사건은 지금 풀어도 보상을 받습니다");
    // 오늘의 줄에는 꼬리표가 붙는다
    await expect(row(page, "daily-seal-001").locator(".isotask__flag")).toHaveText("오늘");
    await expect(page.locator(".dailypast__list .isotask__flag")).toHaveCount(1);
    await expect(page.getByTestId("past-status-daily-code-001")).toHaveText("풀이 중");
    await expect(row(page, "daily-code-001")).toHaveAttribute("aria-label", /11월 22일, 자료실 금고의 암호, 암호 해독, 풀이 중/);
    await expect(page.getByTestId("past-status-daily-evidence-001")).toHaveText("미해결 +60");

    // 이어서 풀면 메모와 제출 횟수가 그대로다
    await row(page, "daily-code-001").click();
    await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", "code");
    // 마지막에 선 곳(금고 앞)에서 잇는다. 책상으로 가면 지워 둔 숫자가 남아 있다.
    await toDesk(page);
    await expect(page.getByTestId("memo-5")).toHaveAttribute("data-state", "out");
    await solve(page, PUZZLE_BY_ID["daily-code-001"]);
    await expect(page.getByTestId("reward")).toContainText("+60");
    const saved = await stored(page);
    expect(saved.puzzles["daily-code-001"]).toMatchObject({ status: "solved", solvedAttempts: 2, solvedDateKey: "2026-11-24" });
    expect(saved.credits).toBe(100);
    // 오늘의 추리가 남아 있으니 다음 할 일은 그것이다
    await expect(page.getByTestId("result-next")).toHaveText("오늘의 추리 풀기");
    await page.getByTestId("result-next").click();
    await expect(page).toHaveURL(/#\/daily$/);
    await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", "spatial");
  });

  test("오늘 문제를 푼 날의 게시판에는 채점 기록 옆에 지난 사건으로 가는 단추가 있다(첫날에는 없다)", async ({ page }) => {
    // 첫날(지난 사건이 오늘 것뿐이다): 단추는 하나다
    await preset(page, "daily-solved");
    await toBoard(page);
    await expect(page.getByTestId("daily-file-cta")).toHaveText("채점 기록 보기");
    await expect(page.getByTestId("daily-past-cta")).toHaveCount(0);

    // 11월 25일: 그날 문제를 푼 상태. 채점 기록 옆에 지난 사건.
    await preset(page, "daily-solved", "&date=2026-11-25");
    await toBoard(page);
    await expect(page.getByTestId("daily-file-status")).toHaveText("해결");
    await expect(page.getByTestId("daily-file-cta")).toHaveText("채점 기록 보기");
    await page.getByTestId("daily-past-cta").click();
    await expect(pastScreen(page)).toBeVisible();
    await expect(page.locator(".dailypast__list .isotask")).toHaveCount(4);
    await expect(page.getByTestId("past-total")).toHaveText("해결 1/4");
    // 채점 기록 보기는 여전히 오늘의 문제로 간다
    await page.goBack();
    await toBoard(page);
    await page.getByTestId("daily-file-cta").click();
    await expect(page).toHaveURL(/#\/daily$/);
    await expect(page.getByTestId("result-screen")).toHaveAttribute("data-fresh", "false");
  });
});

test.describe("자정", () => {
  test("푸는 중에 날짜가 넘어가도 풀던 문제가 유지되고, 해결과 보상은 그 문제의 것으로 한 번 처리된다", async ({ page }) => {
    const errors = watchErrors(page);
    await preset(page, "daily-unsolved");
    await enterFromHome(page, "daily-file");
    const play = page.getByTestId("play-screen");
    await expect(play).toHaveAttribute("data-type", "code");
    await page.getByTestId("memo-7").click();
    await toSafe(page);
    await page.getByTestId("dial-0-next").click();
    await expect(page.getByTestId("dial-0")).toHaveAttribute("aria-valuenow", "2");

    // 자정이 지났다: 11월 23일의 오늘의 추리는 증거 조합 '사라진 자료실 열쇠'다
    await setDate(page, "2026-11-23");
    // 풀이 화면은 1초마다 시간을 저장하며 다시 그려진다. 두 번은 그려질 때까지 기다린다.
    const elapsed = (await stored(page)).puzzles["daily-code-001"].elapsedMs;
    await expect.poll(async () => (await stored(page)).puzzles["daily-code-001"].elapsedMs, { timeout: 6000 }).toBeGreaterThan(elapsed + 1500);

    // 풀던 암호 문제가 그대로다: 다른 문제로 갈리지 않았고, 맞춰 둔 다이얼과 메모가 남아 있다
    await expect(play).toHaveAttribute("data-type", "code");
    await expect(play).toHaveAttribute("data-at", "safe");
    await expect(page.getByTestId("dial-0")).toHaveAttribute("aria-valuenow", "2");
    await expect(page.locator(".evichip")).toHaveCount(0);
    expect((await stored(page)).puzzles["daily-evidence-001"]).toBeUndefined();

    await solve(page, PUZZLE_BY_ID["daily-code-001"]);
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await expect(page.locator(".exampaper__title")).toHaveText("자료실 금고의 암호");
    await expect(page.getByTestId("reward")).toContainText("+60");
    let saved = await stored(page);
    expect(saved.credits).toBe(100);
    expect(saved.puzzles["daily-code-001"]).toMatchObject({ status: "solved", rewardClaimed: true, solvedDateKey: "2026-11-23" });
    await shot(page, "past-04-midnight-result");

    // 새 날의 문제는 미해결로 따로 있다: 결과의 "오늘의 추리 풀기"는 같은 주소(#/daily)에 새 문제를 연다
    await expect(page.getByTestId("result-next")).toHaveText("오늘의 추리 풀기");
    await page.getByTestId("result-next").click();
    await expect(play).toHaveAttribute("data-type", "evidence");
    await expect(page).toHaveURL(/#\/daily$/);
    await solve(page, PUZZLE_BY_ID["daily-evidence-001"]);
    await expect(page.getByTestId("reward")).toContainText("+60");
    saved = await stored(page);
    expect(saved.credits).toBe(160);
    expect(saved.puzzles["daily-evidence-001"]).toMatchObject({ status: "solved", solvedDateKey: "2026-11-23" });

    // 어제 푼 문제는 지난 사건에 해결로 남는다
    await page.goto("/?demo=1#/daily/past");
    await expect(page.getByTestId("past-total")).toHaveText("해결 2/2");
    expect(errors).toEqual([]);
  });
});

test.describe("주소로 직접 접근 · 뒤로 가기", () => {
  test("오지 않은 날의 문제 · 없는 문제 · 달력에 없는 문제 · 깨진 주소는 열리지 않고 목록으로 돌려보낸다", async ({ page }) => {
    const errors = watchErrors(page);
    await preset(page, "daily-unsolved");
    const before = await stored(page);
    const future = DAILY_CALENDAR.order.slice(1);
    expect(future).toHaveLength(13);
    for (const id of [...future, "없는-문제", "practice-truth-001", "exam-schedule-f-d", "%", "%E0%A4%A"]) {
      await page.goto(`/?demo=1#/daily/past/${id}`);
      await expect(pastScreen(page), id).toBeVisible();
      await expect(page, id).toHaveURL(/#\/daily\/past$/);
      await expect(page.getByTestId("play-screen"), id).toHaveCount(0);
      await expect(page.getByTestId("result-screen"), id).toHaveCount(0);
      // 오늘(첫날)까지 붙은 문제는 하나뿐이다: 오지 않은 날의 제목은 목록에도 없다
      await expect(page.locator(".dailypast__list .isotask"), id).toHaveCount(1);
    }
    // 열어 보려던 문제에 기록이 생기지 않았다
    expect((await stored(page)).puzzles).toEqual(before.puzzles);

    // 그날이 되면 열린다
    await setDate(page, "2026-11-23");
    await page.goto("/?demo=1#/daily/past/daily-evidence-001");
    await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", "evidence");
    expect(errors).toEqual([]);
  });

  test("잠긴 연습 과제 · 없는 연습 과제 · 없는 주소 · 깨진 주소도 화면이 깨지지 않는다", async ({ page }) => {
    const errors = watchErrors(page);
    await preset(page, "daily-unsolved");
    // 잠긴 서류함의 과제, 없는 과제, 연습 과제가 아닌 문제, 깨진 값 → 연습실
    for (const id of ["practice-schedule-d", "special-code-001", "없는-과제", "daily-code-001", "%"]) {
      await page.goto(`/?demo=1#/practice/${id}`);
      await expect(page.getByTestId("practice-room"), id).toBeVisible();
      await expect(page.getByTestId("play-screen"), id).toHaveCount(0);
    }
    // 없는 주소 → 학원 홀
    for (const hash of ["#/nowhere", "#/daily-past", "#/story", "#/%", "#//", "#/practice%2Fpractice-truth-001/x/y"]) {
      await page.goto(`/?demo=1${hash}`);
      await expect(page.getByTestId("home-screen"), hash).toBeVisible();
    }
    // 오늘의 추리의 알 수 없는 갈래는 오늘의 추리다
    await page.goto("/?demo=1#/daily/어제");
    await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", "code");
    expect(errors).toEqual([]);
  });

  test("뒤로 가기: 신분증 → 지난 사건 → 사건 → 목록 → 신분증 → 홀. 화면의 뒤로 단추와 브라우저의 뒤로가 같은 길을 간다", async ({ page }) => {
    await preset(page, "daily-solved", "&date=2026-11-24");
    await enterFromHome(page, "identity");
    await expect(page.getByTestId("profile-screen")).toBeVisible();
    await page.getByTestId("record-past").click();
    await expect(pastScreen(page)).toBeVisible();

    // 풀지 않은 사건을 열었다가 화면의 뒤로 단추로 나온다
    await row(page, "daily-code-001").click();
    await expect(page.getByTestId("play-screen")).toBeVisible();
    await page.getByTestId("play-back").click();
    await expect(pastScreen(page)).toBeVisible();

    // 푼 사건(오늘 것)의 기록을 열었다가 브라우저의 뒤로
    await row(page, "daily-seal-001").click();
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await page.goBack();
    await expect(pastScreen(page)).toBeVisible();

    // 기록의 "지난 사건" 단추로 돌아오면 목록이 한 번만 쌓여 있다: 뒤로 한 번에 신분증이다
    await row(page, "daily-seal-001").click();
    await page.getByTestId("result-home").click();
    await expect(pastScreen(page)).toBeVisible();
    await page.getByTestId("past-back").click();
    await expect(page.getByTestId("profile-screen")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("home-screen")).toBeVisible();

    // 주소로 바로 온 목록(온 길이 없다)에서 뒤로 단추는 홀로 간다
    await page.goto("/?demo=1&date=2026-11-24#/daily/past");
    await expect(pastScreen(page)).toBeVisible();
    await page.getByTestId("past-back").click();
    await expect(page.getByTestId("home-screen")).toBeVisible();
    // 주소로 바로 온 사건의 기록에서 "지난 사건으로"는 목록으로 간다
    await page.goto("/?demo=1&date=2026-11-24#/daily/past/daily-seal-001");
    await page.getByTestId("result-home").click();
    await expect(pastScreen(page)).toBeVisible();
  });
});

for (const [w, h] of SIZES) {
  test.describe(`화면 크기 ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    /** 게시판을 고른 아래 창이 제 높이를 지키는가: 방 쪽으로도 화면 아래로도 넘치지 않는다 */
    async function expectBoardFits(page: Page, name: string, buttons: string[]) {
      await toBoard(page);
      await expectLayoutOk(page, '[data-testid="daily-file-cta"]');
      expect(await page.getByTestId("home-screen").evaluate((el) => el.scrollHeight - el.clientHeight), `${name}: 홈이 세로로 넘친다`).toBeLessThanOrEqual(0);
      const win = (await page.locator(".isowin").boundingBox())!;
      const card = (await page.locator(".isocard").boundingBox())!;
      expect(card.y, `${name}: 아래 창의 내용이 방 쪽으로 넘친다`).toBeGreaterThanOrEqual(win.y);
      expect(card.y + card.height, `${name}: 아래 창의 내용이 화면 아래로 넘친다`).toBeLessThanOrEqual(h);
      for (const id of buttons) {
        const box = (await page.getByTestId(id).boundingBox())!;
        expect(box.height, `${name}: ${id} 의 터치 높이`).toBeGreaterThanOrEqual(44);
        expect(box.width, `${name}: ${id} 의 터치 폭`).toBeGreaterThanOrEqual(44);
        expect(box.x, `${name}: ${id} 가 왼쪽으로 잘린다`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${name}: ${id} 가 오른쪽으로 잘린다`).toBeLessThanOrEqual(w);
        // 글자가 단추 밖으로 넘치지 않는다
        expect(await page.getByTestId(id).evaluate((el) => el.scrollWidth - el.clientWidth), `${name}: ${id} 의 글자가 잘린다`).toBeLessThanOrEqual(0);
      }
    }

    test("달력이 끝난 날의 게시판과, 오늘 문제를 푼 날의 단추 둘이 아래 창을 넘기지 않는다", async ({ page }) => {
      test.setTimeout(120_000);
      await page.emulateMedia({ reducedMotion: "reduce" }); // 걷는 시간을 기다리지 않는다(배치는 같다)
      await preset(page, "promoted", `&date=${AFTER}`);
      await expectBoardFits(page, "달력이 끝난 날", ["daily-file-cta"]);
      expect(await offToneRatio(page), "달력이 끝난 날의 홈: 두 색이 아닌 화소").toBeLessThan(0.005);
      await shot(page, `past-home-exhausted-${w}x${h}`);

      // 오늘 문제를 푼 날: 달력의 둘째 날부터 마지막 날까지, 제목이 무엇이든 단추 둘이 한 줄에 들어간다
      for (let i = 1; i < DAILY_CALENDAR.order.length; i++) {
        const date = new Date(Date.parse(`${DAILY_CALENDAR.start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
        await preset(page, "daily-solved", `&date=${date}`);
        await expectBoardFits(page, `${date} 을 푼 날`, ["daily-file-cta", "daily-past-cta"]);
        // 두 단추는 같은 줄에 나란하다
        const side = (await page.getByTestId("daily-past-cta").boundingBox())!;
        const main = (await page.getByTestId("daily-file-cta").boundingBox())!;
        expect(Math.abs(side.y - main.y), `${date}: 두 단추가 다른 줄에 있다`).toBeLessThanOrEqual(1);
        expect(side.x + side.width, `${date}: 두 단추가 겹친다`).toBeLessThanOrEqual(main.x);
      }
      await shot(page, `past-home-solved-${w}x${h}`);
    });

    test("지난 사건의 목록: 열네 줄이 넘치지 않고 밀리며, 줄마다 누르는 높이가 44px 이상이고 두 색이다", async ({ page }) => {
      await preset(page, "daily-solved");
      await setDate(page, AFTER);
      await page.goto("/?demo=1#/daily/past");
      await expect(pastScreen(page)).toBeVisible();
      await expectLayoutOk(page, '[data-testid="past-file-daily-schedule-003"]');
      const rows = page.locator(".dailypast__list .isotask");
      await expect(rows).toHaveCount(14);
      for (const box of await rows.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as { height: number; left: number; right: number }))) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(w);
      }
      // 제목과 상태 글자가 줄 밖으로 넘치지 않는다
      expect(await page.locator(".dailypast__list .isotask__title").evaluateAll((els) => Math.max(...els.map((el) => el.scrollWidth - el.clientWidth)))).toBeLessThanOrEqual(0);
      // 화면 자체는 넘치지 않고(위 막대는 제자리), 목록이 든 종이만 위아래로 밀린다
      expect(await pastScreen(page).evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
      const scroll = page.locator(".dailypast__scroll");
      expect(await scroll.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);
      expect(await offToneRatio(page), "지난 사건: 두 색이 아닌 화소").toBeLessThan(0.005);
      await shot(page, `past-list-${w}x${h}`);

      // 맨 아래 줄(첫날의 사건)까지 밀어서 누를 수 있다
      await row(page, "daily-code-001").scrollIntoViewIfNeeded();
      const last = (await row(page, "daily-code-001").boundingBox())!;
      expect(last.y + last.height).toBeLessThanOrEqual(h);
      expect(await offToneRatio(page), "지난 사건(아래쪽): 두 색이 아닌 화소").toBeLessThan(0.005);
      await row(page, "daily-code-001").tap();
      await expect(page.getByTestId("result-screen")).toBeVisible();
      await expectLayoutOk(page, '[data-testid="result-home"]');
    });
  });
}
