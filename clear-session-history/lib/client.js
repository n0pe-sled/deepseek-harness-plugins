window.__ModuleLoader__.load({
	id: "dsh-clear-session-history",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom_client = require("react-dom/client");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/dialog.tsx
		/**
		* The confirm dialog for both clear actions: a checkbox-gated RiskConfirmation
		* fed by a live host-side count, so the user sees exactly how many session
		* logs a clear would delete before acknowledging.
		*
		* The component runs on the plugin's own React root (no slot registration);
		* the plugin body drives it through the imperative {@link DialogApi} handle
		* registered on mount, and every host interaction arrives as a plain callback
		* prop — the component never sees ctx.
		*/
		/** A preview that never arrived (host unavailable, request lost). */
		const EMPTY_COUNTS = {
			targets: 0,
			kept: 0
		};
		/** The wire payload for a request: a session id for single deletes, else the
		* workspace scope (empty title = every workspace). */
		function buildInput(request) {
			if (request.mode === "session") {
				if (request.sessionId === void 0) return null;
				return { sessionId: request.sessionId };
			}
			return {
				workspaceTitle: request.mode === "workspace" ? request.workspaceTitle : "",
				titleOccurrence: request.titleOccurrence
			};
		}
		/** The acknowledgement line, wording the workspace removal per mode. */
		function resolveAcknowledge(counts, pending, failed, nothing, mode) {
			if (nothing || pending || failed) return "I understand this action deletes session logs from disk.";
			if (mode === "session") return "I understand this session log will be permanently deleted from disk.";
			const removal = mode === "workspace" ? "the workspace is removed from the sidebar" : "every workspace is removed from the sidebar";
			return counts.targets === 1 ? `I understand this 1 session log is permanently deleted and ${removal}.` : `I understand these ${counts.targets} session logs are permanently deleted and ${removal}.`;
		}
		function ClearHistoryDialog({ register, onPreview, onClear, onSuccess, onCleared }) {
			const [request, setRequest] = (0, react.useState)(null);
			const [preview, setPreview] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [acknowledged, setAcknowledged] = (0, react.useState)(false);
			const [failure, setFailure] = (0, react.useState)(null);
			const [result, setResult] = (0, react.useState)(null);
			const generation = (0, react.useRef)(0);
			const close = (0, react.useCallback)(() => {
				generation.current += 1;
				setRequest(null);
				setPreview(null);
				setBusy(false);
				setAcknowledged(false);
				setFailure(null);
				setResult(null);
			}, []);
			(0, react.useEffect)(() => {
				register({ open: (next) => {
					generation.current += 1;
					setRequest(next);
					setPreview(null);
					setBusy(false);
					setAcknowledged(false);
					setFailure(null);
					setResult(null);
					const input = buildInput(next);
					if (input === null) {
						setFailure("Could not identify this session in the sidebar.");
						return;
					}
					const ticket = generation.current;
					onPreview(next.mode, input).then((outcome) => {
						if (generation.current !== ticket) return;
						setPreview(outcome);
					});
				} });
			}, []);
			if (request === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, {});
			const counts = preview !== null && preview.ok && preview.value.ok ? {
				targets: preview.value.targets,
				kept: preview.value.kept
			} : EMPTY_COUNTS;
			const sessionName = request.sessionTitle ?? "this session";
			const scopeLabel = request.mode === "workspace" ? `"${request.workspaceTitle}"` : request.mode === "session" ? `"${sessionName}"` : "every workspace";
			const previewPending = preview === null;
			const previewError = preview === null ? null : !preview.ok ? preview.error : !preview.value.ok ? preview.value.error : null;
			const previewFailed = previewError !== null;
			const nothingToDelete = !previewPending && !previewFailed && counts.targets === 0;
			const description = (() => {
				if (previewFailed) return `Could not check the session logs on disk: ${previewError ?? "unknown error"}`;
				if (previewPending) return request.mode === "session" ? "Checking this session…" : "Counting the session logs stored on disk…";
				if (nothingToDelete) {
					if (request.mode === "session") return counts.kept > 0 ? `This session is currently running (an agent turn is in flight), so it can't be deleted yet. Try again once it finishes.` : `No session log was found on disk for "${sessionName}". There is nothing to delete.`;
					return `No session logs were found on disk for ${scopeLabel}. There is nothing to delete.`;
				}
				if (request.mode === "session") return `This permanently deletes the session log for "${sessionName}" from disk. The workspace and its other sessions are untouched.`;
				const noun = counts.targets === 1 ? "session log" : "session logs";
				const keptNote = counts.kept > 0 ? ` Sessions that are currently open (and their running subagents) are kept: ${counts.kept}.` : " Sessions that are currently open are kept.";
				const removedNote = request.mode === "workspace" ? ` and removes the workspace from the sidebar` : " and removes every workspace from the sidebar";
				return `This permanently deletes ${counts.targets} ${noun} from disk for ${scopeLabel}${removedNote}.${keptNote}`;
			})();
			const confirmLabel = previewPending || previewFailed ? "Delete" : request.mode === "session" ? "Delete session" : counts.targets === 1 ? "Delete 1 session log" : `Delete ${counts.targets} session logs`;
			const confirm = () => {
				if (busy || request === null) return;
				const input = buildInput(request);
				if (input === null) {
					setFailure("Could not identify this session in the sidebar.");
					return;
				}
				setBusy(true);
				setFailure(null);
				onClear(request.mode, input).then((outcome) => {
					setBusy(false);
					if (!outcome.ok) {
						setFailure(outcome.error);
						return;
					}
					const counts = outcome.value;
					if (!counts.ok) {
						setFailure(counts.error);
						return;
					}
					if (counts.deleted < counts.targets) {
						setResult(`Deleted ${counts.deleted} of ${counts.targets} session logs. The rest could not be resolved to safe on-disk directories, so the workspace was kept.`);
						onCleared();
						return;
					}
					onSuccess();
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.RiskConfirmation, {
				open: true,
				title: request.mode === "session" ? "Delete session" : request.mode === "workspace" ? "Clear session history" : "Clear all session history",
				description: failure !== null ? `Delete failed: ${failure}` : result !== null ? result : description,
				acknowledgeLabel: resolveAcknowledge(counts, previewPending, previewFailed, nothingToDelete, request.mode),
				cancelLabel: "Cancel",
				confirmLabel,
				acknowledged,
				disabled: busy || previewPending || previewFailed || nothingToDelete,
				onAcknowledgedChange: setAcknowledged,
				onCancel: close,
				onConfirm: confirm
			});
		}
		//#endregion
		//#region src/client/augment.ts
		/** Anchor arming window: the portal menu must appear within this long after
		* the pointerdown on a workspace/session row's menu anchor. */
		const MENU_ARM_MS = 5e3;
		const WORKSPACE_ARIA_EN_PREFIX = "Workspace actions for ";
		const WORKSPACE_ARIA_ZH = /^工作区“(.*)”的操作$/;
		const SESSION_ARIA_EN_PREFIX = "Session actions for ";
		const SESSION_ARIA_ZH = /^会话“(.*)”的操作$/;
		const RENAME_LABELS = /* @__PURE__ */ new Set(["Rename", "重命名"]);
		const DELETE_LABELS = /* @__PURE__ */ new Set(["Delete workspace", "删除工作区"]);
		/** A session row's menu is the one carrying a Fork/Archive row (the workspace
		* menu's fork/archive are absent; its Delete-workspace pair is). */
		const SESSION_MENU_MARKERS = /* @__PURE__ */ new Set([
			"Fork session",
			"分叉会话",
			"Archive session",
			"归档会话"
		]);
		const NEW_SESSION_ARIA = /* @__PURE__ */ new Set(["New session", "新建会话"]);
		const NEW_SESSION_TEXT = /* @__PURE__ */ new Set(["New Session", "新会话"]);
		const MENU_ITEM_LABEL = {
			en: "Clear session history",
			zh: "清空会话记录"
		};
		const SESSION_DELETE_LABEL = {
			en: "Delete session",
			zh: "删除会话"
		};
		const SIDEBAR_LABEL = {
			en: "Clear all session history",
			zh: "清空全部会话记录"
		};
		const SIDEBAR_ARIA = {
			en: "Clear all session history",
			zh: "清空全部会话记录"
		};
		/** Extract the workspace display title from a workspace row menu anchor. */
		function workspaceTitleOf(label) {
			if (label.startsWith(WORKSPACE_ARIA_EN_PREFIX)) {
				const title = label.slice(22);
				return title === "" ? void 0 : title;
			}
			const title = WORKSPACE_ARIA_ZH.exec(label)?.[1];
			return title === void 0 || title === "" ? void 0 : title;
		}
		/** Extract the session display title from a session row menu anchor. */
		function sessionTitleOf(label) {
			if (label.startsWith(SESSION_ARIA_EN_PREFIX)) {
				const title = label.slice(20);
				return title === "" ? void 0 : title;
			}
			const title = SESSION_ARIA_ZH.exec(label)?.[1];
			return title === void 0 || title === "" ? void 0 : title;
		}
		const itemText = (button) => (button.textContent ?? "").trim();
		/**
		* Read the session id straight from the React fiber that rendered the row.
		* The session row component receives its tree node as a `node` prop carrying
		* the session id (ui-workspace `SessionNode`), and React 18 exposes the host
		* element's fiber under a `__reactFiber$<hash>` own property. Walking the
		* `return` chain from the row element finds that component's props. This is
		* exact regardless of sidebar sort order, hidden rows, or duplicate titles;
		* it returns undefined when the internals change, and the store-based
		* fallback takes over.
		*/
		function reactSessionIdOf(row) {
			const key = Object.keys(row).find((candidate) => candidate.startsWith("__reactFiber$"));
			if (key === void 0) return void 0;
			let fiber = row[key];
			for (let depth = 0; fiber !== void 0 && fiber !== null && depth < 40; depth += 1) {
				const props = fiber.memoizedProps;
				if (typeof props === "object" && props !== null) {
					const node = props.node;
					if (typeof node === "object" && node !== null) {
						const id = node.id;
						if (typeof id === "string" && id !== "") return id;
					}
				}
				fiber = fiber.return;
			}
		}
		/** A minimal 16px trash glyph that inherits currentColor from the danger rules. */
		const TRASH_ICON_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" stroke-width=\"1.5\" stroke=\"currentColor\" width=\"16\" height=\"16\" aria-hidden=\"true\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0\"/></svg>";
		function installSidebarIntegration(options) {
			/** The row whose menu anchor was engaged most recently. */
			let armed = null;
			const armFromEvent = (target) => {
				const button = target.closest("button[aria-label]");
				if (button === null) return;
				const label = button.getAttribute("aria-label") ?? "";
				const workspaceTitle = workspaceTitleOf(label);
				if (workspaceTitle !== void 0) {
					const same = [...document.querySelectorAll("button[aria-label]")].filter((candidate) => workspaceTitleOf(candidate.getAttribute("aria-label") ?? "") === workspaceTitle);
					armed = {
						kind: "workspace",
						title: workspaceTitle,
						titleOccurrence: Math.max(0, same.indexOf(button)),
						at: Date.now()
					};
					return;
				}
				const sessionTitle = sessionTitleOf(label);
				if (sessionTitle === void 0) return;
				const row = button.closest("[role=\"treeitem\"][aria-selected]");
				if (row === null) return;
				let group = null;
				for (let parent = row.parentElement; parent !== null && parent !== document.body; parent = parent.parentElement) {
					const anchor = parent.querySelector("button[aria-label]");
					if (anchor !== null && workspaceTitleOf(anchor.getAttribute("aria-label") ?? "") !== void 0) {
						group = parent;
						break;
					}
				}
				const rows = group === null ? [row] : [...group.querySelectorAll("[role=\"treeitem\"][aria-selected]")];
				const titleOfRow = (candidate) => {
					for (const anchor of candidate.querySelectorAll("button[aria-label]")) {
						const anchorTitle = sessionTitleOf(anchor.getAttribute("aria-label") ?? "");
						if (anchorTitle !== void 0) return anchorTitle;
					}
				};
				const sameTitled = rows.filter((candidate) => titleOfRow(candidate) === sessionTitle);
				const sameTitleIndex = Math.max(0, sameTitled.indexOf(row));
				let workspaceOccurrence = 0;
				let groupWorkspaceTitle = null;
				if (group !== null) {
					const anchor = group.querySelector("button[aria-label]");
					const title = anchor === null ? void 0 : workspaceTitleOf(anchor.getAttribute("aria-label") ?? "");
					groupWorkspaceTitle = title ?? null;
					if (anchor !== null && title !== void 0) {
						const same = [...document.querySelectorAll("button[aria-label]")].filter((candidate) => workspaceTitleOf(candidate.getAttribute("aria-label") ?? "") === title);
						workspaceOccurrence = Math.max(0, same.indexOf(anchor));
					}
				}
				const sessionId = reactSessionIdOf(row);
				armed = {
					kind: "session",
					target: {
						sessionTitle,
						...sessionId === void 0 ? {} : { sessionId },
						workspaceTitle: groupWorkspaceTitle,
						workspaceOccurrence,
						sameTitleIndex
					},
					at: Date.now()
				};
			};
			const onPointerDown = (event) => {
				if (event.target instanceof Element) armFromEvent(event.target);
			};
			const onKeyDown = (event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				if (event.target instanceof Element) armFromEvent(event.target);
			};
			document.addEventListener("pointerdown", onPointerDown, true);
			document.addEventListener("keydown", onKeyDown, true);
			/** Close whatever Menu list the clone lives in (outside pointerdown → onClose). */
			const dismissMenu = () => {
				document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
			};
			/** Add a "Delete session" row to a session row's menu. */
			const augmentSessionMenu = (menu, target) => {
				if (menu.querySelector("[data-dsh-clear-session]") !== null) return;
				const buttons = [...menu.querySelectorAll("button[role=\"menuitem\"]")];
				const marker = buttons.find((button) => SESSION_MENU_MARKERS.has(itemText(button)));
				const source = buttons[buttons.length - 1];
				if (marker === void 0 || source === void 0) return;
				const wrapper = source.parentElement;
				if (!(wrapper instanceof HTMLElement) || wrapper.parentElement === null) return;
				const locale = itemText(marker) === "Fork session" || itemText(marker) === "Archive session" ? "en" : "zh";
				const label = SESSION_DELETE_LABEL[locale];
				const clone = wrapper.cloneNode(true);
				if (!(clone instanceof HTMLElement)) return;
				const cloneButton = clone.querySelector("button[role=\"menuitem\"]");
				if (cloneButton === null) return;
				cloneButton.dataset.dshClearSession = "true";
				cloneButton.setAttribute("aria-label", label);
				const sourceText = itemText(source);
				for (const span of cloneButton.querySelectorAll("span")) if ((span.textContent ?? "").trim() === sourceText) {
					span.textContent = label;
					break;
				}
				const currentIcon = cloneButton.querySelector("svg");
				if (currentIcon !== null) {
					const holder = document.createElement("div");
					holder.innerHTML = TRASH_ICON_SVG;
					const trash = holder.firstElementChild;
					if (trash !== null) currentIcon.replaceWith(trash);
				}
				cloneButton.addEventListener("click", (event) => {
					event.stopPropagation();
					dismissMenu();
					options.openSessionDialog(target);
				});
				wrapper.after(clone);
			};
			const augmentMenu = (menu) => {
				const buttons = [...menu.querySelectorAll("button[role=\"menuitem\"]")];
				const deleteRow = buttons.find((button) => DELETE_LABELS.has(itemText(button)));
				const isWorkspaceMenu = deleteRow !== void 0 && buttons.some((button) => RENAME_LABELS.has(itemText(button)));
				const isSessionMenu = !isWorkspaceMenu && buttons.some((button) => SESSION_MENU_MARKERS.has(itemText(button)));
				if (isWorkspaceMenu) return augmentWorkspaceMenu(menu, deleteRow);
				if (!isSessionMenu) return;
				if (armed === null || armed.kind !== "session" || Date.now() - armed.at > MENU_ARM_MS) return;
				const { target } = armed;
				armed = null;
				augmentSessionMenu(menu, target);
			};
			/** Add a "Clear session history" row to a workspace row's menu. */
			const augmentWorkspaceMenu = (menu, deleteRow) => {
				if (menu.querySelector("[data-dsh-clear-history]") !== null) return;
				if (deleteRow === void 0) return;
				if (armed === null || armed.kind !== "workspace" || Date.now() - armed.at > MENU_ARM_MS) return;
				const { title, titleOccurrence } = armed;
				armed = null;
				const wrapper = deleteRow.parentElement;
				if (!(wrapper instanceof HTMLElement) || wrapper.parentElement === null) return;
				const deletedLabel = itemText(deleteRow);
				const locale = deletedLabel === "Delete workspace" ? "en" : "zh";
				const clone = wrapper.cloneNode(true);
				if (!(clone instanceof HTMLElement)) return;
				const cloneButton = clone.querySelector("button[role=\"menuitem\"]");
				if (cloneButton === null) return;
				cloneButton.dataset.dshClearHistory = "true";
				cloneButton.setAttribute("aria-label", MENU_ITEM_LABEL[locale]);
				for (const span of cloneButton.querySelectorAll("span")) if ((span.textContent ?? "").trim() === deletedLabel) {
					span.textContent = MENU_ITEM_LABEL[locale];
					break;
				}
				cloneButton.addEventListener("click", (event) => {
					event.stopPropagation();
					dismissMenu();
					options.openDialog({
						mode: "workspace",
						workspaceTitle: title,
						titleOccurrence
					});
				});
				wrapper.after(clone);
			};
			const menuObserver = new MutationObserver((mutations) => {
				for (const mutation of mutations) for (const node of mutation.addedNodes) if (node instanceof HTMLElement && node.getAttribute("role") === "menu") queueMicrotask(() => {
					if (node.isConnected) augmentMenu(node);
				});
			});
			menuObserver.observe(document.body, { childList: true });
			const style = document.createElement("style");
			style.dataset.dshClearAllStyle = "true";
			style.textContent = [
				"[data-dsh-clear-all], [data-dsh-clear-all] span { color: var(--dsw-alias-state-error-primary) !important; }",
				"[data-dsh-clear-all]:hover, [data-dsh-clear-all]:hover span { color: var(--dsw-alias-state-error-secondary) !important; }",
				"[data-dsh-clear-session], [data-dsh-clear-session] span, [data-dsh-clear-session] svg { color: var(--dsw-alias-state-error-primary) !important; }",
				"[data-dsh-clear-session]:hover, [data-dsh-clear-session]:hover span, [data-dsh-clear-session]:hover svg { color: var(--dsw-alias-state-error-secondary) !important; background: var(--dsw-alias-interactive-bg-hover-danger); }"
			].join("\n");
			document.head.appendChild(style);
			const syncButton = () => {
				const anchor = [...document.querySelectorAll("button[aria-label]")].filter((button) => NEW_SESSION_ARIA.has(button.getAttribute("aria-label") ?? "")).filter((button) => [...button.querySelectorAll("span")].some((span) => NEW_SESSION_TEXT.has((span.textContent ?? "").trim())))[0] ?? null;
				const existing = document.querySelector("[data-dsh-clear-all]");
				if (anchor === null) {
					existing?.remove();
					return;
				}
				for (const extra of document.querySelectorAll("[data-dsh-clear-all]")) if (extra !== existing) extra.remove();
				if (existing !== null && anchor.nextElementSibling === existing) return;
				const locale = [...anchor.querySelectorAll("span")].some((span) => (span.textContent ?? "").trim() === "新会话") ? "zh" : "en";
				const button = existing ?? anchor.cloneNode(true);
				button.dataset.dshClearAll = "true";
				button.removeAttribute("title");
				button.setAttribute("aria-label", SIDEBAR_ARIA[locale]);
				let labelled = false;
				for (const span of button.querySelectorAll("span")) {
					const text = (span.textContent ?? "").trim();
					if (NEW_SESSION_TEXT.has(text)) {
						span.textContent = SIDEBAR_LABEL[locale];
						labelled = true;
						break;
					}
				}
				if (!labelled) return;
				button.onclick = (event) => {
					event.stopPropagation();
					options.openDialog({
						mode: "all",
						workspaceTitle: "",
						titleOccurrence: 0
					});
				};
				if (button.parentElement === null || button.parentElement !== anchor.parentElement) anchor.after(button);
				else if (anchor.nextElementSibling !== button) anchor.after(button);
			};
			let syncScheduled = false;
			const scheduleSync = () => {
				if (syncScheduled) return;
				syncScheduled = true;
				requestAnimationFrame(() => {
					syncScheduled = false;
					syncButton();
				});
			};
			const sidebarObserver = new MutationObserver(scheduleSync);
			sidebarObserver.observe(document.body, {
				childList: true,
				subtree: true
			});
			const interval = window.setInterval(syncButton, 2e3);
			syncButton();
			return () => {
				menuObserver.disconnect();
				sidebarObserver.disconnect();
				document.removeEventListener("pointerdown", onPointerDown, true);
				document.removeEventListener("keydown", onKeyDown, true);
				window.clearInterval(interval);
				document.querySelector("[data-dsh-clear-all]")?.remove();
				style.remove();
			};
		}
		//#endregion
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
		//#region src/client/index.ts
		/**
		* Browser half of the Clear Session History plugin.
		*
		* Registers no slots: the three affordances live on existing sidebar surfaces
		* (see ./augment.ts). This entry mounts the plugin's Remote namespace, hosts
		* the confirm dialog on its own React root, and wires the sides together —
		* augmentation clicks open the dialog, the dialog calls the host through the
		* Remote, and a successful clear reloads the page so the fresh session and
		* workspace lists reflect the deletion.
		*
		* A workspace-menu clear targets a workspace by display title
		* (+ occurrence among same-titled rows); the clear-all button targets all
		* workspaces; a session-menu delete targets one session by id, read from the
		* clicked row's React fiber (the row component's `node.id` prop) with a
		* store-based title match as fallback, since session ids never reach DOM
		* attributes.
		*
		* Export discipline (packages/client/AGENTS.md): the ./client entry exports
		* only `apply`/`inject` and shared types.
		*/
		/** Required services (cordis fiber inject). */
		const inject = ["remote"];
		function apply(ctx) {
			const mount = ctx.remote.$mount({
				package: "dsh-clear-session-history",
				descriptors: [...DESCRIPTORS]
			});
			mount.catch(() => {});
			/** Call one Remote method, surfacing mount/transport failures as outcomes. */
			const call = async (invoke) => {
				try {
					await mount;
					const namespace = ctx.get(`remote.${SERVICE}`);
					if (namespace === void 0) return {
						ok: false,
						error: "Clear Session History is unavailable — the remote is not mounted."
					};
					const result = await invoke(namespace);
					if (result.ok) return {
						ok: true,
						value: result.value
					};
					return {
						ok: false,
						error: `${result.error.message} (${result.error.code})`
					};
				} catch (error) {
					return {
						ok: false,
						error: error instanceof Error ? error.message : String(error)
					};
				}
			};
			/**
			* Resolve a session row to its id. The row's React fiber usually yielded
			* the exact id at arming time (`target.sessionId`); this store-based path
			* is the fallback. It mirrors the ui-workspace tree derivation's
			* visibility rule (a row renders only when its summary exists, it is not
			* archived, not subagent-origin, and not a blank session other than the
			* current one) and matches on the title the sidebar actually displays
			* (`displayTitle`, durable `title` as a last resort). Same-titled rows
			* disambiguate by `sameTitleIndex` over candidates in recency order — the
			* sidebar's default `updated` sort. A manually re-sorted sidebar can
			* defeat that index, which is why the fiber id comes first.
			*/
			const resolveSessionId = (target) => {
				if (target.sessionId !== void 0) return target.sessionId;
				const sessions = ctx.sessions;
				const workspaces = ctx.workspaces;
				const state = sessions?.list?.getSnapshot();
				const wsState = workspaces?.list?.getSnapshot();
				if (state === void 0 || wsState === void 0) return void 0;
				const archived = new Set(wsState.archivedSessionIds);
				const rowVisible = (id) => {
					const summary = state.byId[id];
					if (summary === void 0 || archived.has(id)) return false;
					if (summary.origin === "subagent") return false;
					return summary.blank !== true || id === state.current;
				};
				const shownTitle = (id) => {
					const summary = state.byId[id];
					return summary?.displayTitle ?? summary?.title;
				};
				const pick = (ids) => {
					const candidates = ids.filter((id) => rowVisible(id) && shownTitle(id) === target.sessionTitle);
					if (candidates.length === 1) return candidates[0];
					return [...candidates].sort((a, b) => {
						const delta = (state.byId[b]?.updatedAt ?? 0) - (state.byId[a]?.updatedAt ?? 0);
						return delta !== 0 ? delta : a < b ? -1 : 1;
					})[target.sameTitleIndex];
				};
				if (target.workspaceTitle === null) {
					const assigned = new Set(wsState.items.flatMap((workspace) => workspace.sessionIds));
					return pick(state.ids.filter((id) => !assigned.has(id)));
				}
				const sameTitle = wsState.items.filter((workspace) => workspace.title === target.workspaceTitle);
				const workspace = sameTitle[target.workspaceOccurrence] ?? sameTitle[0];
				if (workspace === void 0) return void 0;
				return pick(workspace.sessionIds);
			};
			const container = document.createElement("div");
			const root = (0, react_dom_client.createRoot)(container);
			const apiRef = { current: null };
			/** Repull the sidebar session list, best-effort, for partial clears. */
			const refreshSidebar = () => {
				ctx.sessions?.refresh?.()?.catch(() => {});
			};
			/** After a fully successful clear, reload the page. The host has no
			* "session deleted" push event to notify the sidebar, and the safest way to
			* guarantee both the session list and the workspace list reflect the
			* deletion is a fresh pull — the same outcome as the manual reload that
			* already verified the delete. */
			const reloadAfterClear = () => {
				window.location.reload();
			};
			const openDialog = (request) => {
				apiRef.current?.open(request);
			};
			const openSessionDialog = (target) => {
				const sessionId = resolveSessionId(target);
				openDialog({
					mode: "session",
					workspaceTitle: target.workspaceTitle ?? "",
					titleOccurrence: target.workspaceOccurrence,
					...sessionId === void 0 ? {} : { sessionId },
					sessionTitle: target.sessionTitle
				});
			};
			installSidebarIntegration({
				openDialog,
				openSessionDialog
			});
			root.render((0, react.createElement)(ClearHistoryDialog, {
				register: (api) => {
					apiRef.current = api;
				},
				onPreview: (mode, input) => mode === "session" ? call((ns) => ns.previewSession(input)) : call((ns) => ns.preview(input)),
				onClear: (mode, input) => mode === "session" ? call((ns) => ns.clearSession(input)) : call((ns) => ns.clear(input)),
				onSuccess: reloadAfterClear,
				onCleared: refreshSidebar
			}));
			ctx.effect(() => () => {
				root.unmount();
				container.remove();
			}, "clear-session-history: unmount dialog root");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map