(() => {
  console.log("SB Dash v1 (rubber-right) loaded ✅");

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
  const setBlockScroll = (on) => (blockScroll = !!on);

  /* ===== Elements ===== */
  const viewport = $("carouselViewport");
  const track = $("carouselTrack");
  const tripDots = Array.from($("tripDots").querySelectorAll(".tDot"));

  const dateWeekday = $("dateWeekday");
  const dateDayMonth = $("dateDayMonth");

  const iconRail = $("iconRail");

  // Rubber
  const edgeZoneR = $("edgeZoneR");
  const rubberWrap = $("rubberWrap");
  const rubberSvg = $("rubberSvg");
  const rubberPath = $("rubberPath");
  const rubberBall = $("rubberBall");
  const rubberBackdrop = $("rubberBackdrop");

  // Section overlay
  const sectionWrap = $("sectionWrap");
  const sectionTitle = $("sectionTitle");
  const sectionClose = $("sectionClose");
  const sectionBackdrop = $("sectionBackdrop");

  /* ===== Config ===== */
  const CAROUSEL_COUNT = 3;

  const SECTIONS = [
    "Music",
    "Mail",
    "Camera",
    "Notes",
    "Calendar",
    "Tools",
    "Timer",
    "Stats",
    "Settings",
  ];
  const SECTION_COUNT = SECTIONS.length;

  /* ===== Date (auto, sv-SE) ===== */
  const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  function renderDate(){
    const d = new Date();
    const weekday = capFirst(new Intl.DateTimeFormat("sv-SE", { weekday: "long" }).format(d));
    const day = new Intl.DateTimeFormat("sv-SE", { day: "numeric" }).format(d);
    const month = capFirst(new Intl.DateTimeFormat("sv-SE", { month: "long" }).format(d));
    dateWeekday.textContent = weekday;
    dateDayMonth.textContent = `${day} ${month}`;
  }
  renderDate();
  setInterval(renderDate, 60_000);

  /* ===== Helpers ===== */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const getWidth = () => viewport.getBoundingClientRect().width || 1;

  function setSwipeP(p){
    document.documentElement.style.setProperty("--swipeP", String(clamp(p, 0, 1)));
  }

  function updateTripDots(i){
    tripDots.forEach((d, idx) => d.classList.toggle("isActive", idx === i));
  }

  /* ===== Carousel state ===== */
  let slideIndex = 0;

  function snapToSlide(i, animate=true){
    slideIndex = clamp(i, 0, CAROUSEL_COUNT - 1);
    const w = getWidth();
    const x = -slideIndex * w;

    if(animate){
      track.style.transition = "transform 240ms cubic-bezier(.2,.9,.2,1)";
      viewport.style.transition = "opacity 180ms ease";
    }else{
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

    updateTripDots(slideIndex);
  }

  /* ===== Horizontal swipe (3 slides) ===== */
  let dragging = false;
  let startX = 0;
  let dx = 0;
  let pointerId = null;

  viewport.addEventListener("pointerdown", (e) => {
    if(document.body.classList.contains("rubberActive")) return;
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
    if((slideIndex === 0 && dx > 0) || (slideIndex === CAROUSEL_COUNT - 1 && dx < 0)){
      dx *= 0.35;
    }

    const w = getWidth();
    const x = (-slideIndex * w) + dx;
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

    let next = slideIndex;
    if(p > 0.18){
      next = dx < 0 ? slideIndex + 1 : slideIndex - 1;
    }

    snapToSlide(next, true);

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

  window.addEventListener("resize", () => snapToSlide(slideIndex, false), { passive: true });

  /* ===============================
     LEFT ICON RAIL (render + highlight)
  =============================== */
  let activeSection = 0;

  function renderRail(){
    iconRail.innerHTML = "";
    SECTIONS.forEach((label, i) => {
      const item = document.createElement("div");
      item.className = "railItem" + (i === activeSection ? " isActive" : "");
      item.dataset.index = String(i);

      const ic = document.createElement("div");
      ic.className = "railIcon";

      const lb = document.createElement("div");
      lb.className = "railLabel";
      lb.textContent = label;

      item.appendChild(ic);
      item.appendChild(lb);

      // Tap to open too (nice bonus)
      item.addEventListener("click", () => openSection(i));

      iconRail.appendChild(item);
    });
  }

  function setActiveSection(i){
    activeSection = clamp(i, 0, SECTION_COUNT - 1);
    const items = Array.from(iconRail.querySelectorAll(".railItem"));
    items.forEach((el, idx) => el.classList.toggle("isActive", idx === activeSection));
  }

  renderRail();

  /* ===============================
     RIGHT RUBBER BAND
  =============================== */
  // Geometry
  function railCenters(){
    const items = Array.from(iconRail.querySelectorAll(".railItem"));
    return items.map(el => {
      const r = el.getBoundingClientRect();
      return r.top + r.height/2;
    });
  }

  // Rubber math: fast then stiff (feels like gum)
  function rubberBand(x, limit){
    const t = Math.max(0, x);
    const d = limit;
    return (d * t) / (d + t);
  }

  // Build SVG path with a single quadratic bend
  function setRubberPath(bendPx, yPx){
    const H = window.innerHeight;
    const W = 120;

    const top = 40;                  // padding top inside svg
    const bot = H - 40;
    const x0 = W - 18;               // anchor line near right
    const cx = x0 - bendPx;          // control point pulled left
    const cy = clamp(yPx, top, bot); // control y at finger

    rubberSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    rubberPath.setAttribute("d", `M ${x0} ${top} Q ${cx} ${cy} ${x0} ${bot}`);
  }

  // Place ball near the curve (approx)
  function setBall(bendPx, yPx){
    const rightBase = 14 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safeR")) || 0);
    const x = -(bendPx * 0.85); // pull ball left a bit with bend
    rubberBall.style.transform = `translate3d(${x}px, ${yPx}px, 0) translate3d(0,-50%,0)`;
  }

  // Magnet snap towards nearest rail center
  function nearestIndexFromY(y){
    const centers = railCenters();
    let best = 0;
    let bestD = Infinity;
    for(let i=0;i<centers.length;i++){
      const d = Math.abs(centers[i] - y);
      if(d < bestD){
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  function magnetY(y){
    const centers = railCenters();
    const i = nearestIndexFromY(y);
    const target = centers[i];

    // magnet strength: stronger when close, weaker when far
    const dist = Math.abs(target - y);
    const strength = 1 - clamp(dist / 140, 0, 1); // within 140px it pulls more
    const snapped = y + (target - y) * (0.55 * strength);

    return { y: snapped, idx: i };
  }

  // Gesture state
  let rubberTracking = false;
  let rubberActive = false;
  let rubberStartX = 0;
  let rubberPointer = null;
  let candidateIndex = 0;

  const EDGE_THRESHOLD = 18;
  const PULL_LIMIT = 140;

  function openRubber(){
    rubberActive = true;
    document.body.classList.add("rubberActive");
    rubberWrap.style.opacity = "1";
    setRubberPath(0, window.innerHeight/2);
  }

  function closeRubber(){
    rubberActive = false;
    document.body.classList.remove("rubberActive");
    rubberWrap.style.opacity = "0";
  }

  edgeZoneR.addEventListener("pointerdown", (e) => {
    if(sectionWrap.classList.contains("isOpen")) return;

    setBlockScroll(true);
    rubberTracking = true;
    rubberPointer = e.pointerId;
    rubberStartX = e.clientX;

    edgeZoneR.setPointerCapture(rubberPointer);
  });

  edgeZoneR.addEventListener("pointermove", (e) => {
    if(!rubberTracking || e.pointerId !== rubberPointer) return;

    // pull is how far left you drag from right edge zone start point
    const pullRaw = rubberStartX - e.clientX; // dragging left => positive
    if(!rubberActive){
      if(pullRaw > EDGE_THRESHOLD){
        openRubber();
      }else{
        return;
      }
    }

    const pull = rubberBand(pullRaw, PULL_LIMIT); // eased gum feel
    const bend = clamp(pull, 0, PULL_LIMIT);

    // magnet y toward nearest rail item
    const m = magnetY(e.clientY);
    candidateIndex = m.idx;

    // visuals
    setRubberPath(bend, m.y);
    setBall(bend, m.y);

    // highlight
    setActiveSection(candidateIndex);
  });

  function openSection(i){
    setActiveSection(i);
    sectionTitle.textContent = SECTIONS[i];
    sectionWrap.classList.add("isOpen");
    sectionWrap.setAttribute("aria-hidden", "false");
    setBlockScroll(false);
  }

  function closeSection(){
    sectionWrap.classList.remove("isOpen");
    sectionWrap.setAttribute("aria-hidden", "true");
    setBlockScroll(false);
  }

  function endRubber(commit){
    if(!rubberTracking) return;
    rubberTracking = false;

    if(rubberActive && commit){
      openSection(candidateIndex);
    }

    closeRubber();
    setBlockScroll(false);
  }

  edgeZoneR.addEventListener("pointerup", (e) => {
    if(rubberPointer !== null && e.pointerId !== rubberPointer) return;
    endRubber(true);
    rubberPointer = null;
  });

  edgeZoneR.addEventListener("pointercancel", (e) => {
    if(rubberPointer !== null && e.pointerId !== rubberPointer) return;
    endRubber(false);
    rubberPointer = null;
  });

  rubberBackdrop.addEventListener("click", () => {
    closeRubber();
    setBlockScroll(false);
  });

  sectionClose.addEventListener("click", closeSection);
  sectionBackdrop.addEventListener("click", closeSection);

  /* ===== Init ===== */
  snapToSlide(0, false);
  setActiveSection(0);

})();
