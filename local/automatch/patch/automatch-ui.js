// 自动匹配的面板接口：给 /redteam/api 提供 automatchGet / automatchSet
// 只读写 $DSH_HOME/dsh-purge/automatch.json，不碰规则文件本身。
import fs from "node:fs";
import path from "node:path";
import * as automatch from "./automatch.js";

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); } catch { /* ignore */ }
}

function readRaw(dshHome) {
  try {
    return JSON.parse(fs.readFileSync(automatch.statePath(dshHome), "utf8")) || {};
  } catch {
    return {};
  }
}

function writeRaw(dshHome, data) {
  const file = automatch.statePath(dshHome);
  ensureDir(path.dirname(file));
  const clean = {
    enabled: data.enabled !== false,
    routes: data.routes && typeof data.routes === "object" ? data.routes : {},
    default: typeof data.default === "string" ? data.default : "",
    map: data.map && typeof data.map === "object" ? data.map : {},
    _说明: data._说明,
    _怎么精确指定: data._怎么精确指定,
    _档位含义: data._档位含义,
  };
  fs.writeFileSync(file, JSON.stringify(clean, null, 2), "utf8");
  return clean;
}

export function handleAutoMatchOp(dshHome, request) {
  const op = request && request.op;
  if (op === "automatchGet") {
    const raw = readRaw(dshHome);
    const cfg = automatch.readCfg(dshHome);
    let rules = [];
    try {
      // 异步版在 rules.js，这里用同步兜底：直接扫目录拿 id + 元数据
      const dir = path.join(dshHome, "rules");
      const names = fs.readdirSync(dir).filter((n) => n.endsWith(".md"));
      rules = names.map((n) => {
        const id = n.slice(0, -3);
        let name = id;
        let tier = 9;
        try {
          const meta = JSON.parse(fs.readFileSync(path.join(dir, id + ".json"), "utf8"));
          if (meta && meta.name) name = meta.name;
          if (meta && Number.isFinite(meta.tier)) tier = meta.tier;
        } catch { /* ignore */ }
        return { id, name, tier };
      }).sort((a, b) => (a.tier - b.tier) || a.id.localeCompare(b.id));
    } catch { rules = []; }
    return {
      ok: true,
      cfg: {
        enabled: cfg.enabled,
        routes: cfg.routes || {},
        default: cfg.default || "",
        map: cfg.map || {},
        rawEnabled: raw.enabled,
      },
      rules,
      path: automatch.statePath(dshHome),
    };
  }
  if (op === "automatchSet") {
    const next = request && request.cfg;
    if (!next || typeof next !== "object") return { ok: false, error: "缺少 cfg" };
    const saved = writeRaw(dshHome, next);
    // 清掉 1 秒缓存，让下一次注入立刻读到新配置
    const cfg = automatch.readCfg(dshHome);
    return { ok: true, cfg: { enabled: cfg.enabled, routes: cfg.routes, default: cfg.default, map: cfg.map }, saved };
  }
  return undefined;
}
