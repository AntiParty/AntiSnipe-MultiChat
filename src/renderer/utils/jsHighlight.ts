const KW = new Set([
  'function','return','const','let','var','if','else','for','of','in','new',
  'null','undefined','true','false','export','default','class','this','typeof',
  'instanceof','switch','case','break','continue','while','do','throw','try',
  'catch','finally','import','from','async','await','delete','void','static'
])

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// VS Code dark+ palette
const C = {
  keyword:  '#569cd6',
  string:   '#ce9178',
  comment:  '#6a9955',
  number:   '#b5cea8',
  fn:       '#dcdcaa',
  prop:     '#9cdcfe',
  regex:    '#d16969',
  default:  '#d4d4d4',
}

export function highlightJS(code: string): string {
  let out = ''
  let i = 0

  while (i < code.length) {
    const ch = code[i]
    const ch2 = code[i + 1]

    // Line comment
    if (ch === '/' && ch2 === '/') {
      const end = code.indexOf('\n', i)
      const s = end === -1 ? code.slice(i) : code.slice(i, end)
      out += `<span style="color:${C.comment}">${esc(s)}</span>`
      i = end === -1 ? code.length : end
      continue
    }

    // Block comment
    if (ch === '/' && ch2 === '*') {
      const end = code.indexOf('*/', i + 2)
      const s = end === -1 ? code.slice(i) : code.slice(i, end + 2)
      out += `<span style="color:${C.comment}">${esc(s)}</span>`
      i = end === -1 ? code.length : end + 2
      continue
    }

    // String / template literal
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch
      let j = i + 1
      while (j < code.length) {
        if (code[j] === '\\') { j += 2; continue }
        if (code[j] === q) { j++; break }
        j++
      }
      out += `<span style="color:${C.string}">${esc(code.slice(i, j))}</span>`
      i = j
      continue
    }

    // Number
    if (ch >= '0' && ch <= '9') {
      let j = i
      while (j < code.length && /[0-9._xXa-fA-F]/.test(code[j])) j++
      out += `<span style="color:${C.number}">${esc(code.slice(i, j))}</span>`
      i = j
      continue
    }

    // Identifier / keyword
    if (/[a-zA-Z_$]/.test(ch)) {
      let j = i
      while (j < code.length && /[a-zA-Z0-9_$]/.test(code[j])) j++
      const word = code.slice(i, j)
      if (KW.has(word)) {
        out += `<span style="color:${C.keyword}">${esc(word)}</span>`
      } else if (code[j] === '(') {
        out += `<span style="color:${C.fn}">${esc(word)}</span>`
      } else if (code[j - word.length - 1] === '.') {
        out += `<span style="color:${C.prop}">${esc(word)}</span>`
      } else {
        out += `<span style="color:${C.default}">${esc(word)}</span>`
      }
      i = j
      continue
    }

    out += esc(ch)
    i++
  }

  return out
}
