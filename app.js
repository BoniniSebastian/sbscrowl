(() => {

  console.log("SB Dash v1 loaded ✅");

  const $ = (id) => document.getElementById(id);

  /* ===== Stable viewport height (iOS) ===== */
  function setVH(){
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  }
  setVH();
  window.addEventListener("resize", setVH);

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

  /* ===== Horizontal swipe (3 slides) ===== */
  let dragging = false;
  let startX = 0;
  let dx = 0;
  let pointerId = null;

  viewport.addEventListener("pointerdown", (e) => {
    if(document.body.classList.contains("edgeActive")) return;
    if(sectionWrap.classList.contains("isOpen")) return;

    dragging = true;
    pointerId = e.pointerId;
    start
