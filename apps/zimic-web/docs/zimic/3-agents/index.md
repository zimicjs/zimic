---
title: Coding agents
sidebar_label: Coding agents
slug: /agents
---

# Coding agents

Coding agents can read the Zimic documentation through [Context7](https://context7.com). Context7 is an MCP server that serves the documentation of a library to agents such as Claude Code, Cursor, and GitHub Copilot.

## Using Context7

Context7 serves the current documentation of all Zimic packages, along with rules for common mistakes.

Install the Context7 MCP server in your agent by following the [Context7 installation guide](https://github.com/upstash/context7). Then, add this instruction to the project instructions of your agent, such as `AGENTS.md` or `CLAUDE.md`:

```md
Use Context7 with /zimicjs/zimic for Zimic documentation.
```
