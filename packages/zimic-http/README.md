<p align="center">
  <img src="../../docs/zimic.png" align="center" width="100px" height="100px">
</p>

<h1 align="center">
  @zimic/http
</h1>

<p align="center">
  Next-gen TypeScript-first HTTP utilities
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@zimic/http">npm</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://zimic.dev">Docs</a>
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

[![NPM Downloads - @zimic/http](https://img.shields.io/npm/dm/@zimic/http?style=flat&logo=npm&color=0E69BE&label=%20%40zimic%2Fhttp&labelColor=353C43)](https://www.npmjs.com/package/@zimic/http)&nbsp;
[![Bundle size - @zimic/http](https://badgen.net/bundlephobia/minzip/@zimic/http?color=0E69BE&labelColor=353C43&label=@zimic/http%20min%20gzip)](https://bundlephobia.com/package/@zimic/http)<br />

</div>

---

`@zimic/http` is a collection of type-safe utilities to handle HTTP requests and responses, including headers, search
params, and form data.

Status: :seedling: **Beta**

## Features

- :star: **HTTP schemas**

  Declare the structure of your endpoints in an [HTTP schema](https://zimic.dev/docs/http/guides/schemas) and use it to
  type your HTTP requests and responses.

- :bulb: **Type generation**

  Infer the types from [OpenAPI](https://www.openapis.org/) documentation and generate ready-to-use HTTP schemas with
  our [typegen CLI](https://zimic.dev/docs/http/guides/typegen).

- :pushpin: **Type-safe APIs**

  Declare typed [`Headers`](https://zimic.dev/docs/http/api/http-headers),
  [`URLSearchParams`](https://zimic.dev/docs/http/api/http-search-params), and
  [`FormData`](https://zimic.dev/docs/http/api/http-form-data) objects, fully compatible with their native counterparts.

**Learn more**:

- [`@zimic/http` - Getting started](https://zimic.dev/docs/http/getting-started)
- [`@zimic/http` - Guides](https://zimic.dev/docs/http/guides)
- [`@zimic/http` - API](https://zimic.dev/docs/http/api)
- [`@zimic/http` - CLI](https://zimic.dev/docs/http/cli)
