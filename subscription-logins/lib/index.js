import { randomUUID } from "node:crypto";
import { credentialKey, parseCredentialKey } from "@deepseek-ai/dsh-credentials";
import { SettingsConflictError, settingsNamespace } from "@deepseek-ai/dsh-settings";
import { bindTypertRemote } from "@deepseek-ai/dsh-typert-protocol";
//#region src/shared/remote.ts
const SERVICE = "subscriptionOAuth";
const CREDENTIAL_KEYS = {
	"openai-codex": "llm-pi-ai/openai-codex",
	anthropic: "llm-pi-ai/anthropic",
	zai: "llm-pi-ai/zai"
};
const PREFIX = `dsh-subscription-logins#${SERVICE}.`;
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function parseProvider(value) {
	if (!isRecord(value) || value.provider !== "openai-codex" && value.provider !== "anthropic" && value.provider !== "zai") throw new TypeError("input must contain a supported provider");
	return { provider: value.provider };
}
function parseAnswer(value) {
	if (!isRecord(value)) throw new TypeError("answer input must be an object");
	const provider = parseProvider(value);
	if (typeof value.promptId !== "string" || value.promptId === "" || typeof value.value !== "string") throw new TypeError("answer input must contain a supported provider, non-empty promptId, and string value");
	return {
		provider: provider.provider,
		promptId: value.promptId,
		value: value.value
	};
}
function parseLabelInput(value) {
	if (!isRecord(value)) throw new TypeError("login input must be an object");
	const provider = parseProvider(value);
	if (typeof value.label !== "string" || value.label.trim() === "" || value.label.trim().length > 40) throw new TypeError("login label must contain 1 to 40 characters");
	return {
		provider: provider.provider,
		label: value.label.trim()
	};
}
function parseAccountInput(value) {
	if (!isRecord(value)) throw new TypeError("account input must be an object");
	const provider = parseProvider(value);
	if (typeof value.accountId !== "string" || !/^[a-z0-9-]+$/.test(value.accountId)) throw new TypeError("account input must contain a valid accountId");
	return {
		provider: provider.provider,
		accountId: value.accountId
	};
}
function parseRename(value) {
	if (!isRecord(value)) throw new TypeError("rename input must be an object");
	const account = parseAccountInput(value);
	const named = parseLabelInput(value);
	return {
		...account,
		label: named.label
	};
}
function parseStatus(value) {
	if (!isRecord(value) || typeof value.available !== "boolean" || typeof value.configured !== "boolean" || typeof value.inFlight !== "boolean" || typeof value.label !== "string" || typeof value.methodLabel !== "string" || !Array.isArray(value.accounts)) throw new TypeError("authorization status has invalid fields");
	const accounts = value.accounts.map((account) => {
		if (!isRecord(account) || typeof account.id !== "string" || typeof account.label !== "string" || typeof account.active !== "boolean") throw new TypeError("authorization account has invalid fields");
		return {
			id: account.id,
			label: account.label,
			active: account.active
		};
	});
	return {
		available: value.available,
		configured: value.configured,
		inFlight: value.inFlight,
		label: value.label,
		methodLabel: value.methodLabel,
		accounts
	};
}
function optionalString(value, field) {
	if (value === void 0) return void 0;
	if (typeof value !== "string") throw new TypeError(`${field} must be a string`);
	return value;
}
function parseNotice(value) {
	if (!isRecord(value) || typeof value.message !== "string") throw new TypeError("authorization notice is invalid");
	const url = optionalString(value.url, "notice url");
	const code = optionalString(value.code, "notice code");
	return {
		message: value.message,
		...url === void 0 ? {} : { url },
		...code === void 0 ? {} : { code }
	};
}
function parsePrompt(value) {
	if (!isRecord(value) || typeof value.kind !== "string" || typeof value.message !== "string") throw new TypeError("authorization prompt is invalid");
	if (value.kind === "select") {
		if (!Array.isArray(value.options)) throw new TypeError("select prompt options must be an array");
		const options = value.options.map((option) => {
			if (!isRecord(option) || typeof option.id !== "string" || typeof option.label !== "string") throw new TypeError("select prompt option is invalid");
			const description = optionalString(option.description, "option description");
			return {
				id: option.id,
				label: option.label,
				...description === void 0 ? {} : { description }
			};
		});
		return {
			kind: "select",
			message: value.message,
			options
		};
	}
	if (value.kind !== "text" && value.kind !== "secret") throw new TypeError("authorization prompt kind is invalid");
	const placeholder = optionalString(value.placeholder, "prompt placeholder");
	return {
		kind: value.kind,
		message: value.message,
		...placeholder === void 0 ? {} : { placeholder }
	};
}
function parsePoll(value) {
	if (!isRecord(value) || !Array.isArray(value.notices)) throw new TypeError("authorization poll is invalid");
	const notices = value.notices.map(parseNotice);
	let prompt = null;
	if (value.prompt !== null) {
		if (!isRecord(value.prompt) || typeof value.prompt.id !== "string") throw new TypeError("pending prompt is invalid");
		prompt = {
			id: value.prompt.id,
			prompt: parsePrompt(value.prompt.prompt)
		};
	}
	if (!(/* @__PURE__ */ new Set([
		null,
		"authorized",
		"cancelled",
		"failed"
	])).has(value.settlement)) throw new TypeError("authorization settlement is invalid");
	const message = optionalString(value.message, "settlement message");
	return {
		notices,
		prompt,
		settlement: value.settlement,
		...message === void 0 ? {} : { message }
	};
}
function parseAction(value) {
	if (!isRecord(value) || typeof value.ok !== "boolean") throw new TypeError("action outcome is invalid");
	if (value.ok) return { ok: true };
	if (typeof value.error !== "string") throw new TypeError("action error must be a string");
	return {
		ok: false,
		error: value.error
	};
}
const PROVIDER = { parse: parseProvider };
const BEGIN = { parse: parseLabelInput };
const ACCOUNT = { parse: parseAccountInput };
const RENAME = { parse: parseRename };
const ANSWER = { parse: parseAnswer };
const STATUS = { parse: parseStatus };
const POLL = { parse: parsePoll };
const ACTION = { parse: parseAction };
function descriptor(method, input, result) {
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
				typeSymbol: `${PREFIX}${method}Input`,
				schema: input
			}
		}],
		result: {
			mode: "strict",
			typeSymbol: `${PREFIX}${method}Result`,
			schema: result
		}
	};
}
const DESCRIPTORS = [
	descriptor("status", PROVIDER, STATUS),
	descriptor("begin", BEGIN, ACTION),
	descriptor("poll", PROVIDER, POLL),
	descriptor("answer", ANSWER, ACTION),
	descriptor("cancel", PROVIDER, ACTION),
	descriptor("selectLogin", ACCOUNT, ACTION),
	descriptor("deleteLogin", ACCOUNT, ACTION),
	descriptor("renameLogin", RENAME, ACTION)
];
//#endregion
//#region src/index.ts
const name = "subscription-logins";
const inject = [
	"authorization",
	"credentials",
	"settings",
	"typert"
];
const ARCHIVE_SCOPE = "subscription-logins";
const LEGACY_ARCHIVE_SCOPE = "openai-subscription-oauth";
const MODEL_SETTINGS = settingsNamespace("llm-pi-ai");
const EMPTY_MODEL = {
	services: [],
	events: [],
	objects: []
};
const PROVIDERS = {
	"openai-codex": {
		key: parseCredentialKey(CREDENTIAL_KEYS["openai-codex"]),
		method: "oauth",
		fallbackLabel: "OpenAI Codex",
		unavailable: "The openai-codex OAuth flow is unavailable. Check that the llm-pi-ai plugin is mounted.",
		busy: "A ChatGPT sign-in is already running."
	},
	anthropic: {
		key: parseCredentialKey(CREDENTIAL_KEYS.anthropic),
		method: "oauth",
		fallbackLabel: "Anthropic",
		unavailable: "The Anthropic OAuth flow is unavailable. Check that the llm-pi-ai plugin is mounted.",
		busy: "A Claude sign-in is already running."
	},
	zai: {
		key: parseCredentialKey(CREDENTIAL_KEYS.zai),
		method: "api-key",
		fallbackLabel: "Z.AI",
		unavailable: "The Z.AI API key flow is unavailable. Check that the llm-pi-ai plugin is mounted.",
		busy: "A Z.AI sign-in is already running."
	}
};
function messageOf(error) {
	return error instanceof Error ? error.message : String(error);
}
function noticeView(notice) {
	return {
		message: notice.message,
		...notice.url === void 0 ? {} : { url: notice.url },
		...notice.code === void 0 ? {} : { code: notice.code }
	};
}
function promptView(prompt) {
	if (prompt.kind === "select") return {
		kind: "select",
		message: prompt.message,
		options: prompt.options.map((option) => ({
			id: option.id,
			label: option.label,
			...option.description === void 0 ? {} : { description: option.description }
		}))
	};
	return {
		kind: prompt.kind,
		message: prompt.message,
		...prompt.placeholder === void 0 ? {} : { placeholder: prompt.placeholder }
	};
}
function accountIndex(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return {
		version: 1,
		active: null,
		accounts: []
	};
	const candidate = value;
	if (candidate.version !== 1 || candidate.active !== null && typeof candidate.active !== "string" || !Array.isArray(candidate.accounts)) return {
		version: 1,
		active: null,
		accounts: []
	};
	const accounts = [];
	for (const entry of candidate.accounts) {
		if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
		const row = entry;
		if (typeof row.id !== "string" || !/^[a-z0-9-]+$/.test(row.id) || typeof row.label !== "string") continue;
		accounts.push({
			id: row.id,
			label: row.label
		});
	}
	return {
		version: 1,
		active: typeof candidate.active === "string" && accounts.some((entry) => entry.id === candidate.active) ? candidate.active : null,
		accounts
	};
}
function accountId() {
	return `account-${randomUUID()}`;
}
function isProviderCredential(record) {
	return record?.kind === "grant" || record?.kind === "api-key";
}
function apply(ctx) {
	const attempts = /* @__PURE__ */ new Map();
	const queues = /* @__PURE__ */ new Map();
	const serial = async (provider, operation) => {
		const next = (queues.get(provider) ?? Promise.resolve()).catch(() => {}).then(operation);
		queues.set(provider, next);
		try {
			return await next;
		} finally {
			if (queues.get(provider) === next) queues.delete(provider);
		}
	};
	const indexKey = (provider) => credentialKey(ARCHIVE_SCOPE, `${provider}-accounts`);
	const archiveKey = (provider, id) => credentialKey(ARCHIVE_SCOPE, `${provider}-${id}`);
	const legacyIndexKey = (provider) => credentialKey(LEGACY_ARCHIVE_SCOPE, `${provider}-accounts`);
	const legacyArchiveKey = (provider, id) => credentialKey(LEGACY_ARCHIVE_SCOPE, `${provider}-${id}`);
	const writeRecord = (key, record) => ctx.credentials.modifyRecord(key, async () => record);
	const writeIndex = (provider, index) => writeRecord(indexKey(provider), {
		kind: "grant",
		payload: index
	});
	const readIndex = async (provider) => {
		const record = await ctx.credentials.readRecord(indexKey(provider));
		if (record?.kind === "grant") return accountIndex(record.payload);
		const legacy = await ctx.credentials.readRecord(legacyIndexKey(provider));
		if (legacy?.kind !== "grant") return {
			version: 1,
			active: null,
			accounts: []
		};
		const migrated = accountIndex(legacy.payload);
		for (const account of migrated.accounts) {
			const archived = await ctx.credentials.readRecord(legacyArchiveKey(provider, account.id));
			if (isProviderCredential(archived)) await writeRecord(archiveKey(provider, account.id), archived);
		}
		await writeIndex(provider, migrated);
		return migrated;
	};
	const ensureManaged = async (provider) => {
		const selected = PROVIDERS[provider];
		const canonical = await ctx.credentials.readRecord(selected.key);
		let index = await readIndex(provider);
		const present = [];
		for (const account of index.accounts) if (isProviderCredential(await ctx.credentials.readRecord(archiveKey(provider, account.id)))) present.push(account);
		const pruned = present.length !== index.accounts.length;
		if (pruned) index = {
			version: 1,
			active: present.some((account) => account.id === index.active) ? index.active : null,
			accounts: present
		};
		if (isProviderCredential(canonical) && index.active === null) {
			const id = accountId();
			await writeRecord(archiveKey(provider, id), canonical);
			index = {
				version: 1,
				active: id,
				accounts: [...index.accounts, {
					id,
					label: "Existing login"
				}]
			};
			await writeIndex(provider, index);
			return index;
		}
		if (!isProviderCredential(canonical) && index.active !== null) {
			index = {
				...index,
				active: null
			};
			await writeIndex(provider, index);
			return index;
		}
		if (isProviderCredential(canonical) && index.active !== null) {
			if (!isProviderCredential(await ctx.credentials.readRecord(archiveKey(provider, index.active)))) await writeRecord(archiveKey(provider, index.active), canonical);
		}
		if (pruned) await writeIndex(provider, index);
		return index;
	};
	const syncActive = async (provider, index) => {
		if (index.active === null) return;
		const current = await ctx.credentials.readRecord(PROVIDERS[provider].key);
		if (isProviderCredential(current)) await writeRecord(archiveKey(provider, index.active), current);
	};
	const ensureModelProvider = async (provider) => {
		for (let attempt = 0; attempt < 3; attempt += 1) {
			const descriptor = ctx.settings.describe().find((candidate) => candidate.ns === MODEL_SETTINGS);
			if (descriptor === void 0) throw new Error("The llm-pi-ai settings namespace is unavailable.");
			const value = descriptor.value;
			const providers = typeof value.providers === "object" && value.providers !== null && !Array.isArray(value.providers) ? value.providers : {};
			if (Object.hasOwn(providers, provider)) return;
			try {
				await ctx.settings.mutate(MODEL_SETTINGS, [{
					op: "set",
					path: ["providers", provider],
					value: {}
				}], descriptor.revision);
				return;
			} catch (error) {
				if (error instanceof SettingsConflictError) continue;
				throw error;
			}
		}
		throw new Error(`The ${provider} model provider changed concurrently and could not be added.`);
	};
	const finalizeLogin = (provider, attempt) => serial(provider, async () => {
		const current = await ctx.credentials.readRecord(PROVIDERS[provider].key);
		if (!isProviderCredential(current)) throw new Error("The provider completed sign-in without storing a credential.");
		await writeRecord(archiveKey(provider, attempt.accountId), current);
		const accounts = (await readIndex(provider)).accounts.filter((account) => account.id !== attempt.accountId);
		accounts.push({
			id: attempt.accountId,
			label: attempt.accountLabel
		});
		await writeIndex(provider, {
			version: 1,
			active: attempt.accountId,
			accounts
		});
		try {
			await ensureModelProvider(provider);
		} catch (error) {
			attempt.notices.push({ message: `Login saved, but DSH could not add the ${provider} model provider automatically: ${messageOf(error)}` });
		}
	});
	const status = async (provider) => {
		const selected = PROVIDERS[provider];
		const flow = ctx.authorization.describe(selected.key);
		const index = await serial(provider, () => ensureManaged(provider));
		const method = flow?.methods.find((candidate) => candidate.id === selected.method);
		return {
			available: method !== void 0,
			configured: index.active !== null,
			inFlight: flow?.inFlight ?? false,
			label: flow?.label ?? selected.fallbackLabel,
			methodLabel: method?.label ?? "Add subscription credential",
			accounts: index.accounts.map((account) => ({
				...account,
				active: account.id === index.active
			}))
		};
	};
	const receiver = {
		typertRemote: void 0,
		status: (input) => status(input.provider),
		begin: async (input) => {
			const selected = PROVIDERS[input.provider];
			const flow = ctx.authorization.describe(selected.key);
			if (flow === void 0 || !flow.methods.some((candidate) => candidate.id === selected.method)) return {
				ok: false,
				error: selected.unavailable
			};
			const attempt = attempts.get(input.provider);
			if (flow.inFlight || attempt !== void 0 && attempt.settlement === null) return {
				ok: false,
				error: selected.busy
			};
			const index = await serial(input.provider, () => ensureManaged(input.provider));
			if (index.accounts.some((account) => account.label.localeCompare(input.label, void 0, { sensitivity: "accent" }) === 0)) return {
				ok: false,
				error: `A saved login already uses the name "${input.label}".`
			};
			await serial(input.provider, () => syncActive(input.provider, index));
			const current = {
				controller: new AbortController(),
				notices: [],
				settlement: null,
				accountId: accountId(),
				accountLabel: input.label
			};
			attempts.set(input.provider, current);
			ctx.authorization.begin({
				key: selected.key,
				method: selected.method,
				interaction: {
					notify(notice) {
						current.notices.push(noticeView(notice));
					},
					prompt(prompt) {
						return new Promise((resolve, reject) => {
							const id = randomUUID();
							const pending = {
								id,
								view: {
									id,
									prompt: promptView(prompt)
								},
								resolve,
								reject
							};
							current.prompt = pending;
							prompt.signal?.addEventListener("abort", () => {
								if (current.prompt?.id !== id) return;
								delete current.prompt;
								reject(/* @__PURE__ */ new Error("authorization prompt withdrawn"));
							}, { once: true });
						});
					}
				},
				signal: current.controller.signal
			}).then(async (outcome) => {
				if (outcome.status === "authorized") await finalizeLogin(input.provider, current);
				current.settlement = outcome.status;
			}).catch((error) => {
				current.settlement = "failed";
				current.message = messageOf(error);
			});
			return { ok: true };
		},
		poll: (input) => {
			const attempt = attempts.get(input.provider);
			if (attempt === void 0) return Promise.resolve({
				notices: [],
				prompt: null,
				settlement: null
			});
			const notices = attempt.notices;
			attempt.notices = [];
			return Promise.resolve({
				notices,
				prompt: attempt.prompt?.view ?? null,
				settlement: attempt.settlement,
				...attempt.message === void 0 ? {} : { message: attempt.message }
			});
		},
		answer: (input) => {
			const attempt = attempts.get(input.provider);
			const pending = attempt?.prompt;
			if (pending === void 0 || pending.id !== input.promptId) return Promise.resolve({
				ok: false,
				error: "That sign-in question is no longer waiting for an answer."
			});
			delete attempt?.prompt;
			pending.resolve(input.value);
			return Promise.resolve({ ok: true });
		},
		cancel: (input) => {
			const selected = PROVIDERS[input.provider];
			const current = attempts.get(input.provider);
			if (current !== void 0) {
				current.controller.abort("cancelled by user");
				current.prompt?.reject(/* @__PURE__ */ new Error("authorization cancelled"));
				delete current.prompt;
			}
			ctx.authorization.cancel(selected.key);
			return Promise.resolve({ ok: true });
		},
		selectLogin: async (input) => {
			try {
				if (attempts.get(input.provider)?.settlement === null) return {
					ok: false,
					error: "Wait for the current sign-in to finish or cancel it first."
				};
				await serial(input.provider, async () => {
					const index = await ensureManaged(input.provider);
					if (index.accounts.find((account) => account.id === input.accountId) === void 0) throw new Error("That saved login no longer exists.");
					if (index.active === input.accountId) return;
					await syncActive(input.provider, index);
					const archived = await ctx.credentials.readRecord(archiveKey(input.provider, input.accountId));
					if (!isProviderCredential(archived)) throw new Error("That saved login has no provider credential.");
					await writeRecord(PROVIDERS[input.provider].key, archived);
					await writeIndex(input.provider, {
						...index,
						active: input.accountId
					});
				});
				return { ok: true };
			} catch (error) {
				return {
					ok: false,
					error: messageOf(error)
				};
			}
		},
		deleteLogin: async (input) => {
			try {
				if (attempts.get(input.provider)?.settlement === null) return {
					ok: false,
					error: "Wait for the current sign-in to finish or cancel it first."
				};
				await serial(input.provider, async () => {
					const index = await ensureManaged(input.provider);
					if (!index.accounts.some((account) => account.id === input.accountId)) throw new Error("That saved login no longer exists.");
					if (index.active === input.accountId) await ctx.credentials.deleteRecord(PROVIDERS[input.provider].key);
					await ctx.credentials.deleteRecord(archiveKey(input.provider, input.accountId));
					await writeIndex(input.provider, {
						version: 1,
						active: index.active === input.accountId ? null : index.active,
						accounts: index.accounts.filter((account) => account.id !== input.accountId)
					});
				});
				return { ok: true };
			} catch (error) {
				return {
					ok: false,
					error: messageOf(error)
				};
			}
		},
		renameLogin: async (input) => {
			try {
				await serial(input.provider, async () => {
					const index = await ensureManaged(input.provider);
					if (!index.accounts.some((account) => account.id === input.accountId)) throw new Error("That saved login no longer exists.");
					if (index.accounts.some((account) => account.id !== input.accountId && account.label.localeCompare(input.label, void 0, { sensitivity: "accent" }) === 0)) throw new Error(`A saved login already uses the name "${input.label}".`);
					await writeIndex(input.provider, {
						...index,
						accounts: index.accounts.map((account) => account.id === input.accountId ? {
							...account,
							label: input.label
						} : account)
					});
				});
				return { ok: true };
			} catch (error) {
				return {
					ok: false,
					error: messageOf(error)
				};
			}
		}
	};
	receiver.typertRemote = bindTypertRemote(receiver, SERVICE, { namespace: SERVICE });
	ctx.provide(SERVICE, receiver);
	const contribution = {
		package: "dsh-subscription-logins",
		face: "host",
		schemas: [],
		model: EMPTY_MODEL,
		invocations: [...DESCRIPTORS]
	};
	ctx.typert.register(contribution);
	ctx.effect(() => () => {
		for (const [provider, attempt] of attempts) {
			attempt.controller.abort("plugin stopped");
			attempt.prompt?.reject(/* @__PURE__ */ new Error("authorization plugin stopped"));
			ctx.authorization.cancel(PROVIDERS[provider].key);
		}
	}, "subscription-oauth: cancel attempts on stop");
}
//#endregion
export { apply, inject, name };
