// Development aid: films the scenes of the intro video. main.js loads this only
// when CHAN_FILM is set to an output folder. Each frame is saved as
// <scene>-<ms since scene start>.png, so tools/make-video.py can retime them.
const fs = require('fs')
const path = require('path')

const wait = ms => new Promise(r => setTimeout(r, ms))

module.exports = async function film(win, settingsWin, out) {
  fs.mkdirSync(out, { recursive: true })
  const js = code => win.webContents.executeJavaScript(code)

  // Capture `wc` as fast as it allows for `ms`, while `act` runs alongside.
  async function scene(name, ms, act, wc = win.webContents) {
    const start = Date.now()
    const acting = act ? act() : Promise.resolve()
    while (Date.now() - start < ms) {
      const image = await wc.capturePage()
      fs.writeFileSync(path.join(out, `${name}-${String(Date.now() - start).padStart(5, '0')}.png`), image.toPNG())
    }
    await acting
  }

  // Quiet start: no leftover status, bubble up, worried lines off the table.
  await js("setActivity(null); el('status').textContent = ''; backToUsage(); settings.bubble.seconds = 0; shown.idle = false; shown.hand = true; refreshPop()")
  await wait(800)

  // 1. The bubble pops in, small puff first.
  await scene('pop', 1600, async () => {
    await wait(250)
    await js('shown.hand = false; refreshPop()')
  })

  // 2. Jelly: she is flung left and right, the bubble lags and wobbles.
  await scene('jelly', 3200, async () => {
    for (const dx of [90, -120, 70]) {
      await wait(250)
      await js(`kick(${dx}, ${Math.round(dx / -6)})`)
      await wait(700)
    }
  })

  // 3. Working with Claude: each status in turn, then done with sparkles.
  const statuses = [
    ['thinking', ''], ['reading', 'main.js'], ['writing', 'widget.css'], ['running', 'npm start'], ['done', '']
  ]
  await scene('work', 7600, async () => {
    for (const [activity, detail] of statuses) {
      win.webContents.send('status', { activity, detail, at: Date.now() })
      await wait(1400)
    }
  })

  // 4. A click on the bubble shows a meme.
  await js("setActivity(null); el('status').textContent = ''")
  await scene('meme', 2600, async () => {
    await wait(300)
    await js("settings.memes.chance = 1; MEMES.splice(0, MEMES.length, '你说得完全正确'); poke()")
  })
  await js('backToUsage()')

  // 5. The settings panel, every section opened.
  if (settingsWin) {
    await settingsWin.webContents.executeJavaScript("document.querySelectorAll('.entry').forEach((e, i) => i < 3 && e.click())")
    await wait(600)
    await scene('settings', 300, null, settingsWin.webContents)
  }
  fs.writeFileSync(path.join(out, 'done.txt'), 'ok')
}
