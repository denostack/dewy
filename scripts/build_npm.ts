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
    lib: ["es2021", "dom"],
  },
  package: {
    name: "purehttp",
    version,
    description: "",
    keywords: [
      "http server",
    ],
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/denostack/purehttp.git",
    },
    bugs: {
      url: "https://github.com/denostack/purehttp/issues",
    },
    dependencies: {
      "urlpattern-polyfill": "~6.0.0",
    },
  },
});

// post build steps
Deno.copyFileSync("README.md", ".npm/README.md");
