/* SBScrowl v1
   - iPhone-first, locked body
   - Big wheel bottom, live icon changes while rotating
   - Tap wheel to open sheet
   - When sheet open: rotating wheel changes view live in sheet
   - Close button centered bottom edge
*/
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // ---------- Views ----------
  // NOTE: We keep "pomodoro" id to reuse your existing icon name.
  const VIEWS = ["weather", "calendar", "news", "todo", "ideas", "done", "prio", "pomodoro"];

  const ICONS = {
    weather:   "assets/ui/icon-weather.svg",
    calendar:  "assets/ui/icon-weather.svg",   // (du kan byta senare om du gör en kalender-ikon)
    news:      "assets/ui/icon-news.svg",
    todo:      "assets/ui/icon-todo.svg",
    ideas:     "assets/ui/icon-ideas.svg",
    done:      "assets/ui/icon-done.svg",
    prio:      "assets/ui/icon-todo.svg",      // (du kan byta senare om du gör en prio-ikon)
    pomodoro:  "assets/ui/icon-pomodoro.svg",  // Timer
  };

  const LABELS = {
    weather: "Väder",
    calendar:"Kalender",
    news: "Nyheter",
    todo: "Att göra",
    ideas: "Idéer",
    done: "Slutförda",
    prio: "Aktiv prio",
    pomodoro: "Timer",
  };

  // ---------- Elements ----------
  const wheelEl   = $("wheel");
  const ringEl    = $("wheelRing");
  const iconEl    = $("wheelIcon");
  const previewEl = $("previewText");

  const sheetEl   = $("sheet");
  const sheetTitle= $("sheetTitle");
  const sheetBody = $("sheetBody");
  const sheetClose= $("sheetClose");

  // ---------- State ----------
  let currentIndex = 0;
  let sheetOpen = false;

  // ---------- Helpers ----------
  const clampIndex = (i) => (i + VIEWS.length) % VIEWS.length;

  function setViewByIndex(idx, { silent = false } = {}) {
    currentIndex = clampIndex(idx);
    const view = VIEWS[currentIndex];

    if (iconEl && ICONS[view]) iconEl.src = ICONS[view];
    if (previewEl) previewEl.textContent = `${LABELS[view] || view}`;

    if (sheetOpen) renderSheet(view);

    // snap ring to view index when not dragging
    if (!silent) syncRotationToIndex();
  }

  function openSheet() {
    if (sheetOpen) return;
    sheetOpen = true;
    if (sheetEl) {
      sheetEl.classList.add("open");
      sheetEl.setAttribute("aria-hidden", "false");
    }
    renderSheet(VIEWS[currentIndex]);
  }

  function closeSheet() {
    sheetOpen = false;
    if (sheetEl) {
      sheetEl.classList.remove("open");
      sheetEl.setAttribute("aria-hidden", "true");
    }
  }

  // ---------- Render views (placeholders now, we can wire real modules next) ----------
  function renderSheet(view) {
    if (sheetTitle) sheetTitle.textContent = LABELS[view] || view;
    if (!sheetBody) return;

    if (view === "calendar") {
      sheetBody.innerHTML = `
        <div class="card">
          <div class="cardTitle">Google Kalender</div>
          <div class="calWrap">
            <div class="calScale">
              <iframe
                class="calFrame"
                src="https://calendar.google.com/calendar/embed?src=ZXJpY3Nzb25ib25pbmlAZ21haWwuY29t&mode=AGENDA&ctz=Europe%2FStockholm&hl=sv&showTitle=0&showTabs=0&showNav=0&showPrint=0&showCalendars=0&showDate=0"
                scrolling="no"
                frameborder="0"></iframe>
            </div>
            <div class="calOverlay" aria-hidden="true"></div>
          </div>
          <div class="hint" style="margin-top:10px;">(Nästa steg: göra den kompakt + snabb.)</div>
        </div>
      `;
      return;
    }

    sheetBody.innerHTML = `
      <div class="card">
        <div class="cardTitle">${LABELS[view] || view}</div>
        <div class="hint">
          Detta är placeholder-vyn för <b>${LABELS[view] || view}</b>.<br>
          Nästa steg är att flytta in exakt samma funktionalitet som i SB Dash för:
          väder, nyheter, todo/idéer/done, aktiv prio och timer.
        </div>
      </div>
    `;
  }

  // ---------- Dial logic (FROM SB Dash) ----------
  let isDragging = false;
  let startAngle = 0;
  let currentRotation = 0;

  const STEP = 360 / VIEWS.length;
  let lastSector = 0;

  const angle = (cx, cy, mx, my) => Math.atan2(my - cy, mx - cx) * (180 / Math.PI);

  function setRotation(deg) {
    currentRotation = deg;
    if (ringEl) ringEl.style.transform = `rotate(${deg}deg)`;
  }

  function sectorFromRotation(deg) {
    const raw = Math.round(deg / STEP);
    return ((raw % VIEWS.length) + VIEWS.length) % VIEWS.length;
  }

  function syncRotationToIndex() {
    setRotation(currentIndex * STEP);
    lastSector = currentIndex;
  }

  function onDown(e) {
    if (!wheelEl) return;
    isDragging = true;

    // pointer capture keeps moves coming even if finger drifts
    wheelEl.setPointerCapture?.(e.pointerId);

    e.preventDefault();

    const r = wheelEl.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    startAngle = angle(cx, cy, e.clientX, e.clientY) - currentRotation;
  }

  function onMove(e) {
    if (!isDragging) return;
    e.preventDefault();

    const r = wheelEl.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    setRotation(angle(cx, cy, e.clientX, e.clientY) - startAngle);

    const s = sectorFromRotation(currentRotation);
    if (s !== lastSector) {
      lastSector = s;
      const view = VIEWS[s];
      if (iconEl && ICONS[view]) iconEl.src = ICONS[view]; // live change while rotating
      if (previewEl) previewEl.textContent = `${LABELS[view] || view}`;

      // If sheet is open, change view live as you rotate (no extra tap)
      if (sheetOpen) renderSheet(view);
    }
  }

  function onUp(e) {
    if (!isDragging) return;
    isDragging = false;
    e.preventDefault();

    const finalIndex = sectorFromRotation(currentRotation);

    // If sheet is closed: keep preview on release but do not open automatically
    // If sheet is open: commit view (already rendered live)
    currentIndex = finalIndex;
    const view = VIEWS[currentIndex];

    if (iconEl && ICONS[view]) iconEl.src = ICONS[view];
    if (previewEl) previewEl.textContent = `${LABELS[view] || view}`;
    if (sheetOpen) renderSheet(view);

    syncRotationToIndex();
  }

  // Attach events
  if (wheelEl) {
    wheelEl.addEventListener("pointerdown", onDown, { passive: false });
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { passive: false });
    window.addEventListener("pointercancel", onUp, { passive: false });

    // Tap to open sheet (only when closed)
    wheelEl.addEventListener("click", () => {
      if (!sheetOpen) openSheet();
    });

    // Desktop wheel scroll over the wheel (optional)
    wheelEl.addEventListener("wheel", (e) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      setViewByIndex(currentIndex + dir, { silent: true });
      syncRotationToIndex();
    }, { passive: false });
  }

  if (sheetClose) sheetClose.addEventListener("click", closeSheet);

  // ---------- Init ----------
  closeSheet();               // start closed
  setViewByIndex(0, { silent: true });
  syncRotationToIndex();
})();
