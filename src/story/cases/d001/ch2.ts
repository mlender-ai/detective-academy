/**
 * CASE D-001 제2장 「사라진 원본」.
 * 핵심 조작은 "두 영상의 비교"와 "작업 기록의 순서 재구성"이다(제1장의 타임라인 조사·기록 대조와 다르다).
 * 글과 값은 logic2.ts 의 사실에서 읽어 온다: 여기서 시각이나 제목을 따로 적지 않는다.
 *
 * 이 장이 확정하는 것은 "은퇴를 알리던 영상이 방송 전에 제목과 자막이 바뀌어 나갔다" 하나다.
 * 누가 고쳤는지, 토끼의 생사와 행방은 열어 둔다(logic2.ts 가 그것까지 검증한다).
 */
import type { CompareField, CompareFrame, OrderCard, StoryChapter } from "../../engine/storyTypes";
import { BROADCAST, lengthText } from "./logic";
import { CASE2, CUTS, E2, EDITOR_RULES, EDIT_LOG, EDIT_OPS, ORIGINAL, RELEASED, SUB_BASE, SUB_CHANGES, compareValues, validOrders } from "./logic2";
import { RESETS, modifyingSession } from "./logic3";
import { GAEUL, NAME, numJosa, toMinutes } from "./people";

const gap = toMinutes(RELEASED.createdAt) - toMinutes(ORIGINAL.createdAt);
const gapText = `${Math.floor(gap / 60)}시간 ${gap % 60}분`;
const replaced = SUB_CHANGES.find((change) => change.kind === "replace")!;
const removed = SUB_CHANGES.find((change) => change.kind === "delete")!;
const lineOf = (no: number) => SUB_BASE.find((line) => line.no === no)!;
const cutTime = (id: string) => lengthText(CUTS.find((cut) => cut.id === id)!.at);

/** 견주는 곳마다의 글. 값(a, b)은 logic2.ts 의 compareValues 가 준다. */
const FIELD_TEXT: Record<string, Omit<CompareField, "id" | "a" | "b">> = {
  "file.length": {
    label: "영상 길이",
    found: "두 영상의 길이가 다르다.",
    same: `길이는 둘 다 ${lengthText(RELEASED.lengthSec)}. 1초도 다르지 않다.`,
    note: "두 영상의 길이가 다르다.",
  },
  "file.created": {
    label: "파일 생성",
    found: `되살린 영상은 ${ORIGINAL.createdAt}, 방송에 나간 영상은 ${RELEASED.createdAt}에 만들어졌다. ${gapText}의 차이다.`,
    same: "두 파일은 같은 시각에 만들어졌다.",
    note: `되살린 영상은 ${ORIGINAL.createdAt}, 방송에 나간 영상은 ${RELEASED.createdAt}에 만들어졌다.`,
  },
  "c0015.picture": {
    label: "화면",
    found: "두 화면이 다르다.",
    same: "화면은 같다. 가면을 쓴 사람이 같은 자리에 앉아 있다.",
    note: "00:15의 화면이 다르다.",
  },
  "c0015.title": {
    label: "제목 자막",
    found: `제목이 다르다. 되살린 영상은 「${ORIGINAL.title.text}」, 방송에 나간 영상은 「${RELEASED.title.text}」`,
    same: "제목은 같다.",
    note: `제목 자막이 다르다. 되살린 영상의 제목은 「${ORIGINAL.title.text}」`,
  },
  "c0130.picture": {
    label: "화면",
    found: "두 화면이 다르다.",
    same: "화면은 같다. 앉은 자세까지 같다.",
    note: "01:30의 화면이 다르다.",
  },
  "c0130.caption": {
    label: "자막",
    found: `자막이 다르다. 「${lineOf(replaced.line).text}」가 「${replaced.kind === "replace" ? replaced.text : ""}」로 바뀌어 있다.`,
    same: "이 시점의 자막은 같다.",
    note: `${cutTime("c0130")}의 자막이 바뀌었다. 되살린 영상에서는 「${lineOf(replaced.line).text}」`,
  },
  "c0310.picture": {
    label: "화면",
    found: "두 화면이 다르다.",
    same: "화면은 같다. 같은 사람이 같은 걸음으로 걸어 나간다.",
    note: "03:10의 화면이 다르다.",
  },
  "c0310.caption": {
    label: "자막",
    found: "자막이 다르다.",
    same: "이 시점에는 두 영상 모두 자막이 없다.",
    note: "03:10의 자막이 다르다.",
  },
  "c0500.picture": {
    label: "화면",
    found: "두 화면이 다르다.",
    same: "화면은 같다. 빈 의자, 등받이의 가면.",
    note: "05:00의 화면이 다르다.",
  },
  "c0500.caption": {
    label: "자막",
    found: `되살린 영상에는 「${lineOf(removed.line).text}」라는 자막이 있다. 방송에 나간 영상에서는 그 자막이 사라졌다.`,
    same: "이 시점의 자막은 같다.",
    note: `${cutTime("c0500")}의 자막이 사라졌다. 되살린 영상에서는 「${lineOf(removed.line).text}」`,
  },
};

const FRAME_TEXT: Record<string, { tab: string; caption: string }> = {
  file: { tab: "파일", caption: "두 파일의 정보를 나란히 놓았다." },
  c0015: { tab: cutTime("c0015"), caption: "방송이 시작된 직후." },
  c0130: { tab: cutTime("c0130"), caption: "토끼는 앉은 채 움직이지 않는다." },
  c0310: { tab: cutTime("c0310"), caption: "토끼가 자리에서 일어난다." },
  c0500: { tab: cutTime("c0500"), caption: "의자가 비어 있다." },
};

const values = compareValues();
const frames: CompareFrame[] = Object.keys(FRAME_TEXT).map((id) => {
  const cut = CUTS.find((x) => x.id === id);
  return {
    id,
    tab: FRAME_TEXT[id].tab,
    at: cut ? cut.at : null,
    ...(cut ? { still: cut.still } : {}),
    caption: FRAME_TEXT[id].caption,
    fields: values.filter((v) => v.frame === id).map((v) => ({ id: v.field, a: v.a, b: v.b, ...FIELD_TEXT[`${v.frame}.${v.field}`] })),
  };
});

const cards: OrderCard[] = EDIT_OPS.map((op) => ({
  id: op.id,
  label: op.label,
  tags: [
    ...(op.sees !== undefined ? [`자막 판 r${op.sees}`] : []),
    ...(op.makes !== undefined ? [`r${op.makes - 1} → r${op.makes}`] : []),
    ...(op.at ? [`${op.id === "op-trash" ? "휴지통" : "파일 생성"} ${op.at}`] : []),
  ],
}));

const labelOf = (id: string) => EDIT_OPS.find((op) => op.id === id)!.label;
const session = modifyingSession();
const reset = RESETS.find((r) => r.by === "admin")!;

export const D001_CH2: StoryChapter = {
  id: "ch2",
  no: 2,
  title: "사라진 원본",
  minutes: "4~6분",
  intro: [
    "마지막 방송은 미리 만든 영상이었다.",
    "그 영상을 만든 곳은 편집실이다.",
    `편집자 ${NAME[GAEUL]}은 작업 폴더를 통째로 넘겼다. 말은 없었다.`,
    "폴더의 휴지통에 길이가 같은 영상이 하나 더 있다.",
    "두 영상은 같은 것인가?",
  ],
  evidence: [
    {
      id: E2.original,
      no: "증거 05",
      title: "원본 영상 파일",
      lines: [
        { label: "파일명", value: ORIGINAL.name },
        { label: "생성", value: ORIGINAL.createdAt },
        { label: "영상 길이", value: lengthText(ORIGINAL.lengthSec) },
        { label: "제목 자막", value: ORIGINAL.title.text },
        { label: "있던 곳", value: `휴지통 · ${ORIGINAL.trashedAt} 삭제` },
      ],
      note: "휴지통에서 되살린 파일이다.",
    },
    {
      id: E2.released,
      no: "증거 06",
      title: "공개 영상 파일",
      lines: [
        { label: "파일명", value: RELEASED.name },
        { label: "생성", value: RELEASED.createdAt },
        { label: "영상 길이", value: lengthText(RELEASED.lengthSec) },
        { label: "제목 자막", value: RELEASED.title.text },
        { label: "예약 등록", value: CASE2.registeredAt },
      ],
      note: "두 영상의 화면은 모든 시점에서 같다. 다른 것은 글자뿐이다.",
    },
    {
      id: E2.subtitles,
      no: "증거 07",
      title: "자막 변경 이력",
      lines: [
        { label: "r1", value: `자막 ${SUB_BASE.length}줄 저장` },
        { label: `r${replaced.rev}`, value: `${replaced.line}번 줄(${lengthText(lineOf(replaced.line).at)}) 교체` },
        { label: `r${removed.rev}`, value: `${removed.line}번 줄(${lengthText(lineOf(removed.line).at)}) 삭제` },
      ],
      note: "자막을 고칠 때마다 판 번호가 하나씩 오른다.",
    },
    {
      id: E2.editlog,
      no: "증거 08",
      title: "수정 작업 기록",
      lines: [
        { label: "작업 계정", value: `${EDIT_LOG.accountLabel} (${NAME[EDIT_LOG.account]})` },
        { label: "작업 장치", value: EDIT_LOG.device },
        { label: "복원한 순서", value: validOrders()[0].map(labelOf).join(" → ") },
        { label: "고친 때", value: `${ORIGINAL.createdAt}${numJosa(ORIGINAL.createdAt, "과", "와")} ${RELEASED.createdAt} 사이` },
      ],
      note: "기록에 남은 것은 계정이다. 그 계정으로 누가 작업했는지는 적혀 있지 않다.",
    },
    {
      id: E2.notice,
      no: "증거 09",
      title: "편집자 계정 알림",
      lines: [
        { label: reset.at, value: "비밀번호가 재설정되었습니다" },
        { label: session.from, value: `${EDIT_LOG.device}에서 로그인` },
      ],
      note: "누가 재설정했는지는 아직 모른다.",
    },
  ],
  scenes: [
    {
      kind: "compare",
      id: "compare",
      step: "비교",
      title: "두 개의 영상",
      enter: "휴지통에서 되살린 영상과 방송에 나간 영상. 같은 시점을 나란히 놓고, 달라진 곳을 짚는다.",
      question: "두 영상에서 달라진 곳을 모두 찾으세요.",
      sides: [
        { id: "original", title: "되살린 영상", sub: ORIGINAL.name },
        { id: "released", title: "방송에 나간 영상", sub: RELEASED.name },
      ],
      frames,
      grants: [E2.original, E2.released, E2.subtitles],
      done: "달라진 곳은 넷. 화면은 한 장면도 다르지 않다. 바뀐 것은 글자뿐이다.",
      hints: [
        { text: "화면은 두 영상이 같습니다. 글자가 있는 곳을 보세요: 제목, 자막, 그리고 파일 정보의 시각.", checks: ["picturesSame", "onlyTextChanged"] },
        { text: "달라진 곳은 넷입니다. 파일 정보에서 하나, 영상 안에서 셋. 자막이 '사라진' 시점도 달라진 곳입니다.", checks: ["fourDifferences", "oneInFileThreeInVideo", "oneCaptionRemoved"] },
      ],
    },
    {
      kind: "order",
      id: "editlog",
      step: "작업 순서",
      title: "뒤섞인 작업 기록",
      enter: "편집 프로그램의 작업 기록에는 시각이 없다. 여섯 줄을 일어난 순서대로 놓는다.",
      question: "작업 기록 여섯 줄을 일어난 순서대로 놓으세요.",
      rules: EDITOR_RULES,
      cards,
      grants: [E2.editlog],
      done: "원본을 내보낸 뒤에 누군가 자막과 제목을 고쳐 다시 내보냈다. 그리고 원본을 지웠다.",
      hints: [
        { text: "자막 판 번호를 따라가세요. r1일 때 한 작업, r2를 만든 작업, r2일 때 한 작업, r3을 만든 작업, r3일 때 한 작업.", checks: ["orderUnique", "originalExportFirst"] },
        { text: "제목 변경은 자막 수정 두 번의 사이에 들어갑니다. 시각이 남은 줄은 셋이고, 가장 늦은 시각은 삭제입니다.", checks: ["titleBetweenSubs", "trashLast", "originalTrashedAfter"] },
      ],
    },
    {
      kind: "deduce",
      id: "deduction",
      step: "추론",
      title: "최종 추론",
      enter: "되살린 영상과 방송에 나간 영상. 두 영상 사이에서 확인된 사실은 무엇인가?",
      question: "공개된 마지막 방송은 원래 만든 영상과 같은가?",
      need: 2,
      choices: [
        { id: "same", text: "공개된 영상은 처음 만든 영상 그대로다.", unsupported: "되살린 영상의 제목은 방송에 나간 제목과 다릅니다. 그대로라고 할 수 없습니다." },
        { id: "reshot", text: "영상을 통째로 다시 찍어 바꿔 놓았다.", unsupported: "두 영상의 화면은 모든 시점에서 같고 길이도 같습니다. 다시 찍은 영상이 아닙니다." },
        { id: "altered", text: "은퇴를 알리던 영상이 방송 전에 제목과 자막이 바뀌어 나갔다.", unsupported: "아직 이 결론을 받칠 기록이 모이지 않았습니다." },
        {
          id: "afterAir",
          text: "방송이 나간 뒤에 누군가 영상을 고쳐 놓았다.",
          unsupported: `방송에 나간 파일은 ${RELEASED.createdAt}에 만들어져 ${CASE2.registeredAt}에 예약 등록되었습니다. 방송은 ${BROADCAST.start}에 시작했습니다.`,
        },
        { id: "gaeul", text: `편집자 ${NAME[GAEUL]}이 영상을 고쳤다.`, unsupported: "작업 기록에 남은 것은 계정입니다. 그 계정으로 누가 작업했는지 말해 주는 기록은 아직 없습니다." },
      ],
      basis: [E2.original, E2.released, E2.subtitles, E2.editlog],
      weak: {
        [E2.subtitles]: "자막 변경 이력은 자막이 두 번 고쳐졌다는 것만 말합니다. 어느 영상이 어느 판인지, 원래 영상이 무엇을 알리려 했는지는 두 영상을 나란히 놓아야 압니다.",
        [E2.editlog]: "수정 작업 기록은 무엇을 어떤 순서로 했는지를 말합니다. 바뀌기 전과 바뀐 뒤가 무엇이었는지는 두 영상이 말해 줍니다.",
      },
      hints: [
        { text: "'바뀌었다'고 말하려면 바뀌기 전의 것과 바뀐 뒤의 것이 둘 다 있어야 합니다.", checks: ["needsBothFiles"] },
        { text: "기록에 남은 계정이 누구 것인지는, 그 사람이 작업했다는 뜻이 아닙니다. 지금 확정할 수 있는 것은 '무엇이, 언제 바뀌었는가'까지입니다.", checks: ["accountOwnerOpen", "changedBeforeAir"] },
      ],
    },
  ],
  hints: [],
  explanation: [
    { text: `휴지통에서 되살린 ${ORIGINAL.name}는 ${ORIGINAL.createdAt}에, 방송에 나간 ${RELEASED.name}는 ${RELEASED.createdAt}에 만들어졌다. 되살린 쪽이 먼저 만든 원본이다.`, checks: ["originalFirst"] },
    { text: "두 영상의 화면은 모든 시점에서 같다. 다른 것은 제목 자막과 자막 두 줄뿐이다.", checks: ["picturesSame", "onlyTextChanged", "oneInFileThreeInVideo"] },
    { text: `원본의 제목은 「${ORIGINAL.title.text}」였다. 원래는 은퇴를 알리는 영상이었다.`, checks: ["originalRetire"] },
    { text: `공개본은 ${CASE2.registeredAt}의 예약 등록보다 먼저 만들어졌다. 영상은 방송 전에 바뀌었다.`, checks: ["changedBeforeAir"] },
    { text: "작업 기록은 편집자 계정으로 남았다. 그러나 계정의 주인이 그 작업을 했는지는 아직 알 수 없다.", checks: ["accountOwnerOpen"] },
  ],
  reward: 120,
  ending: {
    lines: ["영상은 누군가에 의해 수정됐다.", "그런데 편집 기록을 남긴 계정의 소유자가 범인이라는 보장은 없다."],
    evidence: E2.notice,
    open: [
      { claim: "gaeul", text: "영상을 고친 사람은 누구인가" },
      { claim: "dead", text: "BJ 토끼는 살아 있는가" },
    ],
    next: { no: 3, title: "세 사람의 비밀" },
    still: "편집실 모니터에 두 영상이 나란히 멈춰 있다.",
  },
};
