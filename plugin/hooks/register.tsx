import type { EngineInterface, Register } from 'claude-code'

import type { Limit } from '../types'

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
    await share($, usage.rateLimits.map(l => ({ ...l })))
    return result
  })

  on('session.measure', async ($, e, next) => {
    await share($, e.rateLimits.map(l => ({ ...l })))
    return next(e)
  })
}
