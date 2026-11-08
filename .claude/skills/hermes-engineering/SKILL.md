---
name: hermes-engineering
description: Use when writing, fixing, refactoring, reviewing, or testing code in hermes-agent (Python core, gateway, tools, CLI, tui_gateway, desktop TypeScript), or before opening a PR or commit for this repo.
---

# Hermes Engineering

## Overview
Senior-engineer workflow for hermes-agent. The root `AGENTS.md` is the law; this skill is the order of operations. Two invariants drive every review: **prompt caching is sacred** (never mutate past context, swap toolsets, or rebuild the system prompt mid-conversation) and **the core is a narrow waist** (new capability goes to the edges).

## Workflow
1. **Route first.** Read the `AGENTS.md` of the area you are touching (routing table in root `AGENTS.md`: `agent/`, `hermes_cli/`, `gateway/`, `tools/`, `plugins/`, `tui_gateway/`, `apps/desktop/`, `cron/`, `skills/`, `tests/`, `pm/`, `hermes_platform/`).
2. **Verify it is a bug** before fixing: reproduce on `main`, find the exact line, check intent with `git log -p -S "<symbol>"`. Profiles being islands is by design.
3. **Climb the footprint ladder, take the highest rung that works:** extend existing code → CLI command + skill → service-gated tool → plugin → MCP server → new core tool (last resort).
4. **Find code by topic, not by reading facades:** `grep -rn "def name" <dir>/<stem>_*.py`. Facades hold entry points; behavior goes in siblings. Siblings late-import the facade.
5. **Test first** (superpowers:test-driven-development): 1–2 behavior-contract tests per fix, red on the base. Run via `scripts/run_tests.sh`, never bare `pytest`. No change-detector or source-reading tests.
6. **Gate:** `python scripts/check` before pushing (CC ≤ 20, ≤ 300 lines/function, nesting ≤ 6, files ≤ 2,000 lines).

## Quick Reference
| Situation | Do |
|---|---|
| Path to user state | `get_hermes_home()` / `display_hermes_home()`, never `~/.hermes` |
| Code outside a turn (tickers, RPC, thread hops) | Bind profile scope explicitly (`gateway/AGENTS.md` § Profile scope) |
| Process identity | `gateway.status.looks_like_gateway_command_line`, never argv substrings |
| Machine facts / finding executables | `hermes_platform` |
| Non-secret config | `config.yaml`, not a new `HERMES_*` env var |
| Dependency change | upper bound, `hermes pm lock`, commit `uv.lock` |
| Slash command changing system prompt | defer to next session, opt-in `--now` |
| Moved a symbol | fix docs/`AGENTS.md`/skills references in the same PR; no re-export shims |

## Common Mistakes
- Patching the defining module when production reads through the facade (patch where it is read).
- `try/except: pass` around code that cannot fail; flags nobody sets; comments restating WHAT.
- Faking `sys.platform` in tests instead of `@pytest.mark.platforms(...)`.
- Squash-merging from a stale branch: rebase on `main` first.
- Security finding (SECURITY.md §3.1) in a public issue/PR: it goes private.
- Reaching for a new core tool when terminal + file tools or a skill already does it.

## Red Flags: stop
"Just one more tool in core", "I'll hardcode the path for now", "a bare pytest is faster", "the test would only read the source". Each means go back to the footprint ladder or the test rules.
