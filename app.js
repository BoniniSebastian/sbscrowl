(() => {
  "use strict";

  /* =========================
     SBScrowl – app.js
     - iPhone-first, no body scroll
     - Wheel-driven views
     - Bottom sheet (glass) 85vh
     - SB Dash-like views (weather/news/todo/ideas/done) + calendar
     - Aktiv prio (localStorage + modal edit)
     - Generic swipe helper
     - Robust storage
     ========================= */

  const ASSETS = {
    ring: "assets/ui/knob-ring.svg",
    weather: "assets/ui/icon-weather.svg",
    news: "assets/ui/icon-news.svg",
    todo: "assets/ui/icon-todo.svg",
    ideas: "assets/ui/icon-ideas.svg",
    done: "assets/ui/icon-done.svg",
    pomodoro: "assets/ui/icon-pomodoro.svg"
  };

  // Views in the wheel (icons must exist in assets)
  const VIEWS = [
    { id: "weather", label: "Weather", icon: ASSETS.weather },
    { id: "news", label: "News", icon: ASSETS.news },
    { id: "todo", label: "Todo", icon: ASSETS.todo },
    { id: "ideas", label: "Ideas", icon: ASSETS.ideas },
    { id: "done", label: "Done", icon: ASSETS.done },
    // We reuse icon-pomodoro.svg for Calendar (as requested: no new icons)
    { id: "calendar", label: "Calendar", icon: ASSETS.pomodoro }
  ];

  const KEYS = {
    todo: "sbscrowl.todo.v1",
    ideas: "sbscrowl.ideas.v1",
    done: "sbscrowl.done.v1",     // items with {id,text,ts,source:'todo'|'ideas'}
    prio: "sbscrowl.prio.v1",
    calUrl: "sbscrowl.calendarUrl.v1",
    lastView: "sbscrowl.lastView.v1"
  };

  const $ = (sel, root = document) => root.querySelector(sel);

  const els = {
    sheet: $("#sheet"),
    sheetClose: $("#sheetClose"),
    sheetTitleText: $("#sheetTitleText"),
    sheetScroll: $("#sheetScroll"),
    viewContainer: $("#viewContainer"),
    miniStatus: $("#miniStatus"),

    wheelDock: $("#wheelDock"),
    wheelTrack: $("#wheelTrack"),
    wheelTap: $("#wheelTap"),
    wheelCenterImg: $("#wheelCenterImg"),
    wheelCenterLabel: $("#wheelCenterLabel"),

    prioCard: $("#prioCard"),
    prioValue: $("#prioValue"),
    prioModal: $("#prioModal"),
    prioInput: $("#prioInput"),
    prioCancel: $("#prioCancel"),
    prioSave: $("#prioSave")
  };

  const state = {
    isOpen: false,
    activeIndex: 0,
    previewIndex: 0,
    wheel: {
      itemW: 78,
      snapTimer: null,
      lastScrollTs: 0
    },
    data: {
      todo: [],
      ideas: [],
      done: [],
      prio: "",
      calendarUrl: ""
    }
  };

  /* ---------------- Storage ---------------- */

  function safeParseJSON(str, fallback) {
    try {
      const v = JSON.parse(str);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  function loadData() {
    state.data.todo = safeParseJSON(localStorage.getItem(KEYS.todo), []);
    state.data.ideas = safeParseJSON(localStorage.getItem(KEYS.ideas), []);
    state.data.done = safeParseJSON(localStorage.getItem(KEYS.done), []);
    state.data.prio = (localStorage.getItem(KEYS.prio) || "").trim();
    state.data.calendarUrl = (localStorage.getItem(KEYS.calUrl) || "").trim();

    // Ensure arrays
    if (!Array.isArray(state.data.todo)) state.data.todo = [];
    if (!Array.isArray(state.data.ideas)) state.data.ideas = [];
    if (!Array.isArray(state.data.done)) state.data.done = [];
  }

  function saveList(key, arr) {
    localStorage.setItem(key, JSON.stringify(arr));
  }

  function setPrio(text) {
    state.data.prio = (text || "").trim();
    localStorage.setItem(KEYS.prio, state.data.prio);
    renderPrio();
  }

  function setCalendarUrl(url) {
    state.data.calendarUrl = (url || "").trim();
    localStorage.setItem(KEYS.calUrl, state.data.calendarUrl);
  }

  /* ---------------- Sheet open/close ---------------- */

  function setSheetOpen(open) {
    state.isOpen = !!open;
    els.sheet.dataset.open = state.isOpen ? "true" : "false";
  }

  function openSheet() {
    setSheetOpen(true);
    // When opening, immediately render current preview index
    setViewByIndex(state.previewIndex, { persist: true, fromWheel: true });
    // Focus scroll for iOS momentum consistency (optional)
    requestAnimationFrame(() => {
      try { els.sheetScroll.focus({ preventScroll: true }); } catch {}
    });
  }

  function closeSheet() {
    setSheetOpen(false);
  }

  /* ---------------- Wheel ---------------- */

  function buildWheel() {
    // inner padding so first/last can center
    const padL = document.createElement("div");
    padL.className = "wheelTrackInnerPad";
    const padR = document.createElement("div");
    padR.className = "wheelTrackInnerPad";

    els.wheelTrack.innerHTML = "";
    els.wheelTrack.appendChild(padL);

    VIEWS.forEach((v, idx) => {
      const item = document.createElement("div");
      item.className = "wheelItem";
      item.dataset.index = String(idx);
      item.dataset.view = v.id;

      const img = document.createElement("img");
      img.src = v.icon;
      img.alt = v.label;
      item.appendChild(img);

      // Tap on a specific icon: scroll it into center (and if open, switch view)
      item.addEventListener("click", (e) => {
        e.preventDefault();
        scrollWheelToIndex(idx, { smooth: true });
        if (state.isOpen) setViewByIndex(idx, { persist: true, fromWheel: true });
        else setPreviewIndex(idx);
      });

      els.wheelTrack.appendChild(item);
    });

    els.wheelTrack.appendChild(padR);

    // measure item width from CSS variable-ish
    // (fallback 78)
    state.wheel.itemW = measureWheelItemWidth() || 78;

    // Initial active index from storage
    const saved = parseInt(localStorage.getItem(KEYS.lastView) || "0", 10);
    const initial = Number.isFinite(saved) ? clamp(saved, 0, VIEWS.length - 1) : 0;
    state.activeIndex = initial;
    state.previewIndex = initial;

    // set center UI
    updateWheelUI(initial);

    // scroll into position after layout
    requestAnimationFrame(() => {
      scrollWheelToIndex(initial, { smooth: false });
      markWheelActive(initial);
    });
  }

  function measureWheelItemWidth() {
    const first = els.wheelTrack.querySelector(".wheelItem");
    if (!first) return 78;
    const rect = first.getBoundingClientRect();
    return Math.round(rect.width) || 78;
  }

  function markWheelActive(idx) {
    els.wheelTrack.querySelectorAll(".wheelItem").forEach((el) => {
      const i = parseInt(el.dataset.index || "0", 10);
      el.classList.toggle("isActive", i === idx);
    });
  }

  function updateWheelUI(idx) {
    const v = VIEWS[idx];
    if (!v) return;
    els.wheelCenterImg.src = v.icon;
    els.wheelCenterLabel.textContent = v.label;
  }

  function setPreviewIndex(idx) {
    state.previewIndex = idx;
    updateWheelUI(idx);
    markWheelActive(idx);
    // Mini status (top right)
    els.miniStatus.textContent = state.isOpen ? `View: ${VIEWS[idx].label}` : `Preview: ${VIEWS[idx].label}`;
  }

  function getNearestIndexFromScroll() {
    const track = els.wheelTrack;
    const itemW = state.wheel.itemW || 78;

    // Because we have left padding element that centers,
    // the "centered index" corresponds to scrollLeft / itemW rounded,
    // but we need to account for the pad.
    // With our padding div having width ~ (trackWidth - itemW)/2,
    // the first actual item center aligns at scrollLeft ~= 0.
    // So nearest index is simply round(scrollLeft / itemW).
    const raw = track.scrollLeft / itemW;
    const idx = Math.round(raw);
    return clamp(idx, 0, VIEWS.length - 1);
  }

  function scrollWheelToIndex(idx, { smooth }) {
    const track = els.wheelTrack;
    const itemW = state.wheel.itemW || 78;
    const left = idx * itemW;
    try {
      track.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
    } catch {
      track.scrollLeft = left;
    }
  }

  function snapWheel() {
    const idx = getNearestIndexFromScroll();
    scrollWheelToIndex(idx, { smooth: true });
    setPreviewIndex(idx);

    if (state.isOpen) {
      setViewByIndex(idx, { persist: true, fromWheel: true });
    }
  }

  function onWheelScroll() {
    // Live update while scrolling
    const idx = getNearestIndexFromScroll();
    if (idx !== state.previewIndex) {
      setPreviewIndex(idx);
      if (state.isOpen) {
        // Switch view live while open
        setViewByIndex(idx, { persist: true, fromWheel: true, noSnapUpdate: true });
      }
    }

    // Debounced snap when user stops
    if (state.wheel.snapTimer) clearTimeout(state.wheel.snapTimer);
    state.wheel.snapTimer = setTimeout(() => snapWheel(), 120);
  }

  /* ---------------- View switching ---------------- */

  function setViewByIndex(idx, opts = {}) {
    const { persist = false, fromWheel = false, noSnapUpdate = false } = opts;
    idx = clamp(idx, 0, VIEWS.length - 1);

    state.activeIndex = idx;
    if (!noSnapUpdate) state.previewIndex = idx;

    const v = VIEWS[idx];
    els.sheetTitleText.textContent = v.label;

    if (persist) localStorage.setItem(KEYS.lastView, String(idx));

    // Update wheel UI/active marker
    updateWheelUI(idx);
    markWheelActive(idx);

    // Render view
    renderView(v.id);

    // If change was not from wheel and sheet is open, align wheel
    if (state.isOpen && !fromWheel) {
      scrollWheelToIndex(idx, { smooth: true });
    }

    els.miniStatus.textContent = state.isOpen ? `View: ${v.label}` : `Preview: ${v.label}`;
  }

  function renderView(viewId) {
    // Keep scroll position near top on view switch (like carousel)
    els.sheetScroll.scrollTop = 0;

    switch (viewId) {
      case "weather":
        renderWeather();
        break;
      case "news":
        renderNews();
        break;
      case "todo":
        renderTodo();
        break;
      case "ideas":
        renderIdeas();
        break;
      case "done":
        renderDone();
        break;
      case "calendar":
        renderCalendar();
        break;
      default:
        els.viewContainer.innerHTML = `<div class="card"><div class="cardTitle">Okänt view</div><div class="muted">${escapeHtml(viewId)}</div></div>`;
    }
  }

  /* ---------------- Generic Swipe Helper ---------------- */

  function attachSwipe(frontEl, {
    onSwipeLeft,
    onSwipeRight,
    threshold = 64,
    max = 110
  }) {
    let startX = 0;
    let curX = 0;
    let dragging = false;

    const setX = (x) => {
      const clamped = clamp(x, -max, max);
      frontEl.style.transform = `translateX(${clamped}px)`;
      curX = clamped;
    };

    const reset = () => {
      frontEl.style.transition = "transform 140ms cubic-bezier(0.22,1,0.36,1)";
      setX(0);
      setTimeout(() => (frontEl.style.transition = ""), 160);
    };

    frontEl.addEventListener("pointerdown", (e) => {
      // prevent accidental vertical scroll lock; only begin after some move
      dragging = true;
      startX = e.clientX;
      curX = 0;
      frontEl.setPointerCapture?.(e.pointerId);
    }, { passive: true });

    frontEl.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      // Only horizontal response; do not prevent default to keep scroll natural
      setX(dx);
    }, { passive: true });

    const end = () => {
      if (!dragging) return;
      dragging = false;

      if (curX <= -threshold) {
        // left
        onSwipeLeft && onSwipeLeft();
      } else if (curX >= threshold) {
        // right
        onSwipeRight && onSwipeRight();
      }
      reset();
    };

    frontEl.addEventListener("pointerup", end, { passive: true });
    frontEl.addEventListener("pointercancel", end, { passive: true });
    frontEl.addEventListener("lostpointercapture", end, { passive: true });
  }

  /* ---------------- Todo / Ideas / Done ---------------- */

  function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function addItem(listName, text) {
    const t = (text || "").trim();
    if (!t) return;

    const item = { id: uid(), text: t, ts: Date.now() };
    if (listName === "todo") {
      state.data.todo.unshift(item);
      saveList(KEYS.todo, state.data.todo);
    } else if (listName === "ideas") {
      state.data.ideas.unshift(item);
      saveList(KEYS.ideas, state.data.ideas);
    }
  }

  function moveToDone(source, itemId) {
    const srcArr = source === "todo" ? state.data.todo : state.data.ideas;
    const idx = srcArr.findIndex(x => x.id === itemId);
    if (idx < 0) return;
    const [item] = srcArr.splice(idx, 1);

    state.data.done.unshift({
      id: item.id,
      text: item.text,
      ts: item.ts,
      doneTs: Date.now(),
      source
    });

    saveList(source === "todo" ? KEYS.todo : KEYS.ideas, srcArr);
    saveList(KEYS.done, state.data.done);
  }

  function restoreFromDone(itemId) {
    const idx = state.data.done.findIndex(x => x.id === itemId);
    if (idx < 0) return;
    const [item] = state.data.done.splice(idx, 1);

    const restored = { id: item.id, text: item.text, ts: item.ts };
    if (item.source === "ideas") {
      state.data.ideas.unshift(restored);
      saveList(KEYS.ideas, state.data.ideas);
    } else {
      state.data.todo.unshift(restored);
      saveList(KEYS.todo, state.data.todo);
    }
    saveList(KEYS.done, state.data.done);
  }

  function removeFromDone(itemId) {
    const idx = state.data.done.findIndex(x => x.id === itemId);
    if (idx < 0) return;
    state.data.done.splice(idx, 1);
    saveList(KEYS.done, state.data.done);
  }

  function renderTodo() {
    els.viewContainer.innerHTML = `
      <div class="card">
        <div class="row">
          <div class="cardTitle" style="margin:0">Todo</div>
          <div class="pill">Swipe → klar</div>
        </div>
        <div class="muted" style="margin-top:8px">Swipe höger för att markera som klar. Swipe vänster för att lämna kvar.</div>
      </div>

      <div class="card">
        <div class="cardTitle">Lägg till</div>
        <div class="inputRow">
          <input id="todoInput" class="textInput" placeholder="Ny todo…" inputmode="text" />
          <button id="todoAdd" class="btnPrimary" type="button">Add</button>
        </div>
      </div>

      <div id="todoList" class="list"></div>
    `;

    const input = $("#todoInput");
    const btn = $("#todoAdd");
    const list = $("#todoList");

    const doAdd = () => {
      addItem("todo", input.value);
      input.value = "";
      renderTodo();
    };

    btn.addEventListener("click", doAdd);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doAdd();
    });

    if (!state.data.todo.length) {
      list.innerHTML = `<div class="card"><div class="muted">Inga todos ännu.</div></div>`;
      return;
    }

    list.innerHTML = state.data.todo.map(itemToRowHtml("todo")).join("");

    list.querySelectorAll(".item").forEach((itemEl) => {
      const id = itemEl.dataset.id;
      const front = itemEl.querySelector(".itemFront");
      attachSwipe(front, {
        onSwipeRight: () => {
          moveToDone("todo", id);
          renderTodo();
        }
      });
    });
  }

  function renderIdeas() {
    els.viewContainer.innerHTML = `
      <div class="card">
        <div class="row">
          <div class="cardTitle" style="margin:0">Ideas</div>
          <div class="pill">Swipe → arkiv</div>
        </div>
        <div class="muted" style="margin-top:8px">Swipe höger för att arkivera till Done (med källa: Ideas).</div>
      </div>

      <div class="card">
        <div class="cardTitle">Lägg till</div>
        <div class="inputRow">
          <input id="ideasInput" class="textInput" placeholder="Ny idé…" inputmode="text" />
          <button id="ideasAdd" class="btnPrimary" type="button">Add</button>
        </div>
      </div>

      <div id="ideasList" class="list"></div>
    `;

    const input = $("#ideasInput");
    const btn = $("#ideasAdd");
    const list = $("#ideasList");

    const doAdd = () => {
      addItem("ideas", input.value);
      input.value = "";
      renderIdeas();
    };

    btn.addEventListener("click", doAdd);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doAdd();
    });

    if (!state.data.ideas.length) {
      list.innerHTML = `<div class="card"><div class="muted">Inga idéer ännu.</div></div>`;
      return;
    }

    list.innerHTML = state.data.ideas.map(itemToRowHtml("ideas")).join("");

    list.querySelectorAll(".item").forEach((itemEl) => {
      const id = itemEl.dataset.id;
      const front = itemEl.querySelector(".itemFront");
      attachSwipe(front, {
        onSwipeRight: () => {
          moveToDone("ideas", id);
          renderIdeas();
        }
      });
    });
  }

  function renderDone() {
    els.viewContainer.innerHTML = `
      <div class="card">
        <div class="row">
          <div class="cardTitle" style="margin:0">Done</div>
          <div class="pill">Swipe → restore</div>
        </div>
        <div class="muted" style="margin-top:8px">Swipe höger för att återställa tillbaka till rätt lista. Swipe vänster för att radera från Done.</div>
      </div>

      <div id="doneList" class="list"></div>
    `;

    const list = $("#doneList");

    if (!state.data.done.length) {
      list.innerHTML = `<div class="card"><div class="muted">Inget i Done ännu.</div></div>`;
      return;
    }

    list.innerHTML = state.data.done.map(doneToRowHtml).join("");

    list.querySelectorAll(".item").forEach((itemEl) => {
      const id = itemEl.dataset.id;
      const front = itemEl.querySelector(".itemFront");

      attachSwipe(front, {
        onSwipeRight: () => {
          restoreFromDone(id);
          renderDone();
        },
        onSwipeLeft: () => {
          removeFromDone(id);
          renderDone();
        }
      });
    });
  }

  function itemToRowHtml(source) {
    return (it) => {
      const meta = new Date(it.ts).toLocaleString("sv-SE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
      return `
        <div class="item" data-id="${escapeAttr(it.id)}">
          <div class="itemBg">
            <div class="leftHint">⟵</div>
            <div class="rightHint">${source === "todo" ? "Klar" : "Arkiv"}</div>
          </div>
          <div class="itemFront">
            <div class="itemText">${escapeHtml(it.text)}</div>
            <div class="itemMeta">${meta}</div>
          </div>
        </div>
      `;
    };
  }

  function doneToRowHtml(it) {
    const meta = `${it.source === "ideas" ? "Ideas" : "Todo"} • ${new Date(it.doneTs || Date.now()).toLocaleString("sv-SE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}`;
    return `
      <div class="item" data-id="${escapeAttr(it.id)}">
        <div class="itemBg">
          <div class="leftHint">Radera</div>
          <div class="rightHint">Restore</div>
        </div>
        <div class="itemFront">
          <div class="itemText">${escapeHtml(it.text)}</div>
          <div class="itemMeta">${escapeHtml(meta)}</div>
        </div>
      </div>
    `;
  }

  /* ---------------- Aktiv prio modal ---------------- */

  function renderPrio() {
    const txt = (state.data.prio || "").trim();
    els.prioValue.textContent = txt ? txt : "Tryck för att sätta…";
  }

  function openPrioModal() {
    els.prioModal.setAttribute("aria-hidden", "false");
    els.prioInput.value = state.data.prio || "";
    requestAnimationFrame(() => els.prioInput.focus());
  }

  function closePrioModal() {
    els.prioModal.setAttribute("aria-hidden", "true");
  }

  /* ---------------- Weather (Open-Meteo) ---------------- */

  async function renderWeather() {
    els.viewContainer.innerHTML = `
      <div class="card">
        <div class="row">
          <div class="cardTitle" style="margin:0">Weather</div>
          <div class="pill" id="weatherPill">Loading…</div>
        </div>
        <div class="muted" style="margin-top:8px" id="weatherSubtitle">Hämtar väder…</div>
      </div>

      <div class="card" id="weatherCard">
        <div class="muted">…</div>
      </div>
    `;

    const pill = $("#weatherPill");
    const subtitle = $("#weatherSubtitle");
    const card = $("#weatherCard");

    const fallback = { name: "Stockholm", lat: 59.3293, lon: 18.0686 };

    const loc = await getGeo().catch(() => null);
    const coords = loc ? { name: "Din plats", lat: loc.lat, lon: loc.lon } : fallback;

    subtitle.textContent = `Plats: ${coords.name}${loc ? "" : " (fallback)"}`;

    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(coords.lat)}&longitude=${encodeURIComponent(coords.lon)}` +
        `&current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Weather fetch failed");
      const data = await res.json();

      const cur = data.current || {};
      const daily = data.daily || {};

      const temp = cur.temperature_2m;
      const feels = cur.apparent_temperature;
      const wind = cur.wind_speed_10m;
      const precip = cur.precipitation;

      pill.textContent = `${fmtNum(temp)}°`;

      const todayMax = daily.temperature_2m_max?.[0];
      const todayMin = daily.temperature_2m_min?.[0];
      const precipSum = daily.precipitation_sum?.[0];

      card.innerHTML = `
        <div class="row">
          <div class="pill">Nu</div>
          <div class="muted">${escapeHtml(new Date().toLocaleString("sv-SE", { weekday:"short", hour:"2-digit", minute:"2-digit" }))}</div>
        </div>
        <div style="height:10px"></div>
        <div class="muted">Temp: <b style="color:rgba(255,255,255,0.92)">${fmtNum(temp)}°</b> (känns som ${fmtNum(feels)}°)</div>
        <div class="muted">Vind: ${fmtNum(wind)} m/s • Nederbörd (nu): ${fmtNum(precip)} mm</div>
        <div style="height:10px"></div>
        <div class="muted">Idag: ${fmtNum(todayMin)}° → ${fmtNum(todayMax)}° • Nederbörd (sum): ${fmtNum(precipSum)} mm</div>
        <div style="height:8px"></div>
        <div class="muted" style="opacity:0.7">Källa: Open-Meteo</div>
      `;
    } catch (e) {
      pill.textContent = "—";
      card.innerHTML = `
        <div class="cardTitle">Kunde inte hämta väder</div>
        <div class="muted">${escapeHtml(String(e.message || e))}</div>
      `;
    }
  }

  function getGeo() {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) return reject(new Error("No geolocation"));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 }
      );
    });
  }

  /* ---------------- News (Google News RSS + proxy fallback) ---------------- */

  async function renderNews() {
    els.viewContainer.innerHTML = `
      <div class="card">
        <div class="row">
          <div class="cardTitle" style="margin:0">News</div>
          <div class="pill" id="newsPill">Loading…</div>
        </div>
        <div class="muted" style="margin-top:8px">Google News RSS. Om CORS blockerar används proxy-fallback.</div>
      </div>

      <div id="newsList" class="list"></div>
    `;

    const pill = $("#newsPill");
    const list = $("#newsList");

    // You can tweak these feeds (no extra UI needed)
    const feedUrl = "https://news.google.com/rss?hl=sv&gl=SE&ceid=SE:sv";

    try {
      const xmlText = await fetchRssWithFallback(feedUrl);
      const items = parseRss(xmlText).slice(0, 18);

      pill.textContent = `${items.length}`;

      if (!items.length) {
        list.innerHTML = `<div class="card"><div class="muted">Inga nyheter hittades.</div></div>`;
        return;
      }

      list.innerHTML = items.map((it) => {
        const when = it.pubDate ? new Date(it.pubDate).toLocaleString("sv-SE", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "";
        return `
          <a class="card" href="${escapeAttr(it.link || "#")}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit">
            <div class="cardTitle" style="margin:0 0 8px 0">${escapeHtml(it.title || "—")}</div>
            <div class="muted">${escapeHtml(when)}${it.source ? " • " + escapeHtml(it.source) : ""}</div>
          </a>
        `;
      }).join("");
    } catch (e) {
      pill.textContent = "—";
      list.innerHTML = `
        <div class="card">
          <div class="cardTitle">Kunde inte hämta RSS</div>
          <div class="muted">Safari/iPhone kan blocka CORS mot RSS. Testa igen eller byt nät.</div>
          <div class="muted" style="margin-top:8px">${escapeHtml(String(e.message || e))}</div>
        </div>
      `;
    }
  }

  async function fetchRssWithFallback(url) {
    // 1) Direct (often blocked by CORS)
    try {
      const r1 = await fetch(url, { cache: "no-store" });
      if (r1.ok) return await r1.text();
    } catch {}

    // 2) allorigins (simple CORS proxy)
    // Note: relies on a public proxy; this is your requested fallback behavior.
    const proxies = [
      (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      (u) => `https://r.jina.ai/http://${u.replace(/^https?:\/\//, "")}` // text proxy
    ];

    let lastErr = null;
    for (const make of proxies) {
      try {
        const proxied = make(url);
        const r = await fetch(proxied, { cache: "no-store" });
        if (!r.ok) throw new Error(`Proxy failed: ${r.status}`);
        const t = await r.text();
        if (t && t.includes("<rss")) return t;
        // Sometimes jina returns HTML-wrapped; still parseable but keep check len
        if (t && t.length > 200) return t;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("RSS fetch failed");
  }

  function parseRss(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    const items = Array.from(doc.querySelectorAll("item")).map((item) => {
      const title = item.querySelector("title")?.textContent?.trim() || "";
      const link = item.querySelector("link")?.textContent?.trim() || "";
      const pubDate = item.querySelector("pubDate")?.textContent?.trim() || "";
      // Google News sometimes has <source>
      const source = item.querySelector("source")?.textContent?.trim() || "";
      return { title, link, pubDate, source };
    });
    return items;
  }

  /* ---------------- Calendar (iframe + overlay) ---------------- */

  function renderCalendar() {
    const saved = state.data.calendarUrl || "";

    els.viewContainer.innerHTML = `
      <div class="card">
        <div class="cardTitle">Google Calendar</div>
        <div class="muted">
          Klistra in din <b>embed-URL</b> (från Google Calendar → Inställningar → Integrera kalender → Inbäddningskod).
          Vi sparar länken i localStorage.
        </div>
        <div style="height:10px"></div>
        <div class="inputRow">
          <input id="calUrlInput" class="textInput" placeholder="https://calendar.google.com/calendar/embed?..." value="${escapeAttr(saved)}" />
          <button id="calSave" class="btnPrimary" type="button">Save</button>
        </div>
      </div>

      <div class="calendarWrap">
        <iframe
          id="calFrame"
          title="Google Calendar Agenda"
          src="${escapeAttr(saved || "about:blank")}"
          loading="lazy"
          referrerpolicy="no-referrer"
        ></iframe>
        <div class="calendarOverlay" aria-hidden="true"></div>
      </div>

      ${saved ? "" : `<div class="card"><div class="muted">Ingen kalenderlänk sparad ännu. Lägg in embed-URL ovan så visas den här.</div></div>`}
    `;

    $("#calSave").addEventListener("click", () => {
      const val = ($("#calUrlInput").value || "").trim();
      setCalendarUrl(val);
      renderCalendar();
    });
  }

  /* ---------------- Helpers ---------------- */

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function fmtNum(v) {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
    const num = Number(v);
    // keep 0-1 decimals for readability
    const abs = Math.abs(num);
    const d = abs < 10 ? 1 : 0;
    return num.toFixed(d).replace(".", ",");
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replaceAll("\n", " ");
  }

  /* ---------------- Init + Events ---------------- */

  function bindEvents() {
    // Wheel scroll
    els.wheelTrack.addEventListener("scroll", onWheelScroll, { passive: true });

    // Tap wheel
    els.wheelTap.addEventListener("click", () => {
      if (!state.isOpen) openSheet();
      else {
        // When open, tap just keeps it open (still clickable)
        // Optional: tap toggles close
        closeSheet();
      }
    });

    // Close button
    els.sheetClose.addEventListener("click", closeSheet);

    // Close if user drags sheet down? (simple: double tap close button not needed)
    // Keep minimal to avoid Safari gesture conflicts.

    // Aktiv prio
    els.prioCard.addEventListener("click", openPrioModal);
    els.prioCancel.addEventListener("click", closePrioModal);
    els.prioSave.addEventListener("click", () => {
      setPrio(els.prioInput.value);
      closePrioModal();
    });

    // Close prio modal by tapping backdrop
    els.prioModal.addEventListener("click", (e) => {
      if (e.target && (e.target.classList.contains("prioModalBackdrop"))) closePrioModal();
    });

    // Prevent body scroll on touch (belt + suspenders for iOS)
    document.addEventListener("touchmove", (e) => {
      // allow scroll inside sheet only
      if (!state.isOpen) {
        e.preventDefault();
        return;
      }
      const path = e.composedPath ? e.composedPath() : [];
      const inSheetScroll = path.includes(els.sheetScroll);
      if (!inSheetScroll) e.preventDefault();
    }, { passive: false });
  }

  function init() {
    loadData();
    renderPrio();

    buildWheel();
    bindEvents();

    // initial UI status
    els.miniStatus.textContent = `Preview: ${VIEWS[state.previewIndex].label}`;

    // Start closed
    closeSheet();

    // Pre-render last view once (so opening feels instant)
    renderView(VIEWS[state.activeIndex].id);
    els.sheetTitleText.textContent = VIEWS[state.activeIndex].label;
  }

  init();
})();
