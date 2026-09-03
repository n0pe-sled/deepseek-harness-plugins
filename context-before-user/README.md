# dsh-context-before-user

Host-only DeepSeek Harness plugin that keeps injected user-role context ahead
of the current human turn. At the public `agent/pre-step` waterfall it awaits
the normal DSH injectors, then stable-partitions the entering messages:

The resulting provider-visible order is:

```text
system: assembled system prompt
...conversation history...
user: runtime-context snapshot
user: workspace instructions and skill catalog/instructions
user: current human request
```

The partition uses trusted provenance: messages with `source.kind === "user"`
stay in their original order at the end, and all other step messages stay in
their original order before them. Skill catalogs remain durable user-role
context turns. The system prompt is neither copied nor wrapped in a
`<system-reminder>`; it remains solely in `request/header.system` and the
provider's system slot.

The plugin uses `agent/pre-step` because loop-built `llm/stream` requests are
deep-frozen. Reordering here remains model-visible and logged, preserving exact
request reconstruction.

Existing durable history is never rewritten. The plugin fixes newly entering
step messages, so start a fresh session when validating the complete initial
transcript order.

## Install

```bash
dsh plugin --profile web add ./context-before-user
```

Restart the profile after installation.

## Verify

```bash
npm test
```

For an end-to-end check, export a harmless test session and confirm that the
runtime snapshot and skill catalog remain separate user-role messages before
the actual human request, and that the assembled system prompt appears only in
the request header/system slot.
