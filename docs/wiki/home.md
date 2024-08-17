# Contents <!-- omit from toc -->

- [Introduction](#introduction)
  - [Features](#features)
  - [What is Zimic for?](#what-is-zimic-for)
  - [How does Zimic work?](#how-does-zimic-work)
  - [Documentation](#documentation)
  - [Examples](#examples)
  - [Changelog](#changelog)

---

# Introduction

<p align="center">
  <img src="../zimic.png" align="center" width="100px" height="100px">
</p>

<h1 align="center">
  Zimic
</h1>

<p align="center">
  TypeScript-first HTTP request mocking
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/zimic">npm</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/zimicjs/zimic/wiki">Docs</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/zimicjs/zimic/wiki/examples">Examples</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/zimicjs/zimic/issues">Issues</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/orgs/zimicjs/projects/1/views/5">Roadmap</a>
</p>

<div align="center">

[![CI](https://github.com/zimicjs/zimic/actions/workflows/ci.yaml/badge.svg?branch=canary)](https://github.com/zimicjs/zimic/actions/workflows/ci.yaml)&nbsp;
[![Coverage](https://img.shields.io/badge/Coverage-100%25-31C654?labelColor=353C43)](https://github.com/zimicjs/zimic/actions)&nbsp;
[![License](https://img.shields.io/github/license/zimicjs/zimic?color=0E69BE&label=License&labelColor=353C43)](https://github.com/zimicjs/zimic/blob/canary/LICENSE.md)
[![NPM Downloads](https://img.shields.io/npm/dm/zimic?style=flat&logo=npm&color=0E69BE&label=Downloads&labelColor=353C43)](https://www.npmjs.com/package/zimic)&nbsp;
[![Stars](https://img.shields.io/github/stars/zimicjs/zimic)](https://github.com/zimicjs/zimic)&nbsp;

</div>

---

Zimic is a lightweight, thoroughly tested, TypeScript-first HTTP request mocking library, inspired by
[Zod](https://github.com/colinhacks/zod)'s type inference and using [MSW](https://github.com/mswjs/msw) under the hood.

## Features

Zimic provides a flexible and type-safe way to mock HTTP requests.

- :zap: **Statically-typed mocks**: Declare the [schema](api-zimic-interceptor-http#declaring-interceptor-schemas) of
  your HTTP endpoints and get full type inference and validation for your mocks.
- :link: **Network-level intercepts**: Internally, Zimic combines [MSW](https://github.com/mswjs/msw) and
  [interceptor servers](cli-zimic-server#zimic-server) to act on real HTTP requests From you application's point of
  view, mocked responses are indistinguishable from real ones.
- :wrench: **Flexibility**: Mock external services and simulate real application workflows. This is specially useful in
  testing, helping you to cover the paths your application takes in predictable tests.
- :bulb: **Simplicity**: Zimic was designed from the start to encourage clarity, simplicity, and developer experience in
  your mocks, relying on official [web APIs](https://developer.mozilla.org/docs/Web/API). Check our
  [getting started guide](getting-started) and starting mocking!

```ts
import { JSONValue } from 'zimic';
import { HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type User = JSONValue<{
  username: string;
}>;

// Declare your service schema
type MyServiceSchema = HttpSchema.Paths<{
  '/users': {
    GET: {
      response: {
        200: { body: User[] };
      };
    };
  };
}>;

// Create and start your interceptor
const myInterceptor = httpInterceptor.create<MyServiceSchema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});

await myInterceptor.start();

// Declare your mocks
const listHandler = myInterceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});

// Enjoy!
const response = await fetch('http://localhost:3000/users');
const users = await response.json();
console.log(users); // [{ username: 'diego-aquino' }]
```

> [!NOTE]
>
> Zimic has gone a long way in v0, but we're not yet v1!
>
> Reviews and improvements to the public API are possible, so breaking changes may **_exceptionally_** land without a
> major release during v0. Despite of that, we do not expect big mental model shifts. Usually, migrating to a new Zimic
> release requires minimal to no refactoring. During v0, we will follow these guidelines:
>
> - Breaking changes, if any, will be delivered in the next **_minor_** version.
> - Breaking changes, if any, will be documented in the [version release](https://github.com/zimicjs/zimic/releases),
>   along with a migration guide detailing the introduced changes and suggesting steps to migrate.
>
> From v0.8 onwards, we expect Zimic's public API to become more stable. If you'd like to share any feedback, please
> feel free to [open an issue](https://github.com/zimicjs/zimic/issues/new) or
> [create a discussion](https://github.com/zimicjs/zimic/discussions/new/choose)!

## What is Zimic for?

Zimic is a development and testing tool that helps you mock HTTP responses in a type-safe way. Some of our best use
cases:

- **Testing**: if your application relies on external services over HTTP, you can mock them with Zimic to help your
  tests be simpler, faster and more predictable. Each interceptor references a
  [schema declaration](api-zimic-interceptor-http#declaring-interceptor-schemas) of the service to provide type
  inference and validation for your mocks. After breaking changes on the external service, changing the schema will help
  you to quickly identify all of the affected mocks and keep them consistent with the new API.
- **Development**: if you are developing a feature that depends on an external service that is unreliable, unavailable,
  or costly, you can use Zimic to mock it and continue your development without interruptions. Zimic can also be used to
  create mock servers, using [remote interceptors](getting-started#remote-http-interceptors) and
  [interceptor servers](cli-zimic-server#zimic-server), which can be accessible by any number of applications in your
  development workflow and even be containerized.

## How does Zimic work?

Zimic allows you to intercept HTTP requests and return mock responses. In
[local HTTP interceptors](getting-started#local-http-interceptors), Zimic uses [MSW](https://github.com/mswjs/msw) to
intercept requests in the same process as your application. Zimic uses a dedicated local
[interceptor server](cli-zimic-server#zimic-server) to handle requests. This opens up more possibilities for mocking,
such as handling requests from multiple applications. Both of these strategies act on real HTTP requests _after_ they
leave your application, meaning that no parts of your code are skipped and giving you more confidence in your tests.

## Documentation

- [Getting started](getting-started)
- [API reference](api-zimic)
- [CLI reference](cli-zimic)
- Guides
  - [Testing](guides-testing)

> [!TIP]
>
> **How can I search the wiki?**
>
> You can search the wiki with the GitHub search. To do so, press `/` or click on the GitHub search bar, prefix your
> query `repo:zimicjs/zimic type:wiki` and type your search terms.
>
> ![GitHub search bar on the repository header](../zimic.png)

## Examples

Visit our [examples](../../examples/README.md) to see how to use Zimic with popular frameworks, libraries, and use
cases!

## Changelog

The changelog is available on our [GitHub Releases](https://github.com/zimicjs/zimic/releases) page.