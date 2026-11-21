import type { ReactNode } from "react";
import { Crest, RankMedal } from "../art/objects";
import { CADET, Portrait } from "../art/portraits";
import { rankLabel } from "../data/ranks";
import { dottedDate } from "../engine/time";
import type { RankId } from "../engine/types";

interface Props {
  nickname: string;
  /** null 이면 아직 발급 전 */
  rank: RankId | null;
  detectiveNo: string;
  issuedAt: string | null;
  /** 이름 칸을 입력 필드 등으로 바꿀 때 */
  nameSlot?: ReactNode;
  /** 등급 표식이 새로 찍히는 연출 */
  engrave?: boolean;
  /** 카드 위에 겹쳐 올릴 것 (인장 등) */
  overlay?: ReactNode;
  className?: string;
}

/** 탐정 신분증. 학원이 발급한 종이 신분증이다. */
export function IdCard({ nickname, rank, detectiveNo, issuedAt, nameSlot, engrave = false, overlay, className }: Props) {
  return (
    <div className={["idcard leaf", className].filter(Boolean).join(" ")} data-rank={rank ?? "none"} data-testid="id-card">

      <div className="idcard__head">
        <Crest />
        <p className="idcard__org">
          <span>탐정학원</span>
          <span>DETECTIVE ACADEMY</span>
        </p>
        <span className="idcard__kind">탐정 신분증</span>
      </div>
      <span className="idcard__band" aria-hidden="true" />

      <div className="idcard__body">
        <div className="idcard__photo" aria-hidden="true">
          <Portrait spec={CADET} />
        </div>

        <dl className="idcard__fields">
          <div className="idcard__field idcard__field--name">
            <dt>이름</dt>
            <dd className="hand" data-testid="id-nickname">
              {nameSlot ?? nickname}
            </dd>
          </div>
          <div className="idcard__field">
            <dt>등급</dt>
            <dd data-testid="id-rank">{rank ? rankLabel(rank) : "입학 전"}</dd>
          </div>
          <div className="idcard__row">
            <div className="idcard__field">
              <dt>학번</dt>
              <dd className="hand num">{detectiveNo || "발급 전"}</dd>
            </div>
            <div className="idcard__field">
              <dt>발급일</dt>
              <dd className="hand num">{issuedAt ? dottedDate(issuedAt) : "-"}</dd>
            </div>
          </div>
        </dl>

        <div className="idcard__badge" data-engrave={engrave}>
          {rank ? <RankMedal rank={rank} /> : <span className="idcard__badge-empty" aria-hidden="true" />}
        </div>
      </div>

      <div className="idcard__foot" aria-hidden="true">
        <span>VERITAS · RATIO</span>
      </div>

      {overlay}
    </div>
  );
}
