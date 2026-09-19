import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir("work", { recursive: true });
await build({ entryPoints: ["tests/presentations.test.ts"], bundle: true, platform: "node", format: "esm", outfile: "work/presentations.test.mjs" });
const result = spawnSync(process.execPath, ["--test", "work/presentations.test.mjs"], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
