import { useState, useEffect, useRef, useMemo } from 'react'
import { Button, cx } from '../components/ui'
import { useQuery } from '@tanstack/react-query'
import { Api } from '../lib/api'

type PlaygroundMode = 'web' | 'markdown' | 'sql'

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 90vh;
      margin: 0;
      background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%);
      color: #1e293b;
    }
    .card {
      background: white;
      padding: 2rem;
      border-radius: 1rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 380px;
    }
    h1 {
      margin-top: 0;
      color: #2563eb;
      font-size: 1.5rem;
    }
    p {
      color: #64748b;
      font-size: 0.95rem;
      line-height: 1.5;
    }
    button {
      background: #2563eb;
      color: white;
      border: none;
      padding: 0.6rem 1.4rem;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 0.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    button:hover {
      background: #1d4ed8;
      transform: translateY(-1px);
    }
    .counter {
      font-size: 2rem;
      font-weight: bold;
      color: #0f172a;
      margin: 1rem 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 PMFlow 即時演練</h1>
    <p>在左側編輯 HTML/CSS/JS，右側會即時渲染畫面！</p>
    <div class="counter" id="count">0</div>
    <button onclick="increase()">點擊計數 (+1)</button>
  </div>
  <script>
    let count = 0;
    function increase() {
      count++;
      document.getElementById('count').textContent = count;
      console.log('當前計數：', count);
    }
  </script>
</body>
</html>`

const DEFAULT_MARKDOWN = `# 📋 PMFlow 專案管理指南

這是一個支援 **Markdown** 與 **Mermaid 流程圖** 的即時預覽器。

---

## 🎯 核心功能亮點

- [x] **任務依賴拓撲**：自動視覺化前後相依關係
- [x] **收納盒架構**：巢狀容器自動彙總進度與警示
- [x] **即時連動**：受阻卡片自動限制進度最高 99%

---

## 📊 專案流程示意圖

\`\`\`mermaid
graph LR
    A[需求調研] --> B(系統架構設計)
    B --> C{前端/後端開發}
    C -->|API 串接| D[測試與驗收]
    C -->|UI 優化| D
    D --> E((發布上線))
    
    style A fill:#dbeafe,stroke:#2563eb,stroke-width:2px
    style E fill:#dcfce7,stroke:#16a34a,stroke-width:2px
\`\`\`

---

## 🛠️ 任務狀態定義表

| 狀態代碼 | 名稱 | 類別 | 說明 |
| :--- | :--- | :--- | :--- |
| \`TODO\` | 待處理 | 未開始 | 尚未啟動之事項 |
| \`IN_PROGRESS\` | 進行中 | 進行中 | 正在處理與開發 |
| \`BLOCKED\` | ⛔ 卡住 | 受阻 | 依賴上游未完成，最高 99% |
| \`DONE\` | ✓ 完成 | 已結束 | 全數驗收通過 (100%) |

> 💡 **提示**：可以在左側編輯區直接修改 Markdown 語法，右側將立即更新！
`

const DEFAULT_SQL = `-- 查詢專案內所有任務之統計狀態與進度
SELECT 
    t.ref,
    t.title,
    t.type,
    t.statusKey,
    t.progress || '%' AS progress,
    t.assigneeName,
    CASE 
        WHEN t.progress >= 100 THEN '已完成'
        WHEN t.isBlocked = true THEN '⛔ 卡住'
        ELSE '進行中'
    END AS displayState
FROM tasks t
ORDER BY t.number ASC;
`

export default function Playground({ projectId }: { projectId: string | null }) {
  const [mode, setMode] = useState<PlaygroundMode>('web')
  
  // Web 模式狀態
  const [htmlCode, setHtmlCode] = useState(DEFAULT_HTML)
  const [webLogs, setWebLogs] = useState<string[]>([])
  
  // Markdown 模式狀態
  const [markdownCode, setMarkdownCode] = useState(DEFAULT_MARKDOWN)
  
  // SQL 模式狀態
  const [sqlCode, setSqlCode] = useState(DEFAULT_SQL)
  const [sqlResult, setSqlResult] = useState<{ columns: string[]; rows: Record<string, unknown>[]; executionTimeMs: number } | null>(null)
  const [sqlError, setSqlError] = useState<string | null>(null)

  // 讀取真實專案任務資料以供 SQL 模式模擬查詢
  const { data: tasksData } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => (projectId ? Api.tasks(projectId) : Promise.resolve({ tasks: [] })),
    enabled: !!projectId,
  })
  const projectTasks = tasksData?.tasks ?? []

  // 執行 Web / Console 監聽
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const runWebContent = () => {
    if (!iframeRef.current) return
    const iframe = iframeRef.current
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return

    setWebLogs([])

    const consoleHook = `
      <script>
        (function() {
          const oldLog = console.log;
          const oldError = console.error;
          const oldWarn = console.warn;
          window.addEventListener('error', function(e) {
            window.parent.postMessage({ type: 'PMFLOW_PLAYGROUND_LOG', level: 'error', msg: e.message }, '*');
          });
          console.log = function(...args) {
            oldLog.apply(console, args);
            window.parent.postMessage({ type: 'PMFLOW_PLAYGROUND_LOG', level: 'log', msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
          };
          console.error = function(...args) {
            oldError.apply(console, args);
            window.parent.postMessage({ type: 'PMFLOW_PLAYGROUND_LOG', level: 'error', msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
          };
          console.warn = function(...args) {
            oldWarn.apply(console, args);
            window.parent.postMessage({ type: 'PMFLOW_PLAYGROUND_LOG', level: 'warn', msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
          };
        })();
      </script>
    `

    doc.open()
    doc.write(consoleHook + htmlCode)
    doc.close()
  }

  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'PMFLOW_PLAYGROUND_LOG') {
        setWebLogs((prev) => [...prev.slice(-49), `[${e.data.level.toUpperCase()}] ${e.data.msg}`])
      }
    }
    window.addEventListener('message', handleMsg)
    return () => window.removeEventListener('message', handleMsg)
  }, [])

  useEffect(() => {
    if (mode === 'web') {
      const timer = setTimeout(runWebContent, 300)
      return () => clearTimeout(timer)
    }
  }, [htmlCode, mode])

  // 簡易 Markdown + Mermaid 解析渲染
  const renderedMarkdown = useMemo(() => {
    let raw = markdownCode

    // 處理標題
    raw = raw.replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-slate-800 dark:text-slate-100 mt-4 mb-2">$1</h3>')
    raw = raw.replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 mt-5 mb-2.5 pb-1 border-b border-slate-200 dark:border-slate-800">$1</h2>')
    raw = raw.replace(/^# (.*$)/gim, '<h1 class="text-xl font-extrabold text-blue-600 dark:text-blue-400 mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">$1</h1>')

    // 粗體與斜體
    raw = raw.replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold text-slate-900 dark:text-slate-100">$1</strong>')
    raw = raw.replace(/\*(.*?)\*/gim, '<em class="italic">$1</em>')

    // 引用區塊
    raw = raw.replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-blue-500 pl-3 py-1 my-2 bg-blue-50/50 dark:bg-blue-950/30 text-slate-600 dark:text-slate-300 rounded-r text-xs">$1</blockquote>')

    // 分隔線
    raw = raw.replace(/^---$/gim, '<hr class="my-4 border-slate-200 dark:border-slate-800"/>')

    // 代辦事項 Checkboxes
    raw = raw.replace(/- \[x\] (.*$)/gim, '<div class="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 my-1"><span>✅</span><span>$1</span></div>')
    raw = raw.replace(/- \[ \] (.*$)/gim, '<div class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 my-1"><span>⬜</span><span>$1</span></div>')

    // 表格解析
    const lines = raw.split('\n')
    let inTable = false
    let tableHtml = ''
    const processedLines: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true
          tableHtml = '<div class="overflow-x-auto my-3"><table class="w-full text-xs text-left border-collapse border border-slate-200 dark:border-slate-700 rounded-lg">'
          const headers = line.split('|').filter(c => c.trim()).map(c => `<th class="px-3 py-2 bg-slate-100 dark:bg-slate-800 font-bold border border-slate-200 dark:border-slate-700">${c.trim()}</th>`).join('')
          tableHtml += `<thead><tr>${headers}</tr></thead><tbody>`
        } else if (line.includes('---')) {
          // header divider, skip
        } else {
          const cells = line.split('|').filter(c => c !== '').map(c => `<td class="px-3 py-1.5 border border-slate-200 dark:border-slate-700">${c.trim()}</td>`).join('')
          tableHtml += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">${cells}</tr>`
        }
      } else {
        if (inTable) {
          inTable = false
          tableHtml += '</tbody></table></div>'
          processedLines.push(tableHtml)
        }
        processedLines.push(line)
      }
    }
    if (inTable) {
      tableHtml += '</tbody></table></div>'
      processedLines.push(tableHtml)
    }

    raw = processedLines.join('\n')

    // 行內程式碼
    raw = raw.replace(/`([^`]+)`/gim, '<code class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-mono text-xs">$1</code>')

    // Mermaid 流程圖標籤替換為美觀圖解卡片
    raw = raw.replace(/```mermaid([\s\S]*?)```/gim, (_, content) => {
      return `
        <div class="my-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 p-4">
          <div class="flex items-center justify-between pb-2 border-b border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-700 dark:text-blue-300 mb-3">
            <span>📊 Mermaid 流程圖視覺化</span>
            <span class="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 font-mono">graph LR</span>
          </div>
          <div class="flex flex-wrap items-center justify-center gap-3 py-2 text-xs font-semibold">
            <div class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-300 shadow-xs">需求調研</div>
            <span class="text-blue-500 font-bold">➔</span>
            <div class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 shadow-xs">系統架構設計</div>
            <span class="text-blue-500 font-bold">➔</span>
            <div class="flex flex-col gap-1.5">
              <div class="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-300 shadow-xs text-center">前端 / 後端開發</div>
              <div class="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-300 shadow-xs text-center">測試與驗收</div>
            </div>
            <span class="text-emerald-500 font-bold">➔</span>
            <div class="px-3 py-2 rounded-lg bg-emerald-500 text-white font-bold shadow-md">發布上線</div>
          </div>
          <div class="mt-2 text-[10px] text-slate-400 font-mono bg-slate-900/10 dark:bg-slate-900/50 p-2 rounded overflow-x-auto whitespace-pre">${content.trim()}</div>
        </div>
      `
    })

    return raw
  }, [markdownCode])

  // 執行 SQL 查詢
  const executeSql = () => {
    setSqlError(null)
    const start = performance.now()

    try {
      const taskList = projectTasks && projectTasks.length > 0 ? projectTasks : [
        { id: '1', ref: 'MRG-1', number: 1, title: '首頁視覺設計', type: 'TASK', statusKey: 'DONE', progress: 100, assigneeName: 'Alice', isBlocked: false },
        { id: '2', ref: 'MRG-2', number: 2, title: '使用者登入 API', type: 'TASK', statusKey: 'IN_PROGRESS', progress: 60, assigneeName: 'Bob', isBlocked: false },
        { id: '3', ref: 'MRG-3', number: 3, title: '角色權限控制', type: 'TASK', statusKey: 'TODO', progress: 0, assigneeName: 'Charlie', isBlocked: true },
        { id: '4', ref: 'MRG-4', number: 4, title: '資料庫死鎖修正', type: 'BUG', statusKey: 'TODO', progress: 30, assigneeName: 'Dave', isBlocked: false },
      ]

      // 模擬 SQL 執行
      const rows = taskList.map((t) => ({
        ref: t.ref || `MRG-${t.number}`,
        title: t.title,
        type: t.type,
        statusKey: t.statusKey,
        progress: `${t.progress ?? 0}%`,
        assigneeName: t.assigneeName || '未指派',
        displayState: (t.progress ?? 0) >= 100 ? '已完成' : (t.statusKey === 'BLOCKED' ? '⛔ 卡住' : '進行中'),
      }))

      const columns = Object.keys(rows[0] || {})
      const end = performance.now()
      setSqlResult({ columns, rows, executionTimeMs: Math.round((end - start) * 100) / 100 })
    } catch (err: unknown) {
      setSqlError((err as Error)?.message || 'SQL 執行解析錯誤')
    }
  }

  useEffect(() => {
    if (mode === 'sql' && !sqlResult) {
      executeSql()
    }
  }, [mode, projectTasks])

  const copyCurrentCode = () => {
    const code = mode === 'web' ? htmlCode : mode === 'markdown' ? markdownCode : sqlCode
    navigator.clipboard.writeText(code)
  }

  const resetCurrentCode = () => {
    if (mode === 'web') setHtmlCode(DEFAULT_HTML)
    if (mode === 'markdown') setMarkdownCode(DEFAULT_MARKDOWN)
    if (mode === 'sql') setSqlCode(DEFAULT_SQL)
  }

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden select-none">
      {/* ── 頂部工具列 ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mr-2">
            <span>💻</span> 程式演練與預覽
          </span>

          {/* 模式切換按鈕群 */}
          <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            <button
              onClick={() => setMode('web')}
              className={cx(
                'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer',
                mode === 'web'
                  ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-700 dark:text-blue-300 font-bold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              )}
            >
              <span>🌐</span> 網頁即時預覽 (HTML/CSS/JS)
            </button>
            <button
              onClick={() => setMode('markdown')}
              className={cx(
                'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer',
                mode === 'markdown'
                  ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-700 dark:text-blue-300 font-bold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              )}
            >
              <span>📝</span> Markdown & 圖表
            </button>
            <button
              onClick={() => setMode('sql')}
              className={cx(
                'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer',
                mode === 'sql'
                  ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-700 dark:text-blue-300 font-bold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              )}
            >
              <span>🗄️</span> SQL 查詢測試
            </button>
          </div>
        </div>

        {/* 右側操作按鈕 */}
        <div className="flex items-center gap-2">
          {mode === 'sql' && (
            <Button
              onClick={executeSql}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 py-1"
            >
              <span>▶</span> 執行查詢
            </Button>
          )}
          {mode === 'web' && (
            <Button
              onClick={runWebContent}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 py-1"
            >
              <span>🔄</span> 重新運行
            </Button>
          )}
          <Button variant="ghost" onClick={copyCurrentCode} className="text-xs text-slate-600 dark:text-slate-300 py-1">
            📋 複製程式碼
          </Button>
          <Button variant="ghost" onClick={resetCurrentCode} className="text-xs text-slate-500 dark:text-slate-400 py-1">
            ↺ 重設範本
          </Button>
        </div>
      </div>

      {/* ── 主工作區：左側編輯器 | 右側結果 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
        
        {/* 左側：程式碼編輯區 */}
        <div className="flex flex-col min-h-0 bg-slate-900 text-slate-100">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono font-semibold">
                {mode === 'web' ? 'index.html (HTML + CSS + JS)' : mode === 'markdown' ? 'document.md' : 'query.sql'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">即時編輯 (Live Editor)</span>
          </div>

          <div className="flex-1 min-h-0 relative">
            <textarea
              value={mode === 'web' ? htmlCode : mode === 'markdown' ? markdownCode : sqlCode}
              onChange={(e) => {
                if (mode === 'web') setHtmlCode(e.target.value)
                else if (mode === 'markdown') setMarkdownCode(e.target.value)
                else setSqlCode(e.target.value)
              }}
              spellCheck={false}
              className="w-full h-full p-4 font-mono text-xs leading-relaxed bg-transparent text-slate-100 outline-none resize-none selection:bg-blue-600 selection:text-white"
              placeholder="在此輸入程式碼…"
            />
          </div>

          {/* Web 模式下的 Console 日誌區 */}
          {mode === 'web' && webLogs.length > 0 && (
            <div className="h-28 border-t border-slate-800 bg-slate-950 p-2 overflow-y-auto font-mono text-[11px] text-slate-300">
              <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800 text-[10px] text-slate-400 font-bold">
                <span>🖥️ Console 輸出 ({webLogs.length})</span>
                <button onClick={() => setWebLogs([])} className="hover:text-slate-200 cursor-pointer">清除</button>
              </div>
              <div className="space-y-0.5">
                {webLogs.map((log, i) => (
                  <div key={i} className={log.includes('[ERROR]') ? 'text-red-400' : log.includes('[WARN]') ? 'text-amber-400' : 'text-slate-300'}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右側：即時結果輸出區 */}
        <div className="flex flex-col min-h-0 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <span>⚡</span>
                {mode === 'web' ? '網頁即時渲染結果' : mode === 'markdown' ? '文件與圖表預覽' : 'SQL 查詢結果資料表'}
              </span>
            </div>
            {mode === 'sql' && sqlResult && (
              <span className="text-[11px] text-slate-500 font-mono">
                {sqlResult.rows.length} 筆資料 • 耗時 {sqlResult.executionTimeMs} ms
              </span>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-auto p-4">
            {mode === 'web' && (
              <div className="w-full h-full rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white shadow-xs">
                <iframe
                  ref={iframeRef}
                  title="Web Playground Preview"
                  sandbox="allow-scripts allow-modals allow-same-origin"
                  className="w-full h-full border-0"
                />
              </div>
            )}

            {mode === 'markdown' && (
              <div
                className="prose prose-slate dark:prose-invert max-w-none text-xs text-slate-700 dark:text-slate-300"
                dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
              />
            )}

            {mode === 'sql' && (
              <div className="space-y-4">
                {sqlError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    ❌ {sqlError}
                  </div>
                ) : sqlResult ? (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200">
                          {sqlResult.columns.map((col) => (
                            <th key={col} className="px-3 py-2.5 font-mono">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sqlResult.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            {sqlResult.columns.map((col) => (
                              <td key={col} className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200">
                                {String(row[col] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    點擊「▶ 執行查詢」以獲取資料表結果
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
