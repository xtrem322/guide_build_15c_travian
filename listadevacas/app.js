const $ = id => document.getElementById(id)

const TROOP_SPEED = {
  "Legionario":6,"Pretoriano":5,"Imperano":7,
  "Equites Legati":16,"Equites Imperatoris":14,"Equites Caesaris":10,
  "Luchador de porra":7,"Lancero":7,"Luchador de Hacha":7,
  "Emisario":16,"Paladín":10,"Jinete Teutón":9,
  "Falange":7,"Espadachín":6,"Batidor":17,
  "Rayo de Theutates":19,"Jinete Druida":16,"Jinete Eduo":13,
  "Infante esclavo":5,"Guardia Ash":6,"Guerreros de Khopes":7,
  "Explorador Sopdu":15,"Guarda Osiris":10,"Carro de Reshef":10,
  "Mercenario":7,"Arquero":7,"Observador":16,
  "Jinete estepario":16,"Jinete certero":15,"Merodeador":14,
}

const TROOPS_BY_RACE = {
  ROMANO:  ["Legionario","Pretoriano","Imperano","Equites Legati","Equites Imperatoris","Equites Caesaris"],
  GERMANO: ["Luchador de porra","Lancero","Luchador de Hacha","Emisario","Paladín","Jinete Teutón"],
  GALOS:   ["Falange","Espadachín","Batidor","Rayo de Theutates","Jinete Druida","Jinete Eduo"],
  EGIPTO:  ["Infante esclavo","Guardia Ash","Guerreros de Khopes","Explorador Sopdu","Guarda Osiris","Carro de Reshef"],
  HUNOS:   ["Mercenario","Arquero","Observador","Jinete estepario","Jinete certero","Merodeador"],
}

let vacaList = []
let vacaCounter = 0

/* ── Helpers ── */
function n0(v){ const x=Number(v); return Number.isFinite(x)?x:0 }

function fmtTime(totalMin){
  if(!isFinite(totalMin)||totalMin<=0) return "—"
  const totalSec=Math.round(totalMin*60)
  const hh=Math.floor(totalSec/3600)
  const mm=Math.floor((totalSec%3600)/60)
  const ss=totalSec%60
  if(hh>0) return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}`
  return `${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}`
}

function travelMin(dist, troopName, srv){
  const spd=(TROOP_SPEED[troopName]||0)*srv
  return spd>0?(dist/spd)*60:Infinity
}

function currentRace()    { return $("raceSelect").value||"HUNOS" }
function currentTroop()   { return $("troopSelect").value||"" }
function currentSpeed()   { return Math.max(1,n0($("serverSpeed").value)) }
function currentInterval(){ return Math.max(1,n0($("intervalMin").value)) }
function troopsForRace(r) { return TROOPS_BY_RACE[r]||[] }

/* ══════════════════════════════════════════════════════════════════
   PARSER — “Nombre  puntos  distancia” + (siguiente línea numérica) = tropas
   - Detecta una línea “cabecera” si:
     - tiene texto (nombre) y termina en número (distancia),
     - contiene al menos 2 números (puntos + distancia) o tabulación típica.
   - Luego, la primera línea “entera” posterior (sin ":" y sin letras) se toma como tropas.
   ══════════════════════════════════════════════════════════════════ */
function parseVacasText(raw){
  const lines = raw
    .split("\n")
    .map(l => l.replace(/\u202d|\u202c|\u202a|\u202b|\u202e/g,'').trim()) // limpia marks RTL
    .filter(l => l.length>0)

  const out = []
  let pending = null

  function isTimeLike(s){ return /^\d{1,2}:\d{2}(:\d{2})?$/.test(s) }
  function isPureInt(s){ return /^\d+$/.test(s) }
  function hasLetters(s){ return /[A-Za-zÁÉÍÓÚáéíóúÑñ\u0600-\u06FF]/.test(s) }

  for(const line of lines){
    const clean = line.replace(/\s+/g,' ').trim()

    // Si estamos esperando "tropas", tomar la primera línea int válida
    if(pending){
      if(isPureInt(clean) && !isTimeLike(clean)){
        const troops = parseInt(clean,10)
        if(troops > 0){
          out.push({
            name: pending.name,
            dist: pending.dist,
            troops,
          })
        }
        pending = null
      }
      continue
    }

    // Candidate header: tratar de extraer "nombre + ... + distancia"
    // Split por tabs primero; si no hay, split por espacios.
    const partsByTab = line.split("\t").map(x=>x.trim()).filter(Boolean)
    const parts = partsByTab.length>=2 ? partsByTab : clean.split(" ").filter(Boolean)

    // Buscamos distancia como último token numérico (float)
    const last = parts[parts.length-1]
    const dist = parseFloat(String(last).replace(",","."))
    if(!Number.isFinite(dist) || dist<=0) continue

    // Evitar capturar líneas de “basura” (tiempos, loot suelto, etc.)
    if(isTimeLike(clean)) continue

    // Nombre = todo antes de los números, o el primer campo tab
    let name = ""
    if(partsByTab.length>=2){
      name = partsByTab[0]
    } else {
      // quitar los dos últimos tokens si son números (puntos + distancia)
      // y quedarnos con el resto como nombre
      const numsAtEnd = []
      for(let i=parts.length-1;i>=0;i--){
        const v = parts[i]
        const nv = parseFloat(String(v).replace(",","."))
        if(Number.isFinite(nv)) numsAtEnd.push(i)
        else break
      }
      const cut = numsAtEnd.length ? numsAtEnd[numsAtEnd.length-1] : parts.length-1
      name = parts.slice(0, cut).join(" ").trim()
    }

    if(!name) continue
    if(!hasLetters(name) && name.length<2) continue

    pending = { name, dist }
  }

  return out
}

/* ══════════════════════════════════════════════════════════════════
   SIMULACIÓN — pool mínimo para 1 tipo de tropa
   - Cada “vaca” necesita `troops` unidades por ataque
   - Atacas todas las vacas cada `interval` min
   - Regresan al pool en t + (2 * tIda)
   - Buscamos pool mínimo con búsqueda binaria + simulación discreta
   ══════════════════════════════════════════════════════════════════ */
function simulatePoolForTroop(troopName){
  const srv      = currentSpeed()
  const interval = currentInterval()

  const jobs = []
  for(const v of vacaList){
    if(!v || v.troops<=0) continue
    const tIda = travelMin(v.dist, troopName, srv)
    if(!isFinite(tIda) || tIda<=0) continue
    jobs.push({ cant: v.troops, tIV: tIda*2 })
  }

  if(!jobs.length) return { needed: 0, cyclesStable: 0 }

  let lo = 1
  let hi = jobs.reduce((s,j)=> s + Math.ceil(j.tIV/interval)*j.cant, 0)

  let bestPool = hi
  let bestCycles = 1

  while(lo<=hi){
    const mid = Math.floor((lo+hi)/2)
    const {ok, cycles} = runSimulation(jobs, mid, interval)
    if(ok){
      bestPool = mid
      bestCycles = cycles
      hi = mid-1
    } else {
      lo = mid+1
    }
  }

  return { needed: bestPool, cyclesStable: bestCycles }
}

function runSimulation(jobs, poolSize, interval){
  const MAX_CYCLES = 500
  const EPS = 1e-6

  let returns = []   // {returnAt, cant}
  let available = poolSize

  function releaseUpTo(t){
    let gained = 0
    const keep = []
    for(const r of returns){
      if(r.returnAt <= t + EPS) gained += r.cant
      else keep.push(r)
    }
    returns = keep
    available += gained
  }

  function stateKey(t){
    const buckets = new Map() // step -> totalCant
    for(const r of returns){
      const dt = r.returnAt - t
      const step = Math.max(0, Math.ceil((dt - EPS) / interval))
      buckets.set(step, (buckets.get(step) || 0) + r.cant)
    }
    const sorted = [...buckets.entries()].sort((a,b)=>a[0]-b[0])
    return `${available}|` + sorted.map(([k,v])=>`${k}:${v}`).join(",")
  }

  let prevPreKey = null

  for(let cycle=1; cycle<=MAX_CYCLES; cycle++){
    const t = cycle * interval

    // 1) retornos
    releaseUpTo(t)

    // 2) detectar régimen
    const preKey = stateKey(t)
    if(prevPreKey !== null && preKey === prevPreKey){
      return { ok:true, cycles: cycle }
    }
    prevPreKey = preKey

    // 3) envíos de este tick: ataca TODAS las vacas
    for(const job of jobs){
      if(available < job.cant) return { ok:false, cycles: cycle }
      available -= job.cant
      returns.push({ returnAt: t + job.tIV, cant: job.cant })
    }
  }

  return { ok:true, cycles: MAX_CYCLES }
}

/* ── Calc por fila ── */
function calcRow(v){
  const troop = currentTroop()
  const srv=currentSpeed(), interval=currentInterval()
  if(!troop) return { tIda:Infinity, tIV:Infinity, grps:0 }

  const tIda = travelMin(v.dist, troop, srv)
  const tIV  = tIda*2
  const grps = (!isFinite(tIV) || tIV<=0) ? 0 : Math.max(1, Math.ceil(tIV/interval))
  return { tIda, tIV, grps }
}

/* ══ UI ══ */
function fillRaceSelect(){
  const sel=$("raceSelect")
  sel.innerHTML=""
  for(const r of Object.keys(TROOPS_BY_RACE)){
    const o=document.createElement("option")
    o.value=r; o.textContent=r
    sel.appendChild(o)
  }
  sel.value="HUNOS"
}

function fillTroopSelect(){
  const sel=$("troopSelect")
  sel.innerHTML=""
  const troops = troopsForRace(currentRace())
  for(const t of troops){
    const o=document.createElement("option")
    o.value=t; o.textContent=t
    sel.appendChild(o)
  }
  sel.value = troops[0] || ""
}

/* ══ PROCESAR ══ */
function processGroup(){
  const raw=$("taImport").value
  const parsed=parseVacasText(raw)

  if(parsed.length===0){
    alert("No se detectaron filas válidas. Asegúrate de pegar la lista completa (nombre + distancia y la línea del '1' debajo).")
    return
  }

  if(!currentTroop()){
    alert("Selecciona una tropa.")
    return
  }

  parsed.forEach(p=>{
    vacaCounter++
    vacaList.push({
      id: vacaCounter,
      index: vacaCounter,
      name: p.name,
      dist: p.dist,
      troops: p.troops, // tropas por atraco (del texto)
    })
    $("emptyState").style.display="none"
    $("oasisTableWrap").style.display="block"
    $("oasisTableBody").appendChild(renderRow(vacaList[vacaList.length-1]))
  })

  recalcAll()
  $("taImport").value=""
}

function renderRow(v){
  const {tIda,tIV,grps} = calcRow(v)

  const row=document.createElement("div")
  row.className="oasis-row vaca"
  row.id=`vrow-${v.id}`

  // #
  const numD=document.createElement("div"); numD.className="oc"
  numD.innerHTML=`<span class="oc-num">#${v.index}</span>`
  row.appendChild(numD)

  // Nombre
  const nameD=document.createElement("div"); nameD.className="oc left"
  nameD.innerHTML=`<span class="oc-name" title="${escapeHtml(v.name)}">${escapeHtml(v.name)}</span>`
  row.appendChild(nameD)

  // Dist
  const distD=document.createElement("div"); distD.className="oc"
  distD.innerHTML=`<span class="oc-dist" id="dist-${v.id}">${v.dist}</span>`
  row.appendChild(distD)

  // Tropas (del texto)
  const qtyD=document.createElement("div"); qtyD.className="oc"
  qtyD.innerHTML=`<span class="oc-qty" id="qty-${v.id}">${v.troops}</span>`
  row.appendChild(qtyD)

  // Tropa (global)
  const troopD=document.createElement("div"); troopD.className="oc left"
  troopD.innerHTML=`<span class="oc-name" id="troop-${v.id}">${escapeHtml(currentTroop())}</span>`
  row.appendChild(troopD)

  // Ida
  const idaD=document.createElement("div"); idaD.className="oc"
  idaD.innerHTML=`<span class="oc-time" id="ida-${v.id}">${fmtTime(tIda)}</span>`
  row.appendChild(idaD)

  // I+V
  const ivD=document.createElement("div"); ivD.className="oc"
  ivD.innerHTML=`<span class="oc-time" id="iv-${v.id}">${fmtTime(tIV)}</span>`
  row.appendChild(ivD)

  // Grupos
  const grpD=document.createElement("div"); grpD.className="oc"
  grpD.innerHTML=`<span class="oc-needed${grps===0?" zero":""}" id="grp-${v.id}">${grps===0?"—":grps}</span>`
  row.appendChild(grpD)

  // Delete
  const delD=document.createElement("div"); delD.className="oc"
  const delBtn=document.createElement("button"); delBtn.className="btn-del"; delBtn.type="button"; delBtn.textContent="🗑"
  delBtn.addEventListener("click",()=>{
    vacaList = vacaList.filter(x=>x.id!==v.id)
    row.remove()
    checkEmpty()
    recalcAll()
  })
  delD.appendChild(delBtn)
  row.appendChild(delD)

  return row
}

function recalcRow(v){
  const {tIda,tIV,grps} = calcRow(v)

  const troopEl = $(`troop-${v.id}`)
  if(troopEl) troopEl.textContent = currentTroop()

  const idaEl = $(`ida-${v.id}`)
  if(idaEl) idaEl.textContent = fmtTime(tIda)

  const ivEl = $(`iv-${v.id}`)
  if(ivEl) ivEl.textContent = fmtTime(tIV)

  const grpEl = $(`grp-${v.id}`)
  if(grpEl){
    grpEl.textContent = grps===0 ? "—" : String(grps)
    grpEl.className = "oc-needed" + (grps===0 ? " zero" : "")
  }
}

function recalcAll(){
  vacaList.forEach(recalcRow)
  recalcGlobal()
}

function recalcGlobal(){
  const grEl=$("globalResult"), list=$("globalTroopList")
  list.innerHTML=""

  if(!vacaList.length){
    grEl.style.display="none"
    return
  }

  const troop = currentTroop()
  if(!troop){
    grEl.style.display="none"
    return
  }

  const {needed, cyclesStable} = simulatePoolForTroop(troop)
  if(!needed || needed<=0){
    grEl.style.display="none"
    return
  }

  grEl.style.display="block"

  const chip=document.createElement("div")
  chip.className="gr-troop-chip"
  chip.innerHTML=`<span class="gr-troop-name">${escapeHtml(troop)}</span><span class="gr-troop-qty">${needed}</span>`
  list.appendChild(chip)

  const cycleInfo=document.createElement("div")
  cycleInfo.className="gr-cycles"
  cycleInfo.innerHTML=`<span class="gr-cycle-label">Estado estable en ciclo</span><span class="gr-cycle-num">${cyclesStable}</span><span class="gr-cycle-label">· cada ${currentInterval()} min</span>`
  list.appendChild(cycleInfo)
}

function checkEmpty(){
  const empty = vacaList.length===0
  $("emptyState").style.display = empty ? "block" : "none"
  $("oasisTableWrap").style.display = empty ? "none" : "block"
  if(empty) $("globalResult").style.display="none"
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;")
}

/* ══ INIT ══ */
function init(){
  fillRaceSelect()
  fillTroopSelect()

  $("raceSelect").addEventListener("change",()=>{
    fillTroopSelect()
    recalcAll()
  })

  $("troopSelect").addEventListener("change", recalcAll)
  $("serverSpeed").addEventListener("change", recalcAll)
  $("intervalMin").addEventListener("input",  recalcAll)

  $("btnProcess").addEventListener("click", processGroup)

  $("btnClearAll").addEventListener("click",()=>{
    vacaList=[]
    vacaCounter=0
    $("oasisTableBody").innerHTML=""
    checkEmpty()
  })
}

/* ══ THEME SYNC (fallback si nav.js no lo maneja) ══ */
function initTheme(){
  const saved = localStorage.getItem("theme")
  if(saved === "dark") document.body.classList.add("dark")

  function syncThemeButtons(){
    const btns = document.querySelectorAll(".theme-toggle")
    if(!btns.length) return false
    btns.forEach(btn => {
      const isDark = document.body.classList.contains("dark")
      btn.textContent = isDark ? "☀️ Modo Claro" : "🌙 Modo Oscuro"
    })
    return true
  }

  if(!syncThemeButtons()){
    const obs = new MutationObserver(() => {
      if(syncThemeButtons()) obs.disconnect()
    })
    obs.observe(document.body, { childList: true, subtree: true })
  }
}

initTheme()
init()
