import { expect, test, type Page } from "@playwright/test";
import { permutations } from "../src/engine/puzzleValidator";
import type { GameState } from "../src/engine/types";
import { SESSIONS } from "../src/story/cases/d001/logic";
import { differencesOf } from "../src/story/engine/storyEngine";
import type { ChapterProgress, DeduceScene, StoryChapter, StoryScene } from "../src/story/engine/storyTypes";
import { c, ch1, ch2, ch3, ch4, clearChapter, combos, correctDeductions, detective, logic, playToDeduction, sceneOfKind, upTo } from "../src/tests/story/d001-play";
import { PUZZLE_BY_ID, getDailyPuzzle, practiceOfRank } from "../src/data/puzzles";
import { PROMOTION_RULES } from "../src/data/ranks";
import type { RankId } from "../src/engine/types";
import { STORAGE_KEY, TEST_DATE, enroll, enterFromHome, expectLayoutOk, offToneRatio, preset, stored } from "./helpers";
import { solve as solvePuzzle } from "./solve";

/**
 * 사건 수사 · CASE D-001 의 제2~4장과 사건 해결까지를 화면의 조작으로 확인한다.
 * 답은 여기에 적어 두지 않는다: 사건 자료(장면의 카드 · 기록 · 줄)와 장마다의 판정(logicOf)에 물어, 맞는 것과 틀린 것을 찾아 누른다.
 * 자료를 고쳐 답이 달라지면 이 테스트도 달라진 답을 누른다. 사건의 논리 자체는 src/tests/story/ 가 전수로 본다.
 */

const TOTAL = c.chapters.reduce((sum, ch) => sum + ch.reward, 0) + (c.reward ?? 0);

/** 저장된 그 장의 진행 */
const chapterOf = (page: Page, ch: StoryChapter): Promise<ChapterProgress> =>
  page.evaluate(([key, id]) => JSON.parse(window.localStorage.getItem(key) ?? "null")?.story?.chapters?.[id] ?? null, [STORAGE_KEY, `${c.id}/${ch.id}`] as const);

/** 엔진으로 만든 상태를 저장 칸에 넣고 연다. 새로고침해도 다시 덮어쓰지 않는다(그 뒤의 진행이 남는다). */
async function open(page: Page, state: GameState, hash = `#/story/${c.id}`) {
  await page.addInitScript(([key, value]) => {
    if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, value);
  }, [STORAGE_KEY, JSON.stringify(state)] as const);
  await page.goto(`/${hash}`);
}

/** 그 장의 도입을 넘겨 첫 장면에 선다 */
async function start(page: Page, ch: StoryChapter) {
  await open(page, upTo(ch), `#/story/${c.id}/${ch.id}`);
  await expect(page.getByTestId("story-intro-title")).toHaveText(ch.title);
  await page.getByTestId("story-intro-skip").click();
  await expect(page.getByTestId("story-screen")).toHaveAttribute("data-scene", ch.scenes[0].id);
}

const gainOk = async (page: Page) => {
  await expect(page.getByTestId("evidence-gain")).toBeVisible();
  await page.getByTestId("evidence-gain-ok").click();
  await expect(page.getByTestId("evidence-gain")).toHaveCount(0);
};

/* ───────── 장면마다: 자료와 판정에서 답을 찾아 화면으로 낸다 ───────── */

/** 순서 장면의 맞는 순서 (하나여야 한다) */
function rightOrder(ch: StoryChapter, scene: Extract<StoryScene, { kind: "order" }>): string[] {
  const right = permutations(scene.cards.map((card) => card.id)).filter((order) => logic(ch).judgeOrder!(scene.id, order).correct);
  expect(right).toHaveLength(1);
  return right[0];
}

/** 지금 화면에 놓인 카드의 순서 */
const shownOrder = (page: Page) => page.locator(".olog__row").evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.card!));

/** 카드를 두 장씩 눌러 맞바꿔 그 순서로 만든다 */
async function arrange(page: Page, target: readonly string[]) {
  const now = await shownOrder(page);
  for (let i = 0; i < target.length; i++) {
    if (now[i] === target[i]) continue;
    const from = now.indexOf(target[i]);
    await page.getByTestId(`card-${target[i]}`).click();
    await expect(page.getByTestId(`card-${target[i]}`)).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId(`card-${now[i]}`).click();
    [now[i], now[from]] = [now[from], now[i]];
    await expect(page.getByTestId(`slot-${i + 1}`)).toHaveAttribute("data-card", target[i]);
  }
  expect(await shownOrder(page)).toEqual([...target]);
}

/** 타임라인의 줄마다 맞는 사람: 그 줄만 바꿔 보아 어긋나는 줄에 들지 않는 사람 */
function rightAssign(ch: StoryChapter, scene: Extract<StoryScene, { kind: "assign" }>, p: Pick<ChapterProgress, "evidence" | "facts">): Record<string, string> {
  const blank = Object.fromEntries(scene.rows.map((row) => [row.id, scene.options[0].id]));
  return Object.fromEntries(
    scene.rows.map((row) => {
      const right = scene.options.filter((option) => !logic(ch).judgeAssign!(scene.id, { ...blank, [row.id]: option.id }, p).wrong.includes(row.id));
      expect(right, `${row.id}: 맞는 사람은 하나여야 한다`).toHaveLength(1);
      return [row.id, right[0].id];
    }),
  );
}

/** 진술 장면에서 기록과 어긋나는 (진술, 기록) 짝 전부 */
const contradictionsOf = (ch: StoryChapter, scene: Extract<StoryScene, { kind: "testimony" }>) =>
  scene.statements.flatMap((statement) => scene.records.filter((record) => logic(ch).judgeConfront!(scene.id, statement.id, record.id).kind === "contradiction").map((record) => ({ statement, record })));

/** 그 진술을 고른다: 말한 사람을 누르고, 그 사람의 진술 가운데 그것을 누른다 */
async function pickStatement(page: Page, statement: { id: string; speaker: string }) {
  await page.getByTestId(`person-${statement.speaker}`).click();
  await page.getByTestId(`statement-${statement.id}`).click();
  await expect(page.getByTestId("statement")).toHaveAttribute("data-statement", statement.id);
}

/** 맞대어 볼 기록 한 줄을 고른다. 이미 골라져 있으면 그대로 둔다(한 번 더 누르면 내려놓는다) */
async function pickRecordLine(page: Page, id: string) {
  const line = page.getByTestId(`rec-${id}`);
  if ((await line.getAttribute("aria-checked")) !== "true") await line.click();
  await expect(line).toHaveAttribute("aria-checked", "true");
}

/** 장면 하나를 화면의 조작으로 끝낸다(최종 추론은 내지 않는다) */
async function playScene(page: Page, ch: StoryChapter, scene: StoryScene) {
  await expect(page.getByTestId("story-screen")).toHaveAttribute("data-scene", scene.id);
  switch (scene.kind) {
    case "timeline": {
      for (const point of scene.points.filter((x) => x.required)) {
        const shown = await page.getByTestId("stream").getAttribute("data-frame");
        if (point.frames && !point.frames.includes(shown!)) await page.getByTestId(`tick-${point.frames[0]}`).click();
        await page.getByTestId(`point-${point.id}`).click();
      }
      return gainOk(page);
    }
    case "records": {
      const ids = scene.records?.map((r) => r.id) ?? SESSIONS.map((s) => s.id);
      const right = ids.filter((id) => logic(ch).judgeRecord(scene.id, id).correct);
      expect(right).toHaveLength(1);
      await page.getByTestId(`record-${right[0]}`).click();
      await page.getByTestId("record-confirm").click();
      return gainOk(page);
    }
    case "link": {
      for (const link of scene.links) {
        await page.getByTestId(`item-${link.a}`).click();
        await page.getByTestId(`item-${link.b}`).click();
        await page.getByTestId("link-items").click();
      }
      return expect(page.getByTestId("fact-count")).toHaveText(`${scene.facts.length}/${scene.facts.length}`);
    }
    case "compare": {
      for (const d of differencesOf(scene)) {
        await page.getByTestId(`tab-${d.frame}`).click();
        await expect(page.getByTestId("compare")).toHaveAttribute("data-frame", d.frame);
        await page.getByTestId(`cmp-${d.field.id}-a`).click();
      }
      return gainOk(page);
    }
    case "order": {
      await arrange(page, rightOrder(ch, scene));
      await page.getByTestId("order-submit").click();
      return gainOk(page);
    }
    case "testimony": {
      for (const { statement, record } of contradictionsOf(ch, scene)) {
        await pickStatement(page, statement);
        await pickRecordLine(page, record.id);
        await page.getByTestId("confront").click();
      }
      return gainOk(page);
    }
    case "assign": {
      const right = rightAssign(ch, scene, await chapterOf(page, ch));
      for (const row of scene.rows) {
        await page.getByTestId(`row-${row.id}`).click();
        await page.getByTestId(`pick-${right[row.id]}`).click();
        await expect(page.getByTestId(`row-${row.id}`)).toHaveAttribute("data-who", right[row.id]);
      }
      await page.getByTestId("assign-submit").click();
      return expect(page.getByTestId("assign")).toHaveAttribute("data-solved", "true");
    }
    case "deduce":
      return;
  }
}

/** 최종 추론 앞까지: 장면을 차례로 끝내고 다음 장면으로 넘어간다 */
async function playToDeduce(page: Page, ch: StoryChapter) {
  for (const scene of ch.scenes) {
    if (scene.kind === "deduce") break;
    await playScene(page, ch, scene);
    await page.getByTestId("story-next").click();
  }
  await expect(page.getByTestId("deduce-submit")).toBeVisible();
}

async function choose(page: Page, choice: string, bases: readonly string[]) {
  await page.getByTestId(`choice-${choice}`).click();
  // 고른 근거를 모두 내려놓고 다시 고른다
  const held = await page.locator('.verdict__card[role="checkbox"][aria-checked="true"]').evaluateAll((cards) => cards.map((card) => (card as HTMLElement).dataset.testid!));
  for (const id of held) await page.getByTestId(id).click();
  for (const id of bases) await page.getByTestId(`basis-${id}`).click();
  for (const id of bases) await expect(page.getByTestId(`basis-${id}`)).toHaveAttribute("aria-checked", "true");
}

/** 판정이 correct 인 결론과 근거를 찾아 낸다 → 끝 장면 */
async function deduce(page: Page, ch: StoryChapter) {
  const right = correctDeductions(ch, await chapterOf(page, ch));
  expect(right.length).toBeGreaterThan(0);
  await choose(page, right[0].choice, right[0].bases);
  await page.getByTestId("deduce-submit").click();
  await expect(page.getByTestId("story-ending")).toBeVisible();
}

/** 그 장의 결론 가운데 판정이 verdict 인 (결론, 근거) 하나 */
function deductionWith(ch: StoryChapter, p: Pick<ChapterProgress, "evidence" | "facts">, verdict: "weak" | "unsupported") {
  const scene = sceneOfKind(ch, "deduce") as DeduceScene;
  const need = scene.need ?? 1;
  for (const choice of scene.choices)
    for (const bases of combos(scene.basis, need)) if (logic(ch).judgeDeduction(choice.id, need === 1 ? bases[0] : bases, p) === verdict) return { choice: choice.id, bases };
  throw new Error(`${ch.id}: ${verdict} 인 결론이 없다`);
}

const skipEnding = async (page: Page, ch: StoryChapter) => {
  await page.getByTestId("ending-skip").click();
  await expect(page.getByTestId("story-result")).toContainText(`CHAPTER 0${ch.no} CLEARED`);
};

/** 알림이 화면 안에(아래 단추 줄 위에) 보이는가 */
async function expectInView(page: Page, testId: string) {
  const box = (await page.getByTestId(testId).boundingBox())!;
  const foot = (await page.locator(".deskfoot").boundingBox())!;
  expect(box.y, `${testId} 가 위로 밀려 있다`).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height, `${testId} 가 아래 단추 줄에 가려진다`).toBeLessThanOrEqual(foot.y + 1);
}

test.describe("사건 전체", () => {
  test("처음부터 사건 해결까지: 네 장을 화면의 조작으로 이어서 푼다", async ({ page }) => {
    test.setTimeout(150_000);
    await preset(page, "promoted");
    const before = await stored(page);
    await expect(page.getByTestId("story-entry-status")).toHaveText("새 사건");
    await enterFromHome(page, "story-entry");
    await page.getByTestId("story-accept").click();

    for (const ch of c.chapters) {
      // 도입: 장의 제목과 도입 글. 건너뛸 수 있다
      await expect(page.getByTestId("story-intro-title")).toHaveText(ch.title);
      await page.getByTestId("story-intro-skip").click();
      await expect(page.getByTestId("story-title")).toContainText(`${ch.no}장`);
      await playToDeduce(page, ch);
      await deduce(page, ch);
      await skipEnding(page, ch);
      await expect(page.getByTestId("result-reward")).toHaveText(`+${ch.reward}`);
      for (const line of ch.ending.lines) await expect(page.getByTestId("story-result")).toContainText(line);
      if (ch.ending.next) {
        await expect(page.getByTestId("result-next")).toContainText(`제${ch.ending.next.no}장 · ${ch.ending.next.title}`);
        await page.getByTestId("result-continue").click();
      }
    }

    // 사건 해결: 마지막 장의 결과에 사건 해결과 사건 해결 보상이 찍힌다
    await expect(page.getByTestId("result-closing")).toHaveText(ch4.ending.closing!);
    await expect(page.getByTestId("result-case-reward")).toHaveText(`+${c.reward}`);
    await expect(page.getByTestId("result-continue")).toHaveCount(0);
    const after = await stored(page);
    expect(after.credits).toBe(before.credits + TOTAL);
    expect(after.story.cases[c.id].rewardClaimed).toBe(true);
    // 사건 해결은 등급과 승급 시험의 진행을 건드리지 않는다
    expect(after.rank).toBe(before.rank);
    expect(after.progress).toEqual(before.progress);
    expect(after.exam).toEqual(before.exam);

    await page.getByTestId("result-record").click();
    await expect(page.getByTestId("story-record")).toHaveAttribute("data-solved", "true");
    await expect(page.getByTestId("record-progress")).toContainText("사건 해결");
    for (const ch of c.chapters) await expect(page.getByTestId(`chapter-${ch.id}-status`)).toHaveText("해결");
    // 모은 증거를 다시 연다: 네 장의 증거가 모두 있다
    await page.getByTestId("record-evidence").click();
    const total = c.chapters.reduce((n, ch) => n + ch.evidence.length, 0);
    await expect(page.getByTestId("case-evidence").locator(".evcard")).toHaveCount(total);
    await page.getByTestId("case-evidence-close").click();
    await page.getByTestId("record-home").click();
    await expect(page.getByTestId("story-entry-status")).toHaveText("사건 해결");
    await enterFromHome(page, "story-entry");
    await expect(page.getByTestId("story-record")).toBeVisible();
  });

  test("장은 차례로 열린다: 잠긴 장은 누를 수 없고, 주소로 열어도 풀 차례의 곳으로 간다", async ({ page }) => {
    await open(page, upTo(ch2), `#/story/${c.id}/record`);
    await expect(page.getByTestId("story-record")).toBeVisible();
    await expect(page.getByTestId("chapter-ch2-status")).toHaveText("새 장");
    for (const ch of [ch3, ch4]) {
      const row = page.getByTestId(`chapter-${ch.id}`);
      await expect(row).toHaveAttribute("data-status", "locked");
      await expect(row).toContainText("앞 장을 해결하면 열린다");
      await expect(row.getByRole("button")).toHaveCount(0);
    }
    // 잠긴 장, 없는 장: 사건 기록(풀 차례의 장이 놓인 곳)이 열린다. 진행은 생기지 않는다
    for (const hash of [`#/story/${c.id}/${ch4.id}`, `#/story/${c.id}/ch9`, `#/story/${c.id}/__proto__`]) {
      await page.goto("about:blank");
      await page.goto(`/${hash}`);
      await expect(page.getByTestId("story-record")).toBeVisible();
      await expect(page.getByTestId("story-screen")).toHaveCount(0);
      expect(await chapterOf(page, ch4)).toBeNull();
    }
    // 없는 사건: 홈으로
    await page.goto("about:blank");
    await page.goto("/#/story/z999/ch1");
    await expect(page.getByTestId("home-screen")).toBeVisible();
    // 풀 차례의 장으로 이어 간다
    await page.goto("about:blank");
    await page.goto(`/#/story/${c.id}/record`);
    await page.getByTestId("record-continue").click();
    await expect(page.getByTestId("story-intro-title")).toHaveText(ch2.title);
  });

  test("처음 맡는 사건은 사건 기록 주소로 열어도 사건 접수부터 나온다", async ({ page }) => {
    await open(page, detective(), `#/story/${c.id}/record`);
    await expect(page.getByTestId("story-file")).toBeVisible();
    await expect(page.getByTestId("story-record")).toHaveCount(0);
  });

  test("뒤로 가기: 장면에서는 사건 기록으로, 사건 기록에서는 홀로. 브라우저의 뒤로는 사건에서 나간다", async ({ page }) => {
    await open(page, upTo(ch2), "#/");
    await expect(page.getByTestId("story-entry-status")).toHaveText("수사 중 · 1/4장");
    await enterFromHome(page, "story-entry");
    // 장과 장 사이: 사건 기록이 열리고, 거기서 다음 장으로 들어간다
    await expect(page.getByTestId("story-record")).toBeVisible();
    await page.getByTestId("chapter-ch2").click();
    await page.getByTestId("story-intro-skip").click();
    await expect(page.getByTestId("compare")).toBeVisible();
    await expect(page.getByTestId("story-back")).toHaveAttribute("aria-label", "사건 기록으로");
    await page.getByTestId("story-back").click();
    await expect(page.getByTestId("story-record")).toBeVisible();
    await expect(page.getByTestId("chapter-ch2-status")).toHaveText("수사 중");
    await expect(page.getByTestId("record-continue")).toHaveText("제2장 이어서 수사");
    await page.getByTestId("story-back").click();
    await expect(page.getByTestId("home-screen")).toBeVisible();
    // 풀던 장이 있으면 홈에서 곧바로 그 장면으로 들어간다
    await enterFromHome(page, "story-entry");
    await expect(page.getByTestId("compare")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("home-screen")).toBeVisible();
  });

  test("끝낸 장을 다시 풀어도 보상은 없고, 뒤의 장은 열린 채다. 그만두면 처음의 기록으로 돌아간다", async ({ page }) => {
    test.setTimeout(90_000);
    const solved = clearChapter(upTo(ch4), ch4);
    await open(page, solved, `#/story/${c.id}/record`);
    const credits = (await stored(page)).credits;
    await page.getByTestId("chapter-ch2").click();
    const first = await page.getByTestId("record-conclusion").textContent();
    await expect(page.getByTestId("record-replay-note")).toContainText("보상은 다시 받지 않는다");
    await page.getByTestId("record-replay").click();
    // 도입 없이 첫 장면부터, 처음 상태로
    await expect(page.getByTestId("compare-tally")).toContainText(`0/${differencesOf(sceneOfKind(ch2, "compare")).length}`);
    await expect(page.getByTestId("story-title")).toContainText("다시 풀기");
    expect((await chapterOf(page, ch2)).archive).not.toBeNull();
    // 새로고침해도 다시 풀던 그 장에서 잇는다
    await page.reload();
    await expect(page.getByTestId("compare")).toBeVisible();
    await page.getByTestId("story-back").click();
    // 다시 푸는 동안에도 사건은 해결된 채고, 뒤의 장도 해결된 채다. 처음의 기록은 그대로 읽힌다
    await expect(page.getByTestId("story-record")).toHaveAttribute("data-solved", "true");
    await expect(page.getByTestId("chapter-ch2-status")).toHaveText("해결 · 다시 푸는 중");
    await expect(page.getByTestId("chapter-ch3-status")).toHaveText("해결");
    await page.getByTestId("chapter-ch2").click();
    await expect(page.getByTestId("record-conclusion")).toHaveText(first!);
    // 그만두기: 처음의 기록으로 돌아간다
    await page.getByTestId("record-cancel").click();
    await expect(page.getByTestId("chapter-ch2-status")).toHaveText("해결");
    expect((await chapterOf(page, ch2)).archive).toBeNull();
    // 다시 풀어 끝까지: 보상은 0, 사건 해결 보상도 다시 받지 않는다
    await page.getByTestId("record-replay").click();
    await playToDeduce(page, ch2);
    await deduce(page, ch2);
    await expect(page.getByTestId("story-result")).toBeVisible();
    await expect(page.getByTestId("result-reward")).toHaveText(`+${ch2.reward} 받음`);
    expect((await stored(page)).credits).toBe(credits);
    await page.reload();
    expect((await stored(page)).credits).toBe(credits);
  });

  test("보상은 한 번만: 끝 장면에서 새로고침해도 다시 받지 않고, 결과가 다시 나온다", async ({ page }) => {
    await open(page, playToDeduction(upTo(ch2), ch2), `#/story/${c.id}/${ch2.id}`);
    const credits = (await stored(page)).credits;
    await deduce(page, ch2);
    expect((await stored(page)).credits).toBe(credits + ch2.reward);
    await page.reload();
    // 끝 장면을 다 보지 못했으면 그 장의 끝 장면부터 다시 나온다
    await expect(page.getByTestId("story-ending")).toBeVisible();
    await skipEnding(page, ch2);
    await expect(page.getByTestId("result-reward")).toHaveText(`+${ch2.reward}`);
    expect((await stored(page)).credits).toBe(credits + ch2.reward);
    await page.getByTestId("result-home").click();
    await expect(page.getByTestId("story-entry-status")).toHaveText("수사 중 · 2/4장");
  });
});

test.describe("제2장 · 사라진 원본", () => {
  test("비교: 같은 곳을 짚으면 틀린 것으로 세고, 달라진 곳은 두 화면에 함께 남는다", async ({ page }) => {
    await start(page, ch2);
    const scene = sceneOfKind(ch2, "compare");
    const all = differencesOf(scene);
    await expect(page.getByTestId("story-next")).toBeDisabled();
    await expect(page.getByTestId("compare-tally")).toContainText(`0/${all.length}`);
    // 두 화면이 같은 시점을 보여 준다
    const framed = scene.frames.find((f) => f.still)!;
    await page.getByTestId(`tab-${framed.id}`).click();
    await expect(page.locator(".cmp__screen .stream")).toHaveCount(2);
    // 같은 곳(값이 같은 칸)을 짚는다: 같다는 것을 듣고 틀린 횟수가 는다. 다시 눌러도 또 세지 않는다
    const same = framed.fields.find((f) => f.a === f.b)!;
    await page.getByTestId(`cmp-${same.id}-b`).click();
    await expect(page.getByTestId("narration")).toContainText(same.same.slice(0, 8));
    await expect(page.getByTestId(`cmp-${same.id}-a`)).toHaveAttribute("data-state", "same");
    expect((await chapterOf(page, ch2)).wrong).toBe(1);
    await page.getByTestId(`cmp-${same.id}-a`).click();
    expect((await chapterOf(page, ch2)).wrong).toBe(1);
    // 달라진 곳: 어느 쪽 화면을 눌러도 두 화면의 그 자리가 함께 남는다
    const diff = all[0];
    await page.getByTestId(`tab-${diff.frame}`).click();
    await page.getByTestId(`cmp-${diff.field.id}-b`).click();
    for (const side of ["a", "b"]) await expect(page.getByTestId(`cmp-${diff.field.id}-${side}`)).toHaveAttribute("data-state", "found");
    await expect(page.getByTestId("compare-tally")).toContainText(`1/${all.length}`);
    // 시점은 앞뒤 단추로도 넘긴다
    await page.getByTestId(`tab-${scene.frames[0].id}`).click();
    await page.getByTestId("compare-next").click();
    await expect(page.getByTestId("compare")).toHaveAttribute("data-frame", scene.frames[1].id);
    await page.getByTestId("compare-prev").click();
    await expect(page.getByTestId("compare")).toHaveAttribute("data-frame", scene.frames[0].id);
    // 수사 노트에 찾은 곳이 적힌다
    await page.getByTestId("notebook-open").click();
    await expect(page.getByTestId(`note-${diff.key}`)).toContainText(diff.field.note.slice(0, 8));
    // 앞 장의 증거도 여기서 다시 연다
    await page.getByTestId(`notebook-prev-${ch1.id}`).click();
    await expect(page.getByTestId("notebook").locator(".evcard")).toHaveCount(ch1.evidence.length);
    await page.getByTestId("notebook-close").click();

    // 새로고침: 찾은 곳이 남아 있고, 그 장면에서 잇는다
    await page.reload();
    await expect(page.getByTestId("compare-tally")).toContainText(`1/${all.length}`);
    await expect(page.getByTestId("story-intro")).toHaveCount(0);
    await playScene(page, ch2, scene);
    await expect(page.getByTestId("story-next")).toBeEnabled();
    await expect(page.getByTestId("narration")).toContainText(scene.done.slice(0, 10));
    expect((await chapterOf(page, ch2)).evidence).toEqual(expect.arrayContaining(scene.grants));
  });

  test("순서: 틀리면 어긋나는 까닭을 듣고 다시 놓는다. 끌어서도 옮기고, 놓은 순서는 남는다", async ({ page }) => {
    const scene = sceneOfKind(ch2, "order");
    const right = rightOrder(ch2, scene);
    await start(page, ch2);
    await playScene(page, ch2, sceneOfKind(ch2, "compare"));
    await page.getByTestId("story-next").click();
    await expect(page.getByTestId("order")).toBeVisible();
    await expect(page.getByTestId("order-rules").locator("li")).toHaveCount(scene.rules.length);
    // 처음 놓인 순서는 자료에 적힌 순서다(정답 순서가 아니다)
    expect(await shownOrder(page)).toEqual(scene.cards.map((card) => card.id));
    expect(scene.cards.map((card) => card.id)).not.toEqual(right);

    // 그대로 내면 틀린다: 어긋나는 까닭 하나를 듣는다(맞는 순서는 듣지 못한다)
    await page.getByTestId("order-submit").click();
    const reason = logic(ch2).judgeOrder!(scene.id, await shownOrder(page)).reason;
    await expect(page.getByTestId("order-wrong")).toHaveText(reason);
    await expectInView(page, "order-wrong");
    expect((await chapterOf(page, ch2)).wrong).toBe(1);
    await expect(page.getByTestId("story-next")).toHaveCount(0);

    // 끌어서 옮긴다: 맨 아래의 카드를 맨 위로 끌어 놓으면 사이의 카드가 한 칸씩 밀린다
    const before = await shownOrder(page);
    const from = (await page.getByTestId(`card-${before[before.length - 1]}`).boundingBox())!;
    const to = (await page.getByTestId(`card-${before[0]}`).boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 12, { steps: 3 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
    await page.mouse.up();
    expect(await shownOrder(page)).toEqual([before[before.length - 1], ...before.slice(0, -1)]);
    // 알림은 카드를 옮기면 걷힌다
    await expect(page.getByTestId("order-wrong")).toHaveCount(0);

    // 놓은 순서는 저장된다: 새로고침해도 그대로다
    const placed = await shownOrder(page);
    await page.reload();
    await expect(page.getByTestId("order")).toBeVisible();
    expect(await shownOrder(page)).toEqual(placed);

    await playScene(page, ch2, scene);
    await expect(page.getByTestId("order")).toHaveAttribute("data-solved", "true");
    await expect(page.getByTestId(`card-${right[0]}`)).toBeDisabled();
    await expect(page.getByTestId("story-next")).toBeEnabled();
  });

  test("최종 추론: 근거 둘을 함께 낸다. 약한 근거와 확정할 수 없는 결론은 통과하지 못한다", async ({ page }) => {
    await open(page, playToDeduction(upTo(ch2), ch2), `#/story/${c.id}/${ch2.id}`);
    const scene = sceneOfKind(ch2, "deduce") as DeduceScene;
    const p = await chapterOf(page, ch2);
    await expect(page.getByTestId("basis-label")).toContainText(`(0/${scene.need})`);
    // 근거를 하나만 내면: 둘을 고르라는 안내
    const right = correctDeductions(ch2, p)[0];
    await page.getByTestId(`choice-${right.choice}`).click();
    await page.getByTestId(`basis-${right.bases[0]}`).click();
    await page.getByTestId("deduce-submit").click();
    await expect(page.getByTestId("deduce-notice")).toContainText("증거 둘");
    expect((await chapterOf(page, ch2)).wrong).toBe(p.wrong);
    // 결론은 맞지만 근거가 받치지 못한다
    const weak = deductionWith(ch2, p, "weak");
    await choose(page, weak.choice, weak.bases);
    await page.getByTestId("deduce-submit").click();
    await expect(page.getByTestId("deduce-notice")).toContainText("근거가 약합니다");
    await expect(page.getByTestId("deduce-notice")).toContainText(scene.weak[weak.bases.find((id) => scene.weak[id])!].slice(0, 12));
    await expectInView(page, "deduce-notice");
    // 가진 기록으로 확정할 수 없는 결론
    const open2 = deductionWith(ch2, p, "unsupported");
    await choose(page, open2.choice, open2.bases);
    await page.getByTestId("deduce-submit").click();
    await expect(page.getByTestId("deduce-notice")).toContainText("확정할 수 없는 결론입니다");
    await expect(page.getByTestId("deduce-notice")).toContainText(scene.choices.find((x) => x.id === open2.choice)!.unsupported.slice(0, 12));
    await expect(page.getByTestId("story-ending")).toHaveCount(0);
    expect((await chapterOf(page, ch2)).wrong).toBe(p.wrong + 2);
    expect((await chapterOf(page, ch2)).status).toBe("in_progress");

    await deduce(page, ch2);
    // 끝 장면: 아래 영상의 제목이 눈앞에서 바뀐다 → 끝 글 → 새 기록 → 결과
    await expect(page.getByTestId("ending-label")).toHaveAttribute("data-swapped", "true", { timeout: 6_000 });
    await skipEnding(page, ch2);
    await expect(page.getByTestId("result-records")).toHaveText(`${ch2.evidence.length - 1}개 확인`);
  });

  test("수사 지원은 장면마다 따로 열고, 수사 크레딧이 그만큼 줄어든다", async ({ page }) => {
    await start(page, ch2);
    const credits = (await stored(page)).credits;
    const [first, second] = ch2.scenes;
    await page.getByTestId("story-hint-button").click();
    await page.getByTestId("story-hint-1-open").click();
    await expect(page.getByTestId("story-hint-1")).toContainText(first.hints![0].text.slice(0, 12));
    expect((await stored(page)).credits).toBe(credits - 20);
    await page.getByTestId("story-hint-2-open").click();
    await expect(page.getByTestId("story-hint-2")).toContainText(first.hints![1].text.slice(0, 12));
    expect((await stored(page)).credits).toBe(credits - 60);
    expect((await chapterOf(page, ch2)).sceneHints).toEqual({ [first.id]: 2 });
    await page.getByTestId("story-hints-close").click();
    await expect(page.getByTestId("story-hint-button")).toContainText("0");
    // 다음 장면의 수사 지원은 닫힌 채다
    await playScene(page, ch2, first);
    await page.getByTestId("story-next").click();
    await expect(page.getByTestId("story-hint-button")).toContainText("2");
    await page.getByTestId("story-hint-button").click();
    await expect(page.getByTestId("story-hint-1-open")).toBeEnabled();
    await page.getByTestId("story-hint-1-open").click();
    await expect(page.getByTestId("story-hint-1")).toContainText(second.hints![0].text.slice(0, 12));
    expect((await stored(page)).credits).toBe(credits - 80);
  });
});

test.describe("제3장 · 세 사람의 비밀", () => {
  test("진술 대조: 어긋나면 진술이 깨지고, 받치면 그렇다고 적히고, 아무것도 아니면 까닭을 듣는다", async ({ page }) => {
    await start(page, ch3);
    const scene = sceneOfKind(ch3, "testimony");
    const judge = (s: string, r: string) => logic(ch3).judgeConfront!(scene.id, s, r);
    const pairs = scene.statements.flatMap((s) => scene.records.map((r) => ({ statement: s, record: r, ...judge(s.id, r.id) })));
    // 세 사람이 이름표와 실루엣으로 구분되어 서 있다
    for (const person of scene.people) {
      await expect(page.getByTestId(`person-${person.id}`)).toContainText(person.name);
      await expect(page.getByTestId(`person-${person.id}`).locator(`.bust[data-bust="${person.id}"]`)).toBeVisible();
    }
    await expect(page.getByTestId("confront-tally")).toHaveText(`0/${scene.goal}`);
    // 기록을 고르지 않고 맞대면: 고르라는 안내
    await page.getByTestId("confront").click();
    await expect(page.getByTestId("confront-status")).toContainText("기록 한 줄을 고르세요");

    // 아무것도 말해 주지 않는 짝: 까닭을 듣는다. 채점하지 않는다(틀린 횟수가 늘지 않는다)
    const nothing = pairs.find((x) => x.kind === "nothing")!;
    await pickStatement(page, nothing.statement);
    await pickRecordLine(page, nothing.record.id);
    await page.getByTestId("confront").click();
    await expect(page.getByTestId("confront-status")).toContainText("말해 주는 것이 없다");
    expect((await chapterOf(page, ch3)).wrong).toBe(0);

    // 기록이 진술을 받치는 짝(알리바이)
    const supports = pairs.find((x) => x.kind === "supports")!;
    await pickStatement(page, supports.statement);
    await pickRecordLine(page, supports.record.id);
    await page.getByTestId("confront").click();
    await expect(page.getByTestId("confront-status")).toContainText(supports.text);
    await expect(page.getByTestId("statement")).toHaveAttribute("data-mark", "backed");
    await expect(page.getByTestId("confront-tally")).toHaveText(`0/${scene.goal}`);

    // 어긋나는 짝: 진술이 깨지고 고쳐 하는 말이 나온다
    const broken = pairs.find((x) => x.kind === "contradiction")!;
    await pickStatement(page, broken.statement);
    await pickRecordLine(page, broken.record.id);
    await page.getByTestId("confront").click();
    await expect(page.getByTestId("confront-status")).toContainText(broken.text);
    await expectInView(page, "confront-status");
    await expect(page.getByTestId("statement")).toHaveAttribute("data-mark", "broken");
    await expect(page.getByTestId("statement-retort")).toHaveText(broken.statement.retort!);
    await expect(page.getByTestId("confront-tally")).toHaveText(`1/${scene.goal}`);
    await expect(page.getByTestId("story-next")).toHaveCount(0);

    // 새로고침해도 찾은 것이 남는다
    await page.reload();
    await expect(page.getByTestId("confront-tally")).toHaveText(`1/${scene.goal}`);
    await pickStatement(page, broken.statement);
    await expect(page.getByTestId("statement-retort")).toBeVisible();

    await playScene(page, ch3, scene);
    await expect(page.getByTestId("confront-tally")).toHaveText(`${scene.goal}/${scene.goal}`);
    // 수사 노트에 대조한 진술이 적힌다
    await page.getByTestId("notebook-open").click();
    await expect(page.getByTestId(`note-talk-${broken.statement.id}`)).toContainText("기록과 어긋남");
    await expect(page.getByTestId(`note-talk-${supports.statement.id}`)).toContainText("기록과 맞음");
    await page.getByTestId("notebook-close").click();
    await expect(page.getByTestId("story-next")).toBeEnabled();
  });

  test("접속 고르기와 최종 추론: 틀린 접속은 까닭을 듣고, 거짓말은 근거가 되지 못한다", async ({ page }) => {
    await start(page, ch3);
    await playScene(page, ch3, sceneOfKind(ch3, "testimony"));
    await page.getByTestId("story-next").click();
    const records = sceneOfKind(ch3, "records");
    const wrongRecord = records.records!.find((r) => !logic(ch3).judgeRecord(records.id, r.id).correct)!;
    await expect(page.getByTestId("record-question")).toHaveText(records.question);
    // 무엇과 맞대어 볼지는 수사 노트에 있다(앞 장의 증거)
    await page.getByTestId("record-notebook").click();
    await page.getByTestId(`notebook-prev-${ch2.id}`).click();
    await expect(page.getByTestId("notebook").locator(".evcard").first()).toBeVisible();
    await page.getByTestId("notebook-close").click();
    await page.getByTestId(`record-${wrongRecord.id}`).click();
    await page.getByTestId("record-confirm").click();
    await expect(page.getByTestId("record-wrong")).toHaveText(logic(ch3).judgeRecord(records.id, wrongRecord.id).reason);
    expect((await chapterOf(page, ch3)).wrong).toBe(1);
    await playScene(page, ch3, records);
    await page.getByTestId("story-next").click();

    const scene = sceneOfKind(ch3, "deduce") as DeduceScene;
    const p = await chapterOf(page, ch3);
    const weak = deductionWith(ch3, p, "weak");
    await choose(page, weak.choice, weak.bases);
    await page.getByTestId("deduce-submit").click();
    await expect(page.getByTestId("deduce-notice")).toContainText("근거가 약합니다");
    const unsupported = deductionWith(ch3, p, "unsupported");
    await choose(page, unsupported.choice, unsupported.bases);
    await page.getByTestId("deduce-submit").click();
    await expect(page.getByTestId("deduce-notice")).toContainText(scene.choices.find((x) => x.id === unsupported.choice)!.unsupported.slice(0, 12));
    expect((await chapterOf(page, ch3)).wrong).toBe(p.wrong + 2);
    await deduce(page, ch3);
    // 끝 장면: 세 사람의 진술서에 도장이 찍힌다
    for (const person of sceneOfKind(ch3, "testimony").people) await expect(page.getByTestId(`ending-mark-${person.id}`)).toHaveText("어긋남", { timeout: 6_000 });
    await skipEnding(page, ch3);
  });
});

test.describe("제4장 · 토끼의 정체", () => {
  test("증거 연결과 타임라인: 빈 줄 · 틀린 줄은 통과하지 못하고, 어긋나는 줄과 까닭을 듣는다", async ({ page }) => {
    await start(page, ch4);
    const link = sceneOfKind(ch4, "link");
    // 맞대어 나오는 것이 없는 짝: 까닭을 듣는다
    const [docA, docB] = link.docs;
    const miss = docA.items.flatMap((a) => docB.items.map((b) => [a.id, b.id])).find(([a, b]) => !link.links.some((l) => l.a === a && l.b === b) && link.misses[`${a}|${b}`])!;
    await page.getByTestId(`item-${miss[0]}`).click();
    await page.getByTestId(`item-${miss[1]}`).click();
    await page.getByTestId("link-items").click();
    await expect(page.getByTestId("link-status")).toHaveText(link.misses[`${miss[0]}|${miss[1]}`]);
    await expectInView(page, "link-status");
    await page.getByTestId(`item-${miss[0]}`).click();
    await page.getByTestId(`item-${miss[1]}`).click();
    await playScene(page, ch4, link);
    await page.getByTestId("story-next").click();

    const scene = sceneOfKind(ch4, "assign");
    const right = rightAssign(ch4, scene, await chapterOf(page, ch4));
    await expect(page.getByTestId("assign-tally")).toHaveText(`0/${scene.rows.length}`);
    // 비운 채 내면: 모든 줄에 넣으라는 안내
    await page.getByTestId("assign-submit").click();
    await expect(page.getByTestId("assign-wrong")).toContainText("모든 줄에");
    expect((await chapterOf(page, ch4)).wrong).toBe(0);
    // 한 줄만 틀리게 넣는다: 이름표를 누를 때마다 다음 빈 줄로 넘어가며 타임라인이 채워진다
    const off = scene.rows[3];
    const other = scene.options.find((o) => o.id !== right[off.id])!;
    await page.getByTestId(`row-${scene.rows[0].id}`).click();
    for (const [i, row] of scene.rows.entries()) {
      await expect(page.getByTestId(`row-${row.id}`)).toHaveAttribute("aria-pressed", "true");
      await page.getByTestId(`pick-${row.id === off.id ? other.id : right[row.id]}`).click();
      await expect(page.getByTestId("assign-tally")).toHaveText(`${i + 1}/${scene.rows.length}`);
      await expect(page.getByTestId(`row-${row.id}`)).toHaveAttribute("data-filled", "true");
    }
    await page.getByTestId("assign-submit").click();
    const verdict = logic(ch4).judgeAssign!(scene.id, { ...right, [off.id]: other.id }, await chapterOf(page, ch4));
    expect(verdict.wrong).toEqual([off.id]);
    await expect(page.getByTestId("assign-wrong")).toHaveText(verdict.reason);
    await expect(page.getByTestId(`row-${off.id}`)).toHaveAttribute("data-flagged", "true");
    expect((await chapterOf(page, ch4)).wrong).toBe(1);
    await expect(page.getByTestId("story-next")).toHaveCount(0);
    // 넣어 둔 것은 저장된다
    await page.reload();
    await expect(page.getByTestId("assign-tally")).toHaveText(`${scene.rows.length}/${scene.rows.length}`);
    await expect(page.getByTestId(`row-${off.id}`)).toHaveAttribute("data-who", other.id);
    // 그 줄을 고쳐 넣고 낸다
    await page.getByTestId(`row-${off.id}`).click();
    await page.getByTestId(`pick-${right[off.id]}`).click();
    await page.getByTestId("assign-submit").click();
    await expect(page.getByTestId("assign")).toHaveAttribute("data-solved", "true");
    await expect(page.getByTestId("story-next")).toBeEnabled();
  });

  test("최종 추론과 사건의 끝: 책상 위의 가면, 끝 글, 사건 해결. 사건 해결 보상은 한 번만 받는다", async ({ page }) => {
    await open(page, playToDeduction(upTo(ch4), ch4), `#/story/${c.id}/${ch4.id}`);
    const scene = sceneOfKind(ch4, "deduce") as DeduceScene;
    const p = await chapterOf(page, ch4);
    const credits = (await stored(page)).credits;
    // 근거는 하나만 낸다(이 장면은 하나를 고르면 바뀐다)
    await expect(page.getByTestId("basis-label")).not.toContainText("/");
    const weak = deductionWith(ch4, p, "weak");
    await choose(page, weak.choice, weak.bases);
    await page.getByTestId("deduce-submit").click();
    await expect(page.getByTestId("deduce-notice")).toContainText(scene.weak[weak.bases[0]].slice(0, 12));
    const unsupported = deductionWith(ch4, p, "unsupported");
    await choose(page, unsupported.choice, unsupported.bases);
    await page.getByTestId("deduce-submit").click();
    await expect(page.getByTestId("deduce-notice")).toContainText("확정할 수 없는 결론입니다");
    expect((await stored(page)).credits).toBe(credits);

    await deduce(page, ch4);
    // 끝 장면: 빈 의자의 방송실 → 책상 위에 가면만 남는다 → 끝 글 두 줄 → 사건 해결
    await expect(page.getByTestId("ending-mask")).toHaveAttribute("data-after", "true", { timeout: 6_000 });
    await expect(page.getByTestId("ending-mask").locator("canvas")).toHaveAttribute("data-frame", "mask");
    const next = page.getByTestId("ending-next");
    const lines = [...ch4.ending.lines, ch4.ending.closing!];
    await next.click(); // 그림 → 끝 글
    for (const [i, line] of lines.entries()) {
      await next.click(); // 찍히던 줄을 다 찍는다
      await expect(next).toContainText(line);
      if (i < lines.length - 1) await next.click(); // 다음 줄
    }
    await next.click(); // 새 기록
    await expect(page.getByTestId(`evidence-${ch4.ending.evidence}`)).toBeVisible();
    await next.click();
    await expect(page.getByTestId("story-result")).toContainText("CHAPTER 04 CLEARED");
    await expect(page.getByTestId("result-closing")).toHaveText(ch4.ending.closing!);
    await expect(page.getByTestId("result-case-reward")).toHaveText(`+${c.reward}`);
    expect((await stored(page)).credits).toBe(credits + ch4.reward + c.reward!);
    // 새로고침해도 다시 받지 않는다
    await page.reload();
    await page.getByTestId("ending-skip").click();
    expect((await stored(page)).credits).toBe(credits + ch4.reward + c.reward!);
    await page.getByTestId("result-home").click();
    await expect(page.getByTestId("story-entry-status")).toHaveText("사건 해결");
    // 끝 장면을 다시 열면 보상은 "받음"으로 적힌다
    await enterFromHome(page, "story-entry");
    await page.getByTestId("chapter-ch4").click();
    await page.getByTestId("record-ending").click();
    await expect(page.getByTestId("result-case-reward")).toHaveText(`+${c.reward} 받음`);
    expect((await stored(page)).credits).toBe(credits + ch4.reward + c.reward!);
  });

  test("모션 줄이기 설정에서도 끝까지 간다 (연출 없이 결과가 바로 나온다)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, playToDeduction(upTo(ch4), ch4), `#/story/${c.id}/${ch4.id}`);
    await deduce(page, ch4);
    await expect(page.getByTestId("story-result")).toBeVisible();
    await expect(page.getByTestId("result-closing")).toHaveText(ch4.ending.closing!);
    await page.getByTestId("result-record").click();
    await expect(page.getByTestId("story-record")).toHaveAttribute("data-solved", "true");
  });
});

test("2~4장의 화면은 두 가지 색으로만 그려진다", async ({ page }) => {
  test.setTimeout(150_000);
  const check = async (name: string) => {
    await page.waitForTimeout(500);
    expect(await offToneRatio(page), `${name}: 두 색이 아닌 화소가 너무 많다`).toBeLessThan(0.005);
  };
  await open(page, upTo(ch2), `#/story/${c.id}/record`);
  await check("사건 기록");
  await page.getByTestId("record-continue").click();
  for (const ch of [ch2, ch3, ch4]) {
    await expect(page.getByTestId("story-intro-title")).toHaveText(ch.title);
    await check(`${ch.no}장 도입`);
    await page.getByTestId("story-intro-skip").click();
    for (const scene of ch.scenes) {
      if (scene.kind === "deduce") break;
      await check(`${ch.no}장 ${scene.title}`);
      if (scene.kind === "compare") {
        // 그림이 놓인 시점
        await page.getByTestId(`tab-${scene.frames.find((f) => f.still)!.id}`).click();
        await check(`${ch.no}장 ${scene.title} · 두 화면`);
      }
      await playScene(page, ch, scene);
      await check(`${ch.no}장 ${scene.title} · 끝낸 뒤`);
      await page.getByTestId("story-next").click();
    }
    const weak = deductionWith(ch, await chapterOf(page, ch), "weak");
    await choose(page, weak.choice, weak.bases);
    await page.getByTestId("deduce-submit").click();
    await check(`${ch.no}장 최종 추론 · 알림`);
    await deduce(page, ch);
    await page.waitForTimeout(1800); // 그림이 바뀐 뒤
    await check(`${ch.no}장 끝 장면`);
    await skipEnding(page, ch);
    await check(`${ch.no}장 결과`);
    if (ch.ending.next) await page.getByTestId("result-continue").click();
  }
  await page.getByTestId("result-record").click();
  await page.getByTestId("chapter-ch3").click();
  await check("사건 기록 · 해결 뒤");
});

for (const size of [
  { width: 390, height: 664 },
  { width: 375, height: 629 },
  { width: 430, height: 932 },
]) {
  test.describe(`${size.width}×${size.height}`, () => {
    test.use({ viewport: size });

    test("2~4장: 장면마다 주 단추가 화면 안에 있고, 누를 곳은 손가락에 맞고, 글이 잘리지 않는다", async ({ page }) => {
      test.setTimeout(150_000);
      /** 누를 곳의 크기와, 한 줄 글이 잘리지 않았는지 */
      const touch = async (selector: string, min = 44) => {
        for (const el of await page.locator(selector).all()) {
          const box = (await el.boundingBox())!;
          expect(box.height, `${selector} 의 터치 영역이 낮다`).toBeGreaterThanOrEqual(min);
          expect(box.width, `${selector} 의 터치 영역이 좁다`).toBeGreaterThanOrEqual(min);
        }
      };
      const noClip = async (selector: string) =>
        expect(
          await page.locator(selector).evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent)),
          `${selector}: 글이 잘린다`,
        ).toEqual([]);
      const footInside = async () => {
        const foot = (await page.locator(".deskfoot, .storyintro__foot").first().boundingBox())!;
        expect(foot.y + foot.height, "아래 단추 줄이 화면 밖이다").toBeLessThanOrEqual(size.height);
      };

      await open(page, upTo(ch2), `#/story/${c.id}/record`);
      await expectLayoutOk(page, '[data-testid="record-continue"]');
      await touch(".chapters__head");
      await page.getByTestId("record-continue").click();

      for (const ch of [ch2, ch3, ch4]) {
        await expectLayoutOk(page, '[data-testid="story-intro-skip"]');
        await page.getByTestId("story-intro-skip").click();
        for (const scene of ch.scenes) {
          if (scene.kind === "deduce") break;
          await expect(page.getByTestId("story-screen")).toHaveAttribute("data-scene", scene.id);
          await expectLayoutOk(page, '[data-testid="story-hint-button"]');
          await footInside();
          if (scene.kind === "compare") {
            // 두 화면은 점 하나 2px 그대로(폭 328px), 화면과 자막은 손가락에 맞는다
            await page.getByTestId(`tab-${scene.frames.find((f) => f.still)!.id}`).click();
            for (const box of await page.locator(".cmp__screen").all()) expect((await box.boundingBox())!.width).toBe(328);
            await touch(".cmp__pic, .cmp__cap, .tline__step");
            await page.getByTestId(`tab-${scene.frames[scene.frames.length - 1].id}`).click();
            await touch(".cmp__cap");
            const screen = (await page.locator(".cmp__screen").first().boundingBox())!;
            for (const cap of await page.locator(".cmp__cap").all()) {
              const box = (await cap.boundingBox())!;
              expect(box.x + box.width, "자막이 화면 밖으로 나간다").toBeLessThanOrEqual(screen.x + screen.width);
            }
            await page.getByTestId(`tab-${scene.frames[0].id}`).click();
            await touch(".cmp__row");
          }
          if (scene.kind === "order") {
            await touch(".olog__card");
            await noClip(".olog__label");
          }
          if (scene.kind === "testimony") {
            await touch(".witness__tab, .talk__chip, .recs__item");
            await noClip(".witness__name, .witness__role");
          }
          if (scene.kind === "records") await touch(".term__row");
          if (scene.kind === "link") await touch(".doc__item", 40);
          if (scene.kind === "assign") {
            await touch(".day__row, .day__pick");
            // 가장 긴 이름표를 넣어도 일의 글과 겹치지 않는다
            const longest = [...scene.options].sort((x, y) => y.name.length - x.name.length)[0];
            await page.getByTestId(`pick-${longest.id}`).click();
            const who = (await page.getByTestId(`row-${scene.rows[0].id}`).locator(".day__who").boundingBox())!;
            const text = (await page.getByTestId(`row-${scene.rows[0].id}`).locator(".day__text").boundingBox())!;
            expect(who.x + who.width, "넣은 이름이 일의 글과 겹친다").toBeLessThanOrEqual(text.x);
            await noClip(".day__who");
            // 이름표 줄은 아래 단추 줄 위에, 화면 안에 있다
            const picks = (await page.locator(".day__picks").boundingBox())!;
            const foot = (await page.locator(".deskfoot").boundingBox())!;
            expect(picks.y + picks.height).toBeLessThanOrEqual(foot.y + 1);
          }
          await playScene(page, ch, scene);
          await expectLayoutOk(page, '[data-testid="story-next"]');
          await page.getByTestId("story-next").click();
        }
        await expectLayoutOk(page, '[data-testid="deduce-submit"]');
        await touch(".verdict__choice, .verdict__card");
        // 오답 알림은 스크롤을 만들 수 있다: 보이는 곳까지 올라온다
        const weak = deductionWith(ch, await chapterOf(page, ch), "weak");
        await choose(page, weak.choice, weak.bases);
        await page.getByTestId("deduce-submit").click();
        await expectInView(page, "deduce-notice");
        await expectLayoutOk(page, '[data-testid="deduce-submit"]');
        await deduce(page, ch);
        await skipEnding(page, ch);
        await expectLayoutOk(page, '[data-testid="result-record"]');
        await footInside();
        // 결과의 맨 아래 줄(다음 장, 사건 해결)까지 화면 안에 있다
        const result = (await page.getByTestId("story-result").boundingBox())!;
        const last = (await page.getByTestId(ch.ending.next ? "result-next" : "result-closing").boundingBox())!;
        expect(last.y + last.height, "결과의 마지막 줄이 화면 밖이다").toBeLessThanOrEqual(result.y + result.height);
        if (ch.ending.next) await page.getByTestId("result-continue").click();
      }
    });
  });
}

/* ───────── 첫 공개 버전의 전체 흐름 ───────── */

test.describe("첫 공개 버전의 전체 흐름", () => {
  /** 봉투(또는 다음 시험지)를 열고 문제가 뜰 때까지 기다린다 */
  const openExamSheet = async (page: Page, id: "open-envelope" | "open-sheet") => {
    await page.getByTestId(id).click();
    await page.getByTestId(id).click({ timeout: 800 }).catch(() => undefined);
    await expect(page.getByTestId("play-screen")).toBeVisible();
  };

  /** 지금 등급의 승급 시험을 홈에서 들어가 끝까지 치르고 홀로 돌아온다 */
  async function passExam(page: Page, from: RankId, title: string) {
    const rule = PROMOTION_RULES.find((r) => r.from === from)!;
    await enterFromHome(page, "exam-cta");
    await expect(page.getByTestId("exam-gate")).toBeVisible();
    // 시험의 규칙은 봉투를 열기 전에 보인다
    await expect(page.getByTestId("exam-facts")).toContainText(`${rule.examPuzzleIds.length}문제`);
    for (const [i, id] of rule.examPuzzleIds.entries()) {
      await openExamSheet(page, i === 0 ? "open-envelope" : "open-sheet");
      await solvePuzzle(page, PUZZLE_BY_ID[id]);
    }
    await expect(page.getByTestId("ceremony")).toHaveAttribute("data-done", "true", { timeout: 15_000 });
    await expect(page.getByTestId("id-rank")).toHaveText(title);
    await page.getByTestId("ceremony-done").click();
    await expect(page.getByTestId("home-rank")).toHaveText(title);
  }

  test("첫 실행 → 입학 → 오늘의 추리 → 연습실 → F→D 시험 → 사건 D-001 네 장 → D→C 시험 → C급, 그리고 다시 접속", async ({ page }) => {
    test.setTimeout(300_000);
    // 첫 실행: 저장이 없다(QA 패널도 쓰지 않는다). 게임 날짜는 테스트 설정의 달력 첫날이다.
    await page.goto("/");
    await enroll(page);
    await expect(page.getByTestId("home-rank")).toHaveText("F급 견습 탐정");
    await expect(page.getByTestId("credit-balance")).toHaveText("40");
    await expect(page.getByTestId("story-entry")).toHaveCount(0);

    // 오늘의 추리
    const daily = getDailyPuzzle(TEST_DATE)!;
    await enterFromHome(page, "daily-file");
    await solvePuzzle(page, daily);
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await expect(page.getByTestId("reward")).toContainText(`+${daily.reward}`);
    await page.getByTestId("result-home").click();

    // 연습실: F 서류함의 과제를 풀어 응시 조건(과제 셋)을 채운다
    const need = PROMOTION_RULES[0].requiredSolved - 1;
    for (const puzzle of practiceOfRank("F").slice(0, need)) {
      await enterFromHome(page, "practice-entry");
      await page.getByTestId("drawer-F").click();
      await page.getByTestId(`practice-file-${puzzle.id}`).click();
      await solvePuzzle(page, puzzle);
      await expect(page.getByTestId("result-screen")).toBeVisible();
      await page.getByTestId("result-home").click();
      await expect(page.getByTestId("home-screen")).toBeVisible();
    }

    // F→D 승급 시험
    await passExam(page, "F", "D급 초급 탐정");
    let state = await stored(page);
    expect(state.rank).toBe("D");

    // D급: 사건 접수함이 놓이고 그것이 오늘 할 일이다. 다음 시험은 사건 해결을 기다린다.
    await expect(page.getByTestId("story-entry")).toHaveAttribute("data-primary", "true");
    await expect(page.getByTestId("exam-wait")).toHaveAttribute("aria-label", /C급 사건 미해결/);
    await enterFromHome(page, "exam-wait");
    await expect(page.getByTestId("exam-locked")).toBeVisible();
    await expect(page.getByTestId("exam-need-case")).toContainText("미해결");
    // 조건 미달 화면의 주 단추가 사건 수사로 보낸다
    await page.getByTestId("exam-to-case").click();
    await page.getByTestId("story-accept").click();

    // CASE D-001: 네 장을 차례로
    for (const ch of c.chapters) {
      await expect(page.getByTestId("story-intro-title")).toHaveText(ch.title);
      await page.getByTestId("story-intro-skip").click();
      await playToDeduce(page, ch);
      await deduce(page, ch);
      await skipEnding(page, ch);
      await expect(page.getByTestId("result-reward")).toHaveText(`+${ch.reward}`);
      if (ch.ending.next) {
        // 장 사이에서 새로고침해도(다시 접속) 그 자리에서 잇는다: 끝 장면이 다시 열리고(건너뛸 수 있다) 보상은 다시 받지 않는다
        if (ch === ch2) {
          const credits = (await stored(page)).credits;
          await page.reload();
          await skipEnding(page, ch);
          await expect(page.getByTestId("story-result")).toBeVisible();
          expect((await stored(page)).credits).toBe(credits);
        }
        await page.getByTestId("result-continue").click();
      }
    }
    await expect(page.getByTestId("result-closing")).toHaveText(ch4.ending.closing!);
    await expect(page.getByTestId("result-case-reward")).toHaveText(`+${c.reward}`);
    await page.getByTestId("result-record").click();
    await page.getByTestId("record-home").click();
    state = await stored(page);
    // 사건 해결은 등급을 직접 올리지 않는다. 시험이 열릴 뿐이다
    expect(state.rank).toBe("D");
    await expect(page.getByTestId("story-entry-status")).toHaveText("사건 해결");
    await expect(page.getByTestId("exam-cta")).toHaveAttribute("aria-label", /C급 응시 가능/);
    await expect(page.getByTestId("exam-cta")).toHaveAttribute("data-primary", "true");

    // D→C 승급 시험: 세 문제
    const creditsBeforeExam = state.credits;
    await passExam(page, "D", "C급 정식 탐정");
    state = await stored(page);
    expect(state.rank).toBe("C");
    expect(state.credits).toBe(creditsBeforeExam + PROMOTION_RULES[1].reward);

    // 기록과 보상: 다시 접속해도 등급 · 크레딧 · 사건 해결 · 승급 기록이 그대로다
    const expected = 40 + daily.reward + practiceOfRank("F").slice(0, need).reduce((n, p) => n + p.reward, 0) + PROMOTION_RULES[0].reward + TOTAL + PROMOTION_RULES[1].reward;
    expect(state.credits).toBe(expected);
    await page.reload();
    await expect(page.getByTestId("home-rank")).toHaveText("C급 정식 탐정");
    await expect(page.getByTestId("credit-balance")).toHaveText(String(expected));
    await expect(page.getByTestId("story-entry-status")).toHaveText("사건 해결");
    const again = await stored(page);
    expect(again.credits).toBe(expected);
    expect(again.promotions.map((p: { to: string }) => p.to)).toEqual(["D", "C"]);
    expect(again.story.cases[c.id].rewardClaimed).toBe(true);
    // C급의 서류함이 열렸다
    await enterFromHome(page, "practice-entry");
    await page.getByTestId("drawer-C").click();
    await expect(page.getByTestId("drawer-locked")).toHaveCount(0);
    await expect(page.locator(".isotask").first()).toBeVisible();
  });
});
