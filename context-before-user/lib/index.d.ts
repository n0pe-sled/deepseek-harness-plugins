import { Context } from "@deepseek-ai/cordis";
import { PreStepDecision } from "@deepseek-ai/dsh-agent";
//#region src/index.d.ts
declare const name = "context-before-user";
declare const inject: string[];
/**
 * Stable-partition an entering step so injected context precedes human input.
 * @param decision - authoritative result from downstream pre-step listeners.
 * @returns the original decision or an enter decision with reordered messages.
 */
declare function orderContextBeforeUser(decision: PreStepDecision): PreStepDecision;
/** Register the outer pre-step ordering listener for every agent scope. */
declare function apply(ctx: Context): void;
//#endregion
export { apply, inject, name, orderContextBeforeUser };