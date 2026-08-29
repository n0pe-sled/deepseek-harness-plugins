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
function parseSessionScopeInput(value) {
	if (!isRecord(value) || typeof value.sessionId !== "string" || value.sessionId.trim() === "") throw new TypeError("session scope input must be a plain object with a non-empty sessionId string");
	return { sessionId: value.sessionId };
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
		if (!isNatural(value.deleted) || !isNatural(value.removed)) throw new TypeError("clear outcome ok result must carry natural deleted and removed counts");
		const counts = parseClearCounts(value);
		return {
			ok: true,
			deleted: value.deleted,
			removed: value.removed,
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
const SESSION_SCOPE_INPUT_SCHEMA = { parse: parseSessionScopeInput };
const PREVIEW_OUTCOME_SCHEMA = { parse: parsePreviewOutcome };
const CLEAR_OUTCOME_SCHEMA = { parse: parseClearOutcome };
/** The one descriptor each method needs: generated-style identity + strict codecs. */
function descriptor(method, result, inputSchema = CLEAR_SCOPE_INPUT_SCHEMA) {
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
				schema: inputSchema
			}
		}],
		result: {
			mode: "strict",
			typeSymbol: `dsh-clear-session-history#${method}`,
			schema: result
		}
	};
}
const DESCRIPTORS = [
	descriptor("preview", PREVIEW_OUTCOME_SCHEMA),
	descriptor("clear", CLEAR_OUTCOME_SCHEMA),
	descriptor("previewSession", PREVIEW_OUTCOME_SCHEMA, SESSION_SCOPE_INPUT_SCHEMA),
	descriptor("clearSession", CLEAR_OUTCOME_SCHEMA, SESSION_SCOPE_INPUT_SCHEMA)
];
//#endregion
//#region src/index.ts
/**
* Host (Node) half of the Clear Session History plugin.
*
* Deletes session logs from disk under the sessions root, scoped either to one
* workspace (matched by display title, resolved through `workspaceRegistry`),
* to every workspace at once, or to a single session (matched by
* `sessionId`, resolved client-side from the sidebar row). The on-disk layout
* comes from the configured session persistence backend: each materialized
* session owns one directory (`<root>/<projectKey>/<sessionId>/`), which the
* backend's `locate()` resolves without guessing at the project-slug algorithm.
*
* Safety model — the persistence service is append-only and knows nothing
* about this plugin. Every action shares one protection rule: the only
* sessions kept are those whose agent is actively running (a turn is in
* flight and its log is being written) plus, by fixpoint over
* `parentSession` chains, cold subagent logs whose lineage reaches one —
* deleting a log underneath its writer would leave a recreated, headerless
* file. Attached-but-idle sessions are deliberately deletable: a host that
* has touched a session keeps it in memory for the rest of the run, so
* protecting attachment would make workspace/all clears a no-op until
* restart. To stop an attached session from lingering in the sidebar, any
* clear that deletes one archives it first (the host's own archive hides
* the row and clears the selection for the current session).
*   - A directory is only removed when its basename equals the session id and
*     its parent matches the backend's project-key shape, so a degenerate
*     `locate()` result can never widen into a recursive wipe.
*
* Registry bookkeeping needs no surgery for the session rows: `workspace.list`
* rows keep stale session ids, but the sidebar joins membership against
* `session.list` (read fresh from persistence) and skips ids without a summary,
* so deleted sessions disappear from the tree; the stale ids are filtered on
* the next host start and remain invisible until then.
*
* Workspace rows are treated differently: once a clear has removed every
* targeted session log, the clear also deletes the workspace registration(s)
* (`$DSH_HOME/storages/workspace.json`) so the workspace disappears from the
* sidebar too. A per-workspace clear removes that one workspace; a clear-all
* removes every workspace. If only part of a clear succeeded the registration
* is kept, so leftover logs stay grouped instead of being orphaned. Any
* still-running session that belonged to a removed workspace moves to the
* Ungrouped bucket, exactly like the app's own Delete workspace action.
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
		const agents = service(ctx, "agents");
		if (persistence === void 0) return { error: "the sessionPersistence service is not available in this composition" };
		if (sessions === void 0) return { error: "the sessions service is not available in this composition" };
		if (registry === void 0) return { error: "the workspaceRegistry service is not available in this composition" };
		return {
			persistence,
			sessions,
			registry,
			...agents === void 0 ? {} : { agents }
		};
	};
	/**
	* Sessions no clear may touch: sessions whose agent is actively running
	* (a turn is in flight, so its log is being written) plus, by fixpoint
	* over `parentSession` chains, cold subagents whose lineage reaches a
	* running session. Attached-but-idle sessions are NOT protected — open
	* sessions are deletable by design; their log is removed and the row
	* hidden by archiving, so nothing writes to it again.
	*/
	const runningProtectedIds = async (persistence, agents) => {
		const headers = await persistence.list();
		const running = /* @__PURE__ */ new Set();
		if (agents !== void 0) {
			for (const header of headers) if (agents.get(header.id)?.status === "running") running.add(header.id);
		}
		let grew = true;
		while (grew) {
			grew = false;
			for (const header of headers) {
				if (running.has(header.id)) continue;
				if (header.origin !== "subagent") continue;
				const parent = header.parentSession;
				if (parent !== void 0 && running.has(parent)) {
					running.add(header.id);
					grew = true;
				}
			}
		}
		return running;
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
	const scanScope = async (persistence, agents, workspace) => {
		const headers = await persistence.list();
		const protectedSet = await runningProtectedIds(persistence, agents);
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
		return { workspace: {
			id: workspace.id,
			path: workspace.path
		} };
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
		return {
			ok: true,
			persistence: services.persistence,
			sessions: services.sessions,
			registry: services.registry,
			..."agents" in services && services.agents !== void 0 ? { agents: services.agents } : {},
			...resolved.workspace === void 0 ? {} : { workspace: resolved.workspace }
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
			const scope = await scanScope(prepared.persistence, prepared.agents, prepared.workspace);
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
		const { persistence, sessions, registry, agents, workspace } = prepared;
		try {
			const scope = await scanScope(persistence, agents, workspace);
			const attached = new Set(sessions.list().map((session) => session.id));
			const touchedProjects = /* @__PURE__ */ new Set();
			let deleted = 0;
			let unresolved = 0;
			let archived = 0;
			for (const header of scope.targets) {
				const location = persistence.locate(header);
				const dir = location === void 0 ? null : sessionDirOf(header, location.path);
				if (dir === null) {
					unresolved += 1;
					continue;
				}
				if (attached.has(header.id)) try {
					await registry.archiveSession(header.id);
					archived += 1;
				} catch (error) {
					log.warn("[clear-session-history] could not archive %s to hide it: %s", header.id, error instanceof Error ? error.message : String(error));
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
			let removed = 0;
			if (deleted === scope.targets.length && scope.targets.length > 0) {
				if (workspace !== void 0) try {
					if (await registry.delete(workspace.id)) removed = 1;
				} catch (error) {
					log.warn("[clear-session-history] failed to remove workspace %s: %s", workspace.id, error instanceof Error ? error.message : String(error));
				}
				else for (const row of registry.list()) try {
					if (await registry.delete(row.id)) removed += 1;
				} catch (error) {
					log.warn("[clear-session-history] failed to remove workspace %s: %s", row.id, error instanceof Error ? error.message : String(error));
				}
			}
			log.info("[clear-session-history] cleared %d session log(s) (kept %d running, archived %d, unresolved %d, removed %d workspace(s), scope %s)", deleted, scope.kept, archived, unresolved, removed, workspace === void 0 ? "all workspaces" : `"${input.workspaceTitle}"`);
			return {
				ok: true,
				deleted,
				targets: scope.targets.length,
				kept: scope.kept,
				removed
			};
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	};
	/** Locate one session by id and say why a single delete would be refused. */
	const inspectSession = async (persistence, agents, sessionId) => {
		const header = (await persistence.list()).find((candidate) => candidate.id === sessionId);
		if (header === void 0) return { refusals: [`no session with id "${sessionId}" is stored on disk`] };
		if ((await runningProtectedIds(persistence, agents)).has(header.id)) return {
			header,
			refusals: ["this session is currently running (an agent turn is in flight) and cannot be deleted yet"]
		};
		return {
			header,
			refusals: []
		};
	};
	/** Counts only: whether a single session's log is deletable, nothing touched. */
	const previewSession = async (input) => {
		const services = resolveServices();
		if ("error" in services) return {
			ok: false,
			error: services.error
		};
		const result = await inspectSession(services.persistence, services.agents, input.sessionId);
		if (result.header === void 0) return {
			ok: false,
			error: result.refusals[0] ?? "session not found"
		};
		return result.refusals.length > 0 ? {
			ok: true,
			targets: 0,
			kept: 1
		} : {
			ok: true,
			targets: 1,
			kept: 0
		};
	};
	/** Delete one session's log from disk; never touches the workspace registration.
	* Attached-but-idle sessions are deletable by design: the log is removed and,
	* because the host still holds the session in memory (so it would otherwise
	* linger in the sidebar), it is also archived so the row leaves the UI. */
	const clearSession = async (input) => {
		const services = resolveServices();
		if ("error" in services) return {
			ok: false,
			error: services.error
		};
		const result = await inspectSession(services.persistence, services.agents, input.sessionId);
		if (result.header === void 0) return {
			ok: false,
			error: result.refusals[0] ?? "session not found"
		};
		if (result.refusals.length > 0) return {
			ok: false,
			error: result.refusals[0] ?? "session not found"
		};
		try {
			const attached = services.sessions.list().some((session) => session.id === input.sessionId);
			if (attached) try {
				await services.registry.archiveSession(input.sessionId);
			} catch (error) {
				log.warn("[clear-session-history] could not archive %s to hide it: %s", input.sessionId, error instanceof Error ? error.message : String(error));
			}
			const deleted = await deleteSessionDir(result.header, services.persistence) ? 1 : 0;
			if (deleted === 1) {
				const location = services.persistence.locate(result.header);
				if (location !== void 0) await pruneEmptyProjectDir(path.dirname(path.dirname(location.path)));
				log.info("[clear-session-history] deleted session log %s%s", result.header.id, attached ? " (archived to hide)" : "");
			}
			return {
				ok: true,
				deleted,
				targets: 1,
				kept: 0,
				removed: 0
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
		clear,
		previewSession,
		clearSession
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
