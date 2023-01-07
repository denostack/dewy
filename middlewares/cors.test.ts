import { assertEquals, fail } from "testing/asserts.ts";
import { Context } from "../router.ts";
import { cors } from "./cors.ts";

function createContext(request: Request): Context {
  return {
    request,
    // deno-lint-ignore no-explicit-any
    match: null as any,
  };
}
const defaultNextHandler = () => new Response("success");

async function assertResponse(
  response: Response,
  { status, headers, body }: {
    status: number;
    headers: Record<string, string | null>;
    body: string;
  },
) {
  assertEquals(response.status, status);

  const ignoreHeaders = new Set<string>(["content-type", "content-length"]);
  for (const [key, value] of Object.entries(headers)) {
    assertEquals(response.headers.get(key), value);
    ignoreHeaders.add(key.toLowerCase());
  }

  for (const [key] of response.headers) {
    if (!ignoreHeaders.has(key.toLowerCase())) {
      fail(`Unexpected header: ${key}`);
    }
  }
  assertEquals(await response.text(), body);
}

Deno.test("middlewares/cors, default CORS, preflight", async () => {
  const request = new Request("https://example.com/simple", {
    method: "OPTIONS",
    headers: {
      Origin: "https://example.com",
      "Access-Control-Request-Method": "POST",
    },
  });

  const response = await cors()(createContext(request), defaultNextHandler);

  assertResponse(response, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
    },
    body: "",
  });
});

Deno.test("middlewares/cors, default CORS, OPTIONS but not preflight", async () => {
  const request = new Request("https://example.com/simple", {
    method: "OPTIONS",
    headers: {
      Origin: "https://example.com",
    },
  });

  const response = await cors()(createContext(request), defaultNextHandler);

  assertResponse(response, {
    status: 200,
    headers: {},
    body: "success",
  });
});

Deno.test("middlewares/cors, default CORS, GET request", async () => {
  const request = new Request("https://example.com/simple", {
    method: "GET",
    headers: {
      Origin: "https://example.com",
    },
  });

  const response = await cors()(createContext(request), defaultNextHandler);

  assertResponse(response, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    body: "success",
  });
});

Deno.test("middlewares/cors, preflight with preflightContinue options", async () => {
  const request = new Request("https://example.com/simple", {
    method: "OPTIONS",
    headers: {
      Origin: "https://example.com",
      "Access-Control-Request-Method": "POST",
    },
  });

  const response = await cors({
    preflightContinue: true,
  })(createContext(request), defaultNextHandler);

  assertResponse(response, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
    },
    body: "success",
  });
});

Deno.test("middlewares/cors, full options, preflight", async () => {
  const request = new Request("https://example.com/simple", {
    method: "OPTIONS",
    headers: {
      Origin: "https://example.com",
      "Access-Control-Request-Method": "PURGE,unknown",
      "Access-Control-Request-Headers": "X-UNKNOWN-FOO,x-unknown-bar",
      "Access-Control-Request-Private-Network": "True",
    },
  });

  const response = await cors({
    allowOrigin: ["https://example.com"],
    allowMethods: ["PURGE", "unknown"],
    allowHeaders: ["X-UNKNOWN-FOO", "x-unknown-bar"],
    exposeHeaders: ["x-unknown-bar"],
    allowCredentials: true,
    maxAge: 123,
    allowPrivateNetwork: true,
  })(createContext(request), defaultNextHandler);

  assertResponse(response, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://example.com",
      Vary: "Origin",
      "Access-Control-Allow-Methods": "PURGE,unknown",
      "Access-Control-Allow-Headers": "X-UNKNOWN-FOO,x-unknown-bar",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Expose-Headers": "x-unknown-bar",
      "Access-Control-Max-Age": "123",
      "Access-Control-Allow-Private-Network": "true",
    },
    body: "",
  });
});

Deno.test("middlewares/cors, full options, GET request", async () => {
  const request = new Request("https://example.com/simple", {
    method: "GET",
    headers: {
      Origin: "https://example.com",
    },
  });

  const response = await cors({
    allowOrigin: ["https://example.com"],
    allowMethods: ["PURGE", "unknown"],
    allowHeaders: ["X-UNKNOWN-FOO", "x-unknown-bar"],
    exposeHeaders: ["x-unknown-bar"],
    allowCredentials: true,
    maxAge: 123,
    allowPrivateNetwork: true,
  })(createContext(request), defaultNextHandler);

  assertResponse(response, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "https://example.com",
      Vary: "Origin",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Expose-Headers": "x-unknown-bar",
    },
    body: "success",
  });
});

Deno.test("middlewares/cors, all origin with credential", async () => {
  const request = new Request("https://example.com/simple", {
    method: "GET",
    headers: {
      Origin: "https://example.com",
    },
  });

  const response = await cors({
    allowOrigin: null, // default = "*"
    allowCredentials: true,
  })(createContext(request), defaultNextHandler);

  assertResponse(response, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "https://example.com", // "*"" -> https://example.com
      "Access-Control-Allow-Credentials": "true",
    },
    body: "success",
  });
});
