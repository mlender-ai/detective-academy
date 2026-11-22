import { describe, expect, it } from "vitest";
import { buildDemoState, createInitialState, enroll, hydrate } from "../../engine/progressEngine";
import type { GameState } from "../../engine/types";
import { CASES, chapterKey } from "../../story/cases";
import { D001, D001_CH1 } from "../../story/cases/d001/case";
import {
  CASE_DATA,
  CLAIMS,
  E,
  F,
  LINK_HOLDS,
  judge,
  judgeDeduction,
  judgeRecord,
  matchingSessions,
  modesAllowedByLabel,
  whyNotSession,
  worlds,
  type CaseData,
} from "../../story/cases/d001/logic";
import {
  caseStatus,
  finishEnding,
  getChapter,
  goScene,
  investigate,
  linkItems,
  pickRecord,
  requestStoryHint,
  sceneReachable,
  seeIntro,
  storyUnlocked,
  submitDeduction,
} from "../../story/engine/storyEngine";
import type { DeduceScene, LinkScene, RecordsScene, TimelineScene } from "../../story/engine/storyTypes";

/**
 * CASE D-001 제1장 「마지막 7분」.
 * 이야기의 정답과 추론 문제의 정답은 따로 검증한다: 정답을 글자로 비교하지 않고,
 * 가진 증거와 어긋나지 않는 경우를 전부 펼쳐 "확정되는 결론이 정확히 하나"인지를 본다.
 * 자료를 고쳐 답이 여럿이 되거나 없어지면 이 테스트가 실패해야 한다.
 */

const NOW = new Date("2026-11-22T03:00:00Z");
const c = D001;
const ch = D001_CH1;
const [broadcast, log, analysis, deduction] = ch.scenes as [TimelineScene, RecordsScene, LinkScene, DeduceScene];
const ALL = { evidence: [E.broadcast, E.session, E.file], facts: [F.sameTime, F.scheduled, F.liveLabel] };
const patch = (change: Partial<CaseData>): CaseData => ({ ...CASE_DATA, ...change });
const sessions = (change: (id: string) => object) => CASE_DATA.sessions.map((s) => ({ ...s, ...change(s.id) }));

/** D급이 된 탐정 */
const detective = (): GameState => buildDemoState("promoted", NOW);

/** 장면을 차례로 끝까지 밟는다 (정답 제출 직전까지) */
function playToDeduction(state: GameState): GameState {
  state = seeIntro(state, c, ch);
  for (const point of broadcast.points.filter((p) => p.required)) state = investigate(state, c, ch, broadcast.id, point.id).state;
  state = goScene(state, c, ch, log.id);
  state = pickRecord(state, c, ch, log.id, "B").state;
  state = goScene(state, c, ch, analysis.id);
  for (const link of analysis.links) state = linkItems(state, c, ch, analysis.id, link.a, link.b).state;
  return goScene(state, c, ch, deduction.id);
}

describe("기록 대조: 마지막 방송을 실어 보낸 전송", () => {
  it("시작·종료 시각이 같고 정상 종료된 기록은 B 하나뿐이다", () => {
    const match = matchingSessions(CASE_DATA.broadcast, CASE_DATA.sessions, CASE_DATA.rules);
    expect(match.map((s) => s.id)).toEqual(["B"]);
    expect(judgeRecord("B").correct).toBe(true);
  });

  it("다른 기록은 왜 아닌지 자료에서 까닭이 나온다", () => {
    const { broadcast: b, rules } = CASE_DATA;
    const [a, , third] = CASE_DATA.sessions;
    expect(whyNotSession(b, a, rules)).toContain("21:47에 시작");
    expect(whyNotSession(b, third, rules)).toContain("23:48에 연결이 끊겼");
    expect(judgeRecord("A")).toMatchObject({ correct: false });
    expect(judgeRecord("C")).toMatchObject({ correct: false });
    expect(judgeRecord("Z").correct).toBe(false);
    // 틀린 기록의 까닭은 맞는 기록이 무엇인지 말하지 않는다
    for (const id of ["A", "C"]) expect(judgeRecord(id).reason).not.toMatch(/전송 B|예약/);
  });

  it("자료를 고쳐 맞는 기록이 둘이 되거나 없어지면 어느 것도 정답이 되지 않는다", () => {
    // C 가 끝까지 이어져 정상 종료됐다면: 시각이 같은 기록이 둘
    const two = patch({ sessions: sessions((id) => (id === "C" ? { end: "23:54", status: "done" } : {})) });
    expect(matchingSessions(two.broadcast, two.sessions, two.rules)).toHaveLength(2);
    expect(judgeRecord("B", two).correct).toBe(false);
    expect(judgeRecord("C", two).correct).toBe(false);
    // B 의 종료 시각이 다르면: 맞는 기록이 없다
    const none = patch({ sessions: sessions((id) => (id === "B" ? { end: "23:55" } : {})) });
    expect(matchingSessions(none.broadcast, none.sessions, none.rules)).toHaveLength(0);
    expect(judgeRecord("B", none).correct).toBe(false);
    // "정상 종료된 방송은 시각이 기록과 같다"는 규칙이 없으면 A 도 후보가 된다(이 규칙이 풀이에 꼭 필요하다)
    const loose = patch({ rules: { ...CASE_DATA.rules, doneMatchesSession: false } });
    expect(matchingSessions(loose.broadcast, loose.sessions, loose.rules).map((s) => s.id)).toEqual(["A", "B"]);
  });
});

describe("확정되는 결론은 하나뿐이다", () => {
  it("가진 증거 전부로 확정되는 것은 '예약 송출' 하나이고, 나머지 셋은 정해지지 않는다", () => {
    expect(Object.keys(CLAIMS).sort()).toEqual(deduction.choices.map((x) => x.id).sort());
    const verdicts = Object.fromEntries(deduction.choices.map((x) => [x.id, judge(x.id, ALL)]));
    expect(verdicts).toEqual({ dead: "open", scheduled: "established", manager: "open", abroad: "open" });
  });

  it("LIVE 표시는 실시간 카메라 방송의 증거가 아니다: 방송 기록만으로는 방식이 정해지지 않는다", () => {
    expect(modesAllowedByLabel(CASE_DATA.rules, "LIVE")).toEqual(["camera", "scheduled"]);
    const onlyScreen = { evidence: [E.broadcast], facts: [] };
    expect(judge("scheduled", onlyScreen)).toBe("open");
    expect(worlds(onlyScreen).some((w) => w.mode === "camera")).toBe(true);
    // LIVE 가 카메라 방송에만 붙는 플랫폼이었다면 화면만 보고도 실시간이라고 할 수 있었을 것이다(그리고 전송 기록과 모순된다)
    const strict = patch({ rules: { ...CASE_DATA.rules, liveLabelOn: ["camera"] } });
    expect(judge("scheduled", onlyScreen, strict)).toBe("refuted");
    expect(worlds(ALL, strict)).toHaveLength(0);
  });

  it("제1장의 증거로는 매니저를 지목할 수 없고, 토끼의 생사와 행방도 정해지지 않는다", () => {
    const withEnding = { evidence: [...ALL.evidence, E.account], facts: ALL.facts };
    expect(judge("manager", withEnding)).toBe("open");
    expect(judge("dead", withEnding)).toBe("open");
    expect(judge("abroad", withEnding)).toBe("open");
    // 남은 경우 안에 "토끼가 살아 있다"도 "그렇지 않다"도, 예약한 사람이 매니저인 경우도 아닌 경우도 있다
    const left = worlds(withEnding);
    expect(new Set(left.map((w) => w.alive)).size).toBe(2);
    expect(new Set(left.map((w) => w.uploader)).size).toBeGreaterThan(1);
    expect(new Set(left.map((w) => w.carrier))).toEqual(new Set(["B"]));
    expect(new Set(left.map((w) => w.mode))).toEqual(new Set(["scheduled"]));
    // 끝 장면의 글과 증거도 사람을 지목하지 않는다
    const account = ch.evidence.find((e) => e.id === E.account)!;
    expect(account.note).toContain("누가 등록했는지는 아직 모른다");
    expect(JSON.stringify(ch.ending)).not.toMatch(/매니저|사망|죽었/);
  });

  it("전송 B 가 카메라 방송이었다면 확정되는 선택지가 하나도 없다(정답이 자료에서 나온다)", () => {
    const camera = patch({ sessions: sessions((id) => (id === "B" ? { mode: "camera" } : {})), file: { ...CASE_DATA.file, type: "camera" } });
    const verdicts = deduction.choices.map((x) => judge(x.id, ALL, camera));
    expect(verdicts.filter((v) => v === "established")).toHaveLength(0);
    expect(judge("scheduled", ALL, camera)).toBe("refuted");
  });
});

describe("사건 기록의 '아직 모르는 것'", () => {
  it("끝 장면에서 얻는 계정 기록까지 다 가져도 정말로 정해지지 않는 것만 적혀 있다", () => {
    const everything = { evidence: [...ALL.evidence, E.account], facts: ALL.facts };
    expect(ch.ending.open.length).toBeGreaterThan(0);
    for (const q of ch.ending.open) expect(judge(q.claim, everything), q.text).toBe("open");
    // 확정된 결론을 '모르는 것'에 적지 않는다
    expect(ch.ending.open.map((q) => q.claim)).not.toContain("scheduled");
  });

  it("조사할 곳은 화면 안에 있고 손가락에 맞는 크기다 (328×184 기준 높이 44px 이상)", () => {
    for (const point of broadcast.points) {
      const [x, y, w, h] = point.area;
      if (w === 0) continue; // 타임라인의 길이, 채팅창은 화면 밖의 단추다
      expect(x + w, point.id).toBeLessThanOrEqual(100);
      expect(y + h, point.id).toBeLessThanOrEqual(100);
      expect((h / 100) * 184, point.id).toBeGreaterThanOrEqual(44);
      expect((w / 100) * 328, point.id).toBeGreaterThanOrEqual(88);
    }
    // 같은 시점에 함께 보이는 곳끼리 겹치지 않는다
    for (const frame of broadcast.frames) {
      const shown = broadcast.points.filter((p) => p.area[2] > 0 && (!p.frames || p.frames.includes(frame.id)));
      for (const a of shown)
        for (const b of shown) {
          if (a.id >= b.id) continue;
          const apart = a.area[0] + a.area[2] <= b.area[0] || b.area[0] + b.area[2] <= a.area[0] || a.area[1] + a.area[3] <= b.area[1] || b.area[1] + b.area[3] <= a.area[1];
          expect(apart, `${frame.id}: ${a.id} 와 ${b.id} 가 겹친다`).toBe(true);
        }
    }
  });
});

describe("최종 추론: 결론과 근거를 함께 본다", () => {
  const have = ALL;

  it("예약 송출 + 전송 방식을 적은 기록이어야 맞다", () => {
    expect(judgeDeduction("scheduled", E.session, have)).toBe("correct");
    expect(judgeDeduction("scheduled", E.file, have)).toBe("correct");
  });

  it("결론이 맞아도 방송 화면의 기록(LIVE 표시)을 근거로 대면 통과하지 못한다", () => {
    expect(judgeDeduction("scheduled", E.broadcast, have)).toBe("weak");
    expect(deduction.weak[E.broadcast]).toContain("LIVE 표시");
  });

  it("다른 결론은 어떤 근거를 대도 통과하지 못한다", () => {
    for (const claim of ["dead", "manager", "abroad"]) {
      for (const basis of deduction.basis) expect(judgeDeduction(claim, basis, have), `${claim}/${basis}`).toBe("unsupported");
    }
    expect(judgeDeduction("없는 결론", E.session, have)).toBe("unsupported");
  });

  it("갖고 있지 않은 증거를 근거로 댈 수 없다", () => {
    expect(judgeDeduction("scheduled", E.session, { evidence: [E.broadcast], facts: [] })).toBe("unsupported");
    expect(judgeDeduction("scheduled", E.file, { evidence: [E.broadcast, E.session], facts: ALL.facts })).toBe("weak");
  });

  it("선택지마다 '왜 확정할 수 없는지'의 글이 있고, 그 글은 결말을 말하지 않는다", () => {
    for (const choice of deduction.choices) {
      expect(choice.unsupported.length).toBeGreaterThan(10);
      expect(choice.unsupported).not.toMatch(/예약 송출|생방송이 아니/);
    }
    expect(deduction.basis).toEqual([E.broadcast, E.session, E.file]);
  });
});

describe("증거 분석: 잇기 표가 자료와 맞다", () => {
  it("세 사실은 저마다 이은 두 항목에서 실제로 나온다", () => {
    expect(analysis.links.map((l) => l.fact).sort()).toEqual(analysis.facts.map((f) => f.id).sort());
    for (const link of analysis.links) expect(LINK_HOLDS[link.fact](CASE_DATA), link.fact).toBe(true);
    // 자료가 달라지면 그 사실은 나오지 않는다
    expect(LINK_HOLDS[F.sameTime](patch({ sessions: sessions((id) => (id === "B" ? { end: "23:55" } : {})) }))).toBe(false);
    expect(LINK_HOLDS[F.scheduled](patch({ file: { ...CASE_DATA.file, registeredAt: "23:50" } }))).toBe(false);
    expect(LINK_HOLDS[F.scheduled](patch({ file: { ...CASE_DATA.file, lengthSec: 300 } }))).toBe(false);
    expect(LINK_HOLDS[F.liveLabel](patch({ rules: { ...CASE_DATA.rules, liveLabelOn: ["camera"] } }))).toBe(false);
  });

  it("항목은 두 문서에 나뉘어 있고, 잇는 짝은 한 문서에서 하나씩이다", () => {
    const [a, b] = analysis.docs.map((doc) => doc.items.map((item) => item.id));
    for (const link of analysis.links) {
      expect(a).toContain(link.a);
      expect(b).toContain(link.b);
    }
    // 짝이 줄 순서대로 놓여 있지 않다(같은 줄끼리 이으면 되는 문제가 아니다)
    expect(analysis.links.every((link) => a.indexOf(link.a) === b.indexOf(link.b))).toBe(false);
    // 화면에 적힌 값이 자료와 같다
    expect(analysis.docs[0].items.find((i) => i.id === "a-time")!.value).toBe("23:47 → 23:54");
    expect(analysis.docs[1].items.find((i) => i.id === "b-time")!.value).toContain("23:47 → 23:54");
    expect(analysis.docs[1].items.find((i) => i.id === "b-fail")!.value).toContain("23:48");
  });

  it("사실 셋이 있으면 '예약 송출'이 확정되고, 하나라도 없이는 근거 하나만으로 확정되지 않는 경우가 있다", () => {
    expect(judge("scheduled", { evidence: [E.broadcast, E.file], facts: [F.sameTime] })).toBe("established");
    expect(judge("scheduled", { evidence: [E.broadcast, E.file], facts: [] })).toBe("open");
  });
});

describe("필요한 단서를 모두 조사할 수 있다", () => {
  it("증거 01 에 필요한 조사 포인트는 모두 어느 시점엔가 보인다", () => {
    const frameIds = broadcast.frames.map((f) => f.id);
    const required = broadcast.points.filter((p) => p.required);
    expect(required.map((p) => p.id).sort()).toEqual(["end", "length", "live", "start"]);
    for (const point of broadcast.points) {
      for (const id of point.frames ?? []) expect(frameIds, point.id).toContain(id);
      if (point.frames) expect(point.frames.length).toBeGreaterThan(0);
      expect(point.note.length).toBeGreaterThan(4);
    }
    // 시작 시각과 종료 시각은 서로 다른 시점에 있다: 타임라인을 넘겨 봐야 모인다
    const at = (id: string) => broadcast.points.find((p) => p.id === id)!.frames;
    expect(at("start")).toEqual(["t0015"]);
    expect(at("end")).toEqual(["t0700"]);
    // 시점은 시간 순서이고, 마지막 시점이 영상의 끝이다
    expect(broadcast.frames.map((f) => f.at)).toEqual([15, 190, 400, 420]);
    expect(broadcast.frames[3].at).toBe(CASE_DATA.broadcast.lengthSec);
    expect(broadcast.frames[0].clock).toBe(CASE_DATA.broadcast.start);
    expect(broadcast.frames[3].clock).toBe(CASE_DATA.broadcast.end);
  });

  it("증거의 글이 자료와 같다", () => {
    const line = (id: string, label: string) => ch.evidence.find((e) => e.id === id)!.lines.find((l) => l.label === label)!.value;
    expect(line(E.broadcast, "시작")).toBe("23:47");
    expect(line(E.broadcast, "종료")).toBe("23:54");
    expect(line(E.broadcast, "영상 길이")).toBe("07:00");
    expect(line(E.session, "전송 방식")).toBe("예약 영상 재생");
    expect(line(E.file, "등록 시각")).toBe("18:20");
    expect(line(E.file, "파일명")).toBe("TORI_FINAL_07.mp4");
    expect(ch.evidence.map((e) => e.id)).toEqual([E.broadcast, E.session, E.file, E.account]);
  });
});

describe("진행: 처음부터 끝까지", () => {
  it("D급부터 맡는다. F급에서는 열리지 않고 어떤 조작도 듣지 않는다", () => {
    const rookie = enroll(createInitialState(), "견습", "DA-1", NOW);
    expect(storyUnlocked(rookie, c)).toBe(false);
    expect(caseStatus(rookie, c)).toBe("locked");
    expect(seeIntro(rookie, c, ch)).toBe(rookie);
    expect(investigate(rookie, c, ch, broadcast.id, "live").state).toBe(rookie);
    expect(submitDeduction(rookie, c, ch, deduction.id, "scheduled", E.session, NOW).state).toBe(rookie);
    expect(caseStatus(detective(), c)).toBe("new");
    expect(c.rank).toBe("D");
  });

  it("장면은 차례로 열린다: 앞 장면에서 얻을 것을 얻어야 다음으로 간다", () => {
    let state = detective();
    const reach = (id: string) => sceneReachable(getChapter(state, c, ch), ch, id);
    expect(reach(broadcast.id)).toBe(false); // 도입을 보기 전
    state = seeIntro(state, c, ch);
    expect(getChapter(state, c, ch)).toMatchObject({ scene: broadcast.id, introSeen: true, status: "in_progress" });
    expect(reach(log.id)).toBe(false);
    expect(goScene(state, c, ch, log.id)).toBe(state);

    // 필요한 네 곳 가운데 셋만으로는 증거가 완성되지 않는다
    for (const id of ["live", "start", "length"]) {
      const result = investigate(state, c, ch, broadcast.id, id);
      expect(result.outcome).toEqual({ fresh: true, granted: null });
      state = result.state;
    }
    expect(reach(log.id)).toBe(false);
    // 꼭 필요하지 않은 곳을 조사해도 노트에만 남는다
    state = investigate(state, c, ch, broadcast.id, "chat").state;
    expect(getChapter(state, c, ch).evidence).toEqual([]);
    const last = investigate(state, c, ch, broadcast.id, "end");
    expect(last.outcome).toEqual({ fresh: true, granted: E.broadcast });
    state = last.state;
    // 같은 곳을 다시 조사해도 달라지지 않는다
    expect(investigate(state, c, ch, broadcast.id, "end").state).toBe(state);
    expect(investigate(state, c, ch, broadcast.id, "없는 곳").state).toBe(state);
    expect(reach(log.id)).toBe(true);
    expect(reach(analysis.id)).toBe(false);

    // 전송 기록: 틀린 기록은 까닭을 듣고 다시 고른다
    state = goScene(state, c, ch, log.id);
    const wrong = pickRecord(state, c, ch, log.id, "C");
    expect(wrong.outcome).toMatchObject({ correct: false, granted: [] });
    state = wrong.state;
    expect(getChapter(state, c, ch).wrong).toBe(1);
    expect(reach(analysis.id)).toBe(false);
    const right = pickRecord(state, c, ch, log.id, "B");
    expect(right.outcome).toMatchObject({ correct: true, granted: [E.session, E.file] });
    state = right.state;
    expect(getChapter(state, c, ch).picked).toEqual({ [log.id]: "B" });
    // 맞힌 뒤에 다른 기록을 눌러 봐도 틀린 횟수가 늘지 않는다
    expect(pickRecord(state, c, ch, log.id, "A").state).toBe(state);

    // 증거 분석: 엉뚱한 짝은 채점되지 않고 까닭만 듣는다
    state = goScene(state, c, ch, analysis.id);
    expect(reach(deduction.id)).toBe(false);
    const miss = linkItems(state, c, ch, analysis.id, "a-time", "b-fail");
    expect(miss.outcome).toMatchObject({ kind: "none" });
    expect(miss.outcome.text).toContain("23:48");
    expect(miss.state).toBe(state);
    expect(linkItems(state, c, ch, analysis.id, "a-title", "b-rule").outcome.text).toContain("제목");
    expect(linkItems(state, c, ch, analysis.id, "a-live", "b-fail").outcome.text).toBe("두 항목은 서로 말해 주는 것이 없다.");
    // 순서를 바꿔 이어도 같다
    const first = linkItems(state, c, ch, analysis.id, "b-time", "a-time");
    expect(first.outcome).toMatchObject({ kind: "fact", all: false });
    state = first.state;
    expect(linkItems(state, c, ch, analysis.id, "a-time", "b-time").outcome.kind).toBe("known");
    state = linkItems(state, c, ch, analysis.id, "a-length", "b-file").state;
    expect(reach(deduction.id)).toBe(false);
    const third = linkItems(state, c, ch, analysis.id, "a-live", "b-rule");
    expect(third.outcome).toMatchObject({ kind: "fact", all: true });
    state = third.state;
    expect(reach(deduction.id)).toBe(true);
    // 사실을 모았다고 결론이 저절로 나지 않는다
    expect(getChapter(state, c, ch).status).toBe("in_progress");
    expect(reach("ending")).toBe(false);
  });

  it("오답은 결말을 열지 않고, 몇 번이든 다시 낼 수 있다. 정답은 보상을 한 번만 준다", () => {
    let state = playToDeduction(detective());
    const before = state.credits;

    expect(submitDeduction(state, c, ch, deduction.id, null, E.session, NOW).outcome.verdict).toBe("incomplete");
    expect(submitDeduction(state, c, ch, deduction.id, "scheduled", null, NOW).outcome.verdict).toBe("incomplete");

    for (const [choice, basis, verdict] of [
      ["dead", E.session, "unsupported"],
      ["manager", E.file, "unsupported"],
      ["scheduled", E.broadcast, "weak"],
    ] as const) {
      const result = submitDeduction(state, c, ch, deduction.id, choice, basis, NOW);
      expect(result.outcome).toMatchObject({ verdict, reward: 0 });
      expect(result.outcome.text.length).toBeGreaterThan(10);
      state = result.state;
      expect(getChapter(state, c, ch).status).toBe("in_progress");
      expect(sceneReachable(getChapter(state, c, ch), ch, "ending")).toBe(false);
      // 틀린 뒤에도 앞 장면으로 돌아가 다시 조사할 수 있다
      expect(sceneReachable(getChapter(state, c, ch), ch, broadcast.id)).toBe(true);
    }
    expect(getChapter(state, c, ch).wrong).toBe(3);
    expect(state.credits).toBe(before);

    const pass = submitDeduction(state, c, ch, deduction.id, "scheduled", E.session, NOW);
    expect(pass.outcome).toEqual({ verdict: "correct", text: "", reward: 120 });
    state = pass.state;
    expect(state.credits).toBe(before + 120);
    expect(getChapter(state, c, ch)).toMatchObject({ status: "cleared", scene: "ending", rewardClaimed: true, clearedAt: NOW.toISOString() });
    // 끝 장면의 새 기록이 노트에 들어온다
    expect(getChapter(state, c, ch).evidence).toEqual([E.broadcast, E.session, E.file, E.account]);
    expect(caseStatus(state, c)).toBe("cleared");

    // 다시 제출해도 보상은 없고 기록도 바뀌지 않는다
    const again = submitDeduction(state, c, ch, deduction.id, "scheduled", E.file, NOW);
    expect(again.outcome.reward).toBe(0);
    expect(again.state).toBe(state);
    expect(submitDeduction(state, c, ch, deduction.id, "dead", E.file, NOW).state).toBe(state);
    expect(state.credits).toBe(before + 120);

    state = finishEnding(state, c, ch);
    expect(getChapter(state, c, ch)).toMatchObject({ endingSeen: true, scene: "record" });
    // 해결한 뒤에는 모든 장면을 다시 볼 수 있다
    for (const scene of ch.scenes) expect(sceneReachable(getChapter(state, c, ch), ch, scene.id)).toBe(true);
  });

  it("제1장을 해결해도 등급과 승급 시험은 그대로다", () => {
    const before = playToDeduction(detective());
    const after = submitDeduction(before, c, ch, deduction.id, "scheduled", E.session, NOW).state;
    expect(after.rank).toBe(before.rank);
    expect(after.promotions).toEqual(before.promotions);
    expect(after.puzzles).toBe(before.puzzles);
    expect(after.exam).toBe(before.exam);
  });

  it("수사 지원은 크레딧으로 열고, 모자라면 열리지 않는다", () => {
    let state = { ...playToDeduction(detective()), credits: 50 };
    const first = requestStoryHint(state, c, ch);
    expect(first.outcome).toEqual({ kind: "opened", tier: 0, cost: 20 });
    state = first.state;
    expect(state.credits).toBe(30);
    const second = requestStoryHint(state, c, ch);
    expect(second.outcome).toEqual({ kind: "insufficient", tier: 1, cost: 40, shortBy: 10 });
    expect(second.state).toBe(state);
    state = requestStoryHint({ ...state, credits: 40 }, c, ch).state;
    expect(state.credits).toBe(0);
    expect(requestStoryHint(state, c, ch).outcome).toEqual({ kind: "exhausted" });
    expect(ch.hints).toHaveLength(2);
    // 힌트는 결론을 그대로 적지 않는다
    for (const hint of ch.hints) expect(hint).not.toMatch(/예약 송출이었|전송 B/);
    // 크레딧이 없어도 사건은 끝까지 풀린다
    expect(submitDeduction(state, c, ch, deduction.id, "scheduled", E.session, NOW).outcome.verdict).toBe("correct");
  });
});

describe("저장", () => {
  it("저장했다 읽어도 진행이 그대로다", () => {
    let state = playToDeduction(detective());
    expect(hydrate(JSON.parse(JSON.stringify(state)))).toEqual(state);
    state = finishEnding(submitDeduction(state, c, ch, deduction.id, "scheduled", E.session, NOW).state, c, ch);
    expect(hydrate(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it("스토리가 없던 때의 저장을 읽으면 기존 기록은 그대로이고 스토리는 빈 상태다", () => {
    const old = JSON.parse(JSON.stringify(detective()));
    delete old.story;
    const restored = hydrate(old);
    expect(restored.story).toEqual({ chapters: {} });
    expect(restored.rank).toBe("D");
    expect(restored.credits).toBe(detective().credits);
    expect(Object.keys(restored.puzzles)).toEqual(Object.keys(detective().puzzles));
  });

  it("깨진 값은 버리고, 들어갈 수 없는 곳에 있던 진행은 들어갈 수 있는 곳으로 돌린다", () => {
    const base = JSON.parse(JSON.stringify(detective()));
    const key = chapterKey(c, ch);
    const read = (chapter: unknown) => hydrate({ ...base, story: { chapters: { [key]: chapter, "없는/장": { status: "cleared" } } } }).story.chapters;
    expect(Object.keys(read({ status: "in_progress" }))).toEqual([key]);
    // 증거도 없이 끝 장면에 있다고 적힌 값
    expect(read({ status: "in_progress", introSeen: true, scene: "ending" })[key].scene).toBe(broadcast.id);
    expect(read({ status: "in_progress", introSeen: false, scene: deduction.id })[key].scene).toBe("intro");
    // 없는 증거·사실·포인트
    const dirty = read({ status: "in_progress", introSeen: true, scene: broadcast.id, evidence: ["e01", "가짜"], facts: ["f99"], notes: ["live", 3], wrong: -2, hintsUsed: 9 })[key];
    expect(dirty).toMatchObject({ evidence: ["e01"], facts: [], notes: ["live"], wrong: 0, hintsUsed: 2 });
    expect(hydrate({ ...base, story: "이야기" }).story).toEqual({ chapters: {} });
    expect(CASES.map((x) => x.id)).toEqual(["d001"]);
  });
});
