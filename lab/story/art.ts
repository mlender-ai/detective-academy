// 방송실 그림 검수: 네 시점을 크게(점 하나 = 4px) 나란히 그린다. ?t=초 로 멈춘 시각을 고른다(없으면 움직인다).
import { Stage, runLoop } from "../../src/scene/stage";
import { SH, SW, paintStream, streamFrame, type StreamFrameId } from "../../src/story/art/broadcastArt";

const art = paintStream();
const grid = document.getElementById("grid")!;
const fixed = new URLSearchParams(location.search).get("t");
const scale = Number(new URLSearchParams(location.search).get("k") ?? 4);
const frames: StreamFrameId[] = ["t0015", "t0310", "t0640", "t0700"];
const stages = frames.map((id) => {
  const figure = document.createElement("figure");
  const canvas = document.createElement("canvas");
  canvas.style.width = `${SW * scale}px`;
  canvas.style.height = `${SH * scale}px`;
  const caption = document.createElement("figcaption");
  caption.textContent = id;
  figure.append(canvas, caption);
  grid.append(figure);
  return { id, stage: new Stage(canvas, SW, SH) };
});
let time = 0;
const draw = () => stages.forEach(({ id, stage }) => stage.draw(streamFrame(art, id, fixed ? Number(fixed) : time, false)));
if (fixed) draw();
else
  runLoop((dt) => {
    time += dt;
    draw();
  });
