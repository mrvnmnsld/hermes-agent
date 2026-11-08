import { capitalize } from '@/lib/text'
import type { SubagentProgress } from '@/store/subagents'

const NAME_MAX = 40

const clip = (text: string) => (text.length > NAME_MAX ? `${text.slice(0, NAME_MAX - 1).trimEnd()}…` : text)

/** Row text `Ops - provider/model: short task name`. Without a worker only the task name shows; a missing
 *  provider or model is dropped. The name falls back to the first four words of the goal. */
export function subagentRowLabel(item: Pick<SubagentProgress, 'goal' | 'model' | 'name' | 'provider' | 'worker'>): string {
  const task = clip(item.name?.trim() || item.goal.trim().split(/\s+/).slice(0, 4).join(' '))
  const worker = item.worker?.trim()

  if (!worker) {
    return task
  }

  const engine = [item.provider?.trim(), item.model?.trim()].filter(Boolean).join('/')

  return `${capitalize(worker)}${engine ? ` - ${engine}` : ''}: ${task}`
}
