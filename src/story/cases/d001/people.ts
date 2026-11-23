/**
 * CASE D-001 의 등장인물. 이름·나이·역할은 지시서가 정했다(지어낸 인물이다. 실제 인물과 관계없다).
 * 여기에는 사건 접수 화면에 나와도 되는 것만 적는다: 누가 무엇을 숨겼는지는 장의 자료와 판정에 있다.
 */
import type { StoryPerson } from "../../engine/storyTypes";

export const SEORIN = "seorin";
export const SANGMIN = "sangmin";
export const GAEUL = "gaeul";
export const DOHEE = "dohee";

/** 기록에 이름으로 남는 네 사람 */
export const NAMED = [SANGMIN, GAEUL, DOHEE, SEORIN] as const;
export type Named = (typeof NAMED)[number];

export const CAST: StoryPerson[] = [
  { id: SEORIN, name: "윤서린", age: 27, role: "BJ 토끼 · 구독자 38만의 방송인", from: 3 },
  { id: SANGMIN, name: "오상민", age: 34, role: "매니저 · 채널 운영과 계약, 수익 담당", from: 3 },
  { id: GAEUL, name: "한가을", age: 25, role: "영상 편집자", from: 2 },
  { id: DOHEE, name: "강도희", age: 22, role: "팬클럽 운영자 · 의뢰인", from: 3 },
];

export const NAME: Record<string, string> = Object.fromEntries(CAST.map((person) => [person.id, person.name]));

/** 받침이 있으면 앞의 조사, 없으면 뒤의 조사 ("은"/"는", "이"/"가") */
export function josa(word: string, withFinal: string, without: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return withFinal;
  return code % 28 === 0 ? without : withFinal;
}

/** 숫자로 끝나는 말(시각, 번호)에 붙는 조사: 0·1·3·6·7·8 로 끝나면 받침이 있다 */
export const numJosa = (text: string, withFinal: string, without: string): string => ("013678".includes(text[text.length - 1]) ? withFinal : without);

/** "오상민은", "강도희는" */
export const topic = (id: string): string => `${NAME[id]}${josa(NAME[id], "은", "는")}`;

/** "23:47" 을 분으로 */
export const toMinutes = (clock: string): number => {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
};

export interface Span {
  from: string;
  to: string;
}

/** 그 시각이 구간들 가운데 하나에 들어 있는가 (양 끝 포함) */
export const within = (spans: readonly Span[], clock: string): boolean => spans.some((span) => toMinutes(span.from) <= toMinutes(clock) && toMinutes(clock) <= toMinutes(span.to));

/** 구간들 가운데 하나가 from~to 를 처음부터 끝까지 덮는가 */
export const covers = (spans: readonly Span[], from: string, to: string): boolean => spans.some((span) => toMinutes(span.from) <= toMinutes(from) && toMinutes(to) <= toMinutes(span.to));
