// 실험실을 같은 와이파이의 휴대폰에서 열어 보기 위한 개발 서버 설정.
//   npx vite --config lab/vite.lan.config.ts   →  http://<맥의 주소>:5184/lab/gate01/
// 평소의 개발 서버(5183)와 캐시가 섞이지 않게 캐시 폴더를 따로 쓴다.
import { defineConfig, mergeConfig } from "vite";
import base from "../vite.config.ts";

export default mergeConfig(
  base,
  defineConfig({
    cacheDir: "node_modules/.vite-lan",
    server: { host: true, port: 5184, strictPort: true },
  }),
);
