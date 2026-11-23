import { expect, test, type Page } from "@playwright/test";
import { PRACTICE_PUZZLES, PUZZLE_BY_ID, practiceOfRank } from "../src/data/puzzles";
import { PROMOTION_RULES, rankLabel } from "../src/data/ranks";
import type { Puzzle } from "../src/engine/types";
import { enterFromHome, expectLayoutOk, gameNowMs, offToneRatio, preset, shot, stored, TEST_DATE } from "./helpers";
import { patchState, solve, submitWrong } from "./solve";

/**
 * 콘텐츠와 성장 시스템 (V3 GATE 05).
 * 날짜별 오늘의 추리, 등급별 연습실 서류함, F→S 승급 시험(제한 시간 · 제출 횟수 · 하루 응시 횟수).
 * 새 문제 28개는 화면의 조작만으로 끝까지 풀어 본다(e2e/solve.ts). 정답이 하나뿐인지는 단위 테스트가 전수 탐색으로 확인한다.
 */

const rule = (from: string) => PROMOTION_RULES.find((r) => r.from === from)!;
const examPuzzles = (from: string) => rule(from).examPuzzleIds.map((id) => PUZZLE_BY_ID[id]);

/** 홈의 아래 창(지금 고른 곳의 이야기). 오늘의 추리를 풀지 않은 날에는 게시판이 골라져 있어 그날의 문제가 적혀 있다. */
const card = (page: Page) => page.locator('.isocard[data-spot="board"]');
/** 홈의 시험실 문에 적힌 상태 */
const examState = (page: Page, id: "exam-cta" | "exam-wait", text: RegExp) => expect(page.getByTestId(id)).toHaveAttribute("aria-label", text);
/** 연습실에서 그 등급의 서류함 앞으로 간다(탐정이 그 앞에 설 때까지 기다린다) */
async function toCabinet(page: Page, rank: string) {
  await page.getByTestId(`drawer-${rank}`).click();
  await expect(page.getByTestId("practice-room")).toHaveAttribute("data-at", rank);
}

/** 시험실로 간다 (홈을 거치지 않고 주소로) */
async function toExam(page: Page, id: Parameters<typeof preset>[1], query = "") {
  await preset(page, id, query);
  await page.goto(`/?demo=1${query}#/exam`);
}

/** 봉투를 열고 첫 문제가 뜰 때까지 기다린다 */
async function openEnvelope(page: Page) {
  await page.getByTestId("open-envelope").click();
  // 뜯는 연출 중에 한 번 더 누르면 바로 넘어간다
  await page.getByTestId("open-envelope").click({ timeout: 800 }).catch(() => undefined);
  await expect(page.getByTestId("play-screen")).toBeVisible();
}

async function openSheet(page: Page) {
  await page.getByTestId("open-sheet").click();
  await page.getByTestId("open-sheet").click({ timeout: 800 }).catch(() => undefined);
  await expect(page.getByTestId("play-screen")).toBeVisible();
}

test.describe("오늘의 추리: 날짜별 배정", () => {
  test("날짜마다 정해진 문제가 붙고, 날짜를 넘기면 새 문제가 미해결로 붙는다", async ({ page }) => {
    await preset(page, "daily-solved");
    await expect(page.getByTestId("daily-file-status")).toHaveText("해결");
    expect((await stored(page)).puzzles["daily-code-001"].status).toBe("solved");
    const credits = (await stored(page)).credits;

    // QA 패널의 "다음 날로": 11월 23일의 문제는 일일 문제의 첫째다
    await page.getByTestId("demo-toggle").click();
    await expect(page.getByTestId("demo-date")).toContainText(TEST_DATE);
    await page.getByTestId("demo-next-day").click();
    await expect(page.getByTestId("demo-date")).toContainText("2026-11-23");
    await page.getByTestId("demo-toggle").click();
    await expect(page.getByTestId("daily-file-status")).toHaveText("미해결");
    await enterFromHome(page, "daily-file");
    await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", "evidence");
    await expect(page.locator(".exampaper__title, .casebrief__title").first()).toContainText("사라진 자료실 열쇠");

    // 그 문제를 풀면 보상은 그 문제의 것으로 한 번 받는다. 어제의 기록은 그대로다.
    await solve(page, PUZZLE_BY_ID["daily-evidence-001"]);
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await expect(page.getByTestId("reward")).toContainText("+60");
    const after = await stored(page);
    expect(after.credits).toBe(credits + 60);
    expect(after.puzzles["daily-code-001"].solvedDateKey).toBe("2026-11-22");
    expect(after.puzzles["daily-evidence-001"].solvedDateKey).toBe("2026-11-23");
  });

  test("주소의 ?demo=1&date= 로도 날짜를 옮길 수 있고, QA 주소가 아니면 듣지 않는다", async ({ page }) => {
    await preset(page, "daily-unsolved", "&date=2026-11-25");
    await expect(card(page)).toContainText("다시 잠긴 금고");
    // 아흐레째(11월 30일)에 첫 문제가 돌아오지 않는다: 둘째 주의 첫 문제가 붙는다
    await page.goto("/?demo=1&date=2026-11-30");
    await expect(card(page)).toContainText("번진 출발 명단");
    await expect(card(page)).not.toContainText("자료실 금고의 암호");
    // 달력의 마지막 날(12월 5일)까지 문제가 붙고, 그 다음 날에는 첫 문제가 다시 붙지 않는다(달력이 끝난 날은 daily-past.spec.ts)
    await page.goto("/?demo=1&date=2026-12-05");
    await expect(card(page)).toContainText("찢긴 잠복 교대표");
    await page.goto("/?demo=1&date=2026-12-06");
    await expect(page.getByTestId("daily-file-status")).toHaveText("준비 중");
    await page.getByTestId("daily-file").click();
    await expect(card(page)).toContainText("새 사건 준비 중");
    await expect(card(page)).not.toContainText("자료실 금고의 암호");
    // 엉뚱한 값은 무시한다
    await page.goto("/?demo=1&date=tomorrow");
    await expect(card(page)).toContainText("자료실 금고의 암호");
    await page.goto("/?date=2026-11-25");
    await expect(page.getByTestId("home-screen")).toBeVisible();
    await expect(card(page)).toContainText("자료실 금고의 암호");
  });
});

test.describe("연습실: 등급별 서류함", () => {
  test("지금 등급까지의 서류함만 열려 있고, 잠긴 서류함의 과제는 주소로도 열리지 않는다", async ({ page }) => {
    await preset(page, "daily-unsolved");
    await enterFromHome(page, "practice-entry");
    const room = page.getByTestId("practice-room");
    await expect(room).toBeVisible();
    // 연습 과제는 모두 스물둘이다(F 5 · D 5 · C 6 · B 3 · A 3)
    expect(PRACTICE_PUZZLES).toHaveLength(22);
    expect(["F", "D", "C", "B", "A"].map((r) => practiceOfRank(r as "F").length)).toEqual([5, 5, 6, 3, 3]);
    await expect(page.getByTestId("practice-total")).toHaveText("해결 0/22");
    // 들어서면 지금 등급(F)의 서류함 앞에 서고, 그 서류함의 과제 다섯이 놓여 있다
    await expect(room).toHaveAttribute("data-at", "F");
    await expect(page.locator(".isotask")).toHaveCount(5);
    await expect(page.getByTestId("drawer-count")).toHaveText("해결 0/5");
    await expect(page.getByTestId("drawer-F")).toHaveAttribute("data-locked", "false");
    for (const rank of ["D", "C", "B", "A"]) await expect(page.getByTestId(`drawer-${rank}`)).toHaveAttribute("data-locked", "true");
    await shot(page, "g5-practice-f");

    // 잠긴 서류함을 들여다보면 과제 대신 안내가 있다
    await toCabinet(page, "D");
    await expect(page.getByTestId("drawer-locked")).toContainText("D급 초급 탐정에 오르면");
    await expect(page.getByTestId("drawer-count")).toHaveText("잠김");
    await expect(page.locator(".isotask")).toHaveCount(0);
    await shot(page, "g5-practice-locked");

    await page.goto("/?demo=1#/practice/practice-schedule-d");
    await expect(page.getByTestId("practice-room")).toBeVisible();
    await expect(page.getByTestId("play-screen")).toHaveCount(0);
  });

  test("승급하면 새 서류함이 열리고, 문제를 풀고 돌아오면 같은 서류함에 해결 표시가 남는다", async ({ page }) => {
    await preset(page, "promoted");
    await enterFromHome(page, "practice-entry");
    const room = page.getByTestId("practice-room");
    // 풀지 않은 과제가 남은 가장 낮은 서류함 앞에 먼저 선다 (F 서류함에 셋이 남아 있다)
    await expect(room).toHaveAttribute("data-at", "F");
    await expect(page.getByTestId("drawer-count")).toHaveText("해결 2/5");
    await toCabinet(page, "D");
    await expect(page.getByTestId("drawer-D")).toHaveAttribute("data-locked", "false");
    await expect(page.locator(".isotask")).toHaveCount(5);

    const puzzle = PUZZLE_BY_ID["practice-truth-d"];
    await page.getByTestId(`practice-file-${puzzle.id}`).click();
    await expect(page.getByTestId("play-screen")).toBeVisible();
    await solve(page, puzzle);
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await expect(page.getByTestId("reward")).toContainText("+35");

    await page.goto("/?demo=1#/practice");
    await expect(room).toHaveAttribute("data-at", "D");
    await expect(page.getByTestId(`practice-status-${puzzle.id}`)).toHaveText("해결");
    await expect(page.getByTestId("drawer-count")).toHaveText("해결 1/5");
  });

  for (const puzzle of PRACTICE_PUZZLES.filter((p) => p.id !== "practice-truth-001")) {
    test(`연습 과제를 화면의 조작으로 푼다: ${puzzle.id}`, async ({ page }) => {
      // 모든 서류함이 열린 상태에서 이 과제의 기록만 지운다
      await preset(page, "rank-s");
      await patchState(page, (state) => {
        delete (state.puzzles as Record<string, unknown>)[puzzle.id];
      });
      const before = (await stored(page)).credits;
      await page.goto(`/?demo=1#/practice/${puzzle.id}`);
      await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", puzzle.type);
      await expectLayoutOk(page, puzzle.type === "code" ? '[data-testid="to-safe"]' : '[data-testid="hint-button"]');

      // 오답은 정답을 드러내지 않고, 정답은 보상을 한 번 준다
      await submitWrong(page, puzzle);
      await expect(page.getByTestId("notice-wrong")).toBeVisible();
      await expect(page.getByTestId("solution")).toHaveCount(0);
      await solve(page, puzzle);
      await expect(page.getByTestId("result-screen")).toBeVisible();
      await expect(page.getByTestId("reward")).toContainText(`+${puzzle.reward}`);
      await expect(page.getByTestId("solution")).toBeVisible();
      const after = await stored(page);
      expect(after.credits).toBe(before + puzzle.reward);
      expect(after.puzzles[puzzle.id]).toMatchObject({ status: "solved", solvedAttempts: 2 });
      // 풀이 과정이 문제의 것만큼 펼쳐진다
      await page.getByTestId("explain-toggle").click();
      await expect(page.getByTestId("explain-steps").locator("li")).toHaveCount(puzzle.explanation.length);
    });
  }
});

test.describe("승급 시험: 응시 조건과 안내", () => {
  test("과제 셋을 채우기 전에는 봉투가 열리지 않고, 무엇이 남았는지 보여 준다", async ({ page }) => {
    await preset(page, "daily-solved");
    await expect(page.getByTestId("promo-count")).toHaveText("1/3");
    await expect(page.getByTestId("exam-cta")).toHaveCount(0);
    await enterFromHome(page, "exam-wait");
    await expect(page.getByTestId("exam-locked")).toBeVisible();
    await expect(page.getByTestId("exam-need")).toHaveText("1/3");
    await expect(page.locator(".roomnote .meter i[data-on='true']")).toHaveCount(1);
    await expect(page.getByTestId("exam-facts")).toContainText("1문제");
    await expect(page.getByTestId("open-envelope")).toHaveCount(0);
    await page.getByTestId("exam-to-practice").click();
    await expect(page.getByTestId("practice-room")).toBeVisible();
  });

  test("시험마다 규칙을 시작 전에 알려 준다", async ({ page }) => {
    const expected: [Parameters<typeof preset>[1], string[]][] = [
      ["exam-ready", ["1문제", "시간제한 없음", "제출제한 없음", "수사 지원쓸 수 있음", "+80"]],
      ["ready-c", ["3문제", "암호, 진술, 증거", "+100"]],
      ["ready-b", ["3문제", "15분 안에 모두 풀기", "제출제한 없음", "수사 지원쓸 수 있음", "하루 3번 · 오늘 3번 남음", "+120"]],
      ["ready-a", ["4문제", "시간제한 없음", "문제마다 3번 · 진술은 2번", "수사 지원쓸 수 없음", "하루 2번", "+160"]],
      ["ready-s", ["5문제", "25분 안에 모두 풀기", "문제마다 2번 · 진술은 1번", "하루 1번 · 오늘 1번 남음", "+200"]],
    ];
    for (const [id, texts] of expected) {
      await toExam(page, id);
      await expect(page.getByTestId("exam-gate")).toBeVisible();
      for (const text of texts) await expect(page.getByTestId("exam-facts")).toContainText(text);
    }
    await shot(page, "g5-exam-gate-s");
  });
});

test.describe("승급 시험: 여러 문제를 차례로", () => {
  test("D→C: 세 문제를 차례로 풀고, 문제 사이에서 새로고침해도 그 자리에서 잇는다", async ({ page }) => {
    test.slow();
    const [first, second, third] = examPuzzles("D");
    expect(examPuzzles("D")).toHaveLength(3);
    await preset(page, "ready-c");
    const before = (await stored(page)).credits;
    await examState(page, "exam-cta", /C급 응시 가능/);
    await enterFromHome(page, "exam-cta");
    await expect(page.getByTestId("exam-gate")).toBeVisible();
    await openEnvelope(page);
    await expect(page.getByTestId("play-title")).toHaveText("승급 시험 1/3");
    // 제한 시간이 없는 시험은 흐른 시간을 보여 준다
    await expect(page.getByTestId("timer")).toBeVisible();
    await expect(page.getByTestId("countdown")).toHaveCount(0);

    // 푸는 중에 새로고침해도 같은 문제다
    await page.reload();
    await expect(page.getByTestId("play-title")).toHaveText("승급 시험 1/3");
    await solve(page, first);

    // 문제 사이: 다음 시험지를 펼치기 전
    await expect(page.getByTestId("exam-between")).toBeVisible();
    await expect(page.getByTestId("between-lead")).toContainText("1번 문제를 통과했습니다");
    await expect(page.getByTestId("room-note")).toHaveText("1/3 통과");
    expect((await stored(page)).exam).toMatchObject({ index: 1, stage: "ready", status: "active" });
    await shot(page, "g5-exam-between");
    await page.reload();
    await expect(page.getByTestId("exam-between")).toBeVisible();

    // 홈에 나갔다 와도 시험은 이어진다
    await page.goto("/?demo=1");
    await examState(page, "exam-cta", /C급 시험 중 1\/3/);
    await enterFromHome(page, "exam-cta");
    await expect(page.getByTestId("exam-between")).toBeVisible();

    await openSheet(page);
    await expect(page.getByTestId("play-title")).toHaveText("승급 시험 2/3");
    await solve(page, second);

    // 둘째 문제를 맞혀도 아직 승급이 아니다: 셋째 시험지가 기다린다
    await expect(page.getByTestId("exam-between")).toBeVisible();
    await expect(page.getByTestId("room-note")).toHaveText("2/3 통과");
    expect(await stored(page)).toMatchObject({ rank: "D", credits: before, exam: { index: 2, stage: "ready", status: "active" } });
    await openSheet(page);
    await expect(page.getByTestId("play-title")).toHaveText("승급 시험 3/3");
    await solve(page, third);
    await expect(page.getByTestId("ceremony")).toBeVisible();
    await expect(page.getByTestId("ceremony-title")).toHaveText("C급 정식 탐정");
    const after = await stored(page);
    expect(after).toMatchObject({ rank: "C", exam: null, credits: before + 100 });
    expect(after.promotions).toHaveLength(2);

    // 승급하면 다음 시험은 응시 전이다
    await page.getByTestId("ceremony-done").click();
    await expect(page.getByTestId("home-rank")).toHaveText("C급 정식 탐정");
    await examState(page, "exam-wait", /B급 과제/);
  });

  for (const from of ["C", "B", "A"]) {
    const r = rule(from);
    test(`${from}→${r.to}: ${r.examPuzzleIds.length}문제를 화면의 조작으로 모두 풀어 승급한다`, async ({ page }) => {
      test.slow();
      const puzzles = examPuzzles(from);
      await toExam(page, ({ C: "ready-b", B: "ready-a", A: "ready-s" } as const)[from as "C" | "B" | "A"]);
      const before = (await stored(page)).credits;
      await openEnvelope(page);
      for (let i = 0; i < puzzles.length; i++) {
        const puzzle: Puzzle = puzzles[i];
        if (i > 0) {
          await expect(page.getByTestId("exam-between")).toBeVisible();
          await openSheet(page);
        }
        await expect(page.getByTestId("play-title")).toHaveText(`승급 시험 ${i + 1}/${puzzles.length}`);
        await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", puzzle.type);
        // 제한 시간이 있으면 남은 시간이, 제출 횟수가 걸려 있으면 남은 횟수가 위 막대에 보인다
        if (r.exam.timeLimitSec !== null) await expect(page.getByTestId("countdown")).toHaveText(/^\d\d:\d\d$/);
        if (r.exam.submitsPerPuzzle !== null) await expect(page.getByTestId("submits-left")).toBeVisible();
        if (!r.exam.hints) await expect(page.getByTestId("hint-button").first()).toBeDisabled();
        await solve(page, puzzle);
      }
      await expect(page.getByTestId("ceremony")).toBeVisible();
      await expect(page.getByTestId("ceremony-title")).toHaveText(rankLabel(r.to));
      const after = await stored(page);
      expect(after).toMatchObject({ rank: r.to, exam: null, credits: before + r.reward });
      for (const puzzle of puzzles) expect(after.puzzles[puzzle.id]).toMatchObject({ status: "solved", solvedAttempts: 1, solvedHints: 0 });
      if (from === "A") {
        await shot(page, "g5-ceremony-s");
        // 최고 등급: 더 치를 시험이 없고, 시험실에는 합격 기록이 남는다
        await page.getByTestId("ceremony-done").click();
        await expect(page.getByTestId("home-rank")).toHaveText("S급 명예 탐정");
        await enterFromHome(page, "exam-record");
        await expect(page.getByTestId("exam-passed")).toBeVisible();
        await expect(page.locator(".roomnote--record")).toHaveCount(5);
      }
    });
  }
});

test.describe("승급 시험: 제한 시간", () => {
  test("C→B: 남은 시간이 줄고, 새로고침해도 되돌아가지 않으며, 시간이 끝나면 떨어지고 등급은 그대로다", async ({ page }) => {
    await toExam(page, "ready-b");
    await expect(page.getByTestId("attempts-left")).toContainText("오늘 3번 남음");
    await openEnvelope(page);
    const read = async () => {
      const [m, s] = (await page.getByTestId("countdown").textContent())!.split(":").map(Number);
      return m * 60 + s;
    };
    const first = await read();
    expect(first).toBeGreaterThan(14 * 60 + 50);
    expect(first).toBeLessThanOrEqual(15 * 60);
    await expect.poll(read, { timeout: 5000 }).toBeLessThan(first);
    // 응시 횟수는 봉투를 연 때 이미 하나 썼다
    expect((await stored(page)).examDays.C).toMatchObject({ dateKey: TEST_DATE, count: 1 });

    // 새로고침: 남은 시간은 이어서 줄어든다(처음으로 돌아가지 않는다)
    const beforeReload = await read();
    await page.reload();
    await expect(page.getByTestId("countdown")).toBeVisible();
    expect(await read()).toBeLessThanOrEqual(beforeReload);
    expect((await stored(page)).examDays.C.count).toBe(1);

    // 1분 아래로 내려가면 남은 시간이 깜빡인다. 시간이 끝나면 시험실이 '시험 종료'로 바뀐다.
    const now = gameNowMs();
    await patchState(page, (state) => {
      const exam = state.exam as { remainingMs: number; runningSince: number };
      exam.remainingMs = 2500;
      exam.runningSince = now;
    });
    await expect(page.getByTestId("exam-failed")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("failed-title")).toHaveText("시간이 끝났습니다");
    await expect(page.getByTestId("failed-lead")).toContainText("등급은 C급 정식 탐정 그대로입니다");
    await expect(page.getByTestId("failed-progress")).toHaveText("0/3문제");
    await expect(page.getByTestId("attempts-left")).toContainText("오늘 2번 남음");
    await expectLayoutOk(page, '[data-testid="failed-retry"]');
    await shot(page, "g5-exam-failed-time");
    expect((await stored(page)).rank).toBe("C");

    // 홈에도 시험이 끝났다고 적혀 있다
    await page.goto("/?demo=1");
    await examState(page, "exam-cta", /B급 시험 종료/);
    await enterFromHome(page, "exam-cta");
    await expect(page.getByTestId("exam-failed")).toBeVisible();

    // 다시 응시: 봉투부터, 제한 시간도 처음부터
    await page.getByTestId("failed-retry").click();
    await expect(page.getByTestId("exam-gate")).toBeVisible();
    await expect(page.getByTestId("attempts-left")).toContainText("오늘 2번 남음");
    await openEnvelope(page);
    expect(await read()).toBeGreaterThan(14 * 60 + 50);
    expect((await stored(page)).examDays.C.count).toBe(2);
  });

  test("하루 응시 횟수를 다 쓰면 봉투가 열리지 않고, 날짜가 바뀌면 다시 열린다", async ({ page }) => {
    await preset(page, "ready-b");
    await patchState(page, (state) => {
      state.examDays = { C: { dateKey: "2026-11-22", count: 3 } };
    });
    await expect(page.getByTestId("exam-cta")).toHaveCount(0);
    await examState(page, "exam-wait", /오늘 응시 끝/);
    await enterFromHome(page, "exam-wait");
    await expect(page.getByTestId("exam-gate")).toBeVisible();
    await expect(page.getByTestId("attempts-left")).toContainText("오늘 0번 남음");
    await expect(page.getByTestId("open-envelope")).toHaveCount(0);
    await expect(page.getByTestId("exam-blocked")).toBeVisible();

    // 다음 날: 횟수가 돌아온다
    await page.getByTestId("demo-toggle").click();
    await page.getByTestId("demo-next-day").click();
    await page.getByTestId("demo-toggle").click();
    await expect(page.getByTestId("attempts-left")).toContainText("오늘 3번 남음");
    await expect(page.getByTestId("open-envelope")).toBeVisible();
  });

  test("문제 사이에서는 시계가 멈춰 있다", async ({ page }) => {
    const [first] = examPuzzles("C");
    await toExam(page, "ready-b");
    await openEnvelope(page);
    await solve(page, first);
    await expect(page.getByTestId("exam-between")).toBeVisible();
    const shown = await page.getByTestId("between-time").textContent();
    const saved = (await stored(page)).exam;
    expect(saved).toMatchObject({ stage: "ready", runningSince: null });
    await page.waitForTimeout(2200);
    await page.reload();
    await expect(page.getByTestId("between-time")).toHaveText(shown!);
    expect((await stored(page)).exam.remainingMs).toBe(saved.remainingMs);
  });
});

test.describe("승급 시험: 제출 횟수", () => {
  test("B→A: 수사 지원이 없고, 한 문제에서 세 번을 다 쓰면 떨어진다", async ({ page }) => {
    const [first] = examPuzzles("B");
    await toExam(page, "ready-a");
    await openEnvelope(page);
    await expect(page.getByTestId("submits-left")).toHaveAttribute("data-left", "3");
    // 수사 지원 단추는 눌리지 않는다 (암호 문제는 책상 앞에 있다)
    await expect(page.getByTestId("hint-button")).toBeDisabled();
    await expect(page.getByTestId("hint-button")).toHaveText("수사 지원 없음");
    await shot(page, "g5-exam-nohint");

    await submitWrong(page, first);
    await expect(page.getByTestId("notice-wrong")).toBeVisible();
    await expect(page.getByTestId("notice-left")).toContainText("남은 제출은 2번");
    await expect(page.getByTestId("submits-left")).toHaveAttribute("data-left", "2");
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("submits-left")).toHaveAttribute("data-left", "1");
    // 새로고침해도 쓴 횟수는 돌아오지 않는다
    await page.reload();
    await expect(page.getByTestId("submits-left")).toHaveAttribute("data-left", "1");
    await submitWrong(page, first);
    await expect(page.getByTestId("exam-failed")).toBeVisible();
    await expect(page.getByTestId("failed-title")).toHaveText("제출을 다 썼습니다");
    await expect(page.getByTestId("attempts-left")).toContainText("오늘 1번 남음");
    expect(await stored(page)).toMatchObject({ rank: "B", exam: { status: "failed", failedBy: "submits" } });

    // 복도로 나가면 결과가 닫히고, 오늘 한 번 더 응시할 수 있다
    await page.getByTestId("failed-home").click();
    await expect(page.getByTestId("home-screen")).toBeVisible();
    expect((await stored(page)).exam).toBeNull();
    await examState(page, "exam-cta", /A급 응시 가능/);
  });

  test("A→S: 하루 한 번뿐인 시험에서 떨어지면 오늘은 다시 응시할 수 없다", async ({ page }) => {
    const [first] = examPuzzles("A");
    await toExam(page, "ready-s");
    await expect(page.getByTestId("attempts-left")).toContainText("오늘 1번 남음");
    await openEnvelope(page);
    await expect(page.getByTestId("countdown")).toBeVisible();
    const limit = await page.getByTestId("submits-left").getAttribute("data-left");
    for (let i = 0; i < Number(limit); i++) await submitWrong(page, first);
    await expect(page.getByTestId("exam-failed")).toBeVisible();
    await expect(page.getByTestId("attempts-left")).toContainText("오늘 0번 남음");
    await expect(page.getByTestId("failed-retry")).toHaveCount(0);
    await page.getByTestId("failed-home").click();
    await examState(page, "exam-wait", /S급 오늘 응시 끝/);
  });
});

test.describe("새 화면의 배치와 두 색", () => {
  for (const size of [
    { width: 390, height: 664 },
    { width: 375, height: 629 },
  ]) {
    test.describe(`${size.width}x${size.height}`, () => {
      test.use({ viewport: size });

      test("연습실, 시험 안내, 문제 사이, 시험 종료", async ({ page }) => {
        const check = async (name: string) => {
          await page.waitForTimeout(500);
          expect(await offToneRatio(page), `${name}: 두 색이 아닌 화소가 너무 많다`).toBeLessThan(0.005);
        };
        await preset(page, "ready-s");
        await page.goto("/?demo=1#/practice");
        await expect(page.getByTestId("practice-room")).toBeVisible();
        // 최고 등급 바로 아래(A급)에서 들어서면 풀지 않은 과제가 남은 가장 낮은 서류함 앞에 선다. 그 서류함의 과제가 모두 목록에 있다.
        const drawer = (await page.getByTestId("practice-room").getAttribute("data-drawer")) as "F";
        await expect(page.locator(".isotask")).toHaveCount(practiceOfRank(drawer).length);
        // 권하는 과제(풀지 않은 첫 과제)는 목록이 길어도 창 안에 보이고 눌린다(앞의 과제를 풀었으면 거기까지 밀려 있다)
        await expectLayoutOk(page, '.isotask[data-primary="true"]');
        // 과제가 몇이든 아래 창은 제 높이를 지킨다: 목록은 창 안에서 밀리고, 창은 화면 아래로도 방 쪽으로도 넘치지 않는다
        // (다섯여섯 줄인 서류함의 스크롤은 practice-list.spec.ts 가 따로 본다)
        const win = (await page.locator(".isowin--tasks").boundingBox())!;
        const list = (await page.getByTestId("practice-list").boundingBox())!;
        const stage = (await page.locator(".isostage").boundingBox())!;
        expect(win.y + win.height).toBeLessThanOrEqual(size.height);
        expect(list.y + list.height).toBeLessThanOrEqual(win.y + win.height);
        expect(list.y).toBeGreaterThanOrEqual(stage.y + stage.height);
        expect(await page.getByTestId("practice-room").evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
        await check("연습실");
        await shot(page, `g5-practice-${size.width}x${size.height}`);

        await page.goto("/?demo=1#/exam");
        await expectLayoutOk(page, '[data-testid="open-envelope"]');
        await check("시험 안내");
        await shot(page, `g5-exam-gate-${size.width}x${size.height}`);

        await openEnvelope(page);
        await check("시험 문제");
        await solve(page, examPuzzles("A")[0]);
        await expectLayoutOk(page, '[data-testid="open-sheet"]');
        await check("문제 사이");

        await openSheet(page);
        const second = examPuzzles("A")[1];
        const limit = Number(await page.getByTestId("submits-left").getAttribute("data-left"));
        for (let i = 0; i < limit; i++) await submitWrong(page, second);
        await expectLayoutOk(page, '[data-testid="failed-home"]');
        await check("시험 종료");
      });

      test("등급별 신분증과 휘장", async ({ page }) => {
        for (const id of ["daily-unsolved", "promoted", "ready-b", "ready-a", "ready-s", "rank-s"] as const) {
          await preset(page, id);
          await page.goto("/?demo=1#/profile");
          await expect(page.getByTestId("profile-screen")).toBeVisible();
          await expectLayoutOk(page, '[data-testid="rename"]');
          await page.waitForTimeout(400);
          expect(await offToneRatio(page), `${id}: 두 색이 아닌 화소가 너무 많다`).toBeLessThan(0.005);
          if (size.height === 664) await shot(page, `g5-idcard-${(await stored(page)).rank}`);
        }
      });
    });
  }
});
