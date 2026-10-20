import { expect, test } from "bun:test"
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { createPluginSources } from "../src/source.js"

for (const linked of [false, true]) {
  test(`reloads a changed standalone plugin through a ${linked ? "symlinked" : "direct"} config directory`, async () => {
    const directory = await realpath(await mkdtemp(path.join(tmpdir(), "opencode-source-")))
    const watched: string[] = []
    const sources = createPluginSources(async (file) => {
      watched.push(file)
    })
    try {
      const root = path.join(directory, "real-config")
      const file = path.join(root, "plugins/example.ts")
      const alias = path.join(directory, "config")
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, 'export default { id: "before" }')
      if (linked) await symlink(root, alias, "junction")
      const entry = path.join(linked ? alias : root, "plugins/example.ts")
      const entrypoint = pathToFileURL(entry).href
      const initial = await sources.read(entrypoint)
      expect(initial.module).toMatchObject({ default: { id: "before" } })
      expect(watched).toContain(entry)
      expect((await sources.read(entrypoint)).module).toBe(initial.module)

      await writeFile(file, 'export default { id: "after" }')
      const changed = await sources.read(entrypoint)
      expect(changed.module).toMatchObject({ default: { id: "after" } })
      expect(changed.version).not.toBe(initial.version)
    } finally {
      sources.dispose()
      await rm(directory, { recursive: true, force: true })
    }
  })
}
