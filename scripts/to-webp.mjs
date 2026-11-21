// PNG 캡처를 WebP 로 바꾼다: node scripts/to-webp.mjs <out-dir> <width> name=path.png ...
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [outDir, widthArg, ...pairs] = process.argv.slice(2);
const width = Number(widthArg);
const browser = await chromium.launch();
const page = await browser.newPage();
for (const pair of pairs) {
  const [name, file] = pair.split("=");
  const dataUrl = `data:image/png;base64,${readFileSync(file).toString("base64")}`;
  const base64 = await page.evaluate(
    async ({ dataUrl, width }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const scale = Math.min(1, width / img.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/webp", 0.86).split(",")[1];
    },
    { dataUrl, width },
  );
  writeFileSync(join(outDir, `${name}.webp`), Buffer.from(base64, "base64"));
}
await browser.close();
console.log(`${pairs.length} files → ${outDir}`);
