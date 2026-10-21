import fs from "fs/promises"
import path from "path"
import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { make } from "@opencode/core/formatter/builtins"
import { AppProcess } from "@opencode/util/process"
import { FSUtil } from "@opencode/util/fs-util"
import { Global } from "@opencode/util/global"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Npm } from "@opencode/util/npm"
import { tempGlobalLayer } from "./fixture/global"
import { tmpdirScoped } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"

const it = testEffect(
  AppNodeBuilder.build(LayerNode.group([FSUtil.node, Global.node, Npm.node, AppProcess.node]), [
    Global.node.replace(tempGlobalLayer),
  ]),
)

describe("built-in formatter discovery", () => {
  for (const configured of [false, true]) {
    it.effect(`finds parent Ruff configuration through an unrelated pyproject ${configured}`, () =>
      Effect.gen(function* () {
        const root = (yield* tmpdirScoped()).path
        const directory = path.join(root, "nested")
        const bin = path.join(root, "bin")
        yield* Effect.promise(async () => {
          await fs.mkdir(directory)
          await fs.mkdir(bin)
          // Discovery only needs an executable. The native Ruff CLI's matching
          // parent-config behavior is independent of this executable fixture.
          const file = path.join(bin, process.platform === "win32" ? "ruff.cmd" : "ruff")
          await fs.writeFile(file, process.platform === "win32" ? "@exit /b 0\r\n" : "#!/bin/sh\nexit 0\n")
          await fs.chmod(file, 0o755)
          await fs.writeFile(path.join(directory, "pyproject.toml"), '[project]\nname = "nested"\n')
          if (configured) await fs.writeFile(path.join(root, "pyproject.toml"), "[tool.ruff]\nline-length = 100\n")
        })
        const formatters = make({
          directory,
          worktree: root,
          fs: yield* FSUtil.Service,
          npm: yield* Npm.Service,
          processes: yield* AppProcess.Service,
          bin,
        })
        const ruff = formatters.find((formatter) => formatter.name === "ruff")!
        const command = yield* ruff.enabled
        if (!configured) {
          expect(command).toBe(false)
          return
        }
        expect(command).not.toBe(false)
        if (command !== false) expect(command.slice(1)).toEqual(["format", "$FILE"])
      }),
    )
  }
})
