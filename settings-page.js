// Claude-chan's settings panel.
// The fold entries (collapseSet / foldEntry) and the buffered "restore defaults /
// cancel / save" flow are ported from the whale widget's settings panel:
// MeteorNOX/DeepSeek-Balance-Whale-Widget, assets/whale-widget.js (MIT,
// Copyright (c) 2026 MeteorNOX). Restyled and trimmed for Claude-chan.
const card = document.getElementById('card')

let saved = null // what is on disk
let buf = null // what the panel is editing; only written on 保存
let defaults = null
const refreshers = [] // re-read buf into every control (used by 恢复默认)
const summaries = [] // re-draw every entry's summary

// ---- Fold entry: an always-visible row that opens the body beneath it ----
// The body is animated with max-height and set to 'none' once open, so wrapping
// text later is never clipped. Several entries may be open at once.
function collapseSet(body, open, instant) {
  const arrow = body.arrow
  if (open) {
    body.dataset.open = '1'
    body.style.maxHeight = instant ? 'none' : body.scrollHeight + 'px'
    body.style.opacity = '1'
    arrow.textContent = '▾'
    if (!instant) {
      setTimeout(() => { if (body.dataset.open === '1') body.style.maxHeight = 'none' }, 260)
    }
  } else {
    body.dataset.open = '0'
    body.style.maxHeight = body.scrollHeight + 'px' // a start value, so it can shrink
    if (!instant) void body.offsetHeight
    body.style.maxHeight = '0px'
    body.style.opacity = '0'
    arrow.textContent = '▸'
  }
}

// opts: { checked, onToggle, summary() }
function foldEntry(label, opts) {
  const row = document.createElement('div')
  row.className = 'entry'
  row.title = `点这一行展开 / 收起「${label}」`

  if (opts.onToggle) {
    const check = document.createElement('input')
    check.type = 'checkbox'
    check.checked = !!opts.checked()
    check.title = `${label}开关`
    // Ticking the box must not also open or close the section.
    check.addEventListener('click', e => e.stopPropagation())
    check.addEventListener('change', () => { opts.onToggle(check.checked); refreshSummaries() })
    refreshers.push(() => { check.checked = !!opts.checked() })
    row.appendChild(check)
  }

  const name = document.createElement('span')
  name.className = 'name'
  name.textContent = label
  const gap = document.createElement('span')
  gap.className = 'gap'
  const summary = document.createElement('span')
  summary.className = 'summary'
  const arrow = document.createElement('span')
  arrow.className = 'arrow'
  arrow.textContent = '▸'
  row.append(name, gap, summary, arrow)

  const body = document.createElement('div')
  body.className = 'fold'
  body.dataset.open = '0'
  body.arrow = arrow

  row.addEventListener('click', () => collapseSet(body, body.dataset.open !== '1'))
  card.append(row, body)
  summaries.push(() => { summary.textContent = opts.summary() })
  return body
}

function refreshSummaries() {
  summaries.forEach(fn => fn())
}

// ---- Small controls, each bound to one path in buf ----
function get(path) {
  return path.split('.').reduce((o, k) => o[k], buf)
}
function set(path, value) {
  const keys = path.split('.')
  const last = keys.pop()
  keys.reduce((o, k) => o[k], buf)[last] = value
  refreshSummaries()
}

function row(host, label) {
  const el = document.createElement('div')
  el.className = 'row'
  if (label) {
    const key = document.createElement('label')
    key.className = 'key'
    key.textContent = label
    el.appendChild(key)
  }
  host.appendChild(el)
  return el
}

function checkbox(host, label, path) {
  const el = row(host)
  const box = document.createElement('input')
  box.type = 'checkbox'
  const text = document.createElement('label')
  text.textContent = label
  text.addEventListener('click', () => box.click())
  box.addEventListener('change', () => set(path, box.checked))
  refreshers.push(() => { box.checked = !!get(path) })
  el.append(box, text)
}

// A slider; `shown` turns the stored value into the text beside it.
function slider(host, label, path, min, max, step, shown) {
  const el = row(host, label)
  const input = document.createElement('input')
  input.type = 'range'
  Object.assign(input, { min, max, step })
  const value = document.createElement('span')
  value.className = 'value'
  input.addEventListener('input', () => { set(path, Number(input.value)); value.textContent = shown(Number(input.value)) })
  refreshers.push(() => { input.value = get(path); value.textContent = shown(get(path)) })
  el.append(input, value)
  return el
}

function select(host, label, path, options) {
  const el = row(host, label)
  const sel = document.createElement('select')
  for (const [value, text] of options) {
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = text
    sel.appendChild(opt)
  }
  sel.addEventListener('change', () => set(path, sel.value))
  refreshers.push(() => { sel.value = get(path) })
  el.appendChild(sel)
  return el
}

function lines(host, label, path, hint) {
  const key = document.createElement('div')
  key.className = 'row'
  key.textContent = label
  const area = document.createElement('textarea')
  if (path.startsWith('status.')) area.classList.add('small') // ten of these: keep them short
  area.addEventListener('input', () => set(path, area.value.split('\n').map(s => s.trim()).filter(Boolean)))
  refreshers.push(() => { area.value = get(path).join('\n') })
  const note = document.createElement('div')
  note.className = 'hint'
  note.textContent = hint
  host.append(key, area, note)
}

const pct = v => Math.round(v * 100) + '%'

// ---- The sections ----
function build() {
  // 1. Sound
  const sound = foldEntry('声音', {
    checked: () => buf.sound.on,
    onToggle: on => set('sound.on', on),
    summary: () => buf.sound.on
      ? `${buf.sound.kind === 'duang' ? 'duang duang' : '叽叽叽'} · ${pct(buf.sound.volume)}`
      : '已关闭'
  })
  const kind = select(sound, '音效', 'sound.kind', [['squeak', '叽叽叽'], ['duang', 'duang duang']])
  const listen = document.createElement('button')
  listen.className = 'btn btn-no btn-small'
  listen.textContent = '试听'
  listen.addEventListener('click', () => window.settingsApi.preview({ ...buf.sound, on: true }))
  kind.appendChild(listen)
  slider(sound, '音量', 'sound.volume', 0, 1, 0.05, pct)

  // 2. Lines
  const talk = foldEntry('台词', {
    checked: () => buf.lines.on,
    onToggle: on => set('lines.on', on),
    summary: () => buf.lines.on
      ? `${buf.lines.normal.length} 句 + 快用完时 ${buf.lines.worried.length} 句`
      : '已关闭'
  })
  lines(talk, '点气泡时说（没出表情包时）', 'lines.normal', '一行一句。')
  lines(talk, '额度超过 80% 时说', 'lines.worried', '一行一句。额度紧张时点气泡只说这里的，不出表情包。')
  slider(talk, '停留时间', 'lines.seconds', 1, 15, 1, v => v + ' 秒')

  // 3. Memes
  const memes = foldEntry('表情包', {
    checked: () => buf.memes.on,
    onToggle: on => set('memes.on', on),
    summary: () => buf.memes.on ? `点气泡 ${pct(buf.memes.chance)} 出表情包` : '已关闭'
  })
  slider(memes, '出现概率', 'memes.chance', 0, 1, 0.05, pct)
  const how = document.createElement('div')
  how.className = 'hint'
  how.textContent = '平时气泡显示额度；点一下气泡出表情包（其余概率出一句台词），再点一下或等几秒变回额度。'
  memes.appendChild(how)
  const credit = document.createElement('div')
  credit.className = 'hint'
  credit.textContent = '9 张表情包来自「克劳德大小姐 · Claude-girl」（github.com/wangxianda941030/Claude-girl），CC BY-NC 4.0，仅限非商业使用。'
  memes.appendChild(credit)

  // 4. Reacting to what Claude is doing
  const work = foldEntry('工作状态', {
    checked: () => buf.status.on,
    onToggle: on => set('status.on', on),
    summary: () => {
      if (!buf.status.on) return '已关闭'
      const parts = ['跟着 Claude 说话']
      if (buf.status.poses) parts.push('小动作')
      if (buf.status.chime) parts.push('完成叮一声')
      return parts.join(' · ')
    }
  })
  checkbox(work, '跟着状态做小动作（思考时晃、写代码时忙、完成时欢呼）', 'status.poses')
  checkbox(work, 'Claude 回复完时叮一声、撒小花', 'status.chime')
  const NAMES = {
    thinking: '思考', reading: '读文件', writing: '写文件', running: '跑命令',
    searching: '上网', delegating: '找帮手', asking: '等你确认', error: '出错',
    done: '做完', stopped: '被打断'
  }
  for (const [key, label] of Object.entries(NAMES)) {
    lines(work, label, 'status.texts.' + key, key === 'reading' || key === 'writing' || key === 'running'
      ? '一行一句，随机挑一句。{detail} 会换成文件名或命令。'
      : '一行一句，随机挑一句。')
  }

  // 5. Bubble
  const bubble = foldEntry('气泡', {
    checked: () => buf.bubble.on,
    onToggle: on => set('bubble.on', on),
    summary: () => {
      if (!buf.bubble.on) return '已隐藏'
      const parts = []
      if (buf.bubble.showFive) parts.push('5 小时')
      if (buf.bubble.showReset) parts.push('倒计时')
      if (buf.bubble.showWeek) parts.push('本周')
      return parts.join(' · ') || '只显示台词'
    }
  })
  slider(bubble, '显示几秒', 'bubble.seconds', 0, 30, 1, v => v ? v + ' 秒' : '一直显示')
  const when = document.createElement('div')
  when.className = 'hint'
  when.textContent = '平时收起；戳她、鼠标停在她身上、额度变了、Claude 有新动作时冒出来，过这么久再收起。拖到最左边就一直显示。'
  bubble.appendChild(when)
  checkbox(bubble, '拖动时收起气泡', 'bubble.hideWhileDragging')
  checkbox(bubble, '显示 5 小时额度', 'bubble.showFive')
  checkbox(bubble, '显示重置倒计时', 'bubble.showReset')
  checkbox(bubble, '显示本周额度', 'bubble.showWeek')
  const color = row(bubble, '边框颜色')
  const picker = document.createElement('input')
  picker.type = 'color'
  picker.addEventListener('input', () => set('bubble.accent', picker.value))
  refreshers.push(() => { picker.value = buf.bubble.accent })
  color.appendChild(picker)

  // 6. Character
  const chan = foldEntry('角色', {
    summary: () => `大小 ${pct(buf.character.scale)}${buf.character.withClaude ? ' · 跟着 Claude 出现' : ''}`
  })
  slider(chan, '大小', 'character.scale', 0.7, 1.3, 0.05, pct)
  checkbox(chan, '打开 Claude 时自动出现，关掉 Claude 时一起退出', 'character.withClaude')

  // Buttons: restore defaults on the left, cancel / save on the right.
  const buttons = document.createElement('div')
  buttons.className = 'buttons'
  const reset = button('恢复默认', 'btn-no', () => { buf = structuredClone(defaults); refreshAll() })
  const spacer = document.createElement('span')
  spacer.className = 'spacer'
  const cancel = button('取消', 'btn-no', () => window.settingsApi.close())
  const ok = button('保存', 'btn-ok', async () => {
    saved = await window.settingsApi.save(buf)
    window.settingsApi.close()
  })
  buttons.append(reset, spacer, cancel, ok)
  card.appendChild(buttons)
}

function button(text, kind, onClick) {
  const b = document.createElement('button')
  b.className = 'btn ' + kind
  b.textContent = text
  b.addEventListener('click', onClick)
  return b
}

function refreshAll() {
  refreshers.forEach(fn => fn())
  refreshSummaries()
}

window.settingsApi.get().then(({ settings, defaults: d }) => {
  saved = settings
  defaults = d
  buf = structuredClone(saved)
  build()
  refreshAll()
})
