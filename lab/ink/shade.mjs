// Ink Studio 가 내보낸 스프라이트 묶음(윤곽·법선)을 흰 점·검은 점 두 가지의 그림으로 바꾼다.
//   node lab/ink/shade.mjs <묶음 폴더> <out.png> <out.json>
// 빛은 캐릭터의 앞·왼쪽·위에서 온다(복도의 전등). 법선과 빛의 각도로 밝기를 구해
// 밝은 면은 흰 점, 중간은 격자 점묘, 어두운 면은 검은 점으로 찍고, 둘레에 흰 테를 한 줄 두른다.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

// 넷째 값이 view 이면 빛을 보는 쪽에 고정한다(물건이 돌 때 빛나는 면이 움직인다). 없으면 물건에 고정한다.
const [dir, outPng, outJson, lightMode = "world"] = process.argv.slice(2);
const meta = JSON.parse(readFileSync(`${dir}/atlas.json`, "utf8"));
const b64 = (f) => readFileSync(`${dir}/${f}`).toString("base64");
const browser = await chromium.launch();
const page = await browser.newPage();
const url = await page.evaluate(
  async ({ sil, nor, meta, lightMode }) => {
    const load = async (b) => {
      const i = new Image();
      i.src = "data:image/png;base64," + b;
      await i.decode();
      const c = document.createElement("canvas");
      c.width = i.naturalWidth;
      c.height = i.naturalHeight;
      const x = c.getContext("2d");
      x.drawImage(i, 0, 0);
      return x.getImageData(0, 0, c.width, c.height);
    };
    const S = await load(sil);
    const N = await load(nor);
    const tw = meta.tileWidth;
    const th = meta.tileHeight;
    const cols = meta.width / tw;
    const rows = meta.height / th;
    const TW = tw + 2;
    const TH = th + 2;
    const out = document.createElement("canvas");
    out.width = cols * TW;
    out.height = rows * TH;
    const o = out.getContext("2d");
    const im = o.createImageData(out.width, out.height);
    const L = [-0.42, 0.62, 0.66];
    const ll = Math.hypot(...L);
    const set = (x, y, v) => {
      const i = (y * out.width + x) * 4;
      im.data[i] = v ? 241 : 0;
      im.data[i + 1] = v ? 241 : 0;
      im.data[i + 2] = v ? 234 : 0;
      im.data[i + 3] = 255;
    };
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const inside = (x, y) => x >= 0 && y >= 0 && x < tw && y < th && S.data[((r * th + y) * S.width + c * tw + x) * 4 + 3] >= 128;
        for (let y = -1; y <= th; y++)
          for (let x = -1; x <= tw; x++) {
            const X = c * TW + x + 1;
            const Y = r * TH + y + 1;
            if (inside(x, y)) {
              const i = ((r * th + y) * N.width + c * tw + x) * 4;
              let tone = 0;
              if (N.data[i + 3] > 0) {
                let n = [N.data[i] / 127.5 - 1, N.data[i + 1] / 127.5 - 1, N.data[i + 2] / 127.5 - 1];
                if (lightMode === "view") {
                  const yaw = meta.frames[c].yaw;
                  const cy = Math.cos(yaw);
                  const sy = Math.sin(yaw);
                  n = [n[0] * cy - n[2] * sy, n[1], n[0] * sy + n[2] * cy];
                }
                tone = (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / ll;
              }
              const white = tone > 0.66 || (tone > 0.44 && (x + y) % 2 === 0);
              set(X, Y, white);
            } else if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) {
              set(X, Y, true);
            }
          }
      }
    o.putImageData(im, 0, 0);
    return out.toDataURL("image/png");
  },
  { sil: b64("silhouette.png"), nor: b64("normal.png"), meta, lightMode },
);
await browser.close();
writeFileSync(outPng, Buffer.from(url.split(",")[1], "base64"));
const first = meta.frames[0];
writeFileSync(
  outJson,
  JSON.stringify(
    {
      source: "Ink Studio (MIT) 로 빚은 입체 모형에서 구운 것. lab/ink/detective.js",
      tileW: meta.tileWidth + 2,
      tileH: meta.tileHeight + 2,
      directions: meta.directions,
      frames: meta.frames.length / meta.directions,
      // 열 = 방향(카메라가 도는 각도, 0 = 정면에서 시작), 행 = 걷기 장면
      yaws: meta.frames.slice(0, meta.directions).map((f) => f.yaw),
      feetY: first.silhouette.bounds[3] + 2,
      height: first.silhouette.bounds[3] - first.silhouette.bounds[1] + 1,
    },
    null,
    1,
  ),
);
console.log("저장", outPng);
