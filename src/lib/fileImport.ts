export type SupportedFile = 'txt' | 'docx' | 'pdf'

const PDF_PAGE_LIMIT = 80

export function detectFileType(name: string): SupportedFile | null {
  const ext = name.toLowerCase().split('.').pop()
  if (ext === 'txt') return 'txt'
  if (ext === 'docx') return 'docx'
  if (ext === 'pdf') return 'pdf'
  return null
}

/** 从 TXT/Word/PDF 中提取纯文本；Word、PDF 解析库按需动态加载 */
export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.doc') && !name.endsWith('.docx')) {
    throw new Error('旧版 .doc 不支持，请先另存为 .docx 或 .txt')
  }
  const type = detectFileType(file.name)
  if (!type) throw new Error('仅支持 TXT / Word(.docx) / PDF 文件')

  const text =
    type === 'txt'
      ? await readAsText(file)
      : type === 'docx'
        ? await extractDocx(file)
        : await extractPdf(file)

  if (!text || text.trim().length < 5) {
    throw new Error('未提取到有效文字，可能是扫描图片，需手动输入')
  }
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      // UTF-8 读出乱码时回退 GBK（常见于老 Windows 题库）
      if (text.includes('�') || text.includes('锟斤拷')) {
        const r2 = new FileReader()
        r2.onload = () => resolve(String(r2.result ?? text))
        r2.onerror = () => resolve(text)
        r2.readAsText(file, 'GBK')
      } else {
        resolve(text)
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file, 'UTF-8')
  })
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value ?? ''
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const pageCount = Math.min(pdf.numPages, PDF_PAGE_LIMIT)
  const pages: string[] = []

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    let pageText = ''
    let lastY: number | null = null
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue
      const y = item.transform[5]
      if (lastY !== null && Math.abs(y - lastY) > 5) pageText += '\n'
      else if (pageText) pageText += ' '
      pageText += item.str
      lastY = y
    }
    if (pageText.trim()) pages.push(pageText.trim())
  }
  return pages.join('\n\n')
}
