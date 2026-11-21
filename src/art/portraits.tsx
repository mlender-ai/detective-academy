import type { Person } from "../engine/types";
import { Sprite, type PortraitSpec } from "./pixel";

/**
 * 학생 초상. 학생부에 붙은 증명사진처럼 점으로 찍는다.
 * 사람마다 머리 모양과 교복 색이 달라, 색을 구분하기 어려워도 실루엣으로 알아볼 수 있다.
 * 장식용이므로 스크린리더에는 숨기고, 이름은 곁에 글자로 둔다.
 */

export const PORTRAITS: Record<string, PortraitSpec> = {
  hana: { hair: "bob", hairTone: "dark", tone: "green" },
  junho: { hair: "short", hairTone: "brown", tone: "brass", glasses: true },
  sera: { hair: "long", hairTone: "auburn", tone: "wine" },
  daon: { hair: "curly", hairTone: "dark", tone: "steel" },
  doyun: { hair: "side", hairTone: "dark", tone: "brass" },
  minjae: { hair: "crop", hairTone: "brown", tone: "steel", glasses: true },
  sea: { hair: "pony", hairTone: "brown", tone: "wine" },
  harin: { hair: "braid", hairTone: "sand", tone: "green" },
};

/** 신분증 사진: 학원 모자를 쓴 견습 탐정 */
export const CADET: PortraitSpec = { hair: "cap", hairTone: "dark", tone: "navy" };

const FALLBACK: Record<Person["mark"], PortraitSpec> = {
  circle: { hair: "bob", hairTone: "dark", tone: "green" },
  shield: { hair: "short", hairTone: "brown", tone: "brass" },
  hex: { hair: "long", hairTone: "auburn", tone: "wine" },
  diamond: { hair: "crop", hairTone: "dark", tone: "steel" },
};

export function specOf(person: Person): PortraitSpec {
  return PORTRAITS[person.id] ?? FALLBACK[person.mark];
}

interface Props {
  /** 문제 속 인물. 없으면 spec 을 쓰고, 그것도 없으면 견습 탐정을 그린다. */
  person?: Person;
  spec?: PortraitSpec;
  className?: string;
}

export function Portrait({ person, spec, className }: Props) {
  const resolved = spec ?? (person ? specOf(person) : CADET);
  return <Sprite name="portrait" portrait={resolved} className={["portrait", className].filter(Boolean).join(" ")} />;
}
