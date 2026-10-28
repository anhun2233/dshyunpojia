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
  if (err) return h("p", { className: "dshpp-block-hint" }, "自动匹配读取失败：" + err);
  if (!cfg) return h("p", { className: "dshpp-block-hint" }, "自动匹配：读取中…");
  const routes = cfg.routes || {};
  const save = (next) => {
    setBusy(true); setMsg("");
    try {
      rulesApi("automatchSet", { cfg: next }).then((d) => {
        setBusy(false);
        if (d && d.ok) { setCfg(d.cfg || next); setMsg("已保存"); }
        else setMsg((d && d.error) || "保存失败");
      }).catch((e) => { setBusy(false); setMsg(String(e && e.message || e)); });
    } catch (e) { setBusy(false); setMsg(String(e && e.message || e)); }
  };
  const put = (model, rule) => {
    const next = {};
    const keys = Object.keys(routes);
    for (let k = 0; k < keys.length; k++) next[keys[k]] = routes[keys[k]];
    if (rule) next[model] = rule; else delete next[model];
    const merged = { enabled: cfg.enabled, routes: next, default: cfg.default || "", map: cfg.map || {} };
    save(merged);
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
  return h("div", null,
    h("div", { className: "dshpp-create-row" },
      h("span", { style: { fontWeight: 600, marginRight: 8 } }, "自动匹配"),
      h(Btn, {
        tiny: true,
        kind: cfg.enabled ? "primary" : void 0,
        disabled: busy,
        onClick: function () { save({ enabled: !cfg.enabled, routes: routes, default: cfg.default || "", map: cfg.map || {} }); }
      }, cfg.enabled ? "已开启 · 点此关闭" : "已关闭 · 点此开启"),
      h("span", { className: "dshpp-block-hint", style: { marginLeft: 10 } },
        cfg.enabled ? "按当前模型代号自动选规则" : "按你最后一次点「启用」的规则"),
      msg ? h("span", { className: "dshpp-block-hint", style: { marginLeft: 10 } }, msg) : null
    ),
    h("p", { className: "dshpp-block-hint" }, "精确指定（优先于前缀匹配）：某个模型代号固定用哪套规则"),
    rows.length ? rows : h("p", { className: "dshpp-block-hint" }, "（还没有路由）"),
    h("div", { className: "dshpp-create-row" },
      h("input", {
        className: "dshpp-field",
        placeholder: "模型代号，如 deepseek-v4.1-flash",
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
