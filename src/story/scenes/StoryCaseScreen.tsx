import { useEffect, useState } from "react";
import { navigate, withTransition } from "../../app/router";
import { gameStore, useGame } from "../../app/store";
import type { GameState } from "../../engine/types";
import { findCase, findChapter, playableChapters } from "../cases";
import { caseStatus, chapterCleared, chapterUnlocked, getChapter, nextChapter, sceneReachable, storyUnlocked } from "../engine/storyEngine";
import type { StoryCase, StoryScene } from "../engine/storyTypes";
import type { SceneProps } from "../components/StoryParts";
import { BroadcastRoom } from "./BroadcastRoom";
import { CaseRecord } from "./CaseRecord";
import { ChapterEnding } from "./ChapterEnding";
import { DayTimeline } from "./DayTimeline";
import { EditLogOrder } from "./EditLogOrder";
import { EvidenceDesk } from "./EvidenceDesk";
import { FinalDeduction } from "./FinalDeduction";
import { RecordPicker } from "./RecordPicker";
import { StoryIntro } from "./StoryIntro";
import { TestimonyRoom } from "./TestimonyRoom";
import { TransmissionLog } from "./TransmissionLog";
import { VideoCompare } from "./VideoCompare";

/** 장면의 종류마다 그것을 그리는 화면 */
function SceneView({ scene, ...props }: SceneProps & { scene: StoryScene }) {
  switch (scene.kind) {
    case "timeline":
      return <BroadcastRoom {...props} scene={scene} />;
    case "records":
      // 고를 기록이 자료에 적혀 있으면 그것을 그리고, 없으면(제1장) 방송 플랫폼의 단말기를 연다
      return scene.records ? <RecordPicker {...props} scene={scene} /> : <TransmissionLog {...props} scene={scene} />;
    case "link":
      return <EvidenceDesk {...props} scene={scene} />;
    case "deduce":
      return <FinalDeduction {...props} scene={scene} />;
    case "compare":
      return <VideoCompare {...props} scene={scene} />;
    case "order":
      return <EditLogOrder {...props} scene={scene} />;
    case "testimony":
      return <TestimonyRoom {...props} scene={scene} />;
    case "assign":
      return <DayTimeline {...props} scene={scene} />;
  }
}

/** 사건 기록(장을 고르는 곳)을 가리키는 주소의 이름 */
const RECORD = "record";

/**
 * 들어선 순간에 열 곳을 정한다: 장의 이름표, 또는 사건 기록.
 *  - 장을 골라 들어왔으면(주소의 chapter) 그 장. 없는 장·잠긴 장이면 아래의 "풀 차례"를 따른다.
 *  - 끝 장면을 다 보지 못한 장이 있으면 그 장(결과를 받는다).
 *  - 풀던 장이 있으면 그 장면에서 잇는다. 처음 맡는 사건이면 제1장의 사건 접수.
 *  - 장과 장 사이(다음 장이 아직 새 장)이거나 사건을 다 풀었으면 사건 기록.
 */
function resolveView(state: GameState, c: StoryCase, wanted?: string): string {
  if (wanted && wanted !== RECORD) {
    const asked = findChapter(c, wanted);
    if (asked && playableChapters(c).includes(asked) && chapterUnlocked(state, c, asked)) return asked.id;
  }
  const all = playableChapters(c);
  if (wanted === RECORD && caseStatus(state, c) !== "new") return RECORD;
  const pending = all.find((ch) => {
    const p = getChapter(state, c, ch);
    return p.status === "cleared" && !p.endingSeen;
  });
  if (pending) return pending.id;
  const next = nextChapter(state, c);
  if (!next) return RECORD;
  if (getChapter(state, c, next).status !== "new") return next.id;
  return all.some((ch) => chapterCleared(getChapter(state, c, ch))) ? RECORD : next.id;
}

/**
 * 사건 수사 화면. 주소가 가리키는 곳(#/story/사건, #/story/사건/장, #/story/사건/record)을 연다.
 * 장 안에서는 저장된 진행이 가리키는 곳(도입 · 장면 · 끝 장면)을 열고, 해결한 장은 사건 기록에서 다시 고른다.
 * 맡을 수 없는 등급이거나 없는 사건이면 홈으로 돌아간다.
 */
export function StoryCaseScreen({ id, chapter }: { id: string; chapter?: string }) {
  const game = useGame();
  const c = findCase(id);
  const unlocked = !!c && storyUnlocked(game, c);
  // 푸는 동안 "풀 차례의 장"이 바뀌어도(장을 해결하는 순간) 화면이 다른 장으로 갈아타지 않게, 들어설 때 한 번만 정한다
  const [view] = useState(() => (c && unlocked ? resolveView(game, c, chapter) : null));
  const ch = c && view && view !== RECORD ? findChapter(c, view) : null;
  const open = !!c && unlocked && !!view && (view === RECORD || (!!ch && chapterUnlocked(game, c, ch)));

  useEffect(() => {
    if (!open) navigate({ name: "home" }, { replace: true });
  }, [open]);

  if (!c || !open) return null;

  const home = () => navigate({ name: "home" });
  const toRecord = () => navigate({ name: "story", id: c.id, chapter: RECORD }, { replace: true });
  const toChapter = (to: string) => navigate({ name: "story", id: c.id, chapter: to }, { replace: true });

  if (!ch) return <CaseRecord key="record" c={c} onExit={home} onOpen={toChapter} />;

  const p = getChapter(game, c, ch);
  const cleared = p.status === "cleared";
  const places = ["intro", ...ch.scenes.map((s) => s.id), "ending", RECORD];
  const go = (to: string) => {
    if (!sceneReachable(p, ch, to)) return;
    const back = places.indexOf(to) < places.indexOf(p.scene) && to !== RECORD;
    withTransition(() => gameStore.storyGo(c, ch, to), back ? "back" : "forward");
  };

  if (!p.introSeen || p.scene === "intro") {
    // 사건 접수 서류는 사건을 처음 맡을 때 한 번만 본다. 다음 장부터는 그 장의 도입 글만 나온다.
    const first = c.chapters[0].id === ch.id;
    return <StoryIntro key={`intro-${ch.id}`} c={c} ch={ch} seen={p.introSeen} file={first} onExit={first ? home : toRecord} onStart={() => withTransition(() => gameStore.storyIntroSeen(c, ch))} />;
  }

  if (cleared && p.scene === "ending") {
    const after = c.chapters[c.chapters.findIndex((x) => x.id === ch.id) + 1];
    const next = after && playableChapters(c).includes(after) ? after : null;
    const finish = (then: () => void) => () => {
      gameStore.storyFinish(c, ch);
      then();
    };
    return <ChapterEnding key={`ending-${ch.id}`} c={c} ch={ch} p={p} onRecord={() => withTransition(() => gameStore.storyFinish(c, ch))} onHome={finish(home)} onNext={next ? finish(() => toChapter(next.id)) : undefined} />;
  }

  // 해결한 장은 사건 기록에서 본다(끝 장면 다시 보기, 다시 풀기)
  if (cleared && p.scene === RECORD) return <CaseRecord key="record" c={c} onExit={home} onOpen={toChapter} />;

  const scene = ch.scenes.find((s) => s.id === p.scene) ?? ch.scenes[0];
  // 뒤로 단추: 해결한 장의 장면을 다시 보던 중이면 그 장의 기록으로, 해결한 장이 하나라도 있으면 사건 기록으로, 아니면 홀로
  const hub = playableChapters(c).some((x) => chapterCleared(getChapter(game, c, x)));
  const onExit = cleared ? () => withTransition(() => gameStore.storyGo(c, ch, RECORD), "back") : hub ? toRecord : home;
  return <SceneView key={`${ch.id}-${scene.id}`} scene={scene} c={c} ch={ch} p={p} go={go} onExit={onExit} exitLabel={cleared || hub ? "사건 기록으로" : "학원 홀로"} />;
}
