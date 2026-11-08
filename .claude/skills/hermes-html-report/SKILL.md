---
name: hermes-html-report
description: Use when Marvin asks for an HTML report, a visual page, an HTML choices or decision page, a status picture, or says html report, htmlreport, or "help me decide" for Hermes work.
---

# Hermes HTML report

## Top rule: Haiku only

A subagent on **Haiku**, the lowest model, writes the HTML. No exception.

- Agent tool: `subagent_type` `general-purpose`, `model` `haiku`, `effort` `low`.
- Never `sonnet`, `opus`, `fable`, or the parent's own model. Never omit `model` (it would inherit the parent).
- The parent does not write or edit the HTML. If the page is wrong, send Haiku the fix list again.
- If `haiku` is refused or unavailable, stop and tell Marvin. Do not fall back to a bigger model.

Writing HTML is encoding, not thinking. The parent does the thinking first.

## Steps

1. Parent gathers facts (git, file paths, search results, test output) and picks the path `.claude/reports/YYYY-MM-DD-<slug>.html`.
2. Parent launches one Haiku subagent. Prompt contains: the facts, the output path, this skill's `template.html` path, and the page rules below. The subagent copies the template, fills it, writes that one file. It does not investigate, commit, or push.
3. Parent opens the file (Browser pane or `open_in_editor`). Chat gets the path plus one sentence.

## Page rules

- One file. CSS and JS inline. No network, no CDN, no web fonts, no external images. No secrets, tokens, or user data.
- Dark only. No light theme, no toggle, no `prefers-color-scheme`.
- Page text is short and direct: answer first, about 20 words per sentence, lists over paragraphs. Paths, hashes, commands, and numbers stay exact, in `code`.
- Anything not from git, a file, or a named command is labeled **assumption**.
- Empty section: write "None" and why. Delete unused example cards.

## Choices page

Use when the page exists so Marvin can pick. `template.html` already has the behavior. Do not redesign it.

- Each option is a `<button type="button">`. One click marks it `.sel` and clears the others on that question.
- Each question has an **Other** button and a text box.
- Picks save in `localStorage` under `hermes-decide:` plus the file name.
- `pre#decide-json` shows `{ "page", "at", "answers": { "<id>": { "choice", "other" } } }` and updates on every click and keystroke.
- **Copy JSON** (`#decide-copy`) copies it. Marvin pastes it in chat. Never invent his picks.
- Put the recommended option first and mark it `(recommended)`.

## Common mistakes

- Parent writes the HTML "to save a step". Break of the top rule.
- Subagent call without `model: haiku`.
- Adding a light theme or a CDN font.
- Haiku asked to decide or research. Give it finished facts only.
