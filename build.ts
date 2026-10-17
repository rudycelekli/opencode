import { transformAsync } from "../directory-separator/node_modules/@babel/core/lib/index.js"
import { resolve } from "node:path"
const root = resolve(import.meta.dir, "../directory-separator")
const output = resolve(import.meta.dir, "site")
const result = await Bun.build({
  entrypoints: [resolve(import.meta.dir, "fixture.ts")],
  outdir: output,
  target: "browser",
  conditions: ["browser"],
  plugins: [{
    name: "production-solid-component",
    setup(build) {
      build.onLoad({ filter: /\.tsx$/ }, async ({ path }) => {
        const source = await Bun.file(path).text()
        const result = await transformAsync(source, {
          filename: path,
          configFile: false,
          babelrc: false,
          plugins: [
            [root + "/node_modules/@babel/plugin-transform-typescript/lib/index.js", { isTSX: true, allExtensions: true }],
            [root + "/node_modules/babel-plugin-jsx-dom-expressions/index.js", { moduleName: "solid-js/web", generate: "dom" }],
          ],
        })
        return { contents: result.code, loader: "js" }
      })
    },
  }],
})
if (!result.success) throw new Error(JSON.stringify(result.logs))
await Bun.write(output + "/index.html", `<!doctype html><html><head><style>body{font:16px sans-serif;background:#fff;color:#222;padding:24px}#icons{display:flex;gap:24px}.item{width:180px;padding:18px;border:1px solid #555}svg{display:block;color:#222;margin:24px 0}pre{white-space:pre-wrap;font:12px monospace}</style></head><body><h1>Kimi provider icon regression fixture</h1><p>Production ProviderIcon; source and full sprite bundled from the candidate checkout.</p><div id="icons"></div><pre id="results">RUNNING</pre><script type="module" src="/fixture.js"></script></body></html>`)
