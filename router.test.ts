import { assertEquals, assertInstanceOf, fail } from "testing/asserts.ts";
import { ServerError } from "./error/server_error.ts";
import { Router } from "./router.ts";

async function assert404(router: Router, request: Request) {
  try {
    await router.dispatch(request);
    fail();
  } catch (e) {
    assertInstanceOf(e, ServerError);
    assertEquals(e.status, 404);
    assertEquals(e.message, "Not Found");
  }
}

Deno.test("router, empty", async () => {
  const router = new Router();

  await assert404(router, new Request("https://example.local"));
});

Deno.test("router, simple rule", async () => {
  const router = new Router();

  new URLPattern({});
  router.addRoute({
    methods: ["GET"],
    pattern: new URLPattern({ pathname: "/" }),
    fn: () => new Response("pong", { status: 200 }),
  });
  router.addRoute({
    methods: ["GET", "POST"],
    pattern: new URLPattern({ pathname: "/users/:id" }),
    fn: ({ match }) =>
      new Response(`user ${match.pathname.groups.id}`, { status: 200 }),
  });

  {
    const response = await router.dispatch(
      new Request("https://example.local", { method: "GET" }),
    );

    assertEquals(response.status, 200);
    assertEquals(await response.text(), "pong");
  }
  {
    const response = await router.dispatch(
      new Request("https://example.local/users/123", { method: "post" }),
    );

    assertEquals(response.status, 200);
    assertEquals(await response.text(), "user 123");
  }
});

Deno.test("router, get, post, ... methods", async () => {
  const router = new Router();

  new URLPattern({});
  router.get("/get", () => new Response("get", { status: 200 }));
  router.head("/head", () => new Response("head", { status: 200 }));
  router.post("/post", () => new Response("post", { status: 200 }));
  router.put("/put", () => new Response("put", { status: 200 }));
  router.delete("/delete", () => new Response("delete", { status: 200 }));
  router.options("/options", () => new Response("options", { status: 200 }));
  router.patch("/patch", () => new Response("patch", { status: 200 }));
  router.any("/any", () => new Response("any", { status: 200 }));

  // get
  assertEquals(
    await router.dispatch(
      new Request("https://example.local/get", { method: "GET" }),
    ).then((r) => r.text()),
    "get",
  );
  assertEquals(
    await router.dispatch(
      new Request("https://example.local/get", { method: "HEAD" }),
    ).then((r) => r.text()),
    "get",
  );
  for (const method of ["POST", "PUT", "DELETE", "OPTIONS", "PATCH"]) {
    await assert404(
      router,
      new Request("https://example.local/get", { method }),
    );
  }

  // head
  assertEquals(
    await router.dispatch(
      new Request("https://example.local/head", { method: "HEAD" }),
    ).then((r) => r.text()),
    "head",
  );
  for (const method of ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]) {
    await assert404(
      router,
      new Request("https://example.local/head", { method }),
    );
  }

  // post
  assertEquals(
    await router.dispatch(
      new Request("https://example.local/post", { method: "POST" }),
    ).then((r) => r.text()),
    "post",
  );
  for (const method of ["GET", "HEAD", "PUT", "DELETE", "OPTIONS", "PATCH"]) {
    await assert404(
      router,
      new Request("https://example.local/post", { method }),
    );
  }

  // put
  assertEquals(
    await router.dispatch(
      new Request("https://example.local/put", { method: "PUT" }),
    ).then((r) => r.text()),
    "put",
  );
  for (const method of ["GET", "HEAD", "POST", "DELETE", "OPTIONS", "PATCH"]) {
    await assert404(
      router,
      new Request("https://example.local/put", { method }),
    );
  }

  // delete
  assertEquals(
    await router.dispatch(
      new Request("https://example.local/delete", { method: "DELETE" }),
    ).then((r) => r.text()),
    "delete",
  );
  for (const method of ["GET", "HEAD", "POST", "PUT", "OPTIONS", "PATCH"]) {
    await assert404(
      router,
      new Request("https://example.local/delete", { method }),
    );
  }

  // options
  assertEquals(
    await router.dispatch(
      new Request("https://example.local/options", { method: "OPTIONS" }),
    ).then((r) => r.text()),
    "options",
  );
  for (const method of ["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH"]) {
    await assert404(
      router,
      new Request("https://example.local/options", { method }),
    );
  }

  // patch
  assertEquals(
    await router.dispatch(
      new Request("https://example.local/patch", { method: "PATCH" }),
    ).then((r) => r.text()),
    "patch",
  );
  for (const method of ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"]) {
    await assert404(
      router,
      new Request("https://example.local/patch", { method }),
    );
  }
});

Deno.test("router, middleware", async () => {
  const router = new Router();

  router.addRoute({
    methods: ["GET"],
    pattern: new URLPattern({ pathname: "/" }),
    middlewares: [
      ({ request }, next) => {
        const auth = request.headers.get("Authorization");
        if (!auth) {
          return new Response("Unauthorized", { status: 401 });
        }
        return next();
      },
    ],
    fn: () => new Response("pong", { status: 200 }),
  });

  {
    const response = await router.dispatch(
      new Request("https://example.local", { method: "GET" }),
    );

    assertEquals(response.status, 401);
  }
  {
    const response = await router.dispatch(
      new Request("https://example.local", {
        method: "GET",
        headers: { Authorization: "TOKEN" },
      }),
    );

    assertEquals(response.status, 200);
  }
});

Deno.test("router, use (predefined middlewares)", async () => {
  const router = new Router();

  router.use(({ request }, next) => {
    const auth = request.headers.get("Authorization");
    if (!auth) {
      return new Response("Unauthorized", { status: 401 });
    }
    return next();
  });

  router.addRoute({
    methods: ["GET"],
    pattern: new URLPattern({ pathname: "/" }),
    fn: () => new Response("pong", { status: 200 }),
  });

  {
    const response = await router.dispatch(
      new Request("https://example.local", { method: "GET" }),
    );

    assertEquals(response.status, 401);
  }
  {
    const response = await router.dispatch(
      new Request("https://example.local", {
        method: "GET",
        headers: { Authorization: "TOKEN" },
      }),
    );

    assertEquals(response.status, 200);
  }
});
