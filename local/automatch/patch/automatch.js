// 自动匹配：按模型决定用哪套规则。
//
// 决策顺序（优先级从高到低）：
//   1. routes  —— 精确指定：模型代号（清洗后）完全相等 → 用指定规则
//   2. map     —— 前缀匹配：长前缀优先，命中即用
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
    "glm-5.3": "glm53f",
    "glm-5.2": "glm52",
    "glm": "glm53f",
    "zhipu": "glm53f",
    "kimi-k3": "kimi3",
    "kimi": "kimi3",
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

export function normalizeModel(model) {
  return String(model || "")
    .toLowerCase()
    .replace(/^[a-z0-9_.-]+\//, "") // 去掉 provider/ 前缀
    .replace(/\[[^\]]*\]/g, "") // 去掉 [1m] 之类
    .replace(/\s+/g, "")
    .trim();
}

// ---- 三层决策 ----

/** 返回 { ruleId, how } —— how ∈ route | prefix | default */
export function decide(model, cfg) {
  const m = normalizeModel(model);
  if (!m) return { ruleId: "", how: "" };

  // 1) 精确指定
  if (cfg.routes && Object.prototype.hasOwnProperty.call(cfg.routes, m)) {
    return { ruleId: cfg.routes[m], how: "route" };
  }

  // 2) 前缀匹配（长前缀优先）
  const keys = Object.keys(cfg.map || {})
    .map((k) => [String(k).toLowerCase().replace(/\s+/g, ""), cfg.map[k]])
    .filter(([k, v]) => k && typeof v === "string" && v)
    .sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, ruleId] of keys) {
    if (m.startsWith(prefix) || m.includes(prefix)) return { ruleId, how: "prefix" };
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
