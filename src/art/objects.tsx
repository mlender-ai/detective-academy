import type { RankId } from "../engine/types";
import { Sprite } from "./pixel";

/**
 * 학원의 물건들. 모두 점으로 찍은 스프라이트이고, 점 크기를 지키기 위해 정해진 크기로 그린다.
 * 장식용이므로 스크린리더에는 숨기고, 이름은 감싸는 버튼·문단이 갖는다.
 */

interface ArtProps {
  className?: string;
}

/** 학원 엠블럼: 방패 안의 돋보기와 열쇠 구멍 */
export function Crest({ className }: ArtProps) {
  return <Sprite name="crest" className={className} />;
}

/** 작은 등급 표식 (네모 칩) */
export function RankMark({ rank, className }: ArtProps & { rank: RankId }) {
  return (
    <span className={["pxrank", className].filter(Boolean).join(" ")} data-rank={rank} aria-hidden="true">
      {rank}
    </span>
  );
}

/** 큰 등급 휘장: 방패 위에 등급 글자 (신분증·승급 증서) */
export function RankMedal({ rank, className }: ArtProps & { rank: RankId }) {
  return (
    <span className={["pxmedal", className].filter(Boolean).join(" ")} data-rank={rank} aria-hidden="true">
      <Sprite name="medal" rank={rank} />
      <b>{rank}</b>
    </span>
  );
}

export function Pushpin({ className }: ArtProps) {
  return <Sprite name="pin" className={className} />;
}

/** 게시판의 작은 시험 봉투 */
export function EnvelopeArt({ className, open = false }: ArtProps & { open?: boolean }) {
  return <Sprite name={open ? "envelope-open" : "envelope"} className={className} />;
}

export function KeyArt({ className }: ArtProps) {
  return <Sprite name="key" className={className} />;
}

export function IdArt({ className, rank }: ArtProps & { rank: RankId }) {
  return <Sprite name="id" rank={rank} className={className} />;
}

/** 수사 크레딧 주화. count 가 1 이면 앞에서 본 한 닢, 아니면 쌓인 주화 */
export function CoinsArt({ className, count = 3 }: ArtProps & { count?: 1 | 2 | 3 }) {
  return <Sprite name={count === 1 ? "coin" : "coins"} className={className} />;
}

export function PencilArt({ className }: ArtProps) {
  return <Sprite name="pencil" className={className} />;
}
