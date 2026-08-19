import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Api, type ApiToken } from '../lib/api'
import { Button, Field, Input, Select, Spinner } from './ui'

export function AiSkillModal({
  open,
  onClose,
  currentProjectId,
}: {
  open: boolean
  onClose: () => void
  currentProjectId?: string | null
}) {
  const [copied, setCopied] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string>(currentProjectId ?? '')
  const [selectedToken, setSelectedToken] = useState<string>('')
  const [newTokenName, setNewTokenName] = useState('')
  const [createdTokenPlaintext, setCreatedTokenPlaintext] = useState<string | null>(null)

  const { data: projectData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => Api.projects(),
    enabled: open,
  })

  const { data: tokenData, isLoading: loadingTokens, refetch: refetchTokens } = useQuery({
    queryKey: ['myApiTokens'],
    queryFn: () => Api.apiTokens(),
    enabled: open,
  })

  const createToken = useMutation({
    mutationFn: (name: string) => Api.createApiToken({ name: name || 'AI Assistant Token' }),
    onSuccess: async res => {
      setCreatedTokenPlaintext(res.plaintext)
      setSelectedToken(res.plaintext)
      setNewTokenName('')
      await refetchTokens()
    },
  })

  if (!open) return null

  const projects = projectData?.projects ?? []
  const activeProjectId = selectedProjectId || currentProjectId || projects[0]?.id || ''
  const activeProject = projects.find(p => p.id === activeProjectId)

  const tokens: ApiToken[] = tokenData?.tokens ?? []
  const activeTokenText = createdTokenPlaintext || selectedToken || (tokens.length > 0 ? tokens[0].prefix + '...' : '<YOUR_API_TOKEN>')

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : 'http://localhost:8480/api/v1'

  const promptText = `你現在是我的 PMFlow 專案助理。請先呼叫 GET ${baseUrl}/skills（附帶 Authorization: Bearer ${activeTokenText} 標頭）取得專案資訊（目前目標專案：${activeProject?.name ?? '預設專案'}，專案 ID: ${activeProjectId}，代碼: ${activeProject?.key ?? ''}）與所有可用 API 操作清單。

接著請根據我提供的清單或需求，自動解析內容並呼叫對應的 API（如建立任務、建立排程/並行關聯線、掛載父子階層或登錄詢問單）發送至 PMFlow。

我的清單／需求如下：
[請在此貼上你的清單或需求]`

  const handleCopy = () => {
    navigator.clipboard.writeText(promptText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-lg dark:bg-blue-500/20">
              🤖
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                AI 串接指令與技能 (Skill Prompt)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                複製下方提示詞給 AI，AI 將自動打 API 探索專案結構並發送資料
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-auto px-6 py-5">
          {/* 專案與權杖選擇列 */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                目標專案
              </label>
              <Select
                value={activeProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="w-full text-xs">
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    [{p.key}] {p.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                API 權杖 (Token)
              </label>
              {createdTokenPlaintext ? (
                <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <span>🔑 已帶入新建立的權杖</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="填寫用途快速建立權杖…"
                    value={newTokenName}
                    onChange={e => setNewTokenName(e.target.value)}
                    className="flex-1 text-xs"
                  />
                  <Button
                    variant="primary"
                    disabled={createToken.isPending}
                    onClick={() => createToken.mutate(newTokenName)}
                    className="shrink-0 text-xs">
                    {createToken.isPending ? '建立中…' : '產生'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* 複製區塊 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                📋 複製給 AI 的完整 Prompt
              </span>
              {copied && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  ✓ 已複製到剪貼簿！
                </span>
              )}
            </div>

            <div className="relative">
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100 ring-1 ring-slate-800 dark:bg-slate-950 dark:ring-slate-800">
                {promptText}
              </pre>
            </div>
          </div>

          {/* 使用指南說明 */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs leading-relaxed text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
            <div className="font-semibold">💡 使用方式：</div>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-blue-800 dark:text-blue-300">
              <li>點擊下方「複製 Prompt」按鈕。</li>
              <li>貼給 Claude、Gemini、ChatGPT、Cursor 或任何 AI CLI。</li>
              <li>把您的任務需求、會議紀錄或清單貼在最後面，AI 將自動辨識並發送 API 寫入 PMFlow。</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900/60">
          <span className="text-xs text-slate-400 dark:text-slate-500">
            API 規格端點：<code className="font-mono">{baseUrl}/skills</code>
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              關閉
            </Button>
            <Button variant="primary" onClick={handleCopy} className="gap-1.5 font-medium">
              <span>📋</span> {copied ? '已複製！' : '一鍵複製 Prompt'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
