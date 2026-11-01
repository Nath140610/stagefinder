import { jsPDF } from 'jspdf'
import mammoth from 'mammoth'

const pdfName = (name) => `${name.replace(/\.[^.]+$/, '')}.pdf`

function pdfFromText(name, text) {
  const pdf = new jsPDF({ unit:'pt', format:'a4' })
  const margin = 48, lineHeight = 16, pageHeight = pdf.internal.pageSize.getHeight()
  let y = margin
  for (const line of pdf.splitTextToSize(text || 'Document vide', 500)) {
    if (y > pageHeight - margin) { pdf.addPage(); y = margin }
    pdf.text(line, margin, y)
    y += lineHeight
  }
  return new File([pdf.output('blob')], pdfName(name), { type:'application/pdf' })
}

export async function convertToPdf(file) {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return { file, converted:false }
  const lowerName = file.name.toLowerCase()
  if (lowerName.endsWith('.docx')) {
    const { value } = await mammoth.extractRawText({ arrayBuffer:await file.arrayBuffer() })
    return { file:pdfFromText(file.name, value), converted:true }
  }
  if (file.type.startsWith('text/') || lowerName.endsWith('.txt')) return { file:pdfFromText(file.name, await file.text()), converted:true }
  if (file.type.startsWith('image/')) {
    const source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(file) })
    const pdf = new jsPDF({ unit:'pt', format:'a4' })
    const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=source })
    const ratio = Math.min(500 / image.width, 700 / image.height)
    const width = image.width * ratio, height = image.height * ratio
    pdf.addImage(source, 'JPEG', (595 - width) / 2, (842 - height) / 2, width, height)
    return { file:new File([pdf.output('blob')], pdfName(file.name), { type:'application/pdf' }), converted:true }
  }
  throw new Error('Ce format ne peut pas être converti ici. Utilise un PDF, un DOCX, une image ou un fichier texte.')
}
