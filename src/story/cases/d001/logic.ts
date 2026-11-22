/**
 * CASE D-001 제1장의 추론 검증.
 *
 * 이야기에서 그럴듯한 결론과, 지금 가진 증거로 "확정되는" 결론은 다르다. 그래서 정답을 글자로 비교하지 않는다.
 * 아직 모르는 것(어느 전송이 마지막 방송이었나, 어떤 방식이었나, 토끼의 생사, 누가 예약했나, 어디에 있나)을
 * 가능한 경우로 모두 펼쳐 놓고, 가진 증거와 플랫폼 규칙에 어긋나는 경우를 지운다.
 * 남은 모든 경우에서 참인 것만 "확정"이다.
 */
import type { BroadcastRecord, ChapterProgress, PlatformRules, SourceFile, TransmitMode, TransmitSession } from "../../engine/storyTypes";

/* ───────── 사건의 사실 (화면에 주어지는 자료) ───────── */

export const BROADCAST: BroadcastRecord = {
  date: "2026-11-21",
  start: "23:47",
  end: "23:54",
  lengthSec: 420,
  label: "LIVE",
  title: "오늘 밤, 토끼는 죽습니다.",
};

export const SESSIONS: TransmitSession[] = [
  { id: "A", start: "21:47", end: "21:54", mode: "camera", status: "done" },
  { id: "B", start: "23:47", end: "23:54", mode: "scheduled", status: "done" },
  { id: "C", start: "23:47", end: "23:48", mode: "camera", status: "failed" },
];

export const RULES: PlatformRules = {
  doneMatchesSession: true,
  liveLabelOn: ["camera", "scheduled"],
  failedNotAired: true,
  text: [
    "정상 종료된 방송의 시작·종료 시각은 그 전송 기록과 같다.",
    "LIVE 표시는 카메라 실시간에도, 예약 영상 재생에도 붙는다.",
    "연결에 실패한 전송은 시청자에게 나가지 않는다.",
  ],
};

export const SOURCE_FILE: SourceFile = {
  session: "B",
  name: "TORI_FINAL_07.mp4",
  registeredAt: "18:20",
  lengthSec: 420,
  type: "scheduled",
};

/** 증거와 사실의 이름표 */
export const E = { broadcast: "e01", session: "e02", file: "e03", account: "e04" } as const;
export const F = { sameTime: "f01", scheduled: "f02", liveLabel: "f03" } as const;

export const MODE_TEXT: Record<TransmitMode, string> = { camera: "카메라 실시간", scheduled: "예약 영상 재생" };

export const minutes = (clock: string): number => {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
};

export const lengthText = (sec: number): string => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

/* ───────── 기록 대조 ───────── */

/** 그 방송을 실어 보낸 전송일 수 있는 기록: 정상 종료됐고 시작·종료 시각이 같다 (플랫폼 규칙 1·3) */
export function matchingSessions(broadcast: BroadcastRecord, sessions: TransmitSession[], rules: PlatformRules): TransmitSession[] {
  return sessions.filter((s) => {
    if (rules.failedNotAired && s.status !== "done") return false;
    if (rules.doneMatchesSession && (s.start !== broadcast.start || s.end !== broadcast.end)) return false;
    return true;
  });
}

/** 그 기록이 마지막 방송이 아닌 까닭. 맞는 기록이면 null */
export function whyNotSession(broadcast: BroadcastRecord, session: TransmitSession, rules: PlatformRules): string | null {
  if (rules.doneMatchesSession && session.start !== broadcast.start) {
    return `전송 ${session.id}는 ${session.start}에 시작했습니다. 마지막 방송은 ${broadcast.start}에 시작했습니다.`;
  }
  if (rules.failedNotAired && session.status !== "done") {
    return `전송 ${session.id}는 ${session.end}에 연결이 끊겼습니다. 마지막 방송은 ${broadcast.end}까지 이어져 정상 종료됐습니다.`;
  }
  if (rules.doneMatchesSession && session.end !== broadcast.end) {
    return `전송 ${session.id}는 ${session.end}에 끝났습니다. 마지막 방송은 ${broadcast.end}에 끝났습니다.`;
  }
  return null;
}

/** 화면의 표시만 보고 알 수 있는 전송 방식들 */
export function modesAllowedByLabel(rules: PlatformRules, label: BroadcastRecord["label"]): TransmitMode[] {
  return label === "LIVE" ? rules.liveLabelOn : [];
}

/* ───────── 가능한 경우 ───────── */

const UPLOADERS = ["tokki", "manager", "staff", "outsider"] as const;

/** 아직 모르는 것들의 한 가지 경우 */
export interface World {
  /** 마지막 방송을 실어 보낸 전송 */
  carrier: string;
  /** 마지막 방송의 실제 전송 방식 */
  mode: TransmitMode;
  alive: boolean;
  /** 영상을 예약한 사람 */
  uploader: (typeof UPLOADERS)[number];
  abroad: boolean;
}

/** 플레이어가 가진 것 */
export interface Knowledge {
  evidence: readonly string[];
  facts: readonly string[];
}

export interface CaseData {
  broadcast: BroadcastRecord;
  sessions: TransmitSession[];
  rules: PlatformRules;
  file: SourceFile;
}

export const CASE_DATA: CaseData = { broadcast: BROADCAST, sessions: SESSIONS, rules: RULES, file: SOURCE_FILE };

/** 가진 증거·사실과 어긋나지 않는 경우를 모두 돌려준다 */
export function worlds(known: Knowledge, data: CaseData = CASE_DATA): World[] {
  const has = (id: string) => known.evidence.includes(id);
  const { broadcast, sessions, rules, file } = data;
  const out: World[] = [];
  for (const session of sessions)
    for (const mode of ["camera", "scheduled"] as TransmitMode[])
      for (const alive of [true, false])
        for (const uploader of UPLOADERS)
          for (const abroad of [true, false]) {
            const w: World = { carrier: session.id, mode, alive, uploader, abroad };
            // 방송 화면의 기록: LIVE 표시가 붙을 수 있는 방식이어야 한다
            if (has(E.broadcast) && !modesAllowedByLabel(rules, broadcast.label).includes(mode)) continue;
            // 서버 전송 기록: 방송을 실어 보낸 전송은 시각이 맞는 정상 종료 기록이고, 방식은 그 기록에 적힌 대로다
            if (has(E.broadcast) && has(E.session)) {
              if (!matchingSessions(broadcast, sessions, rules).some((s) => s.id === session.id)) continue;
              if (mode !== session.mode) continue;
            }
            // 원본 파일 정보: 그 전송이 실은 것은 예약 파일이다
            if (has(E.file) && session.id === file.session && mode !== file.type) continue;
            // 확정한 사실 "마지막 방송은 전송 B다"
            if (known.facts.includes(F.sameTime) && session.id !== file.session) continue;
            // 운영 계정 접근 기록: 방송인 개인 계정으로 등록한 것이 아니다. 공용 계정은 여러 사람이 쓴다.
            // (누가 등록했는지는 좁혀지지 않는다)
            out.push(w);
          }
  return out;
}

/** 최종 추론의 선택지가 말하는 것 */
export const CLAIMS: Record<string, (w: World) => boolean> = {
  dead: (w) => !w.alive,
  scheduled: (w) => w.mode === "scheduled",
  manager: (w) => w.uploader === "manager",
  abroad: (w) => w.abroad,
};

export type Verdict = "established" | "open" | "refuted";

/** 그 주장이 지금 가진 것으로 확정되는가 */
export function judge(claim: string, known: Knowledge, data: CaseData = CASE_DATA): Verdict {
  const all = worlds(known, data);
  const holds = all.filter(CLAIMS[claim]);
  if (all.length > 0 && holds.length === all.length) return "established";
  return holds.length === 0 ? "refuted" : "open";
}

/* ───────── 장면의 판정 ───────── */

export function judgeRecord(recordId: string, data: CaseData = CASE_DATA): { correct: boolean; reason: string } {
  const session = data.sessions.find((s) => s.id === recordId);
  if (!session) return { correct: false, reason: "그런 기록은 없습니다." };
  const why = whyNotSession(data.broadcast, session, data.rules);
  if (why) return { correct: false, reason: why };
  const unique = matchingSessions(data.broadcast, data.sessions, data.rules).length === 1;
  return {
    correct: unique,
    reason: unique
      ? `전송 ${session.id}는 ${session.start}에 시작해 ${session.end}에 정상 종료됐습니다. 마지막 방송과 시각이 같은 기록은 이것뿐입니다.`
      : "시각이 같은 기록이 둘 이상입니다.",
  };
}

/**
 * 최종 추론: 결론(주장)과 근거(증거 하나)를 함께 본다.
 *  - correct     : 근거와 이미 확정한 사실만으로 그 결론이 확정된다
 *  - weak        : 결론은 가진 증거 전체로는 확정되지만, 내놓은 근거로는 확정되지 않는다
 *  - unsupported : 가진 증거 전체로도 확정되지 않는 결론이다
 */
export function judgeDeduction(claim: string, basis: string, progress: Pick<ChapterProgress, "evidence" | "facts">, data: CaseData = CASE_DATA): "correct" | "weak" | "unsupported" {
  if (!CLAIMS[claim]) return "unsupported";
  const everything: Knowledge = { evidence: progress.evidence, facts: progress.facts };
  if (judge(claim, everything, data) !== "established") return "unsupported";
  if (!progress.evidence.includes(basis)) return "weak";
  // 근거 하나 + 방송 기록(무엇을 따지는지) + 플레이어가 확정해 둔 사실
  const withBasis: Knowledge = { evidence: [...new Set([E.broadcast, basis])].filter((id) => progress.evidence.includes(id)), facts: progress.facts };
  return judge(claim, withBasis, data) === "established" ? "correct" : "weak";
}

/** 두 문서의 항목을 이었을 때 그 사실이 실제로 나오는가 (잇기 표가 자료와 맞는지 보는 데 쓴다) */
export const LINK_HOLDS: Record<string, (data: CaseData) => boolean> = {
  [F.sameTime]: ({ broadcast, sessions, rules, file }) => {
    const match = matchingSessions(broadcast, sessions, rules);
    return match.length === 1 && match[0].id === file.session;
  },
  [F.scheduled]: ({ broadcast, sessions, file }) => {
    const session = sessions.find((s) => s.id === file.session);
    return !!session && session.mode === "scheduled" && file.type === "scheduled" && file.lengthSec === broadcast.lengthSec && minutes(file.registeredAt) < minutes(session.start);
  },
  [F.liveLabel]: ({ broadcast, rules }) => modesAllowedByLabel(rules, broadcast.label).length > 1,
};
