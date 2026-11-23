/**
 * 장의 끝 장면에 놓이는 그림. 사건의 그림 자료다: 장마다 무엇이 놓이는지는 여기가 안다(자료는 말로만 적어 둔다: ending.still).
 * after 는 그림이 한 번 바뀐 뒤다(끝 글이 나오기 직전). 그림이 없는 장은 아무것도 놓지 않는다.
 */
import type { ReactNode } from "react";
import { PLATFORM } from "../cases/d001/case";
import { D001_CH3 } from "../cases/d001/ch3";
import { ORIGINAL, RELEASED } from "../cases/d001/logic2";
import { StreamView } from "../components/StreamView";
import { Silhouette } from "./castArt";

type Draw = (after: boolean) => ReactNode;

const d001Statements = D001_CH3.scenes.find((s) => s.kind === "testimony");

const STILLS: Record<string, Draw> = {
  // 그날 밤의 방송이 다시 돌아가고, LIVE 표시가 꺼진 자리에 "예약 영상"이 찍힌다
  "d001/ch1": (after) => (
    <span className="crt ending__crt">
      <span className="crt__bar">
        <span>{PLATFORM.name}</span>
        <span>{PLATFORM.channel} · 2026.11.21 다시보기</span>
      </span>
      <span className="crt__screen">
        <StreamView frame={after ? "t0640" : "t0015"} />
        {after ? (
          <span className="crt__live crt__live--tape" data-testid="ending-label">
            예약 영상
          </span>
        ) : (
          <span className="crt__live crt__live--dying" data-testid="ending-label">
            <i />
            LIVE
          </span>
        )}
      </span>
    </span>
  ),
  // 편집실 모니터에 두 영상이 나란히 멈춰 있다: 같은 화면, 다른 제목. 아래 영상의 제목이 눈앞에서 바뀐다
  "d001/ch2": (after) => (
    <span className="crt ending__crt endart" data-art="pair">
      <span className="crt__bar">
        <span>편집실 모니터</span>
        <span>00:15 · 정지</span>
      </span>
      {[ORIGINAL, RELEASED].map((file, i) => (
        <span className="endart__mon" key={file.name}>
          <StreamView frame="t0015" paused />
          <span className="endart__tag num">
            {file.name} · {file.createdAt}
          </span>
          <span className="crt__title" data-swapped={i === 1 && after} data-testid={i === 1 ? "ending-label" : undefined}>
            {i === 1 && after ? RELEASED.title.text : ORIGINAL.title.text}
          </span>
        </span>
      ))}
    </span>
  ),
  // 세 사람의 진술서가 책상 위에 나란히 놓여 있다. 한 장씩 도장이 찍힌다
  "d001/ch3": (after) => (
    <span className="endart" data-art="sheets" data-after={after}>
      {(d001Statements?.kind === "testimony" ? d001Statements.people : []).map((person) => (
        <span className="endart__sheet" key={person.id}>
          <Silhouette id={person.id} />
          <b>{person.name}</b>
          <i />
          <i />
          <i />
          <em data-testid={`ending-mark-${person.id}`}>{after ? "어긋남" : "진술"}</em>
        </span>
      ))}
    </span>
  ),
  // 빈 의자에 걸려 있던 가면이, 불 꺼진 방송실의 책상 위에 놓여 있다
  "d001/ch4": (after) => (
    <span className="crt ending__crt" data-art="mask">
      <span className="crt__bar">
        <span>{PLATFORM.name}</span>
        <span>
          {PLATFORM.channel} · {after ? "방송실" : "2026.11.21 다시보기"}
        </span>
      </span>
      <span className="crt__screen" data-testid="ending-mask" data-after={after}>
        <StreamView frame={after ? "mask" : "t0640"} />
      </span>
    </span>
  ),
};

export const hasEndingStill = (caseId: string, chapterId: string): boolean => `${caseId}/${chapterId}` in STILLS;

export function EndingStill({ caseId, chapterId, after }: { caseId: string; chapterId: string; after: boolean }) {
  const draw = STILLS[`${caseId}/${chapterId}`];
  return draw ? <>{draw(after)}</> : null;
}
