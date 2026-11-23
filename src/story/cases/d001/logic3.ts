/**
 * CASE D-001 제3장 「세 사람의 비밀」의 사실과 추론 검증.
 *
 * 이 장이 묻는 것: 편집자 계정으로 들어와 영상을 고친 사람은 누구인가.
 *
 * 두 가지를 따로 판정한다.
 *  1) 진술 대조: 세 사람의 진술은 "누가 언제 어디에 있었다"는 주장이다. 출입 기록·방문 기록도 같은 종류의 주장이므로
 *     증거 조합의 규칙(src/engine/evidence.ts)을 그대로 쓴다: 진술과 기록을 함께 만족하는 경우가 하나도 없으면 모순,
 *     기록을 만족하는 모든 경우에서 진술이 참이면 기록이 진술을 받친다(알리바이).
 *  2) 고친 사람: 아직 모르는 것(고친 사람, 그 접속 동안 편집실에 있던 사람, 관리자 권한을 가진 사람, 방문증을 든 사람)을
 *     가능한 경우로 모두 펼치고 가진 증거에 어긋나는 경우를 지운다.
 *
 * 세 사람 모두 사실과 다른 말을 한다. 거짓말을 했다는 것은 고친 사람을 정하는 데 쓰이지 않는다:
 * 고친 사람은 "그 접속 내내 편집실에 있었고(출입 기록), 임시 비밀번호를 받을 수 있었던(권한표) 사람"으로 좁혀진다.
 * 출입 기록만으로는 둘, 권한표만으로도 둘이 남는다.
 * 건물의 출입 방식과 계정의 규칙은 지어낸 것이다.
 */
import { contradicts, entails } from "../../../engine/evidence";
import type { EvidenceClaim, EvidenceRules } from "../../../engine/types";
import type { ChapterProgress, Clock } from "../../engine/storyTypes";
import { CARRIED2, E2, ORIGINAL, RELEASED } from "./logic2";
import { DOHEE, GAEUL, NAME, NAMED, SANGMIN, SEORIN, covers, topic, within, type Named, type Span } from "./people";

/* ───────── 사건의 사실 (화면에 주어지는 자료) ───────── */

export const E3 = { door: "e10", access: "e11", lobby: "e12", perms: "e13", lies: "e14", confession: "e15" } as const;

/** 앞 장들을 해결하고 들어오므로 처음부터 갖고 있는 증거 */
export const CARRIED3: readonly string[] = [...CARRIED2, ...Object.values(E2)];

/** 최종 추론에서 "무엇을 따지는지"의 바탕이 되는 증거: 문제의 접속이 적힌 계정 접근 기록 */
export const CONTEXT3: readonly string[] = [E3.access];

export const PASS = "방문증 3번";

/** 편집실 문의 기록. 문은 등록된 지문이나 방문증으로만 열린다. */
export interface DoorLine {
  /** 지문의 주인. 방문증이면 null (누가 들었는지는 이 기록에 없다) */
  who: Named | null;
  key: "지문" | "방문증";
  spans: Span[];
}

export const DOOR: DoorLine[] = [
  { who: SANGMIN, key: "지문", spans: [{ from: "17:01", to: "18:25" }] },
  {
    who: GAEUL,
    key: "지문",
    spans: [
      { from: "09:05", to: "16:00" },
      { from: "19:08", to: "19:30" },
    ],
  },
  { who: null, key: "방문증", spans: [{ from: "17:25", to: "17:56" }] },
  { who: SEORIN, key: "지문", spans: [] },
];

/** 1층 안내 데스크의 방문 기록. 방문객만 적는다(직원의 출입은 적지 않는다). */
export const LOBBY: { who: Named; pass: string; spans: Span[] }[] = [
  {
    who: DOHEE,
    pass: PASS,
    spans: [
      { from: "15:00", to: "15:12" },
      { from: "17:23", to: "17:58" },
    ],
  },
];

export interface AccessSession {
  id: string;
  from: Clock;
  to: Clock;
  /** 어떤 비밀번호로 들어왔는가 */
  password: "old" | "temp" | "new";
  /** 그 접속에서 한 일 (접속을 가려낸 뒤에 읽는다) */
  did: string;
}

/** 편집자 계정의 그날 접속. 모두 편집실 PC 에서 이뤄졌다. */
export const ACCESS: AccessSession[] = [
  { id: "1", from: "09:12", to: "13:45", password: "old", did: "원본 내보내기" },
  { id: "2", from: "17:31", to: "17:53", password: "temp", did: "자막과 제목 수정, 다시 내보내기" },
  { id: "3", from: "19:10", to: "19:24", password: "new", did: "작업 기록 열람" },
];

/** 비밀번호 재설정: 관리자 권한으로 하면 임시 비밀번호가 나오고, 본인 인증으로 하면 본인이 새 비밀번호를 정한다 */
export const RESETS: { at: Clock; by: "admin" | "owner" }[] = [
  { at: "17:28", by: "admin" },
  { at: "19:06", by: "owner" },
];

export const PASSWORD_TEXT: Record<AccessSession["password"], string> = { old: "기존 비밀번호", temp: "임시 비밀번호", new: "새 비밀번호" };

export interface Permission {
  admin: boolean;
  text: string;
}

export const PERMS: Record<Named, Permission> = {
  [SANGMIN]: { admin: true, text: "관리자 · 계정 재설정, 예약 등록" },
  [SEORIN]: { admin: true, text: "관리자 · 채널 소유자" },
  [GAEUL]: { admin: false, text: "편집" },
  [DOHEE]: { admin: false, text: "권한 없음 · 팬 게시판만" },
};

/** 계정과 편집실의 규칙 (지어낸 것) */
export const ACCOUNT_RULES = {
  /** 편집 프로그램은 편집실 PC 에서만 열린다 */
  editorOnlyOnEditPC: true,
  /** 임시 비밀번호는 재설정한 관리자의 화면에만 표시된다 */
  tempShownToResetterOnly: true,
  text: ["편집 프로그램은 편집실 PC에서만 열린다.", "편집실 문은 등록된 지문이나 방문증으로만 열린다.", "임시 비밀번호는 재설정한 관리자의 화면에만 표시된다."],
};

export interface CaseData3 {
  door: DoorLine[];
  lobby: typeof LOBBY;
  access: AccessSession[];
  resets: typeof RESETS;
  perms: Record<Named, Permission>;
  rules: typeof ACCOUNT_RULES;
  /** 방송에 나간 파일이 만들어진 시각 (제2장) */
  releasedAt: Clock;
}

export const CASE3: CaseData3 = { door: DOOR, lobby: LOBBY, access: ACCESS, resets: RESETS, perms: PERMS, rules: ACCOUNT_RULES, releasedAt: RELEASED.createdAt };

/* ───────── 접속 가려내기 ───────── */

/** 방송에 나간 파일을 내보낸 접속일 수 있는 것: 그 파일이 만들어진 시각을 품은 접속 */
export const sessionsAround = (clock: Clock, data: CaseData3 = CASE3): AccessSession[] => data.access.filter((session) => within([session], clock));

/** 영상을 고친 접속. 하나로 정해지지 않으면 오류다(자료가 잘못됐다). */
export function modifyingSession(data: CaseData3 = CASE3): AccessSession {
  const found = sessionsAround(data.releasedAt, data);
  if (found.length !== 1) throw new Error("영상을 고친 접속이 하나로 정해지지 않는다");
  return found[0];
}

export function judgeRecord3(recordId: string, data: CaseData3 = CASE3): { correct: boolean; reason: string } {
  const session = data.access.find((s) => s.id === recordId);
  if (!session) return { correct: false, reason: "그런 접속은 없습니다." };
  const name = `접속 ${session.id}`;
  if (!within([session], data.releasedAt)) {
    const late = session.from > data.releasedAt;
    return {
      correct: false,
      reason: `${name}: 이 접속은 ${late ? `${session.from}에 시작했습니다` : `${session.to}에 끝났습니다`}. 방송에 나간 파일은 ${data.releasedAt}에 만들어졌습니다.`,
    };
  }
  const unique = sessionsAround(data.releasedAt, data).length === 1;
  return {
    correct: unique,
    reason: unique
      ? `${name}의 ${session.from}~${session.to} 사이에 방송에 나간 파일이 만들어졌습니다. 이 접속은 ${PASSWORD_TEXT[session.password]}로 들어왔습니다.`
      : "그 시각을 품은 접속이 둘 이상입니다.",
  };
}

/* ───────── 진술 대조: 누가 언제 어디에 있었나 ───────── */

/** 맞대어 보는 시각. 진술과 기록을 이 시각들의 위치로 옮겨 견준다. */
export const MOMENTS: Clock[] = ["15:30", "16:30", "17:40", "18:20", "19:15"];
export const EDIT_ROOM = "edit";
export const OUTSIDE = "out";

/** 증거 조합의 규칙에 넣을 세계: 네 사람, 세 곳, 다섯 시각 (카드는 쓰지 않는다) */
export const WHERE: EvidenceRules = {
  people: NAMED.map((id) => ({ id, name: NAME[id], color: "#f1f1ea", mark: "circle" as const })),
  places: [
    { id: EDIT_ROOM, name: "편집실" },
    { id: "office", name: "사무실" },
    { id: OUTSIDE, name: "건물 밖" },
  ],
  times: MOMENTS,
  cards: [],
  derivations: [],
};

const all = (of: EvidenceClaim[]): EvidenceClaim => ({ kind: "all", of });
/** 아무것도 말하지 않는 주장 (누구의 위치도 정하지 않는 기록) */
const NOTHING: EvidenceClaim = all([]);

/** 지문 기록 한 줄이 말하는 것: 구간 안의 시각에는 편집실에 있었고, 밖의 시각에는 편집실에 없었다 */
const doorClaim = (who: Named, spans: readonly Span[]): EvidenceClaim =>
  all(MOMENTS.map((clock, time) => ({ kind: within(spans, clock) ? "at" : "notAt", who, place: EDIT_ROOM, time }) as EvidenceClaim));

/** 방문 기록이 말하는 것: 방문 중인 시각에는 건물 안에 있었고, 그 밖의 시각에는 건물 밖에 있었다 */
const lobbyClaim = (who: Named, spans: readonly Span[]): EvidenceClaim =>
  all(MOMENTS.map((clock, time) => ({ kind: within(spans, clock) ? "notAt" : "at", who, place: OUTSIDE, time }) as EvidenceClaim));

/** 맞대어 볼 기록 줄 → 그 줄이 말하는 것. 방문증 줄과 계정 기록은 누구의 위치도 정하지 않는다. */
export function recordClaims(data: CaseData3 = CASE3): Record<string, EvidenceClaim> {
  const out: Record<string, EvidenceClaim> = {};
  for (const line of data.door) out[line.who ? `door-${line.who}` : "door-pass"] = line.who ? doorClaim(line.who, line.spans) : NOTHING;
  for (const line of data.lobby) out[`lobby-${line.who}`] = lobbyClaim(line.who, line.spans);
  out.access = NOTHING;
  return out;
}

const moment = (clock: Clock) => MOMENTS.indexOf(clock);
const notInEdit = (who: Named, clocks: Clock[]): EvidenceClaim => all(clocks.map((clock) => ({ kind: "notAt", who, place: EDIT_ROOM, time: moment(clock) })));
const outside = (who: Named, clocks: Clock[]): EvidenceClaim => all(clocks.map((clock) => ({ kind: "at", who, place: OUTSIDE, time: moment(clock) })));

/**
 * 진술이 말하는 것 (글은 ch3.ts 에 있다).
 * claim 이 null 인 진술은 추측이다: "누가 언제 어디에 있었다"는 사실이 들어 있지 않아 어떤 기록과도 맞대어지지 않는다.
 * 세 사람이 저마다 한 번씩 사실과 다른 말을 한다(거짓말의 수로도 한 사람이 가려지지 않게).
 */
export const STATEMENT_CLAIMS: Record<string, { speaker: Named; claim: EvidenceClaim | null }> = {
  /** 오상민: 오후 내내 편집실에 들어가지 않았다 */
  sm1: { speaker: SANGMIN, claim: notInEdit(SANGMIN, MOMENTS) },
  /** 오상민: 한가을은 4시쯤 퇴근했다 */
  sm2: { speaker: SANGMIN, claim: notInEdit(GAEUL, ["16:30"]) },
  /** 오상민: 편집 계정으로 한 일이면 계정의 주인인 한가을이 했을 것이다 (추측) */
  sm3: { speaker: SANGMIN, claim: null },
  /** 한가을: 4시에 퇴근했고 5시대에는 편집실에 없었다 */
  ge1: { speaker: GAEUL, claim: notInEdit(GAEUL, ["16:30", "17:40"]) },
  /** 한가을: 그 뒤로 그날은 편집실에 다시 가지 않았다 */
  ge2: { speaker: GAEUL, claim: notInEdit(GAEUL, ["18:20", "19:15"]) },
  /** 강도희: 3시 조금 지나 건물에서 나왔다 */
  dh1: { speaker: DOHEE, claim: outside(DOHEE, ["15:30"]) },
  /** 강도희: 그 뒤로 그 건물에 다시 가지 않았다 */
  dh2: { speaker: DOHEE, claim: outside(DOHEE, ["16:30", "17:40", "18:20", "19:15"]) },
};

export type ConfrontKind = "contradiction" | "supports" | "nothing";

/** 진술 하나와 기록 줄 하나를 맞대어 본다: 함께 성립할 수 없으면 모순, 기록에서 진술이 따라 나오면 받침 */
export function confrontKind(statementId: string, recordId: string, data: CaseData3 = CASE3): ConfrontKind {
  const claim = STATEMENT_CLAIMS[statementId]?.claim;
  const record = recordClaims(data)[recordId];
  // 추측(사실이 들어 있지 않은 말)과, 누구의 위치도 정하지 않는 기록은 맞대어 나오는 것이 없다
  if (!claim || !record || record === NOTHING) return "nothing";
  if (contradicts(WHERE, claim, record)) return "contradiction";
  return entails(WHERE, [record], claim) ? "supports" : "nothing";
}

export interface Confrontation {
  statement: string;
  record: string;
  kind: ConfrontKind;
}

/** 진술 × 기록의 모든 짝 (전수) */
export function confrontAll(data: CaseData3 = CASE3): Confrontation[] {
  const records = Object.keys(recordClaims(data));
  return Object.keys(STATEMENT_CLAIMS).flatMap((statement) => records.map((record) => ({ statement, record, kind: confrontKind(statement, record, data) })));
}

export const contradictions = (data: CaseData3 = CASE3): Confrontation[] => confrontAll(data).filter((x) => x.kind === "contradiction");

/** 기록과 어긋나는 말을 한 사람들 */
export const liars = (data: CaseData3 = CASE3): Named[] => [...new Set(contradictions(data).map((x) => STATEMENT_CLAIMS[x.statement].speaker))];

const spanText = (spans: readonly Span[]) => spans.map((span) => `${span.from}~${span.to}`).join(", ");
const doorOf = (who: Named, data: CaseData3) => data.door.find((line) => line.who === who)?.spans ?? [];

/** 맞대었을 때 듣는 글. 어긋나는 까닭과 받치는 까닭을 기록의 값으로 적는다. */
export function judgeConfront3(statementId: string, recordId: string, data: CaseData3 = CASE3): { kind: ConfrontKind; text: string } {
  const kind = confrontKind(statementId, recordId, data);
  if (kind === "nothing") return { kind, text: "" };
  const lobby = data.lobby.find((line) => `lobby-${line.who}` === recordId);
  const door = data.door.find((line) => line.who && `door-${line.who}` === recordId);
  const who = (door?.who ?? lobby?.who)!;
  const record = lobby ? `방문 기록에 따르면 ${topic(who)} ${spanText(lobby.spans)}에 건물 안에 있었다.` : door!.spans.length > 0 ? `${NAME[who]}의 지문은 ${spanText(door!.spans)}에 편집실 문에 찍혀 있다.` : `${NAME[who]}의 지문은 그날 편집실 문에 찍히지 않았다.`;
  return { kind, text: kind === "contradiction" ? `${record} 진술과 어긋난다.` : `${record} 진술과 맞는다.` };
}

/* ───────── 가능한 경우: 누가 고쳤나 ───────── */

export const OUTSIDER = "outsider";
export const SUSPECTS = [SANGMIN, GAEUL, DOHEE, SEORIN, OUTSIDER] as const;
export type Suspect = (typeof SUSPECTS)[number];

/** 아직 모르는 것들의 한 가지 경우 */
export interface World3 {
  /** 그 접속으로 영상을 고친 사람 */
  modifier: Suspect;
  /** 그 접속 내내 편집실에 있었는가 */
  inRoom: Record<Suspect, boolean>;
  /** 관리자 권한이 있는가 (기록에 없는 사람에게는 계정이 없다) */
  admin: Record<Named, boolean>;
  /** 방문증 3번을 들고 있던 사람 */
  pass: typeof DOHEE | typeof OUTSIDER;
  alive: boolean;
  abroad: boolean;
}

export interface Knowledge {
  evidence: readonly string[];
  facts?: readonly string[];
}

/**
 * 진술 대조 기록이 그 접속에 대해 말해 주는 것: 오상민이 그 시간에 편집실에 있었다는 것 하나다.
 * (한가을이 드러난 것은 저녁에 돌아왔다는 것, 강도희가 드러난 것은 건물에 다시 왔다는 것이다: 그 접속 동안 편집실에 있었는지는 아니다.)
 */
const EXPOSED_PEOPLE: Named[] = [SANGMIN];

/** 이 장의 경우를 좁히는 데 쓰이는 증거 (나머지 증거는 경우를 지우지 않는다) */
const USED3: readonly string[] = [E2.editlog, E3.door, E3.lobby, E3.access, E3.perms, E3.lies];
const worldCache = new WeakMap<CaseData3, Map<string, World3[]>>();

/**
 * 가진 증거와 어긋나지 않는 경우를 모두 돌려준다.
 * 5(고친 사람) × 2^5(편집실에 있던 사람) × 2^4(관리자) × 2(방문증) × 2 × 2 = 20480 가지를 모두 본다.
 * 같은 증거로 다시 물으면 앞서 센 것을 돌려준다(돌려받은 목록을 고치지 않는다).
 */
export function worlds3(known: Knowledge, data: CaseData3 = CASE3): World3[] {
  const key = USED3.filter((id) => known.evidence.includes(id)).join(",");
  const cache = worldCache.get(data) ?? new Map<string, World3[]>();
  worldCache.set(data, cache);
  const hit = cache.get(key);
  if (hit) return hit;

  const has = (id: string) => known.evidence.includes(id);
  const session = modifyingSession(data);
  const stayed = (spans: readonly Span[]) => covers(spans, session.from, session.to);
  const passIn = data.door.some((line) => line.who === null && stayed(line.spans));
  const holder = data.lobby.find((line) => line.pass === PASS && stayed(line.spans))?.who ?? OUTSIDER;
  const out: World3[] = [];

  for (let room = 0; room < 1 << SUSPECTS.length; room++) {
    const inRoom = Object.fromEntries(SUSPECTS.map((who, i) => [who, (room & (1 << i)) !== 0])) as Record<Suspect, boolean>;
    // 진술 대조 기록: 거짓말을 했다는 것은 고친 사람을 좁히지 않는다. 드러난 위치만 남는다.
    if (has(E3.lies) && EXPOSED_PEOPLE.some((who) => inRoom[who] !== stayed(doorOf(who, data)))) continue;
    // 편집실 출입 기록: 지문이 등록된 사람은 기록 그대로다.
    if (has(E3.door) && data.door.some((line) => line.who !== null && inRoom[line.who] !== stayed(line.spans))) continue;

    for (const pass of [DOHEE, OUTSIDER] as const) {
      // 편집실 출입 기록: 지문이 없는 사람은 방문증을 든 사람만 들어온다.
      if (has(E3.door) && (inRoom[DOHEE] !== (passIn && pass === DOHEE) || inRoom[OUTSIDER] !== (passIn && pass === OUTSIDER))) continue;
      // 건물 방문 기록: 그 시간에 방문증 3번을 받아 간 사람
      if (has(E3.lobby) && pass !== holder) continue;

      for (let rights = 0; rights < 1 << NAMED.length; rights++) {
        const admin = Object.fromEntries(NAMED.map((who, i) => [who, (rights & (1 << i)) !== 0])) as Record<Named, boolean>;
        // 작업 권한표
        if (has(E3.perms) && NAMED.some((who) => admin[who] !== data.perms[who].admin)) continue;

        for (const modifier of SUSPECTS) {
          // 제2장의 작업 기록: 영상은 편집실 PC 에서 고쳤다. 편집 프로그램은 그 PC 에서만 열리므로 고친 사람은 그 접속 내내 편집실에 있었다.
          if (has(E2.editlog) && data.rules.editorOnlyOnEditPC && !inRoom[modifier]) continue;
          // 계정 접근 기록: 그 접속은 관리자 권한으로 재설정해 나온 임시 비밀번호로 들어왔다.
          // 임시 비밀번호는 재설정한 관리자의 화면에만 표시되므로, 고친 사람은 관리자 권한이 있다.
          if (has(E3.access) && session.password === "temp" && data.rules.tempShownToResetterOnly) {
            if (modifier === OUTSIDER || !admin[modifier]) continue;
          }
          // 오상민의 두 번째 진술(끝 장면): 진술이다. 경우를 지우지 않는다.
          for (const alive of [true, false]) for (const abroad of [true, false]) out.push({ modifier, inRoom, admin, pass, alive, abroad });
        }
      }
    }
  }
  cache.set(key, out);
  return out;
}

/** 최종 추론의 선택지와 "아직 모르는 것"이 말하는 것 */
export const CLAIMS3: Record<string, (w: World3) => boolean> = {
  ...(Object.fromEntries(SUSPECTS.map((who) => [who, (w: World3) => w.modifier === who])) as Record<Suspect, (w: World3) => boolean>),
  dead: (w) => !w.alive,
  abroad: (w) => w.abroad,
};

export type Verdict = "established" | "open" | "refuted";

export function judge3(claim: string, known: Knowledge, data: CaseData3 = CASE3): Verdict {
  const left = worlds3(known, data);
  const holds = left.filter(CLAIMS3[claim]);
  if (left.length > 0 && holds.length === left.length) return "established";
  return holds.length === 0 ? "refuted" : "open";
}

/** 그 증거들로 아직 지워지지 않은 용의자 */
export const suspectsLeft = (known: Knowledge, data: CaseData3 = CASE3): Suspect[] => {
  const left = worlds3(known, data);
  return SUSPECTS.filter((who) => left.some((w) => w.modifier === who));
};

/**
 * 최종 추론: 결론(누가)과 근거 둘을 함께 본다. 문제의 접속이 적힌 계정 접근 기록은 바탕으로 늘 깔려 있다.
 *  - correct     : 앞 장의 증거 + 계정 접근 기록 + 내놓은 근거만으로 그 결론이 확정된다
 *  - weak        : 가진 증거 전체로는 확정되지만, 내놓은 근거로는 확정되지 않는다
 *  - unsupported : 가진 증거 전체로도 확정되지 않는(또는 지워지는) 결론이다
 */
export function judgeDeduction3(claim: string, basis: string | readonly string[], progress: Pick<ChapterProgress, "evidence">, data: CaseData3 = CASE3): "correct" | "weak" | "unsupported" {
  if (!CLAIMS3[claim]) return "unsupported";
  const bases = typeof basis === "string" ? [basis] : [...basis];
  if (judge3(claim, { evidence: [...CARRIED3, ...progress.evidence] }, data) !== "established") return "unsupported";
  if (!bases.every((id) => progress.evidence.includes(id))) return "weak";
  const context = CONTEXT3.filter((id) => progress.evidence.includes(id));
  return judge3(claim, { evidence: [...CARRIED3, ...context, ...bases] }, data) === "established" ? "correct" : "weak";
}

/* ───────── 힌트와 해설이 기대는 사실 ───────── */

const BASE: string[] = [...CARRIED3, ...CONTEXT3];
const ALL3: Knowledge = { evidence: [...CARRIED3, E3.door, E3.access, E3.lobby, E3.perms, E3.lies] };
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

export const CHECKS3: Record<string, () => boolean> = {
  /** 위치를 말해 주는 기록은 출입 기록과 방문 기록뿐이다 */
  locationRecords: () => confrontAll().every((x) => x.kind === "nothing" || x.record.startsWith("door-") || x.record.startsWith("lobby-")),
  /** 기록과 어긋나는 진술은 셋이다 */
  threeContradictions: () => new Set(contradictions().map((x) => x.statement)).size === 3,
  /** 세 사람 모두 어긋나는 말을 했다 */
  threeLiars: () => same(liars(), [SANGMIN, GAEUL, DOHEE]),
  /** 세 사람이 한 번씩 어긋난다 (거짓말의 수로는 한 사람이 가려지지 않는다) */
  eachLiesOnce: () => ([SANGMIN, GAEUL, DOHEE] as Named[]).every((who) => contradictions().filter((x) => STATEMENT_CLAIMS[x.statement].speaker === who).length === 1),
  /** 방송에 나간 파일이 만들어진 시각을 품은 접속은 하나다 */
  oneSessionAround: () => sessionsAround(CASE3.releasedAt).length === 1,
  /** 원본을 내보낸 시각은 다른 접속(기존 비밀번호)에 든다 */
  originalInFirstSession: () => sessionsAround(ORIGINAL.createdAt).length === 1 && sessionsAround(ORIGINAL.createdAt)[0].password === "old",
  /** 그 접속은 관리자 권한으로 재설정해 나온 임시 비밀번호로 들어왔다 */
  tempAfterAdminReset: () => modifyingSession().password === "temp" && RESETS.some((reset) => reset.by === "admin" && reset.at < modifyingSession().from),
  /** 출입 기록으로 좁히면 둘이 남는다 */
  doorLeavesTwo: () => suspectsLeft({ evidence: [...BASE, E3.door] }).length === 2,
  /** 권한표로 좁혀도 둘이 남는다 */
  permsLeaveTwo: () => same(suspectsLeft({ evidence: [...BASE, E3.perms] }), [SANGMIN, SEORIN]),
  /** 둘을 함께 놓으면 한 사람이다 */
  bothLeaveOne: () => same(suspectsLeft({ evidence: [...BASE, E3.door, E3.perms] }), [SANGMIN]),
  /** 그 접속 내내 편집실에 있던 사람은 오상민과 방문증을 든 강도희다 */
  twoInRoom: () => same(suspectsLeft({ evidence: [...CARRIED3, E3.door, E3.lobby] }), [SANGMIN, DOHEE]),
  /** 관리자는 오상민과 윤서린뿐이다 */
  twoAdmins: () => same(NAMED.filter((who) => PERMS[who].admin), [SANGMIN, SEORIN]),
  /** 윤서린의 지문은 그날 편집실에 찍히지 않았다 */
  seorinNeverIn: () => doorOf(SEORIN, CASE3).length === 0,
  /** 한가을은 그 접속 동안 편집실에 없었다 */
  gaeulAway: () => !covers(doorOf(GAEUL, CASE3), modifyingSession().from, modifyingSession().to) && !within(doorOf(GAEUL, CASE3), modifyingSession().from),
  /** 거짓말을 했지만 영상을 고치지 않은 사람이 있다 */
  liarsNotModifier: () => ([GAEUL, DOHEE] as Named[]).every((who) => liars().includes(who) && judge3(who, ALL3) === "refuted"),
  /** 고친 사람은 오상민으로 확정된다 */
  modifierEstablished: () => judge3(SANGMIN, ALL3) === "established",
};
