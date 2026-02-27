(() => {
  console.log("SB Dash v1 (v7) loaded ✅");
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
  const rubberBackdrop = $("rubberBackdrop");

  // Panel
  const sectionWrap = $("sectionWrap");
  const sectionPanel = $("sectionPanel");
  const sectionTitle = $("sectionTitle");

  /* ===== Config ===== */
  const CAROUSEL_COUNT = 3;
  const SECTIONS = ["Music","Mail","Camera","Notes","Calendar","Tools","Timer","Stats","Settings"];
  const SECTION_COUNT = SECTIONS.length;

  /* ===== Date ===== */
  const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  function renderDate(){
    const d = new Date();
    dateWeekday.textContent = capFirst(new Intl.DateTimeFormat("sv-SE",{weekday:"long"}).format(d));
    const day = new Intl.DateTimeFormat("sv-SE",{day:"numeric"}).format(d);
    const month = capFirst(new Intl.DateTimeFormat("sv-SE",{month:"long"}).format(d));
    dateDayMonth.textContent = `${day} ${month}`;
  }
  renderDate();
  setInterval(renderDate, 60_000);

  /* ===== Helpers ===== */
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const getWidth = ()=>viewport.getBoundingClientRect().width || 1;
  const setSwipeP = (p)=>document.documentElement.style.setProperty("--swipeP", String(clamp(p,0,1)));

  function updateTripDots(i){
    tripDots.forEach((d, idx)=>d.classList.toggle("isActive", idx===i));
  }

  /* ===============================
     CAROUSEL (3 slides) – content swipe
  =============================== */
  let slideIndex = 0;

  function snapToSlide(i, animate=true){
    slideIndex = clamp(i, 0, CAROUSEL_COUNT - 1);
    const w = getWidth();
    const x = -slideIndex * w;

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
      setTimeout(()=>{ track.style.transition=""; viewport.style.transition=""; }, 260);
    }
    updateTripDots(slideIndex);
  }

  let dragging=false, startX=0, dx=0, pointerId=null;

  viewport.addEventListener("pointerdown",(e)=>{
    if(document.body.classList.contains("rubberActive")) return;
    if(sectionWrap.classList.contains("isOpen")) return;

    setBlockScroll(true);
    dragging=true; pointerId=e.pointerId; startX=e.clientX; dx=0;
    viewport.setPointerCapture(pointerId);
    track.style.transition=""; viewport.style.transition="";
  });

  viewport.addEventListener("pointermove",(e)=>{
    if(!dragging || e.pointerId!==pointerId) return;
    dx = e.clientX - startX;

    // resistance at ends
    if((slideIndex===0 && dx>0) || (slideIndex===CAROUSEL_COUNT-1 && dx<0)) dx*=0.35;

    const w=getWidth();
    track.style.transform = `translate3d(${(-slideIndex*w)+dx}px,0,0)`;

    const p=Math.min(1, Math.abs(dx)/w);
    // make whole view dim a bit while swiping (optional but nice)
    viewport.style.opacity = String(1 - 0.10*p);
    // MUCH stronger card contrast handled via CSS ::before
    setSwipeP(p);
  });

  function endDrag(){
    if(!dragging) return;
    dragging=false;

    const w=getWidth();
    const p=Math.abs(dx)/w;
    let next=slideIndex;
    if(p>0.18) next = dx<0 ? slideIndex+1 : slideIndex-1;

    snapToSlide(next,true);
    dx=0; pointerId=null;
    setBlockScroll(false);
  }

  viewport.addEventListener("pointerup",(e)=>{ if(pointerId!==null && e.pointerId!==pointerId) return; endDrag(); });
  viewport.addEventListener("pointercancel",(e)=>{ if(pointerId!==null && e.pointerId!==pointerId) return; endDrag(); });
  window.addEventListener("resize", ()=>snapToSlide(slideIndex,false), {passive:true});

  /* ===============================
     ICON RAIL
  =============================== */
  let activeSection = 0;

  function renderRail(){
    iconRail.innerHTML = "";
    SECTIONS.forEach((label, i)=>{
      const item=document.createElement("div");
      item.className="railItem"+(i===activeSection?" isActive":"");

      const ic=document.createElement("div");
      ic.className="railIcon";

      const lb=document.createElement("div");
      lb.className="railLabel";
      lb.textContent=label;

      item.appendChild(ic);
      item.appendChild(lb);

      // tap open (optional)
      item.addEventListener("click", ()=>openSection(i));

      iconRail.appendChild(item);
    });
  }

  function setActiveSection(i){
    activeSection = clamp(i,0,SECTION_COUNT-1);
    Array.from(iconRail.querySelectorAll(".railItem")).forEach((el, idx)=>{
      el.classList.toggle("isActive", idx===activeSection);
    });
  }

  renderRail();

  function railCenters(){
    const items = Array.from(iconRail.querySelectorAll(".railItem"));
    return items.map(el=>{
      const r=el.getBoundingClientRect();
      return r.top + r.height/2;
    });
  }

  /* ===============================
     RUBBER BAND (RIGHT) – MORE ELASTIC + LONGER
  =============================== */

  // More elastic curve: rises fast, keeps moving, then slowly stiffens
  function elasticPull(x){
    const t = Math.max(0, x);
    // Two-stage feel: exponential + soft tail
    const a = 320 * (1 - Math.exp(-t / 120));  // quick rise
    const b = 220 * (1 - Math.exp(-t / 420));  // long tail
    return a + b; // can go big
  }

  function magnetY(screenY){
    const centers = railCenters();
    let best=0, bestD=Infinity;
    for(let i=0;i<centers.length;i++){
      const d=Math.abs(centers[i]-screenY);
      if(d<bestD){ bestD=d; best=i; }
    }
    const target=centers[best] ?? (window.innerHeight/2);

    const dist=Math.abs(target-screenY);
    const strength=1 - clamp(dist/170, 0, 1);
    const snapped = screenY + (target - screenY) * (0.62 * strength);

    return { y: snapped, idx: best };
  }

  function setRubberPath(bendPx, yLocal){
    const rect = rubberWrap.getBoundingClientRect();
    const H = rect.height;
    const W = 140;

    const top = 14;
    const bot = H - 14;
    const x0 = W - 16;

    const cx = x0 - bendPx;
    const cy = clamp(yLocal, top, bot);

    rubberSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    rubberPath.setAttribute("d", `M ${x0} ${top} Q ${cx} ${cy} ${x0} ${bot}`);
  }

  let rubberTracking=false, rubberActive=false, rubberStartX=0, rubberPointer=null, candidateIndex=0;

  const EDGE_THRESHOLD = 14;
  const BEND_MAX = 260;  // MUCH longer bend

  function openRubber(){
    rubberActive=true;
    document.body.classList.add("rubberActive");
  }

  function closeRubber(){
    rubberActive=false;
    document.body.classList.remove("rubberActive");
  }

  edgeZoneR.addEventListener("pointerdown",(e)=>{
    if(sectionWrap.classList.contains("isOpen")) return;

    setBlockScroll(true);
    rubberTracking=true;
    rubberPointer=e.pointerId;
    rubberStartX=e.clientX;

    edgeZoneR.setPointerCapture(rubberPointer);
  });

  edgeZoneR.addEventListener("pointermove",(e)=>{
    if(!rubberTracking || e.pointerId!==rubberPointer) return;

    const pullRaw = rubberStartX - e.clientX; // drag left => positive

    if(!rubberActive){
      if(pullRaw > EDGE_THRESHOLD){
        openRubber();
      } else {
        return;
      }
    }

    // strong elastic
    const bend = clamp(elasticPull(pullRaw), 0, BEND_MAX);

    // snap/magnet to rail rows
    const m = magnetY(e.clientY);
    candidateIndex = m.idx;

    // local coords inside rubberWrap
    const rect = rubberWrap.getBoundingClientRect();
    const yLocal = (m.y - rect.top);

    setRubberPath(bend, yLocal);
    setActiveSection(candidateIndex);
  });

  function openSection(i){
    setActiveSection(i);
    sectionTitle.textContent = SECTIONS[i];

    document.body.classList.add("panelOpen");
    sectionWrap.classList.add("isOpen");
    sectionWrap.setAttribute("aria-hidden","false");

    // hide rubber/rail while panel open
    closeRubber();
    setBlockScroll(false);

    // reset panel
    sectionPanel.style.transition = "";
    sectionPanel.style.transform = "translateX(-50%) translateY(0px)";
  }

  function closeSection(){
    document.body.classList.remove("panelOpen");
    sectionWrap.classList.remove("isOpen");
    sectionWrap.setAttribute("aria-hidden","true");
    setBlockScroll(false);
  }

  function endRubber(commit){
    if(!rubberTracking) return;
    rubberTracking=false;

    if(rubberActive && commit){
      openSection(candidateIndex);
    } else {
      closeRubber();
      setBlockScroll(false);
    }
  }

  edgeZoneR.addEventListener("pointerup",(e)=>{
    if(rubberPointer!==null && e.pointerId!==rubberPointer) return;
    endRubber(true);
    rubberPointer=null;
  });

  edgeZoneR.addEventListener("pointercancel",(e)=>{
    if(rubberPointer!==null && e.pointerId!==rubberPointer) return;
    endRubber(false);
    rubberPointer=null;
  });

  rubberBackdrop.addEventListener("click", ()=>{
    // just cancel the rubber (not opening/closing panels)
    closeRubber();
    setBlockScroll(false);
  });

  /* ===============================
     PANEL: swipe DOWN to close (ONLY)
  =============================== */
  let panelDragging=false, panelStartY=0, panelDY=0, panelPid=null;

  sectionPanel.addEventListener("pointerdown",(e)=>{
    if(!sectionWrap.classList.contains("isOpen")) return;

    // start tracking down drag
    panelDragging=true;
    panelPid=e.pointerId;
    panelStartY=e.clientY;
    panelDY=0;

    sectionPanel.setPointerCapture(panelPid);
    sectionPanel.style.transition = "";
  });

  sectionPanel.addEventListener("pointermove",(e)=>{
    if(!panelDragging || e.pointerId!==panelPid) return;

    panelDY = e.clientY - panelStartY;

    // allow only down movement (up has resistance)
    if(panelDY < 0) panelDY *= 0.12;

    sectionPanel.style.transform = `translateX(-50%) translateY(${panelDY}px)`;
  });

  function endPanelDrag(){
    if(!panelDragging) return;
    panelDragging=false;

    const closeThreshold = 120;

    if(panelDY > closeThreshold){
      // animate out then close
      sectionPanel.style.transition = "transform 220ms cubic-bezier(.2,.9,.2,1)";
      sectionPanel.style.transform = `translateX(-50%) translateY(${Math.max(panelDY, 520)}px)`;
      setTimeout(closeSection, 180);
    } else {
      // snap back
      sectionPanel.style.transition = "transform 220ms cubic-bezier(.2,.9,.2,1)";
      sectionPanel.style.transform = "translateX(-50%) translateY(0px)";
    }

    panelDY=0; panelPid=null;
  }

  sectionPanel.addEventListener("pointerup",(e)=>{ if(panelPid!==null && e.pointerId!==panelPid) return; endPanelDrag(); });
  sectionPanel.addEventListener("pointercancel",(e)=>{ if(panelPid!==null && e.pointerId!==panelPid) return; endPanelDrag(); });

  /* ===== Init ===== */
  snapToSlide(0,false);
  setActiveSection(0);

})();
