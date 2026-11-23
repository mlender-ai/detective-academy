import { describe, expect, it } from "vitest";
import { satisfiable } from "../../engine/evidence";
import type { EvidenceClaim } from "../../engine/types";
import { E2, ORIGINAL, RELEASED } from "../../story/cases/d001/logic2";
import {
  ACCESS,
  CARRIED3,
  CASE3,
  CLAIMS3,
  CONTEXT3,
  DOOR,
  E3,
  LOBBY,
  MOMENTS,
  OUTSIDER,
  PERMS,
  RESETS,
  STATEMENT_CLAIMS,
  SUSPECTS,
  WHERE,
  confrontAll,
  contradictions,
  judge3,
  judgeConfront3,
  judgeDeduction3,
  judgeRecord3,
  liars,
  modifyingSession,
  recordClaims,
  sessionsAround,
  suspectsLeft,
  worlds3,
  type CaseData3,
} from "../../story/cases/d001/logic3";
import { DOHEE, GAEUL, NAMED, SANGMIN, SEORIN, covers, type Named } from "../../story/cases/d001/people";
import { confront, goScene, pickRecord, sceneReachable, seeIntro, submitDeduction } from "../../story/engine/storyEngine";
import type { DeduceScene, RecordsScene, TestimonyScene } from "../../story/engine/storyTypes";
import { NOW, c, ch3, combos, correctDeductions, detective, playScene, playToDeduction, progress, submitCorrect, upTo } from "./d001-play";

/**
 * CASE D-001 제3장 「세 사람의 비밀」.
 * 세 사람 모두 사실과 다른 말을 한다. 거짓말을 했다는 것으로는 고친 사람이 정해지지 않고,
 * "그 접속 내내 편집실에 있었고, 임시 비밀번호를 받을 수 있었던 사람"이 기록으로 한 명 남는지를 전수 탐색으로 본다.
 */

const ch = ch3;
const [statements, sessions, deduction] = ch.scenes as [TestimonyScene, RecordsScene, DeduceScene];
const MINE = [E3.door, E3.access, E3.lobby, E3.perms, E3.lies];
const ALL = { evidence: [...CARRIED3, ...MINE, E3.confession] };
const patch = (change: Partial<CaseData3>): CaseData3 => ({ ...CASE3, ...change });
const start = () => upTo(ch);
const base = (...ids: string[]) => ({ evidence: [...CARRIED3, ...CONTEXT3, ...ids] });

/** 그날 실제로 있었던 곳 (맞대어 보는 다섯 시각: 15:30 · 16:30 · 17:40 · 18:20 · 19:15) */
const TRUTH: Record<Named, string[]> = {
  [SANGMIN]: ["office", "office", "edit", "edit", "office"],
  [GAEUL]: ["edit", "out", "out", "out", "edit"],
  [DOHEE]: ["out", "out", "edit", "out", "out"],
  [SEORIN]: ["out", "out", "out", "out", "out"],
};
const truthOf = (who: Named): EvidenceClaim => ({ kind: "all", of: TRUTH[who].map((place, time) => ({ kind: "at", who, place, time })) });
const peopleIn = (claim: EvidenceClaim): Named[] => (claim.kind === "all" ? [...new Set(claim.of.flatMap(peopleIn))] : "who" in claim ? [claim.who as Named] : []);
/** 그 주장이 실제로 있었던 일과 함께 성립하는가 (= 참인가) */
const holdsInTruth = (claim: EvidenceClaim) => satisfiable(WHERE, [...peopleIn(claim).map(truthOf), claim]);

describe("진술 대조: 누가 언제 어디에 있었나", () => {
  it("기록은 모두 실제로 있었던 일과 맞고, 진술 가운데 셋은 맞지 않는다", () => {
    expect(MOMENTS).toHaveLength(TRUTH[SANGMIN].length);
    for (const [id, claim] of Object.entries(recordClaims())) expect(holdsInTruth(claim), id).toBe(true);
    const truthful = Object.entries(STATEMENT_CLAIMS).filter(([, s]) => s.claim && holdsInTruth(s.claim)).map(([id]) => id);
    const lying = Object.entries(STATEMENT_CLAIMS).filter(([, s]) => s.claim && !holdsInTruth(s.claim)).map(([id]) => id);
    expect(truthful).toEqual(["sm2", "ge1", "dh1"]);
    expect(lying).toEqual(["sm1", "ge2", "dh2"]);
    // 추측(사실이 들어 있지 않은 말)은 참도 거짓도 아니다
    expect(STATEMENT_CLAIMS.sm3.claim).toBeNull();
  });

  it("진술 일곱 × 기록 여섯의 모든 짝에서, 거짓 진술은 저마다 기록 한 줄과만 어긋나고 참인 진술은 어느 기록과도 어긋나지 않는다", () => {
    const all = confrontAll();
    expect(all).toHaveLength(7 * 6);
    expect(contradictions().map((x) => `${x.statement}|${x.record}`)).toEqual(["sm1|door-sangmin", "ge2|door-gaeul", "dh2|lobby-dohee"]);
    expect(all.filter((x) => x.kind === "supports").map((x) => `${x.statement}|${x.record}`)).toEqual(["sm2|door-gaeul", "ge1|door-gaeul", "dh1|lobby-dohee"]);
    // 기록 한 줄씩 맞대는 것으로 충분하다: 그 사람에 대한 기록을 모두 합쳐도 결과가 같다
    for (const [id, statement] of Object.entries(STATEMENT_CLAIMS)) {
      if (!statement.claim) continue;
      const about = Object.values(recordClaims()).filter((claim) => peopleIn(claim).some((who) => peopleIn(statement.claim!).includes(who)));
      expect(satisfiable(WHERE, [...about, statement.claim]), id).toBe(!contradictions().some((x) => x.statement === id));
    }
    // 방문증 줄과 계정 기록은 누구의 위치도 정하지 않는다
    expect(all.filter((x) => x.record === "door-pass" || x.record === "access").every((x) => x.kind === "nothing")).toBe(true);
  });

  it("화면의 진술·기록이 판정의 이름표와 같고, 찾아야 하는 수가 판정으로 센 수와 같다", () => {
    expect(statements.statements.map((s) => s.id)).toEqual(Object.keys(STATEMENT_CLAIMS));
    expect(statements.records.map((r) => r.id)).toEqual(Object.keys(recordClaims()));
    for (const s of statements.statements) expect(s.speaker).toBe(STATEMENT_CLAIMS[s.id].speaker);
    expect(statements.goal).toBe(contradictions().length);
    // 어긋나는 진술에만 고쳐 하는 말이 있다
    const exposed = contradictions().map((x) => x.statement);
    expect(statements.statements.filter((s) => s.retort).map((s) => s.id)).toEqual(exposed);
    // 기록 줄의 글이 자료와 같다
    const line = (id: string) => statements.records.find((r) => r.id === id)!.value;
    expect(line("door-sangmin")).toBe("17:01 → 18:25");
    expect(line("door-gaeul")).toBe("09:05 → 16:00 / 19:08 → 19:30");
    expect(line("door-pass")).toBe("17:25 → 17:56");
    expect(line("door-seorin")).toBe("당일 기록 없음");
    expect(line("lobby-dohee")).toBe("15:00 → 15:12 / 17:23 → 17:58");
  });

  it("맞대는 것은 조사다: 어긋나면 진술이 깨지고, 받치면 알리바이가 확인되고, 아니면 까닭을 듣는다", () => {
    let state = seeIntro(start(), c, ch);
    expect(progress(state, ch).evidence).toEqual([E3.door, E3.access, E3.lobby]); // 도착해 있는 기록
    const meet = (s: string, r: string) => confront(state, c, ch, statements.id, s, r);

    const nothing = meet("dh2", "door-pass");
    expect(nothing.outcome).toMatchObject({ kind: "nothing", found: 0, goal: 3 });
    expect(nothing.outcome.text).toContain("누가 들고 있었는지는 이 기록에 없다");
    expect(nothing.state).toBe(state);
    expect(meet("sm3", "door-gaeul").outcome.text).toContain("추측");
    expect(meet("sm1", "access").outcome.text).toContain("계정 기록은");
    expect(meet("ge1", "door-sangmin").outcome.text).toBe("이 기록은 이 진술과 어긋나지도, 이 진술을 받치지도 않는다.");
    expect(meet("없는 진술", "access").state).toBe(state);

    const alibi = meet("ge1", "door-gaeul");
    expect(alibi.outcome).toMatchObject({ kind: "supports", retort: null, found: 0 });
    expect(alibi.outcome.text).toContain("진술과 맞는다");
    state = alibi.state;
    expect(progress(state, ch)).toMatchObject({ verified: ["ge1"], exposed: [], wrong: 0 });

    const first = meet("sm1", "door-sangmin");
    expect(first.outcome).toMatchObject({ kind: "contradiction", found: 1, goal: 3, granted: [] });
    expect(first.outcome.text).toContain("17:01~18:25");
    expect(first.outcome.retort).toContain("들어간 건 맞습니다");
    state = first.state;
    expect(meet("sm1", "door-sangmin").outcome.kind).toBe("known");
    expect(sceneReachable(progress(state, ch), ch, sessions.id)).toBe(false);
    state = meet("ge2", "door-gaeul").state;
    const last = meet("dh2", "lobby-dohee");
    expect(last.outcome).toMatchObject({ kind: "contradiction", found: 3, granted: [E3.lies] });
    state = last.state;
    expect(progress(state, ch).wrong).toBe(0);
    expect(sceneReachable(progress(state, ch), ch, sessions.id)).toBe(true);
    expect(judgeConfront3("dh2", "lobby-dohee").text).toContain("17:23~17:58");
  });
});

describe("거짓말한 사람이 고친 사람이라는 지름길은 서지 않는다", () => {
  it("세 사람 모두 한 번씩 거짓말을 했다: 거짓말을 했는지로도, 거짓말의 수로도 한 사람이 가려지지 않는다", () => {
    expect(liars()).toEqual([SANGMIN, GAEUL, DOHEE]);
    const count = (who: Named) => contradictions().filter((x) => STATEMENT_CLAIMS[x.statement].speaker === who).length;
    expect([SANGMIN, GAEUL, DOHEE].map((who) => count(who as Named))).toEqual([1, 1, 1]);
    // "거짓말한 사람 = 고친 사람"이라고 놓으면 후보가 셋이다
    expect(liars().length).toBeGreaterThanOrEqual(2);
  });

  it("거짓말을 했지만 고치지 않은 사람이 실제로 있다", () => {
    for (const who of [GAEUL, DOHEE]) {
      expect(liars()).toContain(who);
      expect(judge3(who, ALL), who).toBe("refuted");
    }
    // 진술 대조 기록(거짓말 셋)만 근거로는 한 사람이 남지 않는다
    expect(suspectsLeft(base(E3.lies)).length).toBeGreaterThan(1);
    expect(deduction.weak[E3.lies]).toContain("세 사람 모두");
    const lies = ch.evidence.find((e) => e.id === E3.lies)!;
    expect(lies.lines).toHaveLength(3);
    expect(lies.note).toContain("그것만으로는");
  });
});

describe("접속 가려내기", () => {
  it("방송에 나간 파일이 만들어진 시각을 품은 접속은 하나뿐이고, 그 접속은 임시 비밀번호로 들어왔다", () => {
    expect(sessionsAround(RELEASED.createdAt).map((s) => s.id)).toEqual(["2"]);
    expect(modifyingSession()).toMatchObject({ id: "2", password: "temp" });
    expect(sessions.records!.map((r) => r.id)).toEqual(ACCESS.map((s) => s.id));
    expect(sessions.records!.filter((r) => judgeRecord3(r.id).correct).map((r) => r.id)).toEqual(["2"]);
    expect(judgeRecord3("1").reason).toContain("13:45에 끝났습니다");
    expect(judgeRecord3("3").reason).toContain("19:10에 시작했습니다");
    expect(judgeRecord3("9").correct).toBe(false);
    // 틀린 접속의 까닭은 맞는 접속과 비밀번호의 종류를 말하지 않는다
    for (const id of ["1", "3"]) expect(judgeRecord3(id).reason).not.toMatch(/접속 2|임시/);
    // 고르기 전에 보이는 줄에는 그 접속에서 한 일이 적혀 있지 않다
    expect(JSON.stringify(sessions.records)).not.toMatch(/수정|내보내기|열람/);
  });

  it("앞 장의 기록과 맞물린다: 원본은 첫 접속에서, 공개본은 재설정 뒤의 접속에서 만들어졌다", () => {
    expect(sessionsAround(ORIGINAL.createdAt).map((s) => s.id)).toEqual(["1"]);
    const admin = RESETS.find((r) => r.by === "admin")!;
    const owner = RESETS.find((r) => r.by === "owner")!;
    const [, second, third] = ACCESS;
    expect(admin.at < second.from && second.from < RELEASED.createdAt && RELEASED.createdAt < second.to).toBe(true);
    expect(ORIGINAL.trashedAt! > second.to).toBe(true);
    expect(owner.at < third.from).toBe(true);
    // 재설정한 사람은 그때 편집실에 있었고(지문 17:01), 본인 인증으로 다시 정한 사람은 그 뒤에 편집실에 들어왔다(지문 19:08)
    const door = (who: Named) => DOOR.find((line) => line.who === who)!.spans;
    expect(covers(door(SANGMIN), admin.at, second.to)).toBe(true);
    expect(covers(door(GAEUL), third.from, third.to)).toBe(true);
    // 제2장 끝의 계정 알림이 이 기록과 같은 시각을 적는다
    const notice = c.chapters[1].evidence.find((e) => e.id === E2.notice)!;
    expect(notice.lines.map((l) => l.label)).toEqual([admin.at, second.from]);
  });

  it("틀린 접속은 까닭을 듣고 다시 고르고, 맞히면 작업 권한표를 얻는다", () => {
    let state = playScene(seeIntro(start(), c, ch), ch, statements);
    state = goScene(state, c, ch, sessions.id);
    const wrong = pickRecord(state, c, ch, sessions.id, "1");
    expect(wrong.outcome).toMatchObject({ correct: false, granted: [] });
    state = wrong.state;
    expect(progress(state, ch).wrong).toBe(1);
    const right = pickRecord(state, c, ch, sessions.id, "2");
    expect(right.outcome).toMatchObject({ correct: true, granted: [E3.perms] });
    expect(right.outcome.reason).toContain("임시 비밀번호");
    expect(sceneReachable(progress(right.state, ch), ch, deduction.id)).toBe(true);
  });
});

describe("고친 사람: 확정되는 결론은 하나뿐이다", () => {
  it("용의자 다섯 가운데 가진 증거 전부로 남는 사람은 오상민 하나다", () => {
    expect(deduction.choices.map((x) => x.id).sort()).toEqual([...SUSPECTS].sort());
    const verdicts = Object.fromEntries(SUSPECTS.map((who) => [who, judge3(who, ALL)]));
    expect(verdicts).toEqual({ [SANGMIN]: "established", [GAEUL]: "refuted", [DOHEE]: "refuted", [SEORIN]: "refuted", [OUTSIDER]: "refuted" });
    // 이 장에 들어설 때(앞 장의 증거만 가졌을 때)는 다섯 모두 열려 있다
    expect(suspectsLeft({ evidence: [...CARRIED3] })).toEqual([...SUSPECTS]);
    expect(worlds3({ evidence: [] })).toHaveLength(20480);
    expect(worlds3(ALL)).toHaveLength(4); // 윤서린의 생사와 행방만 남는다
    expect(Object.keys(CLAIMS3).sort()).toEqual([...SUSPECTS, "dead", "abroad"].sort());
  });

  it("접근 기록과 출입 기록만으로는 둘이 남는다. 권한표가 있어야 한 사람이 된다", () => {
    expect(suspectsLeft(base())).toEqual([SANGMIN, GAEUL, DOHEE, SEORIN]); // 계정 접근 기록만: 관리자가 누구인지 모른다
    expect(suspectsLeft(base(E3.door))).toEqual([SANGMIN, DOHEE]); // 그 접속 내내 편집실에 있던 두 사람
    expect(suspectsLeft(base(E3.door, E3.lobby))).toEqual([SANGMIN, DOHEE]); // 방문증의 주인을 알아도 그대로다
    expect(suspectsLeft(base(E3.perms))).toEqual([SANGMIN, SEORIN]); // 임시 비밀번호를 받을 수 있는 두 사람
    expect(suspectsLeft(base(E3.door, E3.perms))).toEqual([SANGMIN]);
  });

  it("꼭 필요한 증거 셋 가운데 하나를 빼면 확정되지 않는다", () => {
    const without = (id: string) => ({ evidence: ALL.evidence.filter((x) => x !== id) });
    expect(suspectsLeft(without(E3.door))).toEqual([SANGMIN, SEORIN]);
    expect(suspectsLeft(without(E3.perms))).toEqual([SANGMIN, DOHEE]);
    expect(suspectsLeft(without(E3.access))).toEqual([SANGMIN, DOHEE]);
    for (const id of [E3.door, E3.perms, E3.access]) expect(judge3(SANGMIN, without(id)), id).toBe("open");
    // 제2장의 작업 기록(편집실 PC 에서 고쳤다)이 없으면 출입 기록이 아무것도 좁히지 못한다
    expect(suspectsLeft(without(E2.editlog))).toEqual([SANGMIN, SEORIN]);
  });

  it("증거마다 맡은 일이 있다 (쓰이지 않는 증거가 없다)", () => {
    const used = new Set(contradictions().map((x) => statements.records.find((r) => r.id === x.record)!.evidence));
    expect([...used].sort()).toEqual([E3.door, E3.lobby]); // 거짓말을 깨는 기록
    expect(CONTEXT3).toEqual([E3.access]); // 문제의 접속이 적힌 기록
    expect(sessions.grants).toEqual([E3.perms]); // 접속을 가려내야 얻는 기록: 최종 추론의 근거
    expect(statements.grants).toEqual([E3.lies]); // 대조를 끝내야 얻는 기록: 최종 추론에서는 약한 근거
    expect(ch.given).toEqual([E3.door, E3.access, E3.lobby]);
    expect(ch.evidence.map((e) => e.id)).toEqual([...MINE, E3.confession]);
  });

  it("잘못된 가설마다 걸려 넘어지는 증거가 있다", () => {
    // 한가을, 윤서린: 출입 기록(그 접속 동안 편집실에 없었다)
    for (const who of [GAEUL, SEORIN]) {
      expect(judge3(who, base(E3.door)), who).toBe("refuted");
      expect(judge3(who, base(E3.lobby, E3.lies)), who).toBe("open");
    }
    // 강도희: 권한표(관리자가 아니다). 출입 기록으로는 지워지지 않는다(그 방에 있었다)
    expect(judge3(DOHEE, base(E3.perms))).toBe("refuted");
    expect(judge3(DOHEE, base(E3.door, E3.lobby, E3.lies))).toBe("open");
    // 기록에 없는 사람: 임시 비밀번호는 관리자만 본다(계정 접근 기록)
    expect(judge3(OUTSIDER, base())).toBe("refuted");
    expect(judge3(OUTSIDER, { evidence: [...CARRIED3, E3.door] })).toBe("open");
    expect(judge3(OUTSIDER, { evidence: [...CARRIED3, E3.door, E3.lobby] })).toBe("refuted");
    for (const choice of deduction.choices) expect(choice.unsupported.length).toBeGreaterThan(10);
  });

  it("실제로 있었던 일은 어떤 증거를 가졌든 지워지지 않고, 증거가 늘면 남는 경우는 줄기만 한다", () => {
    const session = modifyingSession();
    const isTruth = (w: ReturnType<typeof worlds3>[number]) =>
      w.modifier === SANGMIN && w.pass === DOHEE && w.alive && !w.abroad && w.inRoom[SANGMIN] && w.inRoom[DOHEE] && !w.inRoom[GAEUL] && !w.inRoom[SEORIN] && !w.inRoom[OUTSIDER] && NAMED.every((who) => w.admin[who] === PERMS[who].admin);
    expect(covers(LOBBY[0].spans, session.from, session.to)).toBe(true);
    for (const size of [0, 1, 2, 3, 4, 5])
      for (const some of combos(MINE, size)) {
        const left = worlds3({ evidence: [...CARRIED3, ...some] });
        expect(left.some(isTruth), some.join("+")).toBe(true);
        for (const more of MINE.filter((id) => !some.includes(id))) expect(worlds3({ evidence: [...CARRIED3, ...some, more] }).length).toBeLessThanOrEqual(left.length);
      }
  });

  it("자료가 달랐다면 결론도 달라진다(정답이 자료에서 나온다)", () => {
    const door = (who: Named | null, spans: { from: string; to: string }[]) => DOOR.map((line) => (line.who === who ? { ...line, spans } : line));
    // 윤서린의 지문이 그 접속 내내 찍혀 있었다면: 관리자 둘이 다 그 방에 있었다
    expect(suspectsLeft(ALL, patch({ door: door(SEORIN, [{ from: "17:00", to: "18:00" }]) }))).toEqual([SANGMIN, SEORIN]);
    // 강도희에게 관리자 권한이 있었다면
    expect(suspectsLeft(ALL, patch({ perms: { ...PERMS, [DOHEE]: { admin: true, text: "관리자" } } }))).toEqual([SANGMIN, DOHEE]);
    // 오상민이 그 접속 도중에 들어왔다면: 남는 사람이 없다(자료가 서로 맞지 않는다)
    expect(suspectsLeft(ALL, patch({ door: door(SANGMIN, [{ from: "17:40", to: "18:25" }]) }))).toEqual([]);
    // 방문증이 그 접속 도중에 나갔다면: 출입 기록만으로 한 사람이 된다(지금의 자료는 그렇지 않다)
    expect(suspectsLeft(base(E3.door), patch({ door: door(null, [{ from: "17:25", to: "17:40" }]) }))).toEqual([SANGMIN]);
    // 그 접속이 기존 비밀번호로 들어왔다면: 권한표가 아무것도 좁히지 못한다
    const old = patch({ access: ACCESS.map((s) => (s.id === "2" ? { ...s, password: "old" as const } : s)) });
    expect(suspectsLeft(ALL, old)).toEqual([SANGMIN, DOHEE]);
  });
});

describe("최종 추론: 결론과 근거 둘", () => {
  const have = { evidence: MINE, facts: [] };

  it("출입 기록과 작업 권한표를 함께 내야 선다. 하나만으로는, 또는 거짓말을 근거로는 서지 않는다", () => {
    expect(deduction.need).toBe(2);
    expect(deduction.basis).toEqual([E3.door, E3.lobby, E3.perms, E3.lies]);
    expect(correctDeductions(ch, have)).toEqual([{ choice: SANGMIN, bases: [E3.door, E3.perms] }]);
    for (const pair of combos(deduction.basis, 2)) {
      const verdict = judgeDeduction3(SANGMIN, pair, have);
      expect(verdict, pair.join("+")).toBe(pair.includes(E3.door) && pair.includes(E3.perms) ? "correct" : "weak");
      if (verdict === "weak") expect(pair.some((id) => deduction.weak[id])).toBe(true);
    }
    for (const who of SUSPECTS.filter((x) => x !== SANGMIN)) for (const pair of combos(deduction.basis, 2)) expect(judgeDeduction3(who, pair, have)).toBe("unsupported");
    // 권한표를 아직 얻지 못했으면 어떤 근거로도 확정되지 않는다
    expect(judgeDeduction3(SANGMIN, [E3.door, E3.lobby], { evidence: [E3.door, E3.access, E3.lobby, E3.lies] })).toBe("unsupported");
  });

  it("틀린 결론과 약한 근거는 장을 열지 않고, 맞히면 보상과 오상민의 두 번째 진술을 얻는다", () => {
    let state = playToDeduction(start(), ch);
    const before = state.credits;
    const blame = submitDeduction(state, c, ch, deduction.id, GAEUL, [E3.door, E3.perms], NOW);
    expect(blame.outcome.verdict).toBe("unsupported");
    expect(blame.outcome.text).toContain("지문");
    state = blame.state;
    const lies = submitDeduction(state, c, ch, deduction.id, SANGMIN, [E3.lies, E3.perms], NOW);
    expect(lies.outcome).toMatchObject({ verdict: "weak", text: deduction.weak[E3.lies] });
    state = lies.state;
    expect(progress(state, ch)).toMatchObject({ status: "in_progress", wrong: 2 });

    const pass = submitCorrect(state, ch);
    expect(pass.outcome).toEqual({ verdict: "correct", text: "", reward: 120 });
    state = pass.state;
    expect(state.credits).toBe(before + 120);
    expect(progress(state, ch).evidence).toEqual([E3.door, E3.access, E3.lobby, E3.lies, E3.perms, E3.confession]);
  });
});

describe("이 장이 열어 두는 것", () => {
  it("오상민의 두 번째 진술까지 가져도 윤서린의 생사와 행방은 정해지지 않는다", () => {
    expect(ch.ending.open.map((q) => q.claim)).toEqual(["dead", "abroad"]);
    for (const q of ch.ending.open) expect(judge3(q.claim, ALL), q.text).toBe("open");
    expect(ch.ending.lines).toEqual(["방송을 바꾼 사람은 찾았다.", "그렇다면 윤서린은 지금 어디에 있는가?"]);
    expect(ch.ending.next).toEqual({ no: 4, title: "토끼의 정체" });
    const confession = ch.evidence.find((e) => e.id === E3.confession)!;
    expect(confession.note).toContain("진술이다");
    // 진술은 경우를 지우지 않는다: 그 카드를 가져도 남는 경우가 같다
    expect(worlds3(ALL)).toEqual(worlds3({ evidence: [...CARRIED3, ...MINE] }));
    // 이 장의 글은 윤서린이 무사하다고 말하지 않는다(그것은 다음 장의 증거로 확정된다)
    expect(JSON.stringify(ch)).not.toMatch(/무사|경찰|살아 있고/);
    expect(detective().rank).toBe("D");
  });
});
