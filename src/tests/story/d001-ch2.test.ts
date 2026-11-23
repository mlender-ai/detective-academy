import { describe, expect, it } from "vitest";
import { orderSatisfies, permutations } from "../../engine/puzzleValidator";
import { BROADCAST, E as E1, SOURCE_FILE } from "../../story/cases/d001/logic";
import {
  CARRIED2,
  CASE2,
  CLAIMS2,
  E2,
  EDIT_OPS,
  NO_CAPTION,
  ORIGINAL,
  RELEASED,
  captionAt,
  compareValues,
  differences,
  judge2,
  judgeDeduction2,
  judgeOrder,
  orderRules,
  relationOf,
  subtitlesAt,
  validOrders,
  worlds2,
  type CaseData2,
  type EditOp,
} from "../../story/cases/d001/logic2";
import { GAEUL, SANGMIN, toMinutes } from "../../story/cases/d001/people";
import { arrangeOrder, differencesOf, goScene, markDifference, orderOf, sceneReachable, seeIntro, submitDeduction, submitOrder } from "../../story/engine/storyEngine";
import type { CompareScene, DeduceScene, OrderScene } from "../../story/engine/storyTypes";
import { NOW, c, ch1, ch2, clearChapter, combos, correctDeductions, playScene, playToDeduction, progress, submitCorrect, upTo } from "./d001-play";

/**
 * CASE D-001 제2장 「사라진 원본」.
 * 공개된 방송이 원래 영상과 같은지를 "두 영상의 비교"와 "작업 기록의 순서"로 가린다.
 * 정답을 글자로 비교하지 않는다: 달라진 곳은 두 영상의 값으로, 순서는 꼬리표의 규칙으로, 결론은 가능한 경우의 전수 탐색으로 판정한다.
 */

const ch = ch2;
const [compare, editlog, deduction] = ch.scenes as [CompareScene, OrderScene, DeduceScene];
const MINE = [E2.original, E2.released, E2.subtitles, E2.editlog];
const ALL = { evidence: [...CARRIED2, ...MINE, E2.notice] };
const patch = (change: Partial<CaseData2>): CaseData2 => ({ ...CASE2, ...change });
const start = () => upTo(ch);

describe("두 영상의 비교", () => {
  it("달라진 곳은 값으로 정해진다: 파일 생성 시각, 제목 자막, 바뀐 자막, 사라진 자막 넷", () => {
    const found = differences().map((d) => `${d.frame}.${d.field}`);
    expect(found).toEqual(["file.created", "c0015.title", "c0130.caption", "c0500.caption"]);
    // 화면의 장면이 그 값을 그대로 쓴다
    const shown = compare.frames.flatMap((frame) => frame.fields.map((field) => ({ frame: frame.id, field: field.id, a: field.a, b: field.b })));
    expect(shown).toEqual(compareValues());
    expect(differencesOf(compare).map((d) => d.key)).toEqual(found);
  });

  it("자막은 변경 이력에서 나온다: r1 의 두 줄이 r2 에서 한 줄 바뀌고 r3 에서 한 줄 사라진다", () => {
    expect(subtitlesAt(1).map((line) => line.no)).toEqual([1, 2]);
    expect(subtitlesAt(2)[0].text).not.toBe(subtitlesAt(1)[0].text);
    expect(subtitlesAt(2)[1]).toEqual(subtitlesAt(1)[1]);
    expect(subtitlesAt(3).map((line) => line.no)).toEqual([1]);
    expect(captionAt(ORIGINAL.subRev, 300)).toContain("일상으로 돌아갑니다");
    expect(captionAt(RELEASED.subRev, 300)).toBeNull();
    expect(captionAt(RELEASED.subRev, 190)).toBeNull(); // 제1장에서 본 03:10 에는 자막이 없다
    const at0500 = compare.frames.find((f) => f.id === "c0500")!.fields.find((f) => f.id === "caption")!;
    expect(at0500.b).toBe(NO_CAPTION);
  });

  it("제1장에서 본 시점(00:15 · 03:10 · 06:40)의 화면에는 새 자막이 없다: 제1장의 방송 화면과 어긋나지 않는다", () => {
    for (const frame of ch1.scenes[0].kind === "timeline" ? ch1.scenes[0].frames : []) {
      expect(captionAt(RELEASED.subRev, frame.at), frame.id).toBeNull();
    }
    // 방송에 나간 영상은 제1장의 그 파일이고, 제목도 제1장의 방송 제목이다
    expect(RELEASED).toMatchObject({ name: SOURCE_FILE.name, lengthSec: SOURCE_FILE.lengthSec });
    expect(RELEASED.title.text).toBe(BROADCAST.title);
  });

  it("칸마다 글이 있다: 달라진 곳에는 찾았을 때의 글과 노트, 같은 곳에는 같다는 글", () => {
    for (const frame of compare.frames)
      for (const field of frame.fields) {
        expect(field.label.length, `${frame.id}.${field.id}`).toBeGreaterThan(0);
        if (field.a !== field.b) {
          expect(field.found.length).toBeGreaterThan(10);
          expect(field.note.length).toBeGreaterThan(10);
        } else expect(field.same.length).toBeGreaterThan(8);
      }
    // 그림은 제1장의 방송실 그림을 다시 쓴다
    const stills = compare.frames.filter((f) => f.at !== null).map((f) => f.still);
    expect(stills.every((s) => ["t0015", "t0310", "t0640", "t0700"].includes(s!))).toBe(true);
  });

  it("같은 곳을 달라졌다고 짚으면 틀린 것이고, 넷을 모두 찾아야 증거를 얻는다", () => {
    let state = seeIntro(start(), c, ch);
    expect(progress(state, ch).scene).toBe(compare.id);
    const same = markDifference(state, c, ch, compare.id, "c0310", "caption");
    expect(same.outcome).toMatchObject({ kind: "same", found: 0, total: 4, granted: [] });
    state = same.state;
    expect(progress(state, ch).wrong).toBe(1);
    expect(markDifference(state, c, ch, compare.id, "없는 시점", "caption").state).toBe(state);

    const all = differencesOf(compare);
    for (const d of all.slice(0, 3)) {
      const result = markDifference(state, c, ch, compare.id, d.frame, d.field.id);
      expect(result.outcome).toMatchObject({ kind: "found", granted: [] });
      state = result.state;
    }
    expect(sceneReachable(progress(state, ch), ch, editlog.id)).toBe(false);
    expect(markDifference(state, c, ch, compare.id, all[0].frame, all[0].field.id).outcome.kind).toBe("known");
    const last = markDifference(state, c, ch, compare.id, all[3].frame, all[3].field.id);
    expect(last.outcome).toMatchObject({ kind: "found", found: 4, total: 4, granted: [E2.original, E2.released, E2.subtitles] });
    state = last.state;
    expect(sceneReachable(progress(state, ch), ch, editlog.id)).toBe(true);
    // 끝낸 뒤에 같은 곳을 다시 짚어도 틀린 횟수는 늘지 않는다
    expect(markDifference(state, c, ch, compare.id, "c0310", "caption").state).toBe(state);
  });
});

describe("작업 기록의 순서", () => {
  const ids = EDIT_OPS.map((op) => op.id);

  /** 꼬리표를 처음부터 따라가 보는 독립 검증: 자막 판이 맞는가, 시각이 거꾸로 가지 않는가 */
  function replays(order: readonly string[], ops: readonly EditOp[] = EDIT_OPS): boolean {
    let rev = 1;
    let clock = -1;
    for (const id of order) {
      const op = ops.find((x) => x.id === id)!;
      if (op.sees !== undefined && op.sees !== rev) return false;
      if (op.makes !== undefined) {
        if (op.makes !== rev + 1) return false;
        rev = op.makes;
      }
      if (op.at) {
        if (toMinutes(op.at) < clock) return false;
        clock = toMinutes(op.at);
      }
    }
    return true;
  }

  it("여섯 줄의 모든 순서 720 가지 가운데 꼬리표와 어긋나지 않는 것은 하나뿐이다", () => {
    const all = permutations(ids);
    expect(all).toHaveLength(720);
    const valid = validOrders();
    expect(valid).toHaveLength(1);
    expect(all.filter((order) => judgeOrder(order).correct)).toEqual(valid);
    // 끌어낸 조건(순서 추론의 검증기)과, 꼬리표를 처음부터 따라가 보는 검증이 720 가지 모두에서 같은 답을 낸다
    const rules = orderRules();
    for (const order of all) expect(orderSatisfies(rules, order), order.join(">")).toBe(replays(order));
    // 화면에 처음 놓이는 순서는 답이 아니다
    expect(editlog.cards.map((card) => card.id)).not.toEqual(valid[0]);
    expect(judgeOrder(editlog.cards.map((card) => card.id)).correct).toBe(false);
  });

  it("꼬리표 하나를 지우면 순서가 여럿이 된다 (군더더기 꼬리표가 없다)", () => {
    const without = (id: string, key: "sees" | "makes" | "at") => EDIT_OPS.map((op) => (op.id === id ? { ...op, [key]: undefined } : op));
    const tags = EDIT_OPS.flatMap((op) => (["sees", "makes", "at"] as const).filter((key) => op[key] !== undefined).map((key) => [op.id, key] as const));
    expect(tags).toHaveLength(8);
    const redundant = tags.filter(([id, key]) => validOrders(without(id, key)).length === 1).map(([id, key]) => `${id}.${key}`);
    // 원본 파일의 생성 시각만은 순서를 정하는 데 쓰이지 않는다(자막 판 r1 이 이미 맨 앞에 놓는다).
    // 이 시각은 비교 장면의 "달라진 곳"이고, 어느 쪽이 먼저 만든 원본인지를 말해 준다.
    expect(redundant).toEqual(["op-export1.at"]);
    expect(differences().some((d) => d.field === "created")).toBe(true);
  });

  it("카드의 꼬리표가 자료와 같고, 틀린 순서는 어긋나는 까닭 하나를 듣는다(답은 듣지 않는다)", () => {
    const tag = (id: string) => editlog.cards.find((card) => card.id === id)!.tags;
    expect(tag("op-export1")).toEqual(["자막 판 r1", `파일 생성 ${ORIGINAL.createdAt}`]);
    expect(tag("op-export2")).toEqual(["자막 판 r3", `파일 생성 ${RELEASED.createdAt}`]);
    expect(tag("op-sub1")).toEqual(["r1 → r2"]);
    expect(tag("op-title")).toEqual(["자막 판 r2"]);
    expect(tag("op-trash")).toEqual([`휴지통 ${ORIGINAL.trashedAt}`]);
    const wrong = judgeOrder(editlog.cards.map((card) => card.id));
    expect(wrong.reason.length).toBeGreaterThan(20);
    for (const order of permutations(ids).filter((o) => !judgeOrder(o).correct).slice(0, 60)) {
      // 까닭 하나는 두 줄의 앞뒤만 말한다: 줄 이름이 셋 이상 나오지 않는다
      expect((judgeOrder(order).reason.match(/「/g) ?? []).length).toBeLessThanOrEqual(2);
    }
  });

  it("놓아 둔 순서는 남고, 틀린 순서는 다시 놓고, 맞히면 수정 작업 기록을 얻는다", () => {
    let state = playScene(seeIntro(start(), c, ch), ch, compare);
    state = goScene(state, c, ch, editlog.id);
    expect(orderOf(progress(state, ch), editlog)).toEqual(editlog.cards.map((card) => card.id));
    const moved = [...ids].reverse();
    state = arrangeOrder(state, c, ch, editlog.id, moved);
    expect(orderOf(progress(state, ch), editlog)).toEqual(moved);
    expect(arrangeOrder(state, c, ch, editlog.id, ["op-title"])).toBe(state); // 카드가 모자란 순서는 받지 않는다
    expect(submitOrder(state, c, ch, editlog.id, ["op-title", "op-title"]).outcome).toMatchObject({ correct: false, granted: [] });

    const wrong = submitOrder(state, c, ch, editlog.id, moved);
    expect(wrong.outcome.correct).toBe(false);
    state = wrong.state;
    expect(progress(state, ch).wrong).toBe(1);
    expect(sceneReachable(progress(state, ch), ch, deduction.id)).toBe(false);

    const right = submitOrder(state, c, ch, editlog.id, validOrders()[0]);
    expect(right.outcome).toMatchObject({ correct: true, granted: [E2.editlog] });
    state = right.state;
    expect(sceneReachable(progress(state, ch), ch, deduction.id)).toBe(true);
    // 맞힌 뒤에는 순서를 바꿔 놓을 수 없고, 다시 내도 기록이 바뀌지 않는다
    expect(arrangeOrder(state, c, ch, editlog.id, moved)).toBe(state);
    expect(submitOrder(state, c, ch, editlog.id, moved).state).toBe(state);
  });
});

describe("확정되는 결론은 하나뿐이다", () => {
  it("가진 증거 전부로 확정되는 것은 '은퇴 영상이 방송 전에 글자만 바뀌었다' 하나다", () => {
    expect(Object.keys(CLAIMS2).sort()).toEqual([...deduction.choices.map((x) => x.id), "dead"].sort());
    const verdicts = Object.fromEntries(deduction.choices.map((x) => [x.id, judge2(x.id, ALL)]));
    expect(verdicts).toEqual({ same: "refuted", reshot: "refuted", altered: "established", afterAir: "refuted", gaeul: "open" });
    // 이 장에 들어설 때(제1장의 증거만 가졌을 때)는 아무것도 확정되지 않는다
    for (const choice of deduction.choices) expect(judge2(choice.id, { evidence: [...CARRIED2] }), choice.id).toBe("open");
  });

  it("실제로 있었던 일은 어떤 증거를 가졌든 지워지지 않고, 증거가 늘면 남는 경우는 줄기만 한다", () => {
    const truth = { original: "retire", relation: "text", when: "before", editor: SANGMIN, alive: true };
    for (const size of [0, 1, 2, 3, 4, 5])
      for (const some of combos([...MINE, E2.notice], size)) {
        const left = worlds2({ evidence: [...CARRIED2, ...some] });
        expect(left, some.join("+")).toContainEqual(truth);
        for (const more of [...MINE, E2.notice].filter((id) => !some.includes(id))) {
          expect(worlds2({ evidence: [...CARRIED2, ...some, more] }).length).toBeLessThanOrEqual(left.length);
        }
      }
    expect(worlds2({ evidence: [] })).toHaveLength(84);
    expect(worlds2(ALL)).toHaveLength(10); // 고친 사람 다섯 × 생사 둘이 남는다
  });

  it("잘못된 가설마다 걸려 넘어지는 증거가 있다", () => {
    const only = (...ids: string[]) => ({ evidence: [...CARRIED2, ...ids] });
    // '그대로다': 원본의 제목이 방송 제목과 다르다
    expect(judge2("same", only(E2.original))).toBe("refuted");
    expect(judge2("same", only(E2.released, E2.subtitles, E2.editlog))).toBe("open");
    // '다시 찍었다': 두 파일을 함께 놓아야 화면이 같다는 것을 안다
    expect(judge2("reshot", only(E2.original, E2.released))).toBe("refuted");
    expect(judge2("reshot", only(E2.original))).toBe("open");
    // '방송 뒤에 고쳤다': 공개본의 생성 시각이 예약 등록보다 이르다
    expect(judge2("afterAir", only(E2.released))).toBe("refuted");
    expect(judge2("afterAir", only(E2.original, E2.subtitles, E2.editlog))).toBe("open");
    // 제1장의 예약 등록 시각이 없으면 그 가설은 지워지지 않는다(앞 장의 증거를 실제로 쓴다)
    expect(judge2("afterAir", { evidence: [E1.broadcast, E2.original, E2.released] })).toBe("open");
    // '편집자가 고쳤다': 작업 기록의 계정이 편집자 것이어도 끝까지 열려 있다
    expect(judge2("gaeul", ALL)).toBe("open");
    expect(new Set(worlds2(ALL).map((w) => w.editor)).size).toBe(5);
    expect(worlds2(ALL).some((w) => w.editor === GAEUL)).toBe(true);
  });

  it("자료가 달랐다면 결론도 달라진다(정답이 자료에서 나온다)", () => {
    // 원본도 같은 제목이었다면: 바뀐 것은 자막뿐이고 '은퇴 영상이었다'는 확정되지 않는다
    const deathFirst = patch({ original: { ...ORIGINAL, title: RELEASED.title } });
    expect(judge2("altered", ALL, deathFirst)).toBe("refuted");
    // 두 파일이 완전히 같았다면: '그대로다'가 확정된다
    const identical = patch({ original: { ...RELEASED } });
    expect(relationOf(identical.original, identical.released)).toBe("same");
    expect(judge2("same", ALL, identical)).toBe("established");
    // 촬영본이 달랐다면: '다시 찍었다'
    const reshot = patch({ released: { ...RELEASED, footage: "shoot-1121" } });
    expect(judge2("reshot", ALL, reshot)).toBe("established");
    expect(judge2("altered", ALL, reshot)).toBe("refuted");
    // 공개본이 예약 등록보다 늦게 만들어졌다면: '방송 전에 바뀌었다'가 서지 않는다
    const late = patch({ released: { ...RELEASED, createdAt: "23:58" } });
    expect(judge2("altered", ALL, late)).toBe("refuted");
    expect(judge2("afterAir", ALL, late)).toBe("established");
  });
});

describe("최종 추론: 결론과 근거 둘", () => {
  const have = { evidence: MINE, facts: [] };

  it("'바뀌었다'는 바뀌기 전과 뒤, 두 파일을 함께 내야 선다", () => {
    expect(deduction.need).toBe(2);
    expect(deduction.basis).toEqual(MINE);
    expect(correctDeductions(ch, have)).toEqual([{ choice: "altered", bases: [E2.original, E2.released] }]);
    for (const pair of combos(MINE, 2)) {
      const verdict = judgeDeduction2("altered", pair, have);
      expect(verdict, pair.join("+")).toBe(pair.includes(E2.original) && pair.includes(E2.released) ? "correct" : "weak");
      // 약한 근거에는 그 증거가 왜 모자란지의 글이 있다
      if (verdict === "weak") expect(pair.some((id) => deduction.weak[id])).toBe(true);
    }
    // 두 파일 가운데 하나를 빼면 확정되지 않는다
    expect(judge2("altered", { evidence: [...CARRIED2, E2.original, E2.subtitles, E2.editlog] })).toBe("open");
    expect(judge2("altered", { evidence: [...CARRIED2, E2.released, E2.subtitles, E2.editlog] })).toBe("open");
  });

  it("다른 결론은 어떤 근거를 대도 통과하지 못하고, 갖지 않은 증거는 근거가 되지 못한다", () => {
    for (const choice of deduction.choices.filter((x) => x.id !== "altered"))
      for (const pair of combos(MINE, 2)) expect(judgeDeduction2(choice.id, pair, have), `${choice.id}/${pair}`).toBe("unsupported");
    expect(judgeDeduction2("없는 결론", [E2.original, E2.released], have)).toBe("unsupported");
    expect(judgeDeduction2("altered", [E2.original, E2.released], { evidence: [E2.original] })).toBe("unsupported");
    for (const choice of deduction.choices) {
      expect(choice.unsupported.length).toBeGreaterThan(10);
      if (choice.id !== "altered") expect(choice.unsupported).not.toMatch(/은퇴를 알리/);
    }
  });

  it("근거를 하나만 내거나 같은 것을 두 번 내면 받지 않는다. 틀린 결론은 장을 열지 않는다", () => {
    let state = playToDeduction(start(), ch);
    const before = state.credits;
    const submit = (choice: string | null, basis: string | string[] | null) => submitDeduction(state, c, ch, deduction.id, choice, basis, NOW);
    expect(submit("altered", E2.original).outcome).toMatchObject({ verdict: "incomplete" });
    expect(submit("altered", [E2.original, E2.original]).outcome.verdict).toBe("incomplete");
    expect(submit("altered", [E2.original, E1.file]).outcome.verdict).toBe("incomplete");
    expect(submit(null, [E2.original, E2.released]).outcome.text).toContain("증거 둘");
    expect(submit("altered", null).state).toBe(state);

    const weak = submit("altered", [E2.original, E2.editlog]);
    expect(weak.outcome).toMatchObject({ verdict: "weak", text: deduction.weak[E2.editlog], reward: 0 });
    state = weak.state;
    const accuse = submit(GAEUL, [E2.editlog, E2.subtitles]);
    expect(accuse.outcome.verdict).toBe("unsupported");
    expect(accuse.outcome.text).toContain("계정");
    state = accuse.state;
    expect(progress(state, ch)).toMatchObject({ status: "in_progress", wrong: 2 });
    expect(state.credits).toBe(before);

    const pass = submitCorrect(state, ch);
    expect(pass.outcome).toEqual({ verdict: "correct", text: "", reward: 120 });
    state = pass.state;
    expect(state.credits).toBe(before + 120);
    expect(progress(state, ch)).toMatchObject({ status: "cleared", scene: "ending", deduction: { choice: "altered", basis: E2.original, bases: [E2.original, E2.released] } });
    expect(progress(state, ch).evidence).toEqual([...MINE, E2.notice]);
  });
});

describe("이 장이 열어 두는 것", () => {
  it("끝 장면의 계정 알림까지 가져도 '누가 고쳤는가'와 생사는 정해지지 않는다", () => {
    expect(ch.ending.open.map((q) => q.claim)).toEqual(["gaeul", "dead"]);
    for (const q of ch.ending.open) expect(judge2(q.claim, ALL), q.text).toBe("open");
    expect(ch.ending.lines).toEqual(["영상은 누군가에 의해 수정됐다.", "그런데 편집 기록을 남긴 계정의 소유자가 범인이라는 보장은 없다."]);
    expect(ch.ending.next).toEqual({ no: 3, title: "세 사람의 비밀" });
    const notice = ch.evidence.find((e) => e.id === E2.notice)!;
    expect(notice.note).toContain("아직 모른다");
    // 이 장의 글은 고친 사람을 지목하지 않고, 뒤 장에서야 나오는 이름을 쓰지 않는다
    expect(JSON.stringify(ch)).not.toMatch(/오상민|강도희|윤서린|매니저/);
    const cleared = clearChapter(start(), ch);
    expect(progress(cleared, ch)).toMatchObject({ status: "cleared", scene: "record", endingSeen: true });
  });
});
