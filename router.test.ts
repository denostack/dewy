import { assertEquals, assertInstanceOf, fail } from "testing/asserts.ts";
import { ServerError } from "./error/server_error.ts";
import { Router } from "./router.ts";

async function assert200(router: Router, request: Request, body: string) {
  const response = await router.dispatch(request);
  assertEquals(response.status, 200);
  assertEquals(await response.text(), body);
}

async function assert401(router: Router, request: Request, body: string) {
  const response = await router.dispatch(request);
  assertEquals(response.status, 401);
  assertEquals(await response.text(), body);
}

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
    method: ["GET"],
    pattern: new URLPattern({ pathname: "/" }),
  }, () => new Response("pong", { status: 200 }));
  router.addRoute(
    {
      method: ["GET", "POST"],
      pattern: new URLPattern({ pathname: "/users/:id" }),
    },
    ({ match }) =>
      new Response(`user ${match.pathname.groups.id}`, { status: 200 }),
  );

  await assert200(
    router,
    new Request("https://example.local", { method: "get" }),
    "pong",
  );
  await assert200(
    router,
    new Request("https://example.local", { method: "GET" }),
    "pong",
  );
  await assert200(
    router,
    new Request("https://example.local/users/123", { method: "POST" }),
    "user 123",
  );
  await assert200(
    router,
    new Request("https://example.local/users/123", { method: "post" }),
    "user 123",
  );
});

Deno.test("router, each methods", async () => {
  const router = new Router();

  new URLPattern({});
  router.get("/get", () => new Response("get", { status: 200 }));
  router.head("/head", () => new Response("head", { status: 200 }));
  router.post("/post", () => new Response("post", { status: 200 }));
  router.put("/put", () => new Response("put", { status: 200 }));
  router.del("/delete", () => new Response("delete", { status: 200 }));
  router.options("/options", () => new Response("options", { status: 200 }));
  router.patch("/patch", () => new Response("patch", { status: 200 }));
  router.all("/all", () => new Response("all", { status: 200 }));

  // get
  await assert200(
    router,
    new Request("https://example.local/get", { method: "GET" }),
    "get",
  );
  await assert200(
    router,
    new Request("https://example.local/get", { method: "HEAD" }),
    "get",
  );

  for (const method of ["POST", "PUT", "DELETE", "OPTIONS", "PATCH"]) {
    await assert404(
      router,
      new Request("https://example.local/get", { method }),
    );
  }

  // head
  await assert200(
    router,
    new Request("https://example.local/head", { method: "HEAD" }),
    "head",
  );
  for (const method of ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]) {
    await assert404(
      router,
      new Request("https://example.local/head", { method }),
    );
  }

  // post
  await assert200(
    router,
    new Request("https://example.local/post", { method: "POST" }),
    "post",
  );
  for (const method of ["GET", "HEAD", "PUT", "DELETE", "OPTIONS", "PATCH"]) {
    await assert404(
      router,
      new Request("https://example.local/post", { method }),
    );
  }

  // put
  await assert200(
    router,
    new Request("https://example.local/put", { method: "PUT" }),
    "put",
  );
  for (const method of ["GET", "HEAD", "POST", "DELETE", "OPTIONS", "PATCH"]) {
    await assert404(
      router,
      new Request("https://example.local/put", { method }),
    );
  }

  // delete
  await assert200(
    router,
    new Request("https://example.local/delete", { method: "DELETE" }),
    "delete",
  );
  for (const method of ["GET", "HEAD", "POST", "PUT", "OPTIONS", "PATCH"]) {
    await assert404(
      router,
      new Request("https://example.local/delete", { method }),
    );
  }

  // options
  await assert200(
    router,
    new Request("https://example.local/options", { method: "OPTIONS" }),
    "options",
  );
  for (const method of ["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH"]) {
    await assert404(
      router,
      new Request("https://example.local/options", { method }),
    );
  }

  // patch
  await assert200(
    router,
    new Request("https://example.local/patch", { method: "PATCH" }),
    "patch",
  );
  for (const method of ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"]) {
    await assert404(
      router,
      new Request("https://example.local/patch", { method }),
    );
  }

  // all
  for (
    const method of ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
  ) {
    await assert200(
      router,
      new Request("https://example.local/all", { method }),
      "all",
    );
  }
});

Deno.test("router, middleware", async () => {
  const router = new Router();

  router.addRoute({
    method: ["GET"],
    pattern: new URLPattern({ pathname: "/" }),
  }, ({ request }, next) => {
    const auth = request.headers.get("Authorization");
    if (!auth) {
      return new Response("Unauthorized", { status: 401 });
    }
    return next();
  }, () => new Response("pong", { status: 200 }));

  router.addRoute({
    method: ["GET"],
    pattern: new URLPattern({ pathname: "/others" }),
  }, () => new Response("others", { status: 200 }));

  await assert401(
    router,
    new Request("https://example.local", { method: "GET" }),
    "Unauthorized",
  );
  await assert200(
    router,
    new Request("https://example.local", {
      method: "GET",
      headers: { Authorization: "TOKEN" },
    }),
    "pong",
  );

  await assert200(
    router,
    new Request("https://example.local/others", { method: "GET" }),
    "others",
  );
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

  router.get("/", () => new Response("pong", { status: 200 }));
  router.get("/others", () => new Response("others", { status: 200 }));

  await assert401(
    router,
    new Request("https://example.local", { method: "GET" }),
    "Unauthorized",
  );
  await assert200(
    router,
    new Request("https://example.local", {
      method: "GET",
      headers: { Authorization: "TOKEN" },
    }),
    "pong",
  );

  await assert401(
    router,
    new Request("https://example.local/others", { method: "GET" }),
    "Unauthorized",
  );
  await assert200(
    router,
    new Request("https://example.local/others", {
      method: "GET",
      headers: { Authorization: "TOKEN" },
    }),
    "others",
  );
});

Deno.test("router, group prefix", async () => {
  const router = new Router();

  router.group({ prefix: "/api" }, () => {
    router.get("/", () => new Response("/api", { status: 200 }));
    router.get(
      { pathname: "/users" },
      () => new Response("/api/users", { status: 200 }),
    );
    router.get(
      new URLPattern({ pathname: "/articles" }),
      () => new Response("/api/articles", { status: 200 }),
    );
  });

  await assert200(
    router,
    new Request("https://example.local/api", { method: "GET" }),
    "/api",
  );
  await assert200(
    router,
    new Request("https://example.local/api/users", { method: "GET" }),
    "/api/users",
  );
  await assert200(
    router,
    new Request("https://example.local/api/articles", { method: "GET" }),
    "/api/articles",
  );
});

Deno.test("router, group domains", async () => {
  const router = new Router();

  router.group({ domain: "admin.local" }, () => {
    router.get("/", () => new Response("/", { status: 200 }));
    router.get(
      { pathname: "/users" },
      () => new Response("/users", { status: 200 }),
    );
    router.get(
      new URLPattern({ pathname: "/articles" }),
      () => new Response("/articles", { status: 200 }),
    );
  });

  await assert200(
    router,
    new Request("https://admin.local", { method: "GET" }),
    "/",
  );
  await assert200(
    router,
    new Request("https://admin.local/users", { method: "GET" }),
    "/users",
  );
  await assert200(
    router,
    new Request("https://admin.local/articles", { method: "GET" }),
    "/articles",
  );

  await assert404(
    router,
    new Request("https://example.local", { method: "GET" }),
  );
  await assert404(
    router,
    new Request("https://example.local/users", { method: "GET" }),
  );
  await assert404(
    router,
    new Request("https://example.local/articles", { method: "GET" }),
  );
});
