/**
 * Keep DSH-injected user-role context ahead of the current human message.
 *
 * `dsh-agent-loop` deep-freezes the final LLM request, so `llm/stream` cannot
 * rewrite it. The public `agent/pre-step` waterfall is the logged boundary at
 * which runtime snapshots, workspace instructions, and skill context enter a
 * step. This plugin awaits every normal injector and then orders non-human
 * context before messages whose producer is the human user.
 * @module dsh-context-before-user
 */

import type { Context } from '@deepseek-ai/cordis'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import type { UserMessage } from '@deepseek-ai/dsh-session'

export const name = 'context-before-user'
export const inject = ['agents']

/** Return whether a message was produced by the real user-facing input path. */
function isHumanMessage(message: UserMessage): boolean {
  return message.source.kind === 'user'
}

/**
 * Stable-partition an entering step so injected context precedes human input.
 * @param decision - authoritative result from downstream pre-step listeners.
 * @returns the original decision or an enter decision with reordered messages.
 */
export function orderContextBeforeUser(decision: PreStepDecision): PreStepDecision {
  if (decision.kind === 'reject') return decision

  const context: UserMessage[] = []
  const human: UserMessage[] = []
  for (const message of decision.messages) {
    (isHumanMessage(message) ? human : context).push(message)
  }
  if (context.length === 0 || human.length === 0) return decision

  const firstHuman = decision.messages.findIndex(isHumanMessage)
  if (firstHuman === context.length) return decision
  return { kind: 'enter', messages: [...context, ...human] }
}

/** Register the outer pre-step ordering listener for every agent scope. */
export function apply(ctx: Context): void {
  ctx.on('agent/pre-step', async (_payload, next): Promise<PreStepDecision> => {
    return orderContextBeforeUser(await next())
  }, { prepend: true })
}
