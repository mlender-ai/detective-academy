import { expect, type Page } from "@playwright/test";
import { derivationPath } from "../src/engine/evidence";
import type { Puzzle } from "../src/engine/types";
import { placeByTap, setDial, STORAGE_KEY, stored, toSafe } from "./helpers";

/**
 * 문제의 자료(규칙·정답)를 읽어, 화면의 조작만으로 답을 넣고 제출한다.
 * 유형마다 조작이 다르다: 암호는 금고 앞에서 다이얼을, 진술은 사람을, 순서는 이름표를, 증거는 카드 두 장을, 인장은 도장과 방향을.
 * 새 문제 28개가 "화면의 조작으로 정답에 닿는가"를 문제마다 이것으로 확인한다.
 */

/** 게시판에서 집어 둔 카드를 모두 내려놓는다 */
async function dropCards(page: Page) {
  for (let guard = 0; guard < 4; guard++) {
    const held = page.locator('.evichip[aria-pressed="true"]');
    if ((await held.count()) === 0) return;
    await held.first().click();
  }
}

async function pickCards(page: Page, a: string, b: string) {
  await dropCards(page);
  await page.getByTestId(`card-${a}`).click();
  await page.getByTestId(`card-${b}`).click();
  await expect(page.getByTestId(`card-${a}`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId(`card-${b}`)).toHaveAttribute("aria-pressed", "true");
}

/** 답을 화면에 넣는다(제출은 하지 않는다). answer 를 주지 않으면 정답을 넣는다. */
export async function enterAnswer(page: Page, puzzle: Puzzle, how: "right" | "wrong" = "right") {
  await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", puzzle.type);
  switch (puzzle.type) {
    case "code": {
      await toSafe(page);
      // 오답: 정답을 거꾸로 넣는다(서로 다른 숫자라 제출은 된다)
      const digits = how === "right" ? puzzle.solution : [...puzzle.solution].reverse();
      for (let i = 0; i < digits.length; i++) await setDial(page, i, digits[i]);
      return;
    }
    case "truth": {
      const who = how === "right" ? puzzle.solution : puzzle.rules.people.find((p) => p.id !== puzzle.solution)!.id;
      const suspect = page.getByTestId(`suspect-${who}`);
      if ((await suspect.getAttribute("aria-checked")) !== "true") await suspect.click();
      await expect(suspect).toHaveAttribute("aria-checked", "true");
      return;
    }
    case "schedule": {
      const order = how === "right" ? puzzle.solution : [...puzzle.solution].reverse();
      const placed = Number((await page.getByTestId("placed-count").textContent())?.match(/(\d+)\//)?.[1] ?? 0);
      if (placed > 0) await page.getByTestId("clear").click();
      for (let slot = 0; slot < order.length; slot++) await placeByTap(page, order[slot], slot);
      return;
    }
    case "evidence": {
      const { statement, against } = puzzle.solution;
      if (how === "wrong") {
        // 거짓 진술을 고르되, 그것을 깨지 못하는 처음의 기록과 짝짓는다
        const other = puzzle.rules.cards.find((card) => card.kind !== "statement" && card.id !== against)!;
        await pickCards(page, statement, other.id);
        return;
      }
      // 정답의 증거가 이어서 얻는 사실이면, 그 길을 따라 차례로 잇는다
      for (const step of derivationPath(puzzle.rules, against)) {
        if ((await page.getByTestId(`card-${step.card.id}`).count()) > 0) continue;
        await pickCards(page, step.from[0], step.from[1]);
        await page.getByTestId("link").click();
        await expect(page.getByTestId(`card-${step.card.id}`)).toBeVisible();
      }
      await pickCards(page, statement, against);
      return;
    }
    case "spatial": {
      const turn = how === "right" ? puzzle.solution.turn : (puzzle.solution.turn + 1) % 4;
      const pick = page.getByTestId(`stamp-${puzzle.solution.stamp}`);
      if ((await pick.getAttribute("aria-checked")) !== "true") await pick.click();
      const held = page.getByTestId("held-face");
      await expect(held).toHaveAttribute("data-stamp", puzzle.solution.stamp);
      for (let guard = 0; guard < 4; guard++) {
        const now = Number(await held.getAttribute("data-turn"));
        if (now === turn) break;
        await page.getByTestId("seal-turn").click();
        await expect(held).toHaveAttribute("data-turn", String((now + 1) % 4));
      }
      await expect(held).toHaveAttribute("data-turn", String(turn));
      return;
    }
  }
}

/** 정답을 넣고 제출한 뒤, 정답 연출을 건너뛴다 */
export async function solve(page: Page, puzzle: Puzzle) {
  await enterAnswer(page, puzzle);
  await page.getByTestId("submit").click();
  // 정답 연출은 화면을 누르면 건너뛴다. 이미 지나갔으면 그대로 둔다.
  await page.getByTestId("skip-reaction").click({ timeout: 2500 }).catch(() => undefined);
}

/** 오답을 넣고 제출한다 */
export async function submitWrong(page: Page, puzzle: Puzzle) {
  await enterAnswer(page, puzzle, "wrong");
  await page.getByTestId("submit").click();
}

/**
 * 저장된 게임 상태를 고쳐 쓰고 다시 읽게 한다(시간이 흐른 상황, 푼 기록을 지운 상황을 만들 때).
 * 풀이 화면은 1초마다 상태를 저장하므로, 앱이 떠 있는 채로 고치면 곧 덮어쓰인다.
 * 그래서 같은 주소(origin)의 빈 문서로 잠깐 나가서 고친 뒤 돌아온다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function patchState(page: Page, patch: (state: any) => void, key = STORAGE_KEY) {
  const back = page.url();
  const state = await stored(page);
  patch(state);
  await page.route("**/__blank", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>blank</title>" }));
  await page.goto("/__blank");
  await page.evaluate(([k, value]) => window.localStorage.setItem(k, value), [key, JSON.stringify(state)] as const);
  await page.unroute("**/__blank");
  await page.goto(back);
}
