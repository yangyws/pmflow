import { useState, useEffect, type ReactNode } from 'react'
import { Button } from './ui'

interface DesktopRecommendedNoticeProps {
  viewName: string
  onSwitchToList: () => void
  children: ReactNode
}

export function DesktopRecommendedNotice({
  viewName,
  onSwitchToList,
  children,
}: DesktopRecommendedNoticeProps) {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 768
  })

  const [dismissed, setDismissed] = useState<boolean>(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <div className="relative w-full h-full flex flex-col min-h-0 overflow-hidden">
      {/* 行動裝置全螢幕友善提示 Modal */}
      {isMobile && !dismissed && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-2xl dark:bg-blue-950/60">
              💻
            </div>

            <div className="mt-4 text-center">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                建議使用電腦版觀看
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  【{viewName}】
                </span>
                包含複雜的畫布拖曳、多向關聯連線或排程時間軸功能，在手機或小螢幕上操作容易受限。建議使用電腦或寬螢幕設備以獲得最佳體驗。
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Button
                variant="primary"
                onClick={onSwitchToList}
                className="w-full justify-center py-2 text-sm shadow-xs cursor-pointer font-semibold"
              >
                📋 切換至清單檢視（推薦）
              </Button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="w-full rounded-md py-1.5 text-xs text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer text-center select-none"
              >
                繼續在手機上瀏覽
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 手機上若使用者選擇繼續瀏覽，頂部保留簡約小提示條 */}
      {isMobile && dismissed && (
        <div className="shrink-0 flex items-center justify-between border-b border-amber-200 bg-amber-50/90 px-3 py-1.5 text-[11px] text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-300">
          <span className="truncate">
            💡 目前檢視為電腦版專用排版，建議使用電腦設備以獲完整操作
          </span>
          <button
            type="button"
            onClick={onSwitchToList}
            className="ml-2 shrink-0 font-medium underline hover:text-amber-950 dark:hover:text-amber-100 cursor-pointer"
          >
            回清單
          </button>
        </div>
      )}

      {/* 實際頁面內容 */}
      <div className="relative flex-1 min-h-0 overflow-hidden w-full h-full">
        {children}
      </div>
    </div>
  )
}
