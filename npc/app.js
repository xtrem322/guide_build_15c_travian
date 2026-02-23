const $ = (id) => document.getElementById(id)

const ORDER_MAP = {
  MBHC: ["wood","clay","iron","crop"],
  CBHM: ["crop","clay","iron","wood"],
  MCHB: ["wood","crop","iron","clay"]
}

const BUILDING_TIME_FACTOR = [
  0,
  1.0, 0.9, 0.81, 0.729, 0.656, 0.59, 0.531, 0.478, 0.43, 0.387,
  0.349, 0.314, 0.282, 0.254, 0.229, 0.206, 0.185, 0.167, 0.15, 0.135
]

let CATALOG_BUILD = null
let CATALOG_TROOPS = null

let rowsState = []

function n0(v){
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function fmtInt(n){
  const x = Math.max(0, Math.floor(n0(n)))
  return String(x)
}

function fmtTime(sec){
  const s = Math.max(0, Math.floor(n0(sec)))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return String(hh).padStart(2,"0") + ":" + String(mm).padStart(2,"0") + ":" + String(ss).padStart(2,"0")
}

function parseTimeToSec(s){
  const t = String(s || "").trim()
  const m = t.match(/^(\d+):(\d{2}):(\d{2})$/)
  if(!m) return 0
  const hh = n0(m[1])
  const mm = n0(m[2])
  const ss = n0(m[3])
  return hh*3600 + mm*60 + ss
}

function setThemeFromStorage(){
  const saved = localStorage.getItem("theme")
  if(saved === "dark") document.body.classList.add("dark")
  else document.body.classList.remove("dark")
  const btn = $("themeToggle")
  btn.textContent = document.body.classList.contains("dark") ? "☀️ Modo Claro" : "🌙 Modo Oscuro"
}

function toggleTheme(){
  document.body.classList.toggle("dark")
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light")
  setThemeFromStorage()
}

function clearSelect(sel){
  while(sel.firstChild) sel.removeChild(sel.firstChild)
}

function fillSelect(sel, items, keep){
  const prev = keep ? sel.value : ""
  clearSelect(sel)
  for(const it of items){
    const opt = document.createElement("option")
    opt.value = it.value
    opt.textContent = it.label
    sel.appendChild(opt)
  }
  if(keep && prev && items.some(x => x.value === prev)) sel.value = prev
  if(!sel.value && sel.options.length) sel.value = sel.options[0].value
}

// FIX #4: Nombres de razas corregidos para coincidir con el JSON
function raceList(){
  return ["HUNOS","ROMANO","GERMANO","GALOS","EGIPTO"]
}

// FIX #1: Usar t.race en lugar de t.raza
function getTroopsByRaceAndTipo(race, tipo){
  const arr = (CATALOG_TROOPS || []).filter(t => String(t.race || "").toUpperCase() === String(race).toUpperCase())
  if(tipo) return arr.filter(t => String(t.tipo_edificio || "").toUpperCase() === tipo)
  return arr
}

// FIX #1: Usar t.name en lugar de t.tropa
function getTroopByName(race, name){
  const arr = getTroopsByRaceAndTipo(race, null)
  return arr.find(t => String(t.name) === String(name)) || null
}

// FIX #3 y #5: Acceso correcto a la estructura de edificios (plana, array de costos)
function getBuildRowCost(race, buildingName, ini, fin, cant){
  const buildings = (CATALOG_BUILD && CATALOG_BUILD.buildings) || {}
  const b = buildings[String(buildingName)]
  if(!b) return null
  const a = Math.min(n0(ini), n0(fin))
  const z = Math.max(n0(ini), n0(fin))
  if(z <= a) return {wood:0,clay:0,iron:0,crop:0,total:0}
  const c = Math.max(1, Math.floor(n0(cant)))
  let w=0,cl=0,ir=0,cr=0
  for(let lvl = a+1; lvl <= z; lvl++){
    // costs es un array 0-based: costs[lvl-1] = [wood, clay, iron, crop]
    const x = b.costs[lvl - 1]
    if(!x) continue
    w  += n0(x[0])
    cl += n0(x[1])
    ir += n0(x[2])
    cr += n0(x[3])
  }
  w *= c; cl *= c; ir *= c; cr *= c
  return {wood:w,clay:cl,iron:ir,crop:cr,total:w+cl+ir+cr}
}

// FIX #1: Usar t.wood, t.clay, t.iron, t.crop
function getTroopRowCost(race, troopName, cant){
  const t = getTroopByName(race, troopName)
  if(!t) return null
  const c = Math.max(1, Math.floor(n0(cant)))
  const w  = n0(t.wood) * c
  const cl = n0(t.clay) * c
  const ir = n0(t.iron) * c
  const cr = n0(t.crop) * c
  return {wood:w,clay:cl,iron:ir,crop:cr,total:w+cl+ir+cr}
}

function distributeEquitable(total, orderKey){
  const totalInt = Math.max(0, Math.floor(n0(total)))
  const base = Math.floor(totalInt / 4)
  let rem = totalInt - base*4
  const dist = {wood:base, clay:base, iron:base, crop:base}
  const ord = ORDER_MAP[orderKey] || ORDER_MAP.MBHC
  let i = 0
  while(rem > 0){
    dist[ord[i % ord.length]] += 1
    rem -= 1
    i += 1
  }
  dist.total = dist.wood + dist.clay + dist.iron + dist.crop
  return dist
}

// FIX #1: Usar t.time en lugar de t.tiempo
function getEffectiveSecondsForTroop(race, troopName){
  const t = getTroopByName(race, troopName)
  if(!t) return 0

  const base = parseTimeToSec(t.time)
  const tipo = String(t.tipo_edificio || "").toUpperCase()

  let lvl = 1
  if(tipo === "C") lvl = Math.max(1, Math.min(20, Math.floor(n0($("lvlBarracks").value))))
  if(tipo === "E") lvl = Math.max(1, Math.min(20, Math.floor(n0($("lvlStable").value))))
  if(tipo === "T") lvl = Math.max(1, Math.min(20, Math.floor(n0($("lvlWorkshop").value))))

  const factorB = BUILDING_TIME_FACTOR[lvl] || 1.0
  const ally    = n0($("allyBonus").value)
  const trooper = n0($("trooperBoost").value)

  let helmet = 0
  if(tipo === "C") helmet = n0($("helmetBarracks").value)
  if(tipo === "E") helmet = n0($("helmetStable").value)

  const seconds = base * factorB * (1 - ally) * (1 - trooper) * (1 - helmet)
  return Math.max(0, seconds)
}

// FIX #1: Usar campos en inglés; devuelve detalle por cola para la matriz
function simulateTimeModeSpend(race, budgetTotal){
  const budget = Math.max(0, Math.floor(n0(budgetTotal)))

  const qDefs = [
    { checkId:"qBarracksOn",  troopId:"qBarracksTroop",  tipo:"C", label:"Cuartel" },
    { checkId:"qStableOn",    troopId:"qStableTroop",    tipo:"E", label:"Establo" },
    { checkId:"qWorkshopOn",  troopId:"qWorkshopTroop",  tipo:"T", label:"Taller"  },
  ]

  const queues = []
  for(const def of qDefs){
    if($(def.checkId).checked){
      const name = $(def.troopId).value
      const t = getTroopByName(race, name)
      if(t){
        queues.push({
          tipo:   def.tipo,
          label:  def.label,
          name,
          sec:    getEffectiveSecondsForTroop(race, name),
          cost:   n0(t.total),
          w: n0(t.wood), c: n0(t.clay), i: n0(t.iron), p: n0(t.crop),
          acc: 0, cnt: 0,
          spentW:0, spentC:0, spentI:0, spentP:0, spentT:0
        })
      }
    }
  }

  if(queues.length === 0) return {
    spent:{wood:0,clay:0,iron:0,crop:0,total:0}, leftover:budget, detail:[]
  }

  let remain = budget

  while(true){
    const affordable = queues.filter(x => x.cost > 0 && x.cost <= remain)
    if(affordable.length === 0) break
    affordable.sort((a,b) => a.acc - b.acc)
    const pick  = affordable[0]
    pick.acc   += pick.sec
    pick.cnt   += 1
    pick.spentW += pick.w
    pick.spentC += pick.c
    pick.spentI += pick.i
    pick.spentP += pick.p
    pick.spentT += pick.cost
    remain      -= pick.cost
  }

  let totW=0, totC=0, totI=0, totP=0
  for(const q of queues){ totW+=q.spentW; totC+=q.spentC; totI+=q.spentI; totP+=q.spentP }

  return {
    spent: {wood:totW, clay:totC, iron:totI, crop:totP, total:totW+totC+totI+totP},
    leftover: remain,
    detail: queues.map(q => ({
      label:   q.label,
      name:    q.name,
      cnt:     q.cnt,
      wood:    q.spentW,
      clay:    q.spentC,
      iron:    q.spentI,
      crop:    q.spentP,
      total:   q.spentT,
      timeSec: q.acc   // tiempo acumulado de esa cola
    }))
  }
}

// FIX #1: Usar campos en inglés; devuelve detalle para la matriz
function simulateExactTroopSpend(race, troopName, budgetTotal){
  const budget = Math.max(0, Math.floor(n0(budgetTotal)))
  const t = getTroopByName(race, troopName)
  if(!t) return {
    spent:{wood:0,clay:0,iron:0,crop:0,total:0}, leftover:budget, detail:null
  }
  const cost    = Math.max(1, Math.floor(n0(t.total)))
  const cnt     = Math.floor(budget / cost)
  const secEach = getEffectiveSecondsForTroop(race, troopName)
  const spentW  = n0(t.wood)*cnt
  const spentC  = n0(t.clay)*cnt
  const spentI  = n0(t.iron)*cnt
  const spentP  = n0(t.crop)*cnt
  const spentT  = spentW+spentC+spentI+spentP
  return {
    spent: {wood:spentW, clay:spentC, iron:spentI, crop:spentP, total:spentT},
    leftover: budget - cost*cnt,
    detail: {
      name:    troopName,
      cnt,
      wood:    spentW,
      clay:    spentC,
      iron:    spentI,
      crop:    spentP,
      total:   spentT,
      timeSec: secEach * cnt
    }
  }
}

function getRowTotals(race){
  let w=0,cl=0,ir=0,cr=0
  const lineTotals = []

  for(const r of rowsState){
    const tipo = r.tipo
    let t = {wood:0,clay:0,iron:0,crop:0,total:0}
    if(tipo === "EDIFICIO"){
      const x = getBuildRowCost(race, r.name, r.ini, r.fin, r.cant)
      if(x) t = x
    }else{
      const x = getTroopRowCost(race, r.name, r.cant)
      if(x) t = x
    }
    w += t.wood; cl += t.clay; ir += t.iron; cr += t.crop
    lineTotals.push(t)
  }
  return {sum:{wood:w,clay:cl,iron:ir,crop:cr,total:w+cl+ir+cr}, lineTotals}
}

function updateModePanels(){
  const m = $("excessMode").value
  $("modeTimePanel").style.display  = m === "time"  ? "block" : "none"
  $("modeExactPanel").style.display = m === "exact" ? "block" : "none"
}

function setText(id, v){
  $(id).textContent = fmtInt(v)
}

// ─── Renderiza la matriz de resumen de tropas (Opción 2: por tiempo) ───────────
function renderTimeTroopMatrix(detail, leftover){
  const wrap = $("timeTroopMatrix")
  if(!wrap) return
  wrap.innerHTML = ""

  const hasAny = detail && detail.some(d => d.cnt > 0)
  if(!detail || !hasAny){
    wrap.style.display = "none"
    return
  }
  wrap.style.display = "block"

  const title = document.createElement("div")
  title.className = "troop-matrix-title"
  title.textContent = "Tropas entrenables con el excedente"
  wrap.appendChild(title)

  const grid = document.createElement("div")
  grid.className = "troop-matrix-grid"

  // Headers — 8 columnas
  const headers = ["Cola / Tropa","Cantidad","Madera","Barro","Hierro","Cereal","Total","Tiempo cola"]
  for(const h of headers){
    const cell = document.createElement("div")
    cell.className = "tm-hdr" + (h === "Cola / Tropa" ? " tm-left" : "")
    cell.textContent = h
    grid.appendChild(cell)
  }

  // Fila por cada cola
  let totCnt=0, totW=0, totC=0, totI=0, totP=0, totT=0, maxSec=0
  for(const d of detail){
    totCnt += d.cnt; totW += d.wood; totC += d.clay
    totI   += d.iron; totP += d.crop; totT += d.total
    maxSec  = Math.max(maxSec, d.timeSec)

    const nameCell = document.createElement("div")
    nameCell.className = "tm-cell tm-left"
    nameCell.innerHTML = `<span class="tm-queue-label">${d.label}</span>${d.name}`
    grid.appendChild(nameCell)

    const valsNum = [d.cnt, d.wood, d.clay, d.iron, d.crop, d.total]
    for(const v of valsNum){
      const cell = document.createElement("div")
      cell.className = "tm-cell"
      cell.textContent = d.cnt === 0 ? "—" : fmtInt(v)
      grid.appendChild(cell)
    }

    const timeCell = document.createElement("div")
    timeCell.className = "tm-cell tm-time"
    timeCell.textContent = d.cnt === 0 ? "—" : fmtTime(d.timeSec)
    grid.appendChild(timeCell)
  }

  // Fila totales
  const totalLabel = document.createElement("div")
  totalLabel.className = "tm-total tm-left"
  totalLabel.textContent = "TOTAL"
  grid.appendChild(totalLabel)

  for(const v of [totCnt, totW, totC, totI, totP, totT]){
    const cell = document.createElement("div")
    cell.className = "tm-total"
    cell.textContent = fmtInt(v)
    grid.appendChild(cell)
  }

  // Tiempo = el máximo de cualquier cola (cuello de botella)
  const timeTot = document.createElement("div")
  timeTot.className = "tm-total tm-time"
  timeTot.textContent = fmtTime(maxSec)
  grid.appendChild(timeTot)

  wrap.appendChild(grid)

  // Excedente post-tropas
  const leftDiv = document.createElement("div")
  leftDiv.className = "tm-leftover"
  leftDiv.innerHTML = `Excedente restante (se distribuye equitativamente): <strong>${fmtInt(leftover)}</strong>`
  wrap.appendChild(leftDiv)
}

// ─── Renderiza la matriz de resumen de tropas (Opción 3: tropa exacta) ─────────
function renderExactTroopMatrix(detail, leftover){
  const wrap = $("exactTroopMatrix")
  if(!wrap) return
  wrap.innerHTML = ""

  if(!detail || detail.cnt === 0){
    wrap.style.display = "none"
    return
  }
  wrap.style.display = "block"

  const title = document.createElement("div")
  title.className = "troop-matrix-title"
  title.textContent = "Tropas entrenables con el excedente"
  wrap.appendChild(title)

  const grid = document.createElement("div")
  grid.className = "troop-matrix-grid"

  const headers = ["Tropa","Cantidad","Madera","Barro","Hierro","Cereal","Total","Tiempo"]
  for(const h of headers){
    const cell = document.createElement("div")
    cell.className = "tm-hdr" + (h === "Tropa" ? " tm-left" : "")
    cell.textContent = h
    grid.appendChild(cell)
  }

  const nameCell = document.createElement("div")
  nameCell.className = "tm-cell tm-left"
  nameCell.textContent = detail.name
  grid.appendChild(nameCell)

  for(const v of [detail.cnt, detail.wood, detail.clay, detail.iron, detail.crop, detail.total]){
    const cell = document.createElement("div")
    cell.className = "tm-cell"
    cell.textContent = fmtInt(v)
    grid.appendChild(cell)
  }

  const timeCell = document.createElement("div")
  timeCell.className = "tm-cell tm-time"
  timeCell.textContent = fmtTime(detail.timeSec)
  grid.appendChild(timeCell)

  wrap.appendChild(grid)

  const leftDiv = document.createElement("div")
  leftDiv.className = "tm-leftover"
  leftDiv.innerHTML = `Excedente restante (se distribuye equitativamente): <strong>${fmtInt(leftover)}</strong>`
  wrap.appendChild(leftDiv)
}

function recalc(){
  updateModePanels()

  const race     = $("raceSelect").value || "HUNOS"
  const curTotal = Math.max(0, Math.floor(n0($("curTotal").value)))
  const m        = $("excessMode").value
  const ord      = $("eqOrder").value

  const {sum} = getRowTotals(race)

  setText("reqWood", sum.wood)
  setText("reqClay", sum.clay)
  setText("reqIron", sum.iron)
  setText("reqCrop", sum.crop)
  setText("reqAll",  sum.total)

  const remaining = curTotal - sum.total
  const status    = $("statusLine")
  status.className = "statusline"

  // Ocultar matrices mientras no haya excedente positivo
  const twrap = $("timeTroopMatrix")
  const ewrap = $("exactTroopMatrix")
  if(twrap) twrap.style.display = "none"
  if(ewrap) ewrap.style.display = "none"

  if(remaining < 0){
    status.classList.add("status-bad")
    status.textContent = "NO ALCANZA. Falta total: " + fmtInt(-remaining)
    setText("tgtWood", sum.wood)
    setText("tgtClay", sum.clay)
    setText("tgtIron", sum.iron)
    setText("tgtCrop", sum.crop)
    setText("tgtAll",  sum.total)
    return
  }

  const budget = remaining
  let dist = {wood:0,clay:0,iron:0,crop:0,total:0}

  if(m === "eq"){
    dist = distributeEquitable(budget, ord)
  }

  if(m === "time"){
    const sim = simulateTimeModeSpend(race, budget)
    const eq  = distributeEquitable(sim.leftover, ord)
    dist = {
      wood:  sim.spent.wood  + eq.wood,
      clay:  sim.spent.clay  + eq.clay,
      iron:  sim.spent.iron  + eq.iron,
      crop:  sim.spent.crop  + eq.crop,
      total: 0
    }
    dist.total = dist.wood + dist.clay + dist.iron + dist.crop
    renderTimeTroopMatrix(sim.detail, sim.leftover)
  }

  if(m === "exact"){
    const troop = $("exactTroop").value
    const sim   = simulateExactTroopSpend(race, troop, budget)
    const eq    = distributeEquitable(sim.leftover, ord)
    dist = {
      wood:  sim.spent.wood  + eq.wood,
      clay:  sim.spent.clay  + eq.clay,
      iron:  sim.spent.iron  + eq.iron,
      crop:  sim.spent.crop  + eq.crop,
      total: 0
    }
    dist.total = dist.wood + dist.clay + dist.iron + dist.crop
    renderExactTroopMatrix(sim.detail, sim.leftover)
  }

  if(rowsState.length === 0){
    status.textContent = ""
  } else {
    status.classList.add("status-ok")
    status.textContent = "OK. Excedente: " + fmtInt(remaining)
  }

  setText("tgtWood", sum.wood + dist.wood)
  setText("tgtClay", sum.clay + dist.clay)
  setText("tgtIron", sum.iron + dist.iron)
  setText("tgtCrop", sum.crop + dist.crop)
  setText("tgtAll",  sum.total + dist.total)
}

function makeCell(text){
  const td = document.createElement("td")
  td.textContent = text
  return td
}

function makeNumInput(value, min){
  const inp = document.createElement("input")
  inp.type  = "number"
  inp.min   = String(min ?? 0)
  inp.value = String(value ?? 0)
  inp.addEventListener("input", recalc)
  return inp
}

function renderRows(){
  const tbody = $("rows")
  while(tbody.firstChild) tbody.removeChild(tbody.firstChild)

  const race = $("raceSelect").value || "HUNOS"

  // FIX #5: Leer edificios desde CATALOG_BUILD.buildings (estructura plana)
  const buildNames = Object.keys((CATALOG_BUILD && CATALOG_BUILD.buildings) || {}).sort((a,b)=>a.localeCompare(b,"es"))

  // FIX #1: Usar t.name
  const troopNames = getTroopsByRaceAndTipo(race, null).map(t => String(t.name)).sort((a,b)=>a.localeCompare(b,"es"))

  const {lineTotals} = getRowTotals(race)

  for(let idx=0; idx<rowsState.length; idx++){
    const r  = rowsState[idx]
    const tr = document.createElement("tr")

    const tdTipo  = document.createElement("td")
    const selTipo = document.createElement("select")
    fillSelect(selTipo, [{value:"EDIFICIO",label:"EDIFICIO"},{value:"TROPA",label:"TROPA"}], false)
    selTipo.value = r.tipo
    selTipo.addEventListener("change", () => {
      r.tipo = selTipo.value
      if(r.tipo === "EDIFICIO"){
        if(!buildNames.includes(r.name)) r.name = buildNames[0] || ""
        r.ini = Math.max(0, Math.floor(n0(r.ini)))
        r.fin = Math.max(0, Math.floor(n0(r.fin)))
      }else{
        if(!troopNames.includes(r.name)) r.name = troopNames[0] || ""
        r.ini = 0
        r.fin = 0
      }
      renderRows()
      recalc()
    })
    tdTipo.appendChild(selTipo)
    tr.appendChild(tdTipo)

    const tdName  = document.createElement("td")
    tdName.className = "left"
    const selName = document.createElement("select")
    const list = (r.tipo === "EDIFICIO" ? buildNames : troopNames).map(x => ({value:x,label:x}))
    fillSelect(selName, list, true)
    if(r.name && list.some(x=>x.value===r.name)) selName.value = r.name
    else selName.value = list[0]?.value || ""
    r.name = selName.value
    selName.addEventListener("change", () => { r.name = selName.value; recalc() })
    tdName.appendChild(selName)
    tr.appendChild(tdName)

    const tdCant  = document.createElement("td")
    const inpCant = makeNumInput(r.cant, 1)
    inpCant.addEventListener("input", ()=>{ r.cant = Math.max(1, Math.floor(n0(inpCant.value))); recalc() })
    tdCant.appendChild(inpCant)
    tr.appendChild(tdCant)

    const tdIni  = document.createElement("td")
    const inpIni = makeNumInput(r.ini, 0)
    inpIni.disabled = r.tipo !== "EDIFICIO"
    inpIni.addEventListener("input", ()=>{ r.ini = Math.max(0, Math.floor(n0(inpIni.value))); recalc() })
    tdIni.appendChild(inpIni)
    tr.appendChild(tdIni)

    const tdFin  = document.createElement("td")
    const inpFin = makeNumInput(r.fin, 0)
    inpFin.disabled = r.tipo !== "EDIFICIO"
    inpFin.addEventListener("input", ()=>{ r.fin = Math.max(0, Math.floor(n0(inpFin.value))); recalc() })
    tdFin.appendChild(inpFin)
    tr.appendChild(tdFin)

    const t = lineTotals[idx] || {wood:0,clay:0,iron:0,crop:0,total:0}
    tr.appendChild(makeCell(fmtInt(t.wood)))
    tr.appendChild(makeCell(fmtInt(t.clay)))
    tr.appendChild(makeCell(fmtInt(t.iron)))
    tr.appendChild(makeCell(fmtInt(t.crop)))
    tr.appendChild(makeCell(fmtInt(t.total)))

    const tdDel = document.createElement("td")
    const btn   = document.createElement("button")
    btn.type        = "button"
    btn.className   = "row-del"
    btn.textContent = "×"
    btn.addEventListener("click", () => {
      rowsState.splice(idx, 1)
      renderRows()
      recalc()
    })
    tdDel.appendChild(btn)
    tr.appendChild(tdDel)

    tbody.appendChild(tr)
  }

  recalc()
}

// FIX #5: Leer edificios desde CATALOG_BUILD.buildings
function addRowDefault(){
  const buildNames = Object.keys((CATALOG_BUILD && CATALOG_BUILD.buildings) || {}).sort((a,b)=>a.localeCompare(b,"es"))
  rowsState.push({tipo:"EDIFICIO", name: buildNames[0] || "", cant:1, ini:0, fin:1})
  renderRows()
}

async function loadCatalogs(){
  const [b,t] = await Promise.all([
    fetch("./catalogo_edificios.json").then(r=>r.json()),
    fetch("./catalogo_tropas.json").then(r=>r.json())
  ])
  CATALOG_BUILD = b
  // FIX #2: Extraer el array troops del JSON con campos correctos
  CATALOG_TROOPS = (Array.isArray(t?.troops) ? t.troops : []).filter(x => x && x.name && x.race)
}

function fillTrainingLevelSelect(selId){
  const sel   = $(selId)
  const items = []
  for(let i=1;i<=20;i++) items.push({value:String(i), label:String(i)})
  fillSelect(sel, items, false)
  sel.value = "1"
  sel.addEventListener("change", recalc)
}

// FIX #1: Usar t.name
function updateTroopSelectsForRace(){
  const race = $("raceSelect").value || "HUNOS"

  const cList   = getTroopsByRaceAndTipo(race, "C").map(t=>String(t.name)).sort((a,b)=>a.localeCompare(b,"es"))
  const eList   = getTroopsByRaceAndTipo(race, "E").map(t=>String(t.name)).sort((a,b)=>a.localeCompare(b,"es"))
  const wList   = getTroopsByRaceAndTipo(race, "T").map(t=>String(t.name)).sort((a,b)=>a.localeCompare(b,"es"))
  const allList = getTroopsByRaceAndTipo(race, null).map(t=>String(t.name)).sort((a,b)=>a.localeCompare(b,"es"))

  fillSelect($("qBarracksTroop"), cList.map(x=>({value:x,label:x})),   true)
  fillSelect($("qStableTroop"),   eList.map(x=>({value:x,label:x})),   true)
  fillSelect($("qWorkshopTroop"), wList.map(x=>({value:x,label:x})),   true)
  fillSelect($("exactTroop"),     allList.map(x=>({value:x,label:x})), true)

  renderRows()
}

async function init(){
  setThemeFromStorage()
  $("themeToggle").addEventListener("click", toggleTheme)

  await loadCatalogs()

  const races = raceList().map(r => ({value:r,label:r}))
  fillSelect($("raceSelect"), races, false)
  $("raceSelect").value = "HUNOS"
  $("raceSelect").addEventListener("change", () => {
    updateTroopSelectsForRace()
    recalc()
  })

  fillTrainingLevelSelect("lvlBarracks")
  fillTrainingLevelSelect("lvlStable")
  fillTrainingLevelSelect("lvlWorkshop")

  $("allyBonus").addEventListener("change",      recalc)
  $("trooperBoost").addEventListener("change",   recalc)
  $("helmetBarracks").addEventListener("change", recalc)
  $("helmetStable").addEventListener("change",   recalc)

  $("qBarracksOn").addEventListener("change",    recalc)
  $("qStableOn").addEventListener("change",      recalc)
  $("qWorkshopOn").addEventListener("change",    recalc)
  $("qBarracksTroop").addEventListener("change", recalc)
  $("qStableTroop").addEventListener("change",   recalc)
  $("qWorkshopTroop").addEventListener("change", recalc)
  $("exactTroop").addEventListener("change",     recalc)

  $("excessMode").value = "eq"
  $("excessMode").addEventListener("change", recalc)
  $("eqOrder").addEventListener("change",    recalc)
  $("curTotal").addEventListener("input",    recalc)

  $("addRow").addEventListener("click", addRowDefault)

  updateTroopSelectsForRace()

  rowsState = []
  renderRows()
  recalc()
}

init().catch(() => {})
