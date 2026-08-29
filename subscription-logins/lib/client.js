window.__ModuleLoader__.load({
	id: "dsh-subscription-logins",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/OAuthSection.tsx
		const styles = {
			root: {
				display: "flex",
				flexDirection: "column",
				gap: "14px",
				padding: "18px 20px",
				maxWidth: "720px"
			},
			card: {
				display: "flex",
				flexDirection: "column",
				gap: "12px",
				padding: "16px",
				borderRadius: "10px",
				border: "1px solid var(--dsw-alias-border-l1)",
				background: "var(--dsw-alias-bg-layer-0)"
			},
			heading: {
				margin: 0,
				color: "var(--dsw-alias-label-primary)",
				fontSize: "16px",
				fontWeight: 600
			},
			copy: {
				margin: 0,
				color: "var(--dsw-alias-label-secondary)",
				fontSize: "13px",
				lineHeight: 1.5
			},
			status: {
				margin: 0,
				color: "var(--dsw-alias-label-primary)",
				fontSize: "13px",
				fontWeight: 600
			},
			error: {
				margin: 0,
				color: "var(--dsw-alias-state-error-primary)",
				fontSize: "13px",
				lineHeight: 1.45
			},
			actions: {
				display: "flex",
				flexWrap: "wrap",
				gap: "8px",
				alignItems: "center"
			},
			accountList: {
				display: "flex",
				flexDirection: "column",
				gap: "8px"
			},
			account: {
				display: "flex",
				flexWrap: "wrap",
				justifyContent: "space-between",
				gap: "10px",
				alignItems: "center",
				padding: "10px 12px",
				borderRadius: "8px",
				border: "1px solid var(--dsw-alias-border-l1)",
				background: "var(--dsw-alias-bg-layer-1)"
			},
			accountName: {
				color: "var(--dsw-alias-label-primary)",
				fontSize: "13px",
				fontWeight: 600
			},
			badge: {
				padding: "2px 7px",
				borderRadius: "999px",
				fontSize: "11px",
				color: "var(--dsw-alias-brand-text)",
				background: "var(--dsw-alias-bg-layer-2)"
			},
			primary: {
				border: 0,
				borderRadius: "7px",
				padding: "8px 14px",
				cursor: "pointer",
				fontSize: "13px",
				background: "var(--dsw-alias-button-primary-fill)",
				color: "var(--dsw-alias-label-primary-foreground)"
			},
			button: {
				border: "1px solid var(--dsw-alias-border-l2)",
				borderRadius: "7px",
				padding: "8px 14px",
				cursor: "pointer",
				fontSize: "13px",
				background: "var(--dsw-alias-bg-layer-2)",
				color: "var(--dsw-alias-label-primary)"
			},
			danger: {
				border: "1px solid var(--dsw-alias-state-error-primary)",
				borderRadius: "7px",
				padding: "8px 14px",
				cursor: "pointer",
				fontSize: "13px",
				background: "transparent",
				color: "var(--dsw-alias-state-error-primary)"
			},
			disabled: {
				opacity: .45,
				cursor: "not-allowed"
			},
			notice: {
				display: "flex",
				flexDirection: "column",
				gap: "8px",
				padding: "12px",
				borderRadius: "8px",
				background: "var(--dsw-alias-bg-layer-1)",
				border: "1px solid var(--dsw-alias-border-l1)"
			},
			code: {
				alignSelf: "flex-start",
				padding: "8px 12px",
				borderRadius: "7px",
				fontFamily: "ui-monospace, monospace",
				fontSize: "20px",
				letterSpacing: "0.08em",
				color: "var(--dsw-alias-label-primary)",
				background: "var(--dsw-alias-bg-layer-2)",
				border: "1px solid var(--dsw-alias-border-l2)"
			},
			link: {
				color: "var(--dsw-alias-brand-text)",
				fontSize: "13px"
			},
			input: {
				padding: "8px 10px",
				borderRadius: "7px",
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-1)",
				color: "var(--dsw-alias-label-primary)",
				fontSize: "13px"
			}
		};
		function Notice({ notice }) {
			const copyCode = () => {
				if (notice.code !== void 0) navigator.clipboard?.writeText(notice.code);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles.notice,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.copy,
						children: notice.message
					}),
					notice.url === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
						style: styles.link,
						href: notice.url,
						target: "_blank",
						rel: "noreferrer",
						children: "Open sign-in page"
					}),
					notice.code === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: styles.code,
						onClick: copyCode,
						title: "Copy code",
						children: notice.code
					})
				]
			});
		}
		function ProviderLoginCard(props) {
			const isAnthropic = props.provider === "anthropic";
			const isZai = props.provider === "zai";
			const [status, setStatus] = (0, react.useState)(null);
			const [polling, setPolling] = (0, react.useState)(false);
			const [notices, setNotices] = (0, react.useState)([]);
			const [prompt, setPrompt] = (0, react.useState)(null);
			const [answer, setAnswer] = (0, react.useState)("");
			const [accountName, setAccountName] = (0, react.useState)("");
			const [renaming, setRenaming] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [settlement, setSettlement] = (0, react.useState)(null);
			const refresh = (0, react.useCallback)(async () => {
				const result = await props.status({ provider: props.provider });
				if (!result.ok) {
					setError(result.error);
					return;
				}
				setStatus(result.value);
				if (result.value.inFlight) setPolling(true);
			}, [props.provider, props.status]);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			(0, react.useEffect)(() => {
				if (!polling) return;
				let disposed = false;
				let timer;
				const tick = async () => {
					const result = await props.poll({ provider: props.provider });
					if (disposed) return;
					if (!result.ok) {
						setError(result.error);
						setPolling(false);
						return;
					}
					if (result.value.notices.length > 0) setNotices((current) => [...current, ...result.value.notices]);
					setPrompt(result.value.prompt);
					if (result.value.settlement !== null) {
						setSettlement(result.value.settlement);
						setError(result.value.settlement === "failed" ? result.value.message ?? "Sign-in failed." : null);
						setPolling(false);
						refresh();
						return;
					}
					timer = window.setTimeout(() => {
						tick();
					}, 750);
				};
				tick();
				return () => {
					disposed = true;
					if (timer !== void 0) window.clearTimeout(timer);
				};
			}, [
				polling,
				props.poll,
				props.provider,
				refresh
			]);
			const begin = async () => {
				const label = accountName.trim();
				if (label === "") {
					setError("Enter a name for this login, such as Work or Personal.");
					return;
				}
				setBusy(true);
				setError(null);
				setSettlement(null);
				setNotices([]);
				setPrompt(null);
				const result = await props.begin({
					provider: props.provider,
					label
				});
				setBusy(false);
				if (!result.ok) {
					setError(result.error);
					return;
				}
				if (!result.value.ok) {
					setError(result.value.error);
					return;
				}
				setAccountName("");
				setPolling(true);
			};
			const submit = async (value) => {
				if (prompt === null) return;
				setBusy(true);
				const result = await props.answer({
					provider: props.provider,
					promptId: prompt.id,
					value
				});
				setBusy(false);
				if (!result.ok) {
					setError(result.error);
					return;
				}
				if (!result.value.ok) {
					setError(result.value.error);
					return;
				}
				setPrompt(null);
				setAnswer("");
			};
			const cancel = async () => {
				setBusy(true);
				const result = await props.cancel({ provider: props.provider });
				setBusy(false);
				if (!result.ok) setError(result.error);
				else if (!result.value.ok) setError(result.value.error);
			};
			const runAccountAction = async (action) => {
				setBusy(true);
				setError(null);
				const result = await action();
				setBusy(false);
				if (!result.ok) {
					setError(result.error);
					return false;
				}
				if (!result.value.ok) {
					setError(result.value.error);
					return false;
				}
				setSettlement(null);
				setNotices([]);
				await refresh();
				return true;
			};
			const activate = (accountId) => runAccountAction(() => props.activate({
				provider: props.provider,
				accountId
			}));
			const remove = async (accountId, label) => {
				if (!window.confirm(`Remove the saved login "${label}"? This deletes its stored provider credential.`)) return;
				await runAccountAction(() => props.remove({
					provider: props.provider,
					accountId
				}));
			};
			const rename = async () => {
				if (renaming === null) return;
				const label = renaming.label.trim();
				if (label === "") {
					setError("A login name cannot be empty.");
					return;
				}
				if (await runAccountAction(() => props.rename({
					provider: props.provider,
					accountId: renaming.id,
					label
				}))) setRenaming(null);
			};
			const disabled = busy || status === null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles.card,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						style: styles.heading,
						children: isZai ? "Z.AI Coding Plan" : isAnthropic ? "Claude account" : "ChatGPT subscription"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.copy,
						children: isZai ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							"Add the API key from your Z.AI account to use the ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: "zai" }),
							" provider with the GLM Coding Plan endpoint."
						] }) : isAnthropic ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							"Authorize the ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: "anthropic" }),
							" provider through Claude's browser OAuth flow. Claude may ask you to paste a callback URL or authorization code back here."
						] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							"Authorize the ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: "openai-codex" }),
							" provider with your ChatGPT subscription. This uses OpenAI's browser or device-code flow."
						] })
					}),
					isAnthropic ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.copy,
						children: "Anthropic says third-party tools should normally use API keys. OAuth access may be unavailable or charged against usage credits."
					}) : null,
					isZai ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.copy,
						children: "Z.AI uses API key authentication rather than browser OAuth. Create a key in the Z.AI API Keys page after subscribing."
					}) : null,
					isZai ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.copy,
						children: "Z.AI limits Coding Plan benefits to supported tools. Confirm that your use of DSH complies with the current plan terms."
					}) : null,
					status === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.status,
						children: "Checking sign-in status..."
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: styles.status,
							children: status.configured ? `Active: ${status.accounts.find((account) => account.active)?.label ?? status.label}` : `No active ${status.label} login`
						}),
						!status.available ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							style: styles.error,
							children: [
								"The installed llm-pi-ai package did not register the ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: props.provider }),
								" credential flow."
							]
						}) : null,
						status.accounts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: styles.copy,
							children: "No saved logins yet."
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: styles.accountList,
							children: status.accounts.map((account) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: styles.account,
								children: [renaming?.id === account.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
									style: styles.actions,
									onSubmit: (event) => {
										event.preventDefault();
										rename();
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											style: styles.input,
											maxLength: 40,
											value: renaming.label,
											onChange: (event) => {
												setRenaming({
													id: account.id,
													label: event.target.value
												});
											},
											autoFocus: true
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "submit",
											style: styles.primary,
											disabled: busy,
											children: "Save"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											style: styles.button,
											disabled: busy,
											onClick: () => {
												setRenaming(null);
											},
											children: "Cancel"
										})
									]
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: styles.actions,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: styles.accountName,
										children: account.label
									}), account.active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: styles.badge,
										children: "Active"
									}) : null]
								}), renaming?.id === account.id ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: styles.actions,
									children: [
										!account.active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											style: styles.button,
											disabled: busy || polling,
											onClick: () => {
												activate(account.id);
											},
											children: "Use"
										}) : null,
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											style: styles.button,
											disabled: busy || polling,
											onClick: () => {
												setRenaming({
													id: account.id,
													label: account.label
												});
											},
											children: "Rename"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											style: styles.danger,
											disabled: busy || polling,
											onClick: () => {
												remove(account.id, account.label);
											},
											children: "Remove"
										})
									]
								})]
							}, account.id))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
							style: styles.actions,
							onSubmit: (event) => {
								event.preventDefault();
								begin();
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									style: styles.input,
									maxLength: 40,
									placeholder: "Login name, e.g. Work",
									value: accountName,
									onChange: (event) => {
										setAccountName(event.target.value);
									},
									disabled: busy || polling || !status.available
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "submit",
									style: {
										...styles.primary,
										...disabled || !status.available || polling || accountName.trim() === "" ? styles.disabled : {}
									},
									disabled: disabled || !status.available || polling || accountName.trim() === "",
									children: "Add login"
								}),
								polling ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: {
										...styles.button,
										...busy ? styles.disabled : {}
									},
									disabled: busy,
									onClick: () => {
										cancel();
									},
									children: "Cancel sign-in"
								}) : null
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							style: styles.copy,
							children: [
								"Adding a login opens ",
								status.methodLabel,
								". Switching changes the account used by the next model request."
							]
						}),
						status.configured ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							style: styles.copy,
							children: [
								"The ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: props.provider }),
								" model provider is added automatically after sign-in. Choose one of its models for a session."
							]
						}) : null
					] }),
					notices.map((notice, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Notice, { notice }, `${index}-${notice.message}`)),
					prompt === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: styles.notice,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: styles.status,
							children: prompt.prompt.message
						}), prompt.prompt.kind === "select" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: styles.actions,
							children: prompt.prompt.options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: styles.button,
								disabled: busy,
								onClick: () => {
									submit(option.id);
								},
								title: option.description,
								children: option.label
							}, option.id))
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
							onSubmit: (event) => {
								event.preventDefault();
								submit(answer);
							},
							style: styles.actions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								style: styles.input,
								type: prompt.prompt.kind === "secret" ? "password" : "text",
								placeholder: prompt.prompt.placeholder,
								value: answer,
								onChange: (event) => {
									setAnswer(event.target.value);
								},
								autoFocus: true
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "submit",
								style: styles.primary,
								disabled: busy || answer === "",
								children: "Continue"
							})]
						})]
					}),
					settlement === "authorized" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						style: styles.status,
						children: [
							"Login saved and selected for ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: props.provider }),
							"."
						]
					}) : null,
					settlement === "cancelled" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.copy,
						children: "Sign-in cancelled."
					}) : null,
					error === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.error,
						children: error
					})
				]
			});
		}
		function OAuthSection(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles.root,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						style: styles.heading,
						children: "Subscription logins"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.copy,
						children: "Save named provider accounts and choose which one DSH uses. Tokens and API keys stay in DSH's credential store."
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderLoginCard, {
						...props,
						provider: "openai-codex"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderLoginCard, {
						...props,
						provider: "anthropic"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderLoginCard, {
						...props,
						provider: "zai"
					})
				]
			});
		}
		//#endregion
		//#region src/shared/remote.ts
		const SERVICE = "subscriptionOAuth";
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
		//#region src/client/index.ts
		const inject = ["slots", "remote"];
		function apply(ctx) {
			const mount = ctx.remote.$mount({
				package: "dsh-subscription-logins",
				descriptors: [...DESCRIPTORS]
			});
			mount.catch(() => {});
			const call = async (invoke) => {
				try {
					await mount;
					const namespace = ctx.get(`remote.${SERVICE}`);
					if (namespace === void 0) return {
						ok: false,
						error: "Subscription login is unavailable."
					};
					const result = await invoke(namespace);
					return result.ok ? {
						ok: true,
						value: result.value
					} : {
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
			const injected = () => ({
				status: (input) => call((namespace) => namespace.status(input)),
				begin: (input) => call((namespace) => namespace.begin(input)),
				poll: (input) => call((namespace) => namespace.poll(input)),
				answer: (input) => call((namespace) => namespace.answer(input)),
				cancel: (input) => call((namespace) => namespace.cancel(input)),
				activate: (input) => call((namespace) => namespace.selectLogin(input)),
				remove: (input) => call((namespace) => namespace.deleteLogin(input)),
				rename: (input) => call((namespace) => namespace.renameLogin(input))
			});
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "subscription-logins",
				order: 11,
				label: "Logins",
				inject: injected
			}, OAuthSection));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map