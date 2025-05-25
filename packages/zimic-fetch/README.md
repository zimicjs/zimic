<p align="center">
  <img src="../../docs/zimic.png" align="center" width="100px" height="100px">
</p>

<h1 align="center">
  @zimic/fetch
</h1>

<p align="center">
  Next-gen TypeScript-first fetch API client
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@zimic/fetch">npm</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/zimicjs/zimic/wiki">Docs</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://zimic.dev/docs/examples">Examples</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/zimicjs/zimic/issues">Issues</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/orgs/zimicjs/projects/1/views/4">Roadmap</a>
</p>

<div align="center">

[![CI](https://github.com/zimicjs/zimic/actions/workflows/ci.yaml/badge.svg?branch=canary)](https://github.com/zimicjs/zimic/actions/workflows/ci.yaml)&nbsp;
[![Coverage](https://img.shields.io/badge/Coverage-100%25-31C654?labelColor=353C43)](https://github.com/zimicjs/zimic/actions)&nbsp;
[![License](https://img.shields.io/github/license/zimicjs/zimic?color=0E69BE&label=License&labelColor=353C43)](https://github.com/zimicjs/zimic/blob/canary/LICENSE.md)&nbsp;
[![Stars](https://img.shields.io/github/stars/zimicjs/zimic)](https://github.com/zimicjs/zimic)

[![NPM Downloads - @zimic/fetch](https://img.shields.io/npm/dm/@zimic/fetch?style=flat&logo=npm&color=0E69BE&label=%20%40zimic%2Ffetch&labelColor=353C43)](https://www.npmjs.com/package/@zimic/fetch)&nbsp;
[![Bundle size - @zimic/fetch](https://badgen.net/bundlephobia/minzip/@zimic/fetch?color=0E69BE&labelColor=353C43&label=@zimic/fetch%20min%20gzip)](https://bundlephobia.com/package/@zimic/fetch)<br />

</div>

---

`@zimic/fetch` is a minimal (~2 kB minified and gzipped) and type-safe `fetch`-like API client.

Status: :seedling: **Beta**

## Features

- :zap: **Type-safe `fetch`**

  Use your [`@zimic/http` schema](https://zimic.dev/docs/http/guides/schemas) to create a type-safe
  [`fetch`-like](https://developer.mozilla.org/docs/Web/API/Fetch_API) API client and have your requests and responses
  fully typed by default.

- :sparkles: **Zero dependencies**

  `@zimic/fetch` has no external dependencies, making it a lightweight and fast alternative to other HTTP clients.

- :muscle: **Developer experience**

  Define default options to apply to your requests, such as a base URL, headers, search parameters, and more. Inspect
  and modify requests and responses using [`onRequest`](https://zimic.dev/docs/fetch/api/fetch#onrequest) and
  [`onResponse`](https://zimic.dev/docs/fetch/api/fetch#onresponse) listeners.

**Learn more**:

- [`@zimic/fetch` - Getting started](https://zimic.dev/docs/fetch/getting-started)
- [`@zimic/fetch` - Guides](https://zimic.dev/docs/fetch/guides)
- [`@zimic/fetch` - API](https://zimic.dev/docs/fetch/api)
