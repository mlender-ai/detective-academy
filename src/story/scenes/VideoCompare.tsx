import { useRef, useState, type PointerEvent } from "react";
import { playSound } from "../../app/sound";
import { gameStore } from "../../app/store";
import { Narration } from "../../components/Narration";
import type { StreamFrameId } from "../art/broadcastArt";
import { EvidenceGain, StoryShell, nextLabel, type SceneProps } from "../components/StoryParts";
import { StreamView } from "../components/StreamView";
import { differenceKey, differencesOf, sceneAfter, sceneDone } from "../engine/storyEngine";
import type { CompareField, CompareScene } from "../engine/storyTypes";

/** 마지막으로 보던 묶음. 다른 장면에 다녀와도 거기서 잇는다. */
const lastFrame = new Map<string, string>();

/** 화면 그 자체를 가리키는 칸의 이름: 이 칸은 글자가 아니라 그림(화면)으로 놓인다 */
const PICTURE = "picture";

/**
 * 두 판의 비교. 같은 시점의 두 화면이 위아래로 놓여 함께 돌아간다. 시점을 넘기며 두 화면을 견주고,
 * 달라 보이는 곳(화면, 제목, 자막, 파일 정보의 칸)을 직접 누르면 "여기가 달라졌다"고 짚은 것이다.
 * 정말 다른 곳이면 두 판의 그 자리가 함께 뒤집혀 남고, 같은 곳이면 같다는 것을 듣는다(틀린 것으로 센다).
 * 다른지는 엔진이 두 값으로 판정한다. 달라진 곳을 모두 찾으면 증거를 얻는다.
 */
export function VideoCompare(props: SceneProps & { scene: CompareScene }) {
  const { c, ch, p, go, scene } = props;
  const [frameId, setFrameId] = useState(() => lastFrame.get(scene.id) ?? scene.frames[0].id);
  const done = sceneDone(p, scene);
  const [line, setLine] = useState(done ? scene.done : scene.enter);
  const [gain, setGain] = useState<string[]>([]);
  // 같다고 들은 곳: 다시 눌러도 틀린 횟수를 또 세지 않는다
  const [same, setSame] = useState<string[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const index = Math.max(0, scene.frames.findIndex((f) => f.id === frameId));
  const frame = scene.frames[index];
  const total = differencesOf(scene).length;
  const found = differencesOf(scene).filter((d) => p.notes.includes(d.key)).length;

  const seek = (id: string) => {
    if (id === frameId) return;
    playSound("tick");
    lastFrame.set(scene.id, id);
    setFrameId(id);
    setLine(scene.frames.find((f) => f.id === id)!.caption);
  };

  const nearest = (clientX: number) => {
    const box = trackRef.current!.getBoundingClientRect();
    const at = Math.max(0, Math.min(1, (clientX - box.left) / box.width));
    return scene.frames[Math.round(at * (scene.frames.length - 1))];
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    seek(nearest(event.clientX).id);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) seek(nearest(event.clientX).id);
  };
  const stop = () => {
    dragging.current = false;
  };

  const stateOf = (field: CompareField): "found" | "same" | "open" => {
    const key = differenceKey(frame.id, field.id);
    return p.notes.includes(key) ? "found" : same.includes(key) ? "same" : "open";
  };

  const mark = (field: CompareField) => {
    const key = differenceKey(frame.id, field.id);
    if (same.includes(key)) {
      setLine(field.same);
      return;
    }
    const outcome = gameStore.storyMark(c, ch, scene.id, frame.id, field.id);
    if (outcome.kind === "none") return;
    setLine(outcome.text);
    if (outcome.kind === "found") {
      playSound("stamp");
      if (outcome.granted.length > 0) setGain(outcome.granted);
    } else if (outcome.kind === "same") {
      playSound("wrong");
      setSame((now) => [...now, key]);
    } else {
      playSound("tick");
    }
  };

  const picture = frame.fields.find((f) => f.id === PICTURE);
  const texts = frame.fields.filter((f) => f.id !== PICTURE);
  const mine = frame.fields.filter((f) => stateOf(f) === "found").length;
  const tag = { found: "달라짐", same: "같음", open: "" } as const;

  return (
    <StoryShell
      {...props}
      current={scene.id}
      foot={
        <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" disabled={!done} data-long={nextLabel(ch, scene.id).length > 7} onClick={() => go(sceneAfter(ch, scene.id))} data-testid="story-next">
          {nextLabel(ch, scene.id)}
        </button>
      }
    >
      <div className="cmp" data-testid="compare" data-frame={frame.id} data-found={mine}>
        {scene.sides.map((side, s) => {
          const which = s === 0 ? "a" : "b";
          return (
            <section className="cmp__pane" key={side.id} aria-label={side.title} data-side={which}>
              <p className="cmp__label">
                <b>{side.title}</b>
                <span className="num">{side.sub}</span>
              </p>
              {frame.still ? (
                <div className="cmp__screen">
                  <StreamView frame={frame.still as StreamFrameId} />
                  {picture && (
                    <button
                      type="button"
                      className="hot cmp__pic"
                      data-noted={stateOf(picture) !== "open"}
                      data-state={stateOf(picture)}
                      aria-label={`${side.title}의 ${picture.label}: ${which === "a" ? picture.a : picture.b}. 달라진 곳으로 짚기`}
                      onClick={() => mark(picture)}
                      data-testid={`cmp-${picture.id}-${which}`}
                    >
                      <i />
                      <i />
                      <i />
                      <i />
                      {stateOf(picture) !== "open" && <em>{tag[stateOf(picture)]}</em>}
                    </button>
                  )}
                  {texts.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      className="cmp__cap"
                      data-state={stateOf(field)}
                      aria-label={`${side.title}의 ${field.label}: ${which === "a" ? field.a : field.b}. 달라진 곳으로 짚기`}
                      onClick={() => mark(field)}
                      data-testid={`cmp-${field.id}-${which}`}
                    >
                      <span className="cmp__caplabel">
                        {field.label}
                        {stateOf(field) !== "open" && <em>{tag[stateOf(field)]}</em>}
                      </span>
                      <span className="cmp__captext">{which === "a" ? field.a : field.b}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="cmp__sheet">
                  {frame.fields.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      className="cmp__row"
                      data-state={stateOf(field)}
                      aria-label={`${side.title}의 ${field.label}: ${which === "a" ? field.a : field.b}. 달라진 곳으로 짚기`}
                      onClick={() => mark(field)}
                      data-testid={`cmp-${field.id}-${which}`}
                    >
                      <span>
                        {field.label}
                        {stateOf(field) !== "open" && <em>{tag[stateOf(field)]}</em>}
                      </span>
                      <b className="num">{which === "a" ? field.a : field.b}</b>
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        <div className="tline cmp__tabs" data-testid="compare-tabs">
          <button type="button" className="tline__step" aria-label="앞 시점" disabled={index === 0} onClick={() => seek(scene.frames[index - 1].id)} data-testid="compare-prev">
            ◀
          </button>
          <div className="tline__track" ref={trackRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={stop} onPointerCancel={stop}>
            <span className="tline__rail" aria-hidden="true" />
            <span className="tline__fill" aria-hidden="true" style={{ width: `${(index / (scene.frames.length - 1)) * 100}%` }} />
            {scene.frames.map((f, i) => (
              <button
                key={f.id}
                type="button"
                className="tline__tick"
                style={{ left: `${(i / (scene.frames.length - 1)) * 100}%` }}
                aria-pressed={f.id === frame.id}
                aria-label={`${f.tab} 견주기`}
                data-testid={`tab-${f.id}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => seek(f.id)}
              >
                <span className="num" aria-hidden="true">
                  {f.tab}
                </span>
              </button>
            ))}
          </div>
          <button type="button" className="tline__step" aria-label="다음 시점" disabled={index === scene.frames.length - 1} onClick={() => seek(scene.frames[index + 1].id)} data-testid="compare-next">
            ▶
          </button>
          <div className="tline__time">
            <p className="cmp__ask">{scene.question}</p>
            <p className="story__tally" data-testid="compare-tally" data-done={done} aria-label={`달라진 곳 ${found}/${total}`}>
              <span>달라진 곳</span>
              <b className="num">
                {found}/{total}
              </b>
            </p>
          </div>
        </div>
      </div>

      <Narration text={line} />

      {gain.length > 0 && (
        <EvidenceGain
          evidence={ch.evidence.filter((e) => gain.includes(e.id))}
          onClose={() => {
            setGain([]);
            setLine(scene.done);
          }}
        />
      )}
    </StoryShell>
  );
}
