// 生成 E2E 夹具：bank.docx（中文「答案：」格式）与 bank-synth.pdf（拉丁文，走通 pdfjs 抽取）
// 运行：bun e2e/fixtures/generate.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import JSZip from 'jszip'
import { PDFDocument, StandardFonts } from 'pdf-lib'

const here = dirname(fileURLToPath(import.meta.url))

const DOCX_TEXT = `[单选] 1. 文档单选题，正确的是哪个？
A. 甲
B. 乙
C. 丙
答案：B

[多选] 2. 文档多选题，哪些正确？
A. 子
B. 丑
C. 寅
答案：A,C

[判断] 3. 这是一道文档判断题。
答案：对`

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function makeDocx() {
  const paragraphs = DOCX_TEXT.split('\n')
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${esc(line)}</w:t></w:r></w:p>`)
    .join('')
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`

  const zip = new JSZip()
  zip.file('[Content_Types].xml', contentTypes)
  zip.file('_rels/.rels', rels)
  zip.file('word/document.xml', documentXml)
  const buf = await zip.generateAsync({ type: 'nodebuffer' })
  writeFileSync(join(here, 'bank.docx'), buf)
}

// 拉丁文题库：括号答案 + Answer: 关键字，覆盖单选/多选/判断（T/F → 对/错）
const PDF_LINES = [
  '1. The capital of France is ( B ).',
  'A. London',
  'B. Paris',
  'C. Berlin',
  '',
  '2. Which of these are fruits ( A C )?',
  'A. Apple',
  'B. Chair',
  'C. Mango',
  '',
  '3. Water boils at 100 degrees. Answer: T',
  '',
  '4. The sun rises in the west. ( F )',
]

async function makePdf() {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const page = pdf.addPage([595, 842])
  let y = 800
  for (const line of PDF_LINES) {
    page.drawText(line, { x: 50, y, size: 14, font })
    y -= 26
  }
  const bytes = await pdf.save()
  writeFileSync(join(here, 'bank-synth.pdf'), bytes)
}

await makeDocx()
await makePdf()
console.log('fixtures generated: bank.docx, bank-synth.pdf')
