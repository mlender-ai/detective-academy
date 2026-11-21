/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // 상대 경로 빌드: 정적 호스팅 하위 경로·Capacitor 웹뷰에서도 그대로 열린다.
  base: "./",
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
  },
});
