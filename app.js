(() => {

  console.log("SB Dash v1 loaded ✅");

  const $ = (id) => document.getElementById(id);

  /* ===== Stable viewport height (iOS) ===== */
  function setVH(){
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  }
  setVH();
  window.addEventListener("resize", setVH, { passive: true });

  /* ===== iOS scroll lock during gesture ===== */
  let blockScroll = false;

  document.addEventListener("touchmove", (e) => {
    if(blockScroll) e.preventDefault();
  }, { passive: false });

  function setBlockScroll(on){
    blockScroll = !!on;
  }

  /* ===== Elements ===== */
  const viewport = $("carouselViewport");
  const track = $("carouselTrack");
  const tripDotsWrap = $("tripDots");
  const tripDots = Array.from(tripDotsWrap.querySelectorAll(".tDot"));

  const edgeZone = $("edgeZone");
  const edgeSelector = $("edgeSelector");
  const edgeDotsWrap = $("edgeDots");
  const edgePicker = $("edgePicker");
  const edgeBackdrop = $("edgeBackdrop");

  const dateWeekday = $("dateWeekday");
  const dateDayMonth = $("dateDayMonth");

  const sectionWrap = $("sectionWrap");
  const sectionTitle = $("sectionTitle");
  const sectionClose = $("sectionClose");
  const sectionBackdrop = $("sectionBackdrop");

  /* ===== Carousel: ONLY 3 slides ===== */
  const CAROUSEL_COUNT = 3;

  /* ===== Edge selector sections (9) ===== */
  const SECTION_COUNT = 9;

  /* ===== Date (auto, sv-SE) ===== */
  function capFirst(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function renderDate(){
    const d = new Date();
    const weekday = capFirst(new Intl.DateTimeFormat("sv-SE", { weekday: "long" }).format(d));
    const day = new Intl.DateTimeFormat("sv-SE", { day: "numeric" }).format(d);
    const month = capFirst(new Intl.DateTimeFormat("sv-SE", { month: "long" }).format(d));
    dateWeekday.textContent = weekday;
    dateDayMonth.textContent = `${day} ${month}`;
  }
  renderDate();
  setInterval(renderDate, 60000);

  /* ===== Helpers ===== */
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
  function getWidth(){ return viewport.getBoundingClientRect().width || 1; }

  function setSwipeP(p){
    document.documentElement.style.setProperty("--swipeP", String(clamp(p, 0, 1)));
  }

  function updateTripDots(i){
    tripDots.forEach((d, idx) => d.classList.toggle("isActive", idx === i));
  }

  /* ===== Carousel state ===== */
  let index = 0;

  function snapTo(i, animate=true){
    index = clamp(i, 0, CAROUSEL_COUNT - 1);
    const w = getWidth();
    const x = -index * w;

    if(animate){
      track.style.transition = "transform 240ms cubic-bezier(.2,.9,.2,1)";
      viewport.style.transition = "opacity 180ms ease";
    } else {
      track.style.transition = "";
      viewport.style.transition = "";
    }

    track.style.transform = `translate3d(${x}px,0,0)`;
    viewport.style.opacity = "1";
    setSwipeP(0);

    if(animate){
      setTimeout(() => {
        track.style.transition = "";
        viewport.style.transition = "";
      }, 260);
    }

    updateTripDots(index);
  }

  /* ===== Horizontal swipe ===== */
  let dragging = false;
  let startX = 0;
  let dx = 0;
  let pointerId = null;

  viewport.addEventListener("pointerdown", (e) => {
    if(document.body.classList.contains("edgeActive")) return;
    if(sectionWrap.classList.contains("isOpen")) return;

    setBlockScroll(true);

    dragging = true;
    pointerId = e.pointerId;
    startX = e.clientX;
    dx = 0;

    viewport.setPointerCapture(pointerId);
    track.style.transition = "";
    viewport.style.transition = "";
  });

  viewport.addEventListener("pointermove", (e) => {
    if(!dragging || e.pointerId !== pointerId) return;

    dx = e.clientX - startX;

    // resistance at ends
    if((index === 0 && dx > 0) || (index === CAROUSEL_COUNT - 1 && dx < 0)){
      dx *= 0.35;
    }

    const w = getWidth();
    const x = (-index * w) + dx;
    track.style.transform = `translate3d(${x}px,0,0)`;

    const p = Math.min(1, Math.abs(dx) / w);
    viewport.style.opacity = String(1 - 0.28 * p);
    setSwipeP(p);
  });

  function endDrag(){
    if(!dragging) return;
    dragging = false;

    const w = getWidth();
    const p = Math.abs(dx) / w;

    let next = index;
    if(p > 0.18){
      next = dx < 0 ? index + 1 : index - 1;
    }
    snapTo(next, true);

    dx = 0;
    pointerId = null;

    setBlockScroll(false);
  }

  viewport.addEventListener("pointerup", (e) => {
    if(pointerId !== null && e.pointerId !== pointerId) return;
    endDrag();
  });

  viewport.addEventListener("pointercancel", (e) => {
    if(pointerId !== null && e.pointerId !== pointerId) return;
    endDrag();
  });

  window.addEventListener("resize", () => snapTo(index, false), { passive: true });

  /* ===== Edge selector dots (9) ===== */
  const edgeDots = [];
  edgeDotsWrap.innerHTML = "";
  for(let i=0;i<SECTION_COUNT;i++){
    const d = document.createElement("div");
    d.className = "edgeDot";
    edgeDotsWrap.appendChild(d);
    edgeDots.push(d);
  }

  function getDotCenters(){
    return edgeDots.map(d => {
      const r = d.getBoundingClientRect();
      return r.top + r.height/2;
    });
  }

  function movePickerToIndex(i){
    const centers = getDotCenters();
    const y = centers[i] || window.innerHeight/2;
    edgePicker.style.transform =
      `translate3d(0, ${y - window.innerHeight/2}px, 0) translateY(-50%)`;
  }

  /* ===== Edge gesture ===== */
  let edgeTracking = false;
  let edgeActive = false;
  let edgeStartX = 0;
  let edgePointer = null;
  let candidate = 0;

  const EDGE_THRESHOLD = 22;
  const EDGE_PULL_MAX = 110;

  function openEdge(){
    edgeActive = true;
    document.body.classList.add("edgeActive");
    edgePicker.style.opacity = "1";
    movePickerToIndex(candidate);
  }

  function closeEdge(){
    edgeActive = false;
    document.body.classList.remove("edgeActive");
    edgeSelector.style.transform = "translate3d(-100%,0,0)";
    edgeSelector.style.opacity = "0";
    edgePicker.style.opacity = "0";
  }

  function setEdgePull(px){
    const p = clamp(px, 0, EDGE_PULL_MAX);
    const percent = -100 + (p / EDGE_PULL_MAX) * 92; // -100 -> -8
    edgeSelector.style.transform = `translate3d(${percent}%,0,0)`;
    edgeSelector.style.opacity = "1";
  }

  edgeZone.addEventListener("pointerdown", (e) => {
    if(sectionWrap.classList.contains("isOpen")) return;

    setBlockScroll(true);

    edgeTracking = true;
    edgePointer = e.pointerId;
    edgeStartX = e.clientX;
    candidate = 0;

    edgeZone.setPointerCapture(edgePointer);
  });

  edgeZone.addEventListener("pointermove", (e) => {
    if(!edgeTracking || e.pointerId !== edgePointer) return;

    const pull = e.clientX - edgeStartX;

    if(!edgeActive){
      if(pull > EDGE_THRESHOLD){
        candidate = 0;
        openEdge();
      } else {
        return;
      }
    }

    setEdgePull(pull);

    const centers = getDotCenters();
    let best = 0;
    let bestDist = Infinity;

    for(let i=0;i<centers.length;i++){
      const d = Math.abs(centers[i] - e.clientY);
      if(d < bestDist){
        bestDist = d;
        best = i;
      }
    }

    candidate = best;
    movePickerToIndex(best);
  });

  function openSection(i){
    sectionTitle.textContent = `Sektion ${i+1}`;
    sectionWrap.classList.add("isOpen");
    sectionWrap.setAttribute("aria-hidden", "false");
    setBlockScroll(false);
  }

  function closeSection(){
    sectionWrap.classList.remove("isOpen");
    sectionWrap.setAttribute("aria-hidden", "true");
    setBlockScroll(false);
  }

  function endEdge(commit){
    if(!edgeTracking) return;
    edgeTracking = false;

    if(edgeActive && commit){
      openSection(candidate);
    }

    closeEdge();
    setBlockScroll(false);
  }

  edgeZone.addEventListener("pointerup", (e) => {
    if(edgePointer !== null && e.pointerId !== edgePointer) return;
    endEdge(true);
    edgePointer = null;
  });

  edgeZone.addEventListener("pointercancel", (e) => {
    if(edgePointer !== null && e.pointerId !== edgePointer) return;
    endEdge(false);
    edgePointer = null;
  });

  edgeBackdrop.addEventListener("click", () => {
    closeEdge();
    setBlockScroll(false);
  });

  sectionClose.addEventListener("click", closeSection);
  sectionBackdrop.addEventListener("click", closeSection);

  /* ===== Init ===== */
  snapTo(0, false);

})();
