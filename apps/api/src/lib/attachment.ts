import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import { env } from './env.js'
import { badRequest } from './errors.js'

/**
 * 任務單與問題單附件檔案管理模組。
 *
 * 實體檔案存放於 /data/attachments/tasks/{taskId}/{storedName}。
 */

export const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB

const IMAGE_TYPES = [
  { ext: 'png',  mime: 'image/png',  magic: [0x89, 0x50, 0x4e, 0x47] },
  { ext: 'jpg',  mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  { ext: 'jpeg', mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  { ext: 'webp', mime: 'image/webp', magic: [0x52, 0x49, 0x46, 0x46] },
  { ext: 'gif',  mime: 'image/gif',  magic: [0x47, 0x49, 0x46, 0x38] },
] as const

const taskDir = (taskId: string) => join(env.attachmentsDir, 'tasks', taskId)

/** 驗證圖片檔頭 */
export function validateImage(buf: Buffer, explicitMime?: string): { mime: string } {
  const t = IMAGE_TYPES.find(t => t.magic.every((b, i) => buf[i] === b))
  if (t) {
    if (t.ext === 'webp' && buf.subarray(8, 12).toString('ascii') !== 'WEBP') {
      throw badRequest('不支援的圖片格式，請上傳 PNG、JPG、WebP 或 GIF 圖片')
    }
    return { mime: t.mime }
  }
  // SVG 特例處理（文字 XML）
  if (explicitMime === 'image/svg+xml' || buf.subarray(0, 100).toString('utf8').includes('<svg')) {
    return { mime: 'image/svg+xml' }
  }
  throw badRequest('問題單附件僅接受圖片格式（PNG、JPG、WebP、GIF、SVG）')
}

/** 儲存任務附件實體檔案，回傳儲存檔名與大小 */
export async function saveTaskAttachmentFile(
  taskId: string,
  attachmentId: string,
  originalFilename: string,
  dataUrl: string,
  kind: 'file' | 'image'
): Promise<{ storedName: string; mimeType: string; fileSize: number }> {
  const comma = dataUrl.indexOf(',')
  if (!dataUrl.startsWith('data:') || comma < 0) throw badRequest('檔案資料格式不正確 (需為 Data URL)')

  const header = dataUrl.slice(5, comma) // e.g. "application/pdf;base64" or "image/png;base64"
  const explicitMime = header.split(';')[0]?.toLowerCase() || 'application/octet-stream'

  const buf = Buffer.from(dataUrl.slice(comma + 1), 'base64')
  if (!buf.length) throw badRequest('上傳檔案不可為空')

  const maxBytes = kind === 'image' ? MAX_IMAGE_BYTES : MAX_FILE_BYTES
  if (buf.length > maxBytes) {
    throw badRequest(`檔案過大，大小上限為 ${Math.round(maxBytes / (1024 * 1024))} MB`)
  }

  let mimeType = explicitMime
  if (kind === 'image') {
    const verified = validateImage(buf, explicitMime)
    mimeType = verified.mime
  }

  const safeOriginal = basename(originalFilename).replace(/[^a-zA-Z0-9._\-\u4e00-\u9fa5]/g, '_')
  const ext = extname(safeOriginal)
  const storedName = `${attachmentId}-${Date.now()}${ext || ''}`

  const dir = taskDir(taskId)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, storedName), buf)

  return {
    storedName,
    mimeType,
    fileSize: buf.length,
  }
}

/** 讀取任務附件實體檔案 */
export async function readTaskAttachmentFile(
  taskId: string,
  storedName: string
): Promise<{ body: Buffer } | null> {
  const safe = basename(storedName)
  const filePath = join(taskDir(taskId), safe)
  try {
    const body = await readFile(filePath)
    return { body }
  } catch {
    return null
  }
}

/** 刪除任務附件實體檔案 */
export async function removeTaskAttachmentFile(
  taskId: string,
  storedName: string
): Promise<void> {
  const safe = basename(storedName)
  const filePath = join(taskDir(taskId), safe)
  await unlink(filePath).catch(() => {})
}
