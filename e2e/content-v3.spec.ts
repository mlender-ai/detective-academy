import { expect, test, type Page } from "@playwright/test";
import { ALL_PUZZLES, DAILY_CALENDAR, PUZZLE_BY_ID } from "../src/data/puzzles";
import { PROMOTION_RULES } from "../src/data/ranks";
import { ADDED_SET } from "../src/data/sets/additions";
import { DAILY_WEEK_2 } from "../src/data/sets/dailyWeek2";
import { addDays } from "../src/engine/time";
import type { Puzzle } from "../src/engine/types";
import { expectLayoutOk, preset, stored, toDesk, toSafe } from "./helpers";
import { patchState, solve, submitWrong } from "./solve";

/**
 * 첫 공개 버전에서 더한 문제 14개(일일 6 · 연습실 6 · D→C 시험 1 · 특수 도전 1)를 실제 화면의 조작으로 끝까지 푼다.
 * 홈을 거치지 않고 주소로 바로 연다: 일일 문제는 날짜를 옮겨서(?demo=1&date=), 연습 과제는 #/practice/<이름표> 로, 시험 문제는 시험실에서.
 * 정답이 하나뿐인지, 군더더기가 없는지, 해설이 맞는지는 단위 테스트(src/tests/content-v3.test.ts)가 전수 탐색으로 확인한다.
 * 여기서는 "화면에서 정답을 넣을 수 있는가, 오답은 정답을 드러내지 않는가, 보상이 한 번 들어오는가, 낮은 화면에서 더 넘치지 않는가"를 본다.
 */

const NEW: Puzzle[] = [...DAILY_WEEK_2, ...ADDED_SET];
const dateOf = (puzzle: Puzzle) => addDays(DAILY_CALENDAR.start, DAILY_CALENDAR.order.indexOf(puzzle.id));

/** 봉투를 열고 첫 문제가 뜰 때까지 기다린다 */
async function openEnvelope(page: Page) {
  await page.getByTestId("open-envelope").click();
  await page.getByTestId("open-envelope").click({ timeout: 800 }).catch(() => undefined);
  await expect(page.getByTestId("play-screen")).toBeVisible();
}

async function openSheet(page: Page) {
  await page.getByTestId("open-sheet").click();
  await page.getByTestId("open-sheet").click({ timeout: 800 }).catch(() => undefined);
  await expect(page.getByTestId("play-screen")).toBeVisible();
}

/** 풀이 화면에서 정답 단추가 아닌, 그 유형의 화면이 다 떴는지 알려 주는 것 */
const anchorOf = (puzzle: Puzzle) => (puzzle.type === "code" ? '[data-testid="to-safe"]' : '[data-testid="hint-button"]');

/** 오답은 정답을 드러내지 않고, 정답은 채점 결과로 넘어가 보상을 한 번 준다 */
async function wrongThenRight(page: Page, puzzle: Puzzle) {
  const before = (await stored(page)).credits;
  await submitWrong(page, puzzle);
  await expect(page.getByTestId("notice-wrong")).toBeVisible();
  await expect(page.getByTestId("solution")).toHaveCount(0);
  expect((await stored(page)).puzzles[puzzle.id]).toMatchObject({ status: "in_progress", attempts: 1 });
  await solve(page, puzzle);
  await expect(page.getByTestId("result-screen")).toBeVisible();
  await expect(page.getByTestId("reward")).toContainText(`+${puzzle.reward}`);
  await expect(page.getByTestId("solution")).toBeVisible();
  const after = await stored(page);
  expect(after.credits).toBe(before + puzzle.reward);
  expect(after.puzzles[puzzle.id]).toMatchObject({ status: "solved", solvedAttempts: 2, solvedHints: 0, rewardClaimed: true });
  // 닫는 글이 찍히고, 풀이 과정이 문제의 것만큼 펼쳐진다
  await expect(page.getByTestId("result-outro")).toContainText(puzzle.outro!.split(". ")[0]);
  await page.getByTestId("explain-toggle").click();
  await expect(page.getByTestId("explain-steps").locator("li")).toHaveCount(puzzle.explanation.length);
}

test.describe("오늘의 추리: 둘째 주의 여섯 문제", () => {
  test("달력의 9~14일째(11월 30일~12월 5일)에 새 문제가 차례로 붙는다", async ({ page }) => {
    await preset(page, "daily-unsolved");
    for (const puzzle of DAILY_WEEK_2) {
      await page.goto(`/?demo=1&date=${dateOf(puzzle)}`);
      await expect(page.getByTestId("daily-file"), dateOf(puzzle)).toContainText(puzzle.title);
      await expect(page.getByTestId("daily-file-status")).toHaveText("미해결");
    }
    // 앞 여덟 날의 배정은 그대로다
    await page.goto("/?demo=1&date=2026-11-29");
    await expect(page.getByTestId("daily-file")).toContainText("다시 붙은 봉투의 인장");
    await page.goto("/?demo=1&date=2026-11-23");
    await expect(page.getByTestId("daily-file")).toContainText("사라진 자료실 열쇠");
  });

  for (const puzzle of DAILY_WEEK_2) {
    test(`일일 문제를 화면의 조작으로 푼다: ${puzzle.id} (${dateOf(puzzle)})`, async ({ page }) => {
      const date = dateOf(puzzle);
      await preset(page, "daily-unsolved", `&date=${date}`);
      await page.goto(`/?demo=1&date=${date}#/daily`);
      await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", puzzle.type);
      await expectLayoutOk(page, anchorOf(puzzle));
      await wrongThenRight(page, puzzle);
      const state = await stored(page);
      expect(state.puzzles[puzzle.id].solvedDateKey).toBe(date);
      // 입학 40 + 오늘의 추리 60
      expect(state.credits).toBe(100);

      // 같은 날 다시 들어오면 해결로 남아 있고, 보상은 다시 주지 않는다
      await page.goto(`/?demo=1&date=${date}`);
      await expect(page.getByTestId("daily-file-status")).toHaveText("해결");
      expect((await stored(page)).credits).toBe(100);
      // 다음 날로 넘어가도 그 기록은 그대로 남는다
      await page.goto(`/?demo=1&date=${addDays(date, 1)}`);
      await expect(page.getByTestId("home-screen")).toBeVisible();
      expect((await stored(page)).puzzles[puzzle.id]).toMatchObject({ status: "solved", solvedDateKey: date });
    });
  }
});

test.describe("연습실: 더한 여섯 과제와 특수 도전", () => {
  const PRESET = { F: "daily-unsolved", D: "promoted", C: "ready-b" } as const;

  for (const puzzle of ADDED_SET.filter((p) => p.category === "practice")) {
    test(`연습 과제를 그 등급에서 화면의 조작으로 푼다: ${puzzle.id}`, async ({ page }) => {
      // 그 과제의 서랍이 막 열린 등급으로 들어간다(F 는 입학 직후, D·C 는 승급 직후)
      await preset(page, PRESET[puzzle.rank as "F" | "D" | "C"]);
      await patchState(page, (state) => {
        delete (state.puzzles as Record<string, unknown>)[puzzle.id];
      });
      expect((await stored(page)).rank).toBe(puzzle.rank);
      await page.goto(`/?demo=1#/practice/${puzzle.id}`);
      await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", puzzle.type);
      await expectLayoutOk(page, anchorOf(puzzle));
      await wrongThenRight(page, puzzle);

      // 다시 열어도 보상은 한 번뿐이다
      const credits = (await stored(page)).credits;
      await page.goto(`/?demo=1#/practice/${puzzle.id}`);
      await expect(page.getByTestId("play-screen").or(page.getByTestId("result-screen")).first()).toBeVisible();
      expect((await stored(page)).credits).toBe(credits);
    });
  }

  test("윗등급의 과제는 주소로도 열리지 않는다(특수 도전은 C급의 서랍에 있다)", async ({ page }) => {
    await preset(page, "promoted");
    for (const id of ["practice-truth-c", "practice-evidence-c", "special-code-001"]) {
      await page.goto(`/?demo=1#/practice/${id}`);
      await expect(page.getByTestId("practice-room")).toBeVisible();
      await expect(page.getByTestId("play-screen")).toHaveCount(0);
    }
  });
});

test.describe("승급 시험 D→C: 세 문제", () => {
  test("암호 · 진술에 이어 셋째 문제(증거 조합)를 화면의 조작으로 풀어 C급에 오른다", async ({ page }) => {
    test.slow();
    const rule = PROMOTION_RULES.find((r) => r.from === "D")!;
    const puzzles = rule.examPuzzleIds.map((id) => PUZZLE_BY_ID[id]);
    expect(puzzles.map((p) => p.id)).toEqual(["exam-code-d-c", "exam-truth-d-c", "exam-evidence-d-c"]);

    await preset(page, "ready-c");
    await page.goto("/?demo=1#/exam");
    await expect(page.getByTestId("exam-gate")).toBeVisible();
    // 시험 규칙을 시작 전에 알려 준다: 세 문제, 유형 셋
    await expect(page.getByTestId("exam-facts")).toContainText("3문제");
    await expect(page.getByTestId("exam-facts")).toContainText("암호, 진술, 증거");
    const before = (await stored(page)).credits;
    await openEnvelope(page);

    for (let i = 0; i < puzzles.length; i++) {
      if (i > 0) {
        await expect(page.getByTestId("exam-between")).toBeVisible();
        await expect(page.getByTestId("room-note")).toHaveText(`${i}/3 통과`);
        await openSheet(page);
      }
      await expect(page.getByTestId("play-title")).toHaveText(`승급 시험 ${i + 1}/3`);
      await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", puzzles[i].type);
      if (i < 2) {
        await solve(page, puzzles[i]);
        continue;
      }
      // 셋째 문제: 수사 지원을 쓸 수 있는 시험이다. 오답은 응시를 끝내지 않는다(제출 제한이 없다).
      await expect(page.getByTestId("hint-button").first()).toBeEnabled();
      await expectLayoutOk(page, '[data-testid="hint-button"]');
      await submitWrong(page, puzzles[i]);
      await expect(page.getByTestId("notice-wrong")).toBeVisible();
      expect((await stored(page)).exam).toMatchObject({ index: 2, stage: "playing", status: "active" });
      // 새로고침해도 같은 문제에서 잇는다
      await page.reload();
      await expect(page.getByTestId("play-title")).toHaveText("승급 시험 3/3");
      await solve(page, puzzles[i]);
    }

    await expect(page.getByTestId("ceremony")).toBeVisible();
    await expect(page.getByTestId("ceremony-title")).toHaveText("C급 정식 탐정");
    const after = await stored(page);
    expect(after).toMatchObject({ rank: "C", exam: null, credits: before + rule.reward });
    expect(after.puzzles["exam-evidence-d-c"]).toMatchObject({ status: "solved", solvedAttempts: 2 });
  });
});

/* ───────── 낮은 화면: 새 문제는 같은 유형의 기존 문제보다 더 넘치지 않는다 ───────── */

/** 풀이 화면에서 세로로 넘치는 양(px). 스크롤되는 곳이 여럿이면 가장 큰 값. */
async function overflowOf(page: Page): Promise<number> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(450); // 화면 전환·진입 모션이 끝난 뒤에 잰다
  return page.evaluate(() => {
    const screen = document.querySelector('[data-testid="play-screen"]');
    const inner = screen ? [screen, ...screen.querySelectorAll("*")] : [];
    const scrollers = inner.filter((el) => ["auto", "scroll"].includes(getComputedStyle(el).overflowY));
    const all = [document.scrollingElement!, ...scrollers];
    return Math.max(0, ...all.map((el) => Math.ceil(el.scrollHeight - el.clientHeight)));
  });
}

/** 그 문제를 처음 상태로 연다(모든 서랍이 열려 있고 아무것도 풀지 않은 상태) */
async function openFresh(page: Page, puzzle: Puzzle) {
  if (puzzle.category === "daily") await page.goto(`/?demo=1&date=${dateOf(puzzle)}#/daily`);
  else await page.goto(`/?demo=1#/practice/${puzzle.id}`);
  await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", puzzle.type);
}

/** 유형마다 화면이 가장 길어지는 상태까지 가며 넘치는 양을 잰다 */
async function measure(page: Page, puzzle: Puzzle): Promise<number> {
  await openFresh(page, puzzle);
  let worst = await overflowOf(page);
  const also = async () => {
    worst = Math.max(worst, await overflowOf(page));
  };
  switch (puzzle.type) {
    case "code":
      await toSafe(page);
      await also();
      await toDesk(page);
      break;
    case "truth":
      // 한 사람을 고르면 진술마다 참·거짓 메모가 열린다
      await page.getByTestId(`suspect-${puzzle.rules.people[0].id}`).click();
      await also();
      break;
    case "schedule":
      break;
    case "evidence": {
      // 글이 가장 긴 두 장을 집어 읽는 자리를 채운다
      const longest = [...puzzle.rules.cards].sort((a, b) => b.text.length - a.text.length).slice(0, 2);
      for (const card of longest) await page.getByTestId(`card-${card.id}`).click();
      await also();
      break;
    }
    case "spatial":
      await page.getByTestId(`stamp-${puzzle.rules.stamps[0].id}`).click();
      await also();
      break;
  }
  return worst;
}

for (const size of [
  { width: 390, height: 664 },
  { width: 375, height: 629 },
]) {
  test.describe(`낮은 화면 ${size.width}×${size.height}`, () => {
    test.use({ viewport: size });

    for (const type of ["code", "truth", "schedule", "evidence", "spatial"] as const) {
      test(`${type}: 새 문제는 같은 유형의 기존 문제보다 더 넘치지 않는다`, async ({ page }, info) => {
        test.slow();
        const open = (p: Puzzle) => p.type === type && p.category !== "exam";
        const fresh = NEW.filter(open);
        const old = ALL_PUZZLES.filter((p) => open(p) && !NEW.includes(p));
        expect(fresh.length).toBeGreaterThan(0);
        expect(old.length).toBeGreaterThan(0);

        // 모든 서랍이 열린 상태에서 풀이 기록을 모두 지운다(등급은 그대로 S)
        await preset(page, "rank-s");
        await patchState(page, (state) => {
          state.puzzles = {};
        });

        const sizes = new Map<string, number>();
        for (const puzzle of [...old, ...fresh]) sizes.set(puzzle.id, await measure(page, puzzle));
        const limit = Math.max(...old.map((p) => sizes.get(p.id)!));
        await info.attach("넘치는 양(px)", { body: JSON.stringify(Object.fromEntries(sizes), null, 2), contentType: "application/json" });
        for (const puzzle of fresh) {
          expect(sizes.get(puzzle.id)!, `${puzzle.id} 가 기존 ${type} 문제(최대 ${limit}px)보다 더 넘친다`).toBeLessThanOrEqual(limit + 1);
        }

        // 눈으로 볼 캡처(CONTENT_SHOTS 에 폴더를 주었을 때만 남긴다)
        const dir = process.env.CONTENT_SHOTS;
        if (dir) {
          for (const puzzle of fresh) {
            await openFresh(page, puzzle);
            await overflowOf(page);
            await page.screenshot({ path: `${dir}/${size.width}x${size.height}-${puzzle.id}.png`, animations: "disabled", style: ".demo { visibility: hidden !important; }" });
          }
        }
      });
    }
  });
}
