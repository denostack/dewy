import { build, emptyDir } from "dnt/mod.ts";
import { bgGreen } from "fmt/colors.ts";

const cmd = Deno.run({
  cmd: ["git", "describe", "--tags", "--abbrev=0"],
  stdout: "piped",
});
const version = new TextDecoder().decode(await cmd.output()).trim();
cmd.close();

console.log(bgGreen(`version: ${version}`));

await emptyDir("./.npm");

await build({
  entryPoints: [
    "./mod.ts",
    "./middlewares/cors.ts",
  ],
  outDir: "./.npm",
  shims: {
    deno: false,
    custom: [
      {
        module: "./nodejs/urlpattern.shim.ts",
        globalNames: [
          "URLPattern",
          { name: "URLPatternInput", typeOnly: true },
        ],
      },
    ],
  },
  test: false,
  compilerOptions: {
    lib: ["es2022", "dom"],
  },
  package: {
    name: "dewy",
    version,
    description:
      "Dewy(dǝw-y) is a minimalist HTTP server framework with a small codebase, utilizing built-in URLPattern for efficient routing.",
    keywords: [
      "http server",
      "web",
      "http",
      "restful",
      "router",
      "urlpattern",
    ],
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/denostack/dewy.git",
    },
    bugs: {
      url: "https://github.com/denostack/dewy/issues",
    },
    dependencies: {
      "urlpattern-polyfill": "~6.0.0",
    },
  },
});

// post build steps
Deno.copyFileSync("README.md", ".npm/README.md");
