const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR8TwZ8J4v_1iA19v6zx_jafsf0ylG7GC98PyiR-CFL8HYwctsZ3iC_GUHIrwt147q3HH1BfBIdvNCJ/pub?gid=1803752098&single=true&output=csv";
const PAGE_SIZE = 12;
let rawData = [], filteredData = [], page = 1, charts = {};
const $ = id => document.getElementById(id);
// Counts are Indonesian-formatted integers (e.g. 2.413 = 2,413).
// Ratio fields are decimal fractions (e.g. -0.0858 = -8.58%).
const number = v => {
  const s = String(v ?? "").trim().replace(/[^\d,.-]/g,"");
  if (!s) return 0;
  const normalized = s.replace(/\./g,"").replace(",", ".");
  return Number(normalized) || 0;
};
const ratio = v => {
  let s = String(v ?? "").trim().replace(/[%\s]/g,"");
  if (!s) return 0;
  // CSV formula values use decimal dot; support comma decimal as well.
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g,"").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  // If source is already expressed as percent points (e.g. -8.58%), convert to fraction.
  return String(v).includes("%") ? n/100 : n;
};
const fmt = v => Math.round(v).toLocaleString("id-ID");
const pct = v => `${(v*100).toFixed(1).replace(".",",")}%`;
const norm = s => String(s ?? "").toLowerCase().replace(/\s+/g," ").trim();
function showToast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800)}
function parseRows(rows){
  const idx=rows.findIndex(r=>r.some(c=>norm(c).includes("nama ahass")) || r.some(c=>norm(c)==="no ahass"));
  if(idx<0) throw new Error("Header kolom tidak ditemukan pada CSV.");
  const data=[];
  rows.slice(idx+1).forEach(r=>{
    if(!r || !r.some(c=>String(c??"").trim())) return;
    // Export spreadsheet uses a leading blank column; fixed positions follow workbook layout.
    const cells = r.length>=12 ? r : ["",...r];
    const item={
      no: cells[1], group:String(cells[2]??"").trim(), district:String(cells[3]??"").trim(),
      status:String(cells[4]??"").trim(), code:String(cells[5]??"").trim(),
      name:String(cells[6]??"").trim(), lastMonth:number(cells[7]),
      target:number(cells[8]), actual:number(cells[9]),
      growth:ratio(cells[10]), achievement:ratio(cells[11])
    };
    if(item.name && item.code && (item.target || item.actual || item.lastMonth)) data.push(item);
  });
  return data;
}
async function loadData(){
  $("refreshBtn").disabled=true; $("refreshBtn").textContent="↻ Loading...";
  try{
    const url=CSV_URL+(CSV_URL.includes("?")?"&":"?")+"_="+Date.now();
    const res=await fetch(url,{cache:"no-store"});
    if(!res.ok) throw new Error(`Google Sheets merespons ${res.status}`);
    const csv=await res.text();
    const parsed=Papa.parse(csv,{skipEmptyLines:false}).data;
    const data=parseRows(parsed);
    if(!data.length) throw new Error("Data AHASS tidak ditemukan. Periksa format CSV dan akses publik spreadsheet.");
    rawData=data; page=1; populateFilters(); applyFilters();
    $("lastUpdated").textContent="Updated "+new Date().toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"});
    showToast(`${data.length} data AHASS berhasil dimuat`);
  }catch(err){
    console.error(err); showToast("Gagal memuat data: "+err.message);
    $("rankingBody").innerHTML=`<tr><td colspan="9" class="empty">Data gagal dimuat. Pastikan Google Sheets dipublikasikan sebagai CSV dan dapat diakses publik.<br><br>${err.message}</td></tr>`;
    $("lastUpdated").textContent="Connection error";
  }finally{$("refreshBtn").disabled=false;$("refreshBtn").innerHTML="↻ <span>Refresh data</span>"}
}
function unique(key){return [...new Set(rawData.map(x=>x[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id"))}
function setOptions(id, values, label){const el=$(id), old=el.value;el.innerHTML=`<option value="all">${label}</option>`+values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");if(values.includes(old))el.value=old}
function populateFilters(){setOptions("groupFilter",unique("group"),"Semua Grup Dealer");setOptions("districtFilter",unique("district"),"Semua Kabupaten");setOptions("statusFilter",unique("status"),"Semua Status")}
function applyFilters(){
  const g=$("groupFilter").value,d=$("districtFilter").value,s=$("statusFilter").value,q=norm($("searchInput").value);
  filteredData=rawData.filter(x=>(g==="all"||x.group===g)&&(d==="all"||x.district===d)&&(s==="all"||x.status===s)&&(!q||norm([x.name,x.code,x.group,x.district].join(" ")).includes(q)));
  page=1;renderAll();
}
function sum(key,arr=filteredData){return arr.reduce((a,x)=>a+(Number(x[key])||0),0)}
function renderKpis(){
  const actual=sum("actual"),target=sum("target"),last=sum("lastMonth"),achievement=target?actual/target:0,growth=last?(actual/last)-1:0,gap=actual-target;
  $("kpiActual").textContent=fmt(actual);$("kpiTarget").textContent=fmt(target);$("kpiAchievement").textContent=pct(achievement);
  $("kpiGrowth").textContent=(growth>0?"+":"")+pct(growth);$("kpiGap").textContent=`Gap: ${gap>0?"+":""}${fmt(gap)}`;
  $("achievementBar").style.width=Math.min(achievement*100,100)+"%";
  $("kpiActualNote").textContent=`${filteredData.length} AHASS terpilih`;
  $("growthLabel").textContent=growth>=0?"Growth positif":"Di bawah M-1";
  const top=[...filteredData].sort((a,b)=>b.actual-a.actual)[0], below=filteredData.filter(x=>x.achievement<1).length;
  $("insightTitle").textContent=achievement>=1?"Target Unit Entry tercapai":`Achievement saat ini ${pct(achievement)}`;
  $("insightText").textContent=`Total actual ${fmt(actual)} dari target ${fmt(target)} (gap ${fmt(gap)}). ${below} dari ${filteredData.length} AHASS masih di bawah target. Kontributor actual terbesar: ${top?top.name:"—"} (${fmt(top?.actual||0)} UE).`;
}
function destroyChart(id){if(charts[id])charts[id].destroy()}
function renderCharts(){
  // Aggregate the network at Dealer Group level for every chart in this section.
  const grouped = {};
  filteredData.forEach(x => {
    const key = x.group || "Tidak diketahui";
    if(!grouped[key]) grouped[key] = {group:key, actual:0, target:0, lastMonth:0, ahassCount:0};
    grouped[key].actual += x.actual;
    grouped[key].target += x.target;
    grouped[key].lastMonth += x.lastMonth;
    grouped[key].ahassCount += 1;
  });
  const groupStats = Object.values(grouped).map(g => ({
    ...g,
    achievement: g.target ? g.actual/g.target : 0,
    growth: g.lastMonth ? g.actual/g.lastMonth-1 : 0
  }));
  const sorted=[...groupStats].sort((a,b)=>b.actual-a.actual);

  destroyChart("achievement");
  charts.achievement=new Chart($("achievementChart"),{
    type:"bar",
    data:{
      labels:sorted.map(x=>x.group),
      datasets:[
        {label:"Actual UE",data:sorted.map(x=>x.actual),backgroundColor:"#ff6b2c",borderRadius:4},
        {label:"Target UE",data:sorted.map(x=>x.target),backgroundColor:"#f5c7b3",borderRadius:4}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,indexAxis:"y",
      plugins:{legend:{position:"bottom",labels:{boxWidth:9,font:{size:10}}}},
      scales:{x:{beginAtZero:true,grid:{color:"#edf1f5"},ticks:{font:{size:9}}},y:{grid:{display:false},ticks:{font:{size:10}}}}
    }
  });

  const groupEntries=[...groupStats].sort((a,b)=>b.actual-a.actual);
  destroyChart("group");
  charts.group=new Chart($("groupChart"),{
    type:"doughnut",
    data:{
      labels:groupEntries.map(x=>x.group),
      datasets:[{data:groupEntries.map(x=>x.actual),backgroundColor:["#ff6b2c","#ff8b58","#ffad87","#ffd0bb","#ffc08a","#d8d8d8","#f29a73","#bdbdbd","#e8a28b","#f4c4ad","#c7c7c7","#ed8057"],borderWidth:2,borderColor:"#fff"}]
    },
    options:{responsive:true,maintainAspectRatio:false,cutout:"65%",plugins:{legend:{position:"bottom",labels:{boxWidth:9,padding:12,font:{size:9}}}}}
  });

  // Distribution is based on each Dealer Group's aggregate achievement, not individual AHASS.
  const buckets=[{label:"≥100%",min:1,max:Infinity},{label:"80–99%",min:.8,max:1},{label:"60–79%",min:.6,max:.8},{label:"<60%",min:-Infinity,max:.6}];
  destroyChart("distribution");
  charts.distribution=new Chart($("distributionChart"),{
    type:"bar",
    data:{
      labels:buckets.map(b=>b.label),
      datasets:[{label:"Jumlah Grup Dealer",data:buckets.map(b=>groupStats.filter(x=>x.achievement>=b.min&&x.achievement<b.max).length),backgroundColor:["#ff6b2c","#ff9a70","#ffc08a","#d7a091"],borderRadius:5}]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0,font:{size:9}},grid:{color:"#edf1f5"}},x:{grid:{display:false},ticks:{font:{size:10}}}}}
  });

  const growers=[...groupStats].sort((a,b)=>b.growth-a.growth);
  destroyChart("growth");
  charts.growth=new Chart($("growthChart"),{
    type:"bar",
    data:{
      labels:growers.map(x=>x.group),
      datasets:[{label:"Growth vs M-1",data:growers.map(x=>x.growth*100),backgroundColor:growers.map(x=>x.growth>=0?"#ff7a45":"#d7a091"),borderRadius:4}]
    },
    options:{
      responsive:true,maintainAspectRatio:false,indexAxis:"y",
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.raw.toFixed(1)}%`}}},
      scales:{x:{ticks:{callback:v=>v+"%",font:{size:9}},grid:{color:"#edf1f5"}},y:{grid:{display:false},ticks:{font:{size:10}}}}
    }
  });
}

function shortName(s){return s.length>23?s.slice(0,21)+"…":s}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderTable(){
  const sorted=[...filteredData].sort((a,b)=>b.actual-a.actual),total=sorted.length,pages=Math.max(1,Math.ceil(total/PAGE_SIZE));page=Math.min(page,pages);
  const start=(page-1)*PAGE_SIZE,items=sorted.slice(start,start+PAGE_SIZE);
  $("rankingBody").innerHTML=items.length?items.map((x,i)=>{const a=x.achievement,cls=a>=1?"good":a>=.8?"mid":"low";return `<tr><td>${start+i+1}</td><td><strong>${escapeHtml(x.name)}</strong><br><span style="color:#91a0af;font-size:9px">${escapeHtml(x.code)}</span></td><td>${escapeHtml(x.group)}</td><td>${escapeHtml(x.district)}</td><td class="num">${fmt(x.lastMonth)}</td><td class="num">${fmt(x.target)}</td><td class="num"><strong>${fmt(x.actual)}</strong></td><td class="num ${x.growth>=0?"growth-positive":"growth-negative"}">${x.growth>0?"+":""}${pct(x.growth)}</td><td class="num"><span class="achievement-pill ${cls}">${pct(a)}</span></td></tr>`}).join(""):`<tr><td colspan="9" class="empty">Tidak ada data yang sesuai filter.</td></tr>`;
  $("rowCount").textContent=`${total} AHASS`; $("tableInfo").textContent=`Menampilkan ${total?start+1:0}–${Math.min(start+PAGE_SIZE,total)} dari ${total} AHASS`;
  $("pageInfo").textContent=`${page} / ${pages}`;$("prevPage").disabled=page<=1;$("nextPage").disabled=page>=pages;
}
function renderAll(){renderKpis();renderCharts();renderTable()}
["groupFilter","districtFilter","statusFilter"].forEach(id=>$(id).addEventListener("change",applyFilters));
$("searchInput").addEventListener("input",applyFilters);
$("resetBtn").addEventListener("click",()=>{$("groupFilter").value="all";$("districtFilter").value="all";$("statusFilter").value="all";$("searchInput").value="";applyFilters()});
$("refreshBtn").addEventListener("click",loadData);
$("prevPage").addEventListener("click",()=>{page--;renderTable()});$("nextPage").addEventListener("click",()=>{page++;renderTable()});
loadData();
setInterval(loadData,5*60*1000);


// Keep the sidebar selection synchronized with the section currently in view.
(function setupActiveNavigation(){
  const links = [...document.querySelectorAll(".nav-item")];
  const sections = links.map(link => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  function setActive(id){
    links.forEach(link => {
      const active = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("active", active);
      if(active) link.setAttribute("aria-current","page");
      else link.removeAttribute("aria-current");
    });
  }
  links.forEach(link => link.addEventListener("click", () => setActive(link.hash.slice(1))));
  window.addEventListener("hashchange", () => setActive(location.hash.slice(1) || "overview"));
  if("IntersectionObserver" in window){
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(visible) setActive(visible.target.id);
    }, {rootMargin:"-18% 0px -62% 0px",threshold:[0,.15,.35,.6]});
    sections.forEach(section => observer.observe(section));
  }
  setActive(location.hash.slice(1) || "overview");
})();
