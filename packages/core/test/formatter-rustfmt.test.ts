import fs from "fs/promises"
import path from "path"
import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Formatter } from "@opencode/core/formatter"
import { make } from "@opencode/core/formatter/builtins"
import { Location } from "@opencode/core/location"
import { AppProcess } from "@opencode/util/process"
import { FSUtil } from "@opencode/util/fs-util"
import { Global } from "@opencode/util/global"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Npm } from "@opencode/util/npm"
import { tempGlobalLayer } from "./fixture/global"
import { tempLocationLayer } from "./fixture/location"
import { tmpdirScoped } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"

const it = testEffect(
  AppNodeBuilder.build(LayerNode.group([Formatter.node, FSUtil.node, Global.node, Npm.node, AppProcess.node]), [
    Global.node.replace(tempGlobalLayer),
    Location.node.replace(tempLocationLayer),
  ]),
)

// Optional local native integration; the qualification job requires both tools
// and therefore cannot treat their absence as a successful regression oracle.
describe.skipIf(!Bun.which("cargo") || !Bun.which("rustfmt"))("native Rustfmt discovery", () => {
  for (const mode of ["manifest", "workspace", "standalone"] as const) {
    it.live(`resolves the Rust language edition for each requested file ${mode}`, () =>
      Effect.gen(function* () {
        const root = (yield* tmpdirScoped()).path
        const modern = path.join(root, "modern")
        const legacy = path.join(root, "legacy")
        yield* Effect.promise(async () => {
          await fs.mkdir(modern)
          await fs.mkdir(legacy)
          if (mode === "workspace") {
            await fs.writeFile(
              path.join(root, "Cargo.toml"),
              '[workspace]\nmembers = ["modern", "legacy"]\nresolver = "2"\n[workspace.package]\nedition = "2021"\n',
            )
          }
          if (mode !== "standalone") {
            await fs.mkdir(path.join(modern, "src"))
            await fs.writeFile(
              path.join(modern, "Cargo.toml"),
              '[package]\nname = "modern"\nversion = "0.1.0"\n' +
                (mode === "workspace" ? "edition.workspace = true\n" : 'edition = "2021"\n'),
            )
            // Cargo language-edition precedence also applies with an explicit
            // rustfmt edition. Other rustfmt options must remain in effect.
            await fs.writeFile(path.join(modern, "rustfmt.toml"), 'edition = "2015"\nhard_tabs = true\n')
            await fs.writeFile(path.join(modern, "src", "lib.rs"), "pub async fn value()->u8{1}\n")
          }
          if (mode === "workspace") {
            await fs.mkdir(path.join(legacy, "src"))
            await fs.writeFile(
              path.join(legacy, "Cargo.toml"),
              '[package]\nname = "legacy"\nversion = "0.1.0"\nedition = "2015"\n',
            )
          }
          await fs.writeFile(
            path.join(legacy, mode === "workspace" ? "src/lib.rs" : "standalone.rs"),
            "pub fn async()->u8{1}\n",
          )
          await fs.writeFile(path.join(root, "unrelated.rs"), "pub fn untouched()->u8{2}\n")
        })
        const formatter = yield* Formatter.Service
        const builtins = make({
          directory: root,
          worktree: root,
          fs: yield* FSUtil.Service,
          npm: yield* Npm.Service,
          processes: yield* AppProcess.Service,
          bin: path.join(root, "bin"),
        })
        yield* formatter.transform((editor) => editor.set(builtins.find((item) => item.name === "rustfmt")!))
        const older = path.join(legacy, mode === "workspace" ? "src/lib.rs" : "standalone.rs")
        expect(yield* formatter.file(older)).toBe(true)
        expect(yield* Effect.promise(() => fs.readFile(older, "utf8"))).toContain("pub fn async() -> u8")
        if (mode !== "standalone") {
          const newer = path.join(modern, "src", "lib.rs")
          expect(yield* formatter.file(newer)).toBe(true)
          expect(yield* Effect.promise(() => fs.readFile(newer, "utf8"))).toBe(
            "pub async fn value() -> u8 {\n\t1\n}\n",
          )
        }
        expect(yield* Effect.promise(() => fs.readFile(path.join(root, "unrelated.rs"), "utf8"))).toBe(
          "pub fn untouched()->u8{2}\n",
        )
        expect(yield* Effect.promise(() => fs.access(path.join(root, "Cargo.lock")).then(() => true, () => false))).toBe(
          false,
        )
      }),
    )
  }
})
