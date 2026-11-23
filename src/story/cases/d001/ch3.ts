/**
 * CASE D-001 제3장 「세 사람의 비밀」.
 * 핵심 조작은 "진술과 기록의 대조"다: 진술 하나와 기록 한 줄을 맞대어 모순을 찾고, 알리바이를 확인한다.
 * 세 사람 모두 저마다의 까닭으로 사실과 다른 말을 한다. 거짓말을 했다는 것으로는 고친 사람이 정해지지 않고,
 * 출입 기록과 작업 권한을 함께 놓아야 한 사람이 남는다(logic3.ts 가 전수 탐색으로 본다).
 *
 * 이 장이 확정하는 것은 "영상을 고친 사람은 매니저 오상민이다" 하나다. 윤서린의 생사와 행방은 열어 둔다.
 */
import type { RecordItem, StoryChapter, TestimonyRecord } from "../../engine/storyTypes";
import { RELEASED } from "./logic2";
import { ACCESS, ACCOUNT_RULES, DOOR, E3, LOBBY, PASS, PASSWORD_TEXT, PERMS, RESETS, modifyingSession } from "./logic3";
import { DOHEE, GAEUL, NAME, NAMED, SANGMIN, SEORIN, numJosa, type Span } from "./people";

const arrow = (spans: readonly Span[]) => spans.map((span) => `${span.from} → ${span.to}`).join(" / ");
const tilde = (spans: readonly Span[]) => spans.map((span) => `${span.from}~${span.to}`).join(", ");
const door = (who: string | null) => DOOR.find((line) => line.who === who)!;
const lobby = LOBBY.find((line) => line.who === DOHEE)!;
const session = modifyingSession();
const adminReset = RESETS.find((reset) => reset.by === "admin")!;
const ownerReset = RESETS.find((reset) => reset.by === "owner")!;
const sessionLine = (id: string) => {
  const s = ACCESS.find((x) => x.id === id)!;
  return `${s.from} → ${s.to} · ${PASSWORD_TEXT[s.password]}`;
};

/** 맞대어 볼 기록 줄. 이름표는 logic3.ts 의 recordClaims 와 같다. */
const records: TestimonyRecord[] = [
  ...DOOR.map((line) => ({
    id: line.who ? `door-${line.who}` : "door-pass",
    evidence: E3.door,
    label: line.who ? `${NAME[line.who]} · 지문` : PASS,
    value: line.spans.length > 0 ? arrow(line.spans) : "당일 기록 없음",
  })),
  { id: `lobby-${DOHEE}`, evidence: E3.lobby, label: `${NAME[DOHEE]} · 방문`, value: arrow(lobby.spans) },
  { id: "access", evidence: E3.access, label: `계정 접속 ${session.id}`, value: sessionLine(session.id) },
];

const sessionItems: RecordItem[] = ACCESS.map((s) => ({
  id: s.id,
  title: `접속 ${s.id}`,
  lines: [
    { label: "시작", value: s.from },
    { label: "종료", value: s.to },
    { label: "비밀번호", value: PASSWORD_TEXT[s.password] },
  ],
}));

export const D001_CH3: StoryChapter = {
  id: "ch3",
  no: 3,
  title: "세 사람의 비밀",
  minutes: "5~7분",
  intro: [
    "영상을 고친 기록은 편집자 계정에 남아 있다.",
    "그 계정의 비밀번호는 그날 오후에 재설정되었다.",
    `BJ 토끼, 본명 ${NAME[SEORIN]}. 여전히 연락이 닿지 않는다.`,
    `학원은 세 사람의 진술을 받았다. 매니저 ${NAME[SANGMIN]}, 편집자 ${NAME[GAEUL]}, 의뢰인 ${NAME[DOHEE]}.`,
    "누가 영상을 고쳤는가?",
  ],
  given: [E3.door, E3.access, E3.lobby],
  evidence: [
    {
      id: E3.door,
      no: "증거 10",
      title: "편집실 출입 기록",
      lines: DOOR.map((line) => ({
        label: line.who ? `${NAME[line.who]} · 지문` : PASS,
        value: line.spans.length > 0 ? arrow(line.spans) : "당일 기록 없음",
      })),
      note: "편집실 문은 등록된 지문이나 방문증으로만 열린다. 방문증을 누가 들었는지는 이 기록에 없다.",
    },
    {
      id: E3.access,
      no: "증거 11",
      title: "편집자 계정 접근 기록",
      lines: [
        { label: "접속 1", value: sessionLine("1") },
        { label: `재설정 ${adminReset.at}`, value: "관리자 권한" },
        { label: "접속 2", value: sessionLine("2") },
        { label: `재설정 ${ownerReset.at}`, value: "본인 인증" },
        { label: "접속 3", value: sessionLine("3") },
      ],
      note: "모든 접속은 편집실 PC에서 이뤄졌다. 편집 프로그램은 그 PC에서만 열린다.",
    },
    {
      id: E3.lobby,
      no: "증거 12",
      title: "건물 방문 기록",
      lines: lobby.spans.map((span, i) => ({ label: `${NAME[DOHEE]} · ${i === 0 ? "첫 방문" : "다시 방문"}`, value: `${span.from} → ${span.to} · ${PASS}` })),
      note: "안내 데스크는 방문객만 적는다. 직원의 출입은 적지 않는다.",
    },
    {
      id: E3.perms,
      no: "증거 13",
      title: "작업 권한표",
      lines: NAMED.map((who) => ({ label: NAME[who], value: PERMS[who].text })),
      note: ACCOUNT_RULES.text[2],
    },
    {
      id: E3.lies,
      no: "증거 14",
      title: "진술 대조 기록",
      lines: [
        { label: NAME[SANGMIN], value: `"들어가지 않았다" ↔ 지문 ${tilde(door(SANGMIN).spans)}` },
        { label: NAME[GAEUL], value: `"다시 가지 않았다" ↔ 지문 ${tilde(door(GAEUL).spans.slice(1))}` },
        { label: NAME[DOHEE], value: `"다시 가지 않았다" ↔ 방문 ${tilde(lobby.spans.slice(1))}` },
      ],
      note: "세 사람 모두 사실과 다른 말을 했다. 그것만으로는 누가 영상을 고쳤는지 알 수 없다.",
    },
    {
      id: E3.confession,
      no: "증거 15",
      title: `${NAME[SANGMIN]}의 두 번째 진술`,
      lines: [
        { label: "인정한 것", value: `${session.from}의 접속과 영상 수정` },
        { label: "말한 까닭", value: "토끼가 은퇴하면 채널의 수익이 끊긴다" },
        { label: "계약서의 조건", value: "매니저의 보수는 채널 수익에서 나온다 · 채널이 끝나면 지급도 끝난다" },
        { label: `${NAME[SEORIN]}의 행방`, value: "모른다고 말했다" },
      ],
      note: "진술이다. 기록으로 확정한 것은 '누가 고쳤는가'까지다.",
    },
  ],
  scenes: [
    {
      kind: "testimony",
      id: "statements",
      step: "진술",
      title: "세 사람의 진술",
      enter: "세 사람이 저마다 그날을 말했다. 진술 하나와 기록 한 줄을 골라 맞대어 본다.",
      question: "기록과 어긋나는 진술을 모두 찾으세요.",
      people: [
        { id: SANGMIN, name: NAME[SANGMIN], role: "매니저" },
        { id: GAEUL, name: NAME[GAEUL], role: "편집자" },
        { id: DOHEE, name: NAME[DOHEE], role: "팬클럽 운영자" },
      ],
      statements: [
        {
          id: "sm1",
          speaker: SANGMIN,
          text: "그날 오후에는 줄곧 사무실에서 정산 서류를 봤습니다. 편집실에는 들어가지 않았어요.",
          retort: "…들어간 건 맞습니다. 서류를 찾으러요. 그 방에 저만 있었던 것도 아닙니다.",
        },
        { id: "sm2", speaker: SANGMIN, text: `${NAME[GAEUL]} 씨는 4시쯤 퇴근했습니다.` },
        { id: "sm3", speaker: SANGMIN, text: `편집 계정으로 한 일이라면서요. 그럼 ${NAME[GAEUL]} 씨가 했겠죠. 본인 계정이니까.` },
        { id: "ge1", speaker: GAEUL, text: "4시에 퇴근했어요. 5시대에는 편집실에 없었습니다." },
        {
          id: "ge2",
          speaker: GAEUL,
          text: "그날은 그 뒤로 편집실에 다시 가지 않았어요.",
          retort: "…7시쯤 돌아갔어요. 비밀번호가 바뀌었다는 알림이 와서요. 거기서 무엇을 봤는지는, 지금은 말하지 않을게요.",
        },
        { id: "dh1", speaker: DOHEE, text: "3시 조금 지나서 그 건물에서 나왔어요." },
        {
          id: "dh2",
          speaker: DOHEE,
          text: "그 뒤로 그 건물에는 다시 가지 않았어요.",
          retort: "…5시 반쯤 다시 갔어요. 부탁받은 짐이 있어서요. 누구의 부탁인지는 말할 수 없어요. 그때 매니저님은 편집실 컴퓨터 앞에 있었어요.",
        },
      ],
      records,
      goal: 3,
      misses: {
        "sm3|*": "추측이다. 누가 언제 어디에 있었는지가 들어 있지 않아, 기록과 맞대어 볼 것이 없다. 계정의 주인이 그 접속을 했는지는 따로 따져야 한다.",
        "dh1|door-pass": `${PASS}을 누가 들고 있었는지는 이 기록에 없다. 방문증을 내준 곳의 기록을 봐야 한다.`,
        "dh2|door-pass": `${PASS}을 누가 들고 있었는지는 이 기록에 없다. 방문증을 내준 곳의 기록을 봐야 한다.`,
        "*|door-pass": `${PASS}을 든 사람이 누구인지는 이 기록에 없다.`,
        "*|access": "계정 기록은 계정에 일어난 일을 적는다. 그 계정을 누가 썼는지, 누가 어디에 있었는지는 적지 않는다.",
        [`*|door-${SEORIN}`]: `이 줄은 ${NAME[SEORIN]}이 편집실에 들어오지 않았다는 것만 말해 준다.`,
      },
      grants: [E3.lies],
      done: "세 사람 모두 무언가를 숨겼다. 거짓말을 했다는 것과 영상을 고쳤다는 것은 다른 이야기다.",
      hints: [
        { text: "진술에서 '언제, 어디에'를 뽑아내세요. 그 시각에 그 사람이 어디에 있었는지 적은 기록은 출입 기록과 방문 기록입니다.", checks: ["locationRecords"] },
        { text: "기록과 어긋나는 진술은 셋입니다. 세 사람이 저마다 한 번씩 어긋납니다. 거짓말을 한 사람은 한 명이 아닙니다.", checks: ["threeContradictions", "threeLiars", "eachLiesOnce"] },
      ],
    },
    {
      kind: "records",
      id: "sessions",
      step: "접속",
      title: "세 번의 접속",
      enter: "그날 편집자 계정에는 세 번의 접속이 있었다. 방송에 나간 영상을 만든 접속은 어느 것인가?",
      question: `${RELEASED.name}를 내보낸 접속은 어느 것인가?`,
      records: sessionItems,
      grants: [E3.perms],
      done: "그 접속은 임시 비밀번호로 들어왔다. 임시 비밀번호는 누가 받을 수 있는가. 작업 권한표를 펼친다.",
      hints: [
        { text: "방송에 나간 파일이 만들어진 시각은 제2장에서 확인했습니다. 그 시각을 품은 접속을 찾으세요.", checks: ["oneSessionAround"] },
        {
          text: `${RELEASED.createdAt}${numJosa(RELEASED.createdAt, "은", "는")} ${session.from}${numJosa(session.from, "과", "와")} ${session.to} 사이입니다. 그 접속이 어떤 비밀번호로 들어왔는지 읽어 두세요.`,
          checks: ["oneSessionAround", "tempAfterAdminReset"],
        },
      ],
    },
    {
      kind: "deduce",
      id: "deduction",
      step: "추론",
      title: "최종 추론",
      enter: "편집자의 계정, 재설정된 비밀번호, 서로 다른 세 사람의 말. 그 접속의 주인은 누구인가?",
      question: `${session.from}에 편집자 계정으로 들어와 영상을 고친 사람은 누구인가?`,
      need: 2,
      choices: [
        {
          id: GAEUL,
          text: `편집자 ${NAME[GAEUL]}`,
          unsupported: `${NAME[GAEUL]}의 지문은 그 접속 동안 편집실 문에 찍히지 않았습니다. 편집 프로그램은 편집실 PC에서만 열립니다.`,
        },
        { id: SANGMIN, text: `매니저 ${NAME[SANGMIN]}`, unsupported: "아직 이 결론을 받칠 기록이 모이지 않았습니다." },
        {
          id: DOHEE,
          text: `팬클럽 운영자 ${NAME[DOHEE]}`,
          unsupported: `${NAME[DOHEE]}에게는 관리자 권한이 없습니다. 임시 비밀번호는 재설정한 관리자의 화면에만 표시됩니다.`,
        },
        { id: SEORIN, text: `${NAME[SEORIN]} 본인`, unsupported: `${NAME[SEORIN]}의 지문은 그날 편집실 문에 한 번도 찍히지 않았습니다.` },
        {
          id: "outsider",
          text: "기록에 없는 다른 사람",
          unsupported: "그 접속은 관리자 권한으로 재설정해 나온 임시 비밀번호로 들어왔습니다. 권한표에 없는 사람은 그 비밀번호를 받을 수 없습니다.",
        },
      ],
      basis: [E3.door, E3.lobby, E3.perms, E3.lies],
      weak: {
        [E3.lobby]: `방문 기록은 ${PASS}을 든 사람이 ${NAME[DOHEE]}였다는 것을 말해 줍니다. 그 접속 동안 편집실에 있던 다른 사람과, 임시 비밀번호를 받을 수 있는 사람은 말해 주지 않습니다.`,
        [E3.lies]: "거짓말은 숨긴 것이 있다는 뜻일 뿐입니다. 세 사람 모두 사실과 다른 말을 했습니다. 그 접속 동안 그 자리에 있을 수 있었던 사람, 그 비밀번호를 받을 수 있었던 사람을 기록으로 좁히세요.",
      },
      hints: [
        {
          text: "거짓말은 근거가 되지 못합니다. 두 가지를 따로 물으세요. 그 접속 동안 편집실에 있던 사람은 누구인가. 임시 비밀번호를 받을 수 있는 사람은 누구인가.",
          checks: ["threeLiars", "liarsNotModifier"],
        },
        { text: "출입 기록으로 좁히면 둘, 권한표로 좁혀도 둘이 남습니다. 두 번 다 남는 사람은 한 명입니다.", checks: ["doorLeavesTwo", "permsLeaveTwo", "bothLeaveOne"] },
      ],
    },
  ],
  hints: [],
  explanation: [
    { text: `방송에 나간 파일은 ${RELEASED.createdAt}에 만들어졌다. 그 시각을 품은 접속은 ${session.from}~${session.to}의 접속 ${session.id} 하나다.`, checks: ["oneSessionAround"] },
    { text: `접속 ${session.id}${numJosa(session.id, "은", "는")} 임시 비밀번호로 들어왔다. 임시 비밀번호는 ${adminReset.at}에 관리자 권한으로 재설정해 나온 것이다.`, checks: ["tempAfterAdminReset"] },
    {
      text: `편집 프로그램은 편집실 PC에서만 열린다. 그 접속 내내 편집실에 있던 사람은 ${NAME[SANGMIN]}과, ${PASS}을 든 ${NAME[DOHEE]}다. ${NAME[GAEUL]}은 없었다.`,
      checks: ["twoInRoom", "gaeulAway"],
    },
    { text: `임시 비밀번호를 받을 수 있는 관리자는 ${NAME[SANGMIN]}과 ${NAME[SEORIN]}이다. ${NAME[SEORIN]}의 지문은 그날 편집실에 찍히지 않았다.`, checks: ["twoAdmins", "seorinNeverIn"] },
    { text: `두 조건에 모두 드는 사람은 ${NAME[SANGMIN]} 하나다.`, checks: ["bothLeaveOne", "modifierEstablished"] },
    { text: `세 사람 모두 사실과 다른 말을 했다. ${NAME[GAEUL]}과 ${NAME[DOHEE]}는 거짓말을 했지만 영상을 고치지 않았다.`, checks: ["threeLiars", "liarsNotModifier"] },
  ],
  reward: 120,
  ending: {
    lines: ["방송을 바꾼 사람은 찾았다.", `그렇다면 ${NAME[SEORIN]}은 지금 어디에 있는가?`],
    evidence: E3.confession,
    open: [
      { claim: "dead", text: `${NAME[SEORIN]}은 살아 있는가` },
      { claim: "abroad", text: `${NAME[SEORIN]}은 지금 어디에 있는가` },
    ],
    next: { no: 4, title: "토끼의 정체" },
    still: "세 사람의 진술서가 책상 위에 나란히 놓여 있다.",
  },
};
