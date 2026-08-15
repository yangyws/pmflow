import { useState, useEffect, useRef, useMemo } from 'react'
import { Button, cx } from '../components/ui'
import { useQuery } from '@tanstack/react-query'
import { Api } from '../lib/api'

export type BlockType = 'html' | 'css' | 'js' | 'markdown' | 'sql'

export interface CodeBlock {
  id: string
  title: string
  type: BlockType
  content: string
  enabled: boolean
  collapsed?: boolean
}

const INITIAL_BLOCKS: CodeBlock[] = [
  {
    id: 'block-html',
    title: 'HTML 結構 (index.html)',
    type: 'html',
    enabled: true,
    collapsed: false,
    content: `<div class="card">
  <div class="badge">PMFlow 組件演練</div>
  <h1>🚀 互動計數器</h1>
  <p>在左側編輯 HTML/CSS/JS 區塊，右側將即時組合並渲染！</p>
  <div class="counter" id="count">0</div>
  <div class="actions">
    <button onclick="decrease()">- 減少</button>
    <button class="primary" onclick="increase()">+ 增加</button>
  </div>
</div>`,
  },
  {
    id: 'block-css',
    title: 'CSS 樣式 (style.css)',
    type: 'css',
    enabled: true,
    collapsed: false,
    content: `body {
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
  padding: 2rem;
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
}`,
  },
  {
    id: 'block-js',
    title: 'JavaScript 邏輯 (script.js)',
    type: 'js',
    enabled: true,
    collapsed: false,
    content: `let count = 0;

function updateDisplay() {
  const el = document.getElementById('count');
  if (el) el.textContent = count;
  console.log('當前計數器數值：', count);
}

function increase() {
  count++;
  updateDisplay();
}

function decrease() {
  count--;
  updateDisplay();
}`,
  },
]

export default function Playground({ projectId }: { projectId: string | null }) {
  const [blocks, setBlocks] = useState<CodeBlock[]>(() => {
    try {
      const saved = localStorage.getItem(`pmflow_playground_blocks_${projectId ?? 'global'}`)
      if (saved) return JSON.parse(saved)
    } catch {}
    return INITIAL_BLOCKS
  })

  const [webLogs, setWebLogs] = useState<string[]>([])
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // 讀取真實專案任務資料以供 SQL 模式模擬查詢
  const { data: tasksData } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => (projectId ? Api.tasks(projectId) : Promise.resolve({ tasks: [] })),
    enabled: !!projectId,
  })
  const projectTasks = tasksData?.tasks ?? []

  // 自動保存至 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`pmflow_playground_blocks_${projectId ?? 'global'}`, JSON.stringify(blocks))
    } catch {}
  }, [blocks, projectId])

  // 新增區塊
  const addBlock = (type: BlockType = 'html') => {
    const newId = `block-${Date.now()}`
    const typeNames: Record<BlockType, string> = {
      html: 'HTML 結構',
      css: 'CSS 樣式',
      js: 'JavaScript 邏輯',
      markdown: 'Markdown 文件',
      sql: 'SQL 查詢',
    }
    const newBlock: CodeBlock = {
      id: newId,
      title: `新 ${typeNames[type]} (${type.toUpperCase()})`,
      type,
      enabled: true,
      collapsed: false,
      content: type === 'html' ? '<div>\n  <p>新 HTML 區塊內容</p>\n</div>'
        : type === 'css' ? '/* 在此輸入額外 CSS 樣式 */\n'
        : type === 'js' ? '// 在此輸入 JavaScript 代碼\nconsole.log("區塊執行中...");'
        : type === 'markdown' ? '## 新文件標題\n\n- 項目清單 1\n- 項目清單 2\n'
        : 'SELECT * FROM tasks WHERE progress >= 100;',
    }
    setBlocks((prev) => [...prev, newBlock])
  }

  // 刪除區塊
  const deleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
  }

  // 修改區塊屬性
  const updateBlock = (id: string, patch: Partial<CodeBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }

  // 彙整目前所有已啟用的 Web 內容 (HTML + CSS + JS)
  const compiledWebContent = useMemo(() => {
    const activeBlocks = blocks.filter((b) => b.enabled)
    const htmlParts = activeBlocks.filter((b) => b.type === 'html').map((b) => b.content).join('\n')
    const cssParts = activeBlocks.filter((b) => b.type === 'css').map((b) => b.content).join('\n')
    const jsParts = activeBlocks.filter((b) => b.type === 'js').map((b) => b.content).join('\n')

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    ${cssParts}
  </style>
</head>
<body>
  ${htmlParts}
  <script>
    try {
      ${jsParts}
    } catch(err) {
      console.error(err);
    }
  </script>
</body>
</html>`
  }, [blocks])

  // 彙整 Markdown 與 SQL 區塊
  const markdownBlocks = useMemo(() => blocks.filter((b) => b.enabled && b.type === 'markdown'), [blocks])
  const sqlBlocks = useMemo(() => blocks.filter((b) => b.enabled && b.type === 'sql'), [blocks])

  // 即時渲染 Web iframe
  const renderIframe = () => {
    if (!iframeRef.current) return
    const iframe = iframeRef.current
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return

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
    doc.write(consoleHook + compiledWebContent)
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
    const timer = setTimeout(renderIframe, 200)
    return () => clearTimeout(timer)
  }, [compiledWebContent])

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden select-none">
      {/* ── 頂部區塊控制列 ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <span>💻</span> 程式碼演練區塊
          </span>
          <span className="text-xs text-slate-400 font-normal">
            ({blocks.length} 個區塊 • {blocks.filter((b) => b.enabled).length} 個啟用中)
          </span>
        </div>

        {/* 快捷新增各類型區塊按鈕 */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 mr-1">新增區塊：</span>
          <Button
            onClick={() => addBlock('html')}
            className="text-xs py-1 px-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800"
          >
            ＋ HTML
          </Button>
          <Button
            onClick={() => addBlock('css')}
            className="text-xs py-1 px-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
          >
            ＋ CSS
          </Button>
          <Button
            onClick={() => addBlock('js')}
            className="text-xs py-1 px-2.5 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800"
          >
            ＋ JS
          </Button>
          <Button
            onClick={() => addBlock('markdown')}
            className="text-xs py-1 px-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
          >
            ＋ Markdown
          </Button>
          <Button
            onClick={() => addBlock('sql')}
            className="text-xs py-1 px-2.5 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800"
          >
            ＋ SQL
          </Button>
        </div>
      </div>

      {/* ── 主工作區：左側多區塊編輯區 | 右側即時結果 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
        
        {/* 左側：可新增、刪除、修改的多區塊編輯清單 */}
        <div className="flex flex-col min-h-0 bg-slate-900 overflow-y-auto p-3 space-y-3">
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-xs gap-3">
              <span>目前沒有任何程式碼區塊</span>
              <Button onClick={() => addBlock('html')} className="bg-blue-600 text-white text-xs">
                ＋ 新增第一個 HTML 區塊
              </Button>
            </div>
          ) : (
            blocks.map((block, idx) => (
              <div
                key={block.id}
                className={cx(
                  'rounded-xl border transition-all duration-150 overflow-hidden',
                  block.enabled
                    ? 'border-slate-700 bg-slate-950 shadow-md'
                    : 'border-slate-800 bg-slate-950/40 opacity-60'
                )}
              >
                {/* 區塊標頭：類型、自訂標題、啟用開關、收合、刪除 */}
                <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-mono text-xs text-slate-500 font-bold">#{idx + 1}</span>
                    
                    {/* 區塊類型下拉 */}
                    <select
                      value={block.type}
                      onChange={(e) => updateBlock(block.id, { type: e.target.value as BlockType })}
                      className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] font-bold text-blue-400 uppercase outline-none cursor-pointer"
                    >
                      <option value="html">HTML</option>
                      <option value="css">CSS</option>
                      <option value="js">JS</option>
                      <option value="markdown">MD</option>
                      <option value="sql">SQL</option>
                    </select>

                    {/* 自訂區塊標題輸入框 */}
                    <input
                      type="text"
                      value={block.title}
                      onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                      placeholder="區塊名稱…"
                      className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-slate-200 outline-none hover:border-b border-slate-600 focus:border-blue-500 px-1 py-0.5"
                    />
                  </div>

                  {/* 區塊操作工具：啟用/停用、收合、刪除 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer select-none mr-1">
                      <input
                        type="checkbox"
                        checked={block.enabled}
                        onChange={(e) => updateBlock(block.id, { enabled: e.target.checked })}
                        className="rounded border-slate-700 text-blue-600 focus:ring-0"
                      />
                      <span>{block.enabled ? '啟用' : '停用'}</span>
                    </label>

                    <button
                      onClick={() => updateBlock(block.id, { collapsed: !block.collapsed })}
                      title={block.collapsed ? '展開內容' : '收合內容'}
                      className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 text-xs cursor-pointer"
                    >
                      {block.collapsed ? '▼' : '▲'}
                    </button>

                    <button
                      onClick={() => deleteBlock(block.id)}
                      title="刪除此區塊"
                      className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-950/50 text-xs cursor-pointer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* 程式碼編輯區域 */}
                {!block.collapsed && (
                  <div className="relative">
                    <textarea
                      value={block.content}
                      onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                      spellCheck={false}
                      rows={Math.max(4, Math.min(18, block.content.split('\n').length + 1))}
                      className="w-full p-3 font-mono text-xs leading-relaxed bg-transparent text-slate-100 outline-none resize-y selection:bg-blue-600 selection:text-white"
                      placeholder={`在此輸入 ${block.type.toUpperCase()} 程式碼…`}
                    />
                  </div>
                )}
              </div>
            ))
          )}

          {/* 底部快速新增區塊列 */}
          {blocks.length > 0 && (
            <div className="pt-2 flex items-center justify-center">
              <Button
                onClick={() => addBlock('html')}
                className="w-full py-2 bg-slate-800/80 hover:bg-slate-800 border-dashed border border-slate-700 text-slate-300 text-xs font-semibold"
              >
                ＋ 新增程式碼區塊
              </Button>
            </div>
          )}
        </div>

        {/* 右側：即時結果輸出與預覽區 */}
        <div className="flex flex-col min-h-0 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 shrink-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                即時組合渲染結果 (Live Preview)
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              即時自動編譯 • 無需手動重整
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
            {/* 1. Web 組合預覽 (HTML + CSS + JS) */}
            <div className="w-full h-96 min-h-[320px] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white shadow-xs">
              <iframe
                ref={iframeRef}
                title="Web Playground Preview"
                sandbox="allow-scripts allow-modals allow-same-origin"
                className="w-full h-full border-0"
              />
            </div>

            {/* 2. 若有 Markdown 區塊，展示 Markdown 渲染 */}
            {markdownBlocks.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span>📝</span> Markdown 預覽輸出
                </div>
                {markdownBlocks.map((b) => (
                  <div key={b.id} className="mb-4 last:mb-0">
                    <h4 className="text-xs font-semibold text-slate-500 mb-2 font-mono">{b.title}</h4>
                    <div className="prose prose-slate dark:prose-invert max-w-none text-xs whitespace-pre-wrap bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      {b.content}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. 若有 SQL 區塊，展示 SQL 模擬資料表格 */}
            {sqlBlocks.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
                <div className="text-xs font-bold text-purple-700 dark:text-purple-400 mb-3 flex items-center gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span>🗄️</span> SQL 查詢模擬輸出
                </div>
                {sqlBlocks.map((b) => (
                  <div key={b.id} className="mb-4 last:mb-0">
                    <h4 className="text-xs font-semibold text-slate-500 mb-2 font-mono">{b.title}</h4>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-x-auto bg-white dark:bg-slate-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-700/60 font-semibold text-slate-700 dark:text-slate-200">
                            <th className="px-3 py-2">任務編號 (Ref)</th>
                            <th className="px-3 py-2">任務標題 (Title)</th>
                            <th className="px-3 py-2">進度 (Progress)</th>
                            <th className="px-3 py-2">負責人 (Assignee)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                          {(projectTasks.length > 0 ? projectTasks : [
                            { ref: 'MRG-1', title: '首頁視覺設計', progress: 100, assigneeName: 'Alice' },
                            { ref: 'MRG-2', title: '使用者登入 API', progress: 60, assigneeName: 'Bob' },
                            { ref: 'MRG-3', title: '角色權限控制', progress: 0, assigneeName: 'Charlie' },
                          ]).map((t, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                              <td className="px-3 py-1.5 font-mono font-bold text-blue-600 dark:text-blue-400">{t.ref || `MRG-${i + 1}`}</td>
                              <td className="px-3 py-1.5">{t.title}</td>
                              <td className="px-3 py-1.5 font-mono">{t.progress ?? 0}%</td>
                              <td className="px-3 py-1.5">{t.assigneeName || '未指派'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Web 模式下的 Console 日誌區 */}
            {webLogs.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-300">
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800 text-[10px] text-slate-400 font-bold">
                  <span>🖥️ Console 輸出 ({webLogs.length})</span>
                  <button onClick={() => setWebLogs([])} className="hover:text-slate-200 cursor-pointer">清除日誌</button>
                </div>
                <div className="space-y-0.5 max-h-36 overflow-y-auto">
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

      </div>
    </div>
  )
}
