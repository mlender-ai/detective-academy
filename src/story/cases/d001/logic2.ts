/**
 * CASE D-001 제2장 「사라진 원본」의 사실과 추론 검증.
 *
 * 이 장이 묻는 것: 공개된 마지막 방송은 원래 만든 영상과 같은가.
 * 제1장과 같은 방식으로 판정한다: 아직 모르는 것(원래 영상이 알리려던 것, 두 영상의 관계, 바뀐 때, 고친 사람, 생사)을
 * 가능한 경우로 모두 펼치고, 가진 증거에 어긋나는 경우를 지운다. 남은 모든 경우에서 참인 것만 "확정"이다.
 *
 * 이 장이 확정하는 것은 "은퇴를 알리던 영상이 방송 전에 글자(제목과 자막)만 바뀌어 나갔다"까지다.
 * 누가 고쳤는지는 확정하지 않는다: 작업 기록에 남은 계정의 주인이 그 작업을 했다는 기록은 없다.
 * 편집 프로그램과 그 규칙은 지어낸 것이다.
 */
import { constraintHolds, solveSchedule } from "../../../engine/puzzleValidator";
import type { ScheduleConstraint, ScheduleRules } from "../../../engine/types";
import type { ChapterProgress, Clock } from "../../engine/storyTypes";
import { BROADCAST, E as E1, SOURCE_FILE, lengthText } from "./logic";
import { DOHEE, GAEUL, SANGMIN, SEORIN, josa, toMinutes } from "./people";

/* ───────── 사건의 사실 (화면에 주어지는 자료) ───────── */

export const E2 = { original: "e05", released: "e06", subtitles: "e07", editlog: "e08", notice: "e09" } as const;

/** 앞 장을 해결하고 들어오므로 이 장에서는 처음부터 갖고 있는 증거 */
export const CARRIED2: readonly string[] = Object.values(E1);

/** 영상이 알리는 것 */
export type Says = "retire" | "death";

export interface SubLine {
  no: number;
  /** 화면에 뜨는 때(초). 그때부터 10초 동안 보인다 */
  at: number;
  text: string;
}

/** 자막 파일의 변경 한 번. 고칠 때마다 판 번호가 하나 오른다. */
export type SubChange = { rev: number; kind: "replace"; line: number; text: string } | { rev: number; kind: "delete"; line: number };

/** 자막 파일의 첫 판(r1) */
export const SUB_BASE: SubLine[] = [
  { no: 1, at: 90, text: "오늘로 '토끼'라는 이름을 내려놓습니다." },
  { no: 2, at: 300, text: "저는 제 일상으로 돌아갑니다. 그동안 고마웠습니다." },
];

export const SUB_CHANGES: SubChange[] = [
  { rev: 2, kind: "replace", line: 1, text: "오늘로 토끼는 끝입니다." },
  { rev: 3, kind: "delete", line: 2 },
];

const SUB_SHOWN_SEC = 10;
export const NO_CAPTION = "(자막 없음)";

/** 그 판의 자막 */
export function subtitlesAt(rev: number, base: readonly SubLine[] = SUB_BASE, changes: readonly SubChange[] = SUB_CHANGES): SubLine[] {
  let lines = base.map((line) => ({ ...line }));
  for (const change of [...changes].sort((a, b) => a.rev - b.rev)) {
    if (change.rev > rev) break;
    lines = change.kind === "delete" ? lines.filter((line) => line.no !== change.line) : lines.map((line) => (line.no === change.line ? { ...line, text: change.text } : line));
  }
  return lines;
}

/** 그 판의 영상에서 그 시각에 떠 있는 자막. 없으면 null */
export function captionAt(rev: number, sec: number): string | null {
  return subtitlesAt(rev).find((line) => line.at <= sec && sec < line.at + SUB_SHOWN_SEC)?.text ?? null;
}

export interface VideoFile {
  name: string;
  lengthSec: number;
  /** 내보내기를 마친 시각 (그 뒤로 바뀌지 않는다) */
  createdAt: Clock;
  /** 어느 촬영본으로 만들었는가 */
  footage: string;
  /** 내보낼 때의 자막 판 */
  subRev: number;
  title: { text: string; says: Says };
  /** 휴지통으로 간 시각 */
  trashedAt?: Clock;
}

/** 휴지통에서 되살린 영상 */
export const ORIGINAL: VideoFile = {
  name: "TORI_FINAL.mp4",
  lengthSec: 420,
  createdAt: "13:40",
  footage: "shoot-1120",
  subRev: 1,
  title: { text: "오늘 밤, 토끼는 은퇴합니다.", says: "retire" },
  trashedAt: "17:55",
};

/** 방송에 나간 영상. 제1장의 원본 파일 정보(증거 03)와 같은 파일이다. */
export const RELEASED: VideoFile = {
  name: SOURCE_FILE.name,
  lengthSec: SOURCE_FILE.lengthSec,
  createdAt: "17:52",
  footage: "shoot-1120",
  subRev: 3,
  title: { text: BROADCAST.title, says: "death" },
};

export interface Cut {
  id: string;
  at: number;
  /** 화면에 놓을 그림 (제1장 방송실 그림의 시점 이름) */
  still: string;
}

/** 두 영상을 견주는 시점. 그림은 제1장의 방송실 그림을 다시 쓴다. */
export const CUTS: Cut[] = [
  { id: "c0015", at: 15, still: "t0015" },
  { id: "c0130", at: 90, still: "t0015" },
  { id: "c0310", at: 190, still: "t0310" },
  { id: "c0500", at: 300, still: "t0640" },
];

/** 촬영본마다, 시점마다 화면에 보이는 것 */
export const FOOTAGE: Record<string, Record<string, string>> = {
  "shoot-1120": {
    c0015: "가면을 쓴 사람이 카메라 앞에 앉아 있다",
    c0130: "가면을 쓴 사람이 앉아 있다. 움직이지 않는다",
    c0310: "자리에서 일어나 화면 밖으로 걸어 나간다",
    c0500: "빈 의자. 등받이에 가면이 걸려 있다",
  },
};

export interface CaseData2 {
  original: VideoFile;
  released: VideoFile;
  /** 예약 등록 시각 (제1장 증거 03) */
  registeredAt: Clock;
  /** 방송 시작 (제1장 증거 01) */
  airStart: Clock;
}

export const CASE2: CaseData2 = { original: ORIGINAL, released: RELEASED, registeredAt: SOURCE_FILE.registeredAt, airStart: BROADCAST.start };

/* ───────── 비교 ───────── */

export interface CompareValue {
  frame: string;
  field: string;
  a: string;
  b: string;
}

/** 두 영상을 같은 자리끼리 견준 값. 화면의 비교 장면이 이 값을 그대로 쓴다(달라진 곳은 값이 다른 곳이다). */
export function compareValues(data: CaseData2 = CASE2): CompareValue[] {
  const { original: a, released: b } = data;
  const picture = (file: VideoFile, cut: Cut) => FOOTAGE[file.footage]?.[cut.id] ?? "(다른 화면)";
  const caption = (file: VideoFile, cut: Cut) => captionAt(file.subRev, cut.at) ?? NO_CAPTION;
  const out: CompareValue[] = [
    { frame: "file", field: "length", a: lengthText(a.lengthSec), b: lengthText(b.lengthSec) },
    { frame: "file", field: "created", a: a.createdAt, b: b.createdAt },
  ];
  CUTS.forEach((cut, i) => {
    out.push({ frame: cut.id, field: "picture", a: picture(a, cut), b: picture(b, cut) });
    // 제목 자막은 영상 내내 같은 글자다: 첫 시점에서 한 번만 견준다
    if (i === 0) out.push({ frame: cut.id, field: "title", a: a.title.text, b: b.title.text });
    else out.push({ frame: cut.id, field: "caption", a: caption(a, cut), b: caption(b, cut) });
  });
  return out;
}

export const differences = (data: CaseData2 = CASE2): CompareValue[] => compareValues(data).filter((v) => v.a !== v.b);

export type Relation = "same" | "text" | "reshot";

/** 두 파일의 관계: 그대로다 · 글자(제목·자막)만 바뀌었다 · 화면이 다르다(다시 찍었다) */
export function relationOf(a: VideoFile, b: VideoFile): Relation {
  if (a.footage !== b.footage || a.lengthSec !== b.lengthSec) return "reshot";
  const subs = (file: VideoFile) => JSON.stringify(subtitlesAt(file.subRev));
  return a.title.text !== b.title.text || subs(a) !== subs(b) ? "text" : "same";
}

/* ───────── 작업 기록의 순서 ───────── */

export interface EditOp {
  id: string;
  label: string;
  /** 이 작업을 할 때의 자막 판 */
  sees?: number;
  /** 이 작업이 만든 자막 판 */
  makes?: number;
  /** 시각이 남은 작업 (파일의 생성 시각, 휴지통의 삭제 시각) */
  at?: Clock;
}

/** 편집 프로그램의 작업 기록에는 시각이 없다. 적힌 순서는 화면에 처음 놓이는 순서다(일어난 순서가 아니다). */
export const EDIT_OPS: EditOp[] = [
  { id: "op-title", label: "제목 자막 변경", sees: 2 },
  { id: "op-export2", label: `내보내기 → ${RELEASED.name}`, sees: RELEASED.subRev, at: RELEASED.createdAt },
  { id: "op-sub1", label: "자막 1번 줄 교체", makes: 2 },
  { id: "op-trash", label: `${ORIGINAL.name} 삭제`, at: ORIGINAL.trashedAt },
  { id: "op-export1", label: `내보내기 → ${ORIGINAL.name}`, sees: ORIGINAL.subRev, at: ORIGINAL.createdAt },
  { id: "op-sub2", label: "자막 2번 줄 삭제", makes: 3 },
];

/** 작업 기록에 남은 계정과 장치. 계정의 주인이 그 작업을 했다는 뜻은 아니다. */
export const EDIT_LOG = { account: GAEUL, accountLabel: "편집자 계정", device: "편집실 PC" } as const;

export const EDITOR_RULES = [
  "자막을 고칠 때마다 자막 판 번호가 하나씩 오른다 (r1 → r2 → r3).",
  "작업 기록의 줄에는 그 작업을 할 때의 자막 판이 적힌다.",
  "내보낸 파일의 '생성' 시각은 내보내기를 마친 시각이다. 그 뒤로 바뀌지 않는다.",
];

const quote = (op: EditOp) => `「${op.label}」`;
const subject = (op: EditOp) => `${quote(op)}${josa(op.label, "이", "가")}`;

/**
 * 작업 기록의 꼬리표(자막 판, 시각)에서 "무엇이 무엇보다 먼저인가"를 끌어낸다.
 * 손으로 적은 순서가 아니다: 꼬리표를 고치면 조건도 달라진다. 순서 추론의 조건 형식을 그대로 쓴다.
 */
export function orderConstraints(ops: readonly EditOp[] = EDIT_OPS): ScheduleConstraint[] {
  const out: ScheduleConstraint[] = [];
  for (const x of ops)
    for (const y of ops) {
      if (x.id === y.id) continue;
      // r(n) 일 때 한 작업은 r(n+1) 을 만든 작업보다 먼저다
      if (x.sees !== undefined && y.makes === x.sees + 1) {
        out.push({ kind: "before", a: x.id, b: y.id, text: `${quote(x)}의 자막 판은 r${x.sees} 판입니다. r${y.makes} 판을 만든 ${quote(y)}보다 먼저 한 작업입니다.` });
      }
      // r(n) 을 만든 작업은 r(n) 일 때 한 작업보다 먼저다
      if (x.makes !== undefined && y.sees === x.makes) {
        out.push({ kind: "before", a: x.id, b: y.id, text: `${quote(y)}의 자막 판은 r${y.sees} 판입니다. 그 판을 만든 ${subject(x)} 먼저 있어야 합니다.` });
      }
      // 자막 판은 하나씩 오른다
      if (x.makes !== undefined && y.makes === x.makes + 1) {
        out.push({ kind: "before", a: x.id, b: y.id, text: `자막 판은 r${x.makes} 판 다음이 r${y.makes} 판입니다. ${subject(x)} ${quote(y)}보다 먼저입니다.` });
      }
      // 시각이 남은 작업끼리는 이른 쪽이 먼저다
      if (x.at && y.at && toMinutes(x.at) < toMinutes(y.at)) {
        out.push({ kind: "before", a: x.id, b: y.id, text: `${quote(x)}에 남은 시각은 ${x.at}, ${quote(y)}에 남은 시각은 ${y.at}입니다. 시각이 이른 쪽이 먼저입니다.` });
      }
    }
  return out;
}

/** 순서 추론의 검증기(puzzleValidator)에 넣을 수 있는 모양 */
export function orderRules(ops: readonly EditOp[] = EDIT_OPS): ScheduleRules {
  return {
    people: ops.map((op) => ({ id: op.id, name: op.label, color: "#f1f1ea", mark: "circle" })),
    slots: ops.map((_, i) => ({ label: `${i + 1}번째`, ordinal: String(i + 1) })),
    constraints: orderConstraints(ops),
    title: "작업 순서",
  };
}

/** 꼬리표와 어긋나지 않는 순서 전부 (전수 탐색). 하나여야 한다. */
export const validOrders = (ops: readonly EditOp[] = EDIT_OPS): string[][] => solveSchedule(orderRules(ops));

export function judgeOrder(order: readonly string[], ops: readonly EditOp[] = EDIT_OPS): { correct: boolean; reason: string } {
  const broken = orderConstraints(ops).find((constraint) => !constraintHolds(constraint, order));
  if (broken) return { correct: false, reason: broken.text };
  const unique = validOrders(ops).length === 1;
  return { correct: unique, reason: unique ? "여섯 줄의 꼬리표가 모두 맞아떨어진다." : "꼬리표만으로는 순서가 하나로 정해지지 않습니다." };
}

/* ───────── 가능한 경우 ───────── */

const EDITORS = [SEORIN, SANGMIN, GAEUL, DOHEE, "outsider", "none"] as const;

/** 아직 모르는 것들의 한 가지 경우 */
export interface World2 {
  /** 원래 만든 영상이 알리려던 것 */
  original: Says;
  /** 방송에 나간 영상과 원래 영상의 관계 */
  relation: Relation;
  /** 바뀌었다면 언제인가: 방송 전 · 방송 뒤 */
  when: "before" | "after";
  /** 고친 사람. 바뀌지 않았으면 none */
  editor: (typeof EDITORS)[number];
  alive: boolean;
}

export interface Knowledge {
  evidence: readonly string[];
  facts?: readonly string[];
}

/** 가진 증거와 어긋나지 않는 경우를 모두 돌려준다 */
export function worlds2(known: Knowledge, data: CaseData2 = CASE2): World2[] {
  const has = (id: string) => known.evidence.includes(id);
  const out: World2[] = [];
  for (const original of ["retire", "death"] as Says[])
    for (const relation of ["same", "text", "reshot"] as Relation[])
      for (const when of ["before", "after"] as const)
        for (const editor of EDITORS)
          for (const alive of [true, false]) {
            // 바뀌지 않았으면 고친 사람도, 고친 때도 없다
            if ((relation === "same") !== (editor === "none")) continue;
            if (relation === "same" && when !== "before") continue;
            // 제1장: 방송에 나간 영상의 제목은 안다. 원래 영상 그대로였다면 원래 영상도 같은 것을 알렸다.
            if (has(E1.broadcast) && relation === "same" && original !== data.released.title.says) continue;
            // 원본 영상 파일: 원래 영상이 알리려던 것은 그 파일의 제목과 자막에 있다
            if (has(E2.original) && original !== data.original.title.says) continue;
            // 두 파일을 함께 놓아야 무엇이 어떻게 달라졌는지 안다
            if (has(E2.original) && has(E2.released) && relation !== relationOf(data.original, data.released)) continue;
            // 공개 영상 파일의 생성 시각과 제1장의 예약 등록 시각: 등록보다 먼저 만들어진 파일이면 방송 전에 바뀐 것이다
            if (has(E2.released) && has(E1.file) && relation !== "same") {
              const before = toMinutes(data.released.createdAt) < toMinutes(data.registeredAt) && toMinutes(data.registeredAt) < toMinutes(data.airStart);
              if ((when === "before") !== before) continue;
            }
            // 자막 변경 이력, 수정 작업 기록, 계정 알림: 무엇을 어떤 순서로 했는지와 어느 계정이었는지를 말할 뿐이다.
            // 계정의 주인이 그 작업을 했다는 기록이 아니므로 고친 사람은 좁혀지지 않는다.
            out.push({ original, relation, when, editor, alive });
          }
  return out;
}

/** 최종 추론의 선택지와 "아직 모르는 것"이 말하는 것 */
export const CLAIMS2: Record<string, (w: World2) => boolean> = {
  same: (w) => w.relation === "same",
  altered: (w) => w.original === "retire" && w.relation === "text" && w.when === "before",
  reshot: (w) => w.relation === "reshot",
  afterAir: (w) => w.relation !== "same" && w.when === "after",
  gaeul: (w) => w.editor === GAEUL,
  dead: (w) => !w.alive,
};

export type Verdict = "established" | "open" | "refuted";

export function judge2(claim: string, known: Knowledge, data: CaseData2 = CASE2): Verdict {
  const all = worlds2(known, data);
  const holds = all.filter(CLAIMS2[claim]);
  if (all.length > 0 && holds.length === all.length) return "established";
  return holds.length === 0 ? "refuted" : "open";
}

/**
 * 최종 추론: 결론과 근거 둘을 함께 본다.
 *  - correct     : 앞 장의 증거 + 내놓은 근거만으로 그 결론이 확정된다
 *  - weak        : 가진 증거 전체로는 확정되지만, 내놓은 근거로는 확정되지 않는다
 *  - unsupported : 가진 증거 전체로도 확정되지 않는 결론이다
 */
export function judgeDeduction2(claim: string, basis: string | readonly string[], progress: Pick<ChapterProgress, "evidence">, data: CaseData2 = CASE2): "correct" | "weak" | "unsupported" {
  if (!CLAIMS2[claim]) return "unsupported";
  const bases = typeof basis === "string" ? [basis] : [...basis];
  if (judge2(claim, { evidence: [...CARRIED2, ...progress.evidence] }, data) !== "established") return "unsupported";
  if (!bases.every((id) => progress.evidence.includes(id))) return "weak";
  return judge2(claim, { evidence: [...CARRIED2, ...bases] }, data) === "established" ? "correct" : "weak";
}

/* ───────── 힌트와 해설이 기대는 사실 ───────── */

const ALL2: Knowledge = { evidence: [...CARRIED2, E2.original, E2.released, E2.subtitles, E2.editlog, E2.notice] };
const solution = () => validOrders()[0] ?? [];
const at = (id: string) => solution().indexOf(id);

export const CHECKS2: Record<string, () => boolean> = {
  /** 두 영상의 화면은 모든 시점에서 같다 */
  picturesSame: () => compareValues().filter((v) => v.field === "picture").every((v) => v.a === v.b),
  /** 달라진 곳은 넷이다 */
  fourDifferences: () => differences().length === 4,
  /** 그 가운데 하나는 파일 정보에, 셋은 영상 안에 있다 */
  oneInFileThreeInVideo: () => differences().filter((v) => v.frame === "file").length === 1 && differences().filter((v) => v.frame !== "file").length === 3,
  /** 영상 안에서 달라진 것은 글자뿐이다 */
  onlyTextChanged: () => relationOf(ORIGINAL, RELEASED) === "text",
  /** 자막 한 줄은 사라졌다 */
  oneCaptionRemoved: () => differences().some((v) => v.field === "caption" && v.b === NO_CAPTION),
  /** 꼬리표로 정해지는 순서는 하나다 */
  orderUnique: () => validOrders().length === 1,
  /** 시각이 남은 작업은 셋이고 삭제가 가장 늦다 */
  trashLast: () => EDIT_OPS.filter((op) => op.at).length === 3 && at("op-trash") === EDIT_OPS.length - 1,
  /** 제목 변경은 자막 수정 두 번의 사이다 */
  titleBetweenSubs: () => at("op-sub1") < at("op-title") && at("op-title") < at("op-sub2"),
  /** 원본을 내보낸 것이 맨 처음이다 */
  originalExportFirst: () => at("op-export1") === 0,
  /** 되살린 영상이 먼저 만들어졌다 */
  originalFirst: () => toMinutes(ORIGINAL.createdAt) < toMinutes(RELEASED.createdAt),
  /** 원래 영상은 은퇴를 알렸다 */
  originalRetire: () => ORIGINAL.title.says === "retire" && judge2("altered", ALL2) === "established",
  /** 공개본은 예약 등록보다, 예약 등록은 방송보다 먼저다 */
  changedBeforeAir: () => toMinutes(RELEASED.createdAt) < toMinutes(CASE2.registeredAt) && toMinutes(CASE2.registeredAt) < toMinutes(CASE2.airStart),
  /** 원본은 공개본을 내보낸 뒤에 지워졌다 */
  originalTrashedAfter: () => toMinutes(RELEASED.createdAt) < toMinutes(ORIGINAL.trashedAt ?? "00:00"),
  /** 결론에는 두 파일이 모두 필요하다 */
  needsBothFiles: () =>
    judge2("altered", { evidence: [...CARRIED2, E2.original, E2.released] }) === "established" &&
    judge2("altered", { evidence: [...CARRIED2, E2.original] }) !== "established" &&
    judge2("altered", { evidence: [...CARRIED2, E2.released] }) !== "established",
  /** 작업 기록의 계정이 누구 것이든, 고친 사람은 정해지지 않는다 */
  accountOwnerOpen: () => judge2("gaeul", ALL2) === "open",
};
