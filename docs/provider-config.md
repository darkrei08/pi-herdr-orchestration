# Provider config

`scripts/provider-config.mjs` is the local, read-only contract for selecting repository providers. It validates wizard and local configuration snapshots, resolves the effective set, and projects the stable capability surface used by the orchestrator.

The validator does not contact GitHub, Gitea, Forgejo, Codeberg, GitLab, TaskView or Herdr. It accepts placeholder token references only and redacts them in output.

## Version

```text
provider-config/v1
```

## Stable capabilities

- `issues`
- `PR`
- `checks`
- `review`
- `webhook`
- `search`
- `writeback`

Native adapters are versioned behind this contract: `github/v1`, `github/v2`, `gitlab/v1`, `gitea/v1`, `forgejo/v1` and `codeberg/v1`.

## Input

```json
{
  "wizard": ["github", "gitea"],
  "providers": [
    {
      "provider": "github",
      "adapter": "github/v2",
      "url": "https://api.github.com",
      "token_ref": "env:GITHUB_TOKEN"
    },
    {
      "provider": "gitea",
      "adapter": "gitea/v1",
      "url": "https://gitea.example.com/api/v1",
      "token_ref": "env:GITEA_TOKEN"
    }
  ]
}
```

Rules:

- Local entries win over wizard selection, but the wizard snapshot is revalidated.
- Invalid configuration blocks activation.
- Unconfigured providers are skipped.
- Gitea, Forgejo and Codeberg require explicit URLs.
- Raw `token` values are rejected; only `env:`, `secret:` or `vault:` references are accepted.
- Each enabled provider exposes exactly the stable capability set.

## Commands

```bash
npm run taskmap:provider -- --input /tmp/providers.json --output /tmp/provider-projection.json
node scripts/provider-config.mjs --help
```

Success prints the output path and counts: `selected`, `skipped`, `blocked`, `events`, `status`, `activation`, `network=0`, `live_write=false` and `tokens=redacted`.

## Scope boundary

Fixture validation is not live activation. Real provider URLs, master tokens, native capability probes and wizard activation remain blocked by issue #111.
