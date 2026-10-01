(() => {
  const DATA = window.TRAVEL_DATA;
  const $ = (id) => document.getElementById(id);
  const state = { lastResult:null, installPrompt:null };

  const sar = (n) => `${Math.round(Number(n)||0).toLocaleString('ar-SA')} ر.س`;
  const parseDate = (s) => { const [y,m,d]=s.split('-').map(Number); return Date.UTC(y,m-1,d); };
  const daysBetween = (a,b) => Math.round((parseDate(b)-parseDate(a))/86400000);
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

  function seedDates(){
    const now = new Date();
    const start = new Date(now); start.setDate(start.getDate()+30);
    const end = new Date(start); end.setDate(end.getDate()+7);
    $('startDate').value = toYMD(start); $('endDate').value = toYMD(end);
  }
  function toYMD(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

  function fillCountries(){
    $('country').innerHTML = Object.entries(DATA).map(([k,v])=>`<option value="${k}">${v.name}</option>`).join('');
    $('country').value='thailand';
  }

  function renderCityChooser(){
    const c = DATA[$('country').value];
    $('cityChooser').innerHTML = c.cities.map((city,i)=>`
      <label class="city-pick">
        <input class="city-check" data-city="${city.id}" type="checkbox" ${i<2?'checked':''} />
        <span><strong>${city.name}</strong><small>المدة المقترحة ${city.recommendedDays} أيام</small></span>
        <input class="city-days" data-city="${city.id}" type="number" min="1" max="14" value="${city.recommendedDays}" aria-label="عدد الأيام في ${city.name}" />
      </label>`).join('');
    autoAllocateDays();
  }

  function getSelectedCities(){
    const country = DATA[$('country').value];
    return [...document.querySelectorAll('.city-check:checked')].map(ch=>{
      const city = country.cities.find(x=>x.id===ch.dataset.city);
      const daysInput = document.querySelector(`.city-days[data-city="${ch.dataset.city}"]`);
      return {...city,days:clamp(Number(daysInput?.value)||1,1,14)};
    });
  }

  function autoAllocateDays(){
    const nights = Math.max(1,daysBetween($('startDate').value,$('endDate').value));
    const checks=[...document.querySelectorAll('.city-check:checked')];
    if(!checks.length) return;
    const country=DATA[$('country').value];
    const recTotal=checks.reduce((s,ch)=>s+(country.cities.find(c=>c.id===ch.dataset.city)?.recommendedDays||1),0);
    let assigned=0;
    checks.forEach((ch,idx)=>{
      const city=country.cities.find(c=>c.id===ch.dataset.city);
      let d = idx===checks.length-1 ? nights-assigned : Math.max(1,Math.round(nights*(city.recommendedDays/recTotal)));
      d=Math.max(1,d); assigned+=d;
      const input=document.querySelector(`.city-days[data-city="${ch.dataset.city}"]`); if(input) input.value=d;
    });
  }

  function originFactor(origin){
    const s=origin.trim();
    if(/تبوك|tabuk/i.test(s)) return 1;
    if(/رياض|riyadh/i.test(s)) return .92;
    if(/جدة|jeddah/i.test(s)) return .95;
    if(/دمام|dammam/i.test(s)) return .96;
    return 1.06;
  }

  async function getWeather(city,start,end){
    const today = new Date(); today.setHours(0,0,0,0);
    const startD = new Date(start+'T00:00:00');
    const diff = Math.round((startD-today)/86400000);
    try{
      if(diff>=0 && diff<=15){
        const url=`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&start_date=${start}&end_date=${end}`;
        const r=await fetch(url); if(!r.ok) throw new Error('forecast'); const j=await r.json();
        const max=avg(j.daily?.temperature_2m_max), min=avg(j.daily?.temperature_2m_min), rain=avg(j.daily?.precipitation_sum);
        return {label:`${Math.round(min)}–${Math.round(max)}°`,note:`توقع مباشر • مطر ${rain.toFixed(1)} مم/يوم`,mode:'live'};
      }
      const sy = Number(start.slice(0,4));
      const years=[sy-1,sy-2,sy-3].filter(y=>y>=1940 && y<=new Date().getFullYear()-1);
      const samples=[];
      for(const y of years){
        const hs=`${y}${start.slice(4)}`, he=`${y}${end.slice(4)}`;
        const url=`https://archive-api.open-meteo.com/v1/archive?latitude=${city.lat}&longitude=${city.lon}&start_date=${hs}&end_date=${he}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
        const r=await fetch(url); if(r.ok){ const j=await r.json(); if(j.daily) samples.push(j.daily); }
      }
      if(samples.length){
        const max=avg(samples.flatMap(s=>s.temperature_2m_max||[])), min=avg(samples.flatMap(s=>s.temperature_2m_min||[])), rain=avg(samples.flatMap(s=>s.precipitation_sum||[]));
        return {label:`${Math.round(min)}–${Math.round(max)}°`,note:`متوسط تاريخي • مطر ${rain.toFixed(1)} مم/يوم`,mode:'history'};
      }
    }catch(e){ }
    return {label:'—',note:'تعذر جلب الطقس الآن',mode:'offline'};
  }
  function avg(a){ const v=(a||[]).filter(Number.isFinite); return v.length?v.reduce((s,n)=>s+n,0)/v.length:0; }

  async function calculate(ev){
    ev?.preventDefault();
    const start=$('startDate').value,end=$('endDate').value;
    const nights=daysBetween(start,end);
    if(!start||!end||nights<1){ $('formMsg').textContent='تأكد أن تاريخ العودة بعد تاريخ السفر.'; return; }
    const cities=getSelectedCities();
    if(!cities.length){ $('formMsg').textContent='اختر مدينة واحدة على الأقل.'; return; }
    const travelers=clamp(Number($('travelers').value)||1,1,12);
    const rooms=clamp(Number($('rooms').value)||1,1,6);
    const stars=$('stars').value;
    const spend=Number($('spendStyle').value)||1;
    const country=DATA[$('country').value];
    const month=Number(start.slice(5,7))-1;
    const season=country.season[month]||1;
    const cityDaysTotal=cities.reduce((s,c)=>s+c.days,0)||1;
    const flightPerPerson=country.flightBase*originFactor($('origin').value)*season;
    const flight=flightPerPerson*travelers;
    let hotel=0,food=0,local=0;
    const rows=[];
    for(const c of cities){
      const shareNights=nights*(c.days/cityDaysTotal);
      const h=c.hotel[stars]*season*shareNights*rooms;
      const f=(c.meals[0]+c.meals[1]+c.meals[2])*spend*c.days*travelers;
      const l=(c.transport+c.activities)*spend*c.days*travelers;
      hotel+=h; food+=f; local+=l;
      rows.push({city:c,shareNights,h,f,l});
    }
    const total=flight+hotel+food+local;
    state.lastResult={country,cities,travelers,rooms,stars,spend,start,end,nights,flight,hotel,food,local,total,rows,origin:$('origin').value};
    renderResult(state.lastResult);
    $('formMsg').textContent='تم الحساب. الطقس يُجلب من Open‑Meteo، بينما أسعار الطيران والفنادق والأنشطة في هذه النسخة تقديرية.';
    await renderWeather(state.lastResult);
  }

  function renderResult(r){
    $('grandTotal').textContent=sar(r.total); $('perPerson').textContent=sar(r.total/r.travelers);
    $('flightCost').textContent=sar(r.flight); $('hotelCost').textContent=sar(r.hotel); $('foodCost').textContent=sar(r.food); $('localCost').textContent=sar(r.local);
    $('tripSummary').textContent=`${r.country.name} • ${r.nights} ليلة • ${r.travelers} مسافر • ${r.rooms} غرفة • فندق ${r.stars} نجوم`;
    $('cityResults').innerHTML=r.rows.map(({city,h,f,l})=>`
      <article class="city-card" data-city-card="${city.id}">
        <div class="city-head"><div><h3>${city.name}</h3><p class="muted">${city.days} أيام ضمن الخطة</p></div><div class="weather-chip" data-weather="${city.id}"><strong>جاري جلب الطقس…</strong><small>Open‑Meteo</small></div></div>
        <div class="city-metrics">
          <div class="metric"><span>الفندق لهذه المدينة</span><strong>${sar(h)}</strong></div>
          <div class="metric"><span>فطور/شخص</span><strong>${sar(city.meals[0]*r.spend)}</strong></div>
          <div class="metric"><span>غداء/شخص</span><strong>${sar(city.meals[1]*r.spend)}</strong></div>
          <div class="metric"><span>عشاء/شخص</span><strong>${sar(city.meals[2]*r.spend)}</strong></div>
        </div>
        <ul class="events">${city.events.map(e=>`<li>${e}</li>`).join('')}</ul>
      </article>`).join('');
    $('breakdownTable').innerHTML=`<table class="cost-table"><thead><tr><th>البند</th><th>التكلفة</th><th>ملاحظة</th></tr></thead><tbody>
      <tr><td>الطيران</td><td>${sar(r.flight)}</td><td>${sar(r.flight/r.travelers)} لكل مسافر تقريبًا</td></tr>
      <tr><td>الفنادق</td><td>${sar(r.hotel)}</td><td>${r.rooms} غرفة / ${r.nights} ليلة</td></tr>
      <tr><td>الوجبات</td><td>${sar(r.food)}</td><td>3 وجبات يوميًا حسب نمط الصرف</td></tr>
      <tr><td>أنشطة وتنقل</td><td>${sar(r.local)}</td><td>متوسط يومي تقديري</td></tr>
      <tr><td><strong>الإجمالي</strong></td><td><strong>${sar(r.total)}</strong></td><td>${sar(r.total/r.travelers)} لكل مسافر</td></tr>
    </tbody></table>`;
  }

  async function renderWeather(r){
    for(const c of r.cities){
      const el=document.querySelector(`[data-weather="${c.id}"]`); if(!el) continue;
      const w=await getWeather(c,r.start,r.end);
      el.innerHTML=`<strong>${w.label}</strong><small>${w.note}</small>`;
    }
  }

  function saveTrip(){
    if(!state.lastResult){ $('formMsg').textContent='احسب الرحلة أولًا قبل الحفظ.'; return; }
    const saved=JSON.parse(localStorage.getItem('smartTripPlanner.saved')||'[]');
    saved.unshift({id:Date.now(),country:$('country').value,origin:$('origin').value,start:$('startDate').value,end:$('endDate').value,travelers:$('travelers').value,rooms:$('rooms').value,stars:$('stars').value,spendStyle:$('spendStyle').value,total:state.lastResult.total,cities:state.lastResult.cities.map(c=>({id:c.id,days:c.days}))});
    localStorage.setItem('smartTripPlanner.saved',JSON.stringify(saved.slice(0,12))); renderSaved(); $('formMsg').textContent='تم حفظ الرحلة على هذا الجهاز.';
  }

  function renderSaved(){
    const saved=JSON.parse(localStorage.getItem('smartTripPlanner.saved')||'[]');
    $('savedTrips').innerHTML=saved.length?saved.map(s=>`<div class="saved-item"><div><strong>${DATA[s.country]?.name||s.country}</strong><small>${s.start} ← ${s.end} • ${sar(s.total)}</small></div><button type="button" data-load="${s.id}">فتح</button></div>`).join(''):'<div class="empty">لا توجد رحلات محفوظة.</div>';
  }

  function loadSaved(id){
    const saved=JSON.parse(localStorage.getItem('smartTripPlanner.saved')||'[]'); const s=saved.find(x=>x.id===id); if(!s) return;
    $('country').value=s.country; $('origin').value=s.origin; $('startDate').value=s.start; $('endDate').value=s.end; $('travelers').value=s.travelers; $('rooms').value=s.rooms; $('stars').value=s.stars; $('spendStyle').value=s.spendStyle;
    renderCityChooser();
    document.querySelectorAll('.city-check').forEach(ch=>{ const found=s.cities.find(c=>c.id===ch.dataset.city); ch.checked=!!found; if(found){ const inp=document.querySelector(`.city-days[data-city="${ch.dataset.city}"]`); if(inp) inp.value=found.days; } });
    calculate(); window.scrollTo({top:0,behavior:'smooth'});
  }

  function setupPWA(){
    if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;$('installBtn').hidden=false;});
    $('installBtn').addEventListener('click',async()=>{ if(!state.installPrompt)return; state.installPrompt.prompt(); await state.installPrompt.userChoice; state.installPrompt=null; $('installBtn').hidden=true; });
  }

  fillCountries(); seedDates(); renderCityChooser(); renderSaved(); setupPWA();
  $('tripForm').addEventListener('submit',calculate);
  $('country').addEventListener('change',renderCityChooser);
  $('startDate').addEventListener('change',autoAllocateDays); $('endDate').addEventListener('change',autoAllocateDays);
  $('autoDaysBtn').addEventListener('click',autoAllocateDays); $('saveBtn').addEventListener('click',saveTrip); $('printBtn').addEventListener('click',()=>window.print());
  $('clearSavedBtn').addEventListener('click',()=>{localStorage.removeItem('smartTripPlanner.saved');renderSaved();});
  $('savedTrips').addEventListener('click',e=>{const b=e.target.closest('[data-load]');if(b)loadSaved(Number(b.dataset.load));});
})();
