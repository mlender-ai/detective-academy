import { describe, expect, it } from "vitest";
import { BROADCAST, E as E1, SOURCE_FILE, worlds as worlds1 } from "../../story/cases/d001/logic";
import { ORIGINAL } from "../../story/cases/d001/logic2";
import { ACCESS, DOOR, E3, modifyingSession } from "../../story/cases/d001/logic3";
import {
  ACTORS,
  CARRIED4,
  CASE4,
  CLAIMS4,
  DAY,
  E4,
  F4,
  LINK_HOLDS4,
  LOGIN,
  NOBODY,
  POLICE,
  SCHEDULED,
  TEXT_MESSAGE,
  assignments,
  candidates,
  inEditRoom,
  judge4,
  judgeAssign4,
  judgeDeduction4,
  minutesBeforeAir,
  peopleInEditRoom,
  policeVouches,
  worlds4,
  type CaseData4,
} from "../../story/cases/d001/logic4";
import { DOHEE, GAEUL, SANGMIN, SEORIN } from "../../story/cases/d001/people";
import { assignedOf, goScene, linkItems, sceneReachable, seeIntro, setAssign, submitAssign, submitDeduction } from "../../story/engine/storyEngine";
import type { AssignScene, DeduceScene, LinkScene } from "../../story/engine/storyTypes";
import { NOW, c, ch1, ch4, combos, correctDeductions, playScene, playToDeduction, progress, submitCorrect, upTo } from "./d001-play";

/**
 * CASE D-001 제4장 「토끼의 정체」.
 * 그날 하루의 일마다 "누가 했는가"가 기록으로 한 사람씩 남는지, 윤서린의 생사가 계정·문자가 아닌
 * 대면 확인으로만 확정되는지를 전수 탐색으로 본다. 지금 있는 곳은 끝까지 열려 있어야 한다.
 */

const ch = ch4;
const [connect, day, deduction] = ch.scenes as [LinkScene, AssignScene, DeduceScene];
const GIVEN = [E4.login, E4.text, E4.police, E4.schedule, E4.restated];
const ALL = { evidence: [...CARRIED4, ...GIVEN, E4.report] };
const only = (...ids: string[]) => ({ evidence: [...CARRIED4, ...ids] });
const without = (...ids: string[]) => ({ evidence: ALL.evidence.filter((id) => !ids.includes(id)) });
const patch = (change: Partial<CaseData4>): CaseData4 => ({ ...CASE4, ...change });
const start = () => upTo(ch);

describe("증거 연결: 진술과 새 기록을 확인된 기록에 맞대어 본다", () => {
  it("네 사실은 저마다 이은 두 항목에서 실제로 나온다", () => {
    expect(connect.links.map((l) => l.fact).sort()).toEqual(connect.facts.map((f) => f.id).sort());
    expect(connect.facts.map((f) => f.id)).toEqual(Object.values(F4));
    for (const link of connect.links) expect(LINK_HOLDS4[link.fact](CASE4), link.fact).toBe(true);
    // 자료가 달라지면 그 사실은 나오지 않는다
    expect(LINK_HOLDS4[F4.rumorFalse](patch({ police: { ...POLICE, inPerson: false } }))).toBe(false);
    expect(LINK_HOLDS4[F4.rumorFalse](patch({ police: { ...POLICE, at: { day: 0, clock: "20:00" } } }))).toBe(false); // 방송 전의 확인이었다면
    expect(LINK_HOLDS4[F4.doheeHid](patch({ police: { ...POLICE, whereabouts: "stated" } }))).toBe(false);
    expect(LINK_HOLDS4[F4.registrar](patch({ scheduled: { ...SCHEDULED, onEditPC: false } }))).toBe(false);
    expect(LINK_HOLDS4[F4.registrar](patch({ scheduled: { ...SCHEDULED, at: "17:40" } }))).toBe(false); // 그때는 편집실에 두 사람이 있었다
    const earlier = { ...CASE4.three, access: ACCESS.map((s) => (s.password === "new" ? { ...s, from: "23:50" as const, to: "23:58" as const } : s)) };
    expect(LINK_HOLDS4[F4.gaeulKnew](patch({ three: earlier }))).toBe(false); // 방송 뒤에야 봤다면
  });

  it("사실의 글이 자료와 같다: 방송 4시간 37분 전, 18:20 의 편집실, 방송 다음 날의 대면", () => {
    expect(minutesBeforeAir()).toBe(4 * 60 + 37);
    const text = (id: string) => connect.facts.find((f) => f.id === id)!.text;
    expect(text(F4.gaeulKnew)).toContain("4시간 37분");
    expect(text(F4.registrar)).toContain(SOURCE_FILE.registeredAt);
    expect(peopleInEditRoom({ from: SCHEDULED.at, to: SCHEDULED.at }, ALL)).toEqual([SANGMIN]);
    expect(peopleInEditRoom(modifyingSession(), ALL)).toEqual([SANGMIN, DOHEE]);
    expect(connect.facts.map((f) => f.no)).toEqual(["사실 04", "사실 05", "사실 06", "사실 07"]); // 제1장의 사실 01~03 에 이어진다
  });

  it("항목은 두 문서에 나뉘어 있고, 엉뚱한 짝은 까닭을 듣는다(채점되지 않는다)", () => {
    const [a, b] = connect.docs.map((doc) => doc.items.map((item) => item.id));
    for (const link of connect.links) {
      expect(a).toContain(link.a);
      expect(b).toContain(link.b);
    }
    expect(connect.links.every((link) => a.indexOf(link.a) === b.indexOf(link.b))).toBe(false);
    let state = seeIntro(start(), c, ch);
    expect(progress(state, ch).evidence).toEqual(GIVEN);
    const miss = linkItems(state, c, ch, connect.id, "a-rumor", "b-air");
    expect(miss.outcome.kind).toBe("none");
    expect(miss.outcome.text).toContain("방송 기록은");
    expect(miss.state).toBe(state);
    for (const x of a) for (const y of b) if (!connect.links.some((l) => l.a === x && l.b === y)) expect(linkItems(state, c, ch, connect.id, x, y).outcome.kind, `${x}|${y}`).toBe("none");
    state = playScene(state, ch, connect);
    expect(progress(state, ch).facts).toEqual(connect.links.map((l) => l.fact));
    expect(sceneReachable(progress(state, ch), ch, day.id)).toBe(true);
  });
});

describe("그날의 타임라인: 누가 했는가", () => {
  it("일곱 줄 × 다섯 가지의 모든 배정 78125 가지 가운데 기록과 어긋나지 않는 것은 하나뿐이다", () => {
    expect(ACTORS.length ** DAY.length).toBe(78125);
    const left = assignments(ALL);
    expect(left).toHaveLength(1);
    expect(left[0]).toEqual({ "r-export": GAEUL, "r-leave": SEORIN, "r-visit": DOHEE, "r-modify": SANGMIN, "r-register": SANGMIN, "r-view": GAEUL, "r-air": NOBODY });
    for (const row of DAY) expect(candidates(row.id, ALL), row.id).toHaveLength(1);
    // 화면의 줄과 고를 것이 판정의 것과 같고, 줄은 시각 순서다
    expect(day.rows.map((r) => r.id)).toEqual(DAY.map((r) => r.id));
    expect(day.options.map((o) => o.id)).toEqual([...ACTORS]);
    expect(day.rows.map((r) => r.time)).toEqual([ORIGINAL.createdAt, "15시경", "17:25", "17:31", "18:20", "19:10", BROADCAST.start]);
    // 네 사람 모두 한 줄 이상에 들어간다(각 인물이 실제로 한 일을 가른다)
    expect(new Set(Object.values(left[0])).size).toBe(ACTORS.length);
  });

  it("줄마다 그 줄을 정하는 증거가 있다: 그 증거를 빼면 한 사람으로 정해지지 않는다", () => {
    const open = (rowId: string, ...ids: string[]) => candidates(rowId, without(...ids)).length;
    expect(open("r-leave", E4.police)).toBe(5); // 경찰의 회신이 없으면 누가 떠났는지 모른다
    expect(open("r-register", E4.schedule)).toBe(4); // 등록에 쓴 장치를 모르면 공용 계정을 쓰는 누구든 될 수 있다
    expect(open("r-register", E3.door)).toBe(4);
    expect(open("r-export", E3.door)).toBe(4);
    expect(open("r-view", E3.door)).toBe(4);
    expect(open("r-visit", E3.lobby)).toBe(4); // 방문증을 누가 받아 갔는지 모른다
    expect(open("r-modify", E3.perms)).toBe(2);
    expect(open("r-modify", E3.door)).toBe(2);
    expect(open("r-air", E1.session, E1.file)).toBe(5); // 제1장의 전송 기록이 없으면 생방송이었을 수도 있다
    // 이 장에 들어설 때(앞 장의 증거만)는 두 줄이 정해지지 않는다
    expect(assignments({ evidence: [...CARRIED4] })).toHaveLength(20);
    // 계정 접속 기록, 문자, 두 번째 진술은 타임라인의 어느 줄도 정하지 않는다
    expect(assignments(without(E4.login, E4.text, E4.restated))).toHaveLength(1);
  });

  it("틀린 사람마다 왜 아닌지의 까닭이 있고, 그 까닭은 누가 맞는지 말하지 않는다", () => {
    const answer = assignments(ALL)[0];
    for (const row of DAY)
      for (const actor of ACTORS) {
        const why = row.exclude(actor, ALL, CASE4);
        if (actor === answer[row.id]) expect(why, `${row.id}/${actor}`).toBeNull();
        else {
          expect(why!.length, `${row.id}/${actor}`).toBeGreaterThan(15);
          const right = day.options.find((o) => o.id === answer[row.id])!.name;
          if (answer[row.id] !== NOBODY && actor !== answer[row.id]) expect(why, `${row.id}/${actor}`).not.toContain(right);
        }
      }
    expect(DAY.find((r) => r.id === "r-modify")!.exclude(DOHEE, ALL, CASE4)).toContain("관리자 권한이 없습니다");
    expect(DAY.find((r) => r.id === "r-modify")!.exclude(GAEUL, ALL, CASE4)).toContain("편집실에 없었습니다");
    expect(DAY.find((r) => r.id === "r-air")!.exclude(SEORIN, ALL, CASE4)).toContain("예약 재생");
  });

  it("편집실에 있었는지는 지문 기록과 방문증으로 읽는다", () => {
    const at = (clock: string) => ({ from: clock, to: clock });
    expect(inEditRoom(GAEUL, at(ORIGINAL.createdAt), ALL)).toBe(true);
    expect(inEditRoom(SANGMIN, at(ORIGINAL.createdAt), ALL)).toBe(false);
    expect(inEditRoom(DOHEE, at("17:40"), ALL)).toBe(true);
    expect(inEditRoom(DOHEE, at("17:40"), without(E3.lobby))).toBeNull(); // 방문증을 든 사람을 모른다
    expect(inEditRoom(DOHEE, at("18:20"), without(E3.lobby))).toBe(false); // 그때는 방문증이 안에 없다
    expect(inEditRoom(SEORIN, at("17:40"), ALL)).toBe(false);
    expect(inEditRoom(SANGMIN, at("17:40"), without(E3.door))).toBeNull();
    expect(DOOR.find((line) => line.who === null)!.spans[0].to < SCHEDULED.at).toBe(true);
  });

  it("넣어 둔 것은 남고, 빈 줄이 있으면 내지 못하고, 틀린 줄은 까닭을 듣고 고친다", () => {
    let state = playScene(seeIntro(start(), c, ch), ch, connect);
    state = goScene(state, c, ch, day.id);
    expect(submitAssign(state, c, ch, day.id).outcome).toMatchObject({ verdict: "incomplete", rows: DAY.map((r) => r.id) });
    const answer = assignments(ALL)[0];
    for (const row of day.rows) state = setAssign(state, c, ch, day.id, row.id, answer[row.id]);
    expect(setAssign(state, c, ch, day.id, "없는 줄", SEORIN)).toBe(state);
    expect(setAssign(state, c, ch, day.id, "r-air", "없는 사람")).toBe(state);
    // 23:47 의 방송에 윤서린을 넣는다(제1장의 결론을 잊은 답), 예약 등록에 한가을을 넣는다
    state = setAssign(state, c, ch, day.id, "r-air", SEORIN);
    state = setAssign(state, c, ch, day.id, "r-register", GAEUL);
    expect(assignedOf(progress(state, ch), day)["r-air"]).toBe(SEORIN);
    const wrong = submitAssign(state, c, ch, day.id);
    expect(wrong.outcome).toMatchObject({ verdict: "wrong", rows: ["r-register", "r-air"], granted: [] });
    expect(wrong.outcome.reason).toContain("18:20에 편집실에 없었습니다");
    state = wrong.state;
    expect(progress(state, ch).wrong).toBe(1);
    expect(sceneReachable(progress(state, ch), ch, deduction.id)).toBe(false);
    state = setAssign(state, c, ch, day.id, "r-air", null);
    expect(submitAssign(state, c, ch, day.id).outcome).toMatchObject({ verdict: "incomplete", rows: ["r-air"] });
    state = setAssign(state, c, ch, day.id, "r-air", NOBODY);
    state = setAssign(state, c, ch, day.id, "r-register", SANGMIN);
    const right = submitAssign(state, c, ch, day.id);
    expect(right.outcome).toMatchObject({ verdict: "correct", rows: [] });
    state = right.state;
    expect(sceneReachable(progress(state, ch), ch, deduction.id)).toBe(true);
    expect(setAssign(state, c, ch, day.id, "r-air", SEORIN)).toBe(state); // 끝낸 뒤에는 바꾸지 못한다
    expect(judgeAssign4(answer, { evidence: GIVEN, facts: [] })).toEqual({ correct: true, wrong: [], reason: "" });
    // 경찰의 회신을 갖지 못했다면 맞는 답을 넣어도 그 줄은 확정된 것이 아니다
    expect(judgeAssign4(answer, { evidence: GIVEN.filter((id) => id !== E4.police), facts: [] }).wrong).toEqual(["r-leave"]);
  });
});

describe("윤서린에게 무슨 일이 있었나: 확정되는 결론은 하나뿐이다", () => {
  it("가진 증거 전부로 확정되는 것은 '스스로 떠났고 살아 있으며 무사하다' 하나다", () => {
    expect(Object.keys(CLAIMS4).sort()).toEqual(deduction.choices.map((x) => x.id).sort());
    const verdicts = Object.fromEntries(deduction.choices.map((x) => [x.id, judge4(x.id, ALL)]));
    expect(verdicts).toEqual({ dead: "refuted", hoax: "refuted", left: "established", taken: "refuted", abroad: "open" });
    expect(worlds4({ evidence: [] })).toHaveLength(72);
    expect(worlds4(ALL)).toHaveLength(16);
    // 이 장에 들어설 때는 생사도, 떠난 뜻도 열려 있다
    for (const claim of ["dead", "taken", "left", "abroad"]) expect(judge4(claim, { evidence: [...CARRIED4] }), claim).toBe("open");
  });

  it("계정 접속과 문자는 하나씩으로도, 둘을 합쳐도, 강도희의 말까지 더해도 생존을 확정하지 못한다", () => {
    for (const some of [[E4.login], [E4.text], [E4.restated], [E4.login, E4.text], [E4.login, E4.text, E4.restated], [E4.login, E4.text, E4.restated, E4.schedule]]) {
      expect(judge4("left", only(...some)), some.join("+")).toBe("open");
      expect(judge4("dead", only(...some)), some.join("+")).toBe("open");
    }
    // 남은 경우 안에 "살아 있지 않고, 문자와 접속은 다른 사람이 남겼고, 강도희의 말은 거짓"인 경우가 있다
    const left = worlds4(only(E4.login, E4.text, E4.restated));
    expect(left.some((w) => !w.alive && w.textBy === "other" && w.loginBy === "other" && !w.doheeHonest)).toBe(true);
    // 경찰의 대면 확인 하나로 확정된다. 그것을 빼면 나머지 전부로도 확정되지 않는다
    expect(judge4("left", only(E4.police))).toBe("established");
    expect(judge4("left", without(E4.police))).toBe("open");
    expect(policeVouches(POLICE)).toBe(true);
    expect(LOGIN.by).toBe("비밀번호 입력");
    expect(TEXT_MESSAGE.at.day).toBe(1);
  });

  it("경찰의 확인이 대면이 아니었거나 신분을 대조하지 않았다면 확정되지 않는다(정답이 자료에서 나온다)", () => {
    expect(judge4("left", ALL, patch({ police: { ...POLICE, inPerson: false } }))).toBe("open");
    expect(judge4("left", ALL, patch({ police: { ...POLICE, idChecked: false } }))).toBe("open");
    // 본인이 "끌려왔다"고 말했다면 결론이 달라진다
    const forced = patch({ police: { ...POLICE, will: "forced" } });
    expect(judge4("taken", ALL, forced)).toBe("established");
    expect(judge4("left", ALL, forced)).toBe("refuted");
  });

  it("잘못된 가설마다 걸려 넘어지는 증거가 있고, 지금 있는 곳은 끝까지 열려 있다", () => {
    expect(judge4("dead", only(E4.police))).toBe("refuted");
    expect(judge4("taken", only(E4.police))).toBe("refuted");
    // '본인이 꾸민 일': 제3장의 기록(편집실 출입 기록)이 지운다. 그 기록이 없으면 지워지지 않는다
    expect(judge4("hoax", { evidence: [...CARRIED4] })).toBe("refuted");
    expect(judge4("hoax", { evidence: ALL.evidence.filter((id) => id !== E3.door) })).toBe("open");
    expect(judge4("abroad", ALL)).toBe("open");
    expect(POLICE.whereabouts).toBe("withheld");
    expect(ch.ending.open.map((q) => q.claim)).toEqual(["abroad"]);
    for (const choice of deduction.choices) expect(choice.unsupported.length).toBeGreaterThan(10);
    // 장의 글 어디에도 소재지가 적혀 있지 않다
    expect(JSON.stringify(ch.evidence)).not.toMatch(/해외|국내|주소|고향/);
    expect(ch.evidence.find((e) => e.id === E4.police)!.lines.find((l) => l.label === "지금 있는 곳")!.value).toBe("본인 요청으로 적지 않음");
  });

  it("실제로 있었던 일은 어떤 증거를 가졌든 지워지지 않고, 증거가 늘면 남는 경우는 줄기만 한다", () => {
    const isTruth = (w: ReturnType<typeof worlds4>[number]) => w.alive && w.will === "own" && w.textBy === "self" && w.loginBy === "self" && w.doheeHonest && !w.selfMade;
    for (const size of [0, 1, 2, 3, 4, 5])
      for (const some of combos(GIVEN, size)) {
        const left = worlds4(only(...some));
        expect(left.some(isTruth), some.join("+")).toBe(true);
        for (const more of GIVEN.filter((id) => !some.includes(id))) expect(worlds4(only(...some, more)).length).toBeLessThanOrEqual(left.length);
      }
  });
});

describe("최종 추론: 결론과 근거", () => {
  const have = { evidence: GIVEN, facts: [] };

  it("경찰의 회신을 근거로 낼 때만 통과한다. 접속 기록·문자·진술은 약한 근거다", () => {
    expect(deduction.need ?? 1).toBe(1);
    expect(deduction.basis).toEqual([E4.login, E4.text, E4.police, E4.restated]);
    expect(correctDeductions(ch, have)).toEqual([{ choice: "left", bases: [E4.police] }]);
    for (const basis of [E4.login, E4.text, E4.restated]) {
      expect(judgeDeduction4("left", basis, have), basis).toBe("weak");
      expect(deduction.weak[basis].length).toBeGreaterThan(20);
    }
    expect(deduction.weak[E4.login]).toContain("비밀번호를 아는 사람");
    expect(deduction.weak[E4.text]).toContain("전화기를 가진 사람");
    for (const claim of ["dead", "taken", "hoax", "abroad"]) for (const basis of deduction.basis) expect(judgeDeduction4(claim, basis, have), `${claim}/${basis}`).toBe("unsupported");
  });

  it("맞히면 장과 사건이 함께 끝난다: 끝 글과 '사건 해결'", () => {
    let state = playToDeduction(start(), ch);
    const before = state.credits;
    const weak = submitDeduction(state, c, ch, deduction.id, "left", E4.text, NOW);
    expect(weak.outcome).toMatchObject({ verdict: "weak", text: deduction.weak[E4.text] });
    state = weak.state;
    const rumor = submitDeduction(state, c, ch, deduction.id, "dead", E4.police, NOW);
    expect(rumor.outcome.verdict).toBe("unsupported");
    state = rumor.state;
    expect(state.credits).toBe(before);
    const pass = submitCorrect(state, ch);
    expect(pass.outcome).toEqual({ verdict: "correct", text: "", reward: 120, caseReward: 100 });
    expect(pass.state.credits).toBe(before + 220);
    expect(ch.ending).toMatchObject({
      lines: ["토끼는 사라졌다.", "하지만 윤서린은 자신의 삶으로 돌아갔다."],
      closing: "CASE D-001 · 사건 해결",
      still: "방송실 책상 위에 토끼 가면만 놓여 있다.",
      next: null,
    });
    expect(progress(pass.state, ch).evidence).toEqual([...GIVEN, E4.report]);
  });
});

describe("제1장이 열어 둔 물음이 이 장에서 닫힌다", () => {
  it("예약한 사람, 생사는 이 장의 증거로 정해지고, 제1장의 남은 경우 안에 그 답이 들어 있다", () => {
    const ending1 = ch1.ending.open.map((q) => q.claim);
    expect(ending1).toEqual(["dead", "abroad", "manager"]);
    expect(candidates("r-register", ALL)).toEqual([SANGMIN]); // 이 영상을 예약한 사람은 누구인가
    expect(judge4("dead", ALL)).toBe("refuted"); // BJ 토끼는 살아 있는가
    expect(judge4("abroad", ALL)).toBe("open"); // 지금 어디에 있는가: 끝까지 밝히지 않는다
    const left1 = worlds1({ evidence: Object.values(E1), facts: [] });
    expect(left1.some((w) => w.alive && w.uploader === "manager" && w.mode === "scheduled")).toBe(true);
  });
});
