(() => {

  const VIEWS = [
    { id:"weather", icon:"assets/ui/icon-weather.svg", label:"Weather" },
    { id:"news", icon:"assets/ui/icon-news.svg", label:"News" },
    { id:"todo", icon:"assets/ui/icon-todo.svg", label:"Todo" },
    { id:"ideas", icon:"assets/ui/icon-ideas.svg", label:"Ideas" },
    { id:"done", icon:"assets/ui/icon-done.svg", label:"Done" },
    { id:"pomodoro", icon:"assets/ui/icon-pomodoro.svg", label:"Timer" }
  ];

  const wheel = document.getElementById("wheel");
  const wheelIcon = document.getElementById("wheelIcon");
  const wheelRing = document.querySelector(".wheelRing");
  const previewText = document.getElementById("previewText");

  const sheet = document.getElementById("sheet");
  const sheetClose = document.getElementById("sheetClose");
  const sheetTitle = document.getElementById("sheetTitle");
  const sheetBody = document.getElementById("sheetBody");

  let currentIndex = 0;
  let isOpen = false;

  function updateUI(){
    const view = VIEWS[currentIndex];
    wheelIcon.src = view.icon;
    previewText.textContent = `Preview: ${view.label}`;
    if(isOpen){
      sheetTitle.textContent = view.label;
      sheetBody.innerHTML = `<p>${view.label} content här...</p>`;
    }
  }

  function setIndex(i){
    if(i < 0) i = VIEWS.length - 1;
    if(i >= VIEWS.length) i = 0;
    currentIndex = i;
    updateUI();
  }

  // Scroll wheel
  wheel.addEventListener("wheel", (e)=>{
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    setIndex(currentIndex + dir);
  }, { passive:false });

  // Click open
  wheel.addEventListener("click", ()=>{
    if(!isOpen){
      isOpen = true;
      sheet.classList.add("open");
      updateUI();
    }
  });

  sheetClose.addEventListener("click", ()=>{
    isOpen = false;
    sheet.classList.remove("open");
  });

  updateUI();

})();
