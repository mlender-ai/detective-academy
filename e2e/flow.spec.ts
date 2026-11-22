import { expect, test } from "@playwright/test";
import { dialValue, enroll, placeByDrag, placeByTap, preset, setCode, setDial, shot, stored, toDesk, toSafe } from "./helpers";

test("처음 방문한 사용자가 입학해서 문제를 풀고 D급으로 승급한다", async ({ page }) => {
  /* ── 입학 ── */
  await page.goto("/");
  await expect(page.getByTestId("admission-screen")).toBeVisible();
  await expect(page.getByTestId("demo-panel")).toHaveCount(0);
  await expect(page.getByTestId("id-rank")).toHaveText("입학 전");
  await page.getByTestId("nickname-input").fill("서하윤");
  await shot(page, "01-admission");

  await page.getByTestId("enroll").click();
  await expect(page.getByTestId("id-rank")).toHaveText("F급 견습 탐정");
  await expect(page.getByTestId("id-nickname")).toHaveText("서하윤");
  await expect(page.getByTestId("admission-grant")).toContainText("40");
  await shot(page, "02-admission-issued");

  await page.getByTestId("enter-academy").click();

  /* ── 학원 홈 ── */
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(page.getByTestId("home-rank")).toHaveText("F급 견습 탐정");
  await expect(page.getByTestId("credit-balance")).toHaveText("40");
  await expect(page.getByTestId("daily-file-status")).toHaveText("미해결");
  await expect(page.getByTestId("daily-file-cta")).toHaveText("시험지 펼치기");
  await expect(page.getByTestId("promo-count")).toHaveText("0/2");
  await expect(page.getByTestId("exam-cta")).toHaveCount(0);
  await shot(page, "03-home");

  /* ── 오늘의 추리: 암호 해독 (자료실) ── */
  await page.getByTestId("daily-file").click();
  await expect(page.getByTestId("play-screen")).toBeVisible();
  // 들어서면 책상 앞이다: 시도 기록과 숫자 메모가 놓여 있고, 자물쇠는 금고 앞에 있다
  await expect(page.getByTestId("record")).toBeVisible();
  await expect(page.locator(".clue")).toHaveCount(5);
  await expect(page.getByTestId("dial-0")).toHaveCount(0);
  await shot(page, "04-code-breaker");

  // 오답: 정답은 드러나지 않는다
  await toSafe(page);
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("notice-wrong")).toBeVisible();
  await expect(page.getByTestId("solution")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("426");
  expect((await stored(page)).credits).toBe(40);

  // 책상으로 돌아가 메모한다. 메모는 시도 기록에 그대로 반영되고, 금고 앞에도 들고 간다.
  await toDesk(page);
  await page.getByTestId("memo-5").click();
  await expect(page.getByTestId("memo-5")).toHaveAttribute("data-state", "out");
  await expect(page.locator('.clue__digit[data-memo="out"]')).toHaveCount(3);
  await toSafe(page);
  await expect(page.getByTestId("carry-memo")).toContainText("제외 5");

  // 다이얼: 밀어서(스와이프) 1 → 4
  const dial = (await page.getByTestId("dial-0").boundingBox())!;
  await page.mouse.move(dial.x + dial.width / 2, dial.y + dial.height / 2);
  await page.mouse.down();
  await page.mouse.move(dial.x + dial.width / 2, dial.y + dial.height / 2 - 150, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId("dial-0")).toHaveAttribute("aria-valuenow", "4");

  // 다이얼: 숫자를 눌러서 3 → 6
  for (const expected of ["4", "5", "6"]) {
    await page.getByTestId("dial-2").click();
    await expect(page.getByTestId("dial-2")).toHaveAttribute("aria-valuenow", expected);
  }
  expect(await dialValue(page, 1)).toBe(2);
  await shot(page, "05-code-breaker-set");

  // 정답 제출을 연달아 눌러도 한 번만 처리된다
  await page.getByTestId("submit").dblclick();
  await expect(page.getByTestId("result-screen")).toBeVisible();
  await expect(page.getByTestId("result-lead")).toContainText("추론이 정확했습니다");
  await expect(page.getByTestId("reward")).toContainText("+100");
  // 오답이 한 번 있었어도 힌트를 쓰지 않았으므로 '힌트 미사용' 기록이 남는다
  await expect(page.getByTestId("no-hint")).toBeVisible();
  await expect(page.getByTestId("record-hints")).toHaveText("미사용");
  expect((await stored(page)).credits).toBe(140);
  await page.getByTestId("explain-toggle").click();
  await expect(page.getByTestId("explain-steps").locator("li")).toHaveCount(5);
  await page.getByTestId("explain-toggle").click();
  await shot(page, "06-result");

  /* ── 연습실: 거짓 진술 찾기 ── */
  await expect(page.getByTestId("result-next")).toHaveText("연습실로 이동");
  await page.getByTestId("result-next").click();
  await expect(page.getByTestId("practice-room")).toBeVisible();
  await shot(page, "07-practice-room");
  await page.getByTestId("practice-file-cta").click();
  await expect(page.getByTestId("play-screen")).toBeVisible();

  // 용의자를 고르기 전에는 메모할 수 없다
  await expect(page.getByTestId("memo-hana-true")).toBeDisabled();
  await page.getByTestId("suspect-hana").click();
  await expect(page.getByTestId("truth-prompt")).toContainText("하나가 숨겼다면");
  await page.getByTestId("memo-hana-false").click();
  await page.getByTestId("memo-junho-true").click();
  await page.getByTestId("memo-sera-true").click();
  await page.getByTestId("memo-daon-false").click();
  await expect(page.getByTestId("suspect-hana")).toContainText("참 2 · 거짓 2");
  // 진술 카드를 골라 비교
  await page.getByTestId("statement-junho").locator(".statement__main").click();
  await expect(page.getByTestId("statement-junho")).toHaveAttribute("data-pinned", "true");
  await expect(page.getByTestId("statement-hana")).toHaveAttribute("data-dim", "true");
  await shot(page, "08-truth-deduction");

  // 오답 → 정답은 드러나지 않는다
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("notice-wrong")).toBeVisible();
  await expect(page.getByTestId("solution")).toHaveCount(0);
  await expect(page.locator(".statement__verdict")).toHaveCount(0);

  // 가정을 바꾸면 메모도 가정별로 따로 남는다
  await page.getByTestId("suspect-daon").click();
  await expect(page.getByTestId("truth-prompt")).toContainText("다온이 숨겼다면");
  await expect(page.getByTestId("memo-junho-true")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("suspect-sera").click();
  await expect(page.getByTestId("submit")).toHaveText("세라 지목하고 제출");
  await page.getByTestId("submit").click();

  // 정답: 진술의 참·거짓이 차례로 밝혀진 뒤 결과로 넘어간다
  await expect(page.locator(".statement__verdict")).toHaveCount(4);
  await expect(page.getByTestId("statement-daon").locator(".statement__verdict")).toHaveText("참");
  await expect(page.getByTestId("result-screen")).toBeVisible();
  await expect(page.getByTestId("reward")).toContainText("+60");
  expect((await stored(page)).credits).toBe(200);
  await shot(page, "09-result-practice");

  /* ── 승급 시험: 발표 순서 재구성 ── */
  await expect(page.getByTestId("result-next")).toHaveText("승급 시험 응시");
  await page.getByTestId("result-next").click();
  await expect(page.getByTestId("exam-gate")).toBeVisible();
  await shot(page, "10-exam-envelope");
  await page.getByTestId("open-envelope").click();
  await expect(page.getByTestId("play-screen")).toBeVisible();
  await expect(page.getByTestId("play-screen")).toHaveAttribute("data-variant", "exam");
  await expect(page.getByTestId("card-doyun")).toBeVisible();
  await shot(page, "11-exam-schedule");

  // 덜 채운 채 제출하면 접수되지 않는다
  await placeByTap(page, "sea", 0);
  await expect(page.getByTestId("placed-count")).toHaveText("배치 1/4");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("notice-invalid")).toBeVisible();
  expect((await stored(page)).puzzles["exam-schedule-f-d"].attempts).toBe(0);

  // 끌어서 배치, 자리 맞바꾸기, 되돌리기
  await placeByDrag(page, "harin", 1);
  await expect(page.getByTestId("placed-count")).toHaveText("배치 2/4");
  await placeByDrag(page, "sea", 1); // 세아 ↔ 하린 맞바꾸기
  await expect(page.getByTestId("slot-0")).toHaveAttribute("aria-label", /하린 배치됨/);
  await expect(page.getByTestId("slot-1")).toHaveAttribute("aria-label", /세아 배치됨/);
  await page.getByTestId("undo").click();
  await expect(page.getByTestId("slot-0")).toHaveAttribute("aria-label", /세아 배치됨/);
  await page.getByTestId("clear").click();
  await expect(page.getByTestId("placed-count")).toHaveText("배치 0/4");

  // 오답 배열: 어긋난 조건을 알려 주지 않는다
  await placeByTap(page, "sea", 0);
  await placeByTap(page, "harin", 1);
  await placeByTap(page, "doyun", 2);
  await placeByTap(page, "minjae", 3);
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("notice-wrong")).toBeVisible();
  expect((await stored(page)).rank).toBe("F");

  // 정답 배열
  await page.getByTestId("clear").click();
  await placeByDrag(page, "doyun", 0);
  await placeByTap(page, "minjae", 1);
  await placeByDrag(page, "sea", 2);
  await placeByTap(page, "harin", 3);
  await expect(page.getByTestId("placed-count")).toHaveText("배치 4/4");
  await shot(page, "12-exam-schedule-filled");
  await page.getByTestId("submit").click();

  /* ── 승급 ── */
  await expect(page.getByTestId("ceremony")).toBeVisible();
  await expect(page.getByTestId("ceremony-title")).toHaveText("D급 초급 탐정");
  await expect(page.getByTestId("ceremony")).toHaveAttribute("data-done", "true", { timeout: 10_000 });
  await expect(page.getByTestId("id-rank")).toHaveText("D급 초급 탐정");
  await expect(page.getByTestId("reward")).toContainText("+150");
  await shot(page, "13-promotion");
  const afterExam = await stored(page);
  expect(afterExam.rank).toBe("D");
  expect(afterExam.credits).toBe(350);

  await page.getByTestId("ceremony-done").click();
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(page.getByTestId("home-rank")).toHaveText("D급 초급 탐정");
  await expect(page.getByTestId("credit-balance")).toHaveText("350");
  // 더 할 일이 없으면 탐정은 복도 가운데에 서 있고, 게시판 줄은 접혀 있다(하는 일은 줄의 이름표에 남는다)
  await expect(page.getByTestId("daily-file")).toHaveAttribute("aria-label", /채점 기록 보기/);
  await shot(page, "14-home-promoted");

  /* ── 신분증 ── */
  await page.getByTestId("identity").click();
  await expect(page.getByTestId("profile-screen")).toBeVisible();
  await expect(page.getByTestId("id-rank")).toHaveText("D급 초급 탐정");
  await expect(page.getByTestId("id-nickname")).toHaveText("서하윤");
  await expect(page.getByTestId("record-exam")).toContainText("제출 2회");
  await shot(page, "15-profile");

  /* ── 새로고침해도 유지된다 ── */
  await page.reload();
  await expect(page.getByTestId("profile-screen")).toBeVisible();
  await expect(page.getByTestId("id-rank")).toHaveText("D급 초급 탐정");
  await expect(page.getByTestId("credit-balance")).toHaveText("350");
});

test("힌트는 크레딧을 차감하고, 모자라면 열리지 않으며 잔액은 음수가 되지 않는다", async ({ page }) => {
  await enroll(page);
  await page.getByTestId("daily-file").click();
  await expect(page.getByTestId("play-screen")).toBeVisible();

  await page.getByTestId("hint-button").click();
  await expect(page.getByTestId("hint-drawer")).toBeVisible();
  await expect(page.getByTestId("hint-2-open")).toBeDisabled();
  await shot(page, "16-hint-drawer");

  await page.getByTestId("hint-1-open").click();
  await expect(page.getByTestId("hint-1")).toContainText("일치하는 숫자가 하나도 없는 기록");
  await expect(page.getByTestId("hint-drawer").getByTestId("credit-balance")).toHaveText("20");
  expect((await stored(page)).credits).toBe(20);

  // 2단계는 40이 필요하다. 20으로는 열 수 없다.
  await expect(page.getByTestId("hint-2-open")).toBeDisabled();
  await expect(page.getByTestId("hint-short")).toContainText("20 모자랍니다");
  await page.getByTestId("hint-2-open").click({ force: true });
  const state = await stored(page);
  expect(state.credits).toBe(20);
  expect(state.puzzles["daily-code-001"].hintsUsed).toBe(1);

  // 연 힌트는 서랍을 닫아도 문제 옆에 남는다
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("hint-drawer")).toHaveCount(0);
  await expect(page.getByTestId("brief-hint-1")).toBeVisible();

  // 힌트를 쓰고 풀면 '힌트 미사용' 기록이 남지 않는다
  await toSafe(page);
  await setCode(page, [4, 2, 6]);
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("result-screen")).toBeVisible();
  await expect(page.getByTestId("record-hints")).toHaveText("1단계 사용");
  await expect(page.getByTestId("no-hint")).toHaveCount(0);
  expect((await stored(page)).credits).toBe(120);
});

test("힌트 없이 한 번에 풀면 '힌트 미사용' 기록이 남는다", async ({ page }) => {
  await enroll(page);
  await page.getByTestId("daily-file").click();
  await toSafe(page);
  await setCode(page, [4, 2, 6]);
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("result-screen")).toBeVisible();
  await expect(page.getByTestId("no-hint")).toBeVisible();
});

test("같은 문제를 다시 풀어도 보상은 다시 지급되지 않는다", async ({ page }) => {
  await preset(page, "daily-solved");
  await expect(page.getByTestId("credit-balance")).toHaveText("140");
  await expect(page.getByTestId("daily-file-status")).toHaveText("해결");

  await page.getByTestId("daily-file").click();
  await expect(page.getByTestId("result-screen")).toBeVisible();
  await expect(page.getByTestId("reward-claimed")).toContainText("수령 완료");

  await page.getByTestId("replay").click();
  await expect(page.getByTestId("play-screen")).toBeVisible();
  await toSafe(page);
  await setCode(page, [4, 2, 6]);
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("result-screen")).toBeVisible();
  await expect(page.getByTestId("result-lead")).toContainText("한 번만 지급");
  await expect(page.getByTestId("reward")).toHaveCount(0);
  expect((await stored(page)).credits).toBe(140);

  // 화면을 다시 열어도 그대로다
  await page.reload();
  await expect(page.getByTestId("result-screen")).toBeVisible();
  expect((await stored(page)).credits).toBe(140);
});

test("풀던 문제는 뒤로 갔다 와도, 새로고침해도 이어서 풀 수 있다", async ({ page }) => {
  await enroll(page);
  await page.getByTestId("daily-file").click();
  await page.getByTestId("memo-9").click();
  await page.getByTestId("memo-6").click();
  await page.getByTestId("memo-6").click();
  await toSafe(page);
  await setDial(page, 0, 7);

  await page.getByTestId("play-back").click();
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(page.getByTestId("daily-file-status")).toContainText("풀이 중");
  await expect(page.getByTestId("daily-file-cta")).toHaveText("이어서 풀기");

  // 돌아오면 서 있던 금고 앞에서 잇는다. 돌리던 숫자와 메모가 그대로다.
  await page.getByTestId("daily-file").click();
  await expect(page.getByTestId("play-screen")).toHaveAttribute("data-at", "safe");
  await expect(page.getByTestId("dial-0")).toHaveAttribute("aria-valuenow", "7");
  await expect(page.getByTestId("carry-memo")).toContainText("제외 9");
  await toDesk(page);
  await expect(page.getByTestId("memo-9")).toHaveAttribute("data-state", "out");
  await expect(page.getByTestId("memo-6")).toHaveAttribute("data-state", "maybe");

  await page.reload();
  await expect(page.getByTestId("play-screen")).toHaveAttribute("data-at", "desk");
  await expect(page.getByTestId("memo-9")).toHaveAttribute("data-state", "out");
  await toSafe(page);
  await expect(page.getByTestId("dial-0")).toHaveAttribute("aria-valuenow", "7");

  // 브라우저 뒤로 가기도 홈으로 돌아간다
  await page.goto("/#/");
  await page.getByTestId("daily-file").click();
  await expect(page.getByTestId("play-screen")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("home-screen")).toBeVisible();
});

test("승급 조건을 채우기 전에는 시험이 잠겨 있다", async ({ page }) => {
  await enroll(page);
  await expect(page.getByTestId("exam-cta")).toHaveCount(0);
  await page.goto("/#/exam");
  await expect(page.getByTestId("exam-locked")).toBeVisible();
  await expect(page.getByTestId("open-envelope")).toHaveCount(0);
  // 잠긴 봉투는 닫혀 있다: 젖혀진 덮개는 보이지 않아야 한다
  expect(await page.locator(".envelope__lid").evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
  await shot(page, "17-exam-locked");

  await preset(page, "daily-solved");
  await expect(page.getByTestId("promo-count")).toHaveText("1/2");
  await expect(page.getByTestId("exam-cta")).toHaveCount(0);
  await expect(page.getByTestId("practice-entry")).toHaveAttribute("data-primary", "true");

  await preset(page, "exam-ready");
  await expect(page.getByTestId("promo-count")).toHaveText("2/2");
  await expect(page.getByTestId("exam-cta")).toContainText("승급 시험 응시");
});

test("QA 패널은 ?demo=1 에서만 보이고 다섯 가지 상태를 만든다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("demo-panel")).toHaveCount(0);

  await preset(page, "daily-unsolved");
  await expect(page.getByTestId("daily-file-status")).toHaveText("미해결");
  await expect(page.getByTestId("credit-balance")).toHaveText("40");

  await preset(page, "daily-solved");
  await expect(page.getByTestId("daily-file-status")).toHaveText("해결");
  await shot(page, "18-home-daily-solved");

  await preset(page, "exam-ready");
  await expect(page.getByTestId("exam-cta")).toBeVisible();
  await shot(page, "19-home-exam-ready");

  await preset(page, "promoted");
  await expect(page.getByTestId("home-rank")).toHaveText("D급 초급 탐정");
  await page.getByTestId("exam-record").click();
  await expect(page.getByTestId("exam-passed")).toBeVisible();

  await preset(page, "first-run");
  await expect(page.getByTestId("admission-screen")).toBeVisible();
  expect((await stored(page)).enrolled).toBe(false);
});

test("이름을 바꾸고 효과음을 켤 수 있으며, 효과음은 기본으로 꺼져 있다", async ({ page }) => {
  await enroll(page, "첫 이름");
  await page.getByTestId("identity").click();
  await expect(page.getByTestId("sound-toggle")).toHaveAttribute("aria-checked", "false");
  await page.getByTestId("sound-toggle").click();
  await expect(page.getByTestId("sound-toggle")).toHaveAttribute("aria-checked", "true");

  await page.getByTestId("rename").click();
  await page.getByTestId("rename-input").fill("새 이름");
  await page.getByTestId("rename-save").click();
  await expect(page.getByTestId("id-nickname")).toHaveText("새 이름");

  await page.reload();
  await expect(page.getByTestId("id-nickname")).toHaveText("새 이름");
  await expect(page.getByTestId("sound-toggle")).toHaveAttribute("aria-checked", "true");
});

test.describe("모션 줄이기 설정", () => {
  test.use({ reducedMotion: "reduce" });

  test("연출 없이도 시험 합격과 승급까지 진행된다", async ({ page }) => {
    await preset(page, "exam-ready");
    await page.getByTestId("exam-cta").click();
    await page.getByTestId("open-envelope").click();
    await expect(page.getByTestId("play-screen")).toBeVisible();
    await placeByTap(page, "doyun", 0);
    await placeByTap(page, "minjae", 1);
    await placeByTap(page, "sea", 2);
    await placeByTap(page, "harin", 3);
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("ceremony")).toHaveAttribute("data-done", "true");
    await expect(page.getByTestId("ceremony-skip")).toHaveCount(0);
    await page.getByTestId("ceremony-done").click();
    await expect(page.getByTestId("home-rank")).toHaveText("D급 초급 탐정");
  });
});
