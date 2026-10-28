function autoRouteLine(cfg, rules) {
  const live = (cfg && cfg.live) || {};
  const found = live.ruleId ? rules.filter(function (r) { return r.id === live.ruleId; })[0] : null;
  const label = live.ruleId ? ((found && found.name) || live.ruleId) : "";
  if (!live.model) {
    return "还没有记下当前模型。发一句对话后，这里会显示命中哪条规则。";
  }
  if (cfg.enabled && live.ruleId) {
    return "当前模型 " + live.model + " → " + label;
  }
  if (cfg.enabled) {
    return "当前模型 " + live.model + " 没有命中，退回手动规则。";
  }
  if (live.ruleId) {
    return "当前模型 " + live.model + "。现在是关的，仍用手动规则。打开后将用 " + label + "。";
  }
  return "当前模型 " + live.model + "。现在是关的，用手动规则。打开后这条也不会命中，仍用手动规则。";
}

function AutoMatchBox() {
  const [cfg, setCfg] = useState(null);
  const [rules, setRules] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newRule, setNewRule] = useState("");
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    try {
      rulesApi("automatchGet", {}).then((d) => {
        if (d && d.ok) { setCfg(d.cfg || null); setRules(Array.isArray(d.rules) ? d.rules : []); }
        else setErr((d && d.error) || "读取失败");
      }).catch((e) => setErr(String(e && e.message || e)));
    } catch (e) { setErr(String(e && e.message || e)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (err) return h("p", { className: "dshpp-block-hint" }, "自动路由读取失败：" + err);
  if (!cfg) return h("p", { className: "dshpp-block-hint" }, "自动路由：读取中…");
  const routes = cfg.routes || {};
  const save = (next) => {
    setBusy(true); setMsg("");
    try {
      rulesApi("automatchSet", { cfg: next }).then((d) => {
        setBusy(false);
        if (d && d.ok) {
          const nextCfg = d.cfg || next;
          if (d.live) nextCfg.live = d.live;
          setCfg(nextCfg);
          setMsg(nextCfg.enabled ? "自动路由已开。下一轮对话生效，不用重启。" : "自动路由已关。下一轮对话生效，不用重启。");
        } else setMsg((d && d.error) || "保存失败");
      }).catch((e) => { setBusy(false); setMsg(String(e && e.message || e)); });
    } catch (e) { setBusy(false); setMsg(String(e && e.message || e)); }
  };
  const put = (model, rule) => {
    const next = {};
    const keys = Object.keys(routes);
    for (let k = 0; k < keys.length; k++) next[keys[k]] = routes[keys[k]];
    if (rule) next[model] = rule; else delete next[model];
    save({ enabled: cfg.enabled, routes: next, default: cfg.default || "", map: cfg.map || {} });
  };
  const ruleOptions = rules.map(function (x) {
    return h("option", { key: "o-" + x.id, value: x.id }, x.name || x.id);
  });
  const rows = Object.keys(routes).map(function (m) {
    return h("div", { key: "rt-" + m, className: "dshpp-create-row" },
      h("span", { style: { minWidth: 200, fontWeight: 600 } }, m),
      h("select", {
        className: "dshpp-field",
        style: { minWidth: 200 },
        value: routes[m],
        onChange: function (e) { put(m, e.target.value); }
      }, ruleOptions),
      h(Btn, { tiny: true, kind: "danger", disabled: busy, onClick: function () { put(m, ""); } }, "删除")
    );
  });
  const on = cfg.enabled !== false;
  return h("div", null,
    h("div", { className: "dshpp-create-row" },
      h("span", { style: { fontWeight: 700, marginRight: 8 } }, "自动路由：" + (on ? "开" : "关")),
      h(Btn, {
        tiny: true,
        kind: on ? "primary" : void 0,
        disabled: busy,
        onClick: function () { save({ enabled: !on }); }
      }, on ? "点此关闭" : "点此开启"),
      msg ? h("span", { className: "dshpp-block-hint", style: { marginLeft: 10 } }, msg) : null
    ),
    h("p", { className: "dshpp-block-hint" }, on
      ? "开：命中就整段换成对应规则，不和手动那份拼在一起。没命中则退回你点「启用」或 switch.ps1 写入的 prompt-inject.md。下一轮对话生效，不用重启。"
      : "关：不自动匹配。只用你点「启用」的规则，或 switch.ps1 写入的 prompt-inject.md。自动规则不会覆盖，也不会拼上去。下一轮对话生效，不用重启。"),
    h("p", { className: "dshpp-block-hint" }, autoRouteLine(cfg, rules)),
    h("p", { className: "dshpp-block-hint" }, "精确指定（优先于前缀）：某个模型代号固定用哪套规则"),
    rows.length ? rows : h("p", { className: "dshpp-block-hint" }, "（还没有精确指定）"),
    h("div", { className: "dshpp-create-row" },
      h("input", {
        className: "dshpp-field",
        placeholder: "模型代号，如 glm-5.3-flash",
        value: newModel,
        onChange: function (e) { setNewModel(e.target.value); }
      }),
      h("select", {
        className: "dshpp-field",
        style: { minWidth: 200 },
        value: newRule,
        onChange: function (e) { setNewRule(e.target.value); }
      }, [h("option", { key: "none", value: "" }, "选择规则…")].concat(ruleOptions)),
      h(Btn, {
        tiny: true,
        disabled: busy || !newModel.trim() || !newRule,
        onClick: function () {
          put(newModel.trim().toLowerCase().replace(/\s+/g, ""), newRule);
          setNewModel(""); setNewRule("");
        }
      }, "添加")
    )
  );
}
