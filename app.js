(() => {
  "use strict";

  const VIEWS = [
    { id:"weather",   icon:"assets/ui/icon-weather.svg",   label:"Weather" },
    { id:"news",      icon:"assets/ui/icon-news.svg",      label:"News" },
    { id:"todo",      icon:"assets/ui/icon-todo.svg",      label:"Todo" },
    { id:"ideas",     icon:"assets/ui/icon-ideas.svg",     label:"Ideas" },
    { id:"done",      icon:"assets/ui/icon-done.svg",      label:"Done" },
    { id:"pomodoro",  icon:"assets/ui/icon-pomodoro.svg",  label:"Timer" }
  ];

  const els = {
    wheel: document.getElementById("wheel"),
    wheelRing: document.getElementById("wheelRing"),
    wheelIcon: document.getElementById("wheelIcon"),
    previewText: document.getElementById("previewText"),

    sheet: document.getElementById("sheet"),
    sheetTitle: document.getElementById("sheetTitle"),
    sheetBody: document.getElementById("sheetBody"),
    sheetClose: document.getElementById("sheetClose"),
  };

  const state = {
    activeIndex: 0,
    isOpen: false,
    rotationDeg: 0,
    drag: { on:false, startY:0, lastY:0, accum:0 },
    wheelCooldown: false,
  };

  function clampIndex(i){
    if (i < 0) return VIEWS.length - 1;
    if (i >= VIEWS.length) return 0;
    return i;
  }

  function setIndex(i){
    state.activeIndex = clampIndex(i);
    const v = VIEWS[state.activeIndex];

    // live icon preview
    els.wheelIcon.src = v.icon;
    els.previewText.textContent = `Preview: ${v.label}`;

    // if open, update sheet content immediately
    if (state.isOpen) {
      renderSheetView();
    }
  }

  function renderSheetView(){
    const v = VIEWS[state.activeIndex];
    els.sheetTitle.textContent = v.label;

    // Minimal placeholder content for now (we wire real modules later)
    els.sheetBody.innerHTML = `
      <div style="opacity:.85">
        <p><b>${v.label}</b> (placeholder)</p>
        <p>Här bygger vi in samma funktionalitet som SB Dash: väder, nyheter, todo, idéer, done, aktiv prio, kalender, osv.</p>
      </div>
    `;
  }

  function openSheet(){
    if (state.isOpen) return;
    state.isOpen = true;
    els.sheet.classList.add("open");
    els.sheet.setAttribute("aria-hidden", "false");
    renderSheetView();
  }

  function closeSheet(){
    state.isOpen = false;
    els.sheet.classList.remove("open");
    els.sheet.setAttribute("aria-hidden", "true");
  }

  // --- Wheel interaction: iPhone swipe up/down on the wheel ---
  function step(dir){
    if (state.wheelCooldown) return;
    state.wheelCooldown = true;
    setIndex(state.activeIndex + dir);

    // small visual ring nudge
    state.rotationDeg += (dir > 0 ? 10 : -10);
    els.wheelRing.style.transform = `rotate(${state.rotationDeg}deg)`;

    setTimeout(() => (state.wheelCooldown = false), 120);
  }

  function onDown(e){
    state.drag.on = true;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    state.drag.startY = y;
    state.drag.lastY = y;
    state.drag.accum = 0;
  }

  function onMove(e){
    if (!state.drag.on) return;

    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = y - state.drag.lastY;
    state.drag.lastY = y;

    // prevent page scrolling / rubber band
    if (e.cancelable) e.preventDefault();

    // accumulate movement
    state.drag.accum += dy;

    // threshold per step (tune)
    const TH = 18;

    if (state.drag.accum <= -TH){
      state.drag.accum = 0;
      step(+1);
    } else if (state.drag.accum >= TH){
      state.drag.accum = 0;
      step(-1);
    }
  }

  function onUp(){
    state.drag.on = false;
    state.drag.accum = 0;

    // snap feel (optional micro-settle)
    els.wheelRing.style.transform = `rotate(${state.rotationDeg}deg)`;
  }

  // click to open when closed
  els.wheel.addEventListener("click", () => {
    if (!state.isOpen) openSheet();
  });

  // touch handlers (iPhone)
  els.wheel.addEventListener("touchstart", onDown, { passive: true });
  els.wheel.addEventListener("touchmove", onMove, { passive: false });
  els.wheel.addEventListener("touchend", onUp, { passive: true });
  els.wheel.addEventListener("touchcancel", onUp, { passive: true });

  // desktop fallback (wheel event)
  els.wheel.addEventListener("wheel", (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    step(dir);
  }, { passive:false });

  // close button
  els.sheetClose.addEventListener("click", closeSheet);

  // init
  setIndex(0);
  closeSheet(); // start closed
})();
