// Claude-chan's page: draws the bubble, rolls the numbers, handles drag and pokes.
const el = id => document.getElementById(id)
const stage = el('stage')
const chan = el('chan')
const bubble = el('bubble')

let usage = null
let shownFive = 0

// ---- Settings, sent by main.js on load and after every 保存 ----
let settings = null

// The meme pictures in assets/memes (from Claude-girl, CC BY-NC 4.0).
const MEMES = [
  '你说得完全正确', '继续我听着', '你最好是', '就改一点点', '别蒸了',
  '深度思考其实睡着了', '怎么又是我加班', '中转站跑路了', 'Opus吃不起'
]

window.chanApi.onSettings(next => {
  settings = next
  document.documentElement.style.setProperty('--edge', settings.bubble.accent)
  document.body.style.zoom = String(settings.character.scale)
  bubble.classList.toggle('hidden', !settings.bubble.on)
  draw()
})

// ---- Number rolling: ease from the shown value to the new one ----
function rollTo(target) {
  const from = shownFive
  const start = performance.now()
  const step = t => {
    const k = Math.min(1, (t - start) / 600)
    const eased = 1 - Math.pow(1 - k, 3)
    shownFive = from + (target - from) * eased
    el('five').textContent = Number.isInteger(target) ? Math.round(shownFive) : shownFive.toFixed(1)
    if (k < 1) requestAnimationFrame(step)
    else shownFive = target
  }
  requestAnimationFrame(step)
}

function countdown(resetsAt) {
  if (!resetsAt) return ''
  const left = Math.max(0, Math.floor((Date.parse(resetsAt) - Date.now()) / 1000))
  const h = Math.floor(left / 3600)
  const m = Math.floor((left % 3600) / 60)
  const s = left % 60
  const pad = n => String(n).padStart(2, '0')
  if (h >= 24) return `${Math.floor(h / 24)}天${h % 24}小时`
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function find(kind) {
  return usage && usage.limits ? usage.limits.find(l => l.kind === kind) : undefined
}

function draw() {
  const five = find('five_hour')
  const week = find('seven_day')

  if (!five && !week) {
    el('five').textContent = '--'
    el('reset').textContent = ''
    el('week').textContent = ''
    if (!el('line').dataset.poked) el('line').textContent = '在 Claude 里发条消息，我就知道啦～'
    return
  }

  const top = Math.max(five ? five.percentUsed : 0, week ? week.percentUsed : 0)
  stage.classList.toggle('warn', top >= 50 && top < 80)
  stage.classList.toggle('hot', top >= 80)

  const show = settings ? settings.bubble : { showFive: true, showReset: true, showWeek: true }
  el('five-box').style.display = show.showFive ? '' : 'none'
  el('reset').textContent = show.showReset && five && five.resetsAt ? `⏳ ${countdown(five.resetsAt)} 后重置` : ''
  el('week').textContent = show.showWeek && week
    ? `本周已用 ${week.percentUsed}%${week.resetsAt ? ` · ${countdown(week.resetsAt)} 后重置` : ''}`
    : ''
}

window.chanApi.onUsage(data => {
  usage = data
  const five = find('five_hour')
  if (five) rollTo(five.percentUsed)
  if (!el('line').dataset.poked) el('line').textContent = ''
  draw()
})

window.chanApi.onSide(side => chan.classList.toggle('flip', side === 'left'))

// ---- Reacting to what Claude is doing ----
// The usage-bubble mod writes { activity, detail, at } on every prompt, tool call
// and turn end. She shows a line for it at the top of the bubble and a small pose.
const ACTIVITIES = ['thinking', 'reading', 'writing', 'running', 'searching',
  'delegating', 'asking', 'error', 'done', 'stopped']
const ENDINGS = ['error', 'done', 'stopped']
let current = { activity: null, since: 0 }
let calmTimer = 0

function setActivity(activity) {
  ACTIVITIES.forEach(a => stage.classList.remove('act-' + a))
  if (activity) stage.classList.add('act-' + activity)
}

window.chanApi.onStatus(status => {
  if (!settings || !settings.status.on || !ACTIVITIES.includes(status.activity)) return
  // Ignore leftovers from long ago (say, the app was closed mid-turn).
  if (Date.now() - status.at > 5 * 60 * 1000) return
  const now = Date.now()
  const same = status.activity === current.activity && now - current.since < 3000

  setActivity(settings.status.poses ? status.activity : null)
  if (!same) {
    const texts = settings.status.texts[status.activity] || []
    const text = texts.length ? pick(texts) : ''
    el('status').textContent = text.replace('{detail}', status.detail || '').trim()
    current = { activity: status.activity, since: now }
  }

  clearTimeout(calmTimer)
  if (status.activity === 'done') {
    sparkle()
    chime()
  }
  // After a turn ends she calms down; while working, a long silence also clears it.
  calmTimer = setTimeout(() => {
    setActivity(null)
    el('status').textContent = ''
    current = { activity: null, since: 0 }
  }, ENDINGS.includes(status.activity) ? 8000 : 90000)
})

function sparkle() {
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('span')
    s.className = 'spark'
    s.textContent = pick(['✨', '🌸', '💛', '⭐'])
    s.style.right = 40 + Math.random() * 130 + 'px'
    s.style.bottom = 150 + Math.random() * 60 + 'px'
    s.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px')
    s.style.animationDelay = i * 70 + 'ms'
    stage.appendChild(s)
    setTimeout(() => s.remove(), 1400)
  }
}

setInterval(draw, 1000)

// ---- Squeaks, synthesised so no sound files are needed ----
let audio = null
// Which sound plays comes from 设置 → 声音; 试听 there plays one with its unsaved values.
function soundCfg() {
  return settings ? settings.sound : { on: true, kind: 'squeak', volume: 0.8 }
}
let previewCfg = null
window.chanApi.onPreview(cfg => {
  previewCfg = cfg
  if (cfg.kind === 'duang') duang(170)
  else {
    squeak(1100, 0.09)
    setTimeout(() => squeak(1450, 0.07), 140)
    setTimeout(() => squeak(1300, 0.06), 225)
  }
  setTimeout(() => { previewCfg = null }, 700)
})
function playing(kind) {
  const cfg = previewCfg || soundCfg()
  return cfg.on && cfg.kind === kind ? cfg.volume : 0
}

// One "叽": a quick upward chirp with a tiny wobble, pitch varied a little each time.
function squeak(base, length) {
  const volume = playing('squeak')
  if (!volume) return
  audio = audio || new AudioContext()
  const t = audio.currentTime
  const pitch = base * (0.92 + Math.random() * 0.16)

  const osc = audio.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(pitch, t)
  osc.frequency.exponentialRampToValueAtTime(pitch * 1.9, t + length * 0.55)
  osc.frequency.exponentialRampToValueAtTime(pitch * 1.4, t + length)

  const wobble = audio.createOscillator()
  const depth = audio.createGain()
  wobble.frequency.value = 38
  depth.gain.value = pitch * 0.06
  wobble.connect(depth).connect(osc.frequency)

  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.35 * volume, t + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length)

  osc.connect(gain).connect(audio.destination)
  osc.start(t)
  wobble.start(t)
  osc.stop(t + length + 0.02)
  wobble.stop(t + length + 0.02)
}

// One "duang": a low, springy boing. The pitch swings up and down like a spring
// and the swing dies away, which is what makes it sound bouncy.
function duang(base) {
  const volume = playing('duang')
  if (!volume) return
  audio = audio || new AudioContext()
  const t = audio.currentTime
  const length = 0.55
  const pitch = base * (0.94 + Math.random() * 0.12)

  const osc = audio.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(pitch * 1.6, t)
  osc.frequency.exponentialRampToValueAtTime(pitch, t + 0.08)

  // The spring: a 13 Hz wobble on the pitch whose depth fades to nothing.
  const spring = audio.createOscillator()
  const swing = audio.createGain()
  spring.frequency.value = 13
  swing.gain.setValueAtTime(pitch * 0.45, t)
  swing.gain.exponentialRampToValueAtTime(1, t + length)
  spring.connect(swing).connect(osc.frequency)

  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.52 * volume, t + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length)

  osc.connect(gain).connect(audio.destination)
  osc.start(t)
  spring.start(t)
  osc.stop(t + length + 0.02)
  spring.stop(t + length + 0.02)
}

// A soft two-note bell when a reply finishes (follows the 声音 volume and switch).
function chime() {
  if (!settings || !settings.status.chime || !settings.sound.on) return
  audio = audio || new AudioContext()
  const t = audio.currentTime
  ;[[880, 0], [1318.5, 0.12]].forEach(([freq, delay]) => {
    const osc = audio.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const gain = audio.createGain()
    gain.gain.setValueAtTime(0.0001, t + delay)
    gain.gain.exponentialRampToValueAtTime(0.22 * settings.sound.volume, t + delay + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.6)
    osc.connect(gain).connect(audio.destination)
    osc.start(t + delay)
    osc.stop(t + delay + 0.65)
  })
}

// ---- Drag vs. poke: a press that barely moves is a poke ----
let down = null
let moved = 0
let settle = 0

chan.addEventListener('pointerdown', e => {
  if (e.button !== 0) return
  down = { x: e.screenX, y: e.screenY }
  moved = 0
  chan.setPointerCapture(e.pointerId)
  chan.classList.remove('bounce')
  chan.classList.add('press')
  squeak(1100, 0.09) // press: a short, high 叽
})

chan.addEventListener('pointermove', e => {
  if (!down) return
  const dx = e.screenX - down.x
  const dy = e.screenY - down.y
  moved += Math.abs(dx) + Math.abs(dy)
  if (moved > 4) {
    chan.classList.remove('press')
    clearTimeout(settle)
    if (!settings || settings.bubble.hideWhileDragging) stage.classList.add('dragging')
    window.chanApi.drag(dx, dy)
  }
  down = { x: e.screenX, y: e.screenY }
})

chan.addEventListener('pointerup', () => {
  if (!down) return
  down = null
  chan.classList.remove('press')
  if (moved > 4) {
    window.chanApi.drop()
    // Let her land before the bubble comes back.
    settle = setTimeout(() => stage.classList.remove('dragging'), 450)
    return
  }
  // A poke on her: squash-and-bounce and a sound; the bubble keeps showing usage.
  void chan.offsetWidth
  chan.classList.add('bounce')
  squeak(1450, 0.07) // release: a quick second 叽
  setTimeout(() => squeak(1300, 0.06), 85)
  duang(170)
})

const pick = list => list[Math.floor(Math.random() * list.length)]

// Clicking the bubble shows a meme (or, now and then, a line); clicking again,
// or waiting, brings the usage back.
bubble.addEventListener('click', () => {
  if (el('line').dataset.poked) backToUsage()
  else poke()
})

function backToUsage() {
  clearTimeout(poke.timer)
  el('line').textContent = ''
  el('meme').removeAttribute('src')
  bubble.classList.remove('meme-mode')
  delete el('line').dataset.poked
  draw()
}

// Tight usage picks a worried line rather than a meme.
function poke() {
  if (!settings) return
  const line = el('line')
  const meme = el('meme')
  const five = find('five_hour')
  const worried = five && five.percentUsed >= 80
  const useMeme = settings.memes.on && !worried && Math.random() < settings.memes.chance
  const pool = worried ? settings.lines.worried : settings.lines.normal

  line.textContent = ''
  meme.removeAttribute('src')
  bubble.classList.remove('meme-mode')
  if (useMeme) {
    meme.src = `assets/memes/${pick(MEMES)}.png`
    bubble.classList.add('meme-mode')
  } else if (settings.lines.on && pool.length) {
    line.textContent = pick(pool)
  } else {
    return
  }
  line.dataset.poked = '1'
  clearTimeout(poke.timer)
  poke.timer = setTimeout(backToUsage, settings.lines.seconds * 1000)
}

// ---- Click-through: only her body and the bubble catch the mouse ----
// The window is ignored by the mouse everywhere else, so the empty space around
// her never blocks Claude's buttons. Moves are still forwarded to this page.
let solid = false
window.addEventListener('mousemove', e => {
  if (down) return
  const target = document.elementFromPoint(e.clientX, e.clientY)
  const hit = !!target && (target === chan || bubble.contains(target)) && !isClear(e)
  if (hit !== solid) {
    solid = hit
    window.chanApi.solid(hit)
  }
})

// Her picture's own transparent pixels count as empty space too.
const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
function isClear(e) {
  if (document.elementFromPoint(e.clientX, e.clientY) !== chan || !chan.complete) return false
  const box = chan.getBoundingClientRect()
  let u = (e.clientX - box.left) / box.width
  if (chan.classList.contains('flip')) u = 1 - u
  const v = (e.clientY - box.top) / box.height
  probe.canvas.width = 1
  probe.canvas.height = 1
  probe.clearRect(0, 0, 1, 1)
  probe.drawImage(chan, u * chan.naturalWidth, v * chan.naturalHeight, 1, 1, 0, 0, 1, 1)
  try {
    return probe.getImageData(0, 0, 1, 1).data[3] < 30
  } catch {
    return false // a tainted canvas: fall back to her whole picture box
  }
}

// Leaving the window always lets the mouse through again.
document.addEventListener('mouseleave', () => {
  if (down || !solid) return
  solid = false
  window.chanApi.solid(false)
})

// Double-click hides or shows the bubble; right-click opens the menu.
chan.addEventListener('dblclick', () => bubble.classList.toggle('hidden'))
window.addEventListener('contextmenu', e => {
  e.preventDefault()
  window.chanApi.menu()
})
