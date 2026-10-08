# Repository Guidelines

- Keep changes narrowly scoped to the requested repository behavior.
- Preserve unrelated user changes, untracked files, hooks, and local configuration.
- Prefer Node.js standard-library APIs and existing dependencies; avoid unnecessary additions.
- Keep code, comments, tests, and repository documentation in English.
- Run the documented checks relevant to each change and report blocked checks honestly.
- Do not commit, push, merge, or publish without explicit authorization.

<!-- BEGIN sqz-agents-guidance (auto-installed by sqz init; remove this block to disable) -->

## sqz — Token-Optimized CLI Output

When running shell commands whose output may be long (directory listings,
git log/diff, test runners, build logs, `docker ps`, `kubectl get`, etc.),
pipe the output through `sqz compress` to reduce token consumption.

`sqz` is a stdin-to-stdout compressor, not a command wrapper. The correct
usage is to pipe the command's output into `sqz compress`:

```bash
# Instead of:     Use:
git status        git status 2>&1 | /usr/local/bin/sqz compress
cargo test        cargo test 2>&1 | /usr/local/bin/sqz compress
git log -10       git log -10 2>&1 | /usr/local/bin/sqz compress
docker ps         docker ps 2>&1 | /usr/local/bin/sqz compress
ls -la            ls -la 2>&1 | /usr/local/bin/sqz compress
```

The `2>&1` captures stderr too, which is useful for commands like `cargo
test` where diagnostics go to stderr. `sqz compress` filters and compresses
the combined output while preserving filenames, paths, and identifiers.
It typically saves 60-90% tokens on verbose commands.

Do NOT pipe output for:
- Interactive commands (`vim`, `ssh`, `python`, REPLs)
- Compound commands with shell operators (`cmd && other`, `cmd > file.txt`,
  `cmd; other`) — run those directly
- Short commands whose output is already a few lines

If `sqz` is not on PATH, run commands normally.

The `sqz-mcp` MCP server is also available — Codex reads it from
`~/.codex/config.toml` under `[mcp_servers.sqz]`. It exposes
`compress` (the default pipeline), `passthrough` (return text
unchanged — the escape hatch below), `expand` (resolve a
`§ref:HASH§` token back to the original bytes), `sqz_recall`
(full-text search over everything sqz has compressed — recover
context lost to compaction), and `sqz_read_file` / `sqz_grep` /
`sqz_list_dir` (file access with a dedup cache: a repeat read of an
unchanged file costs ~13 tokens, and a ranged re-read via `offset` /
`limit` of a file you already have in full returns a
`§ref:HASH:L40-80§` line-range reference). Prefer those three over
`cat`, `grep` and `ls` for anything you might read more than once.

## Escape hatch — when sqz output confuses you

If you see a `§ref:HASH§` token and can't parse it, or compressed
output is leading you to make lots of small retries instead of one
big request, use one of these:

- **`/usr/local/bin/sqz expand <prefix>`** — resolve a dedup ref back to the
  original bytes. Accepts bare hex (`sqz expand a1b2c3d4`) or the full
  token pasted verbatim (`sqz expand §ref:a1b2c3d4§`).
- **`SQZ_NO_DEDUP=1`** — set this env var for one command to disable
  dedup: `SQZ_NO_DEDUP=1 git status 2>&1 | sqz compress`. You'll get
  the full compressed output with no `§ref:…§` tokens.
- **`--no-cache`** — same opt-out as a CLI flag:
  `git status 2>&1 | sqz compress --no-cache`.
- **`SQZ_NO_ABBREV=1`** (or **`--no-abbrev`**) — disable n-gram phrase
  abbreviation, which rewrites repeated phrases to `«A1»` symbols and
  keeps only the first occurrence. Use it when output is full of
  SHAs/paths/URLs you'll copy-paste verbatim:
  `SQZ_NO_ABBREV=1 git log 2>&1 | sqz compress`.

If you're using the MCP server, the `passthrough` tool returns raw
text and the `expand` tool resolves refs — call them when you need
data sqz hasn't touched.

<!-- END sqz-agents-guidance -->

<!-- BEGIN sqz-zed-guidance (auto-installed by sqz init; remove this block to disable) -->

## sqz — Token-Optimized Output (Zed Agent)

When running terminal commands whose output may be long (git log/diff,
test runners, build logs, `ls -la`, `docker ps`), pipe the output
through `sqz compress` to cut token consumption:

```bash
git status 2>&1 | /usr/local/bin/sqz compress
cargo test 2>&1 | /usr/local/bin/sqz compress
```

Do NOT pipe interactive commands (REPLs, `ssh`), compound commands with
shell operators (`&&`, `>`, `;`), or output that is already short.

The `sqz` MCP server is registered in Zed's `settings.json` under
`context_servers`. Prefer its tools when they fit:

- `sqz_read_file` / `sqz_grep` / `sqz_list_dir` — file access with
  caching; repeat reads of unchanged content cost ~13 tokens.
- `compress` — compress a blob of text you already have.
- `passthrough` — return text unchanged (escape hatch).
- `expand` — resolve a `§ref:HASH§` token back to the original bytes.
  `§ref:HASH:L40-80§` means lines 40-80 of content you already have in
  full; `expand` on it returns just those lines.
- `sqz_recall` — full-text search over everything sqz has compressed
  (recover context lost to compaction).

If you see a `§ref:HASH§` token you can't parse, run
`/usr/local/bin/sqz expand <prefix>` or set `SQZ_NO_DEDUP=1` on the command.
If a `«A1»` symbol replaced a value you need verbatim, re-run with
`SQZ_NO_ABBREV=1` (or `--no-abbrev`).

<!-- END sqz-zed-guidance -->
