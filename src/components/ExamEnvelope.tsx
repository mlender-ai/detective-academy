import { Sprite } from "../art/pixel";

interface Props {
  /** sealed: 봉인됨 · opening: 뜯는 중 · locked: 응시 조건 미달 */
  state: "sealed" | "opening" | "locked";
  /** 시험지 머리에 보이는 글자 (예: F급 → D급) */
  letterTitle: string;
}

/**
 * 학원 인장으로 봉한 시험 봉투.
 * 젖혀진 덮개·안쪽·시험지·앞주머니·닫힌 덮개를 따로 그려 겹친다. 열면 덮개가 젖혀지고 시험지가 올라온다.
 */
export function ExamEnvelope({ state, letterTitle }: Props) {
  return (
    <div className="envelope" data-state={state} aria-hidden="true">
      <Sprite name="env-lid" untrimmed className="envelope__lid" />
      <Sprite name="env-back" untrimmed className="envelope__back" />

      <div className="envelope__letter leaf">
        <span className="envelope__letter-title">승급 시험</span>
        <span className="envelope__letter-rank">{letterTitle}</span>
        <i />
        <i />
      </div>

      <Sprite name="env-front" untrimmed className="envelope__front" />
      <Sprite name="env-flap" untrimmed className="envelope__flap" />
    </div>
  );
}
