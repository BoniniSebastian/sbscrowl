(() => {
  /* =========================
     SB Trading v1 – app.js
     - Apple clean tabs
     - Movement-first engine (v1: manual price + base levels)
     - TradingView Advanced chart embed
     - Trade calculator + strict/loose gate
     - One-tap journal (Win/Loss/BE)
     ========================= */

  const $ = (id) => document.getElementById(id);

  const LS = {
    SETTINGS: "sbtr_v1_settings",
    INSTR: "sbtr_v1_instruments",
    JOURNAL: "sbtr_v1_journal",
    ACTIVE: "sbtr_v1_active_trade",
  };

  const DEFAULT_SETTINGS = {
    mode: "STRICT",         // STRICT | LOOSE
    adaptAfterTrades: 50,   // we decided
  };

  // NOTE: TradingView symbols vary by broker/feed.
  // If a symbol doesn't load, swap it here.
  const DEFAULT_INSTRUMENTS = [
    { key:"XAU", name:"Gold",      tv:"OANDA:XAUUSD",  price:null, base:{upper:null, lower:null}, state:"BASE" },
    { key:"XAG", name:"Silver",    tv:"OANDA:XAGUSD",  price:null, base:{upper:null, lower:null}, state:"BASE" },
    { key:"ETH", name:"Ethereum",  tv:"BITSTAMP:ETHUSD", price:null, base:{upper:null, lower:null}, state:"BASE" },
    { key:"JP225", name:"Japan 225", tv:"OANDA:JP225USD", price:null, base:{upper:null, lower:null}, state:"BASE" },
    { key:"FR40", name:"France 40",  tv:"OANDA:FR40EUR",  price:null, base:{upper:null, lower:null}, state:"BASE" },
    { key:"DE40", name:"Germany 40", tv:"OANDA:DE40EUR",  price:null, base:{upper:null, lower:null}, state:"BASE" },
    { key:"OIL", name:"Oil",       tv:"TVC:USOIL",     price:null, base:{upper:null, lower:null}, state:"BASE" },
  ];

  // ===== State =====
  let settings = loadLS(LS.SETTINGS, DEFAULT_SETTINGS);
  let instruments = loadLS(LS.INSTR, DEFAULT_INSTRUMENTS);
  let journal = loadLS(LS.JOURNAL, []); // each item = snapshot + outcome
  let activeKey = instruments[0]?.key || "XAU";
  let tvReady = false;
  let tvWidget = null;

  // ===== Views =====
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const views = {
    cockpit: $("view-cockpit"),
    detail: $("view-detail"),
    trade: $("view-trade"),
  };

  function setView(name){
    Object.values(views).forEach(v => v.classList.remove("active"));
    views[name].classList.add("active");
    tabs.forEach(t => t.classList.toggle("active", t.dataset.go === name));
  }

  // ===== Helpers =====
  function loadLS(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return structuredClone(fallback);
      return JSON.parse(raw);
    }catch{
      return structuredClone(fallback);
    }
  }
  function saveLS(key, val){
    localStorage.setItem(key, JSON.stringify(val));
  }
  function num(v){
    if(v === null || v === undefined) return null;
    const s = String(v).replace(",", ".").trim();
    if(!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  function fmt(n, d=2){
    if(n === null || n === undefined || !Number.isFinite(n)) return "—";
    return n.toFixed(d);
  }

  function getInstr(key){
    return instruments.find(x => x.key === key) || instruments[0];
  }

  // ===== Movement-first Engine (v1) =====
  // In v1 we don't have OHLCV feed.
  // We approximate movement from base size + a simple "session multiplier" stub.
  // Later: replace with true ATR/BB-width/vol metrics.
  function sessionMultiplier(){
    // Europe/Stockholm local hour
    const h = new Date().getHours();
    // rough heuristic: EU open 08-10, US open 15-17, otherwise calmer
    if(h >= 8 && h <= 10) return 1.15;
    if(h >= 15 && h <= 17) return 1.25;
    if(h >= 11 && h <= 13) return 0.85;
    return 1.0;
  }

  function computeEngine(instr, tfMin){
    const upper = num(instr.base?.upper);
    const lower = num(instr.base?.lower);
    const price = num(instr.price);

    // base geometry
    const haveBase = Number.isFinite(upper) && Number.isFinite(lower) && upper > lower;
    const range = haveBase ? (upper - lower) : null;
    const mid = haveBase ? (upper + lower)/2 : null;

    // expected move: start with range multiple adjusted by session
    // v1: base potential depends on range + session
    const sm = sessionMultiplier();
    const baseMult = haveBase ? (1.2 * sm) : null; // default "energy"
    const expected = haveBase ? (range * baseMult) : null;

    // energy score (0-100): v1 simplified
    // range relative to price (if price known) helps normalize across instruments
    let energy = null;
    if(haveBase && Number.isFinite(price) && price > 0){
      const rel = (range / price) * 100; // %
      // scale: small rel => low energy, bigger rel => higher
      energy = clamp(Math.round(rel * 120 * sm), 0, 100);
    }else if(haveBase){
      energy = clamp(Math.round(range * 8 * sm), 0, 100);
    }

    // trap risk: v1 rule
    // If base is tiny (low range) -> high chop -> high trap
    let trap = "—";
    if(haveBase && Number.isFinite(price) && price > 0){
      const rel = (range / price) * 100;
      if(rel < 0.08) trap = "High";
      else if(rel < 0.16) trap = "Medium";
      else trap = "Low";
    }else if(haveBase){
      trap = range < 1 ? "High" : (range < 4 ? "Medium" : "Low");
    }

    // projections based on range multiples (up/down)
    const proj = haveBase ? {
      p1:  { up: upper + 1.0*range, dn: lower - 1.0*range },
      p15: { up: upper + 1.5*range, dn: lower - 1.5*range },
      p2:  { up: upper + 2.0*range, dn: lower - 2.0*range },
    } : null;

    // model confidence: v1 derived from energy + having base + session
    let conf = null;
    if(energy !== null){
      conf = clamp(Math.round(45 + (energy*0.45) + (sm-1)*30), 0, 99);
    }

    // factor list for "Why?"
    const factors = [];
    if(haveBase) factors.push({ label:"Base range defined", score:+12 });
    if(expected !== null) factors.push({ label:`Session multiplier ${fmt(sm,2)}x`, score: Math.round((sm-1)*40) });
    if(energy !== null) factors.push({ label:`Relative range / movement`, score: Math.round(energy/6) });
    if(trap !== "—") factors.push({ label:`Trap risk: ${trap}`, score: trap==="Low"? +8 : (trap==="Medium"? -2 : -10) });

    return {
      upper, lower, mid, range,
      expectedMove: expected,
      energy,
      trap,
      conf,
      projections: proj,
      factors,
    };
  }

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  // ===== Strict/Loose Gate =====
  // v1 thresholds (will become per-instrument, then adaptive after 50 trades)
  function strictThresholds(tfMin){
    // micro TF needs more movement to beat noise
    if(tfMin <= 3) return { minEnergy: 62, minExpPct: 0.22 };
    if(tfMin <= 5) return { minEnergy: 58, minExpPct: 0.18 };
    return { minEnergy: 52, minExpPct: 0.14 };
  }

  function getExpectedPct(engine, price){
    if(engine.expectedMove === null || !Number.isFinite(price) || price <= 0) return null;
    // expected move approx as percent of price using 1.2x*range
    // (expectedMove is points; dividing by price gives percent)
    return (engine.expectedMove / price) * 100;
  }

  // ===== UI Renders =====
  function renderMode(){
    $("modeBtn").textContent = settings.mode === "STRICT" ? "Strict" : "Loose";
    $("subTitle").textContent = settings.mode === "STRICT" ? "Movement gate ON" : "Movement gate OFF";
  }

  function renderCockpit(){
    const grid = $("cockpitGrid");
    grid.innerHTML = "";

    instruments.forEach(instr => {
      const engine = computeEngine(instr, 5);
      const state = instr.state || "BASE";

      const card = document.createElement("div");
      card.className = "instrumentCard";
      card.onclick = () => {
        activeKey = instr.key;
        setView("detail");
        renderDetail();
      };

      const chipClass = state === "BASE" ? "base" : (state === "CONTINUATION" ? "cont" : "rev");

      card.innerHTML = `
        <div class="topRow">
          <div class="sym">${instr.key}</div>
          <div class="stateChip ${chipClass}">${state}</div>
        </div>
        <div class="metricRow">
          <div class="metric">
            <div class="k">Energy</div>
            <div class="v">${engine.energy ?? "—"}</div>
          </div>
          <div class="metric">
            <div class="k">Expected</div>
            <div class="v">${engine.expectedMove !== null ? fmt(engine.expectedMove,2) : "—"}</div>
          </div>
          <div class="metric">
            <div class="k">Trap</div>
            <div class="v">${engine.trap}</div>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function setStateButtons(state){
    const map = {
      REVERSAL: $("state-reversal"),
      BASE: $("state-base"),
      CONTINUATION: $("state-cont"),
    };
    Object.entries(map).forEach(([k,btn]) => btn.classList.toggle("active", k===state));
  }

  function renderDetail(){
    const instr = getInstr(activeKey);
    const tfMin = 5; // detail uses general snapshot in v1
    const engine = computeEngine(instr, tfMin);

    $("detailTitle").textContent = `${instr.key} – ${instr.name}`;
    $("detailMeta").textContent = `TV: ${instr.tv || "—"}`;

    $("tvSymbolChip").textContent = instr.tv || "—";

    // state
    setStateButtons(instr.state || "BASE");

    // kvs
    $("energyVal").textContent = engine.energy ?? "—";
    $("expMoveVal").textContent = engine.expectedMove !== null ? `${fmt(engine.expectedMove,2)} pts` : "—";
    $("trapVal").textContent = engine.trap;

    $("upperVal").textContent = engine.upper !== null ? fmt(engine.upper,2) : "—";
    $("lowerVal").textContent = engine.lower !== null ? fmt(engine.lower,2) : "—";
    $("midVal").textContent   = engine.mid !== null   ? fmt(engine.mid,2)   : "—";

    if(engine.projections){
      $("proj1").textContent  = `Up ${fmt(engine.projections.p1.up,2)} | Down ${fmt(engine.projections.p1.dn,2)}`;
      $("proj15").textContent = `Up ${fmt(engine.projections.p15.up,2)} | Down ${fmt(engine.projections.p15.dn,2)}`;
      $("proj2").textContent  = `Up ${fmt(engine.projections.p2.up,2)} | Down ${fmt(engine.projections.p2.dn,2)}`;
    }else{
      $("proj1").textContent = $("proj15").textContent = $("proj2").textContent = "—";
    }

    $("modelConf").textContent = `Model confidence: ${engine.conf ?? "—"}`;

    // why list
    const list = $("whyList");
    list.innerHTML = "";
    engine.factors.slice(0,6).forEach(f => {
      const li = document.createElement("li");
      const s = f.score >= 0 ? `+${f.score}` : `${f.score}`;
      li.textContent = `${f.label} (${s})`;
      list.appendChild(li);
    });

    // chart embed
    mountTradingView(instr.tv);

    // update trade instrument dropdown default
    $("tradeInstrument").value = instr.key;
  }

  // ===== TradingView Embed =====
  function ensureTradingViewScript(){
    return new Promise((resolve) => {
      if(window.TradingView){
        tvReady = true;
        resolve(true);
        return;
      }
      const s = document.createElement("script");
      s.src = "https://s3.tradingview.com/tv.js";
      s.async = true;
      s.onload = () => { tvReady = true; resolve(true); };
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  async function mountTradingView(symbol){
    const el = $("tvChart");
    el.innerHTML = ""; // remount

    const ok = await ensureTradingViewScript();
    if(!ok || !window.TradingView){
      el.innerHTML = `<div style="padding:14px;color:rgba(255,255,255,.7)">TradingView script blocked or offline.</div>`;
      return;
    }

    // Create widget
    try{
      tvWidget = new window.TradingView.widget({
        autosize: true,
        symbol: symbol || "OANDA:XAUUSD",
        interval: "5",
        timezone: "Europe/Stockholm",
        theme: "dark",
        style: "1",
        locale: "sv_SE",
        toolbar_bg: "rgba(0,0,0,0)",
        enable_publishing: false,
        allow_symbol_change: false,
        hide_top_toolbar: false,
        hide_side_toolbar: false,
        container_id: "tvChart",
      });
    }catch(e){
      el.innerHTML = `<div style="padding:14px;color:rgba(255,255,255,.7)">TradingView widget failed to load.</div>`;
    }
  }

  // ===== Trade calculator + validator =====
  function renderTradeSelectors(){
    const sel = $("tradeInstrument");
    sel.innerHTML = instruments.map(i => `<option value="${i.key}">${i.key} – ${i.name}</option>`).join("");
    sel.value = activeKey;
  }

  function calcPL({dir, entry, exit, stake, lev}){
    // CFD-like approx: P/L ≈ exposure * %move (directional)
    const expo = stake * lev;
    const movePct = dir === "L" ? (exit - entry) / entry : (entry - exit) / entry;
    return expo * movePct;
  }

  function validateTrade(){
    const instr = getInstr($("tradeInstrument").value);
    const tfMin = Number($("tradeTf").value);

    const dir = $("tradeDir").value;
    const entry = num($("tradeEntry").value);
    const sl = num($("tradeSL").value);
    const tp = num($("tradeTP").value);
    const stake = num($("tradeStake").value);
    const lev = num($("tradeLev").value);

    // Results
    if(![entry,sl,tp,stake,lev].every(Number.isFinite) || entry <= 0 || stake <= 0 || lev <= 0){
      $("resExpo").textContent = "—";
      $("resRisk").textContent = "—";
      $("resRew").textContent  = "—";
      $("resRR").textContent   = "—";
      $("goLabel").textContent = "—";
      $("goLabel").className = "go neutral";
      $("goNote").textContent = "Fyll i Entry/SL/TP + insats/hävstång";
      return { ok:false };
    }

    const expo = stake * lev;
    $("resExpo").textContent = `${fmt(expo,0)}`;

    const risk = calcPL({dir, entry, exit: sl, stake, lev});     // will be negative for correct stop side
    const rew  = calcPL({dir, entry, exit: tp, stake, lev});

    // make them "display" as positive/negative properly
    $("resRisk").textContent = `${fmt(risk,0)}`;
    $("resRew").textContent  = `${fmt(rew,0)}`;

    const riskAbs = Math.abs(risk);
    const rewAbs = Math.abs(rew);
    const rr = riskAbs > 0 ? (rewAbs / riskAbs) : null;
    $("resRR").textContent = rr !== null ? `1 : ${fmt(rr,2)}` : "—";

    // Movement gate
    const engine = computeEngine(instr, tfMin);
    const expectedPct = getExpectedPct(engine, num(instr.price) ?? entry); // use manual price if exists, else entry
    const th = strictThresholds(tfMin);

    let decision = "CAUTION";
    let note = "";

    // Basic sanity: stop must be on correct side
    const stopOk = (dir === "L" ? sl < entry : sl > entry);
    const tpOk = (dir === "L" ? tp > entry : tp < entry);
    if(!stopOk || !tpOk){
      decision = "NO";
      note = "Stop/Target ligger på fel sida om entry.";
    }else{
      // Strict movement blocking
      if(settings.mode === "STRICT"){
        const energyOk = (engine.energy ?? 0) >= th.minEnergy;
        const expOk = expectedPct !== null ? expectedPct >= th.minExpPct : true; // if we don't know pct, don't block on it
        if(!energyOk || !expOk){
          decision = "NO";
          note = "Insufficient movement (low energy/expected move).";
        }else if(rr !== null && rr < 1.2){
          decision = "CAUTION";
          note = "R:R är svagt för din hävstång.";
        }else{
          decision = "GO";
          note = "Movement gate OK + rimlig R:R.";
        }
      }else{
        // Loose
        if(rr !== null && rr < 1.1){
          decision = "CAUTION";
          note = "R:R är låg (Loose mode tillåter).";
        }else{
          decision = "GO";
          note = "OK (Loose mode).";
        }
      }
    }

    $("goLabel").textContent = decision;
    $("goLabel").className = "go " + (decision==="GO" ? "good" : (decision==="NO" ? "bad" : "neutral"));
    $("goNote").textContent = note || "—";

    return {
      ok:true,
      decision,
      snapshot: makeSnapshot(instr, tfMin, decision),
    };
  }

  function makeSnapshot(instr, tfMin, decision){
    const engine = computeEngine(instr, tfMin);
    return {
      t: Date.now(),
      instrument: instr.key,
      tf: tfMin,
      mode: settings.mode,
      state: instr.state || "BASE",
      energy: engine.energy,
      expectedMove: engine.expectedMove,
      trap: engine.trap,
      conf: engine.conf,
      decision,
    };
  }

  // ===== Journal =====
  function openResultModal(snapshot){
    saveLS(LS.ACTIVE, snapshot);
    $("resultMeta").textContent = `${snapshot.instrument} • ${snapshot.tf}m • ${snapshot.state} • ${snapshot.mode} • ${snapshot.decision}`;
    $("resultModal").hidden = false;
  }

  function closeResultModal(){
    $("resultModal").hidden = true;
  }

  function logOutcome(outcome){
    const snap = loadLS(LS.ACTIVE, null);
    if(!snap) return;

    journal.push({ ...snap, outcome });
    saveLS(LS.JOURNAL, journal);
    localStorage.removeItem(LS.ACTIVE);
    closeResultModal();
    renderPerformance();
  }

  function renderPerformance(){
    const total = journal.length;
    const w = journal.filter(x => x.outcome === "WIN").length;
    const l = journal.filter(x => x.outcome === "LOSS").length;
    const b = journal.filter(x => x.outcome === "BE").length;
    const wr = total ? Math.round((w/total)*100) : null;

    let line = "—";
    if(total){
      line = `Trades: ${total} • Win: ${w} • Loss: ${l} • BE: ${b} • Winrate: ${wr}%`;
      if(total < settings.adaptAfterTrades){
        line += ` • Adaptive starts at ${settings.adaptAfterTrades}`;
      }else{
        line += ` • Adaptive ACTIVE`;
      }
    }
    $("perfLine").textContent = line;
  }

  function resetJournal(){
    journal = [];
    saveLS(LS.JOURNAL, journal);
    renderPerformance();
  }

  // ===== Edit levels =====
  function openLevelsModal(){
    const instr = getInstr(activeKey);
    $("levelsModalMeta").textContent = `${instr.key} • ${instr.name}`;
    $("lvlUpper").value = instr.base?.upper ?? "";
    $("lvlLower").value = instr.base?.lower ?? "";
    $("levelsModal").hidden = false;
  }
  function closeLevelsModal(){ $("levelsModal").hidden = true; }

  function saveLevels(){
    const instr = getInstr(activeKey);
    const upper = num($("lvlUpper").value);
    const lower = num($("lvlLower").value);

    // save even if null, but if one is set require both for base
    instr.base = instr.base || { upper:null, lower:null };
    instr.base.upper = upper;
    instr.base.lower = lower;

    saveLS(LS.INSTR, instruments);
    closeLevelsModal();
    renderDetail();
    renderCockpit();
  }

  // ===== Wiring =====
  function wire(){
    // Tabs
    tabs.forEach(btn => btn.addEventListener("click", () => {
      const v = btn.dataset.go;
      setView(v);
      if(v === "cockpit") renderCockpit();
      if(v === "detail") renderDetail();
      if(v === "trade") validateTrade();
    }));

    // Mode toggle
    $("modeBtn").addEventListener("click", () => {
      settings.mode = settings.mode === "STRICT" ? "LOOSE" : "STRICT";
      saveLS(LS.SETTINGS, settings);
      renderMode();
      validateTrade();
    });

    // State buttons
    const stateBtns = [$("state-reversal"), $("state-base"), $("state-cont")];
    stateBtns.forEach(b => b.addEventListener("click", () => {
      const instr = getInstr(activeKey);
      instr.state = b.dataset.state;
      saveLS(LS.INSTR, instruments);
      setStateButtons(instr.state);
      renderCockpit();
      validateTrade();
    }));

    // Why toggle
    $("whyBtn").addEventListener("click", () => {
      const s = $("whySheet");
      s.hidden = !s.hidden;
    });

    // Edit levels
    $("editLevelsBtn").addEventListener("click", openLevelsModal);
    $("closeLevelsBtn").addEventListener("click", closeLevelsModal);
    $("saveLevelsBtn").addEventListener("click", saveLevels);

    // Trade selectors
    renderTradeSelectors();
    ["tradeInstrument","tradeTf","tradeDir","tradeEntry","tradeSL","tradeTP","tradeStake","tradeLev"].forEach(id => {
      $(id).addEventListener("input", validateTrade);
      $(id).addEventListener("change", validateTrade);
    });

    // Start trade -> open result
    $("startTradeBtn").addEventListener("click", () => {
      const r = validateTrade();
      if(!r.ok) return;
      openResultModal(r.snapshot);
    });

    // Result modal actions
    $("closeResultBtn").addEventListener("click", closeResultModal);
    $("resultModal").addEventListener("click", (e) => {
      if(e.target === $("resultModal")) closeResultModal();
    });
    document.querySelectorAll(".bigBtn").forEach(b => {
      b.addEventListener("click", () => logOutcome(b.dataset.outcome));
    });

    // Reset journal
    $("clearJournalBtn").addEventListener("click", resetJournal);

    // Levels modal outside click
    $("levelsModal").addEventListener("click", (e) => {
      if(e.target === $("levelsModal")) closeLevelsModal();
    });
  }

  // ===== Init =====
  function init(){
    // Ensure instruments always have required fields (future-proof)
    instruments = instruments.map(x => ({
      ...x,
      base: x.base || { upper:null, lower:null },
      state: x.state || "BASE",
    }));
    saveLS(LS.INSTR, instruments);

    renderMode();
    setView("cockpit");
    renderCockpit();
    renderPerformance();
    wire();
  }

  init();
})();
