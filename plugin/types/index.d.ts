// One rate-limit window as written to usage.json for the Claude-chan widget.
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
