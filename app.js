(() => {

  console.log("SB Dash v1 loaded ✅");

  const $ = (id) => document.getElementById(id);

  /* ===============================
     Stable viewport height (iOS fix)
  =============================== */
  function setVH(){
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  }
  setVH();
  window.addEventListener("resize", setVH);

  /* ===============================
     Elements
  =============================== */
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

  const SLIDE_COUNT = 9;

  /* ===============================
     Date (auto Swedish)
  =============================== */
  function capFirst(str){
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function renderDate(){
    const now = new Date();

    const weekday = capFirst(
      new Intl.DateTimeFormat("sv-SE", { weekday: "long" }).format(now)
    );

    const day = new Intl.DateTimeFormat("sv-SE", { day: "numeric" }).format(now);

    const month = capFirst(
      new Intl.DateTimeFormat("sv-SE", { month: "long" }).format(now)
    );

    dateWeekday.textContent = weekday;
    dateDayMonth.textContent = `${day} ${month}`;
  }

  renderDate();
  setInterval(renderDate, 60000);

  /* ===============================
     Carousel State
  =============================== */
  let index = 0;

  function clamp(v, min, max){
    return Math.max(min, Math.min(max, v));
  }

  function getWidth(){
    return viewport.getBoundingClientRect().width || 1;
  }

  function updateTripDots(i){
    const group = Math.floor(i / 3);
    tripDots.forEach((d, idx) =>
      d.classList.toggle("isActive", idx === group)
    );
  }

  function snapTo(i, animate = true){
    index = clamp(i, 0, SLIDE_COUNT - 1);

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

    if(animate){
      setTimeout(() => {
        track.style.transition = "";
        viewport.style.transition = "";
      }, 260);
    }

    updateTripDots(index);
  }

  /* ===============================
     Horizontal Swipe
  =============================== */
  let dragging = false;
  let startX = 0;
  let dx = 0;
  let pointerId = null;

  viewport.addEventListener("pointerdown", (e) => {

    if(document.body.classList.contains("edgeActive")) return;

    dragging = true;
    pointerId = e.pointerId;
    startX = e.clientX;
    dx = 0;

    viewport.setPointerCapture(pointerId);
    track.style.transition = "";
  });

  viewport.addEventListener("pointermove", (e) => {

    if(!dragging || e.pointerId !== pointerId) return;

    dx = e.clientX - startX;

    if((index === 0 && dx > 0) ||
       (index === SLIDE_COUNT - 1 && dx < 0)){
      dx *= 0.35;
    }

    const w = getWidth();
    const x = (-index * w) + dx;
    track.style.transform = `translate3d(${x}px,0,0)`;

    const p = Math.min(1, Math.abs(dx) / w);
    viewport.style.opacity = 1 - 0.28 * p;
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
  }

  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);

  window.addEventListener("resize", () => snapTo(index, false));

  /* ===============================
     Edge Selector
  =============================== */

  const edgeDots = [];

  for(let i = 0; i < SLIDE_COUNT; i++){
    const dot = document.createElement("div");
    dot.className = "edgeDot";
    edgeDotsWrap.appendChild(dot);
    edgeDots.push(dot);
  }

  function getDotCenters(){
    return edgeDots.map(d => {
      const r = d.getBoundingClientRect();
      return r.top + r.height / 2;
    });
  }

  function movePickerToIndex(i){
    const centers = getDotCenters();
    const y = centers[i] || window.innerHeight / 2;

    edgePicker.style.transform =
      `translate3d(0, ${y - window.innerHeight / 2}px, 0) translateY(-50%)`;
  }

  let edgeTracking = false;
  let edgeActive = false;
  let edgeStartX = 0;
  let edgePointer = null;
  let candidateIndex = 0;

  const EDGE_THRESHOLD = 22;
  const EDGE_PULL_MAX = 110;

  function openEdge(){
    edgeActive = true;
    document.body.classList.add("edgeActive");
    edgePicker.style.opacity = "1";
    movePickerToIndex(index);
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
    const percent = -100 + (p / EDGE_PULL_MAX) * 92;
    edgeSelector.style.transform = `translate3d(${percent}%,0,0)`;
    edgeSelector.style.opacity = "1";
  }

  edgeZone.addEventListener("pointerdown", (e) => {
    edgeTracking = true;
    edgePointer = e.pointerId;
    edgeStartX = e.clientX;
    edgeZone.setPointerCapture(edgePointer);
  });

  edgeZone.addEventListener("pointermove", (e) => {

    if(!edgeTracking || e.pointerId !== edgePointer) return;

    const pull = e.clientX - edgeStartX;

    if(!edgeActive){
      if(pull > EDGE_THRESHOLD){
        openEdge();
      } else {
        return;
      }
    }

    setEdgePull(pull);

    const centers = getDotCenters();
    let best = 0;
    let bestDist = Infinity;

    centers.forEach((c, i) => {
      const d = Math.abs(c - e.clientY);
      if(d < bestDist){
        bestDist = d;
        best = i;
      }
    });

    candidateIndex = best;
    movePickerToIndex(best);
  });

  function endEdge(commit){
    if(!edgeTracking) return;

    edgeTracking = false;

    if(edgeActive && commit){
      snapTo(candidateIndex, true);
    }

    closeEdge();
  }

  edgeZone.addEventListener("pointerup", () => endEdge(true));
  edgeZone.addEventListener("pointercancel", () => endEdge(false));

  edgeBackdrop.addEventListener("click", closeEdge);

  /* ===============================
     Init
  =============================== */
  snapTo(0, false);

})();
