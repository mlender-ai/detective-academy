/**
 * CASE D-001 · BJ 토끼의 마지막 방송 (D급의 첫 사건). 전 4장.
 *  제1장 「마지막 7분」     마지막 방송은 실제 생방송이었는가           → 미리 만든 영상의 예약 송출이었다
 *  제2장 「사라진 원본」    공개된 방송은 원래 만든 영상과 같은가       → 은퇴 영상이 방송 전에 글자만 바뀌어 나갔다 (ch2.ts)
 *  제3장 「세 사람의 비밀」 영상을 고친 사람은 누구인가                 → 매니저 오상민 (ch3.ts)
 *  제4장 「토끼의 정체」    윤서린에게 무슨 일이 있었는가               → 스스로 떠났고, 살아 있으며 무사하다 (ch4.ts)
 * 장마다 그 장의 증거로 확정되는 것만 확정한다. 사건의 진상과 장면별 조작은 docs/story/d001.md.
 *
 * 제1장이 묻는 것은 하나다: 마지막 방송은 실시간 카메라 방송이었는가, 미리 준비된 영상이 나간 것인가.
 * 토끼의 생사, 지금 있는 곳, 영상을 예약한 사람은 이 장의 증거로 정해지지 않는다(logic.ts 가 그것까지 검증한다).
 * 방송 플랫폼 "루나캐스트"와 그 규칙은 지어낸 것이다. 등장인물은 지어낸 인물이다.
 */
import type { StoryCase, StoryChapter } from "../../engine/storyTypes";
import { D001_CH2 } from "./ch2";
import { D001_CH3 } from "./ch3";
import { D001_CH4 } from "./ch4";
import { BROADCAST, E, F, MODE_TEXT, RULES, SESSIONS, SOURCE_FILE, lengthText } from "./logic";
import { CAST, DOHEE } from "./people";

const sessionB = SESSIONS.find((s) => s.id === SOURCE_FILE.session)!;
const sessionC = SESSIONS.find((s) => s.status === "failed")!;
const span = (s: { start: string; end: string }) => `${s.start} → ${s.end}`;

export const D001_CH1: StoryChapter = {
  id: "ch1",
  no: 1,
  title: "마지막 7분",
  minutes: "5~8분",
  intro: [
    "2026년 11월 21일.",
    "인터넷 방송인 BJ 토끼가 마지막 방송을 남기고 사라졌다.",
    "사람들은 그녀가 죽었다고 말한다.",
    "그러나 사망했다는 공식 확인은 없다.",
    "탐정학원에 마지막 방송의 진위 확인 의뢰가 도착했다.",
  ],
  evidence: [
    {
      id: E.broadcast,
      no: "증거 01",
      title: "마지막 방송 기록",
      lines: [
        { label: "방송 날짜", value: "2026년 11월 21일" },
        { label: "시작", value: BROADCAST.start },
        { label: "종료", value: BROADCAST.end },
        { label: "영상 길이", value: lengthText(BROADCAST.lengthSec) },
        { label: "화면 표시", value: BROADCAST.label },
      ],
    },
    {
      id: E.session,
      no: "증거 02",
      title: `서버 전송 기록 ${sessionB.id}`,
      lines: [
        { label: "시작", value: sessionB.start },
        { label: "종료", value: sessionB.end },
        { label: "전송 방식", value: MODE_TEXT[sessionB.mode] },
        { label: "상태", value: "완료" },
      ],
    },
    {
      id: E.file,
      no: "증거 03",
      title: "원본 파일 정보",
      lines: [
        { label: "파일명", value: SOURCE_FILE.name },
        { label: "등록 시각", value: SOURCE_FILE.registeredAt },
        { label: "영상 길이", value: lengthText(SOURCE_FILE.lengthSec) },
        { label: "전송 유형", value: "예약 파일 재생" },
      ],
      note: `전송 ${SOURCE_FILE.session}에 연결된 파일이다.`,
    },
    {
      id: E.account,
      no: "증거 04",
      title: "방송 운영 계정 접근 기록",
      lines: [
        { label: "예약 등록", value: `${SOURCE_FILE.registeredAt} · ${SOURCE_FILE.name}` },
        { label: "등록한 계정", value: "운영팀 공용 계정" },
        { label: "방송인 계정", value: "등록 기록 없음" },
      ],
      note: "등록에 쓰인 계정을 알 뿐이다. 그 계정으로 누가 등록했는지는 아직 모른다.",
    },
  ],
  scenes: [
    {
      kind: "timeline",
      id: "broadcast",
      step: "방송",
      title: "마지막 방송",
      enter: "방송은 정확히 7분 만에 종료되었다. 화면에는 LIVE라는 표시가 남아 있다.",
      frames: [
        {
          id: "t0015",
          at: 15,
          clock: "23:47",
          caption: "방송 시작. 토끼 가면을 쓴 사람이 카메라 앞에 앉아 있다.",
          chat: [
            ["달밤손님", "제목 뭐예요 이거"],
            ["monk07", "장난이죠?"],
            ["첫눈", "채팅 좀 읽어 줘요"],
          ],
        },
        {
          id: "t0310",
          at: 190,
          clock: "23:50",
          caption: "토끼가 자리에서 일어나 화면 밖으로 걸어 나간다.",
          chat: [
            ["첫눈", "어디 가요?"],
            ["달밤손님", "아까부터 채팅 안 읽네"],
            ["토끼굴", "돌아와요"],
          ],
        },
        {
          id: "t0640",
          at: 400,
          clock: "23:53",
          caption: "빈 의자. 가면만 등받이에 걸려 있다.",
          chat: [
            ["monk07", "아직도 안 와?"],
            ["첫눈", "의자만 3분째"],
            ["달밤손님", "이거 진짜야?"],
          ],
        },
        {
          id: "t0700",
          at: 420,
          clock: "23:54",
          caption: "방송이 끝났다. 화면에는 종료 알림만 남았다.",
          chat: [
            ["토끼굴", "끝났어?"],
            ["monk07", "무슨 일 난 거 아냐"],
            ["첫눈", "..."],
          ],
        },
      ],
      points: [
        {
          id: "live",
          label: "LIVE 표시",
          frames: ["t0015", "t0310", "t0640"],
          area: [2, 4, 30, 24],
          line: "화면 구석에 LIVE 표시가 붙어 있다. 이 표시만으로 실시간이었다고 확신할 수 있을까?",
          note: "방송 내내 화면에 LIVE 표시가 붙어 있었다.",
          required: true,
        },
        {
          id: "start",
          label: "화면의 시계",
          frames: ["t0015"],
          area: [68, 4, 30, 24],
          line: `화면의 시계는 ${BROADCAST.start}. 방송이 시작된 시각이다.`,
          note: `방송 시작 ${BROADCAST.start}.`,
          required: true,
        },
        {
          id: "end",
          label: "종료 알림",
          frames: ["t0700"],
          area: [17, 30, 66, 42],
          line: `「방송이 종료되었습니다 · ${BROADCAST.end}」. 시작한 지 꼭 7분 만이다.`,
          note: `방송 종료 ${BROADCAST.end}.`,
          required: true,
        },
        {
          id: "length",
          label: "영상 길이",
          area: [0, 0, 0, 0],
          line: `영상의 길이는 ${lengthText(BROADCAST.lengthSec)}. 1초도 넘치거나 모자라지 않는다.`,
          note: `영상 길이 ${lengthText(BROADCAST.lengthSec)}.`,
          required: true,
        },
        {
          id: "mask",
          label: "토끼 가면",
          frames: ["t0015"],
          area: [36, 12, 28, 46],
          line: "토끼 가면. 얼굴은 보이지 않는다. 가면 뒤의 사람이 누구인지는 화면만으로 알 수 없다.",
          note: "가면 때문에 얼굴은 한 번도 보이지 않는다.",
          required: false,
        },
        {
          id: "title",
          label: "방송 제목",
          frames: ["t0015", "t0310", "t0640"],
          area: [2, 72, 74, 24],
          line: `방송 제목은 「${BROADCAST.title}」. 소문은 이 한 줄에서 시작됐다.`,
          note: "제목이 자극적일 뿐, 무슨 일이 있었는지는 화면에 없다.",
          required: false,
        },
        {
          id: "chair",
          label: "빈 의자",
          frames: ["t0640"],
          area: [33, 22, 34, 48],
          line: "의자에는 아무도 없다. 가면만 걸려 있다. 토끼가 어디로 갔는지는 화면에 없다.",
          note: "06:40, 의자가 비어 있다. 토끼의 행방은 화면에 없다.",
          required: false,
        },
        {
          id: "chat",
          label: "채팅창",
          area: [0, 0, 0, 0],
          line: "채팅이 쉬지 않고 올라온다. 토끼는 방송 내내 채팅에 한 번도 답하지 않았다.",
          note: "토끼는 채팅에 한 번도 답하지 않았다.",
          required: false,
        },
      ],
      grants: E.broadcast,
      done: "방송 기록을 정리했다. 이 기록만으로 방송이 실시간이었다고 확신할 수 있을까?",
    },
    {
      kind: "records",
      id: "log",
      step: "전송 기록",
      title: "수상한 전송 기록",
      enter: "세 개의 전송 기록이 남아 있다. 마지막 방송과 일치하는 기록은 무엇인가?",
      question: "마지막 방송을 실어 보낸 전송 기록은 어느 것인가?",
      grants: [E.session, E.file],
      done: `전송 ${sessionB.id}에는 원본 파일이 연결되어 있다. 두 기록을 책상에 올려놓고 맞대어 보자.`,
    },
    {
      kind: "link",
      id: "analysis",
      step: "분석",
      title: "증거 분석",
      enter: "두 기록을 나란히 놓았다. 한쪽에서 하나, 다른 쪽에서 하나를 골라 맞대어 본다.",
      docs: [
        {
          id: "docA",
          title: "마지막 방송 기록",
          items: [
            { id: "a-time", label: "방송 시각", value: span(BROADCAST) },
            { id: "a-live", label: "화면 표시", value: BROADCAST.label },
            { id: "a-length", label: "영상 길이", value: lengthText(BROADCAST.lengthSec) },
            { id: "a-title", label: "방송 제목", value: "오늘 밤, 토끼는…" },
          ],
        },
        {
          id: "docB",
          title: "서버 기록",
          items: [
            { id: "b-file", label: `전송 ${sessionB.id}의 파일`, value: `예약 재생 · ${lengthText(SOURCE_FILE.lengthSec)}` },
            { id: "b-fail", label: `전송 ${sessionC.id} · 연결 실패`, value: span(sessionC) },
            { id: "b-time", label: `전송 ${sessionB.id} · 완료`, value: span(sessionB) },
            { id: "b-rule", label: "플랫폼 규칙", value: "LIVE는 예약에도" },
          ],
        },
      ],
      links: [
        { a: "a-time", b: "b-time", fact: F.sameTime },
        { a: "a-length", b: "b-file", fact: F.scheduled },
        { a: "a-live", b: "b-rule", fact: F.liveLabel },
      ],
      facts: [
        { id: F.sameTime, no: "사실 01", text: `시작·종료 시각이 같다. 마지막 방송은 전송 ${sessionB.id}다.` },
        { id: F.scheduled, no: "사실 02", text: `전송 ${sessionB.id}는 ${SOURCE_FILE.registeredAt}에 등록된 7분짜리 파일의 예약 재생이었다.` },
        { id: F.liveLabel, no: "사실 03", text: "LIVE 표시만으로는 실시간 촬영인지 알 수 없다." },
      ],
      misses: {
        "a-time|b-fail": `전송 ${sessionC.id}는 ${sessionC.end}에 끊겼다. ${BROADCAST.end}까지 이어진 방송이 아니다.`,
        "a-time|b-file": "시각과 파일. 먼저 어느 전송이 이 방송인지부터 정해야 한다.",
        "a-time|b-rule": "이 규칙은 LIVE 표시에 대한 것이다. 시각과는 맞대어 볼 것이 없다.",
        "a-length|b-time": "7분, 길이는 맞는다. 같은 방송인지는 시각을 맞대어 봐야 안다.",
        "a-length|b-fail": `전송 ${sessionC.id}는 1분 만에 끊겼다. 7분짜리 방송이 아니다.`,
        "a-live|b-file": "LIVE 표시가 무엇을 뜻하는지는 플랫폼의 규칙이 말해 준다.",
        "a-live|b-time": "LIVE 표시가 무엇을 뜻하는지는 플랫폼의 규칙이 말해 준다.",
        "a-title|*": "제목은 방송을 어떻게 내보냈는지 말해 주지 않는다.",
      },
      done: "세 가지 사실이 모였다. 이제 결론을 내릴 차례다.",
    },
    {
      kind: "deduce",
      id: "deduction",
      step: "추론",
      title: "최종 추론",
      enter: "모두가 보았던 마지막 방송. 그 방송에서 확인된 사실은 무엇인가?",
      question: "BJ 토끼의 마지막 방송에서 확인된 사실은 무엇인가?",
      choices: [
        { id: "dead", text: "BJ 토끼가 방송 도중 사망했다.", unsupported: "지금 가진 기록에는 토끼의 생사를 말해 주는 것이 없습니다." },
        { id: "scheduled", text: "마지막 방송은 미리 제작된 영상의 예약 송출이었다.", unsupported: "아직 이 결론을 받칠 기록이 모이지 않았습니다." },
        { id: "manager", text: "매니저가 방송을 조작했다.", unsupported: "누가 영상을 예약했는지 말해 주는 기록은 아직 없습니다." },
        { id: "abroad", text: "BJ 토끼는 현재 해외에 있다.", unsupported: "토끼가 지금 어디에 있는지 말해 주는 기록은 없습니다." },
      ],
      basis: [E.broadcast, E.session, E.file],
      weak: {
        [E.broadcast]: "방송 화면의 기록은 그 방송을 어떤 방식으로 내보냈는지 말해 주지 않습니다. LIVE 표시는 어떤 방식에도 붙습니다. 전송 방식을 적은 기록을 근거로 드세요.",
      },
    },
  ],
  hints: [
    "방송이 언제 시작해 언제 끝났는지부터 적어 두세요. 그 두 시각을 전송 기록 세 줄과 하나씩 맞대어 보면, 끝까지 이어진 기록은 하나뿐입니다.",
    "정상 종료된 방송은 시각이 전송 기록과 같아야 합니다. 그 기록의 '전송 방식' 칸을 읽으세요. LIVE 표시는 어떤 방식에도 붙으므로 근거가 되지 못합니다.",
  ],
  reward: 120,
  ending: {
    lines: ["그날 밤 방송은 생방송이 아니었다.", "그렇다면 이 영상을 예약한 사람은 누구인가?"],
    evidence: E.account,
    open: [
      { claim: "dead", text: "BJ 토끼는 살아 있는가" },
      { claim: "abroad", text: "토끼는 지금 어디에 있는가" },
      { claim: "manager", text: "이 영상을 예약한 사람은 누구인가" },
    ],
    next: { no: 2, title: "사라진 원본" },
  },
};

export const D001: StoryCase = {
  id: "d001",
  code: "CASE D-001",
  title: "BJ 토끼의 마지막 방송",
  rank: "D",
  genre: "인터넷 방송 · 실종 의혹 · 정보 조작",
  totalMinutes: "20~30분",
  brief: "구독자 38만의 방송인이 「오늘 밤, 토끼는 죽습니다」라는 방송을 7분 만에 끝내고 사라졌다. 마지막 방송이 진짜 생방송이었는지 확인해 달라는 의뢰.",
  chapters: [D001_CH1, D001_CH2, D001_CH3, D001_CH4],
  plannedChapters: 4,
  // 사건 해결 보상: 초기 실험값. D→C 승급 시험의 합격 보상과 같은 값으로 두었다.
  reward: 100,
  cast: CAST,
  client: DOHEE,
};

/** 플랫폼의 이름과 규칙 (지어낸 것) */
export const PLATFORM = { name: "루나캐스트", code: "LUNACAST", channel: "BJ 토끼", rules: RULES.text };
