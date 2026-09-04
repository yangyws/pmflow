import { useState, useRef, type ChangeEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Api, type TaskAttachment } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Button, cx } from './ui'
import { T } from '../strings'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(filename: string, mimeType: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (mimeType.startsWith('image/')) return '🖼️'
  if (ext === 'pdf' || mimeType.includes('pdf')) return '📕'
  if (['doc', 'docx'].includes(ext) || mimeType.includes('word')) return '📘'
  if (['xls', 'xlsx', 'csv'].includes(ext) || mimeType.includes('sheet') || mimeType.includes('excel')) return '📊'
  if (['ppt', 'pptx'].includes(ext) || mimeType.includes('presentation')) return '📙'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦'
  if (['txt', 'md', 'json', 'log'].includes(ext)) return '📄'
  return '📎'
}

function ImageThumbnail({
  url,
  filename,
  onClick,
}: {
  url: string
  filename: string
  onClick: () => void
}) {
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      className="relative aspect-4/3 w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-pointer overflow-hidden group/thumb"
      onClick={onClick}
      title="點擊放大預覽"
    >
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 animate-pulse text-[11px] text-slate-400">
          載入中…
        </div>
      )}
      {error ? (
        <div className="flex flex-col items-center justify-center p-2 text-center text-slate-400 dark:text-slate-500">
          <span className="text-2xl">🖼️</span>
          <span className="text-[10px] mt-1">無法載入預覽</span>
        </div>
      ) : (
        <img
          src={url}
          alt={filename}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={cx(
            'w-full h-full object-cover transition-transform duration-200 group-hover/thumb:scale-105',
            !loaded && 'opacity-0'
          )}
          loading="lazy"
        />
      )}
      <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
        <span className="opacity-0 group-hover/thumb:opacity-100 bg-black/60 text-white rounded-full p-1.5 text-xs transition-opacity shadow-sm">
          🔍
        </span>
      </div>
    </div>
  )
}

interface TaskAttachmentsProps {
  taskId: string
  isBug: boolean
  attachments?: TaskAttachment[]
  canEdit?: boolean
}

export function TaskAttachments({
  taskId,
  isBug,
  attachments = [],
  canEdit = true,
}: TaskAttachmentsProps) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setErrorMsg(null)
      const maxMb = isBug ? 10 : 25
      if (file.size > maxMb * 1024 * 1024) {
        throw new Error(T.task.drawer.fileTooLarge(maxMb))
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('讀取檔案失敗'))
        reader.readAsDataURL(file)
      })

      return Api.uploadTaskAttachment(taskId, {
        filename: file.name,
        dataUrl,
        kind: isBug ? 'image' : 'file',
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] })
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || '上傳失敗')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      return Api.deleteTaskAttachment(taskId, attachmentId)
    },
    onSuccess: () => {
      setDeleteConfirmId(null)
      qc.invalidateQueries({ queryKey: ['task', taskId] })
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || '刪除失敗')
    },
  })

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadMutation.mutate(file)
    }
  }

  // 根據任務類型過濾或分組
  const filteredList = isBug
    ? attachments.filter(a => a.kind === 'image' || a.mimeType.startsWith('image/'))
    : attachments

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-xs space-y-3">
      {/* 標題與上傳按鈕 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-sm sm:text-base">{isBug ? '🖼️' : '📎'}</span>
          <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
            {isBug ? T.task.drawer.imageAttachments : T.task.drawer.fileAttachments}
          </h3>
          <span className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-mono">
            ({filteredList.length})
          </span>
        </div>

        {canEdit && (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept={isBug ? 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml' : undefined}
              className="hidden"
            />
            <Button
              variant="default"
              className="text-xs py-1 px-2.5 sm:px-3 font-semibold shadow-xs cursor-pointer"
              disabled={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadMutation.isPending ? (
                <span>⏳ {T.task.drawer.uploading}</span>
              ) : isBug ? (
                <span>📷 {T.task.drawer.uploadImage}</span>
              ) : (
                <span>⬆️ {T.task.drawer.uploadFile}</span>
              )}
            </Button>
          </div>
        )}
      </div>

      {errorMsg && (
        <p className="rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/30">
          {errorMsg}
        </p>
      )}

      {/* 附件清單：問題單以縮圖網格呈現；任務單以文件卡片呈現 */}
      {filteredList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-400 dark:text-slate-500">
          {isBug ? T.task.drawer.noImages : T.task.drawer.noFiles}
        </div>
      ) : isBug ? (
        /* 問題單：圖片截圖縮圖牆 */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
          {filteredList.map((att) => {
            const url = Api.taskAttachmentUrl(taskId, att.id)
            const canDeleteThis = canEdit || (user?.id && att.userId === user.id)

            return (
              <div
                key={att.id}
                className="group relative flex flex-col rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 overflow-hidden shadow-xs hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
              >
                {/* 縮圖預覽 */}
                <ImageThumbnail
                  url={url}
                  filename={att.filename}
                  onClick={() => setPreviewImage({ url, name: att.filename })}
                />

                {/* 檔名與資訊 */}
                <div className="p-2 flex-1 flex flex-col justify-between">
                  <p
                    className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate"
                    title={att.filename}
                  >
                    {att.filename}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                    <span>{formatBytes(att.fileSize)}</span>
                    <span>{att.userName || '成員'}</span>
                  </div>
                </div>

                {/* 刪除按鈕 */}
                {canDeleteThis && (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(att.id)}
                    className="absolute top-1.5 right-1.5 rounded-full bg-black/60 hover:bg-red-600 text-white p-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                    title="刪除圖片"
                  >
                    🗑️
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* 任務單：文件檔案卡片清單 */
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 overflow-hidden">
          {filteredList.map((att) => {
            const url = Api.taskAttachmentUrl(taskId, att.id)
            const icon = getFileIcon(att.filename, att.mimeType)
            const canDeleteThis = canEdit || (user?.id && att.userId === user.id)

            return (
              <div
                key={att.id}
                className="flex items-center justify-between gap-2.5 px-3 py-2 text-xs hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-base shrink-0 select-none">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={att.filename}
                      className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 truncate block underline-offset-2 hover:underline"
                      title={att.filename}
                    >
                      {att.filename}
                    </a>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                      <span>{formatBytes(att.fileSize)}</span>
                      <span>•</span>
                      <span>{att.userName || '成員'}</span>
                      <span>•</span>
                      <span>{new Date(att.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={att.filename}
                    className="inline-flex items-center justify-center rounded px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs"
                  >
                    ⬇️ {T.task.drawer.download}
                  </a>
                  {canDeleteThis && (
                    <Button
                      variant="ghost"
                      className="text-xs p-1 text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 cursor-pointer"
                      onClick={() => setDeleteConfirmId(att.id)}
                      title="刪除檔案"
                    >
                      🗑️
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 圖片燈箱放大預覽彈窗 */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-white p-4 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                {previewImage.name}
              </h4>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 text-base leading-none cursor-pointer"
                onClick={() => setPreviewImage(null)}
              >
                ✕
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-2 bg-slate-950/80 rounded-lg overflow-auto">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-h-[70vh] max-w-full object-contain rounded"
              />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <a
                href={previewImage.url}
                target="_blank"
                rel="noopener noreferrer"
                download={previewImage.name}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-semibold shadow-xs"
              >
                ⬇️ 下載原圖
              </a>
              <Button variant="default" onClick={() => setPreviewImage(null)}>
                關閉
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 刪除確認彈窗 */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">刪除附件</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              {T.task.drawer.confirmDeleteAttachment}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleteMutation.isPending}
              >
                {T.common.cancel}
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? '刪除中…' : '確認刪除'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
