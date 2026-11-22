import { expect, test, type Page } from "@playwright/test";
import { expectLayoutOk, offToneRatio, placeByTap, preset, setCode, shot, stored, toSafe } from "./helpers";

/**
 * 일일 문제 일곱 개 (V3 GATE 04). 아직 날짜에 배정하지 않았고, QA 주소의 ?day=1~7 로 오늘의 추리 자리에 놓는다.
 * 새 유형 둘(증거 조합, 인장 대조)은 화면의 조작만으로 정답에 닿는지 끝까지 풀어 본다.
 * 정답이 하나뿐인지는 단위 테스트(src/tests/dailySet.test.ts)가 전수 탐색으로 확인한다.
 */

/** 그 일차의 문제를 오늘의 추리로 놓고 연다 */
async function openDay(page: Page, day: number, id: Parameters<typeof preset>[1] = "daily-unsolved") {
  await preset(page, id, `&day=${day}`);
  await page.getByTestId("daily-file").click();
  await expect(page.getByTestId("play-screen")).toBeVisible();
}

const card = (page: Page, id: string) => page.getByTestId(`card-${id}`);

test.describe("일차 전환", () => {
  test("?day= 가 없으면 오늘의 추리는 그대로이고, 있으면 그 일차의 문제가 게시판에 붙는다", async ({ page }) => {
    await preset(page, "daily-unsolved");
    await expect(page.getByTestId("daily-file")).toContainText("자료실 금고의 암호");

    await preset(page, "daily-unsolved", "&day=1");
    await expect(page.getByTestId("daily-file")).toContainText("사라진 자료실 열쇠");
    await expect(page.getByTestId("daily-file")).toContainText("증거 조합");

    // 없는 일차는 무시한다
    await preset(page, "daily-unsolved", "&day=9");
    await expect(page.getByTestId("daily-file")).toContainText("자료실 금고의 암호");
  });

  test("QA 주소가 아니면 ?day= 는 듣지 않는다", async ({ page }) => {
    await preset(page, "daily-unsolved");
    await page.goto("/?day=2");
    await expect(page.getByTestId("home-screen")).toBeVisible();
    await expect(page.getByTestId("daily-file")).toContainText("자료실 금고의 암호");
  });
});

test.describe("증거 조합", () => {
  test("1일차: 기록 둘을 이어 새 사실을 얻고, 거짓 진술과 짝지어 제출한다", async ({ page }) => {
    await openDay(page, 1);
    const screen = page.getByTestId("play-screen");
    await expect(screen).toHaveAttribute("data-type", "evidence");
    // 처음: 진술 셋과 기록 넷이 게시판에 있고, 맞대어 보는 자리에는 할 일이 적혀 있다
    await expect(page.locator(".evichip")).toHaveCount(7);
    await expect(page.getByTestId("evi-how")).toContainText("거짓 진술과 그것을 깨는 증거");
    await expect(page.getByTestId("evi-status")).toContainText("두 장 집어");
    await shot(page, "day1-evidence");

    // 한 장씩 집으면 글이 펼쳐진다
    await card(page, "case").click();
    await expect(page.getByTestId("bench-0")).toContainText("준호의 필통");
    await expect(page.getByTestId("evi-status")).toContainText("한 장 더");

    // 기록 둘을 이었는데 나오는 것이 없으면 그렇게 말한다(채점되지 않는다)
    await card(page, "gate").click();
    await expect(card(page, "case")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("link").click();
    await expect(page.getByTestId("evi-status")).toContainText("새로 알 수 있는 것이 없다");
    expect((await stored(page)).puzzles["daily-evidence-001"].attempts).toBe(0);

    // 진술 둘은 맞대어 볼 수 없다
    await card(page, "say-hana").click();
    await card(page, "say-junho").click();
    await page.getByTestId("link").click();
    await expect(page.getByTestId("evi-status")).toContainText("진술끼리는");

    // 눈에 띄는 함정: 준호의 말과 떨어진 필통은 모순이 아니다 → 오답 1회
    await card(page, "case").click();
    await expect(page.getByTestId("submit")).toHaveText("모순으로 제출");
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("notice-wrong")).toContainText("모순이 아닙니다");
    await expect(page.getByTestId("solution")).toHaveCount(0);
    expect((await stored(page)).puzzles["daily-evidence-001"].attempts).toBe(1);

    // 출석부와 복도 사진을 이으면 새 사실이 게시판에 꽂히고 손에 들린다
    await card(page, "roster").click();
    await card(page, "photo").click();
    await expect(page.locator(".evi__thread i").first()).toBeVisible();
    await page.getByTestId("link").click();
    await expect(page.getByTestId("evi-status")).toContainText("새 사실을 얻었다. 세라는 15:10에 복도에 있었다.");
    await expect(card(page, "fact-sera")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".evichip")).toHaveCount(8);

    // 새로고침해도 얻은 사실이 남는다
    await page.reload();
    await expect(card(page, "fact-sera")).toBeVisible();

    // 같은 둘을 다시 이으면 이미 찾았다고 말한다
    await card(page, "fact-sera").click();
    await card(page, "roster").click();
    await card(page, "photo").click();
    await page.getByTestId("link").click();
    await expect(page.getByTestId("evi-status")).toContainText("이미 찾아 둔 사실");

    // 거짓 진술과 짝지어 제출
    await card(page, "say-sera").click();
    await shot(page, "day1-evidence-pair");
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("evi-status")).toContainText("거짓 진술을 찾았다");
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await expect(page.getByTestId("reward")).toContainText("+100");
    await expect(page.getByTestId("result-outro")).toContainText("세라의 말이 무너졌다");
    await expect(page.locator(".pxcaret")).toHaveCount(0);
    await shot(page, "day1-evidence-result");
    await expect(page.getByTestId("solution")).toContainText("조별 출석부 + 복도 사진");
    await expect(page.getByTestId("record-hints")).toHaveText("미사용");
    const state = await stored(page);
    expect(state.credits).toBe(140);
    expect(state.puzzles["daily-evidence-001"].solvedAttempts).toBe(2);
  });

  test("5일차: 얻은 사실을 한 번 더 이어야 풀린다", async ({ page }) => {
    await openDay(page, 5);
    await expect(page.locator(".evichip")).toHaveCount(9);
    await card(page, "patrol").click();
    await card(page, "tag").click();
    await page.getByTestId("link").click();
    await expect(card(page, "fact-doyun")).toHaveAttribute("aria-pressed", "true");

    // 첫 사실만으로는 민재의 말이 깨지지 않는다
    await card(page, "say-minjae").click();
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("notice-wrong")).toBeVisible();

    await card(page, "say-minjae").click();
    await card(page, "counter").click();
    await page.getByTestId("link").click();
    await expect(page.getByTestId("evi-status")).toContainText("도윤 혼자");
    await card(page, "say-minjae").click();
    await shot(page, "day5-evidence-pair");
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await expect(page.getByTestId("solution")).toContainText("민재");
    await expect(page.getByTestId("solution").locator(".solution__chain li")).toHaveCount(2);
  });

  test("수사 지원을 받으면 사건의 머리에 남고, 풀이 과정은 결과에서 볼 수 있다", async ({ page }) => {
    await openDay(page, 1);
    await page.getByTestId("hint-button").click();
    await page.getByTestId("hint-1-open").click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("brief-hint-1")).toContainText("떨어진 필통은 준호의 말과 어긋나지 않습니다");
    await card(page, "roster").click();
    await card(page, "photo").click();
    await page.getByTestId("link").click();
    await card(page, "say-sera").click();
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await expect(page.getByTestId("record-hints")).toHaveText("1단계 사용");
    await page.getByTestId("explain-toggle").click();
    await expect(page.getByTestId("explain-steps").locator("li")).toHaveCount(4);
  });
});

test.describe("공간 추론 · 인장 대조", () => {
  test("2일차: 도장을 집어 돌리고 찍어 보고, 자국을 낸 도장을 그 방향으로 제출한다", async ({ page }) => {
    await openDay(page, 2);
    const screen = page.getByTestId("play-screen");
    await expect(screen).toHaveAttribute("data-type", "spatial");
    await expect(page.getByTestId("seal-turn")).toBeDisabled();
    await expect(page.getByTestId("seal-status")).toContainText("찍으면 좌우가 뒤집힌다");

    // 집기 전에 제출하면 접수되지 않는다
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("notice-invalid")).toBeVisible();

    // 함정: 돌려 보면 자국과 똑같아 보이는 자료실 도장은 오답이다
    await page.getByTestId("stamp-archive").click();
    await expect(page.getByTestId("held-face")).toHaveAttribute("data-stamp", "archive");
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("notice-wrong")).toContainText("자국이 맞지 않습니다");
    expect((await stored(page)).puzzles["daily-seal-001"].attempts).toBe(1);

    // 돌리면 눈금이 함께 돈다. 네 번 돌리면 제자리다.
    await page.getByTestId("stamp-clerk").click();
    const face = page.getByTestId("held-face");
    await expect(face).toHaveAttribute("data-turn", "0");
    for (const turn of ["1", "2", "3", "0", "1", "2"]) {
      await page.getByTestId("seal-turn").click();
      await expect(face).toHaveAttribute("data-turn", turn);
    }

    // 시험 종이: 찍으면 자국이 남고 한 장 줄어든다. 같은 방향으로 두 번 찍어도 종이는 한 장만 쓴다.
    await page.getByTestId("seal-press").click();
    await expect(page.getByTestId("trial-0")).toHaveAttribute("data-used", "true");
    await expect(page.getByTestId("seal-press")).toHaveAttribute("data-left", "2");
    await page.getByTestId("seal-press").click();
    await expect(page.getByTestId("seal-status")).toContainText("이미 찍어 봤다");
    await expect(page.getByTestId("seal-press")).toHaveAttribute("data-left", "2");

    // 새로고침해도 집은 도장, 돌린 횟수, 찍어 본 종이가 남는다
    await page.reload();
    await expect(page.getByTestId("held-face")).toHaveAttribute("data-stamp", "clerk");
    await expect(page.getByTestId("held-face")).toHaveAttribute("data-turn", "2");
    await expect(page.getByTestId("trial-0")).toHaveAttribute("data-used", "true");
    await shot(page, "day2-seal");

    await page.getByTestId("submit").click();
    await expect(page.getByTestId("seal-status")).toContainText("정확히 겹친다");
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await expect(page.getByTestId("result-outro")).toContainText("서기실 도장");
    await expect(page.getByTestId("solution")).toContainText("두 번 돌려 찍음");
    await expect(page.locator(".pxcaret")).toHaveCount(0);
    await shot(page, "day2-seal-result");
    expect((await stored(page)).credits).toBe(140);
  });

  test("시험 종이를 다 쓰면 더 찍을 수 없다", async ({ page }) => {
    await openDay(page, 7);
    await page.getByTestId("stamp-principal").click();
    await page.getByTestId("seal-press").click();
    await page.getByTestId("seal-turn").click();
    await page.getByTestId("seal-press").click();
    await expect(page.getByTestId("seal-press")).toHaveAttribute("data-left", "0");
    await page.getByTestId("seal-turn").click();
    await page.getByTestId("seal-press").click();
    await expect(page.getByTestId("seal-status")).toContainText("시험 종이를 다 썼다");
    await expect(page.locator('.seal__sheet[data-used="true"]')).toHaveCount(2);
  });

  test("7일차: 번진 자국. 한 칸 차이의 도장은 오답이고, 보이는 칸이 모두 맞는 도장이 정답이다", async ({ page }) => {
    await openDay(page, 7);
    await expect(page.locator('.seal__paper .dotgrid i[data-c="blur"]')).toHaveCount(6);
    await shot(page, "day7-seal-smudged");
    // 학원장 도장을 세 번 돌리면 한 칸만 다르다
    await page.getByTestId("stamp-principal").click();
    for (let i = 0; i < 3; i++) await page.getByTestId("seal-turn").click();
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("notice-wrong")).toBeVisible();

    await page.getByTestId("stamp-vice").click();
    await page.getByTestId("seal-turn").click();
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await expect(page.getByTestId("solution")).toContainText("교감 도장");
  });
});

test.describe("기존 유형의 새 문제", () => {
  test("3일차 암호: 자료실 장면에서 푼다", async ({ page }) => {
    await openDay(page, 3);
    await expect(page.getByTestId("play-screen")).toHaveAttribute("data-ux", "b");
    await expect(page.getByTestId("narration")).toContainText("금고가 다시 잠겨 있다");
    await expect(page.locator(".clue")).toHaveCount(4);
    await toSafe(page);
    await setCode(page, [8, 3, 5]);
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("narration")).toContainText("찢겨 나간 한 장");
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await expect(page.getByTestId("reward")).toContainText("+100");
  });

  test("4일차 진술 추리: 참이 둘인 경우를 찾는다", async ({ page }) => {
    await openDay(page, 4);
    await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", "truth");
    // 고르기 전에 제출하면 숨긴 물건의 이름으로 알려 준다
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("notice-invalid")).toContainText("출석부를 숨겼다고 생각하는 사람");
    await page.getByTestId("suspect-harin").click();
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("notice-wrong")).toContainText("참인 진술이 둘이 되지 않습니다");
    await page.getByTestId("suspect-minjae").click();
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("truth-prompt")).toContainText("참은 2개뿐");
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await expect(page.getByTestId("solution")).toContainText("출석부를 숨긴 사람");
    await expect(page.getByTestId("result-outro")).toContainText("민재의 사물함");
  });

  test("6일차 순서 추론: 연달아 하지 않는다는 조건", async ({ page }) => {
    await openDay(page, 6);
    await expect(page.getByTestId("play-screen")).toHaveAttribute("data-type", "schedule");
    await expect(page.locator("body")).toContainText("하나와 준호는 연달아 면담하지 않는다.");
    // 하나와 준호가 이웃하면 오답
    await placeByTap(page, "sera", 0);
    await placeByTap(page, "daon", 1);
    await placeByTap(page, "junho", 2);
    await placeByTap(page, "hana", 3);
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("notice-wrong")).toBeVisible();
    await page.getByTestId("clear").click();
    await placeByTap(page, "sera", 0);
    await placeByTap(page, "junho", 1);
    await placeByTap(page, "daon", 2);
    await placeByTap(page, "hana", 3);
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await expect(page.getByTestId("solution")).toContainText("면담 순서");
  });
});

test.describe("연출과 화풍", () => {
  test("두 가지 색으로만 그려진다", async ({ page }) => {
    const check = async (name: string) => {
      await page.waitForTimeout(600);
      expect(await offToneRatio(page), `${name}: 두 색이 아닌 화소가 너무 많다`).toBeLessThan(0.005);
    };
    await openDay(page, 5);
    await check("증거 게시판");
    await card(page, "patrol").click();
    await card(page, "tag").click();
    await check("집어 든 두 장과 실");
    await page.getByTestId("link").click();
    await page.waitForTimeout(700);
    await check("새 사실");

    await openDay(page, 7);
    await check("번진 자국");
    await page.getByTestId("stamp-vice").click();
    await page.getByTestId("seal-turn").click();
    await page.getByTestId("seal-press").click();
    await check("도장과 시험 종이");
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await page.waitForTimeout(2600);
    await check("인장 결과");
  });

  test.describe("자막 화면", () => {
    // 자막 화면을 켠 상태(일반 사용자의 기본)로 본다
    test.use({ storageState: { cookies: [], origins: [] } });

    test("사건을 열면 제목 아래에 여는 글이 나오고, 누르면 바로 걷힌다", async ({ page }) => {
      await preset(page, "daily-unsolved", "&day=2");
      await page.getByTestId("daily-file").click();
      const cine = page.getByTestId("cine-card");
      await expect(cine).toContainText("추천서의 인장");
      await expect(cine).toContainText("학원장 추천서 한 장이 가짜로 의심된다");
      await cine.click();
      await expect(cine).toHaveCount(0);
      await page.getByTestId("stamp-clerk").click();
      await expect(page.getByTestId("held-face")).toBeVisible();
    });
  });

  test.describe("모션 줄이기 설정", () => {
    test.use({ reducedMotion: "reduce" });

    test("연출 없이도 새 유형이 끝까지 풀린다", async ({ page }) => {
      await openDay(page, 1);
      await card(page, "roster").click();
      await card(page, "photo").click();
      await page.getByTestId("link").click();
      await card(page, "say-sera").click();
      await page.getByTestId("submit").click();
      await expect(page.getByTestId("result-screen")).toBeVisible();

      await openDay(page, 2);
      await page.getByTestId("stamp-clerk").click();
      await page.getByTestId("seal-turn").click();
      await page.getByTestId("seal-turn").click();
      await page.getByTestId("submit").click();
      await expect(page.getByTestId("result-screen")).toBeVisible();
    });
  });
});

for (const size of [
  { width: 375, height: 667 },
  { width: 390, height: 664 },
  { width: 375, height: 812 },
  { width: 430, height: 932 },
]) {
  test.describe(`${size.width}×${size.height}`, () => {
    test.use({ viewport: size });

    test("증거 조합: 카드가 가장 많은 상태에서도 게시판·읽는 자리·주 단추가 스크롤 없이 한 화면에 들어온다", async ({ page }) => {
      await openDay(page, 5);
      for (const id of ["patrol", "tag"]) await card(page, id).click();
      await page.getByTestId("link").click();
      await card(page, "counter").click();
      await page.getByTestId("link").click();
      await card(page, "say-minjae").click();
      await expect(page.locator(".evichip")).toHaveCount(11);
      await expectLayoutOk(page, '[data-testid="submit"]');
      expect(await page.locator(".play__scroll").evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
      const submitTop = (await page.getByTestId("submit").boundingBox())!.y;
      const status = (await page.getByTestId("evi-status").boundingBox())!;
      expect(status.y + status.height, "서술 한 줄이 단추 줄에 가려진다").toBeLessThanOrEqual(submitTop);
      for (const chip of await page.locator(".evichip").all()) {
        expect((await chip.boundingBox())!.height, "카드의 터치 영역이 44px 보다 작다").toBeGreaterThanOrEqual(44);
      }
    });

    test("인장 대조: 자국·도장·도장 넷·시험 종이·주 단추가 스크롤 없이 한 화면에 들어온다", async ({ page }) => {
      await openDay(page, 7);
      await page.getByTestId("stamp-vice").click();
      await page.getByTestId("seal-press").click();
      await page.getByTestId("seal-turn").click();
      await page.getByTestId("seal-press").click();
      await expectLayoutOk(page, '[data-testid="submit"]');
      expect(await page.locator(".play__scroll").evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
      const submitTop = (await page.getByTestId("submit").boundingBox())!.y;
      const sheet = (await page.getByTestId("trial-1").boundingBox())!;
      expect(sheet.y + sheet.height, "시험 종이가 단추 줄에 가려진다").toBeLessThanOrEqual(submitTop);
      for (const id of ["stamp-principal", "stamp-vice", "stamp-steward", "stamp-librarian", "seal-press", "seal-turn"]) {
        const box = (await page.getByTestId(id).boundingBox())!;
        expect(Math.min(box.width, box.height), `${id} 의 터치 영역이 44px 보다 작다`).toBeGreaterThanOrEqual(44);
      }
    });
  });
}
