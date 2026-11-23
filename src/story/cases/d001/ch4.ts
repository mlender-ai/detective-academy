/**
 * CASE D-001 제4장 「토끼의 정체」. 사건의 마지막 장이다.
 * 핵심 조작은 "증거 연결"과 "그날의 타임라인 세우기"다: 두 번째 진술과 새 기록을 앞 장의 기록에 맞대어 사실을 확정하고,
 * 시각 순서로 놓인 일곱 가지 일마다 그 일을 한 사람을 넣는다(각 인물이 실제로 한 일을 가른다).
 *
 * 이 장이 확정하는 것: 윤서린은 스스로 방송을 그만두고 떠났고, 살아 있으며 무사하다.
 * 그 근거는 계정 접속도 문자도 아닌, 경찰이 직접 만나 신분을 대조한 확인이다(logic4.ts 가 검증한다).
 * 윤서린이 지금 있는 곳은 끝까지 밝히지 않는다.
 */
import type { AssignRow, StoryChapter } from "../../engine/storyTypes";
import { BROADCAST } from "./logic";
import { ORIGINAL } from "./logic2";
import { DOOR, PASS, RESETS } from "./logic3";
import { DAY, E4, F4, LOGIN, NOBODY, POLICE, RESTATED, SCHEDULED, TEXT_MESSAGE, minutesBeforeAir, stampText } from "./logic4";
import { DOHEE, GAEUL, NAME, SANGMIN, SEORIN, numJosa } from "./people";

const before = minutesBeforeAir();
const beforeText = `${Math.floor(before / 60)}시간 ${before % 60}분`;
const sawAt = RESTATED[GAEUL].sawLogAt;
const ownerReset = RESETS.find((reset) => reset.by === "owner")!;
const sangminDoor = DOOR.find((line) => line.who === SANGMIN)!.spans[0];

/** 타임라인의 줄마다의 글. 줄의 이름표와 시각은 logic4.ts 의 DAY 가 준다. */
const ROW_TEXT: Record<string, string> = {
  "r-export": "은퇴를 알리는 원본 영상을 내보냈다",
  "r-leave": "방송을 그만두기로 하고 스스로 건물을 떠났다",
  "r-visit": "방문증으로 편집실에 들어와 짐을 챙겼다",
  "r-modify": "편집자 계정으로 들어와 제목과 자막을 고쳤다",
  "r-register": "고친 영상을 예약 등록했다",
  "r-view": "작업 기록을 열어 영상이 고쳐진 것을 보았다. 알리지 않았다",
  "r-air": "카메라 앞에 앉아 방송을 했다",
};

const rows: AssignRow[] = DAY.map((row) => ({ id: row.id, time: row.time, text: ROW_TEXT[row.id] }));

export const D001_CH4: StoryChapter = {
  id: "ch4",
  no: 4,
  title: "토끼의 정체",
  minutes: "5~7분",
  intro: [
    "방송을 바꾼 사람은 찾았다.",
    `그러나 ${NAME[SEORIN]}은 여전히 보이지 않는다.`,
    "살아 있다는 신호가 셋 도착했다. 계정 접속, 문자 한 통, 경찰의 회신.",
    `${NAME[GAEUL]}과 ${NAME[DOHEE]}는 다시 진술했다.`,
    `${NAME[SEORIN]}에게 무슨 일이 있었는가?`,
  ],
  given: [E4.login, E4.text, E4.police, E4.schedule, E4.restated],
  evidence: [
    {
      id: E4.login,
      no: "증거 16",
      title: `${NAME[SEORIN]} 계정 접속 기록`,
      lines: [
        { label: "접속한 때", value: stampText(LOGIN.at) },
        { label: "기기", value: LOGIN.device },
        { label: "방법", value: LOGIN.by },
      ],
      note: "누군가 이 계정에 들어왔다는 기록이다.",
    },
    {
      id: E4.text,
      no: "증거 17",
      title: `${NAME[DOHEE]}가 받은 문자`,
      lines: [
        { label: "받은 때", value: stampText(TEXT_MESSAGE.at) },
        { label: "보낸 번호", value: TEXT_MESSAGE.from },
        { label: "내용", value: TEXT_MESSAGE.body },
      ],
      note: "그 전화기에서 보낸 문자다.",
    },
    {
      id: E4.police,
      no: "증거 18",
      title: "경찰 안전 확인 회신",
      lines: [
        { label: "확인한 때", value: stampText(POLICE.at) },
        { label: "확인 방법", value: "경찰관 대면 · 신분증과 지문 대조" },
        { label: "결과", value: `${NAME[SEORIN]} 본인 · 건강 이상 없음` },
        { label: "본인의 말", value: `${POLICE.leftAround}에 스스로 건물을 나왔다. 은퇴 영상은 직접 찍어 맡겼다. 방송은 그만둔다.` },
        { label: "지금 있는 곳", value: "본인 요청으로 적지 않음" },
      ],
    },
    {
      id: E4.schedule,
      no: "증거 19",
      title: "예약 등록 상세",
      lines: [
        { label: "등록 시각", value: SCHEDULED.at },
        { label: "계정", value: SCHEDULED.account },
        { label: "접속 장치", value: SCHEDULED.device },
        { label: "파일", value: SCHEDULED.file },
        { label: "입력한 제목", value: SCHEDULED.title },
      ],
      note: "제1장의 접근 기록에 없던 접속 장치가 적혀 있다.",
    },
    {
      id: E4.restated,
      no: "증거 20",
      title: "두 번째 진술",
      lines: [
        { label: NAME[GAEUL], value: `${sawAt}에 작업 기록을 열어, 영상이 고쳐진 것을 알았다. 방송 전에 누구에게도 알리지 않았다.` },
        { label: NAME[DOHEE], value: "서린 언니가 떠나는 것을 도왔다. 언니는 무사하다. 있는 곳은 언니의 부탁으로 말하지 않는다." },
      ],
      note: "진술이다. 확인된 기록과 맞대어 본다.",
    },
    {
      id: E4.report,
      no: "증거 21",
      title: "사건 종결 보고",
      lines: [
        { label: "사망 소문", value: "사실이 아님 · 정정" },
        { label: "마지막 방송", value: "은퇴 영상을 고쳐 예약 송출한 것" },
        { label: "영상을 고친 사람", value: `매니저 ${NAME[SANGMIN]}` },
        { label: NAME[SEORIN], value: "본인의 뜻으로 방송을 그만둠 · 있는 곳은 밝히지 않음" },
      ],
    },
  ],
  scenes: [
    {
      kind: "link",
      id: "connect",
      step: "연결",
      title: "증거 연결",
      enter: "두 번째 진술과 새 기록을, 확인된 기록 옆에 놓았다. 한쪽에서 하나, 다른 쪽에서 하나를 골라 맞대어 본다.",
      docs: [
        {
          id: "docA",
          title: "진술과 새 기록",
          items: [
            { id: "a-gaeul", label: `${NAME[GAEUL]}의 말`, value: `${sawAt}에 작업 기록을 봤다` },
            { id: "a-rumor", label: "소문", value: "토끼는 방송 중에 죽었다" },
            { id: "a-reg", label: "예약 등록", value: `${SCHEDULED.at} · ${SCHEDULED.device}` },
            { id: "a-dohee", label: `${NAME[DOHEE]}의 말`, value: "있는 곳은 말 못 한다" },
          ],
        },
        {
          id: "docB",
          title: "확인된 기록",
          items: [
            { id: "b-air", label: "마지막 방송", value: `21일 ${BROADCAST.start} → ${BROADCAST.end}` },
            { id: "b-door", label: "편집실 지문", value: `${NAME[SANGMIN]} ${sangminDoor.from} → ${sangminDoor.to}` },
            { id: "b-police", label: "경찰의 회신", value: `22일 ${POLICE.at.clock} 본인 대면` },
            { id: "b-view", label: "계정 접근 기록", value: `${ownerReset.at} 본인 인증 · ${sawAt} 접속` },
          ],
        },
      ],
      links: [
        { a: "a-gaeul", b: "b-view", fact: F4.gaeulKnew },
        { a: "a-dohee", b: "b-police", fact: F4.doheeHid },
        { a: "a-reg", b: "b-door", fact: F4.registrar },
        { a: "a-rumor", b: "b-police", fact: F4.rumorFalse },
      ],
      facts: [
        { id: F4.gaeulKnew, no: "사실 04", text: `${NAME[GAEUL]}의 말은 기록과 맞는다. 방송 ${beforeText} 전에 영상이 고쳐진 것을 알았다.` },
        { id: F4.doheeHid, no: "사실 05", text: `${NAME[DOHEE]}의 말은 경찰의 회신과 맞는다. 숨긴 것은 ${NAME[SEORIN]}이 스스로 밝히지 않기를 바란 소재다.` },
        { id: F4.registrar, no: "사실 06", text: `예약은 ${SCHEDULED.device}에서 등록됐다. ${SCHEDULED.at}에 편집실에 있던 사람은 ${NAME[SANGMIN]}뿐이다.` },
        { id: F4.rumorFalse, no: "사실 07", text: `소문은 사실이 아니다. 방송 다음 날, 경찰이 ${NAME[SEORIN]} 본인을 직접 만났다.` },
      ],
      misses: {
        "a-gaeul|b-air": "방송 시각은 이미 안다. 먼저 그 말이 맞는지를 확인된 기록으로 봐야 한다.",
        "a-gaeul|b-door": `이 줄은 ${NAME[SANGMIN]}의 지문이다. ${NAME[GAEUL]}의 말을 확인해 주지 않는다.`,
        "a-gaeul|b-police": `경찰이 확인한 것은 ${NAME[SEORIN]}이다. ${NAME[GAEUL]}이 무엇을 봤는지는 적혀 있지 않다.`,
        "a-rumor|b-air": "방송 기록은 방송이 언제 나갔는지를 말할 뿐이다. 그 시간에 무슨 일이 있었는지는 말하지 않는다.",
        "a-rumor|*": `소문이 맞는지는, 방송 뒤에 ${NAME[SEORIN]} 본인이 확인됐는지에 달려 있다.`,
        "a-reg|b-air": "예약한 시각과 방송된 시각은 제1장에서 맞대어 봤다. 누가 등록했는지는 여기서 나오지 않는다.",
        "a-reg|b-view": `${sawAt}의 접속은 예약 등록보다 뒤의 일이다.`,
        "a-reg|b-police": "경찰의 회신에는 예약 등록에 대한 것이 없다.",
        "a-dohee|*": `그 말이 맞는지는 ${NAME[SEORIN]} 본인을 확인한 기록이 말해 준다.`,
      },
      done: "네 가지가 맞아떨어졌다. 이제 그날 하루를 처음부터 다시 세운다.",
      hints: [
        { text: "진술은 그것만으로는 믿을 수 없습니다. 진술 하나를 확인된 기록 하나와 짝지어, 서로 맞는지 보세요.", checks: ["signsDoNotEstablish"] },
        {
          text: `${NAME[GAEUL]}의 말은 계정 접근 기록과, ${NAME[DOHEE]}의 말과 소문은 경찰의 회신과, 예약 등록은 편집실의 지문과 맞대어 보세요.`,
          checks: ["gaeulKnewBeforeAir", "doheeHidWhatSeorinAsked", "registrarAlone", "rumorRefuted"],
        },
      ],
    },
    {
      kind: "assign",
      id: "day",
      step: "타임라인",
      title: "그날의 타임라인",
      enter: "11월 21일 하루의 일곱 가지 일. 줄마다 그 일을 한 사람을 넣는다. 아무도 하지 않은 일도 있다.",
      question: "줄마다, 그 일을 한 사람을 넣으세요.",
      rows,
      options: [
        { id: SEORIN, name: NAME[SEORIN] },
        { id: SANGMIN, name: NAME[SANGMIN] },
        { id: GAEUL, name: NAME[GAEUL] },
        { id: DOHEE, name: NAME[DOHEE] },
        { id: NOBODY, name: "아무도 아니다" },
      ],
      grants: [],
      done: `하루가 다시 섰다. 남은 물음은 하나다. ${NAME[SEORIN]}에게 무슨 일이 있었는가.`,
      hints: [
        { text: "편집실 PC로 한 일은 그 시각에 편집실에 있던 사람만 할 수 있습니다. 출입 기록의 시각과 하나씩 맞대어 보세요.", checks: ["gaeulAtExportAndView", "registrarAlone", "sangminModified"] },
        {
          text: `${ORIGINAL.createdAt}${numJosa(ORIGINAL.createdAt, "과", "와")} ${sawAt}에 편집실에 있던 사람은 같은 한 사람이고, ${SCHEDULED.at}에는 다른 한 사람뿐입니다. ${BROADCAST.start}의 방송은 예약 재생이었습니다. 카메라 앞에는 아무도 없었습니다.`,
          checks: ["gaeulAtExportAndView", "registrarAlone", "nobodyOnCamera", "dayUnique"],
        },
      ],
    },
    {
      kind: "deduce",
      id: "deduction",
      step: "추론",
      title: "최종 추론",
      enter: "가면을 쓴 방송인, 고쳐진 영상, 사라진 사람. 마지막 물음에 답할 차례다.",
      question: `${NAME[SEORIN]}에게 실제로 무슨 일이 있었는가?`,
      choices: [
        {
          id: "dead",
          text: `${NAME[SEORIN]}은 마지막 방송 중에 사망했다.`,
          unsupported: `방송 다음 날, 경찰이 ${NAME[SEORIN]} 본인을 직접 만나 확인했습니다. 방송 중에 사망했다는 소문은 사실이 아닙니다.`,
        },
        {
          id: "hoax",
          text: `${NAME[SEORIN]}이 관심을 끌려고 사망 소동을 직접 꾸몄다.`,
          unsupported: `영상을 고친 사람은 제3장에서 가려냈습니다. ${NAME[SEORIN]}의 지문은 그날 편집실에 찍히지 않았습니다.`,
        },
        { id: "left", text: `${NAME[SEORIN]}은 스스로 방송을 그만두고 떠났다. 지금 살아 있고 무사하다.`, unsupported: "아직 이 결론을 받칠 기록이 모이지 않았습니다." },
        {
          id: "taken",
          text: `누군가 ${NAME[SEORIN]}을 데려가 숨기고 있다.`,
          unsupported: "경찰이 직접 만나 들은 본인의 말은 다릅니다. 스스로 건물을 나왔고, 있는 곳을 적지 말아 달라고 한 것도 본인입니다.",
        },
        {
          id: "abroad",
          text: `${NAME[SEORIN]}은 지금 해외에 있다.`,
          unsupported: `${NAME[SEORIN]}이 지금 어디에 있는지 말해 주는 기록은 없습니다. 본인이 밝히지 않기를 바랐습니다.`,
        },
      ],
      basis: [E4.login, E4.text, E4.police, E4.restated],
      weak: {
        [E4.login]: "접속 기록은 누군가 그 계정에 들어왔다는 것만 말합니다. 비밀번호를 아는 사람이면 누구든 남길 수 있습니다. 편집자 계정에서 이미 본 일입니다.",
        [E4.text]: "문자는 그 전화기를 가진 사람이면 누구든 보낼 수 있습니다. 보낸 사람이 본인인지 확인된 것이 아닙니다.",
        [E4.restated]: `${NAME[DOHEE]}의 말은 진술입니다. 진술은 사실과 다를 수 있습니다. 그 말을 받치는, 확인된 기록을 근거로 드세요.`,
      },
      hints: [
        { text: "살아 있다는 신호 셋 가운데, 그것을 남긴 사람이 본인인지 확인된 것은 무엇입니까?", checks: ["policeEstablishes"] },
        {
          text: "계정과 문자는 다른 사람도 남길 수 있습니다. 편집자 계정에서 이미 본 일입니다. 얼굴을 마주하고 신분을 대조한 기록만이 본인을 보증합니다.",
          checks: ["signsDoNotEstablish", "policeEstablishes"],
        },
      ],
    },
  ],
  hints: [],
  explanation: [
    {
      text: `원본을 내보낸 사람은 ${NAME[GAEUL]}, 영상을 고치고 예약 등록한 사람은 ${NAME[SANGMIN]}이다. ${SCHEDULED.at}에 편집실에는 ${NAME[SANGMIN]}뿐이었다.`,
      checks: ["gaeulAtExportAndView", "sangminModified", "registrarAlone"],
    },
    { text: `${NAME[GAEUL]}은 ${sawAt}에 작업 기록을 열어 영상이 고쳐진 것을 알았다. 방송 ${beforeText} 전이다. 알리지 않았다.`, checks: ["gaeulKnewBeforeAir", "gaeulStayedSilent"] },
    { text: `${PASS}을 들고 편집실에 들른 사람은 ${NAME[DOHEE]}다. ${NAME[DOHEE]}가 숨긴 것은 ${NAME[SEORIN]}의 소재이고, ${NAME[SEORIN]}이 스스로 밝히지 않기를 바랐다.`, checks: ["doheeVisited", "doheeHidWhatSeorinAsked"] },
    {
      text: `계정 접속과 문자는 본인이 아니어도 남길 수 있다. 경찰은 ${stampText(POLICE.at)}에 ${NAME[SEORIN]} 본인을 직접 만나 신분을 대조했다.`,
      checks: ["signsDoNotEstablish", "policeEstablishes", "rumorRefuted"],
    },
    { text: `${NAME[SEORIN]}은 스스로 방송을 그만두고 떠났다. 사망 소문은 고쳐진 영상에서 나왔다. 지금 있는 곳은 밝히지 않는다.`, checks: ["seorinLeft", "notSelfMade", "whereaboutsOpen"] },
  ],
  reward: 120,
  ending: {
    lines: ["토끼는 사라졌다.", `하지만 ${NAME[SEORIN]}은 자신의 삶으로 돌아갔다.`],
    evidence: E4.report,
    open: [{ claim: "abroad", text: `${NAME[SEORIN]}이 지금 있는 곳 (본인의 뜻에 따라 밝히지 않는다)` }],
    next: null,
    still: "방송실 책상 위에 토끼 가면만 놓여 있다.",
    closing: "CASE D-001 · 사건 해결",
  },
};
