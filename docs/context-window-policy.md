# Context window policy

Effective ceiling: **300,000 tokens**. Compaction is triggered at **276,000 tokens** for models whose window is larger than the ceiling; smaller windows keep their natural trigger.

## Why `modelOverrides`

Pi triggers compaction with `contextTokens > contextWindow - reserveTokens` (`pi-coding-agent/dist/core/compaction.js`). `modelOverrides` is the stable lever: gateway catalog refreshes rewrite `models.json`/`cliproxyapi-models.json`, but do not remove per-model compaction overrides.

The parent session and workflow children resolve the same agent settings directory (`pi-extensible-workflows/packages/core/src/agent-execution.ts:157-159`), so one override set applies to both.

## Configured reserves

| Window | Reserve | Trigger |
| --- | ---: | ---: |
| 1,048,576 | 772,576 | 276,000 |
| 500,000 | 224,000 | 276,000 |
| 272,000 or smaller | 16,384 default | 255,616 or natural window |

Applied to:

- `/root/git/personale/pi.dev/dotenv/pi/agent/settings.json` (source of truth)
- `/root/.pi/agent/settings.json` (live runtime)
- `config/context-window.json` in this repository and in `pi-extensible-workflows`

## Verification

```bash
npm run check:context-window -- --settings /root/.pi/agent/settings.json
npm run check:context-window -- --settings /root/git/personale/pi.dev/dotenv/pi/agent/settings.json
```

Both commands print one trigger per model and exit non-zero if any trigger exceeds 300,000 or if the policy scope does not cover `orchestrator` and `child`.
