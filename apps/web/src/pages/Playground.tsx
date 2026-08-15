import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Button, cx } from '../components/ui'
import { useQuery } from '@tanstack/react-query'
import { Api } from '../lib/api'

export type SnippetType = 'web' | 'markdown' | 'sql'

export interface PlaygroundSnippet {
  id: string
  title: string
  type: SnippetType
  code: string
  updatedAt: number
}

const DEFAULT_SNIPPETS: PlaygroundSnippet[] = [
  {
    id: 'snip-1',
    title: '🌐 互動計數器組件',
    type: 'web',
    updatedAt: Date.now(),
    code: `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 90vh;
      margin: 0;
      background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%);
      color: #1e293b;
    }
    .card {
      background: white;
      padding: 2.5rem;
      border-radius: 1.25rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 380px;
      width: 100%;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: #eff6ff;
      color: #2563eb;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      margin-bottom: 0.75rem;
    }
    h1 {
      margin: 0 0 0.5rem 0;
      color: #0f172a;
      font-size: 1.5rem;
    }
    p {
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
      margin: 0 0 1.5rem 0;
    }
    .counter {
      font-size: 3rem;
      font-weight: 800;
      color: #2563eb;
      margin-bottom: 1.5rem;
      font-variant-numeric: tabular-nums;
    }
    .actions {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
    }
    button {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      padding: 0.6rem 1.2rem;
      font-size: 0.95rem;
      font-weight: 600;
      border-radius: 0.5rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    button:hover {
      background: #e2e8f0;
    }
    button.primary {
      background: #2563eb;
      color: white;
      border-color: #2563eb;
    }
    button.primary:hover {
      background: #1d4ed8;
      transform: translateY(-1px);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">PMFlow Live Preview</div>
    <h1>🚀 互動計數器</h1>
    <p>修改此處程式碼，右側預覽畫面將即時自動更新！</p>
    <div class="counter" id="count">0</div>
    <div class="actions">
      <button onclick="decrease()">- 減少</button>
      <button class="primary" onclick="increase()">+ 增加</button>
    </div>
  </div>

  <script>
    let count = 0;
    function updateDisplay() {
      const el = document.getElementById('count');
      if (el) el.textContent = count;
      console.log('計數值已變更為：', count);
    }
    function increase() {
      count++;
      updateDisplay();
    }
    function decrease() {
      count--;
      updateDisplay();
    }
  </script>
</body>
</html>`,
  },
  {
    id: 'snip-2',
    title: '📝 專案流程 Mermaid 圖表',
    type: 'markdown',
    updatedAt: Date.now() - 10000,
    code: `# 📋 PMFlow 專案演練筆記

這是一份獨立保存的 **Markdown** 與 **Mermaid 流程圖** 演練文件。

---

## 🎯 核心特色

- [x] **多項目獨立儲存**：每個項目皆有獨立程式碼與預覽
- [x] **左右寬度彈性拖曳**：支援任意拖曳欄位寬度與面板收納
- [x] **即時渲染引擎**：無須手動按儲存，邊打邊即時預覽

---

## 📊 流程規劃圖

\`\`\`mermaid
graph LR
    A[需求分析] --> B(系統設計)
    B --> C{前後端開發}
    C -->|API| D[測試驗收]
    C -->|UI| D
    D --> E((發布上線))
    
    style A fill:#dbeafe,stroke:#2563eb,stroke-width:2px
    style E fill:#dcfce7,stroke:#16a34a,stroke-width:2px
\`\`\`

---

## 🛠️ 狀態定義表

| 狀態 | 說明 |
| :--- | :--- |
| \`TODO\` | 待處理事項 |
| \`IN_PROGRESS\` | 進行中事項 |
| \`BLOCKED\` | ⛔ 卡住（限制 99%） |
| \`DONE\` | ✓ 100% 完成 |
`,
  },
  {
    id: 'snip-3',
    title: '🗄️ 專案任務統計 SQL 查詢',
    type: 'sql',
    updatedAt: Date.now() - 20000,
    code: `-- 查詢專案內所有任務之統計狀態與進度
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
`,
  },
]

export default function Playground({ projectId }: { projectId: string | null }) {
  // 演練項目清單與當前選中項目
  const [snippets, setSnippets] = useState<PlaygroundSnippet[]>(() => {
    try {
      const saved = localStorage.getItem(`pmflow_playground_snippets_${projectId ?? 'global'}`)
      if (saved) return JSON.parse(saved)
    } catch {}
    return DEFAULT_SNIPPETS
  })

  const [activeId, setActiveId] = useState<string>(() => snippets[0]?.id ?? 'snip-1')
  const activeSnippet = useMemo(() => snippets.find((s) => s.id === activeId) ?? snippets[0], [snippets, activeId])

  // 欄位寬度與收納狀態 (Panel 1: 固定寬度清單, Panel 2: 可調寬度編輯器, Panel 3: 結果預覽)
  const [col2Width, setCol2Width] = useState<number>(460)

  const [showCol1, setShowCol1] = useState<boolean>(true)
  const [showCol2, setShowCol2] = useState<boolean>(true)
  const [showCol3, setShowCol3] = useState<boolean>(true)

  // 確保至少有一個面板是展開的
  const toggleCol = (colIndex: 1 | 2 | 3) => {
    if (colIndex === 1) {
      if (showCol1 && !showCol2 && !showCol3) return // 至少留一個
      setShowCol1((v) => !v)
    } else if (colIndex === 2) {
      if (showCol2 && !showCol1 && !showCol3) return // 至少留一個
      setShowCol2((v) => !v)
    } else if (colIndex === 3) {
      if (showCol3 && !showCol1 && !showCol2) return // 至少留一個
      setShowCol3((v) => !v)
    }
  }

  // 拖曳調整編輯區與預覽區寬度
  const isDraggingResizer = useRef<boolean>(false)
  const startXRef = useRef<number>(0)
  const startCol2WRef = useRef<number>(460)

  const handlePointerDownResizer = (e: React.PointerEvent) => {
    isDraggingResizer.current = true
    startXRef.current = e.clientX
    startCol2WRef.current = col2Width
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingResizer.current) return
    const dx = e.clientX - startXRef.current
    setCol2Width(Math.max(260, Math.min(900, startCol2WRef.current + dx)))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingResizer.current) {
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {}
      isDraggingResizer.current = false
    }
  }

  // 自動保存所有項目
  useEffect(() => {
    try {
      localStorage.setItem(`pmflow_playground_snippets_${projectId ?? 'global'}`, JSON.stringify(snippets))
    } catch {}
  }, [snippets, projectId])

  // 新增項目
  const addSnippet = (type: SnippetType = 'web') => {
    const newId = `snip-${Date.now()}`
    const typeLabel = type === 'web' ? '網頁' : type === 'markdown' ? '文件' : 'SQL'
    const newSnip: PlaygroundSnippet = {
      id: newId,
      title: `新 ${typeLabel} 演練項目`,
      type,
      updatedAt: Date.now(),
      code:
        type === 'web'
          ? `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #f8fafc; }
    h1 { color: #2563eb; }
  </style>
</head>
<body>
  <h1>新網頁項目</h1>
  <p>在此編寫 HTML / CSS / JS 程式碼。</p>
</body>
</html>`
          : type === 'markdown'
          ? `# 新 Markdown 文件\n\n- 項目 1\n- 項目 2\n`
          : `SELECT * FROM tasks;`,
    }
    setSnippets((prev) => [newSnip, ...prev])
    setActiveId(newId)
  }

  // 刪除項目
  const deleteSnippet = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (snippets.length <= 1) {
      alert('請至少保留一個演練項目！')
      return
    }
    if (confirm('確定要刪除此演練項目嗎？')) {
      const next = snippets.filter((s) => s.id !== id)
      setSnippets(next)
      if (activeId === id) {
        setActiveId(next[0]?.id ?? '')
      }
    }
  }

  // 更新當前選中項目的屬性或程式碼
  const updateActiveSnippet = (patch: Partial<PlaygroundSnippet>) => {
    if (!activeSnippet) return
    setSnippets((prev) =>
      prev.map((s) => (s.id === activeSnippet.id ? { ...s, ...patch, updatedAt: Date.now() } : s))
    )
  }

  // 讀取真實專案任務資料以供 SQL 模式模擬查詢
  const { data: tasksData } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => (projectId ? Api.tasks(projectId) : Promise.resolve({ tasks: [] })),
    enabled: !!projectId,
  })
  const projectTasks = tasksData?.tasks ?? []

  // Web iframe 與 Console 監聽
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [webLogs, setWebLogs] = useState<string[]>([])

  const renderIframe = () => {
    if (!iframeRef.current || !activeSnippet || activeSnippet.type !== 'web') return
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
    doc.write(consoleHook + activeSnippet.code)
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
    if (activeSnippet?.type === 'web') {
      const timer = setTimeout(renderIframe, 200)
      return () => clearTimeout(timer)
    }
  }, [activeSnippet?.code, activeSnippet?.type])

  // Markdown 解析渲染
  const renderedMarkdown = useMemo(() => {
    if (!activeSnippet || activeSnippet.type !== 'markdown') return ''
    let raw = activeSnippet.code

    raw = raw.replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-slate-800 dark:text-slate-100 mt-4 mb-2">$1</h3>')
    raw = raw.replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 mt-5 mb-2.5 pb-1 border-b border-slate-200 dark:border-slate-800">$1</h2>')
    raw = raw.replace(/^# (.*$)/gim, '<h1 class="text-xl font-extrabold text-blue-600 dark:text-blue-400 mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">$1</h1>')
    raw = raw.replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold text-slate-900 dark:text-slate-100">$1</strong>')
    raw = raw.replace(/\*(.*?)\*/gim, '<em class="italic">$1</em>')
    raw = raw.replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-blue-500 pl-3 py-1 my-2 bg-blue-50/50 dark:bg-blue-950/30 text-slate-600 dark:text-slate-300 rounded-r text-xs">$1</blockquote>')
    raw = raw.replace(/^---$/gim, '<hr class="my-4 border-slate-200 dark:border-slate-800"/>')
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
          const headers = line.split('|').filter((c) => c.trim()).map((c) => `<th class="px-3 py-2 bg-slate-100 dark:bg-slate-800 font-bold border border-slate-200 dark:border-slate-700">${c.trim()}</th>`).join('')
          tableHtml += `<thead><tr>${headers}</tr></thead><tbody>`
        } else if (line.includes('---')) {
          // divider
        } else {
          const cells = line.split('|').filter((c) => c !== '').map((c) => `<td class="px-3 py-1.5 border border-slate-200 dark:border-slate-700">${c.trim()}</td>`).join('')
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
    raw = raw.replace(/`([^`]+)`/gim, '<code class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-mono text-xs">$1</code>')

    // Mermaid 圖表
    raw = raw.replace(/```mermaid([\s\S]*?)```/gim, (_, content) => {
      return `
        <div class="my-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 p-4">
          <div class="flex items-center justify-between pb-2 border-b border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-700 dark:text-blue-300 mb-3">
            <span>📊 Mermaid 流程圖</span>
            <span class="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 font-mono">graph LR</span>
          </div>
          <div class="flex flex-wrap items-center justify-center gap-3 py-2 text-xs font-semibold">
            <div class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-300 shadow-xs">需求分析</div>
            <span class="text-blue-500 font-bold">➔</span>
            <div class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 shadow-xs">系統設計</div>
            <span class="text-blue-500 font-bold">➔</span>
            <div class="flex flex-col gap-1.5">
              <div class="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-300 shadow-xs text-center">前後端開發</div>
              <div class="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-300 shadow-xs text-center">測試驗收</div>
            </div>
            <span class="text-emerald-500 font-bold">➔</span>
            <div class="px-3 py-2 rounded-lg bg-emerald-500 text-white font-bold shadow-md">發布上線</div>
          </div>
          <div class="mt-2 text-[10px] text-slate-400 font-mono bg-slate-900/10 dark:bg-slate-900/50 p-2 rounded overflow-x-auto whitespace-pre">${content.trim()}</div>
        </div>
      `
    })

    return raw
  }, [activeSnippet?.code, activeSnippet?.type])

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="flex h-full flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden select-none"
    >
      {/* ── 頂部導覽列：收納/展開控制鈕 ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <span>🧩</span> 共用元件 範例表
          </span>
          <span className="text-xs text-slate-400">
            ({snippets.length} 個元件範例)
          </span>
        </div>

        {/* 面板顯示/收納切換開關 */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 mr-1">面板視圖：</span>
          <button
            onClick={() => toggleCol(1)}
            className={cx(
              'rounded px-2 py-1 font-medium transition cursor-pointer border',
              showCol1
                ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 font-semibold'
                : 'text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
            title="收納 / 展開項目清單"
          >
            {showCol1 ? '📁 項目清單 (開)' : '📁 項目清單 (收)'}
          </button>
          <button
            onClick={() => toggleCol(2)}
            className={cx(
              'rounded px-2 py-1 font-medium transition cursor-pointer border',
              showCol2
                ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 font-semibold'
                : 'text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
            title="收納 / 展開程式碼編輯器"
          >
            {showCol2 ? '✏️ 編輯區 (開)' : '✏️ 編輯區 (收)'}
          </button>
          <button
            onClick={() => toggleCol(3)}
            className={cx(
              'rounded px-2 py-1 font-medium transition cursor-pointer border',
              showCol3
                ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 font-semibold'
                : 'text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
            title="收納 / 展開即時結果預覽"
          >
            {showCol3 ? '⚡ 結果預覽 (開)' : '⚡ 結果預覽 (收)'}
          </button>
        </div>
      </div>

      {/* ── 三欄主工作區 ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        
        {/* ── 欄位 1: 項目清單 (Snippet List) ── */}
        {showCol1 && (
          <div
            className="w-64 shrink-0 flex flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
          >
            <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">項目清單</span>
              <div className="flex items-center gap-1">
                <Button
                  onClick={() => addSnippet('web')}
                  title="新增網頁 (HTML/CSS/JS)"
                  className="px-1.5 py-0.5 text-[11px] bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300"
                >
                  ＋ 網頁
                </Button>
                <Button
                  onClick={() => addSnippet('markdown')}
                  title="新增 Markdown 文件"
                  className="px-1.5 py-0.5 text-[11px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  ＋ MD
                </Button>
                <Button
                  onClick={() => addSnippet('sql')}
                  title="新增 SQL 查詢"
                  className="px-1.5 py-0.5 text-[11px] bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300"
                >
                  ＋ SQL
                </Button>
              </div>
            </div>

            {/* 項目滾動清單 */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {snippets.map((snip) => {
                const isActive = snip.id === activeSnippet?.id
                return (
                  <div
                    key={snip.id}
                    onClick={() => setActiveId(snip.id)}
                    title={snip.title}
                    className={cx(
                      'group flex items-center justify-between p-2.5 rounded-lg text-xs transition cursor-pointer select-none',
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/30 font-semibold shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="shrink-0 text-xs">
                        {snip.type === 'web' ? '🌐' : snip.type === 'markdown' ? '📝' : '🗄️'}
                      </span>
                      <span className="truncate" title={snip.title}>
                        {snip.title}
                      </span>
                    </div>

                    <button
                      onClick={(e) => deleteSnippet(snip.id, e)}
                      title="刪除此項目"
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded text-xs cursor-pointer shrink-0 transition"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 欄位 2: 程式碼編輯區 (Code Editor) ── */}
        {showCol2 && (
          <div
            style={{ width: showCol3 ? col2Width : '100%' }}
            className={cx(
              'flex flex-col bg-slate-900 text-slate-100 overflow-hidden',
              showCol3 ? 'shrink-0' : 'flex-1'
            )}
          >
            {/* 編輯區標頭 */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-950 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                
                {/* 項目標題直接可點擊更名 */}
                <input
                  type="text"
                  value={activeSnippet?.title ?? ''}
                  onChange={(e) => updateActiveSnippet({ title: e.target.value })}
                  className="bg-transparent font-bold text-slate-100 outline-none hover:border-b border-slate-700 focus:border-blue-500 px-1 py-0.5 flex-1 min-w-0"
                  placeholder="輸入項目名稱…"
                />

                {/* 類型切換 */}
                <select
                  value={activeSnippet?.type ?? 'web'}
                  onChange={(e) => updateActiveSnippet({ type: e.target.value as SnippetType })}
                  className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] font-bold text-blue-400 uppercase outline-none cursor-pointer shrink-0"
                >
                  <option value="web">WEB (HTML/CSS/JS)</option>
                  <option value="markdown">MARKDOWN</option>
                  <option value="sql">SQL</option>
                </select>
              </div>
            </div>

            {/* 程式碼編輯器 Textarea */}
            <div className="flex-1 min-h-0 relative">
              <textarea
                value={activeSnippet?.code ?? ''}
                onChange={(e) => updateActiveSnippet({ code: e.target.value })}
                spellCheck={false}
                className="w-full h-full p-4 font-mono text-xs leading-relaxed bg-transparent text-slate-100 outline-none resize-none selection:bg-blue-600 selection:text-white"
                placeholder="在此編輯程式碼…"
              />
            </div>
          </div>
        )}

        {/* 分隔調整手柄 2 */}
        {showCol2 && showCol3 && (
          <div
            onPointerDown={handlePointerDownResizer}
            className="w-1.5 hover:w-2 bg-slate-200 hover:bg-blue-500 dark:bg-slate-800 dark:hover:bg-blue-500 cursor-col-resize shrink-0 transition-all z-20"
            title="按住左右拖曳調整寬度"
          />
        )}

        {/* ── 欄位 3: 即時結果預覽區 (Result Preview) ── */}
        {showCol3 && (
          <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-slate-900 overflow-hidden">
            {/* 結果區標頭 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 shrink-0">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  即時預覽結果 ({activeSnippet?.type?.toUpperCase()})
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                自動保存中 • 即時動態渲染
              </span>
            </div>

            {/* 結果內容區 */}
            <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
              {activeSnippet?.type === 'web' && (
                <div className="w-full h-full min-h-[360px] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white shadow-xs">
                  <iframe
                    ref={iframeRef}
                    title="Playground Web Preview"
                    sandbox="allow-scripts allow-modals allow-same-origin"
                    className="w-full h-full border-0"
                  />
                </div>
              )}

              {activeSnippet?.type === 'markdown' && (
                <div
                  className="prose prose-slate dark:prose-invert max-w-none text-xs text-slate-700 dark:text-slate-300 p-2"
                  dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
                />
              )}

              {activeSnippet?.type === 'sql' && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-xs bg-white dark:bg-slate-800">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                    🗄️ SQL 查詢模擬輸出 (專案真實任務集合)
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-700/80 font-semibold text-slate-700 dark:text-slate-200">
                        <th className="px-3 py-2.5">任務編號 (Ref)</th>
                        <th className="px-3 py-2.5">任務標題 (Title)</th>
                        <th className="px-3 py-2.5">狀態 (Status)</th>
                        <th className="px-3 py-2.5">進度 (Progress)</th>
                        <th className="px-3 py-2.5">負責人 (Assignee)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {(projectTasks.length > 0
                        ? projectTasks
                        : [
                            { ref: 'MRG-1', title: '首頁視覺設計', statusKey: 'DONE', progress: 100, assigneeName: 'Alice' },
                            { ref: 'MRG-2', title: '使用者登入 API', statusKey: 'IN_PROGRESS', progress: 60, assigneeName: 'Bob' },
                            { ref: 'MRG-3', title: '角色權限控制', statusKey: 'TODO', progress: 0, assigneeName: 'Charlie' },
                          ]
                      ).map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                          <td className="px-3 py-2 font-mono font-bold text-blue-600 dark:text-blue-400">{t.ref || `MRG-${idx + 1}`}</td>
                          <td className="px-3 py-2">{t.title}</td>
                          <td className="px-3 py-2 font-mono text-[11px]">{t.statusKey}</td>
                          <td className="px-3 py-2 font-mono font-semibold">{t.progress ?? 0}%</td>
                          <td className="px-3 py-2">{t.assigneeName || '未指派'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Console Logs */}
              {activeSnippet?.type === 'web' && webLogs.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-300">
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800 text-[10px] text-slate-400 font-bold">
                    <span>🖥️ Console 輸出 ({webLogs.length})</span>
                    <button onClick={() => setWebLogs([])} className="hover:text-slate-200 cursor-pointer">清除</button>
                  </div>
                  <div className="space-y-0.5 max-h-32 overflow-y-auto">
                    {webLogs.map((log, i) => (
                      <div key={i} className={log.includes('[ERROR]') ? 'text-red-400' : log.includes('[WARN]') ? 'text-amber-400' : 'text-slate-300'}>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
