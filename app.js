(() => {

  console.log("LOADED ✅");
  
  const hero = document.getElementById("hero");
  const heroTrack = document.getElementById("heroTrack");
  const dots = Array.from(document.querySelectorAll(".dot"));
  const edgeRight = document.getElementById("edgeRight");
  const iconRail = document.getElementById("iconRail");
  const iconItems = Array.from(iconRail.querySelectorAll(".iconItem"));

  /* =========================
     HERO SWIPE (1/2/3)
  ========================= */
  const PAGES = 3;
  let page = 0;
  let isSwiping = false;
  let startX = 0;
  let startY = 0;
  let startTX = 0;
  let currentTX = 0;

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function setPage(newPage){
    page = clamp(newPage, 0, PAGES - 1);
    currentTX = -page * hero.clientWidth;
    heroTrack.style.transform = `translateX(${currentTX}px)`;
    dots.forEach((d, i) => d.classList.toggle("isActive", i === page));
  }

  function setSwipingState(on){
    isSwiping = on;
    hero.classList.toggle("isSwiping", on);
  }

  function relayout(){
    currentTX = -page * hero.clientWidth;
    heroTrack.style.transform = `translateX(${currentTX}px)`;
  }
  window.addEventListener("resize", relayout);
  setPage(0);

  hero.addEventListener("pointerdown", (e) => {
    if (document.body.classList.contains("isMenuMode")) return;

    setSwipingState(true);
    hero.setPointerCapture(e.pointerId);

    startX = e.clientX;
    startY = e.clientY;
    startTX = -page * hero.clientWidth;
    currentTX = startTX;
  });

  hero.addEventListener("pointermove", (e) => {
    if (!isSwiping || document.body.classList.contains("isMenuMode")) return;

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

  function endHeroSwipe(e){
    if (!isSwiping || document.body.classList.contains("isMenuMode")) return;

    setSwipingState(false);
    heroTrack.style.transition = "transform 260ms ease";

    const dx = e.clientX - startX;
    const threshold = hero.clientWidth * 0.18;

    if (dx <= -threshold) setPage(page + 1);
    else if (dx >= threshold) setPage(page - 1);
    else setPage(page);
  }

  hero.addEventListener("pointerup", endHeroSwipe);
  hero.addEventListener("pointercancel", endHeroSwipe);

  dots.forEach((d) => {
    d.addEventListener("click", () => {
      if (document.body.classList.contains("isMenuMode")) return;
      const i = Number(d.dataset.dot);
      setPage(i);
    });
  });

  /* =========================
     MENU MODE (EDGE SWIPE RIGHT)
  ========================= */
  let menuMode = false;

  function enterMenuMode(){
    if (menuMode) return;
    menuMode = true;
    document.body.classList.add("isMenuMode");
  }

  function exitMenuMode(){
    if (!menuMode) return;
    menuMode = false;
    document.body.classList.remove("isMenuMode");
  }

  // Edge-swipe state
  let edgeActive = false;
  let edgeStartX = 0;
  let edgeStartY = 0;
  let edgeStartTs = 0;

  // Vi kräver tydlig horisontell gesture och lite "fart"
  const EDGE_MIN_DX_OPEN = 32;   // swipe in från höger: dra åt vänster (dx negativ)
  const EDGE_MIN_DX_CLOSE = 28;  // close också åt vänster
  const EDGE_MAX_DY = 40;

  edgeRight.addEventListener("pointerdown", (e) => {
    edgeActive = true;
    edgeRight.setPointerCapture(e.pointerId);
    edgeStartX = e.clientX;
    edgeStartY = e.clientY;
    edgeStartTs = performance.now();
  });

  edgeRight.addEventListener("pointermove", (e) => {
  if (!edgeActive) return;

  const dx = e.clientX - edgeStartX; // åt vänster = negativt
  const dy = e.clientY - edgeStartY;

  if (Math.abs(dy) > EDGE_MAX_DY) return;

  if (!menuMode && dx < -EDGE_MIN_DX_OPEN){
    enterMenuMode();
    edgeActive = false;
  } else if (menuMode && dx < -EDGE_MIN_DX_CLOSE){
    exitMenuMode();
    edgeActive = false;
  }
});

edgeRight.addEventListener("pointerup", () => { edgeActive = false; });
edgeRight.addEventListener("pointercancel", () => { edgeActive = false; });

/* =========================
   ICON CLICK (placeholder)
========================= */
iconItems.forEach((item) => {
  item.addEventListener("click", () => {
    iconItems.forEach(it => it.classList.remove("isActive"));
    item.classList.add("isActive");
  });
});

})();
