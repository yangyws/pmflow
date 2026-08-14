import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Api } from './api'

/**
 * 深色模式與主題設定（同步後端帳號資料庫與本地 localStorage）。
 */

export type ThemeChoice = 'light' | 'dark' | 'system'

const KEY = 'pmflow.theme'

function isChoice(v: unknown): v is ThemeChoice {
  return v === 'light' || v === 'dark' || v === 'system'
}

export function storedTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return isChoice(v) ? v : 'system'
  } catch {
    // 隱私模式下 localStorage 會直接丟例外，那就不處理
    return 'system'
  }
}

const prefersDark = () =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

export const resolveTheme = (choice: ThemeChoice): 'light' | 'dark' =>
  choice === 'system' ? (prefersDark() ? 'dark' : 'light') : choice

/**
 * 真正動到畫面的地方。除了掛 class，也要設 color-scheme ——
 * 捲軸、下拉選單、日期選擇器那些瀏覽器自己畫的東西只認它，不認 class。
 */
export function applyTheme(choice: ThemeChoice): void {
  const dark = resolveTheme(choice) === 'dark'
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
}

/**
 * 在 React 掛載之前先套一次，不然第一格畫面會閃一下白的。
 * main.tsx 進入點就會呼叫。
 */
export function applyStoredTheme(): void {
  applyTheme(storedTheme())
}

const ThemeContext = createContext<{
  choice: ThemeChoice
  resolved: 'light' | 'dark'
  setChoice: (c: ThemeChoice) => void
} | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(() => storedTheme())
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolveTheme(storedTheme()))

  // 登入後自動取得帳號偏好設定，並與後端同步
  const { data: profileData } = useQuery({
    queryKey: ['myProfile'],
    queryFn: () => Api.myProfile(),
    staleTime: 60_000,
    retry: false,
  })

  useEffect(() => {
    const backendTheme = profileData?.user?.theme
    if (backendTheme && isChoice(backendTheme) && backendTheme !== choice) {
      setChoiceState(backendTheme)
      setResolved(resolveTheme(backendTheme))
      applyTheme(backendTheme)
      try {
        localStorage.setItem(KEY, backendTheme)
      } catch {
        // ignore
      }
    }
  }, [profileData?.user?.theme])

  const setChoice = (c: ThemeChoice) => {
    setChoiceState(c)
    setResolved(resolveTheme(c))
    applyTheme(c)
    try {
      localStorage.setItem(KEY, c)
    } catch {
      // 存不進去就只有這次有效
    }
    // 即時寫回後端資料庫持久化存檔
    Api.updateProfile({ theme: c }).catch(() => {})
  }

  // 選「跟隨系統」的人，天黑時作業系統自己換過去，畫面要跟著換
  useEffect(() => {
    if (choice !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => { applyTheme('system'); setResolved(resolveTheme('system')) }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [choice])

  return (
    <ThemeContext.Provider value={{ choice, resolved, setChoice }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const v = useContext(ThemeContext)
  if (!v) throw new Error('useTheme 必須放在 ThemeProvider 底下')
  return v
}
