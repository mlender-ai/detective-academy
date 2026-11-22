import { Sprite } from "../../art/pixel";
import { DeskWood } from "../../components/DeskWood";
import { Stamp } from "../../components/Stamp";
import { EvidenceCard } from "../components/StoryParts";
import type { ChapterProgress, StoryCase, StoryChapter } from "../engine/storyTypes";

interface Props {
  c: StoryCase;
  ch: StoryChapter;
  p: ChapterProgress;
  go: (id: string) => void;
  onExit: () => void;
}

/**
 * 사건 기록. 해결한 장의 결론, 확정한 사실, 모은 증거, 그리고 아직 모르는 것을 한 장에 적어 둔다.
 * 여기서 장면을 다시 볼 수 있다. 아직 없는 다음 장으로 가는 단추는 두지 않는다.
 */
export function CaseRecord({ c, ch, p, go, onExit }: Props) {
  const deduce = ch.scenes.find((s) => s.kind === "deduce");
  const conclusion = deduce?.kind === "deduce" ? deduce.choices.find((x) => x.id === p.deduction.choice)?.text : null;
  const facts = ch.scenes.flatMap((s) => (s.kind === "link" ? s.facts.filter((f) => p.facts.includes(f.id)) : []));
  const evidence = ch.evidence.filter((e) => p.evidence.includes(e.id));
  const next = ch.ending.next;

  return (
    <div className="screen desk inkworld story caserecord" data-testid="story-record">
      <DeskWood />
      <header className="deskbar">
        <button type="button" className="tilebtn" aria-label="학원 복도로" onClick={onExit} data-testid="story-back">
          <Sprite name="arrow-left" />
        </button>
        <p className="deskbar__tag leaf">
          <span className="deskbar__type">{c.code} · 사건 기록</span>
        </p>
      </header>

      <div className="story__scroll">
        <section className="record leaf">
          <div className="record__head">
            <div>
              <p className="record__case">
                {c.title} · 제{ch.no}장
              </p>
              <h1 className="record__chapter">{ch.title}</h1>
            </div>
            <Stamp label="해결" size={72} />
          </div>

          <h2 className="record__label">확인된 것</h2>
          <p className="record__conclusion" data-testid="record-conclusion">
            {conclusion}
          </p>
          <ul className="record__facts">
            {facts.map((f) => (
              <li key={f.id}>
                <b>{f.no}</b>
                {f.text}
              </li>
            ))}
          </ul>

          <h2 className="record__label">아직 모르는 것</h2>
          <ul className="record__open" data-testid="record-open">
            {ch.ending.open.map((q) => (
              <li key={q.claim}>{q.text}</li>
            ))}
          </ul>

          <h2 className="record__label">증거 {evidence.length}</h2>
          <div className="record__evidence">
            {evidence.map((e) => (
              <EvidenceCard key={e.id} evidence={e} compact />
            ))}
          </div>

          {next && (
            <p className="ending__next" data-testid="record-next">
              <span>다음 장</span>
              <b>
                제{next.no}장 · {next.title}
              </b>
              <span>준비 중</span>
            </p>
          )}
        </section>
      </div>

      <footer className="deskfoot">
        <button type="button" className="inkbtn" onClick={() => go("ending")} data-testid="record-ending">
          끝 장면
        </button>
        <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" onClick={() => go(ch.scenes[0].id)} data-testid="record-replay">
          장면 다시 보기
        </button>
      </footer>
    </div>
  );
}
