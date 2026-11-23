import { useState, type CSSProperties } from "react";
import { playSound } from "../../app/sound";
import { gameStore } from "../../app/store";
import { Narration } from "../../components/Narration";
import type { StreamFrameId } from "../art/broadcastArt";
import { PLATFORM } from "../cases/d001/case";
import { BroadcastTimeline } from "../components/BroadcastTimeline";
import { EvidenceGain, StoryShell, type SceneProps } from "../components/StoryParts";
import { StreamView } from "../components/StreamView";
import { sceneAfter } from "../engine/storyEngine";
import type { InvestigatePoint, TimelineScene } from "../engine/storyTypes";

/** 마지막으로 보던 시점. 다른 장면에 다녀와도 그 시점에서 잇는다. */
const lastFrame = new Map<string, string>();

/**
 * SCENE 01 · 마지막 방송. 오래된 모니터 안에서 방송 기록이 재생된다.
 * 타임라인으로 시점을 옮기고, 화면의 곳곳(LIVE 표시, 시계, 제목, 가면, 채팅창…)을 눌러 조사한다.
 * 조사한 것은 수사 노트에 적히고, 필요한 네 가지가 모이면 증거 01 이 완성된다.
 */
export function BroadcastRoom(props: SceneProps & { scene: TimelineScene }) {
  const { c, ch, p, go, scene } = props;
  // 아직 아무것도 조사하지 않았으면(처음, 또는 다시 풀기를 막 시작했으면) 첫 시점부터 본다
  const [frameId, setFrameId] = useState(() => (p.notes.length > 0 ? lastFrame.get(scene.id) : undefined) ?? scene.frames[0].id);
  const [line, setLine] = useState(scene.enter);
  const [gain, setGain] = useState(false);
  const frame = scene.frames.find((f) => f.id === frameId) ?? scene.frames[0];
  const ended = frame.id === scene.frames[scene.frames.length - 1].id;
  const done = p.evidence.includes(scene.grants);
  const required = scene.points.filter((point) => point.required);
  const found = required.filter((point) => p.notes.includes(point.id)).length;
  const lengthSec = scene.frames[scene.frames.length - 1].at;
  const evidence = ch.evidence.find((e) => e.id === scene.grants)!;

  const seek = (id: string) => {
    lastFrame.set(scene.id, id);
    setFrameId(id);
    setLine(scene.frames.find((f) => f.id === id)!.caption);
  };

  const look = (point: InvestigatePoint) => {
    const outcome = gameStore.storyInvestigate(c, ch, scene.id, point.id);
    setLine(point.line);
    if (outcome.fresh) playSound("place");
    if (outcome.granted) setGain(true);
  };

  const point = (id: string) => scene.points.find((x) => x.id === id)!;
  // 이 시점의 화면에서 조사할 수 있는 곳 (타임라인의 길이와 채팅창은 따로 놓인다)
  const hots = scene.points.filter((x) => x.area[2] > 0 && (!x.frames || x.frames.includes(frame.id)));
  const live = hots.some((x) => x.id === "live");

  return (
    <StoryShell
      {...props}
      current={scene.id}
      foot={
        <button
          type="button"
          className="inkbtn inkbtn--wine deskfoot__submit"
          disabled={!done}
          onClick={() => go(sceneAfter(ch, scene.id))}
          data-testid="story-next"
        >
          전송 기록 확인
        </button>
      }
    >
      <div className="crt" data-ended={ended}>
        <p className="crt__bar">
          <span>{PLATFORM.name}</span>
          <span>{PLATFORM.channel} · 2026.11.21 다시보기</span>
        </p>

        <div className="crt__screen" data-testid="stream" data-frame={frame.id}>
          <StreamView frame={frame.id as StreamFrameId} />
          {live && (
            <span className="crt__live" aria-hidden="true">
              <i />
              LIVE
            </span>
          )}
          {frame.id === scene.frames[0].id && (
            <span className="crt__clock num" aria-hidden="true">
              {frame.clock}
            </span>
          )}
          {!ended && (
            <span className="crt__title" aria-hidden="true">
              오늘 밤, 토끼는 죽습니다.
            </span>
          )}
          {ended && (
            <span className="crt__end" aria-hidden="true">
              <b>방송이 종료되었습니다</b>
              <span className="num">{frame.clock}</span>
            </span>
          )}

          {hots.map((x) => (
            <button
              key={x.id}
              type="button"
              className="hot"
              data-noted={p.notes.includes(x.id)}
              data-testid={`point-${x.id}`}
              aria-label={`${x.label} 조사${p.notes.includes(x.id) ? " (조사함)" : ""}`}
              style={{ left: `${x.area[0]}%`, top: `${x.area[1]}%`, width: `${x.area[2]}%`, height: `${x.area[3]}%` } as CSSProperties}
              onClick={() => look(x)}
            >
              <i />
              <i />
              <i />
              <i />
            </button>
          ))}
        </div>

        <button
          type="button"
          className="crt__chat"
          data-noted={p.notes.includes("chat")}
          onClick={() => look(point("chat"))}
          aria-label="채팅창 조사"
          data-testid="point-chat"
        >
          {frame.chat.map(([who, text], i) => (
            <span key={`${frame.id}-${i}`} className="crt__chatline" style={{ animationDelay: `${i * 260}ms` }}>
              <b>{who}</b>
              {text}
            </span>
          ))}
        </button>

        <BroadcastTimeline
          frames={scene.frames}
          lengthSec={lengthSec}
          current={frame.id}
          onSeek={seek}
          lengthNoted={p.notes.includes("length")}
          onLength={() => look(point("length"))}
          aside={
            <p className="story__tally" data-testid="broadcast-tally" data-done={done} aria-label={`방송 기록 ${found}/${required.length}`}>
              <span>방송 기록</span>
              <b className="num">
                {found}/{required.length}
              </b>
            </p>
          }
        />
      </div>

      <Narration text={done && line === scene.enter ? scene.done : line} />

      {gain && (
        <EvidenceGain
          evidence={[evidence]}
          onClose={() => {
            setGain(false);
            setLine(scene.done);
          }}
        />
      )}
    </StoryShell>
  );
}
