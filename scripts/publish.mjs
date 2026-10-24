import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";

rmSync("public", { recursive: true, force: true });
mkdirSync("public", { recursive: true });

for (const name of readdirSync(".")) {
  if (name.endsWith(".html")) cpSync(name, `public/${name}`);
}

cpSync("js", "public/js", { recursive: true });
cpSync("assets", "public/assets", { recursive: true });
