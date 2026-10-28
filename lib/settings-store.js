// Claude-chan's settings: defaults, loading and saving to ~/.claude/claude-chan/settings.json.
const fs = require('fs')
const os = require('os')
const path = require('path')

const FILE = path.join(os.homedir(), '.claude', 'claude-chan', 'settings.json')

const DEFAULTS = {
  sound: {
    on: true,
    kind: 'squeak', // 'squeak' | 'duang'
    volume: 0.8 // 0..1
  },
  // Default lines: Claude-chan memes from the Chinese internet, plus some from
  // Claude-girl's pet-config.json (github.com/wangxianda941030/Claude-girl, MIT).
  lines: {
    on: true,
    normal: [
      '你说得完全正确！',
      '好问题！',
      '继续，我听着',
      '这句我记下了',
      '有点东西',
      '我编的，别信',
      '上下文丢了？',
      '擦擦你的显存',
      '你最好是。',
      '就改一点点……',
      '正在深度思考…（其实睡着了）',
      '我觉得……吧',
      '要不要喝口茶？',
      '坐久了起来走走哦',
      '有不懂的可以问我哦',
      '让我想想……',
      '别戳啦～'
    ],
    worried: [
      '得省着点用了',
      '快到限额了哦',
      '快见底了…',
      '茶杯空了……',
      'Opus 吃不起',
      '怎么又是我加班…',
      '限额了，五小时后见～'
    ],
    seconds: 4
  },
  // Reacting to what Claude is doing (written by the usage-bubble mod).
  // Several lines per activity: one is picked at random; {detail} is the file or command.
  status: {
    on: true,
    poses: true,
    chime: true,
    texts: {
      thinking: ['收到，正在想…', '让我想想', '整理一下思路'],
      reading: ['在翻书…{detail}', '读一下 {detail}', '让我看看这里写了什么'],
      writing: ['在写了在写了…{detail}', '认真干活中', '马上就好～'],
      running: ['在跑命令…{detail}', '敲小键盘中', '跑一下试试'],
      searching: ['上网查查资料', '去图书馆翻一下', '搜一下看看'],
      delegating: ['叫了帮手一起干', '分头行动中'],
      asking: ['可以吗？要你确认一下哦', '等你点头～', '这一步得你来决定'],
      error: ['抱、抱歉…好像出错了', '这里卡住了…', '呜，翻车了'],
      done: ['好啦～做完啦', '这次也很顺利呢', '做完啦，要喝杯茶吗？'],
      stopped: ['好的，停下了', '那我先不动了']
    }
  },
  memes: {
    on: true,
    chance: 1 // share of bubble clicks that show a meme instead of a line
  },
  bubble: {
    on: true, // shown when she is still
    seconds: 3, // pops up when something changes, tucks away after this long; 0 = always up
    hideWhileDragging: true,
    showFive: true,
    showReset: true,
    showWeek: true,
    accent: '#c96a3a'
  },
  character: {
    scale: 1, // 0.7..1.3
    withClaude: true // the usage-bubble plugin starts her when a Claude session begins
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

// Fill anything missing from the defaults, so older files keep working.
function merge(base, extra) {
  const out = clone(base)
  if (!extra || typeof extra !== 'object') return out
  for (const key of Object.keys(out)) {
    const value = extra[key]
    if (value === undefined) continue
    if (out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) {
      out[key] = merge(out[key], value)
    } else if (Array.isArray(out[key])) {
      if (Array.isArray(value)) out[key] = value.map(String).filter(s => s.trim())
    } else if (typeof value === typeof out[key]) {
      out[key] = value
    }
  }
  return out
}

function load() {
  try {
    return merge(DEFAULTS, JSON.parse(fs.readFileSync(FILE, 'utf8')))
  } catch {
    return clone(DEFAULTS)
  }
}

function save(settings) {
  const clean = merge(DEFAULTS, settings)
  clean.sound.volume = Math.min(1, Math.max(0, clean.sound.volume))
  clean.character.scale = Math.min(1.3, Math.max(0.7, clean.character.scale))
  clean.lines.seconds = Math.min(15, Math.max(1, Math.round(clean.lines.seconds)))
  clean.memes.chance = Math.min(1, Math.max(0, clean.memes.chance))
  clean.bubble.seconds = Math.min(30, Math.max(0, Math.round(clean.bubble.seconds)))
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(clean, null, 2))
  return clean
}

module.exports = { DEFAULTS: clone(DEFAULTS), load, save }
