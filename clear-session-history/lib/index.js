import { realpath, rm, rmdir, stat } from "node:fs/promises";
import path from "node:path";
import { bindTypertRemote } from "@deepseek-ai/dsh-typert-protocol";
//#region src/shared/remote.ts
/** Cordis service key of the receiver, also the wire namespace. */
const SERVICE = "clearSessionHistory";
const PREFIX = `dsh-clear-session-history#${SERVICE}.`;
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function isNatural(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function parseClearScopeInput(value) {
	if (!isRecord(value) || typeof value.workspaceTitle !== "string" || !isNatural(value.titleOccurrence)) throw new TypeError("clear scope input must be a plain object with a string workspaceTitle and a natural titleOccurrence");
	return {
		workspaceTitle: value.workspaceTitle,
		titleOccurrence: value.titleOccurrence
	};
}
function parseClearCounts(value) {
	if (!isRecord(value) || !isNatural(value.targets) || !isNatural(value.kept)) throw new TypeError("clear counts must be a plain object with natural targets and kept");
	return {
		targets: value.targets,
		kept: value.kept
	};
}
function parsePreviewOutcome(value) {
	if (!isRecord(value) || typeof value.ok !== "boolean") throw new TypeError("preview outcome must be a plain object with ok");
	if (value.ok) {
		const counts = parseClearCounts(value);
		return {
			ok: true,
			targets: counts.targets,
			kept: counts.kept
		};
	}
	if (typeof value.error !== "string") throw new TypeError("preview outcome error must be a string");
	return {
		ok: false,
		error: value.error
	};
}
function parseClearOutcome(value) {
	if (!isRecord(value) || typeof value.ok !== "boolean") throw new TypeError("clear outcome must be a plain object with ok");
	if (value.ok) {
		if (!isNatural(value.deleted)) throw new TypeError("clear outcome ok result must carry a natural deleted count");
		const counts = parseClearCounts(value);
		return {
			ok: true,
			deleted: value.deleted,
			targets: counts.targets,
			kept: counts.kept
		};
	}
	if (typeof value.error !== "string") throw new TypeError("clear outcome error must be a string");
	return {
		ok: false,
		error: value.error
	};
}
const CLEAR_SCOPE_INPUT_SCHEMA = { parse: parseClearScopeInput };
const PREVIEW_OUTCOME_SCHEMA = { parse: parsePreviewOutcome };
const CLEAR_OUTCOME_SCHEMA = { parse: parseClearOutcome };
/** The one descriptor each method needs: generated-style identity + strict codecs. */
function descriptor(method, result) {
	return {
		id: `${PREFIX}${method}`,
		service: SERVICE,
		namespace: SERVICE,
		method,
		invocation: { kind: "direct" },
		parameters: [{
			name: "input",
			wire: "input",
			source: "json",
			codec: {
				mode: "strict",
				typeSymbol: `dsh-clear-session-history#${method}Input`,
				schema: CLEAR_SCOPE_INPUT_SCHEMA
			}
		}],
		result: {
			mode: "strict",
			typeSymbol: `dsh-clear-session-history#${method}`,
			schema: result
		}
	};
}
const DESCRIPTORS = [descriptor("preview", PREVIEW_OUTCOME_SCHEMA), descriptor("clear", CLEAR_OUTCOME_SCHEMA)];
//#endregion
//#region src/index.ts
/**
* Host (Node) half of the Clear Session History plugin.
*
* Deletes session logs from disk under the sessions root, scoped either to one
* workspace (matched by display title, resolved through `workspaceRegistry`)
* or to every workspace at once. The on-disk layout comes from the configured
* session persistence backend: each materialized session owns one directory
* (`<root>/<projectKey>/<sessionId>/`), which the backend's `locate()` resolves
* without guessing at the project-slug algorithm.
*
* Safety model — the persistence service is append-only and knows nothing
* about this plugin, so the rules here err toward keeping data:
*   - A session that is live in the running host (`sessions` store) is never
*     deleted; deleting an attached log underneath its writer would leave a
*     recreated, headerless file.
*   - A cold subagent log whose parent lineage reaches a live session is kept
*     too (fixpoint over `parentSession` chains), so an open session's
*     trajectory replay stays intact.
*   - A directory is only removed when its basename equals the session id and
*     its parent matches the backend's project-key shape, so a degenerate
*     `locate()` result can never widen into a recursive wipe.
*
* Registry bookkeeping needs no surgery: `workspace.list` rows keep stale
* session ids, but the sidebar joins membership against `session.list` (read
* fresh from persistence) and skips ids without a summary, so deleted
* sessions disappear from the tree; the stale ids are filtered on the next
* host start and remain invisible until then.
*
* All actions flow through a runtime-registered Typert endpoint
* (`clearSessionHistory`) consumed by the browser half; `preview` returns the
* same scope `clear` would act on, and both refuse to throw — failures come
* back as `{ ok: false, error }` outcomes.
*/
const name = "clear-session-history";
/** Services that must be mounted before this plugin runs. */
const inject = [
	"sessionPersistence",
	"sessions",
	"workspaceRegistry",
	"typert"
];
/** Fetch one service by name. */
function service(ctx, key) {
	return ctx.get(key);
}
/** Log through the host logger when present, containing every failure. */
function makeLogger(ctx) {
	const logger = ctx.logger;
	return {
		info: (message, ...args) => {
			logger?.info?.(message, ...args);
		},
		warn: (message, ...args) => {
			logger?.warn?.(message, ...args);
		}
	};
}
/** Canonicalize a path the way the host does; fall back to resolve when the
* path does not exist (a session cwd may point at a removed directory). */
async function canonicalize(raw) {
	try {
		return await realpath(raw);
	} catch {
		return path.resolve(raw);
	}
}
/** Empty model for the Typert contribution: no generated reflection is claimed. */
const EMPTY_MODEL = {
	services: [],
	events: [],
	objects: []
};
function apply(ctx) {
	const log = makeLogger(ctx);
	/** Resolve the duck-typed services or return a failure message. */
	const resolveServices = () => {
		const persistence = service(ctx, "sessionPersistence");
		const sessions = service(ctx, "sessions");
		const registry = service(ctx, "workspaceRegistry");
		if (persistence === void 0) return { error: "the sessionPersistence service is not available in this composition" };
		if (sessions === void 0) return { error: "the sessions service is not available in this composition" };
		if (registry === void 0) return { error: "the workspaceRegistry service is not available in this composition" };
		return {
			persistence,
			sessions,
			registry
		};
	};
	/**
	* Sessions that must survive any clear: every live session plus, by
	* fixpoint over `parentSession` chains, every cold subagent whose ancestry
	* reaches a live session.
	*/
	const protectedIds = async (persistence, sessions) => {
		const headers = await persistence.list();
		const live = new Set(sessions.list().map((session) => session.id));
		let grew = true;
		while (grew) {
			grew = false;
			for (const header of headers) {
				if (live.has(header.id)) continue;
				if (header.origin !== "subagent") continue;
				const parent = header.parentSession;
				if (parent !== void 0 && live.has(parent)) {
					live.add(header.id);
					grew = true;
				}
			}
		}
		return live;
	};
	/**
	* The session directory a header's backend artifact lives in, or null when
	* the shape does not look like one session's owned directory.
	*/
	const sessionDirOf = (header, artifactPath) => {
		const dir = path.dirname(artifactPath);
		if (path.basename(dir) !== header.id) return null;
		const project = path.dirname(dir);
		const projectSeg = path.basename(project);
		if (!(projectSeg === "_no-cwd" || projectSeg.startsWith("--") && projectSeg.endsWith("--") && projectSeg.length > 4)) return null;
		const root = path.dirname(project);
		if (path.dirname(root) === root) return null;
		return dir;
	};
	/**
	* Compute the clear scope once, shared by preview and clear: which headers
	* would be deleted (`targets`) and which are kept inside the scope (`kept`).
	* `workspace === undefined` scans every workspace; otherwise only headers
	* whose canonical cwd equals the workspace's canonical path are in scope —
	* the same membership rule the registry applies.
	*/
	const scanScope = async (persistence, sessions, workspace) => {
		const headers = await persistence.list();
		const protectedSet = await protectedIds(persistence, sessions);
		const workspacePath = workspace === void 0 ? void 0 : await canonicalize(workspace.path);
		const targets = [];
		let kept = 0;
		for (const header of headers) {
			if (workspacePath !== void 0) {
				if (header.cwd === void 0) continue;
				if (await canonicalize(header.cwd) !== workspacePath) continue;
			}
			if (protectedSet.has(header.id)) kept += 1;
			else targets.push(header);
		}
		return {
			targets,
			kept
		};
	};
	/** Resolve the scope's workspace row (or undefined for "all workspaces"). */
	const resolveWorkspace = (registry, input) => {
		if (input.workspaceTitle === "") return {};
		const matches = registry.list().filter((workspace) => workspace.title === input.workspaceTitle);
		const workspace = matches[input.titleOccurrence];
		if (workspace === void 0) return { error: matches.length === 0 ? `no workspace named "${input.workspaceTitle}" is registered` : `workspace "${input.workspaceTitle}" #${input.titleOccurrence + 1} is not registered (${matches.length} share that title)` };
		return { workspace };
	};
	/** Delete one target's directory after re-checking the shape on disk. */
	const deleteSessionDir = async (header, persistence) => {
		const location = persistence.locate(header);
		if (location === void 0) return false;
		const dir = sessionDirOf(header, location.path);
		if (dir === null) return false;
		try {
			if (!(await stat(dir)).isDirectory()) return false;
			await rm(dir, {
				recursive: true,
				force: true
			});
			return true;
		} catch (error) {
			log.warn("[clear-session-history] failed to remove %s: %s", dir, error instanceof Error ? error.message : String(error));
			return false;
		}
	};
	/** Remove a project directory once it is empty (tidy, best effort). */
	const pruneEmptyProjectDir = async (projectDir) => {
		try {
			await rmdir(projectDir);
		} catch {}
	};
	const prepare = (input) => {
		const services = resolveServices();
		if ("error" in services) return {
			ok: false,
			error: services.error
		};
		const resolved = resolveWorkspace(services.registry, input);
		if (resolved.error !== void 0) return {
			ok: false,
			error: resolved.error
		};
		if (resolved.workspace === void 0) return {
			ok: true,
			persistence: services.persistence,
			sessions: services.sessions
		};
		return {
			ok: true,
			persistence: services.persistence,
			sessions: services.sessions,
			workspace: resolved.workspace
		};
	};
	/** Counts only: what a clear would delete for this scope, nothing touched. */
	const preview = async (input) => {
		const prepared = prepare(input);
		if (!prepared.ok) return {
			ok: false,
			error: prepared.error
		};
		try {
			const scope = await scanScope(prepared.persistence, prepared.sessions, prepared.workspace);
			return {
				ok: true,
				targets: scope.targets.length,
				kept: scope.kept
			};
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	};
	/** Delete every target's session directory inside the scope. */
	const clear = async (input) => {
		const prepared = prepare(input);
		if (!prepared.ok) return {
			ok: false,
			error: prepared.error
		};
		const { persistence, sessions, workspace } = prepared;
		try {
			const scope = await scanScope(persistence, sessions, workspace);
			const touchedProjects = /* @__PURE__ */ new Set();
			let deleted = 0;
			let unresolved = 0;
			for (const header of scope.targets) {
				const location = persistence.locate(header);
				const dir = location === void 0 ? null : sessionDirOf(header, location.path);
				if (dir === null) {
					unresolved += 1;
					continue;
				}
				if (await deleteSessionDir(header, persistence)) {
					deleted += 1;
					touchedProjects.add(path.dirname(dir));
				} else unresolved += 1;
			}
			if (touchedProjects.size > 0) {
				const remainingProjects = /* @__PURE__ */ new Set();
				for (const header of await persistence.list()) {
					const location = persistence.locate(header);
					if (location !== void 0) remainingProjects.add(path.dirname(path.dirname(location.path)));
				}
				for (const project of touchedProjects) if (!remainingProjects.has(project)) await pruneEmptyProjectDir(project);
			}
			log.info("[clear-session-history] cleared %d session log(s) (kept %d, unresolved %d, scope %s)", deleted, scope.kept, unresolved, workspace === void 0 ? "all workspaces" : `"${input.workspaceTitle}"`);
			return {
				ok: true,
				deleted,
				targets: scope.targets.length,
				kept: scope.kept
			};
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	};
	const receiver = {
		typertRemote: void 0,
		preview,
		clear
	};
	receiver.typertRemote = bindTypertRemote(receiver, SERVICE, { namespace: SERVICE });
	ctx.provide(SERVICE, receiver);
	const contribution = {
		package: "dsh-clear-session-history",
		face: "host",
		schemas: [],
		model: EMPTY_MODEL,
		invocations: [...DESCRIPTORS]
	};
	ctx.typert.register(contribution);
}
//#endregion
export { apply, inject, name };
