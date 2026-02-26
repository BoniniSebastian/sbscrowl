(() => {
  const hero = document.getElementById("hero");
  const heroTrack = document.getElementById("heroTrack");
  const dots = Array.from(document.querySelectorAll(".dot"));
  const knob = document.getElementById("knob");
  const knobImg = knob.querySelector("img");
  const iconRail = document.getElementById("iconRail");
  const iconItems = Array.from(iconRail.querySelectorAll(".iconItem"));

  /* =========================
     STATE
  ========================= */
  let page = 0;             // 0..2
  let isSwiping = false;
  let startX = 0;
  let startY = 0;
  let startTX = 0;
  let currentTX = 0;

  // knob rotation
  let isRotating = false;
  let rotStartAngle = 0;
  let rotStartDeg = 0;
  let rotationDeg = 0;
  let menuMode = false;

  // knob fade/pulse
  let knobFadeTimer = null;
  let lastTouchTs = 0;

  // double tap detection
  let lastTapTs = 0;
  let tapCandidate = false;
  let tapStartX = 0;
  let tapStartY = 0;

  const PAGES = 3;
  const ICONS = 10;
  const DEG_PER_ICON = 18;

  /* =========================
     HELPERS
  ========================= */
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function setPage(newPage){
    page = clamp(newPage, 0, PAGES - 1);
    currentTX = -page * hero.clientWidth;
    heroTrack.style.transform = `translateX(${currentTX}px)`;
    dots.forEach((d, i) => d.classList.toggle("isActive", i === page));
  }

  function setSwiping(on){
    isSwiping = on;
    hero.classList.toggle("isSwiping", on);
  }

  function enterMenuMode(){
    if (menuMode) return;
    menuMode = true;
    document.body.classList.add("isMenuMode");
  }

  function exitMenuMode(){
    menuMode = false;
    document.body.classList.remove("isMenuMode");

    // reset icon highlight
    iconItems.forEach((it, i) => it.classList.toggle("isActive", i === 0));

    // reset rotation visuellt
    rotationDeg = 0;
    knobImg.style.transform = `rotate(0deg)`;
  }

  function knobActive(){
    knob.classList.add("isActive", "isPulsing");
    lastTouchTs = Date.now();
    if (knobFadeTimer) clearTimeout(knobFadeTimer);
    knobFadeTimer = setTimeout(() => {
      if (Date.now() - lastTouchTs > 2100){
        knob.classList.remove("isPulsing");
        knob.classList.remove("isActive");
      }
    }, 2300);
  }

  function getAngleFromCenter(clientX, clientY, el){
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }

  function normalizeDeltaAngle(a){
    if (a > 180) a -= 360;
    if (a < -180) a += 360;
    return a;
  }

  function updateKnobRotation(deg){
    rotationDeg = deg;
    knobImg.style.transform = `rotate(${rotationDeg}deg)`;

    // När man börjar snurra: visa iconRail + dölj hero
    if (!menuMode && Math.abs(rotationDeg) >= 12){
      enterMenuMode();
    }

    // Aktiv ikon baserat på rotation
    if (menuMode){
      const idx = ((Math.floor(rotationDeg / DEG_PER_ICON) % ICONS) + ICONS) % ICONS;
      iconItems.forEach((it, i) => it.classList.toggle("isActive", i === idx));
    }
  }

  /* =========================
     INIT LAYOUT
  ========================= */
  function relayout(){
    currentTX = -page * hero.clientWidth;
    heroTrack.style.transform = `translateX(${currentTX}px)`;
  }
  window.addEventListener("resize", relayout);
  setPage(0);

  /* =========================
     SWIPE (HERO)
  ========================= */
  hero.addEventListener("pointerdown", (e) => {
    if (menuMode) return;

    setSwiping(true);
    hero.setPointerCapture(e.pointerId);

    startX = e.clientX;
    startY = e.clientY;
    startTX = -page * hero.clientWidth;
    currentTX = startTX;
  });

  hero.addEventListener("pointermove", (e) => {
    if (!isSwiping || menuMode) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (Math.abs(dy) > Math.abs(dx) * 1.2) return;

    const maxLeft = 0;
    const maxRight = -(PAGES - 1) * hero.clientWidth;
    let next = startTX + dx;

    if (next > maxLeft) next = maxLeft + (next - maxLeft) * 0.25;
    if (next < maxRight) next = maxRight + (next - maxRight) * 0.25;

    currentTX = next;
    heroTrack.style.transition = "none";
    heroTrack.style.transform = `translateX(${currentTX}px)`;
  });

  function endSwipe(e){
    if (!isSwiping || menuMode) return;

    setSwiping(false);
    heroTrack.style.transition = "transform 260ms ease";

    const dx = e.clientX - startX;
    const threshold = hero.clientWidth * 0.18;

    if (dx <= -threshold) setPage(page + 1);
    else if (dx >= threshold) setPage(page - 1);
    else setPage(page);
  }

  hero.addEventListener("pointerup", endSwipe);
  hero.addEventListener("pointercancel", endSwipe);

  /* =========================
     KNOB ROTATION + DOUBLE TAP
  ========================= */
  knob.addEventListener("pointerdown", (e) => {
    knobActive();

    // dubbel-tap kandidat start
    tapCandidate = true;
    tapStartX = e.clientX;
    tapStartY = e.clientY;

    isRotating = true;
    knob.setPointerCapture(e.pointerId);

    rotStartAngle = getAngleFromCenter(e.clientX, e.clientY, knob);
    rotStartDeg = rotationDeg;

    knob.classList.add("isActive", "isPulsing");
  });

  knob.addEventListener("pointermove", (e) => {
    if (!isRotating) return;
    knobActive();

    // om man rör sig mer än lite -> inte en tap
    const dx = e.clientX - tapStartX;
    const dy = e.clientY - tapStartY;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) tapCandidate = false;

    const a = getAngleFromCenter(e.clientX, e.clientY, knob);
    let delta = a - rotStartAngle;
    delta = normalizeDeltaAngle(delta);

    // snurrar man lite -> inte en tap
    if (Math.abs(delta) > 6) tapCandidate = false;

    updateKnobRotation(rotStartDeg + delta);
  });

  function endRotate(e){
    if (!isRotating) return;
    isRotating = false;

    // Dubbel-tap: två "tapCandidate" inom 320ms
    if (tapCandidate){
      const now = Date.now();
      if (now - lastTapTs <= 320){
        exitMenuMode();
        lastTapTs = 0;
      } else {
        lastTapTs = now;
      }
    }
  }

  knob.addEventListener("pointerup", endRotate);
  knob.addEventListener("pointercancel", endRotate);

  /* =========================
     OPTIONAL: tap dots to jump
  ========================= */
  dots.forEach((d) => {
    d.addEventListener("click", () => {
      if (menuMode) return;
      const i = Number(d.dataset.dot);
      setPage(i);
    });
  });

})();
