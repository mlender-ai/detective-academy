import { useEffect, useRef } from "react";
import { navigate, withTransition } from "../../app/router";
import { gameStore, useGame } from "../../app/store";
import { CASE_BY_ID, playableChapters } from "../cases";
import { getChapter, sceneReachable, storyUnlocked } from "../engine/storyEngine";
import type { StoryScene } from "../engine/storyTypes";
import type { SceneProps } from "../components/StoryParts";
import { BroadcastRoom } from "./BroadcastRoom";
import { CaseRecord } from "./CaseRecord";
import { ChapterEnding } from "./ChapterEnding";
import { EvidenceDesk } from "./EvidenceDesk";
import { FinalDeduction } from "./FinalDeduction";
import { StoryIntro } from "./StoryIntro";
import { TransmissionLog } from "./TransmissionLog";

/** 장면의 종류마다 그것을 그리는 화면 */
function SceneView({ scene, ...props }: SceneProps & { scene: StoryScene }) {
  switch (scene.kind) {
    case "timeline":
      return <BroadcastRoom {...props} scene={scene} />;
    case "records":
      return <TransmissionLog {...props} scene={scene} />;
    case "link":
      return <EvidenceDesk {...props} scene={scene} />;
    case "deduce":
      return <FinalDeduction {...props} scene={scene} />;
  }
}

/**
 * 사건 수사 화면. 저장된 진행이 가리키는 곳(도입 · 장면 · 끝 장면 · 사건 기록)을 연다.
 * 해결한 사건에 다시 들어오면 사건 기록이 열리고, 거기서 장면을 다시 볼 수 있다.
 */
export function StoryCaseScreen({ id }: { id: string }) {
  const game = useGame();
  const c = CASE_BY_ID[id];
  const unlocked = !!c && storyUnlocked(game, c);
  const entered = useRef(false);

  useEffect(() => {
    if (!unlocked) navigate({ name: "home" }, { replace: true });
  }, [unlocked]);

  const ch = c ? playableChapters(c)[0] : null;
  const p = c && ch ? getChapter(game, c, ch) : null;

  // 끝까지 본 사건에 다시 들어오면 사건 기록부터 연다
  useEffect(() => {
    if (entered.current || !c || !ch || !p || !unlocked) return;
    entered.current = true;
    if (p.status === "cleared" && p.endingSeen && p.scene !== "record") gameStore.storyGo(c, ch, "record");
  }, [c, ch, p, unlocked]);

  if (!c || !ch || !p || !unlocked) return null;

  const cleared = p.status === "cleared";
  const home = () => navigate({ name: "home" });
  const order = ["intro", ...ch.scenes.map((s) => s.id), "ending", "record"];
  const go = (to: string) => {
    if (!sceneReachable(p, ch, to)) return;
    const back = order.indexOf(to) < order.indexOf(p.scene) && to !== "record";
    withTransition(() => gameStore.storyGo(c, ch, to), back ? "back" : "forward");
  };

  if (!p.introSeen || p.scene === "intro") {
    return <StoryIntro key="intro" c={c} ch={ch} seen={p.introSeen} onExit={home} onStart={() => withTransition(() => gameStore.storyIntroSeen(c, ch))} />;
  }

  if (cleared && p.scene === "ending") {
    return (
      <ChapterEnding
        key="ending"
        c={c}
        ch={ch}
        p={p}
        onRecord={() => withTransition(() => gameStore.storyFinish(c, ch))}
        onHome={() => {
          gameStore.storyFinish(c, ch);
          home();
        }}
      />
    );
  }

  if (cleared && p.scene === "record") {
    return <CaseRecord key="record" c={c} ch={ch} p={p} go={go} onExit={home} />;
  }

  const scene = ch.scenes.find((s) => s.id === p.scene) ?? ch.scenes[0];
  // 해결한 뒤에 장면을 다시 볼 때는 뒤로 단추가 사건 기록으로 돌아간다
  const onExit = cleared ? () => withTransition(() => gameStore.storyGo(c, ch, "record"), "back") : home;
  return <SceneView key={scene.id} scene={scene} c={c} ch={ch} p={p} go={go} onExit={onExit} />;
}
