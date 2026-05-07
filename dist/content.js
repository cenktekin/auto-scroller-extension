var S=Object.defineProperty;var y=(o,s,n)=>s in o?S(o,s,{enumerable:!0,configurable:!0,writable:!0,value:n}):o[s]=n;var a=(o,s,n)=>y(o,typeof s!="symbol"?s+"":s,n);import{D as f}from"./assets/types.js";(()=>{const o={STORAGE_UNAVAILABLE:"Chrome storage API is not available",STORAGE_LOAD_FAILED:"Failed to load settings from storage",STORAGE_SAVE_FAILED:"Failed to save settings to storage",DOM_MANIPULATION_FAILED:"Failed to manipulate DOM element",SCROLL_OPERATION_FAILED:"Failed to perform scroll operation",MESSAGE_HANDLING_FAILED:"Failed to handle extension message"},s=(h,t)=>{console.error(`AutoScroll Reader ${h} failed:`,t||"Unknown error")},n=h=>{console.error(`AutoScroll Reader Error: ${h}`)};class u{constructor(){a(this,"settings",f);a(this,"focusLine",null);a(this,"progressBar",null);a(this,"animationFrameId",null);a(this,"storageAvailable");a(this,"isToggling",!1);a(this,"BASE_SPEED_PPS",12);a(this,"TOGGLE_TIMEOUT",100);a(this,"USER_PAUSE_RESUME_DELAY",1500);a(this,"lastTimestamp",null);a(this,"subpixelRemainder",0);a(this,"isReadingMode",!1);a(this,"readingModeStyleEl",null);a(this,"isPausedByUser",!1);a(this,"pauseTimeoutId",null);a(this,"scrollStep",t=>{if(!this.settings.isScrolling||this.isPausedByUser)return;const i=this.lastTimestamp===null?1/60:Math.max(0,(t-this.lastTimestamp)/1e3);this.lastTimestamp=t;const e=this.BASE_SPEED_PPS*this.settings.scrollSpeed;if(e===0){this.animationFrameId=requestAnimationFrame(this.scrollStep);return}let l=(this.settings.scrollDirection==="up"?-1:1)*e*i+this.subpixelRemainder;const c=l>0?Math.floor(l):Math.ceil(l);this.subpixelRemainder=l-c;const d=document.scrollingElement||document.documentElement,g=Math.max(0,d.scrollHeight-window.innerHeight);if(c!==0){const p=Math.max(0,Math.min(d.scrollTop+c,g));d.scrollTop=p,this.updateProgress()}(this.settings.scrollDirection==="down"?d.scrollTop>=g:d.scrollTop<=0)?(this.stopScrolling(),this.storageAvailable&&chrome.storage.local.set({readerSettings:{...this.settings,isScrolling:!1}})):this.animationFrameId=requestAnimationFrame(this.scrollStep)});this.storageAvailable=!!(typeof chrome<"u"&&chrome.storage&&chrome.storage.local),this.init()}setupSpeedHotkeys(){try{window.addEventListener("keydown",t=>{try{const i=t.target;if(!!i&&(i.tagName==="INPUT"||i.tagName==="TEXTAREA"||i.isContentEditable))return;const r=t.key==="+"||t.key==="="||t.code==="NumpadAdd",l=t.key==="-"||t.key==="_"||t.code==="NumpadSubtract";if(!r&&!l)return;t.preventDefault();const d=(g=>Math.max(0,Math.min(10,g)))(this.settings.scrollSpeed+(r?1:-1));if(d===this.settings.scrollSpeed)return;this.updateSettings({scrollSpeed:d}),this.showSpeedToast(d),this.storageAvailable&&chrome.storage.local.set({readerSettings:{...this.settings,scrollSpeed:d}})}catch(i){s("handling speed hotkeys",i)}},{capture:!0})}catch(t){s("setting up speed hotkeys",t)}}showSpeedToast(t){const i=document.getElementById("autoscroll-speed-toast");i&&i.remove();const e=document.createElement("div");e.id="autoscroll-speed-toast",e.textContent=`Speed: ${t}`,Object.assign(e.style,{position:"fixed",bottom:"24px",left:"50%",transform:"translateX(-50%)",background:"rgba(17, 24, 39, 0.9)",color:"#e5e7eb",padding:"6px 16px",borderRadius:"8px",fontSize:"13px",fontFamily:"system-ui, sans-serif",zIndex:"2147483647",pointerEvents:"none",transition:"opacity 0.3s",opacity:"1"}),document.body.appendChild(e),setTimeout(()=>{e.style.opacity="0",setTimeout(()=>e.remove(),300)},800)}setupUserScrollPause(){window.addEventListener("wheel",()=>{!this.settings.isScrolling||this.isPausedByUser||(this.isPausedByUser=!0,this.animationFrameId!==null&&(cancelAnimationFrame(this.animationFrameId),this.animationFrameId=null),this.pauseTimeoutId!==null&&clearTimeout(this.pauseTimeoutId),this.pauseTimeoutId=window.setTimeout(()=>{this.isPausedByUser=!1,this.pauseTimeoutId=null,this.settings.isScrolling&&(this.lastTimestamp=null,this.subpixelRemainder=0,this.animationFrameId=requestAnimationFrame(this.scrollStep))},this.USER_PAUSE_RESUME_DELAY))},{capture:!0,passive:!0})}async init(){await this.loadSettings(),this.createFocusLine(),this.createProgressBar(),this.setupMessageListener(),this.setupStorageListener(),this.setupSpeedHotkeys(),this.setupUserScrollPause(),this.settings.isScrolling&&this.startScrolling()}loadSettings(){return new Promise(t=>{if(!this.storageAvailable)return console.warn("AutoScroll Reader:",o.STORAGE_UNAVAILABLE),n(o.STORAGE_UNAVAILABLE),t();try{chrome.storage.local.get("readerSettings",i=>{try{chrome.runtime.lastError?(s("loading settings",chrome.runtime.lastError),n(o.STORAGE_LOAD_FAILED)):i.readerSettings&&(this.settings={...this.settings,...i.readerSettings}),t()}catch(e){s("processing loaded settings",e),n(o.STORAGE_LOAD_FAILED),t()}})}catch(i){s("storage get operation",i),n(o.STORAGE_LOAD_FAILED),t()}})}enableReadingMode(){try{if(this.isReadingMode)return;document.documentElement.setAttribute("data-autoscroll-reading-mode","on");const t=`
          html[data-autoscroll-reading-mode='on'] body {
            background: #111827 !important;
            color: #e5e7eb !important;
            line-height: 1.7 !important;
            font-size: 18px !important;
            visibility: visible !important;
            display: block !important;
            overflow-y: auto !important;
          }
          html[data-autoscroll-reading-mode='on'] html {
            visibility: visible !important;
            display: block !important;
          }
          html[data-autoscroll-reading-mode='on'] img, 
          html[data-autoscroll-reading-mode='on'] figure, 
          html[data-autoscroll-reading-mode='on'] video { 
            max-width: 100%; height: auto; display: block; margin: 1rem auto; 
          }
          /* Center main content and limit width */
          html[data-autoscroll-reading-mode='on'] main, 
          html[data-autoscroll-reading-mode='on'] article, 
          html[data-autoscroll-reading-mode='on'] .content, 
          html[data-autoscroll-reading-mode='on'] .post, 
          html[data-autoscroll-reading-mode='on'] [role='main'] {
            max-width: 800px; margin: 0 auto; padding: 0 16px; 
          }
          /* Hide common clutter but avoid removing structural layout */
          html[data-autoscroll-reading-mode='on'] [class*='sidebar' i],
          html[data-autoscroll-reading-mode='on'] [class*='ad' i],
          html[data-autoscroll-reading-mode='on'] .ads,
          html[data-autoscroll-reading-mode='on'] .advertisement,
          html[data-autoscroll-reading-mode='on'] [id*='cookie' i],
          html[data-autoscroll-reading-mode='on'] [aria-label*='cookie' i],
          /* Hide common overlays/popups instead of all fixed-position elements */
          html[data-autoscroll-reading-mode='on'] [aria-modal='true'],
          html[data-autoscroll-reading-mode='on'] [role='dialog'],
          html[data-autoscroll-reading-mode='on'] [class*='modal' i],
          html[data-autoscroll-reading-mode='on'] [class*='overlay' i],
          html[data-autoscroll-reading-mode='on'] [class*='popup' i],
          html[data-autoscroll-reading-mode='on'] [class*='banner' i][style*='position:fixed' i] {
            display: none !important;
          }
          /* Keep focus line above everything; JS controls visibility */
          html[data-autoscroll-reading-mode='on'] #autoscroll-focus-line {
            display: block !important;
            pointer-events: none !important;
            z-index: 2147483647 !important;
          }
        `,i=`
          html[data-autoscroll-reading-mode='on'] body {
            background: #111827 !important;
            color: #e5e7eb !important;
            line-height: 1.7 !important;
            font-size: 18px !important;
            visibility: visible !important;
            display: block !important;
            overflow-y: auto !important;
          }
          html[data-autoscroll-reading-mode='on'] html { visibility: visible !important; display: block !important; }
          /* Center main content and limit width */
          html[data-autoscroll-reading-mode='on'] main, 
          html[data-autoscroll-reading-mode='on'] article, 
          html[data-autoscroll-reading-mode='on'] .content, 
          html[data-autoscroll-reading-mode='on'] .post, 
          html[data-autoscroll-reading-mode='on'] [role='main'] {
            max-width: 800px; margin: 0 auto; padding: 0 16px; 
          }
          /* Keep everything else, just ensure focus line on top; JS controls visibility */
          html[data-autoscroll-reading-mode='on'] #autoscroll-focus-line {
            display: block !important;
            pointer-events: none !important;
            z-index: 2147483647 !important;
          }
        `;this.readingModeStyleEl=document.createElement("style"),this.readingModeStyleEl.id="autoscroll-reading-style",this.readingModeStyleEl.textContent=t,document.head.appendChild(this.readingModeStyleEl);const e=document.documentElement.scrollHeight;let r=!1;const l=()=>{if(!r)try{const m=document.documentElement.scrollHeight;m>0&&e>0&&m/e<.6&&(this.readingModeStyleEl.textContent=i,r=!0,g())}catch{}},c=()=>l(),d=new MutationObserver(()=>l()),g=()=>{window.removeEventListener("scroll",c,!0);try{d.disconnect()}catch{}};window.addEventListener("scroll",c,!0);try{d.observe(document.documentElement,{childList:!0,subtree:!0,attributes:!1})}catch{}setTimeout(l,0),this.isReadingMode=!0}catch(t){s("enabling reading mode",t)}}disableReadingMode(){try{document.documentElement.removeAttribute("data-autoscroll-reading-mode"),this.readingModeStyleEl&&(this.readingModeStyleEl.remove(),this.readingModeStyleEl=null),this.isReadingMode=!1}catch(t){s("disabling reading mode",t)}}toggleReadingMode(){this.isReadingMode?this.disableReadingMode():this.enableReadingMode()}setupMessageListener(){try{chrome.runtime.onMessage.addListener((t,i,e)=>{try{switch(t.type){case"TOGGLE_SCROLL":this.toggleScrolling(),e({isScrolling:this.settings.isScrolling});break;case"UPDATE_SETTINGS":t.payload&&this.updateSettings(t.payload),e({success:!0});break;case"GET_STATUS":e({isScrolling:this.settings.isScrolling});break;case"TOGGLE_READING_MODE":this.toggleReadingMode(),e({readingMode:this.isReadingMode});break;default:console.warn("AutoScroll Reader: Unknown message type received:",t.type),e({error:"Unknown message type"})}}catch(r){s("message processing",r),n(o.MESSAGE_HANDLING_FAILED),e({error:"Message processing failed"})}return!0})}catch(t){s("setting up message listener",t),n(o.MESSAGE_HANDLING_FAILED)}}setupStorageListener(){try{this.storageAvailable&&chrome.storage.onChanged?chrome.storage.onChanged.addListener((t,i)=>{try{if(i==="local"&&t.readerSettings){if(this.isToggling)return;const e=t.readerSettings.newValue,r={...this.settings},l=r.isScrolling!==e.isScrolling,c=r.lineColor!==e.lineColor||r.lineThickness!==e.lineThickness||r.lineOpacity!==e.lineOpacity||r.scrollSpeed!==e.scrollSpeed;l&&(this.settings.isScrolling=e.isScrolling,this.focusLine&&(this.focusLine.style.visibility=this.settings.isScrolling?"visible":"hidden"),this.settings.isScrolling?this.startScrolling():this.stopScrolling()),c&&(l?this.settings={...this.settings,lineColor:e.lineColor,lineThickness:e.lineThickness,lineOpacity:e.lineOpacity,scrollSpeed:e.scrollSpeed}:this.settings={...this.settings,...e},this.createFocusLine(),this.focusLine&&(this.focusLine.style.visibility=this.settings.isScrolling?"visible":"hidden"))}}catch(e){s("processing storage changes",e),n(o.STORAGE_LOAD_FAILED)}}):console.warn("AutoScroll Reader: chrome.storage.onChanged not available")}catch(t){s("setting up storage listener",t),n(o.STORAGE_LOAD_FAILED)}}createFocusLine(){try{this.focusLine&&this.focusLine.remove(),this.focusLine=document.createElement("div"),this.focusLine.id="autoscroll-focus-line",document.body?(document.body.appendChild(this.focusLine),this.applyFocusLineStyle()):(s("creating focus line","document.body not available"),n(o.DOM_MANIPULATION_FAILED))}catch(t){s("creating focus line",t),n(o.DOM_MANIPULATION_FAILED)}}createProgressBar(){var t;this.progressBar&&this.progressBar.remove(),this.progressBar=document.createElement("div"),this.progressBar.id="autoscroll-progress",Object.assign(this.progressBar.style,{position:"fixed",top:"0",left:"0",height:"3px",width:"0%",background:`linear-gradient(90deg, ${this.settings.lineColor}, ${this.settings.lineColor}aa)`,zIndex:"2147483646",pointerEvents:"none",transition:"width 0.1s linear",opacity:this.settings.isScrolling?"1":"0"}),(t=document.body)==null||t.appendChild(this.progressBar)}updateProgress(){if(!this.progressBar)return;const t=document.scrollingElement||document.documentElement,i=Math.max(1,t.scrollHeight-window.innerHeight),e=Math.min(100,t.scrollTop/i*100);this.progressBar.style.width=`${e}%`,this.progressBar.style.opacity=this.settings.isScrolling?"1":"0"}applyFocusLineStyle(){if(!this.focusLine)return;const t=this.settings.lineColor,i=this.settings.lineThickness,e=this.settings.lineOpacity/100,r=this.settings.focusLinePosition;Object.assign(this.focusLine.style,{position:"fixed",top:`${r}%`,left:"0",width:"100%",height:`${i}px`,backgroundColor:t,boxShadow:`0 0 5px ${t}, 0 0 10px ${t}, 0 0 15px ${t}`,opacity:e.toString(),zIndex:"2147483647",pointerEvents:"none",transition:"opacity 0.2s",visibility:this.settings.isScrolling?"visible":"hidden"})}updateSettings(t){const i={...this.settings};this.settings={...this.settings,...t},(i.lineColor!==this.settings.lineColor||i.lineThickness!==this.settings.lineThickness||i.lineOpacity!==this.settings.lineOpacity||i.focusLinePosition!==this.settings.focusLinePosition)&&this.applyFocusLineStyle()}startScrolling(){this.animationFrameId===null&&(this.settings.isScrolling=!0,this.focusLine&&(this.focusLine.style.visibility="visible"),this.progressBar&&(this.progressBar.style.opacity="1",this.updateProgress()),this.lastTimestamp=null,this.subpixelRemainder=0,this.animationFrameId=requestAnimationFrame(this.scrollStep))}stopScrolling(){this.settings.isScrolling=!1,this.focusLine&&(this.focusLine.style.visibility="hidden"),this.progressBar&&(this.progressBar.style.opacity="0"),this.animationFrameId!==null&&(cancelAnimationFrame(this.animationFrameId),this.animationFrameId=null),this.lastTimestamp=null,this.subpixelRemainder=0}toggleScrolling(){this.isToggling=!0;const t=!this.settings.isScrolling;if(t?this.startScrolling():this.stopScrolling(),this.settings.isScrolling=t,this.storageAvailable)try{chrome.storage.local.set({readerSettings:{...this.settings}}).then(()=>{try{setTimeout(()=>{this.isToggling=!1},this.TOGGLE_TIMEOUT)}catch(i){s("resetting toggle flag after storage save",i),this.isToggling=!1}}).catch(i=>{s("saving settings to storage",i),n(o.STORAGE_SAVE_FAILED),this.isToggling=!1})}catch(i){s("storage set operation",i),n(o.STORAGE_SAVE_FAILED),this.isToggling=!1}else setTimeout(()=>{this.isToggling=!1},this.TOGGLE_TIMEOUT)}}window.autoScrollReaderInjected||(window.autoScrollReaderInjected=!0,new u)})();
