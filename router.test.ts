import { assertEquals } from "testing/asserts.ts";
import { createRouter } from "./router.ts";

Deno.test("router, empty", async () => {
  const router = createRouter();

  const response = await router(new Request("https://example.local"));

  assertEquals(response.status, 404);
  assertEquals(await response.text(), "Not Found");
});

Deno.test("router, simple", async () => {
  const router = createRouter();

  router.addRoute("GET", "/", () => new Response("pong", { status: 200 }));

  const response = await router(new Request("https://example.local"));

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "pong");
});
