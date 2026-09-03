//#region src/index.ts
const name = "context-before-user";
const inject = ["agents"];
/** Return whether a message was produced by the real user-facing input path. */
function isHumanMessage(message) {
	return message.source.kind === "user";
}
/**
* Stable-partition an entering step so injected context precedes human input.
* @param decision - authoritative result from downstream pre-step listeners.
* @returns the original decision or an enter decision with reordered messages.
*/
function orderContextBeforeUser(decision) {
	if (decision.kind === "reject") return decision;
	const context = [];
	const human = [];
	for (const message of decision.messages) (isHumanMessage(message) ? human : context).push(message);
	if (context.length === 0 || human.length === 0) return decision;
	if (decision.messages.findIndex(isHumanMessage) === context.length) return decision;
	return {
		kind: "enter",
		messages: [...context, ...human]
	};
}
/** Register the outer pre-step ordering listener for every agent scope. */
function apply(ctx) {
	ctx.on("agent/pre-step", async (_payload, next) => {
		return orderContextBeforeUser(await next());
	}, { prepend: true });
}
//#endregion
export { apply, inject, name, orderContextBeforeUser };
