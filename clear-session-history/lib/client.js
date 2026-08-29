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
		function ClearHistoryDialog({ register, onPreview, onClear, onCleared }) {
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
					const input = {
						workspaceTitle: next.mode === "workspace" ? next.workspaceTitle : "",
						titleOccurrence: next.titleOccurrence
					};
					const ticket = generation.current;
					onPreview(input).then((outcome) => {
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
			const scopeLabel = request.mode === "workspace" ? `"${request.workspaceTitle}"` : "every workspace";
			const previewPending = preview === null;
			const previewError = preview === null ? null : !preview.ok ? preview.error : !preview.value.ok ? preview.value.error : null;
			const previewFailed = previewError !== null;
			const nothingToDelete = !previewPending && !previewFailed && counts.targets === 0;
			const description = (() => {
				if (previewFailed) return `Could not count the session logs on disk: ${previewError ?? "unknown error"}`;
				if (previewPending) return "Counting the session logs stored on disk…";
				if (nothingToDelete) return `No session logs were found on disk for ${scopeLabel}. There is nothing to delete.`;
				const noun = counts.targets === 1 ? "session log" : "session logs";
				const keptNote = counts.kept > 0 ? ` Sessions that are currently open (and their running subagents) are kept: ${counts.kept}.` : " Sessions that are currently open are kept.";
				return `This permanently deletes ${counts.targets} ${noun} from disk for ${scopeLabel}.${keptNote}`;
			})();
			const confirmLabel = previewPending || previewFailed ? "Delete" : counts.targets === 1 ? "Delete 1 session log" : `Delete ${counts.targets} session logs`;
			const confirm = () => {
				if (busy || request === null) return;
				setBusy(true);
				setFailure(null);
				onClear({
					workspaceTitle: request.mode === "workspace" ? request.workspaceTitle : "",
					titleOccurrence: request.titleOccurrence
				}).then((outcome) => {
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
						setResult(`Deleted ${counts.deleted} of ${counts.targets} session logs. The rest could not be resolved to safe on-disk directories.`);
						onCleared();
						return;
					}
					onCleared();
					close();
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.RiskConfirmation, {
				open: true,
				title: request.mode === "workspace" ? "Clear session history" : "Clear all session history",
				description: failure !== null ? `Delete failed: ${failure}` : result !== null ? result : description,
				acknowledgeLabel: nothingToDelete || previewPending || previewFailed ? "I understand this action deletes session logs from disk." : counts.targets === 1 ? "I understand this 1 session log will be permanently deleted from disk." : `I understand these ${counts.targets} session logs will be permanently deleted from disk.`,
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
		* the pointerdown on a workspace row's menu anchor. */
		const MENU_ARM_MS = 5e3;
		const WORKSPACE_ARIA_EN_PREFIX = "Workspace actions for ";
		const WORKSPACE_ARIA_ZH = /^工作区“(.*)”的操作$/;
		const RENAME_LABELS = /* @__PURE__ */ new Set(["Rename", "重命名"]);
		const DELETE_LABELS = /* @__PURE__ */ new Set(["Delete workspace", "删除工作区"]);
		const NEW_SESSION_ARIA = /* @__PURE__ */ new Set(["New session", "新建会话"]);
		const NEW_SESSION_TEXT = /* @__PURE__ */ new Set(["New Session", "新会话"]);
		const MENU_ITEM_LABEL = {
			en: "Clear session history",
			zh: "清空会话记录"
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
		const itemText = (button) => (button.textContent ?? "").trim();
		function installSidebarIntegration(options) {
			/** The workspace row whose menu anchor was clicked most recently. */
			let armed = null;
			const armFromEvent = (target) => {
				const button = target.closest("button[aria-label]");
				if (button === null) return;
				const title = workspaceTitleOf(button.getAttribute("aria-label") ?? "");
				if (title === void 0) return;
				const same = [...document.querySelectorAll("button[aria-label]")].filter((candidate) => workspaceTitleOf(candidate.getAttribute("aria-label") ?? "") === title);
				armed = {
					title,
					titleOccurrence: Math.max(0, same.indexOf(button)),
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
			const augmentMenu = (menu) => {
				if (menu.querySelector("[data-dsh-clear-history]") !== null) return;
				const buttons = [...menu.querySelectorAll("button[role=\"menuitem\"]")];
				const deleteRow = buttons.find((button) => DELETE_LABELS.has(itemText(button)));
				if (deleteRow === void 0) return;
				if (!buttons.some((button) => RENAME_LABELS.has(itemText(button)))) return;
				if (armed === null || Date.now() - armed.at > MENU_ARM_MS) return;
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
				cloneButton.dataset.clearHistory = "true";
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
			style.textContent = ["[data-dsh-clear-all], [data-dsh-clear-all] span { color: var(--dsw-alias-state-error-primary) !important; }", "[data-dsh-clear-all]:hover, [data-dsh-clear-all]:hover span { color: var(--dsw-alias-state-error-secondary) !important; }"].join("\n");
			document.head.appendChild(style);
			const syncButton = () => {
				const anchor = [...document.querySelectorAll("button[aria-label]")].filter((button) => NEW_SESSION_ARIA.has(button.getAttribute("aria-label") ?? ""))[0] ?? null;
				const wide = anchor !== null && [...anchor.querySelectorAll("span")].some((span) => NEW_SESSION_TEXT.has((span.textContent ?? "").trim()));
				const existing = document.querySelector("[data-dsh-clear-all]");
				if (anchor === null || !wide) {
					existing?.remove();
					return;
				}
				if (existing !== null && anchor.nextElementSibling === existing) return;
				const locale = [...anchor.querySelectorAll("span")].some((span) => (span.textContent ?? "").trim() === "新会话") ? "zh" : "en";
				const button = existing ?? anchor.cloneNode(true);
				button.dataset.clearAll = "true";
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
		//#region src/client/index.ts
		/**
		* Browser half of the Clear Session History plugin.
		*
		* Registers no slots: the two affordances live on existing sidebar surfaces
		* (see ./augment.ts). This entry mounts the plugin's Remote namespace, hosts
		* the confirm dialog on its own React root, and wires the three sides
		* together — augmentation clicks open the dialog, the dialog calls the host
		* through the Remote, and a successful clear repulls the sidebar's session
		* list so the deleted rows disappear immediately.
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
			const call = async (method, input) => {
				try {
					await mount;
					const namespace = ctx.get(`remote.${SERVICE}`);
					if (namespace === void 0) return {
						ok: false,
						error: "Clear Session History is unavailable — the remote is not mounted."
					};
					const result = await method(namespace)(input);
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
			const container = document.createElement("div");
			const root = (0, react_dom_client.createRoot)(container);
			const apiRef = { current: null };
			/** Repull the sidebar session list after a clear. The runtime exposes the
			* refresh on the concrete face but not on the ISessions interface, so the
			* call is duck-typed and simply skipped when absent. */
			const refreshSidebar = () => {
				ctx.sessions?.refresh?.()?.catch(() => {});
			};
			installSidebarIntegration({ openDialog: (request) => {
				apiRef.current?.open(request);
			} });
			root.render((0, react.createElement)(ClearHistoryDialog, {
				register: (api) => {
					apiRef.current = api;
				},
				onPreview: (input) => call((ns) => ns.preview, input),
				onClear: (input) => call((ns) => ns.clear, input),
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