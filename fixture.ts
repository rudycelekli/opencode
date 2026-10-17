import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import { ProviderIcon } from "../directory-separator/packages/ui/src/components/provider-icon"
const cases = [
  ["kimi-code-plan-cn", "kimi-for-coding"],
  ["kimi-code-plan-global", "kimi-for-coding"],
  ["kimi-for-coding", "kimi-for-coding"],
  ["unknown-provider", "synthetic"],
  ["openai", "openai"],
]
const output = []
for (const [id, expected] of cases) {
  const host = document.createElement("div")
  host.className = "item"
  const label = document.createElement("div")
  label.textContent = id
  host.append(label)
  const mount = document.createElement("div")
  host.append(mount)
  document.querySelector("#icons").append(host)
  render(() => createComponent(ProviderIcon, { id, width: 64, height: 64, "aria-label": id }), mount)
  const svg = mount.querySelector("svg")
  const actual = svg.querySelector("use").getAttribute("href").split("#").at(-1)
  output.push({ id, expected, actual, pass: expected === actual, box: svg.getBoundingClientRect().toJSON() })
}
const dynamic = document.createElement("div")
document.body.append(dynamic)
const [id, setID] = createSignal("unknown-provider")
render(() => createComponent(ProviderIcon, { get id() { return id() }, width: 32, height: 32 }), dynamic)
const node = dynamic.querySelector("svg")
for (const value of ["kimi-code-plan-cn", "kimi-code-plan-global", "unknown-provider"]) {
  setID(value)
  const actual = node.querySelector("use").getAttribute("href").split("#").at(-1)
  const expected = value === "unknown-provider" ? "synthetic" : "kimi-for-coding"
  output.push({ id: value, update: true, sameNode: node === dynamic.querySelector("svg"), expected, actual, pass: expected === actual && node === dynamic.querySelector("svg") })
}
dynamic.remove()
document.querySelector("#results").textContent = JSON.stringify({ passed: output.filter(x => x.pass).length, failed: output.filter(x => !x.pass).length, cases: output }, null, 2)
document.title = output.every(x => x.pass) ? "PASS" : "FAIL"
