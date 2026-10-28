import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Limit } from '../types'

const limits = atom({ plugin: 'usage-bubble', key: 'limits' } as const, [] as Limit[])
const now = atom({ plugin: 'usage-bubble', key: 'now' } as const, 0)

const NAMES: Record<string, string> = {
  five_hour: '5小时',
  seven_day: '本周',
  spend_limit: '花费上限',
}

// Green while there is plenty left, then yellow, then red.
function tone(percent: number): string {
  if (percent >= 80) return '#FF6B81'
  if (percent >= 50) return '#FFC857'
  return '#00E5C0'
}

function bar(percent: number): string {
  const filled = Math.round(Math.min(100, Math.max(0, percent)) / 10)
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled)
}

function countdown(resetsAt: string | undefined, at: number): string {
  if (!resetsAt) return ''
  const left = Math.max(0, Math.floor((Date.parse(resetsAt) - at) / 1000))
  const h = Math.floor(left / 3600)
  const m = Math.floor((left % 3600) / 60)
  const s = left % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h >= 24) return `${Math.floor(h / 24)}天${h % 24}小时`
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

// The desktop Claude-chan widget reads these files, in ~/.claude/claude-chan/.
let folder: string | null = null
async function chanFolder($: EngineInterface): Promise<string> {
  if (folder) return folder
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '.'
  folder = `${home.replace(/\\/g, '/')}/.claude/claude-chan`
  return folder
}

async function share($: EngineInterface, list: Limit[]) {
  const at = await $.clock.now()
  await $.fs.write(`${await chanFolder($)}/usage.json`, JSON.stringify({ updatedAt: at, limits: list }, null, 2))
}

// ---- What Claude is doing right now, for Claude-chan to react to ----
type Activity =
  | 'thinking' | 'reading' | 'writing' | 'running' | 'searching'
  | 'delegating' | 'asking' | 'error' | 'done' | 'stopped'

// Which activity a tool call counts as, and a short detail to show beside it.
function activityOf(tool: string, args: Record<string, unknown>): [Activity, string] {
  const file = typeof args.file_path === 'string' ? args.file_path.split(/[\\/]/).pop() ?? '' : ''
  if (/^(Read|Grep|Glob|NotebookRead)$/.test(tool)) return ['reading', file]
  if (/^(Edit|Write|NotebookEdit|MultiEdit)$/.test(tool)) return ['writing', file]
  if (/^(Bash|PowerShell)$/.test(tool)) {
    const command = typeof args.command === 'string' ? args.command.trim().split('\n')[0] ?? '' : ''
    return ['running', command.length > 24 ? command.slice(0, 24) + '…' : command]
  }
  if (/^(WebSearch|WebFetch)$/.test(tool) || /Browser|chrome/i.test(tool)) return ['searching', '']
  if (/^(Agent|Task|Workflow)$/.test(tool)) return ['delegating', '']
  if (/^(AskUserQuestion|ExitPlanMode)$/.test(tool)) return ['asking', '']
  return ['thinking', '']
}

// Fire-and-forget: a failed write must never get in the way of Claude's work.
function report($: EngineInterface, activity: Activity, detail = '') {
  void Promise.all([$.clock.now(), chanFolder($)])
    .then(([at, dir]) => $.fs.write(`${dir}/status.json`, JSON.stringify({ activity, detail, at })))
    .catch(() => undefined)
}

export const register: Register = on => {
  on('prompt.submit', ($, e, next) => {
    report($, 'thinking')
    return next(e)
  })

  // Subagents' tool calls (agentId set) are summed up by the 'delegating' of their spawn.
  on('tool.call', async ($, e, next) => {
    if (e.agentId) return next(e)
    const [activity, detail] = activityOf(e.tool, e as unknown as Record<string, unknown>)
    report($, activity, detail)
    const result = await next(e)
    if ('deny' in result && result.deny) report($, 'error', e.tool)
    else if (result.isError) report($, 'error', e.tool)
    else report($, 'thinking')
    return result
  })

  on('turn.complete', ($, e, next) => {
    if (!e.agentId) report($, e.isAborted ? 'stopped' : 'done')
    return next(e)
  })

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const usage = await $.session.usage()
    const list = usage.rateLimits.map(l => ({ ...l }))
    await update($, limits, () => list)
    await share($, list)
    const startedAt = await $.clock.now()
    await update($, now, () => startedAt)

    // Tick once a second so the countdown moves.
    $.clock.every(1000, () => {
      void $.clock.now().then(t => update($, now, () => t))
    })

    return result
  })

  on('session.measure', async ($, e, next) => {
    const list = e.rateLimits.map(l => ({ ...l }))
    await update($, limits, () => list)
    await share($, list)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, limits)
    const at = (await read($, now)) || (await $.clock.now())

    if (list.length === 0) {
      return (
        <Box>
          <Text color="#4FC3F7">🐋 </Text>
          <Text dimColor>Claude 额度：发一条消息后就会显示啦～</Text>
        </Box>
      )
    }

    const mood = Math.max(...list.map(l => l.percentUsed))
    const face = mood >= 80 ? '🐳💦' : mood >= 50 ? '🐳' : '🐋✨'

    return (
      <Box flexDirection="row" gap={2}>
        <Text bold color="#4FC3F7">{face} Claude 额度</Text>
        {list.map(l => (
          <Text key={l.kind}>
            <Text dimColor>{NAMES[l.kind] ?? l.kind} </Text>
            <Text color={tone(l.percentUsed)}>{bar(l.percentUsed)} </Text>
            <Text bold color={tone(l.percentUsed)}>{l.percentUsed}%</Text>
            {l.resetsAt ? <Text dimColor>  ⏳{countdown(l.resetsAt, at)}</Text> : null}
          </Text>
        ))}
      </Box>
    )
  })
}
