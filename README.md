# purehttp

<a href="https://github.com/denostack"><img src="https://raw.githubusercontent.com/denostack/images/main/logo.svg" width="240" /></a>

<p>
  <a href="https://github.com/denostack/purehttp/actions"><img alt="Build" src="https://img.shields.io/github/actions/workflow/status/denostack/purehttp/ci.yml?branch=main&logo=github&style=flat-square" /></a>
  <a href="https://codecov.io/gh/denostack/purehttp"><img alt="Coverage" src="https://img.shields.io/codecov/c/gh/denostack/purehttp?style=flat-square" /></a>
  <img alt="License" src="https://img.shields.io/npm/l/purehttp.svg?style=flat-square" />
  <img alt="Language Typescript" src="https://img.shields.io/badge/language-Typescript-007acc.svg?style=flat-square" />
  <br />
  <a href="https://deno.land/x/purehttp"><img alt="deno.land/x/purehttp" src="https://img.shields.io/badge/dynamic/json?url=https://api.github.com/repos/denostack/purehttp/tags&query=$[0].name&display_name=tag&label=deno.land/x/purehttp@&style=flat-square&logo=deno&labelColor=000&color=777" /></a>
  <a href="https://www.npmjs.com/package/purehttp"><img alt="Version" src="https://img.shields.io/npm/v/purehttp.svg?style=flat-square&logo=npm" /></a>
  <a href="https://npmcharts.com/compare/purehttp?minimal=true"><img alt="Downloads" src="https://img.shields.io/npm/dt/purehttp.svg?style=flat-square" /></a>
</p>

PureHTTP is a minimalist HTTP server framework with a small codebase, utilizing
built-in URLPattern for efficient routing.

## Usage

### with Deno

```ts
import { Router } from "https://deno.land/x/purehttp/mod.ts";

const router = new Router();

router.get("/", () => {
  return Response.json({
    message: "Hello World",
  });
});
router.get("/articles/:id", ({ match }) => {
  return Response.json({
    id: match.pathname.groups.id,
  });
});

Deno.serve(router.dispatch.bind(router), {
  port: 8080,
});
```

```bash
deno run --allow-net --unstable server.ts
```

In addition to using `Deno.serve`, you can also use the HTTP server from the
standard library by importing `https://deno.land/std@0.167.0/http/server.ts`.

Here is an example:

```ts
import { serve } from "https://deno.land/std@0.167.0/http/server.ts";

/* ... */

serve(router.dispatch.bind(router), {
  port: 8080,
});
```

Using the HTTP server from the standard library allows you to deploy your
application to a Deno Deploy environment.

### with NPM

```bash
npm install purehttp
```

## Middlewares

**CORS**

The cors middleware from PureHTTP allows you to easily add CORS (Cross-Origin
Resource Sharing) support to your routes.

```ts
import { cors } from "https://deno.land/x/purehttp/middlewares/cors.ts";

router.addRoute({
  method: ["GET", "POST", "OPTIONS", "CUSTOMMETHOD"],
  pattern: "/cors",
  middleware: cors({
    allowMethods: ["POST", "CUSTOMMETHOD"],
  }),
}, () => {
  return Response.json({ success: true });
});
```
