import { expect, test, type Page } from "@playwright/test";
import { PUZZLE_BY_ID } from "../src/data/puzzles";
import { MAIN_SAVE_D, MAIN_SAVE_F } from "../src/tests/fixtures/mainSaves";
import { enterFromHome, STORAGE_KEY, stored } from "./helpers";
import { solve } from "./solve";

/**
 * 예전 저장 마이그레이션: 지금 배포본(main 브랜치)이 남긴 저장으로 이 빌드를 연다.
 * 입학 화면으로 돌아가지 않고 홈이 뜨며, 크레딧 · 등급 · 해결 기록이 그대로다.
 * 저장은 main 의 엔진을 실제로 돌려 만든 것이다(src/tests/fixtures/mainSaves.ts). 엔진 쪽 확인은 src/tests/migration.test.ts.
 * QA 주소(?demo=1)를 쓰지 않는다: 보통 사용자가 여는 주소 그대로다.
 */

/** 저장소에 예전 저장을 넣고 앱을 연다 (앱이 뜨기 전에 넣는다: 같은 주소의 빈 문서에서 써 넣고 돌아온다) */
async function openWithSave(page: Page, save: unknown, hash = "") {
  await page.route("**/__blank", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>blank</title>" }));
  await page.goto("/__blank");
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(save)] as const);
  await page.unroute("**/__blank");
  await page.goto(`/${hash}`);
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

test("D급으로 승급한 예전 저장: 홈이 뜨고 등급 · 크레딧 · 해결 기록 · 승급 기록이 그대로다", async ({ page }) => {
  const errors = watchErrors(page);
  await openWithSave(page, MAIN_SAVE_D);

  // 입학 화면이 아니라 홈이다
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(page.getByTestId("admission-screen")).toHaveCount(0);
  await expect(page.getByTestId("home-rank")).toHaveText("D급 초급 탐정");
  await expect(page.getByTestId("credit-balance")).toHaveText("350");
  // 예전에 푼 첫날의 오늘의 추리는 해결로 남아 있다(테스트의 게임 날짜는 그 문제가 붙는 11월 22일이다)
  await expect(page.getByTestId("daily-file-status")).toHaveText("해결");
  // D급이라 사건 접수함이 놓여 있고, 다음 시험(D→C)의 응시 조건은 예전에 푼 과제 둘부터 센다
  await expect(page.getByTestId("story-entry")).toBeVisible();
  await expect(page.getByTestId("promo-count")).toHaveText("2/5");
  await expect(page.getByTestId("exam-wait")).toHaveAttribute("aria-label", /C급 과제 2\/5/);

  // 열기만 해서는 저장을 고쳐 쓰지 않는다(읽은 값 그대로다)
  expect(await stored(page)).toEqual(MAIN_SAVE_D);

  // 신분증: 이름 · 학번 · 수사 기록
  await enterFromHome(page, "identity");
  await expect(page.getByTestId("profile-screen")).toBeVisible();
  await expect(page.locator(".profile__card")).toContainText("승급한 탐정");
  await expect(page.locator(".profile__card")).toContainText("DA-271828");
  await expect(page.getByTestId("rank-note")).toContainText("현재 D급 초급 탐정");
  await expect(page.getByTestId("record-daily")).toContainText("지금까지 1개 해결");
  await expect(page.getByTestId("record-daily")).toContainText("1분 35초 · 제출 1회 · 힌트 미사용");
  await expect(page.getByTestId("record-practice")).toContainText("과제 1/22 해결");
  await expect(page.getByTestId("record-exam")).toContainText("D급 승급 시험 합격");
  await expect(page.getByTestId("record-exam")).toContainText("2026.11.22 · 승급 1번");
  // 소리는 예전 저장대로 꺼져 있고, 새로 생긴 음악도 꺼짐이다
  await expect(page.getByTestId("sound-toggle")).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId("music-toggle")).toHaveAttribute("aria-checked", "false");

  // 설정 하나를 바꿔 저장이 지금 형식으로 다시 쓰여도, 예전 값은 하나도 바뀌지 않는다
  await page.getByTestId("music-toggle").click();
  await expect(page.getByTestId("music-toggle")).toHaveAttribute("aria-checked", "true");
  const saved = await stored(page);
  const old = MAIN_SAVE_D as { puzzles: unknown; promotions: unknown };
  expect(saved).toMatchObject({ version: 1, enrolled: true, nickname: "승급한 탐정", detectiveNo: "DA-271828", rank: "D", credits: 350, exam: null, examDays: {} });
  expect(saved.puzzles).toEqual(old.puzzles);
  expect(saved.promotions).toEqual(old.promotions);
  expect(saved.settings).toMatchObject({ sound: false, music: true });
  expect(saved.story).toEqual({ chapters: {} });
  await page.getByTestId("music-toggle").click();

  // 다시 열어도 그대로다
  await page.reload();
  await expect(page.getByTestId("profile-screen")).toBeVisible();
  await expect(page.getByTestId("credit-balance")).toHaveText("350");

  // 예전에 푼 문제의 채점 기록이 열리고, 다시 풀어도 보상은 나오지 않는다
  await page.goto("/#/daily");
  await expect(page.getByTestId("result-screen")).toHaveAttribute("data-fresh", "false");
  await expect(page.getByTestId("reward-claimed")).toBeVisible();
  await page.getByTestId("replay").click();
  await solve(page, PUZZLE_BY_ID["daily-code-001"]);
  await expect(page.getByTestId("result-lead")).toContainText("보상은 처음 해결했을 때 한 번만");
  expect((await stored(page)).credits).toBe(350);

  // 지난 사건에도 해결로 남아 있다
  await page.goto("/#/daily/past");
  await expect(page.getByTestId("past-status-daily-code-001")).toHaveText("해결");
  expect(errors).toEqual([]);
});

test("F급의 예전 저장: 풀다 만 연습 과제를 그 자리에서 이어 풀고, 보상은 예전 크레딧 위에 쌓인다", async ({ page }) => {
  const errors = watchErrors(page);
  await openWithSave(page, MAIN_SAVE_F);
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(page.getByTestId("home-rank")).toHaveText("F급 견습 탐정");
  await expect(page.getByTestId("credit-balance")).toHaveText("120");
  await expect(page.getByTestId("daily-file-status")).toHaveText("해결");
  // F급에는 사건 접수함이 없다
  await expect(page.getByTestId("story-entry")).toHaveCount(0);
  await expect(page.getByTestId("promo-count")).toHaveText("1/3");

  // 연습실: 풀다 만 과제는 풀이 중으로 남아 있다
  await enterFromHome(page, "practice-entry");
  await expect(page.getByTestId("practice-room")).toHaveAttribute("data-at", "F");
  await expect(page.getByTestId("practice-status-practice-truth-001")).toHaveText("풀이 중");
  await page.getByTestId("practice-file-practice-truth-001").click();
  await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", "truth");
  // 골라 두었던 용의자와 적어 둔 메모가 그대로다
  await expect(page.getByTestId("suspect-hana")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("memo-junho-true")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("memo-daon-false")).toHaveAttribute("aria-pressed", "true");
  await solve(page, PUZZLE_BY_ID["practice-truth-001"]);
  await expect(page.getByTestId("result-screen")).toBeVisible();
  await expect(page.getByTestId("reward")).toContainText("+30");
  const saved = await stored(page);
  expect(saved.credits).toBe(150);
  expect(saved.rank).toBe("F");
  // 예전에 푼 오늘의 추리의 기록(힌트 한 단계, 제출 두 번)은 그대로다
  expect(saved.puzzles["daily-code-001"]).toEqual((MAIN_SAVE_F as { puzzles: Record<string, unknown> }).puzzles["daily-code-001"]);

  // 효과음을 켜 두었던 설정이 남아 있다
  await page.goto("/#/profile");
  await expect(page.getByTestId("sound-toggle")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("record-daily")).toContainText("제출 2회 · 힌트 1단계");
  expect(errors).toEqual([]);
});
