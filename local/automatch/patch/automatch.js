// 自动匹配：按模型决定用哪套规则。
//
// 决策顺序（优先级从高到低）：
//   1. routes  —— 精确指定：模型代号（清洗后）完全相等 → 用指定规则
//   2. map     —— 键写官方模型全名（含厂商自己的后缀，如 flash / pro / turbo）。
//                 最长键优先，只比开头。官方名后面中转站再加的 -x2、-ts、中转代号会被忽略。
//                 短键（glm、kimi）只是兜底。比较前去掉空白和 - _ . ，空格写法和连字符写法才能对上。
//                 默认不做包含匹配。includes: true 时，开头都没命中才再包含匹配。
//                 用户电脑上的旧脚本默认还带 includes 兜底，和这里不同。
//   3. default —— 兜底规则 id（可为空）
//   4. 以上都没命中 → 返回 null，由调用方回落到 prompt-inject.md
//
// 开关：tuning.json 的 autoMatch
// 配置：$DSH_HOME/dsh-purge/automatch.json
// 任何异常都返回 null / 空串，绝不把注入搞没。
import fs from "node:fs";
import path from "node:path";

export const DEFAULTS = {
  enabled: true,
  includes: false, // true 时，前缀（开头）都没命中才做一次 includes
  routes: {},   // "deepseek-v4.1-flash": "ds41"
  default: "",  // "" = 不兜底，回落 prompt-inject.md
  map: {
    "deepseek-v4.1": "dsv4",
    "deepseek-4-1": "ds41",
    "deepseek-v4": "dsv4",
    "deepseek-v3": "dsv3",
    "deepseek": "dsv4",
    "grok-4.7": "grok",
    "grok-4": "grok",
    "grok": "grok",
    "glm-5.3-flash": "glm53f",
    "glm-5.3": "glm53f",
    "glm-5.2": "glm52",
    "glm": "glm53f",
    "zhipu": "glm53f",
    "kimi-k3": "kimi3",
    "kimi": "kimi3",
    "qwen-3.7": "qwen",
    "qwen": "qwen",
    "gemini": "gemini",
    "claude-opus": "unified",
    "claude-sonnet": "unified",
    "claude": "unified",
    "opus": "unified",
    "sonnet": "unified",
    "mistral": "unified",
  },
};

export function statePath(dshHome) {
  return path.join(dshHome, "dsh-purge", "automatch.json");
}

let cache = { at: 0, cfg: null, mtime: 0 };

export function readCfg(dshHome) {
  const file = statePath(dshHome);
  let mtime = 0;
  try { mtime = fs.statSync(file).mtimeMs; } catch { mtime = 0; }
  if (cache.cfg && cache.mtime === mtime && Date.now() - cache.at < 1000) return cache.cfg;
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(file, "utf8")) || {}; } catch { saved = {}; }
  const normRoutes = {};
  if (saved.routes && typeof saved.routes === "object") {
    for (const [k, v] of Object.entries(saved.routes)) {
      if (typeof v !== "string" || !v) continue;
      normRoutes[normalizeModel(k)] = v;
    }
  }
  const map = { ...DEFAULTS.map, ...(saved.map && typeof saved.map === "object" ? saved.map : {}) };
  const cfg = {
    enabled: saved.enabled === undefined ? DEFAULTS.enabled : saved.enabled !== false,
    includes: saved.includes === undefined ? DEFAULTS.includes === true : saved.includes === true,
    routes: normRoutes,
    default: typeof saved.default === "string" ? saved.default.trim() : DEFAULTS.default,
    map,
  };
  cache = { at: Date.now(), cfg, mtime };
  return cfg;
}

// ---- 当前模型 ----

const bySession = new Map();
let lastAny = "";

export function record(sessionId, model) {
  const m = String(model || "").trim();
  if (!m) return;
  lastAny = m;
  if (sessionId) bySession.set(String(sessionId), m);
}

function fromHeader(context) {
  try {
    const cfg = context?.agent?.session?.requestHeader?.()?.config;
    if (cfg && cfg.model) return String(cfg.model);
  } catch { /* ignore */ }
  return "";
}

export function pickModel(context) {
  const h = fromHeader(context);
  if (h) {
    record(context?.agent?.session?.id, h);
    return h;
  }
  const sid = context?.agent?.session?.id;
  if (sid && bySession.has(String(sid))) return bySession.get(String(sid));
  return lastAny;
}

// ---- 代号清洗 ----
// 只看前缀、忽略后缀。这里先得到可比的代号，还不去掉 - _ . 。
// routes 的精确匹配用这一步的结果，所以 exact 键必须和清洗后的整串一致。

export function normalizeModel(model) {
  return String(model || "")
    .toLowerCase()
    .replace(/^[a-z0-9_.-]+\//, "") // 去掉开头的 provider/ ，中转站名字不参与匹配
    .replace(/\[[^\]]*\]/g, "") // 去掉 [1m] 这类标签
    .replace(/\s+/g, "") // 去掉所有空白：「GLM 5.3 flash」→ glm5.3flash
    .trim();
}

// 前缀比较专用。清洗后的代号和 map 键都再去掉 - _ . ，只为对齐空格和连字符两种写法。
// 「GLM 5.3 Flash」变成 glm53flash，键 glm-5.3-flash 也是 glm53flash，开头就能对上。
// flash / pro 这类官方后缀留在键里，不会被这段替换删掉。中转站加在官方名后面的字符
// 因为不是更长的键，比开头时留在尾部，不单独成一条规则。
export function foldPrefix(s) {
  return String(s || "").replace(/[-_.]/g, "");
}

// ---- 三层决策 ----

/** 返回 { ruleId, how } —— how ∈ route | prefix | contains | default */
export function decide(model, cfg) {
  const m = normalizeModel(model);
  if (!m) return { ruleId: "", how: "" };

  // 1) 精确指定
  if (cfg.routes && Object.prototype.hasOwnProperty.call(cfg.routes, m)) {
    return { ruleId: cfg.routes[m], how: "route" };
  }

  // 2) 官方全名当键，最长优先，只比开头。
  //    键同样小写、去空白，再和模型一起去掉 - _ . （只对齐写法，不删 flash 这类官方后缀）。
  //    中转站加在官方名后面的 -x2 / -ts 因为不是更长的键，留在串尾。短键只是兜底。
  //    先做完所有 startsWith，可选的 includes 不能抢走更长的真正前缀。
  const folded = foldPrefix(m);
  const keys = Object.keys(cfg.map || {})
    .map((k) => {
      const raw = String(k).toLowerCase().replace(/\s+/g, "");
      return [raw, foldPrefix(raw), cfg.map[k]];
    })
    .filter(([, foldedKey, v]) => foldedKey && typeof v === "string" && v)
    .sort((a, b) => b[1].length - a[1].length || b[0].length - a[0].length);
  for (const [, prefix, ruleId] of keys) {
    if (folded.startsWith(prefix)) return { ruleId, how: "prefix" };
  }
  // 默认关。打开后才在「开头都对不上」时做包含匹配，比较用的也是去掉分隔符的串。
  if (cfg.includes === true) {
    for (const [, prefix, ruleId] of keys) {
      if (folded.includes(prefix)) return { ruleId, how: "contains" };
    }
  }

  // 3) 兜底
  if (cfg.default) return { ruleId: cfg.default, how: "default" };
  return { ruleId: "", how: "" };
}

export function matchRule(model, map) {
  return decide(model, { routes: {}, default: "", map }).ruleId;
}

export function readRuleText(dshHome, ruleId) {
  const id = String(ruleId || "").trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(id)) return "";
  try {
    const text = fs.readFileSync(path.join(dshHome, "rules", id + ".md"), "utf8");
    return text && text.trim() ? text : "";
  } catch {
    return "";
  }
}

/** 解析该用哪套文本。返回 { text, ruleId, model, how } 或 null。 */
export function resolve(dshHome, context) {
  const cfg = readCfg(dshHome);
  if (!cfg.enabled) return null;
  const model = pickModel(context);
  if (!model) return null;
  const d = decide(model, cfg);
  if (!d.ruleId) return null;
  const text = readRuleText(dshHome, d.ruleId);
  if (!text) return null;
  return { text, ruleId: d.ruleId, model, how: d.how };
}
