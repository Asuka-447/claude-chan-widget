// Claude-chan: a transparent window that lives inside the Claude Desktop window.
// tools/follow.ps1 makes her owned by Claude's window (above Claude, behind
// other apps, minimised with it) and reports where Claude's window is.
// The usage-bubble mod inside the Claude app writes usage.json; this watches it.
// Behaviour inspired by MeteorNOX/DeepSeek-Balance-Whale-Widget (MIT), rewritten.
const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron')
const { spawn } = require('child_process')
const koffi = require('koffi')
const fs = require('fs')
const os = require('os')
const path = require('path')
const store = require('./lib/settings-store')

const USAGE_FILE = path.join(os.homedir(), '.claude', 'claude-chan', 'usage.json')
const STATUS_FILE = path.join(os.homedir(), '.claude', 'claude-chan', 'status.json')
const BASE_WIDTH = 300
const BASE_HEIGHT = 500
const SNAP = 40 // px from an edge of the Claude window at which a drop snaps to it
const HOME_BOTTOM = 110 // default gap above Claude's bottom edge, clear of the prompt box

let win
let follower
let claude = null // Claude's window in DIP: { x, y, width, height }
let offset = null // her position relative to Claude's bottom-right corner
let settings = store.load()
let settingsWin = null

// Her window size follows the 角色 → 大小 setting.
let WIDTH = Math.round(BASE_WIDTH * settings.character.scale)
let HEIGHT = Math.round(BASE_HEIGHT * settings.character.scale)

function readUsage() {
  try {
    return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'))
  } catch {
    return null
  }
}

function sendUsage() {
  if (win && !win.isDestroyed()) win.webContents.send('usage', readUsage())
}

// What Claude is doing, written by the usage-bubble mod on every tool call.
function sendStatus() {
  try {
    const status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'))
    if (win && !win.isDestroyed()) win.webContents.send('status', status)
  } catch {
    // Missing or half-written; the next change will do.
  }
}

// Keep her whole body inside Claude's window.
function clamp(x, y) {
  if (!claude) return [x, y]
  const maxX = claude.x + claude.width - WIDTH
  const maxY = claude.y + claude.height - HEIGHT
  return [
    Math.round(Math.min(Math.max(x, claude.x), Math.max(claude.x, maxX))),
    Math.round(Math.min(Math.max(y, claude.y), Math.max(claude.y, maxY)))
  ]
}

// Move with setBounds, never setPosition: on a scaled display Windows rounds a
// transparent window's size on every move, so repeated moves make it grow.
function moveTo(x, y) {
  win.setBounds({ x, y, width: WIDTH, height: HEIGHT })
}

// Push settings to her page and apply the ones the main process owns.
function applySettings() {
  const width = Math.round(BASE_WIDTH * settings.character.scale)
  const height = Math.round(BASE_HEIGHT * settings.character.scale)
  if (width !== WIDTH || height !== HEIGHT) {
    // Keep her feet where they were: grow up and to the left.
    const [x, y] = win.getPosition()
    const right = x + WIDTH
    const bottom = y + HEIGHT
    WIDTH = width
    HEIGHT = height
    win.setMinimumSize(WIDTH, HEIGHT)
    win.setMaximumSize(WIDTH, HEIGHT)
    place(right - WIDTH, bottom - HEIGHT)
  }
  if (app.getLoginItemSettings().openAtLogin !== settings.character.openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: settings.character.openAtLogin })
  }
  win.webContents.send('settings', settings)
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus()
    return
  }
  settingsWin = new BrowserWindow({
    width: 470,
    height: 640,
    title: 'Claude 娘设置',
    autoHideMenuBar: true,
    backgroundColor: '#fffaf4',
    webPreferences: { preload: path.join(__dirname, 'settings-preload.js') }
  })
  settingsWin.setMenu(null)
  settingsWin.loadFile('settings.html')
  if (process.env.CHAN_SHOT) {
    // Development aid: save a picture of the panel, with every section opened.
    settingsWin.webContents.on('did-finish-load', () => setTimeout(async () => {
      await settingsWin.webContents.executeJavaScript(
        "document.querySelectorAll('.entry').forEach(e => e.click())")
      setTimeout(async () => {
        const image = await settingsWin.webContents.capturePage()
        fs.writeFileSync(process.env.CHAN_SHOT, image.toPNG())
      }, 600)
    }, 500))
  }
  settingsWin.on('closed', () => { settingsWin = null })
}

ipcMain.handle('settings:get', () => ({ settings, defaults: store.DEFAULTS }))
ipcMain.handle('settings:save', (_e, next) => {
  settings = store.save(next)
  applySettings()
  return settings
})
ipcMain.on('settings:preview', (_e, sound) => win.webContents.send('preview', sound))
ipcMain.on('settings:close', () => settingsWin && settingsWin.close())

function place(x, y) {
  const [cx, cy] = clamp(x, y)
  moveTo(cx, cy)
  if (claude) {
    offset = { dx: claude.x + claude.width - cx, dy: claude.y + claude.height - cy }
  }
  sendSide()
}

function goHome() {
  if (!claude) return
  place(claude.x + claude.width - WIDTH, claude.y + claude.height - HEIGHT - HOME_BOTTOM)
}

// Tell the page which half of Claude's window she is in, so she can face the middle.
function sendSide() {
  if (!claude) return
  const [x] = win.getPosition()
  win.webContents.send('side', x + WIDTH / 2 < claude.x + claude.width / 2 ? 'left' : 'right')
}

// Owned by Claude's window: above Claude, behind any other app, minimised with it.
const user32 = koffi.load('user32.dll')
const SetWindowLongPtrW = user32.func('intptr_t __stdcall SetWindowLongPtrW(intptr_t hwnd, int index, intptr_t value)')
const GetWindowLongPtrW = user32.func('intptr_t __stdcall GetWindowLongPtrW(intptr_t hwnd, int index)')
const GWLP_HWNDPARENT = -8

function ownBy(claudeHwnd) {
  const mine = win.getNativeWindowHandle().readBigInt64LE(0)
  if (BigInt(GetWindowLongPtrW(mine, GWLP_HWNDPARENT)) !== BigInt(claudeHwnd)) {
    SetWindowLongPtrW(mine, GWLP_HWNDPARENT, BigInt(claudeHwnd))
    if (process.env.CHAN_DEBUG) {
      console.error('owner now', String(GetWindowLongPtrW(mine, GWLP_HWNDPARENT)), 'want', claudeHwnd)
    }
  }
}

// Claude's window moved, resized, minimised or closed.
function onClaude(info) {
  if (process.env.CHAN_DEBUG) console.error('claude window:', JSON.stringify(info))
  if (!info.found || info.minimized) {
    win.hide()
    return
  }
  ownBy(info.hwnd)
  claude = screen.screenToDipRect(null, {
    x: info.x, y: info.y, width: info.width, height: info.height
  })
  if (!offset) {
    goHome()
  } else {
    // Stay at the same spot relative to Claude's bottom-right corner.
    const [x, y] = clamp(claude.x + claude.width - offset.dx, claude.y + claude.height - offset.dy)
    moveTo(x, y)
    sendSide()
  }
  if (!win.isVisible()) win.showInactive()
  if (process.env.CHAN_DEBUG) {
    console.error('claude dip:', JSON.stringify(claude), 'chan:', JSON.stringify(win.getBounds()),
      'displays:', JSON.stringify(screen.getAllDisplays().map(d => ({ b: d.bounds, s: d.scaleFactor }))))
  }
}

function startFollowing() {
  const hwnd = win.getNativeWindowHandle().readBigUInt64LE(0).toString()
  follower = spawn('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass',
    '-File', path.join(__dirname, 'tools', 'follow.ps1'), '-ChanHwnd', hwnd
  ], { windowsHide: true })
  follower.stderr.on('data', chunk => console.error('follow:', chunk.toString()))
  follower.on('exit', code => console.error('follow exited', code))

  let buffer = ''
  follower.stdout.on('data', chunk => {
    if (process.env.CHAN_DEBUG) fs.appendFileSync(path.join(os.tmpdir(), 'chan-debug.log'), chunk)
    buffer += chunk.toString()
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop()
    for (const line of lines) {
      // PowerShell may prefix the first line with a byte-order mark.
      const start = line.indexOf('{')
      if (start < 0) continue
      try {
        onClaude(JSON.parse(line.slice(start)))
      } catch (err) {
        console.error('follow:', err.message, line)
      }
    }
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false, // shown once Claude's window is found
    frame: false,
    transparent: true,
    resizable: false,
    minWidth: WIDTH,
    maxWidth: WIDTH,
    minHeight: HEIGHT,
    maxHeight: HEIGHT,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  })
  win.loadFile('index.html')
  // Start see-through; the page turns the mouse back on over her body.
  win.setIgnoreMouseEvents(true, { forward: true })
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('settings', settings)
    sendUsage()
    sendSide()
  })

  // fs.watch misses files that are replaced, so poll instead.
  fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true })
  fs.watchFile(USAGE_FILE, { interval: 2000 }, sendUsage)
  // Status changes many times a turn, so look at it often.
  fs.watchFile(STATUS_FILE, { interval: 300 }, sendStatus)

  startFollowing()
  if (process.env.CHAN_OPEN_SETTINGS) openSettings()
  if (process.env.CHAN_SHOT_STATUS) {
    // Development aid: pretend Claude is writing a file, then finishes; save both.
    win.webContents.on('did-finish-load', () => setTimeout(async () => {
      const base = process.env.CHAN_SHOT_STATUS
      win.webContents.send('status', { activity: 'writing', detail: 'index.js', at: Date.now() })
      await new Promise(r => setTimeout(r, 600))
      fs.writeFileSync(base + '-writing.png', (await win.webContents.capturePage()).toPNG())
      win.webContents.send('status', { activity: 'done', detail: '', at: Date.now() })
      await new Promise(r => setTimeout(r, 450))
      fs.writeFileSync(base + '-done.png', (await win.webContents.capturePage()).toPNG())
    }, 2500))
  }
  if (process.env.CHAN_SHOT_WIDGET) {
    // Development aid: save pictures of her with the usage bubble and with a meme.
    win.webContents.on('did-finish-load', () => setTimeout(async () => {
      const base = process.env.CHAN_SHOT_WIDGET
      fs.writeFileSync(base + '-usage.png', (await win.webContents.capturePage()).toPNG())
      await win.webContents.executeJavaScript('settings.memes.chance = 1; poke()')
      setTimeout(async () => {
        fs.writeFileSync(base + '-meme.png', (await win.webContents.capturePage()).toPNG())
      }, 500)
    }, 2500))
  }
}

// Click-through: the page says whether the mouse is over her or the bubble.
ipcMain.on('solid', (_e, hit) => win.setIgnoreMouseEvents(!hit, { forward: true }))

// Dragging: the page reports how far the pointer moved.
ipcMain.on('drag', (_e, { dx, dy }) => {
  const [x, y] = win.getPosition()
  place(x + dx, y + dy)
})

// On release, snap to any edge of Claude's window that is close enough.
ipcMain.on('drop', () => {
  if (!claude) return
  let [x, y] = win.getPosition()
  if (x - claude.x < SNAP) x = claude.x
  if (claude.x + claude.width - (x + WIDTH) < SNAP) x = claude.x + claude.width - WIDTH
  if (y - claude.y < SNAP) y = claude.y
  if (claude.y + claude.height - (y + HEIGHT) < SNAP) y = claude.y + claude.height - HEIGHT
  place(x, y)
})

ipcMain.on('menu', () => {
  Menu.buildFromTemplate([
    { label: '设置…', click: openSettings },
    { label: '回到右下角', click: goHome },
    { type: 'separator' },
    { label: '再见啦（退出）', click: () => app.quit() }
  ]).popup({ window: win })
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => follower && follower.kill())
