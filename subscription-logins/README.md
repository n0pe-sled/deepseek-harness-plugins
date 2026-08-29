# dsh-subscription-logins

Manage subscription credentials for DSH's `openai-codex`, `anthropic`, and `zai` providers. The plugin adds a short **Logins** entry beside Models in Settings and drives the provider flows supplied by pi-ai.

This is a pure bundle plugin. It does not patch DeepSeek Harness. Its composition layer mounts the published `@deepseek-ai/dsh-authorization` service, which causes the existing `llm-pi-ai` plugin to register its provider login flows. The plugin's host half exposes only the `openai-codex`, `anthropic`, and `zai` flows to its own browser half through a Typert Remote.

## Install

```bash
dsh plugin --profile web add /path/to/deepseek-harness-plugins/subscription-logins
```

Restart `dsh web`, then open **Settings → Logins**. Name each login as you add it, for example `Work` or `Personal`. The page keeps multiple credentials per provider and marks one active. Select **Use** to change the account used by the next model request.

- For ChatGPT, select **Sign in with ChatGPT**, open the verification page, and enter the displayed code if OpenAI uses the device-code path.
- For Claude, select **Sign in with Claude**, finish the browser flow, and paste the callback URL or authorization code if requested.
- For Z.AI, create an API key after subscribing to the GLM Coding Plan, then enter it in the masked prompt. Z.AI uses API keys rather than browser OAuth.

The `zai` route uses pi-ai's dedicated Coding Plan endpoint, `https://api.z.ai/api/coding/paas/v4`. Z.AI says Coding Plan benefits are limited to supported tools and products. Confirm that DSH usage complies with the current [GLM Coding Plan usage policy](https://docs.z.ai/devpack/usage-policy) before relying on subscription quota. See Z.AI's [Coding Plan quick start](https://docs.z.ai/devpack/quick-start) for API key setup.

The Claude option exposes pi-ai's existing Anthropic OAuth flow, but it does not promise that requests will be included in a Claude Pro or Max subscription. Anthropic's published login policy says third-party tools should normally use API keys. It may restrict OAuth access or charge usage credits. See [Anthropic's account login policy](https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account).

OpenAI currently labels device-code authentication as beta. If it is unavailable, enable device-code login in your personal ChatGPT security settings or ask your workspace admin to allow it. A normal browser callback flow may be offered instead.

After login, the plugin adds the matching `openai-codex`, `anthropic`, or `zai` provider to **Settings → Models** with an empty native profile. Existing provider settings are never replaced. Choose one of that provider's models for a session.

The adapter still reads its canonical `llm-pi-ai/<provider>` record. The plugin archives named credentials under its own credential scope and copies the selected credential into that canonical record. Before switching, it saves the current canonical record back to the active archive so token refreshes survive account changes. An existing canonical credential is imported as `Existing login` and can be renamed.

Removing a saved login deletes its archived credential. Removing the active login also deletes the provider's canonical record. These records contain sensitive access tokens, refresh tokens, and API keys. Protect the DSH home directory, and never commit or share its credential files.

## Why this is a separate Settings page

The public client extension API has a `settings.section` slot, but the built-in Models page does not declare a slot inside provider cards. Registering a neighboring page uses the supported plugin API and survives client rebuilds. Modifying `ProviderEditor` or the host API proxy would put part of the feature back into harness core.

## Development

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm test
```

The built node and browser files under `lib/` are committed so local and tarball installs do not need a build step.
