/**
 * CASE D-001 제4장 「토끼의 정체」의 사실과 추론 검증.
 *
 * 이 장이 묻는 것: 윤서린에게 실제로 무슨 일이 있었는가.
 *
 * 세 가지를 판정한다.
 *  1) 증거 연결: 두 번째 진술과 새 기록을 앞 장의 기록과 맞대어 나오는 사실 넷(LINK_HOLDS4).
 *  2) 그날의 타임라인: 시각 순서로 놓인 일곱 가지 일마다, 가진 증거로 그 일을 할 수 있었던 사람을 가린다.
 *     줄마다 남는 사람이 정확히 하나여야 한다(일곱 줄의 모든 배정 5^7 가지를 돌려 하나만 남는지 본다).
 *  3) 윤서린의 생사와 뜻: 살아 있다는 신호 셋(계정 접속, 문자, 경찰의 대면 확인) 가운데
 *     "본인"임을 보증하는 것은 대면 확인뿐이다. 계정과 문자는 다른 사람도 남길 수 있으므로,
 *     그 둘(과 강도희의 말)을 모두 합쳐도 생존은 확정되지 않는다.
 *
 * 윤서린이 지금 있는 곳은 끝까지 확정하지 않는다(본인이 밝히지 않기를 바랐다).
 * 경찰의 확인 절차와 회신의 형식은 지어낸 것이다.
 */
import type { ChapterProgress, Clock } from "../../engine/storyTypes";
import { BROADCAST, E as E1, SOURCE_FILE, judge as judge1 } from "./logic";
import { E2, EDIT_LOG, ORIGINAL } from "./logic2";
import { ACCESS, CARRIED3, CASE3, E3, OUTSIDER, PASS, RESETS, modifyingSession, suspectsLeft, type CaseData3 } from "./logic3";
import { DOHEE, GAEUL, NAME, NAMED, SANGMIN, SEORIN, covers, toMinutes, topic, type Named, type Span } from "./people";

/* ───────── 사건의 사실 (화면에 주어지는 자료) ───────── */

export const E4 = { login: "e16", text: "e17", police: "e18", schedule: "e19", restated: "e20", report: "e21" } as const;
export const F4 = { gaeulKnew: "f04", doheeHid: "f05", registrar: "f06", rumorFalse: "f07" } as const;

/** 앞 장들을 해결하고 들어오므로 처음부터 갖고 있는 증거 */
export const CARRIED4: readonly string[] = [...CARRIED3, ...Object.values(E3)];

/** 방송이 있던 날을 0 으로 센 날짜와 시각 */
export interface Stamp {
  day: number;
  clock: Clock;
}

const DAY_TEXT = ["11월 21일", "11월 22일"];
export const stampText = (at: Stamp): string => `${DAY_TEXT[at.day]} ${at.clock}`;
const stampMinutes = (at: Stamp): number => at.day * 24 * 60 + toMinutes(at.clock);

/** 윤서린의 계정에 남은 접속 기록 */
export const LOGIN = { at: { day: 1, clock: "09:14" } as Stamp, device: "휴대전화", by: "비밀번호 입력" };

/** 강도희의 전화에 온 문자 */
export const TEXT_MESSAGE = { at: { day: 1, clock: "00:31" } as Stamp, from: `${NAME[SEORIN]}의 번호`, body: "나 괜찮아. 찾지 말아 줘." };

/** 경찰의 안전 확인 회신 */
export interface PoliceReply {
  at: Stamp;
  /** 경찰관이 직접 만났는가 */
  inPerson: boolean;
  /** 신분증과 지문으로 본인임을 대조했는가 */
  idChecked: boolean;
  alive: boolean;
  /** 떠난 것이 본인의 뜻인가 */
  will: "own" | "forced";
  /** 본인이 밝힌, 건물을 나온 때 */
  leftAround: string;
  /** 지금 있는 곳: 본인 요청으로 적지 않았다 */
  whereabouts: "withheld" | "stated";
}

export const POLICE: PoliceReply = { at: { day: 1, clock: "15:20" }, inPerson: true, idChecked: true, alive: true, will: "own", leftAround: "15시경", whereabouts: "withheld" };

/** 예약 등록의 상세. 제1장의 증거 04 가 말하지 않던 것(접속 장치)이 더해졌다. */
export const SCHEDULED = { at: SOURCE_FILE.registeredAt, account: "운영팀 공용 계정", device: EDIT_LOG.device, onEditPC: true, file: SOURCE_FILE.name, title: BROADCAST.title };

/** 두 사람의 두 번째 진술 */
export const RESTATED = {
  [GAEUL]: { sawLogAt: ACCESS.find((s) => s.password === "new")!.from, told: false },
  [DOHEE]: { helpedLeave: true, saysSafe: true, knowsWhere: true, tells: false },
};

export interface CaseData4 {
  police: PoliceReply;
  scheduled: typeof SCHEDULED;
  three: CaseData3;
}

export const CASE4: CaseData4 = { police: POLICE, scheduled: SCHEDULED, three: CASE3 };

/** 대면해 신분을 대조한 확인만이 본인임을 보증한다 */
export const policeVouches = (police: PoliceReply): boolean => police.inPerson && police.idChecked;

/* ───────── 그 시각에 편집실에 있던 사람 ───────── */

export interface Knowledge {
  evidence: readonly string[];
  facts?: readonly string[];
}

/**
 * from~to 내내 편집실에 있었는가. 지문이 등록된 사람은 지문 기록으로, 지문이 없는 강도희는 방문증으로 본다.
 * true 있었다 · false 없었다 · null 가진 기록으로는 모른다
 */
export function inEditRoom(who: Named, span: Span, known: Knowledge, data: CaseData3 = CASE3): boolean | null {
  if (!known.evidence.includes(E3.door)) return null;
  const mine = data.door.find((line) => line.who === who);
  if (mine) return covers(mine.spans, span.from, span.to);
  const passIn = data.door.some((line) => line.who === null && covers(line.spans, span.from, span.to));
  if (!passIn) return false;
  if (!known.evidence.includes(E3.lobby)) return null;
  return data.lobby.some((line) => line.who === who && line.pass === PASS && covers(line.spans, span.from, span.to));
}

/** 그 시간 내내 편집실에 있던 사람들 (모르는 사람은 빼고) */
export const peopleInEditRoom = (span: Span, known: Knowledge, data: CaseData3 = CASE3): Named[] => NAMED.filter((who) => inEditRoom(who, span, known, data) === true);

/* ───────── 그날의 타임라인: 누가 했는가 ───────── */

export const NOBODY = "none";
export const ACTORS = [SEORIN, SANGMIN, GAEUL, DOHEE, NOBODY] as const;
export type Actor = (typeof ACTORS)[number];

export interface DayRow {
  id: string;
  /** 화면에 적는 때 */
  time: string;
  /**
   * 가진 증거로 그 사람이 이 일을 한 사람일 수 없으면 그 까닭을, 지울 수 없으면 null 을 돌려준다.
   * 까닭은 그 사람이 왜 아닌지만 말한다(누가 맞는지는 말하지 않는다).
   */
  exclude(actor: Actor, known: Knowledge, data: CaseData4): string | null;
}

const at = (clock: Clock): Span => ({ from: clock, to: clock });
const viewing = ACCESS.find((s) => s.password === "new")!;
const passLine = CASE3.door.find((line) => line.who === null)!;

/** 편집실 PC 에서 한 일: 그 시간 내내 편집실에 있던 사람만 할 수 있다 (편집 프로그램은 그 PC 에서만 열린다) */
function awayFromEditPC(actor: Named, span: Span, known: Knowledge, data: CaseData4, what: string): string | null {
  if (inEditRoom(actor, span, known, data.three) !== false) return null;
  const when = span.from === span.to ? span.from : `${span.from}~${span.to}`;
  return `${topic(actor)} ${when}에 편집실에 없었습니다. ${what}`;
}

export const DAY: DayRow[] = [
  {
    // 은퇴를 알리는 원본 영상을 내보냈다
    id: "r-export",
    time: ORIGINAL.createdAt,
    exclude(actor, known, data) {
      if (actor === NOBODY) return known.evidence.includes(E2.original) ? `원본 파일은 ${ORIGINAL.createdAt}에 만들어졌습니다. 누군가 내보낸 것입니다.` : null;
      return awayFromEditPC(actor, at(ORIGINAL.createdAt), known, data, "편집 프로그램은 편집실 PC에서만 열립니다.");
    },
  },
  {
    // 방송을 그만두기로 하고 스스로 건물을 떠났다
    id: "r-leave",
    time: POLICE.leftAround,
    exclude(actor, known, data) {
      if (!known.evidence.includes(E4.police) || !policeVouches(data.police) || data.police.will !== "own") return null;
      return actor === SEORIN ? null : `경찰의 회신에 적힌 본인의 말은 다릅니다. ${data.police.leftAround}에 방송을 그만두고 스스로 건물을 나온 사람이 따로 있습니다.`;
    },
  },
  {
    // 방문증으로 편집실에 들어와 짐을 챙겼다
    id: "r-visit",
    time: passLine.spans[0].from,
    exclude(actor, known, data) {
      const span = data.three.door.find((line) => line.who === null)?.spans[0];
      if (!span) return null;
      if (actor === NOBODY) return known.evidence.includes(E3.door) ? `${PASS}이 ${span.from}에 편집실 문에 찍혔습니다. 누군가 들어온 것입니다.` : null;
      if (!known.evidence.includes(E3.lobby)) return null;
      const holder = data.three.lobby.find((line) => line.pass === PASS && covers(line.spans, span.from, span.to))?.who ?? OUTSIDER;
      return holder === actor ? null : `${topic(actor)} 그 시간에 ${PASS}을 받아 간 사람이 아닙니다. 방문 기록에 받아 간 사람이 적혀 있습니다.`;
    },
  },
  {
    // 편집자 계정으로 제목과 자막을 고쳤다
    id: "r-modify",
    time: modifyingSession().from,
    exclude(actor, known, data) {
      if (actor === NOBODY) return known.evidence.includes(E2.editlog) ? "수정 작업 기록이 남아 있습니다. 누군가 고친 것입니다." : null;
      if (suspectsLeft(known, data.three).includes(actor)) return null;
      const session = modifyingSession(data.three);
      const away = awayFromEditPC(actor, session, known, data, "편집 프로그램은 편집실 PC에서만 열립니다.");
      return away ?? `${NAME[actor]}에게는 관리자 권한이 없습니다. 그 접속은 임시 비밀번호로 들어왔고, 임시 비밀번호는 재설정한 관리자만 봅니다.`;
    },
  },
  {
    // 고친 영상을 예약 등록했다
    id: "r-register",
    time: SCHEDULED.at,
    exclude(actor, known, data) {
      if (actor === NOBODY) return known.evidence.includes(E1.file) ? `${data.scheduled.at}에 예약이 등록됐습니다. 누군가 등록한 것입니다.` : null;
      // 공용 계정은 여러 사람이 쓴다. 등록에 쓰인 장치를 알아야 사람을 좁힐 수 있다.
      if (!known.evidence.includes(E4.schedule) || !data.scheduled.onEditPC) return null;
      return awayFromEditPC(actor, at(data.scheduled.at), known, data, "예약은 편집실 PC에서 등록됐습니다.");
    },
  },
  {
    // 작업 기록을 열어 영상이 고쳐진 것을 보았다
    id: "r-view",
    time: viewing.from,
    exclude(actor, known, data) {
      const session = data.three.access.find((x) => x.password === "new") ?? viewing;
      if (actor === NOBODY) return known.evidence.includes(E3.access) ? `${session.from}에 편집자 계정으로 작업 기록을 연 접속이 있습니다.` : null;
      return awayFromEditPC(actor, session, known, data, "작업 기록은 편집실 PC에서만 열립니다.");
    },
  },
  {
    // 카메라 앞에 앉아 방송을 했다
    id: "r-air",
    time: BROADCAST.start,
    exclude(actor, known) {
      // 제1장의 결론: 마지막 방송은 예약 영상의 재생이었다. 그 시각에 카메라 앞에 있던 사람은 없다.
      const scheduled = judge1("scheduled", { evidence: known.evidence, facts: known.facts ?? [] }) === "established";
      if (!scheduled) return null;
      return actor === NOBODY ? null : `${BROADCAST.start}의 방송은 미리 만든 영상의 예약 재생이었습니다. 그 시각에 카메라 앞에 앉아 있던 사람은 없습니다.`;
    },
  },
];

/** 그 줄에 아직 지워지지 않은 사람들 */
export function candidates(rowId: string, known: Knowledge, data: CaseData4 = CASE4): Actor[] {
  const row = DAY.find((x) => x.id === rowId);
  return row ? ACTORS.filter((actor) => row.exclude(actor, known, data) === null) : [];
}

/** 가진 증거와 어긋나지 않는 배정 전부 (일곱 줄 × 다섯 가지 = 5^7 가지를 모두 본다) */
export function assignments(known: Knowledge, data: CaseData4 = CASE4): Record<string, Actor>[] {
  const allowed = DAY.map((row) => new Set(candidates(row.id, known, data)));
  const out: Record<string, Actor>[] = [];
  const total = ACTORS.length ** DAY.length;
  for (let code = 0; code < total; code++) {
    const picked: Actor[] = [];
    let rest = code;
    for (let i = 0; i < DAY.length; i++) {
      picked.push(ACTORS[rest % ACTORS.length]);
      rest = Math.floor(rest / ACTORS.length);
    }
    if (picked.every((actor, i) => allowed[i].has(actor))) out.push(Object.fromEntries(DAY.map((row, i) => [row.id, picked[i]])));
  }
  return out;
}

export function judgeAssign4(assigned: Readonly<Record<string, string>>, progress: Pick<ChapterProgress, "evidence" | "facts">, data: CaseData4 = CASE4): { correct: boolean; wrong: string[]; reason: string } {
  const known: Knowledge = { evidence: [...CARRIED4, ...progress.evidence], facts: progress.facts };
  const wrong: string[] = [];
  let reason = "";
  for (const row of DAY) {
    const actor = assigned[row.id] as Actor | undefined;
    const why = actor && ACTORS.includes(actor) ? row.exclude(actor, known, data) : "이 줄이 비어 있습니다.";
    // 가진 기록으로 한 사람이 남지 않는 줄은, 무엇을 넣어도 확정된 것이 아니다
    const open = why === null && candidates(row.id, known, data).length !== 1 ? "이 줄은 가진 기록만으로는 한 사람으로 정해지지 않습니다." : null;
    if (why === null && open === null) continue;
    wrong.push(row.id);
    if (!reason) reason = (why ?? open)!;
  }
  return { correct: wrong.length === 0, wrong, reason };
}

/* ───────── 증거 연결: 맞대어 나오는 사실 ───────── */

const airStart: Stamp = { day: 0, clock: BROADCAST.start };
const airEnd: Stamp = { day: 0, clock: BROADCAST.end };

/** 한가을이 수정을 안 때부터 방송까지의 시간(분) */
export const minutesBeforeAir = (): number => stampMinutes(airStart) - stampMinutes({ day: 0, clock: RESTATED[GAEUL].sawLogAt });

/** 두 항목을 이었을 때 그 사실이 실제로 나오는가 (잇기 표가 자료와 맞는지 보는 데 쓴다) */
export const LINK_HOLDS4: Record<string, (data: CaseData4) => boolean> = {
  // 한가을의 말("작업 기록을 열어 봤다")과 계정 접근 기록: 본인 인증으로 재설정한 뒤의 접속이고, 방송보다 먼저다
  [F4.gaeulKnew]: ({ three }) => {
    const session = three.access.find((s) => s.password === "new");
    const own = three.resets.some((reset) => reset.by === "owner" && session !== undefined && reset.at < session.from);
    return !!session && own && session.from === RESTATED[GAEUL].sawLogAt && inEditRoom(GAEUL, session, { evidence: [E3.door] }, three) === true && toMinutes(session.from) < toMinutes(BROADCAST.start);
  },
  // 강도희의 말("있는 곳은 말하지 않겠다")과 경찰의 회신: 소재를 밝히지 않는 것은 윤서린 본인의 요청이다
  [F4.doheeHid]: ({ police }) => policeVouches(police) && police.whereabouts === "withheld" && RESTATED[DOHEE].knowsWhere && !RESTATED[DOHEE].tells,
  // 예약 등록의 장치와 편집실 출입 기록: 그 시각 편집실에 있던 사람은 한 명이다
  [F4.registrar]: ({ scheduled, three }) => {
    const present = peopleInEditRoom(at(scheduled.at), { evidence: [E3.door, E3.lobby] }, three);
    return scheduled.onEditPC && present.length === 1 && present[0] === SANGMIN;
  },
  // 소문("방송 중에 죽었다")과 경찰의 회신: 방송이 끝난 뒤에 본인이 확인됐다
  [F4.rumorFalse]: ({ police }) => policeVouches(police) && police.alive && stampMinutes(police.at) > stampMinutes(airEnd),
};

/* ───────── 가능한 경우: 윤서린에게 무슨 일이 있었나 ───────── */

/** 아직 모르는 것들의 한 가지 경우 */
export interface World4 {
  /** 마지막 방송이 끝난 뒤에도 살아 있는가 */
  alive: boolean;
  /** 방송을 그만두고 떠난 것이 본인의 뜻인가 */
  will: "own" | "forced";
  abroad: boolean;
  /** 문자를 보낸 사람 */
  textBy: "self" | "other";
  /** 계정에 접속한 사람 */
  loginBy: "self" | "other";
  /** 강도희의 두 번째 진술이 참인가 */
  doheeHonest: boolean;
  /** 영상을 고쳐 사망 소동을 만든 사람이 윤서린 본인인가 */
  selfMade: boolean;
}

/** 가진 증거와 어긋나지 않는 경우를 모두 돌려준다 */
export function worlds4(known: Knowledge, data: CaseData4 = CASE4): World4[] {
  const has = (id: string) => known.evidence.includes(id);
  const modifiers = suspectsLeft(known, data.three);
  const out: World4[] = [];
  for (const alive of [true, false])
    for (const will of ["own", "forced"] as const)
      for (const abroad of [true, false])
        for (const textBy of ["self", "other"] as const)
          for (const loginBy of ["self", "other"] as const)
            for (const doheeHonest of [true, false])
              for (const selfMade of [true, false]) {
                // 방송 뒤에 살아 있지 않았다면, 그 뒤의 문자와 접속은 본인이 한 것이 아니다. (떠난 뜻은 따질 것이 없다)
                if (!alive && (textBy === "self" || loginBy === "self" || will !== "own")) continue;
                // 제3장: 영상을 고친 사람. 윤서린이 지워졌으면 본인이 꾸민 일이 아니고, 윤서린만 남았으면 본인이 꾸민 일이다.
                if (selfMade && !modifiers.includes(SEORIN)) continue;
                if (!selfMade && modifiers.length === 1 && modifiers[0] === SEORIN) continue;
                // 계정 접속 기록, 문자: 누가 남겼는지를 말해 주지 않는다. 비밀번호를 아는 사람, 전화기를 가진 사람이면 남길 수 있다.
                // (그래서 이 둘은 어떤 경우도 지우지 못한다)
                // 강도희의 두 번째 진술: 참이라면 윤서린은 무사하고 스스로 떠났다. 진술은 거짓일 수 있다.
                if (has(E4.restated) && doheeHonest && !(alive && will === "own")) continue;
                // 경찰의 안전 확인 회신: 경찰관이 직접 만나 신분증과 지문으로 본인임을 대조했다. 이것만이 본인을 보증한다.
                if (has(E4.police) && policeVouches(data.police) && (alive !== data.police.alive || will !== data.police.will)) continue;
                out.push({ alive, will, abroad, textBy, loginBy, doheeHonest, selfMade });
              }
  return out;
}

/** 최종 추론의 선택지와 "밝히지 않는 것"이 말하는 것 */
export const CLAIMS4: Record<string, (w: World4) => boolean> = {
  dead: (w) => !w.alive,
  taken: (w) => w.alive && w.will === "forced",
  hoax: (w) => w.selfMade,
  left: (w) => w.alive && w.will === "own",
  abroad: (w) => w.abroad,
};

export type Verdict = "established" | "open" | "refuted";

export function judge4(claim: string, known: Knowledge, data: CaseData4 = CASE4): Verdict {
  const left = worlds4(known, data);
  const holds = left.filter(CLAIMS4[claim]);
  if (left.length > 0 && holds.length === left.length) return "established";
  return holds.length === 0 ? "refuted" : "open";
}

/**
 * 최종 추론: 결론과 근거 하나를 함께 본다.
 *  - correct     : 앞 장의 증거 + 내놓은 근거만으로 그 결론이 확정된다
 *  - weak        : 가진 증거 전체로는 확정되지만, 내놓은 근거로는 확정되지 않는다
 *  - unsupported : 가진 증거 전체로도 확정되지 않는(또는 지워지는) 결론이다
 */
export function judgeDeduction4(claim: string, basis: string | readonly string[], progress: Pick<ChapterProgress, "evidence">, data: CaseData4 = CASE4): "correct" | "weak" | "unsupported" {
  if (!CLAIMS4[claim]) return "unsupported";
  const bases = typeof basis === "string" ? [basis] : [...basis];
  if (judge4(claim, { evidence: [...CARRIED4, ...progress.evidence] }, data) !== "established") return "unsupported";
  if (!bases.every((id) => progress.evidence.includes(id))) return "weak";
  return judge4(claim, { evidence: [...CARRIED4, ...bases] }, data) === "established" ? "correct" : "weak";
}

/* ───────── 힌트와 해설이 기대는 사실 ───────── */

const GIVEN4 = [E4.login, E4.text, E4.police, E4.schedule, E4.restated];
const ALL4: Knowledge = { evidence: [...CARRIED4, ...GIVEN4] };
const only = (rowId: string, actor: Actor) => {
  const left = candidates(rowId, ALL4);
  return left.length === 1 && left[0] === actor;
};

export const CHECKS4: Record<string, () => boolean> = {
  /** 한가을의 말은 접근 기록과 맞고, 그 접속은 방송보다 먼저다 */
  gaeulKnewBeforeAir: () => LINK_HOLDS4[F4.gaeulKnew](CASE4) && minutesBeforeAir() > 0,
  /** 강도희가 말하지 않는 것은 경찰의 회신에서도 본인 요청으로 비공개다 */
  doheeHidWhatSeorinAsked: () => LINK_HOLDS4[F4.doheeHid](CASE4),
  /** 예약 등록 시각에 편집실에는 오상민뿐이었다 */
  registrarAlone: () => LINK_HOLDS4[F4.registrar](CASE4) && only("r-register", SANGMIN),
  /** 경찰의 확인은 방송이 끝난 뒤다 */
  rumorRefuted: () => LINK_HOLDS4[F4.rumorFalse](CASE4) && judge4("dead", ALL4) === "refuted",
  /** 원본을 내보낼 때와 작업 기록을 열 때 편집실에 있던 사람은 한가을뿐이다 */
  gaeulAtExportAndView: () => only("r-export", GAEUL) && only("r-view", GAEUL),
  /** 영상을 고친 사람은 오상민이다 */
  sangminModified: () => only("r-modify", SANGMIN),
  /** 방문증을 든 사람은 강도희다 */
  doheeVisited: () => only("r-visit", DOHEE),
  /** 스스로 떠난 사람은 윤서린이다 */
  seorinLeft: () => only("r-leave", SEORIN),
  /** 23:47 에 카메라 앞에 있던 사람은 없다 */
  nobodyOnCamera: () => only("r-air", NOBODY),
  /** 일곱 줄이 모두 한 사람으로 정해진다 */
  dayUnique: () => assignments(ALL4).length === 1,
  /** 경찰의 대면 확인만으로 "살아 있고 스스로 떠났다"가 확정된다 */
  policeEstablishes: () => judge4("left", { evidence: [...CARRIED4, E4.police] }) === "established",
  /** 접속 기록과 문자와 강도희의 말을 모두 합쳐도 확정되지 않는다 */
  signsDoNotEstablish: () => judge4("left", { evidence: [...CARRIED4, E4.login, E4.text, E4.restated] }) === "open",
  /** 사망 소동은 윤서린이 꾸민 것이 아니다 */
  notSelfMade: () => judge4("hoax", ALL4) === "refuted",
  /** 지금 있는 곳은 확정되지 않는다 */
  whereaboutsOpen: () => judge4("abroad", ALL4) === "open" && POLICE.whereabouts === "withheld",
  /** 한가을은 방송 전에 누구에게도 알리지 않았다 (본인의 두 번째 진술) */
  gaeulStayedSilent: () => RESTATED[GAEUL].told === false,
  /** 두 번의 재설정 가운데 본인 인증은 뒤의 것이다 */
  ownerResetLater: () => RESETS.filter((reset) => reset.by === "owner").every((reset) => reset.at > modifyingSession().to),
};
