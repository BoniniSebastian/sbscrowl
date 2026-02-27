(() => {
  console.log("SB Dash v1 (rubber-right v6) loaded ✅");
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
  const rubberSvg = $("rubberSvg");
  const rubberPath = $("rubberPath");
  const rubberBackdrop = $("rubberBackdrop");

  // Panel
  const sectionWrap = $("sectionWrap");
  const sectionPanel = $("sectionPanel");
  const sectionTitle = $("sectionTitle");
  const sectionBackdrop = $("sectionBackdrop");

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

  /* ===== Carousel ===== */
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

    if((slideIndex===0 && dx>0) || (slideIndex===CAROUSEL_COUNT-1 && dx<0)) dx*=0.35;

    const w=getWidth();
    track.style.transform = `translate3d(${(-slideIndex*w)+dx}px,0,0)`;

    const p=Math.min(1, Math.abs(dx)/w);
    viewport.style.opacity = String(1-0.28*p);
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
     ICON RAIL (render + highlight)
  =============================== */
  let activeSection = 0;

  function renderRail(){
    iconRail.innerHTML = "";
    SECTIONS.forEach((label, i)=>{
      const item=document.createElement("div");
      item.className="railItem"+(i===activeSection?" isActive":"");
      item.dataset.index=String(i);

      const ic=document.createElement("div");
      ic.className="railIcon"; // tiny placeholder dot

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
     RUBBER BAND (RIGHT)
  =============================== */
  function rubberBand(x, limit){
    const t=Math.max(0,x);
    const d=limit;
    return (d*t)/(d+t);
  }

  function magnetY(y){
    const centers = railCenters();
    let best=0, bestD=Infinity;
    for(let i=0;i<centers.length;i++){
      const d=Math.abs(centers[i]-y);
      if(d<bestD){ bestD=d; best=i; }
    }
    const target=centers[best] ?? (window.innerHeight/2);

    const dist=Math.abs(target-y);
    const strength=1 - clamp(dist/140, 0, 1);
    const snapped = y + (target - y) * (0.55 * strength);

    return { y: snapped, idx: best };
  }

  function setRubberPath(bendPx, yPx){
    const wrap = $("rubberWrap");
    const rect = wrap.getBoundingClientRect();
    const H = rect.height;
    const W = 120;

    const top = 20;
    const bot = H - 20;

    // anchor near right inside svg
    const x0 = W - 16;

    // bend left
    const cx = x0 - bendPx;
    const cy = clamp(yPx, top, bot);

    rubberSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    rubberPath.setAttribute("d", `M ${x0} ${top} Q ${cx} ${cy} ${x0} ${bot}`);
  }

  let rubberTracking=false, rubberActive=false, rubberStartX=0, rubberPointer=null, candidateIndex=0;

  const EDGE_THRESHOLD = 18;
  const PULL_LIMIT = 220;   // bigger pull so it goes out longer
  const BEND_LIMIT = 180;   // max bend

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

    const pull = rubberBand(pullRaw, PULL_LIMIT);
    const bend = clamp(pull, 0, BEND_LIMIT);

    // Convert finger Y to rubberWrap local Y
    const wrap = $("rubberWrap");
    const rect = wrap.getBoundingClientRect();
    const localY = e.clientY - rect.top;

    const m = magnetY(e.clientY); // magnet in screen coords
    candidateIndex = m.idx;

    // map snapped screen Y to local Y
    const snappedLocalY = (m.y - rect.top);

    setRubberPath(bend, snappedLocalY);
    setActiveSection(candidateIndex);
  });

  function openSection(i){
    setActiveSection(i);
    sectionTitle.textContent = SECTIONS[i];

    document.body.classList.add("panelOpen");
    sectionWrap.classList.add("isOpen");
    sectionWrap.setAttribute("aria-hidden","false");

    // close rubber/rail while panel open
    closeRubber();
    setBlockScroll(false);

    // reset panel position
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
    closeRubber();
    setBlockScroll(false);
  });

  /* ===============================
     PANEL: swipe down to close
  =============================== */
  let panelDragging=false, panelStartY=0, panelDY=0, panelPid=null;

  sectionPanel.addEventListener("pointerdown",(e)=>{
    if(!sectionWrap.classList.contains("isOpen")) return;
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
    if(panelDY < 0) panelDY *= 0.15; // little resistance upwards
    sectionPanel.style.transform = `translateX(-50%) translateY(${panelDY}px)`;
  });

  function endPanelDrag(){
    if(!panelDragging) return;
    panelDragging=false;

    const closeThreshold = 120;
    const velocityClose = Math.abs(panelDY) > closeThreshold;

    if(panelDY > closeThreshold || velocityClose){
      // animate out then close
      sectionPanel.style.transition = "transform 220ms cubic-bezier(.2,.9,.2,1)";
      sectionPanel.style.transform = `translateX(-50%) translateY(${Math.max(panelDY, 380)}px)`;
      setTimeout(closeSection, 180);
    }else{
      // snap back
      sectionPanel.style.transition = "transform 220ms cubic-bezier(.2,.9,.2,1)";
      sectionPanel.style.transform = "translateX(-50%) translateY(0px)";
    }

    panelDY=0; panelPid=null;
  }

  sectionPanel.addEventListener("pointerup", (e)=>{ if(panelPid!==null && e.pointerId!==panelPid) return; endPanelDrag(); });
  sectionPanel.addEventListener("pointercancel",(e)=>{ if(panelPid!==null && e.pointerId!==panelPid) return; endPanelDrag(); });

  sectionBackdrop.addEventListener("click", closeSection);

  /* ===== Init ===== */
  snapToSlide(0,false);
  setActiveSection(0);

})();
