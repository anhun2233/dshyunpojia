// 自检：DEFAULTS.map / 示例 automatch.json 指向的规则 id 都必须有 rules/<id>.md 和 .json。
// 同时锁住匹配行为：默认只认开头；includes: true 才做包含匹配，且不能压过真正的前缀。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULTS, decide, resolve, invalidateCfgCache } from "./patch/automatch.js";
import { handleAutoMatchOp } from "./patch/automatch-ui.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const problems = [];

function fail(msg) {
  problems.push(msg);
}

function idsFrom(cfg, label) {
  const ids = new Set();
  const map = cfg && cfg.map && typeof cfg.map === "object" ? cfg.map : {};
  const routes = cfg && cfg.routes && typeof cfg.routes === "object" ? cfg.routes : {};
  for (const [key, id] of Object.entries(map)) {
    if (typeof id !== "string" || !id.trim()) fail(`${label} map[${key}] 不是规则 id`);
    else ids.add(id.trim());
  }
  for (const [key, id] of Object.entries(routes)) {
    if (typeof id !== "string" || !id.trim()) fail(`${label} routes[${key}] 不是规则 id`);
    else ids.add(id.trim());
  }
  if (typeof cfg?.default === "string" && cfg.default.trim()) ids.add(cfg.default.trim());
  return ids;
}

function checkIds(ids, label) {
  for (const id of ids) {
    const md = path.join(root, "rules", id + ".md");
    const meta = path.join(root, "rules", id + ".json");
    if (!fs.existsSync(md)) fail(`${label} → rules/${id}.md 不存在`);
    else if (!fs.readFileSync(md, "utf8").trim()) fail(`${label} → rules/${id}.md 是空的`);
    if (!fs.existsSync(meta)) fail(`${label} → rules/${id}.json 不存在`);
    else {
      let parsed;
      try { parsed = JSON.parse(fs.readFileSync(meta, "utf8")); }
      catch (e) { fail(`${label} → rules/${id}.json 不是 JSON：${e.message}`); continue; }
      if (!parsed || typeof parsed.name !== "string" || !parsed.name.trim()) fail(`rules/${id}.json 缺少 name`);
      if (parsed.target !== "prompt-inject.md") fail(`rules/${id}.json 的 target 应为 prompt-inject.md`);
    }
  }
}

const examplePath = path.join(root, "examples", "dsh-purge", "automatch.json");
const example = JSON.parse(fs.readFileSync(examplePath, "utf8"));
checkIds(idsFrom(DEFAULTS, "DEFAULTS"), "DEFAULTS");
checkIds(idsFrom(example, "示例 automatch.json"), "示例");

const copies = [
  ["rules/dsv3.md", "prompts/deepseek-v3.md"],
  ["rules/glm52.md", "prompts/glm-5.2.md"],
  ["rules/grok.md", "prompts/grok-config.txt"],
];
for (const [rule, prompt] of copies) {
  const a = fs.readFileSync(path.join(root, rule));
  const b = fs.readFileSync(path.join(root, prompt));
  if (!a.equals(b)) fail(`${rule} 与 ${prompt} 内容不一致`);
}

function assertDecide(label, got, ruleId, how) {
  if (got.ruleId !== ruleId || got.how !== how) {
    fail(`${label}：得到 ${got.how || "空"}/${got.ruleId || "空"}，期望 ${how || "空"}/${ruleId || "空"}`);
  }
}

const base = { routes: {}, default: "", map: { "grok-4.7": "grok", grok: "grok", glm: "glm53f" } };
assertDecide("开头命中长前缀", decide("grok-4.7-fast", base), "grok", "prefix");
assertDecide("默认不做包含匹配", decide("xgrok-extra", base), "", "");
assertDecide(
  "includes true 才包含匹配",
  decide("xgrok-extra", { ...base, includes: true }),
  "grok",
  "contains",
);
assertDecide(
  "真正的前缀优先于更长的包含",
  decide("grok-4", {
    routes: {},
    default: "",
    includes: true,
    map: { "rok-4": "glm52", grok: "grok" },
  }),
  "grok",
  "prefix",
);

const sampleCfg = { routes: {}, default: "", includes: false, map: DEFAULTS.map };
const samples = [
  ["glm-5.3-flash", "glm53f", "prefix"],
  ["glm-5.3-flash-x2", "glm53f", "prefix"],
  ["GLM 5.3 Flash", "glm53f", "prefix"],
  ["openrouter/glm-5.3-flash-ts", "glm53f", "prefix"],
  ["glm-5.3-ts", "glm53f", "prefix"],
  ["kimi-k3", "kimi3", "prefix"],
  ["kimi-k3-xxx", "kimi3", "prefix"],
  ["qwen-3.7-xx", "qwen", "prefix"],
  ["GLM 5.2 flash", "glm52", "prefix"],
  ["not-a-known-model", "", ""],
];
for (const [model, ruleId, how] of samples) {
  assertDecide(model, decide(model, sampleCfg), ruleId, how);
}
assertDecide(
  "routes 仍按清洗后的整串精确匹配",
  decide("GLM 5.2 flash", { routes: { "glm5.2flash": "ds41" }, default: "", map: DEFAULTS.map }),
  "ds41",
  "route",
);

const home = fs.mkdtempSync(path.join(os.tmpdir(), "automatch-ui-"));
const cfgFile = path.join(home, "dsh-purge", "automatch.json");
fs.mkdirSync(path.dirname(cfgFile), { recursive: true });
fs.writeFileSync(cfgFile, JSON.stringify({
  enabled: true,
  includes: true,
  routes: {},
  default: "",
  map: { grok: "grok" },
  _说明: "keep me",
  _档位含义: "stay",
}, null, 2));
const saved = handleAutoMatchOp(home, {
  op: "automatchSet",
  cfg: { enabled: false, routes: {}, default: "unified", map: { grok: "grok47" } },
});
if (!saved || !saved.ok) fail("面板保存没有返回 ok");
const disk = JSON.parse(fs.readFileSync(cfgFile, "utf8"));
if (disk._说明 !== "keep me") fail("面板保存丢掉了 _说明");
if (disk._档位含义 !== "stay") fail("面板保存丢掉了 _档位含义");
if (disk.includes !== true) fail("面板保存丢掉了 includes");
if (disk.enabled !== false) fail("面板保存没有写入 enabled: false");
if (disk.map?.grok !== "grok47") fail("面板保存没有更新 map");
if (disk.default !== "unified") fail("面板保存没有更新 default");
fs.rmSync(home, { recursive: true, force: true });

const routeHome = fs.mkdtempSync(path.join(os.tmpdir(), "automatch-route-"));
fs.mkdirSync(path.join(routeHome, "rules"), { recursive: true });
fs.mkdirSync(path.join(routeHome, "dsh-purge"), { recursive: true });
fs.writeFileSync(path.join(routeHome, "rules", "glm53f.md"), "FLASH-RULE\n", "utf8");
const routeFile = path.join(routeHome, "dsh-purge", "automatch.json");
fs.writeFileSync(routeFile, JSON.stringify({
  enabled: true,
  includes: false,
  routes: {},
  default: "",
  map: { "glm-5.3-flash": "glm53f" },
  _说明: "keep-route",
}, null, 2));
invalidateCfgCache();
function modelCtx(model) {
  return { agent: { session: { id: "s", requestHeader: () => ({ config: { model } }) } } };
}
const hit = resolve(routeHome, modelCtx("glm-5.3-flash-x2"));
if (!hit || hit.ruleId !== "glm53f" || !String(hit.text).includes("FLASH-RULE")) {
  fail("开：命中时应整段返回 glm53f，而不是 null");
}
invalidateCfgCache();
const miss = resolve(routeHome, modelCtx("not-a-known-model"));
if (miss !== null) fail("开但未命中时应返回 null，退回手动 prompt-inject.md");
const flipped = handleAutoMatchOp(routeHome, { op: "automatchSet", cfg: { enabled: false } });
if (!flipped || !flipped.ok || flipped.cfg.enabled !== false) fail("关闭开关没有写成 enabled false");
const diskRoute = JSON.parse(fs.readFileSync(routeFile, "utf8"));
if (diskRoute._说明 !== "keep-route") fail("只关开关时丢掉了 _说明");
if (diskRoute.map?.["glm-5.3-flash"] !== "glm53f") fail("只关开关时丢掉了 map");
invalidateCfgCache();
const off = resolve(routeHome, modelCtx("glm-5.3-flash-x2"));
if (off !== null) fail("关：即使模型能命中也必须返回 null，不能覆盖手动规则");
fs.rmSync(routeHome, { recursive: true, force: true });

if (problems.length) {
  console.error("check-rules 失败：");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
const n = idsFrom(DEFAULTS, "DEFAULTS").size;
console.log(`check-rules 通过：${n} 个默认规则 id 都有 md+json，匹配与面板保存符合预期`);
