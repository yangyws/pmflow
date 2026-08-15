/**
 * PMFlow API 跨平台端對端整合測試 (Cross-platform E2E Test Runner)
 *
 * 支援在 Windows / macOS / Linux 本機或 CI 環境執行。
 * 預設測試目標：http://localhost:8480/api/v1 (Docker dev) 或 http://localhost:8080/api/v1
 */

const API_BASE = process.env.API_URL || process.env.API || 'http://localhost:8480/api/v1'

let passCount = 0
let failCount = 0

function ok(name: string) {
  passCount++
  console.log(`  ✅ ${name}`)
}

function fail(name: string, detail: string) {
  failCount++
  console.log(`  ❌ ${name}`)
  console.log(`     → ${detail}`)
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}${path}`
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...((options.headers as Record<string, string>) || {}),
  }
  const res = await fetch(url, {
    ...options,
    headers,
  })
  let data: any = null
  const text = await res.text()
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return { status: res.status, data, headers: res.headers }
}

async function run() {
  console.log(`\n════════ 🚀 開始執行 PMFlow API 端對端整合測試 ════════`)
  console.log(`測試目標: ${API_BASE}\n`)

  // 1. 登入示範帳號
  console.log('── 1. 身份認證 (Auth) ──')
  let token = ''
  try {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'demo@pmflow.local', password: 'demo1234' }),
    })
    if (res.status === 200 && res.data?.accessToken) {
      token = res.data.accessToken
      ok('登入取得 JWT AccessToken')
    } else {
      fail('登入取得 JWT AccessToken', `HTTP ${res.status}: ${JSON.stringify(res.data)}`)
    }
  } catch (err: any) {
    fail('連線至 API 服務失敗', `${err.message} (請確認 Docker 容器或 API 是否正在運行)`)
    console.log(`\n════════ 測試終止：通過 ${passCount}，失敗 ${failCount} ════════\n`)
    process.exit(1)
  }

  const authHeaders = { Authorization: `Bearer ${token}` }

  // 2. 錯誤密碼攔截
  const resWrongPass = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'demo@pmflow.local', password: 'wrongpassword' }),
  })
  if (resWrongPass.status === 401) {
    ok('錯誤密碼攔截 (401 Unauthorized)')
  } else {
    fail('錯誤密碼攔截', `期望 401，實得 ${resWrongPass.status}`)
  }

  // 3. 未帶 Token 攔截
  const resNoAuth = await request('/projects')
  if (resNoAuth.status === 401) {
    ok('未授權請求攔截 (401 Unauthorized)')
  } else {
    fail('未授權請求攔截', `期望 401，實得 ${resNoAuth.status}`)
  }

  // 4. 專案清單與大項目查詢
  console.log('\n── 2. 專案與設定 (Projects & Parameters) ──')
  const resProjects = await request('/projects', { headers: authHeaders })
  let projectId = ''
  if (resProjects.status === 200 && Array.isArray(resProjects.data?.projects)) {
    const projs = resProjects.data.projects
    ok(`取得專案清單成功 (共有 ${projs.length} 個專案)`)
    const mrg = projs.find((p: any) => p.key === 'MRG') || projs[0]
    if (mrg) {
      projectId = mrg.id
      ok(`找到目標專案 [${mrg.key}] ${mrg.name} (ID: ${mrg.id})`)
    }
  } else {
    fail('取得專案清單', `HTTP ${resProjects.status}`)
  }

  if (!projectId) {
    console.log(`\n════════ 測試終止：無可用專案 ════════\n`)
    process.exit(1)
  }

  // 5. 專案參數查詢 (狀態、優先度、類型)
  const resParams = await request(`/projects/${projectId}/parameters`, { headers: authHeaders })
  if (resParams.status === 200 && Array.isArray(resParams.data?.params)) {
    const params = resParams.data.params
    const statuses = params.filter((p: any) => p.kind === 'status')
    const types = params.filter((p: any) => p.kind === 'type')
    ok(`取得專案系統參數成功 (${statuses.length} 狀態, ${types.length} 類型)`)
  } else {
    fail('取得專案系統參數', `HTTP ${resParams.status}`)
  }

  // 6. 任務清單與篩選
  console.log('\n── 3. 任務操作與依賴管理 (Tasks & Graph) ──')
  const resTasks = await request(`/projects/${projectId}/tasks`, { headers: authHeaders })
  let existingTaskId = ''
  if (resTasks.status === 200 && Array.isArray(resTasks.data?.tasks)) {
    const tasks = resTasks.data.tasks
    ok(`取得專案任務清單成功 (共 ${tasks.length} 個任務)`)
    if (tasks.length > 0) existingTaskId = tasks[0].id
  } else {
    fail('取得專案任務清單', `HTTP ${resTasks.status}`)
  }

  // 7. 新增測試任務
  const testTaskTitle = `E2E 測試任務 ${Date.now()}`
  const resCreateTask = await request(`/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: testTaskTitle,
      type: 'TASK',
      progress: 50,
    }),
  })
  let createdTaskId = ''
  if (resCreateTask.status === 201 && resCreateTask.data?.id) {
    createdTaskId = resCreateTask.data.id
    ok(`新增任務成功: [${resCreateTask.data.ref || 'MRG'}] ${testTaskTitle}`)
  } else {
    fail('新增任務失敗', `HTTP ${resCreateTask.status}: ${JSON.stringify(resCreateTask.data)}`)
  }

  // 8. 修改任務內容
  if (createdTaskId) {
    const resPatchTask = await request(`/tasks/${createdTaskId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        title: `${testTaskTitle} (已修改)`,
        progress: 80,
      }),
    })
    if (resPatchTask.status === 200 && resPatchTask.data?.progress === 80) {
      ok('修改任務資料與進度成功 (80%)')
    } else {
      fail('修改任務資料', `HTTP ${resPatchTask.status}`)
    }
  }

  // 9. 關聯拓撲圖與排程推算
  const resSchedule = await request(`/projects/${projectId}/schedule`, { headers: authHeaders })
  if (resSchedule.status === 200 && resSchedule.data?.tasks) {
    ok(`排程引擎推算成功 (關鍵路徑節點數: ${resSchedule.data.criticalPath?.length ?? 0})`)
  } else {
    fail('排程引擎推算', `HTTP ${resSchedule.status}`)
  }

  // 10. 刪除測試任務清理
  if (createdTaskId) {
    const resDelete = await request(`/tasks/${createdTaskId}`, {
      method: 'DELETE',
      headers: authHeaders,
    })
    if (resDelete.status === 200 || resDelete.status === 204) {
      ok('刪除測試任務清理完成')
    } else {
      fail('刪除測試任務', `HTTP ${resDelete.status}: ${JSON.stringify(resDelete.data)}`)
    }
  }

  // 總結報告
  console.log(`\n════════ 測試結果：通過 ${passCount}，失敗 ${failCount} ════════\n`)
  if (failCount > 0) {
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('執行過程發生未預期錯誤:', err)
  process.exit(1)
})
