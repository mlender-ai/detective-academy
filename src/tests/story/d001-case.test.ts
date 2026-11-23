import { describe, expect, it } from "vitest";
import { CREDIT_POLICY } from "../../engine/creditEngine";
import { createInitialState, enroll, hydrate } from "../../engine/progressEngine";
import type { GameState } from "../../engine/types";
import { CASES, chapterKey, findCase, findChapter, hasLogic, logicOf, playableChapters } from "../../story/cases";
import { D001 } from "../../story/cases/d001/case";
import { BROADCAST, SESSIONS, SOURCE_FILE, lengthText } from "../../story/cases/d001/logic";
import { CUTS, E2, ORIGINAL, RELEASED, SUB_BASE } from "../../story/cases/d001/logic2";
import { ACCESS, DOOR, E3, LOBBY, RESETS } from "../../story/cases/d001/logic3";
import { E4, LOGIN, POLICE, SCHEDULED, TEXT_MESSAGE } from "../../story/cases/d001/logic4";
import { CAST } from "../../story/cases/d001/people";
import {
  cancelReplay,
  caseEvidence,
  caseRewardClaimed,
  caseSolved,
  caseStatus,
  chapterCleared,
  chapterStatus,
  chapterToOpen,
  chapterUnlocked,
  confront,
  finishEnding,
  goScene,
  heldEvidence,
  hintsFor,
  hydrateStory,
  markDifference,
  nextChapter,
  recordOf,
  requestStoryHint,
  restartChapter,
  sceneReachable,
  seeIntro,
  setAssign,
  submitDeduction,
  submitOrder,
} from "../../story/engine/storyEngine";
import type { StoryCase, StoryChapter, StoryScene } from "../../story/engine/storyTypes";
import { NOW, c, ch1, ch2, ch3, ch4, clearChapter, clocksIn, correctDeductions, detective, playScene, playToDeduction, progress, sceneOfKind, submitCorrect, textsOf, upTo } from "./d001-play";

/**
 * CASE D-001 사건 전체: 네 장의 짜임새, 장의 해금 순서, 저장과 복원, 다시 풀기, 보상, 예전 저장, 없는 사건과 장.
 * 장마다의 추론 검증은 d001.test.ts(제1장) · d001-ch2~4.test.ts 가 따로 본다.
 */

/** 화면이 모두 붙은 사건 (released 문이 없다). 지금의 D001 이 이것이다 */
const open: StoryCase = { ...D001, released: undefined };
/** 화면이 1장까지만 붙어 있던 때의 사건 (문이 하는 일을 본다) */
const gated: StoryCase = { ...D001, released: 1 };
const LATER = new Date("2026-11-25T03:00:00Z");
const roundTrip = (state: GameState): GameState => hydrate(JSON.parse(JSON.stringify(state)));
const solvedAll = (): GameState => clearChapter(upTo(ch4), ch4);

describe("사건의 짜임새", () => {
  it("네 장이 차례로 있고, 장마다 판정이 올라와 있다", () => {
    expect(CASES).toEqual([D001]);
    expect(c.chapters.map((ch) => [ch.id, ch.no, ch.title])).toEqual([
      ["ch1", 1, "마지막 7분"],
      ["ch2", 2, "사라진 원본"],
      ["ch3", 3, "세 사람의 비밀"],
      ["ch4", 4, "토끼의 정체"],
    ]);
    expect(c.chapters).toHaveLength(c.plannedChapters);
    for (const ch of c.chapters) expect(hasLogic(chapterKey(c, ch)), ch.id).toBe(true);
    // 장의 끝은 다음 장의 제목을 가리킨다. 마지막 장은 가리키는 곳이 없고 사건을 닫는 글이 있다
    c.chapters.forEach((ch, i) => expect(ch.ending.next).toEqual(c.chapters[i + 1] ? { no: c.chapters[i + 1].no, title: c.chapters[i + 1].title } : null));
    expect(c.chapters.filter((ch) => ch.ending.closing).map((ch) => ch.id)).toEqual(["ch4"]);
    expect(c).toMatchObject({ rank: "D", totalMinutes: "20~30분", client: "dohee" });
  });

  it("장마다 핵심 조작이 다르다: 새 장면 종류는 저마다 한 장에만 나온다", () => {
    const kinds = c.chapters.map((ch) => ch.scenes.map((s) => s.kind));
    expect(kinds).toEqual([
      ["timeline", "records", "link", "deduce"],
      ["compare", "order", "deduce"],
      ["testimony", "records", "deduce"],
      ["link", "assign", "deduce"],
    ]);
    for (const kind of ["timeline", "compare", "order", "testimony", "assign"]) expect(kinds.filter((list) => list.includes(kind as StoryScene["kind"])), kind).toHaveLength(1);
    // 모든 장은 결론과 근거를 함께 내는 최종 추론으로 끝난다
    for (const ch of c.chapters) expect(ch.scenes[ch.scenes.length - 1].kind).toBe("deduce");
  });

  it("증거는 사건 전체에서 이름표가 겹치지 않고 번호가 이어진다", () => {
    const all = c.chapters.flatMap((ch) => ch.evidence);
    expect(all.map((e) => e.id)).toEqual(Array.from({ length: 21 }, (_, i) => `e${String(i + 1).padStart(2, "0")}`));
    expect(all.map((e) => e.no)).toEqual(Array.from({ length: 21 }, (_, i) => `증거 ${String(i + 1).padStart(2, "0")}`));
    for (const e of all) {
      // 화면이 줄의 이름표를 열쇠로 쓴다: 한 장의 증거 안에서 겹치면 안 된다
      expect(new Set(e.lines.map((l) => l.label)).size, e.id).toBe(e.lines.length);
      expect(e.lines.length).toBeGreaterThan(0);
    }
    const facts = c.chapters.flatMap((ch) => ch.scenes.flatMap((s) => (s.kind === "link" ? s.facts.map((f) => f.id) : [])));
    expect(facts).toEqual(["f01", "f02", "f03", "f04", "f05", "f06", "f07"]);
  });

  it("장면이 가리키는 증거는 모두 그 장의 증거이고, 장을 끝내면 그 장의 증거를 모두 갖는다", () => {
    for (const ch of c.chapters) {
      const ids = ch.evidence.map((e) => e.id);
      const granted = ch.scenes.flatMap((s) => (s.kind === "deduce" || s.kind === "link" ? [] : typeof s.grants === "string" ? [s.grants] : s.grants));
      expect([...(ch.given ?? []), ...granted, ch.ending.evidence].sort(), ch.id).toEqual([...ids].sort());
      const deduce = sceneOfKind(ch, "deduce");
      for (const id of deduce.basis) expect(ids).toContain(id);
      for (const id of Object.keys(deduce.weak)) expect(deduce.basis).toContain(id);
      expect(new Set(ch.scenes.map((s) => s.id)).size).toBe(ch.scenes.length);
    }
    const state = solvedAll();
    for (const ch of c.chapters) expect([...progress(state, ch).evidence].sort(), ch.id).toEqual(ch.evidence.map((e) => e.id).sort());
  });

  it("등장인물은 지시서의 네 사람이고, 이름은 처음 나오는 장보다 앞에서 쓰이지 않는다", () => {
    expect(CAST.map((p) => [p.name, p.age])).toEqual([
      ["윤서린", 27],
      ["오상민", 34],
      ["한가을", 25],
      ["강도희", 22],
    ]);
    expect(c.cast).toBe(CAST);
    for (const person of CAST)
      for (const ch of c.chapters) {
        const named = JSON.stringify(ch).includes(person.name);
        if (ch.no < person.from) expect(named, `${person.name} / 제${ch.no}장`).toBe(false);
        if (ch.no === person.from) expect(named, `${person.name} / 제${ch.no}장`).toBe(true);
      }
    // 날짜와 구독자 수도 지시서대로다
    expect(BROADCAST.date).toBe("2026-11-21");
    expect(ch1.intro[0]).toBe("2026년 11월 21일.");
    expect(c.brief).toContain("38만");
  });
});

describe("글이 사실과 어긋나지 않는다", () => {
  const span = (list: { from: string; to: string }[]) => list.flatMap((s) => [s.from, s.to]);
  const KNOWN = new Set<string>([
    BROADCAST.start,
    BROADCAST.end,
    SOURCE_FILE.registeredAt,
    ...SESSIONS.flatMap((s) => [s.start, s.end]),
    ...(ch1.scenes[0].kind === "timeline" ? ch1.scenes[0].frames.flatMap((frame) => [frame.clock, lengthText(frame.at)]) : []),
    ORIGINAL.createdAt,
    ORIGINAL.trashedAt!,
    RELEASED.createdAt,
    ...CUTS.map((cut) => lengthText(cut.at)),
    ...SUB_BASE.map((line) => lengthText(line.at)),
    ...DOOR.flatMap((line) => span(line.spans)),
    ...LOBBY.flatMap((line) => span(line.spans)),
    ...span(ACCESS),
    ...RESETS.map((r) => r.at),
    LOGIN.at.clock,
    TEXT_MESSAGE.at.clock,
    POLICE.at.clock,
    SCHEDULED.at,
  ]);

  it("글에 나오는 시각은 모두 사건 자료에 있는 시각이다", () => {
    for (const ch of c.chapters) {
      const clocks = clocksIn(textsOf(ch));
      expect(clocks.length, ch.id).toBeGreaterThan(3);
      for (const clock of clocks) expect(KNOWN.has(clock), `제${ch.no}장의 글에 자료에 없는 시각 ${clock}`).toBe(true);
    }
    // 판정이 돌려주는 글(틀린 순서, 틀린 접속, 진술 대조, 타임라인)도 같다
    const judged = [
      ...["1", "2", "3"].map((id) => logicOf("d001/ch3").judgeRecord("sessions", id).reason),
      ...sceneOfKind(ch3, "testimony").statements.flatMap((s) => sceneOfKind(ch3, "testimony").records.map((r) => logicOf("d001/ch3").judgeConfront!("statements", s.id, r.id).text)),
      logicOf("d001/ch2").judgeOrder!("editlog", sceneOfKind(ch2, "order").cards.map((card) => card.id)).reason,
    ];
    for (const clock of clocksIn(judged)) expect(KNOWN.has(clock), clock).toBe(true);
  });

  it("수사 지원과 해설의 줄마다 기대는 사실이 있고, 그 사실은 사건 자료에서 참이다", () => {
    for (const ch of c.chapters.slice(1)) {
      const checks = logicOf(chapterKey(c, ch)).checks!;
      const lines = [...ch.scenes.flatMap((s) => s.hints ?? []), ...(ch.explanation ?? [])];
      expect(lines.length, ch.id).toBeGreaterThanOrEqual(ch.scenes.length * 2 + 4);
      const used = new Set<string>();
      for (const line of lines) {
        expect(line.checks.length, line.text).toBeGreaterThan(0);
        for (const name of line.checks) {
          expect(checks[name], `${ch.id}: 점검표에 없는 사실 ${name}`).toBeTypeOf("function");
          expect(checks[name](), `${ch.id}: "${line.text}" 가 기대는 ${name}`).toBe(true);
          used.add(name);
        }
      }
      // 점검표의 사실은 모두 참이다(글이 쓰지 않는 것까지)
      for (const [name, check] of Object.entries(checks)) expect(check(), `${ch.id}/${name}`).toBe(true);
      expect(used.size).toBeGreaterThanOrEqual(8);
    }
  });

  it("장면마다 수사 지원은 두 단계이고, 결론을 대신 말하지 않는다", () => {
    expect(ch1.hints).toHaveLength(2); // 제1장은 장 전체에 두 단계 (그대로다)
    const forbidden: Record<string, RegExp> = {
      ch2: /은퇴를 알리던|은퇴 영상|은퇴합니다/,
      ch3: /오상민|매니저/,
      ch4: /경찰의 회신을 근거|스스로 방송을 그만두고/,
    };
    for (const ch of c.chapters.slice(1)) {
      expect(ch.hints, ch.id).toEqual([]);
      for (const scene of ch.scenes) {
        expect(scene.hints, `${ch.id}/${scene.id}`).toHaveLength(CREDIT_POLICY.hintCosts.length);
        for (const hint of scene.hints!) {
          expect(hint.text.length).toBeGreaterThan(20);
          expect(hint.text, `${ch.id}/${scene.id}`).not.toMatch(forbidden[ch.id]);
        }
      }
      expect(ch.explanation!.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("앞 장에서 확정하지 않은 것을 뒤 장의 도입이 아는 것처럼 쓰지 않는다", () => {
    // 제2장의 도입: 영상이 고쳐졌다는 것도, 원래 무엇을 알리는 영상이었는지도 아직 모른다
    expect(ch2.intro.join(" ")).not.toMatch(/은퇴|고쳐|고친|수정|바뀌/);
    // 제3장의 도입: 누가 고쳤는지 모른다
    expect(ch3.intro.join(" ")).not.toMatch(/(오상민|매니저)(이|가) (고쳤|수정)/);
    // 제4장의 도입: 윤서린이 무사한지 모른다. 신호가 "도착했다"고만 한다
    expect(ch4.intro.join(" ")).not.toMatch(/무사|스스로 떠났|살아 있다\./);
    // 제1장은 그대로다: 이름도, 은퇴도, 고친 사람도 없다
    expect(JSON.stringify(ch1)).not.toMatch(/윤서린|오상민|한가을|강도희|은퇴|고쳤/);
    // 장마다 끝에 적는 "아직 모르는 것"은 다음 장들이 푸는 물음이다
    expect(c.chapters.map((ch) => ch.ending.open.map((q) => q.claim))).toEqual([["dead", "abroad", "manager"], ["gaeul", "dead"], ["dead", "abroad"], ["abroad"]]);
  });

  it("자극적인 묘사와 실제 서비스의 이름이 없다", () => {
    const all = textsOf(c).join("\n");
    expect(all).not.toMatch(/유혈|자살|자해|시신|시체|흉기|목숨을 끊/);
    expect(all).not.toMatch(/유튜브|트위치|아프리카|치지직|YouTube|Twitch|인스타|카카오/i);
    // "죽습니다"는 방송 제목에서만 나온다(소문의 출처를 보이는 데만 쓴다)
    const lines = textsOf(c).filter((text) => text.includes("죽습니다"));
    for (const text of lines) expect(text).toContain("토끼는 죽습니다");
  });
});

describe("장은 차례로 열린다", () => {
  it("앞 장을 해결하기 전에는 다음 장이 잠겨 있고 어떤 조작도 듣지 않는다", () => {
    const state = detective();
    expect(c.chapters.map((ch) => chapterStatus(state, c, ch))).toEqual(["new", "locked", "locked", "locked"]);
    expect(chapterUnlocked(state, c, ch2)).toBe(false);
    expect(seeIntro(state, c, ch2)).toBe(state);
    expect(goScene(state, c, ch2, "compare")).toBe(state);
    expect(markDifference(state, c, ch2, "compare", "file", "created").state).toBe(state);
    expect(submitOrder(state, c, ch2, "editlog", sceneOfKind(ch2, "order").cards.map((x) => x.id)).state).toBe(state);
    expect(confront(state, c, ch3, "statements", "sm1", "door-sangmin").state).toBe(state);
    expect(setAssign(state, c, ch4, "day", "r-air", "none")).toBe(state);
    expect(submitDeduction(state, c, ch4, "deduction", "left", E4.police, NOW).state).toBe(state);
    expect(requestStoryHint(state, c, ch2, "compare").outcome).toEqual({ kind: "exhausted" });
    expect(restartChapter(state, c, ch2)).toBe(state);
    // 제1장을 풀다 만 상태로도 제2장은 열리지 않는다
    expect(chapterUnlocked(playToDeduction(state, ch1), c, ch2)).toBe(false);
    // F급은 사건 자체를 맡을 수 없다
    const rookie = enroll(createInitialState(), "견습", "DA-1", NOW);
    expect(c.chapters.map((ch) => chapterStatus(rookie, c, ch))).toEqual(["locked", "locked", "locked", "locked"]);
  });

  it("장을 하나 해결할 때마다 다음 장이 열리고, 풀지 않은 첫 장이 '다음에 열 장'이다", () => {
    let state = detective();
    const seen: string[] = [];
    for (const ch of c.chapters) {
      expect(nextChapter(state, open)?.id).toBe(ch.id);
      expect(chapterToOpen(state, open)?.id).toBe(ch.id);
      expect(chapterStatus(state, c, ch)).toBe("new");
      expect(caseSolved(state, c.id)).toBe(false);
      state = seeIntro(state, c, ch);
      expect(chapterStatus(state, c, ch)).toBe("open");
      state = clearChapter(state, ch);
      seen.push(ch.id);
      expect(c.chapters.filter((x) => chapterStatus(state, c, x) === "cleared").map((x) => x.id)).toEqual(seen);
    }
    expect(nextChapter(state, open)).toBeNull();
    expect(chapterToOpen(state, open)?.id).toBe("ch4"); // 다 풀었으면 마지막 장(사건 기록)
    expect(caseStatus(state, open)).toBe("cleared");
    expect(caseSolved(state, c.id)).toBe(true);
    // 해결한 장은 골라서 다시 들어갈 수 있고, 잠긴 장·없는 장을 고르면 풀 차례의 장이 열린다
    expect(chapterToOpen(state, open, "ch2")?.id).toBe("ch2");
    const mid = upTo(ch3);
    expect(chapterToOpen(mid, open, "ch1")?.id).toBe("ch1");
    expect(chapterToOpen(mid, open, "ch4")?.id).toBe("ch3");
    expect(chapterToOpen(mid, open, "없는 장")?.id).toBe("ch3");
    expect(caseStatus(mid, open)).toBe("open");
  });

  it("네 장의 화면이 모두 붙었다: 홈과 사건 화면이 네 장을 모두 열고, 1장만 풀어서는 사건이 끝나지 않는다", () => {
    expect(c.released).toBeUndefined();
    expect(playableChapters(c)).toEqual(c.chapters);
    const one = upTo(ch2);
    expect(caseStatus(one, c)).toBe("open"); // 홈: "수사 중 · 1/4장"
    expect(nextChapter(one, c)?.id).toBe("ch2");
    expect(chapterToOpen(one, c)?.id).toBe("ch2");
    expect(chapterToOpen(one, c, "ch3")?.id).toBe("ch2"); // 잠긴 장은 골라도 풀 차례의 장이 열린다
    expect(caseSolved(one, c.id)).toBe(false);
    expect(caseStatus(solvedAll(), c)).toBe("cleared");
  });

  it("화면이 붙기 전의 문(released): 문 안쪽의 장만 열고, 사건 해결은 그래도 네 장을 모두 풀어야 한다", () => {
    expect(playableChapters(gated)).toEqual([ch1]);
    const one = upTo(ch2);
    expect(caseStatus(one, gated)).toBe("cleared");
    expect(nextChapter(one, gated)).toBeNull();
    expect(chapterToOpen(one, gated)?.id).toBe("ch1");
    expect(chapterToOpen(one, gated, "ch2")?.id).toBe("ch1"); // 화면이 없는 장은 골라도 열리지 않는다
    expect(caseSolved(one, gated.id)).toBe(false);
  });

  it("없는 사건과 없는 장은 조용히 거절된다", () => {
    const state = solvedAll();
    expect(caseSolved(state, "없는 사건")).toBe(false);
    expect(caseSolved(state, "__proto__")).toBe(false);
    expect(caseRewardClaimed(state, "없는 사건")).toBe(false);
    expect(findCase("d001")).toBe(D001);
    expect(findCase("없는 사건")).toBeNull();
    expect(findCase("toString")).toBeNull();
    expect(findChapter(c, "ch3")).toBe(ch3);
    expect(findChapter(c, "ch9")).toBeNull();
    expect(hasLogic("d001/ch9")).toBe(false);
    expect(() => logicOf("d001/ch9")).toThrow();
    // 사건에 없는 장으로는 아무 일도 일어나지 않는다
    const ghost: StoryChapter = { ...ch2, id: "ch9" };
    expect(chapterUnlocked(state, c, ghost)).toBe(false);
    expect(chapterStatus(state, c, ghost)).toBe("locked");
    expect(seeIntro(state, c, ghost)).toBe(state);
    expect(submitDeduction(state, c, ghost, "deduction", "altered", [E2.original, E2.released], NOW).state).toBe(state);
    expect(heldEvidence(state, c, ghost)).toEqual([]);
    // 장이 하나도 없는 사건
    const empty: StoryCase = { ...D001, id: "d999", chapters: [] };
    expect(chapterToOpen(state, empty)).toBeNull();
    expect(nextChapter(state, empty)).toBeNull();
    // 없는 장면, 다른 종류의 장면
    expect(goScene(state, c, ch2, "없는 장면")).toBe(state);
    expect(markDifference(state, c, ch2, "editlog", "file", "created").state).toBe(state);
    expect(submitOrder(state, c, ch2, "compare", []).state).toBe(state);
  });
});

describe("보상과 사건 해결", () => {
  it("장마다 처음 해결할 때 120, 사건을 처음 끝까지 해결할 때 100 을 한 번씩 받는다", () => {
    expect(c.chapters.map((ch) => ch.reward)).toEqual([120, 120, 120, 120]);
    expect(c.reward).toBe(100);
    let state = detective();
    const start = state.credits;
    for (const ch of c.chapters) {
      const before = state.credits;
      const result = submitCorrect(playToDeduction(state, ch), ch);
      const last = ch === ch4;
      expect(result.outcome.reward).toBe(120);
      expect(result.outcome.caseReward).toBe(last ? 100 : undefined);
      expect(result.state.credits).toBe(before + 120 + (last ? 100 : 0));
      expect(caseRewardClaimed(result.state, c.id)).toBe(last);
      state = finishEnding(result.state, c, ch);
    }
    expect(state.credits).toBe(start + 580);
    expect(state.story.cases).toEqual({ d001: { solvedAt: NOW.toISOString(), rewardClaimed: true } });
    // 장의 보상은 그 장의 수사 지원을 모두 연 값(장면 셋 × 60)보다 작고, 첫 단계만 연 값(셋 × 20)보다 크다
    const [first, second] = CREDIT_POLICY.hintCosts;
    for (const ch of c.chapters.slice(1)) {
      expect(ch.reward).toBeGreaterThan(ch.scenes.length * first);
      expect(ch.reward).toBeLessThan(ch.scenes.length * (first + second));
    }
  });

  it("사건 해결은 등급·승급 기록·문제 기록·시험을 건드리지 않는다", () => {
    const before = detective();
    const after = solvedAll();
    expect(after.rank).toBe(before.rank);
    expect(after.promotions).toEqual(before.promotions);
    expect(after.puzzles).toEqual(before.puzzles);
    expect(after.exam).toEqual(before.exam);
    expect(after.examDays).toEqual(before.examDays);
    expect(after.settings).toEqual(before.settings);
    expect(caseSolved(after, "d001")).toBe(true);
  });

  it("해결한 장에 다시 내도, 저장을 고쳐도 보상은 다시 나오지 않는다", () => {
    const state = solvedAll();
    for (const ch of c.chapters) {
      const scene = sceneOfKind(ch, "deduce");
      const { choice, bases } = correctDeductions(ch, progress(state, ch))[0];
      const again = submitDeduction(state, c, ch, scene.id, choice, bases.length === 1 ? bases[0] : bases, LATER);
      expect(again.outcome).toEqual({ verdict: "correct", text: "", reward: 0 });
      expect(again.state).toBe(state);
    }
    // 저장된 값에서 "보상을 받았다"를 지워도, 해결한 장은 받은 것으로 읽는다
    const raw = JSON.parse(JSON.stringify(state));
    for (const key of Object.keys(raw.story.chapters)) raw.story.chapters[key].rewardClaimed = false;
    const tampered = hydrate(raw);
    for (const ch of c.chapters) expect(progress(tampered, ch).rewardClaimed).toBe(true);
    expect(tampered.credits).toBe(state.credits);
    // 장을 다 풀지 않았는데 사건 해결 기록만 있는 저장: 그 기록은 버린다
    const early = JSON.parse(JSON.stringify(upTo(ch3)));
    early.story.cases = { d001: { solvedAt: "2026-11-22T00:00:00.000Z", rewardClaimed: true } };
    expect(hydrate(early).story.cases).toBeUndefined();
    expect(caseSolved(hydrate(early), "d001")).toBe(false);
    // 그 상태에서 끝까지 풀면 사건 해결 보상은 정상으로 한 번 나온다
    const finished = submitCorrect(playToDeduction(clearChapter(hydrate(early), ch3), ch4), ch4);
    expect(finished.outcome.caseReward).toBe(100);
  });
});

describe("다시 풀기", () => {
  it("해결한 장을 처음 장면부터 다시 푼다: 도입은 다시 나오지 않고, 처음의 기록은 남는다", () => {
    const solved = solvedAll();
    const first = progress(solved, ch2);
    let state = restartChapter(solved, c, ch2);
    const p = progress(state, ch2);
    expect(p).toMatchObject({ status: "in_progress", scene: "compare", introSeen: true, rewardClaimed: true, endingSeen: true, clearedAt: first.clearedAt, wrong: 0 });
    expect(p.evidence).toEqual([]);
    expect(p.notes).toEqual([]);
    expect(p.solved).toEqual([]);
    expect(p.archive).toMatchObject({ evidence: first.evidence, deduction: first.deduction, solved: first.solved });
    // 장면은 다시 차례로 열린다
    expect(sceneReachable(p, ch2, "editlog")).toBe(false);
    expect(sceneReachable(p, ch2, "ending")).toBe(false);
    // 처음 해결했을 때의 기록(증거·결론)은 그대로 읽을 수 있다
    expect(recordOf(p)).toMatchObject({ status: "cleared", evidence: first.evidence, deduction: first.deduction, archive: null });
    expect(recordOf(first)).toBe(first);
    expect(caseEvidence(state, c).find((x) => x.chapter === ch2)!.evidence).toEqual(ch2.evidence);
    // 그 장은 여전히 해결한 장이다: 뒤의 장이 잠기지 않고 사건도 해결된 그대로다
    expect(chapterCleared(p)).toBe(true);
    expect(chapterStatus(state, c, ch2)).toBe("cleared");
    expect(chapterUnlocked(state, c, ch3)).toBe(true);
    expect(caseSolved(state, c.id)).toBe(true);
    expect(heldEvidence(state, c, ch3).map((e) => e.id)).toEqual(expect.arrayContaining(ch2.evidence.map((e) => e.id)));
    // 풀지 않은 장은 다시 풀기가 없다
    expect(restartChapter(upTo(ch2), c, ch2)).toEqual(upTo(ch2));
    state = restartChapter(state, c, ch2);
    expect(progress(state, ch2)).toBe(p); // 다시 푸는 중에 또 누르면 그대로다
  });

  it("다시 풀어 끝내도 보상은 없고, 처음 해결한 때가 그대로 남는다", () => {
    const solved = solvedAll();
    let state = restartChapter(solved, c, ch3);
    expect(progress(state, ch3).evidence).toEqual(ch3.given); // 도착해 있던 기록은 처음부터 갖고 있다
    state = playToDeduction(state, ch3);
    // 다시 푸는 동안의 오답은 이번 풀이에만 적힌다
    const wrong = submitDeduction(state, c, ch3, "deduction", "gaeul", [E3.door, E3.perms], LATER);
    expect(progress(wrong.state, ch3).wrong).toBe(1);
    const pass = submitCorrect(wrong.state, ch3, LATER);
    expect(pass.outcome).toEqual({ verdict: "correct", text: "", reward: 0 });
    expect(pass.state.credits).toBe(solved.credits);
    expect(progress(pass.state, ch3)).toMatchObject({ status: "cleared", scene: "ending", archive: null, clearedAt: NOW.toISOString(), rewardClaimed: true });
    expect(pass.state.story.cases).toEqual(solved.story.cases);
    // 마지막 장을 다시 풀어 끝내도 사건 해결 보상은 다시 나오지 않는다
    const again = submitCorrect(playToDeduction(restartChapter(pass.state, c, ch4), ch4), ch4, LATER);
    expect(again.outcome).toEqual({ verdict: "correct", text: "", reward: 0 });
    expect(again.state.credits).toBe(solved.credits);
  });

  it("다시 풀던 것을 그만두면 처음의 기록으로 돌아간다", () => {
    const solved = solvedAll();
    let state = restartChapter(solved, c, ch4);
    state = playScene(state, ch4, ch4.scenes[0]);
    expect(progress(state, ch4).facts.length).toBeGreaterThan(0);
    state = cancelReplay(state, c, ch4);
    expect(progress(state, ch4)).toEqual({ ...progress(solved, ch4), scene: "record" });
    expect(cancelReplay(state, c, ch4)).toBe(state);
  });
});

describe("저장과 복원", () => {
  it("어느 지점에서 저장했다 읽어도 진행이 그대로다", () => {
    const points: GameState[] = [];
    let state = detective();
    for (const ch of c.chapters) {
      state = seeIntro(state, c, ch);
      points.push(state);
      state = goScene(playScene(state, ch, ch.scenes[0]), c, ch, ch.scenes[1].id);
      points.push(state);
      state = playToDeduction(state, ch);
      points.push(state);
      state = submitCorrect(state, ch).state;
      points.push(state);
      state = finishEnding(state, c, ch);
      points.push(state);
    }
    points.push(restartChapter(state, c, ch2), playToDeduction(restartChapter(state, c, ch3), ch3));
    expect(points).toHaveLength(22);
    points.forEach((point, i) => expect(roundTrip(point), `지점 ${i}`).toEqual(point));
  });

  it("도중에 나갔다 와도 있던 장면, 놓아 둔 순서, 넣어 둔 사람, 찾은 모순이 남는다", () => {
    let state = seeIntro(upTo(ch2), c, ch2);
    state = markDifference(state, c, ch2, "compare", "file", "created").state;
    expect(progress(roundTrip(state), ch2)).toMatchObject({ scene: "compare", notes: ["file.created"], status: "in_progress" });

    state = seeIntro(upTo(ch3), c, ch3);
    state = confront(state, c, ch3, "statements", "ge1", "door-gaeul").state;
    state = confront(state, c, ch3, "statements", "ge2", "door-gaeul").state;
    expect(progress(roundTrip(state), ch3)).toMatchObject({ verified: ["ge1"], exposed: ["ge2"], evidence: ch3.given });

    state = goScene(playScene(seeIntro(upTo(ch4), c, ch4), ch4, ch4.scenes[0]), c, ch4, "day");
    state = setAssign(state, c, ch4, "day", "r-air", "none");
    state = setAssign(state, c, ch4, "day", "r-leave", "seorin");
    expect(progress(roundTrip(state), ch4)).toMatchObject({ scene: "day", assigned: { day: { "r-air": "none", "r-leave": "seorin" } } });
  });

  it("스토리가 없던 때의 저장, 제1장만 있던 때의 저장을 그대로 읽는다", () => {
    const none = JSON.parse(JSON.stringify(detective()));
    delete none.story;
    expect(hydrate(none).story).toEqual({ chapters: {} });

    // 제1장만 있던 때의 저장: 새 칸(순서·배정·모순·장면별 수사 지원·보관 기록)이 없고, 근거는 하나만 적혀 있다
    const solved = clearChapter(detective(), ch1);
    const old = JSON.parse(JSON.stringify(solved));
    const saved = old.story.chapters["d001/ch1"];
    for (const key of ["placed", "assigned", "exposed", "verified", "solved", "sceneHints", "archive"]) delete saved[key];
    delete saved.deduction.bases;
    saved.hintsUsed = 1;
    const restored = hydrate(old);
    expect(progress(restored, ch1)).toEqual({ ...progress(solved, ch1), hintsUsed: 1 });
    expect(progress(restored, ch1).deduction).toEqual({ choice: "scheduled", basis: "e02", bases: ["e02"] });
    expect(restored.credits).toBe(solved.credits);
    expect(restored.story.cases).toBeUndefined();
    // 그 저장으로 이어서 제2장에 들어갈 수 있고, 제1장의 보상은 다시 나오지 않는다
    expect(chapterStatus(restored, c, ch1)).toBe("cleared");
    expect(chapterStatus(restored, c, ch2)).toBe("new");
    expect(caseSolved(restored, "d001")).toBe(false);
    const on = submitCorrect(playToDeduction(restored, ch2), ch2);
    expect(on.state.credits).toBe(solved.credits + 120);
    // 제1장을 풀던 중의 예전 저장도 있던 장면에서 잇는다
    const midway = JSON.parse(JSON.stringify(playToDeduction(detective(), ch1)));
    for (const key of ["placed", "assigned", "exposed", "verified", "solved", "sceneHints", "archive"]) delete midway.story.chapters["d001/ch1"][key];
    expect(progress(hydrate(midway), ch1)).toEqual(progress(playToDeduction(detective(), ch1), ch1));
  });

  it("깨진 값은 버리고, 들어갈 수 없는 곳에 있던 진행은 들어갈 수 있는 곳으로 돌린다", () => {
    const base = JSON.parse(JSON.stringify(upTo(ch2)));
    const read = (key: string, chapter: unknown) => hydrateStory({ chapters: { ...base.story.chapters, [key]: chapter } }, CASES).chapters[key];
    const dirty = read("d001/ch2", {
      status: "in_progress",
      introSeen: true,
      scene: "deduction",
      notes: ["file.created", "file.length", "c0310.caption", 7],
      evidence: ["e05", "e01", "가짜"],
      placed: { editlog: ["op-title", "op-title"], compare: ["x"] },
      solved: ["editlog", "deduction", "없는 장면"],
      sceneHints: { compare: 9, editlog: -1, 없는: 2 },
      deduction: { choice: "없는 결론", bases: ["e05", 3] },
      archive: "이야기",
    });
    expect(dirty).toMatchObject({
      scene: "compare", // 비교를 끝내지 않았으므로 추론 장면에는 있을 수 없다
      notes: ["file.created"], // 달라진 곳만 남는다(같은 곳, 없는 곳은 버린다)
      evidence: ["e05"], // 다른 장의 증거는 이 장의 것이 아니다
      placed: {},
      solved: ["editlog"],
      sceneHints: { compare: 2 },
      deduction: { choice: null, basis: "e05", bases: ["e05"] },
      archive: null,
    });
    const assigned = read("d001/ch4", { status: "in_progress", introSeen: true, assigned: { day: { "r-air": "none", "r-view": "없는 사람", 없는줄: "seorin" } }, exposed: ["sm1"] });
    expect(assigned.assigned).toEqual({ day: { "r-air": "none" } });
    expect(assigned.exposed).toEqual([]);
    // 다시 풀던 중의 저장: 처음의 기록이 함께 읽히고, 그 장은 여전히 해결한 장이다
    const replay = read("d001/ch1", { status: "in_progress", introSeen: true, scene: "broadcast", archive: { evidence: ["e01", "e02", "e03", "e04", "e99"], deduction: { choice: "scheduled", basis: "e02" } } });
    expect(replay.archive).toMatchObject({ evidence: ["e01", "e02", "e03", "e04"], deduction: { choice: "scheduled", basis: "e02", bases: ["e02"] } });
    expect(chapterCleared(replay)).toBe(true);
    expect(replay.rewardClaimed).toBe(true);
    expect(hydrateStory({ chapters: [], cases: "x" }, CASES)).toEqual({ chapters: {} });
    expect(hydrateStory(null, CASES)).toEqual({ chapters: {} });
  });
});

describe("수사 지원과 증거 기록", () => {
  it("2~4장의 수사 지원은 장면마다 따로 열고, 값은 문제의 힌트와 같다(20 · 40)", () => {
    let state = { ...seeIntro(upTo(ch2), c, ch2), credits: 100 };
    expect(hintsFor(progress(state, ch2), ch2, "compare")).toMatchObject({ used: 0, perScene: true });
    const first = requestStoryHint(state, c, ch2, "compare");
    expect(first.outcome).toEqual({ kind: "opened", tier: 0, cost: 20 });
    state = first.state;
    const second = requestStoryHint(state, c, ch2, "compare");
    expect(second.outcome).toEqual({ kind: "opened", tier: 1, cost: 40 });
    state = second.state;
    expect(state.credits).toBe(40);
    expect(requestStoryHint(state, c, ch2, "compare").outcome).toEqual({ kind: "exhausted" });
    // 다른 장면의 수사 지원은 다시 첫 단계부터다
    const other = requestStoryHint(state, c, ch2, "editlog");
    expect(other.outcome).toEqual({ kind: "opened", tier: 0, cost: 20 });
    state = other.state;
    expect(requestStoryHint(state, c, ch2, "editlog").outcome).toEqual({ kind: "insufficient", tier: 1, cost: 40, shortBy: 20 });
    expect(progress(state, ch2)).toMatchObject({ sceneHints: { compare: 2, editlog: 1 }, hintsUsed: 0 });
    expect(hintsFor(progress(state, ch2), ch2, "compare").texts).toEqual(ch2.scenes[0].hints!.map((h) => h.text));
    // 장면을 주지 않으면 장 전체의 수사 지원인데, 2~4장에는 그것이 없다
    expect(requestStoryHint(state, c, ch2).outcome).toEqual({ kind: "exhausted" });
    expect(requestStoryHint(state, c, ch2, "없는 장면").outcome).toEqual({ kind: "exhausted" });
    // 크레딧이 없어도 장은 끝까지 풀린다. 다시 풀 때 열어 둔 수사 지원은 열린 채다
    const cleared = clearChapter({ ...state, credits: 0 }, ch2);
    expect(progress(restartChapter(cleared, c, ch2), ch2).sceneHints).toEqual({ compare: 2, editlog: 1 });
    // 제1장은 그대로 장 전체에 두 단계다(장면을 줘도 같다)
    const one = { ...seeIntro(detective(), c, ch1), credits: 100 };
    expect(hintsFor(progress(one, ch1), ch1, "broadcast")).toEqual({ texts: ch1.hints, used: 0, perScene: false });
    expect(progress(requestStoryHint(one, c, ch1, "log").state, ch1)).toMatchObject({ hintsUsed: 1, sceneHints: {} });
  });

  it("뒤 장의 수사 노트에는 앞 장의 증거가 함께 있고, 사건의 증거 기록은 언제든 다시 열람할 수 있다", () => {
    const at3 = seeIntro(upTo(ch3), c, ch3);
    expect(heldEvidence(at3, c, ch3).map((e) => e.id)).toEqual([...ch1.evidence, ...ch2.evidence].map((e) => e.id).concat(ch3.given!));
    expect(heldEvidence(detective(), c, ch1)).toEqual([]);
    const record = caseEvidence(at3, c);
    expect(record.map((x) => x.evidence.length)).toEqual([4, 5, 3, 0]);
    expect(caseEvidence(solvedAll(), c).flatMap((x) => x.evidence)).toHaveLength(21);
  });
});
