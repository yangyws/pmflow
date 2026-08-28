import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const now = new Date()
// 使用 Asia/Taipei 時區 (UTC+8) 格式化建置時間，避免 Docker 容器內部 build 時採用 UTC 導致時間偏差 8 小時
const formatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const parts = formatter.formatToParts(now)
const getPart = (type: string) => parts.find(p => p.type === type)?.value || ''
const buildTime = `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}`

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify('v0.1.0-CR211'),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  server: {
    port: 5173,
    host: true,
    // 開發時前端 5173、後端 8080，透過 proxy 走同源，
    // 這樣 httpOnly 的 refresh cookie 才送得出去。
    //
    // 在 docker-compose.hmr.yml 底下跑的時候後端不在 localhost，而是同一個
    // 網路裡的 api:8080 —— 用環境變數指過去，不然整個站會一直 502。
    proxy: {
      '/api': {
        target: process.env.PMFLOW_API_PROXY ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
})
