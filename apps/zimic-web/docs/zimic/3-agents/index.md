---
title: Coding agents
sidebar_label: Coding agents
slug: /agents
---

# Coding agents

Coding agents can read the Zimic documentation through [Context7](https://context7.com). Context7 is an MCP server that serves the documentation of a library to agents such as Claude Code, Cursor, and GitHub Copilot.

## Using Context7

Install the Context7 MCP server in your agent by following the [Context7 installation guide](https://github.com/upstash/context7). Then, ask your agent to use the Zimic library, `/zimicjs/zimic`:

```txt
Mock the users API in this test with @zimic/interceptor. use context7 with /zimicjs/zimic
```

Context7 serves the current documentation of all Zimic packages, along with rules for common mistakes, such as reading saved requests instead of using [declarative assertions](/docs/zimic-interceptor/guides/http/7-declarative-assertions.mdx).

To use Context7 without asking every time, add an instruction to the project instructions of your agent, such as `AGENTS.md` or `CLAUDE.md`:

```md
Use Context7 with /zimicjs/zimic for Zimic documentation.
```
