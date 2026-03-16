
const $ = id => document.getElementById(id)

/* ── Catálogo cargado desde JSON ── */
let CATALOG = []   // [{nombre, niveles:[{nivel,madera,barro,hierro,cereal,total,consumo,pc}]}]

/* Solo edificios que tengan al menos 1 nivel con PC > 0 */
let PC_BUILDINGS = []

/* ── Matriz de aldea actual ── */
let villageMatrix = []   // [{buildingName, currentLevel}]
let matrixCounter = 0

/* ── Helpers ── */
const n0 = v => { const x=Number(v); return isFinite(x)?x:0 }
const fmtNum = n => n.toLocaleString('es-PE')
const fmtBuildingName = name => String(name || '').toUpperCase()

function setTheme(){
  const dark = localStorage.getItem('theme')==='dark'
  document.body.classList.toggle('dark', dark)
  const btn = $('themeToggle')
  if(btn) btn.textContent = dark ? '☀️ Modo Claro' : '🌙 Modo Oscuro'
}
function pcDeltaForLevel(b, level){
  const now = b.niveles.find(n => n.nivel === level)
  if(!now) return 0
  const prev = b.niveles.find(n => n.nivel === (level - 1))
  const prevPc = prev ? (prev.pc || 0) : 0
  return (now.pc || 0) - prevPc
}

/* ══════════════════════════════════════════════════════════════════
   CARGA DEL CATÁLOGO
   ══════════════════════════════════════════════════════════════════ */
async function loadCatalog(){
  const urls = [
    '../npc/catalogo_edificios.json',
    './catalogo_edificios.json',
    '../catalogo_edificios.json',
    '/npc/catalogo_edificios.json',
  ]

  let data = null
  let lastErr = null

  for(const url of urls){
    try{
      const r = await fetch(url, { cache: 'no-store' })
      if(!r.ok) throw new Error(`HTTP ${r.status} en ${url}`)
      data = await r.json()
      console.log('[CULTURA] JSON cargado desde:', url)
      break
    }catch(e){
      lastErr = e
      console.warn('[CULTURA] Falló:', url, e)
    }
  }

  if(!data){
    console.error('[CULTURA] No se pudo cargar catálogo:', lastErr)
    CATALOG = []
    PC_BUILDINGS = []
    renderMatrix()
    return
  }

  // ✅ Normaliza: si viene como objeto wrapper, extrae el array correcto
  const arr =
    Array.isArray(data) ? data :
    Array.isArray(data.data) ? data.data :
    Array.isArray(data.buildings) ? data.buildings :
    Array.isArray(data.catalog) ? data.catalog :
    Array.isArray(data.items) ? data.items :
    []

  if(!Array.isArray(arr) || arr.length === 0){
    console.error('[CULTURA] Catálogo cargó pero NO es array (o vino vacío).', data)
    CATALOG = []
    PC_BUILDINGS = []
    renderMatrix()
    return
  }

  // ✅ Normaliza campos y tipos + ordena niveles
  CATALOG = arr.map(b => ({
    nombre: String(b.nombre ?? b.name ?? '').trim(),
    niveles: (b.niveles ?? b.levels ?? []).map(n => ({
      nivel:   Number(n.nivel ?? n.level ?? 0),
      total:   Number(n.total ?? 0),
      consumo: Number(n.consumo ?? 0),
      pc:      Number(n.pc ?? 0),
      madera:  Number(n.madera ?? 0),
      barro:   Number(n.barro ?? 0),
      hierro:  Number(n.hierro ?? 0),
      cereal:  Number(n.cereal ?? 0),
    }))
    .filter(x => Number.isFinite(x.nivel) && x.nivel > 0)
    .sort((a,b)=>a.nivel-b.nivel)
  })).filter(b => b.nombre && b.niveles.length)

  // ✅ aquí ya no revienta porque CATALOG ES array sí o sí
  PC_BUILDINGS = CATALOG.filter(b =>
  b.niveles.some(n => {
    const lvl = n.nivel
    if(lvl <= 0) return false
    const prev = b.niveles.find(x => x.nivel === lvl - 1)
    const prevPc = prev ? Number(prev.pc || 0) : 0
    return Number(n.pc || 0) - prevPc > 0
  })
)

  console.log('[CULTURA] CATALOG=', CATALOG.length, 'PC_BUILDINGS=', PC_BUILDINGS.length)

  renderMatrix()

  // UX: que aparezca 1 fila por defecto
  if(villageMatrix.length === 0){
    addMatrixRow()
  }
}
/* ══════════════════════════════════════════════════════════════════
   LÓGICA DE CÁLCULO
   ══════════════════════════════════════════════════════════════════ */

/* Obtiene datos de un nivel de un edificio */
function getBuildingLevel(buildingName, nivel){
  const b = CATALOG.find(b => b.nombre === buildingName)
  if(!b) return null
  return b.niveles.find(n => n.nivel === nivel) || null
}

/* PC acumulados de un edificio desde nivel 0 hasta nivel X */
function accumulatedPC(buildingName, upToLevel){
  const b = CATALOG.find(b => b.nombre === buildingName)
  if(!b || upToLevel <= 0) return 0

  const lv = b.niveles.find(n => n.nivel === upToLevel)
  return lv ? (lv.pc || 0) : 0   // pc ya es acumulado
}

/* Consumo acumulado de nivel 0 hasta nivel X */
function accumulatedConsumption(buildingName, upToLevel){
  const b = CATALOG.find(b => b.nombre === buildingName)
  if(!b || upToLevel <= 0) return 0
  return b.niveles
    .filter(n => n.nivel <= upToLevel)
    .reduce((s, n) => s + (n.consumo||0), 0)
}

/* Costo acumulado de nivel 0 hasta nivel X */
function accumulatedCost(buildingName, upToLevel){
  const b = CATALOG.find(b => b.nombre === buildingName)
  if(!b || upToLevel <= 0) return 0
  return b.niveles
    .filter(n => n.nivel <= upToLevel)
    .reduce((s, n) => s + (n.total||0), 0)
}

/* Calcula el estado actual de la aldea según la matriz */
function calcCurrentState(){
  let totalPC = 0, totalConsumption = 0, totalCost = 0
  for(const row of villageMatrix){
    if(!row.buildingName || row.currentLevel <= 0) continue
    totalPC          += accumulatedPC(row.buildingName, row.currentLevel)
    totalConsumption += accumulatedConsumption(row.buildingName, row.currentLevel)
    totalCost        += accumulatedCost(row.buildingName, row.currentLevel)
  }
  return {totalPC, totalConsumption, totalCost}
}

/* ══════════════════════════════════════════════════════════════════
   GENERADOR DE PASOS CANDIDATOS
   Genera todos los "pasos" posibles: siguiente nivel disponible de
   cada edificio en la matriz, o nivel 1 de edificios no presentes.

   Regla clave: si para llegar al nivel con PC hay que pasar por
   niveles sin PC, el costo del paso incluye TODOS esos niveles.
   ══════════════════════════════════════════════════════════════════ */
function generateCandidates(currentLevels){
  // currentLevels: Map<buildingName, level>
  const candidates = []

  for(const b of PC_BUILDINGS){
    const currLevel = currentLevels.get(b.nombre) || 0
    const maxLevel  = b.niveles[b.niveles.length - 1].nivel

    if(currLevel >= maxLevel) continue  // ya al máximo

    // Encuentra el siguiente nivel que otorga PC >= el siguiente disponible
    // Puede ser que los primeros niveles tras currLevel no tengan PC
    // En ese caso agrupamos todos hasta el primero que tenga PC
    let fromLevel = currLevel
    let toLevel   = currLevel + 1
    let totalCostStep = 0
    let totalPCStep   = 0
    let totalConsumStep = 0

    // Acumula niveles desde fromLevel+1 hasta encontrar el primero con PC
    for(let lv = currLevel+1; lv <= maxLevel; lv++){
      const lvData = b.niveles.find(n => n.nivel === lv)
      if(!lvData) break
      totalCostStep   += (lvData.total || 0)
      totalConsumStep += (lvData.consumo || 0)
      totalPCStep += pcDeltaForLevel(b, lv)
      toLevel = lv
      if(totalPCStep > 0) break  // llegamos al primer nivel con PC
    }

    if(totalPCStep <= 0) continue  // no hay más niveles con PC

    const ratio = totalCostStep / totalPCStep

    candidates.push({
      buildingName: b.nombre,
      fromLevel,
      toLevel,
      pcGained:    totalPCStep,
      costStep:    totalCostStep,
      consumStep:  totalConsumStep,
      ratio,
    })
  }

  // Ordenar por ratio ascendente (mejor = más barato por PC)
  candidates.sort((a, b) => a.ratio - b.ratio)
  return candidates
}

/* ══════════════════════════════════════════════════════════════════
   CÁLCULO PRINCIPAL — greedy por ratio
   ══════════════════════════════════════════════════════════════════ */
function calculate(){
  const pcTarget = Math.max(1, n0($('pcTarget').value))
  $('targetLabel').textContent = fmtNum(pcTarget)

  // Estado inicial de la aldea
  const currentLevels = new Map()
  for(const row of villageMatrix){
    if(row.buildingName && row.currentLevel > 0)
      currentLevels.set(row.buildingName, row.currentLevel)
  }

  // Calcular estado actual
  const current = calcCurrentState()
  showCurrentSummary(current)

  if(current.totalPC >= pcTarget){
    // Ya tenemos suficientes PC
    $('resultPanel').style.display = 'none'
    $('emptyState').style.display  = 'none'
    showFutureSummary(current, pcTarget, true)
    return
  }

  // Greedy: en cada paso tomar el candidato con mejor ratio
  const steps = []
  let runningLevels = new Map(currentLevels)
  let accumulatedPCTotal = current.totalPC
  let accumulatedCostTotal = 0
  let accumulatedConsumeTotal = 0

  const MAX_STEPS = 500
  let safety = 0

  while(accumulatedPCTotal < pcTarget && safety++ < MAX_STEPS){
    const candidates = generateCandidates(runningLevels)
    if(candidates.length === 0) break

    const best = candidates[0]

    steps.push({
      stepNum:   steps.length + 1,
      buildingName: best.buildingName,
      fromLevel:    best.fromLevel,
      toLevel:      best.toLevel,
      pcGained:     best.pcGained,
      costStep:     best.costStep,
      consumStep:   best.consumStep,
      ratio:        best.ratio,
      pcAccum:      accumulatedPCTotal + best.pcGained,
    })

    accumulatedPCTotal     += best.pcGained
    accumulatedCostTotal   += best.costStep
    accumulatedConsumeTotal+= best.consumStep
    runningLevels.set(best.buildingName, best.toLevel)
  }

  // Mostrar resultados
  const future = {
    totalPC:          accumulatedPCTotal,
    totalConsumption: current.totalConsumption + accumulatedConsumeTotal,
    totalCost:        current.totalCost + accumulatedCostTotal,
    extraCost:        accumulatedCostTotal,
    extraConsume:     accumulatedConsumeTotal,
  }

  showFutureSummary(future, pcTarget, false)
  renderResultTable(steps)
  $('resultPanel').style.display = 'block'
  $('emptyState').style.display  = 'none'
}

/* ══════════════════════════════════════════════════════════════════
   RENDER RESÚMENES
   ══════════════════════════════════════════════════════════════════ */
function showCurrentSummary(state){
  const el = $('currentSummary')
  if(villageMatrix.length === 0 || state.totalPC === 0){
    el.style.display = 'none'; return
  }
  el.style.display = 'block'
  $('currentStats').innerHTML = `
    <div class="stat-chip"><span class="stat-label">PC actuales</span><span class="stat-val">${fmtNum(state.totalPC)}</span></div>
    <div class="stat-chip"><span class="stat-label">Consumo total</span><span class="stat-val">${fmtNum(state.totalConsumption)}</span></div>
    <div class="stat-chip"><span class="stat-label">Inversion total</span><span class="stat-val">${fmtNum(state.totalCost)}</span></div>
  `
}

function showFutureSummary(state, target, alreadyDone){
  const el = $('futureSummary')
  el.innerHTML = `
    <div class="summary-title">${alreadyDone ? '✅ Ya tienes suficientes PC' : '🎯 Estado proyectado al completar el plan'}</div>
    <div class="summary-stats">
      <div class="stat-chip"><span class="stat-label">PC proyectados</span><span class="stat-val">${fmtNum(state.totalPC)}</span></div>
      <div class="stat-chip"><span class="stat-label">Objetivo</span><span class="stat-val">${fmtNum(target)}</span></div>
      <div class="stat-chip"><span class="stat-label">Consumo proyectado</span><span class="stat-val">${fmtNum(state.totalConsumption)}</span></div>
      ${state.extraCost !== undefined ? `<div class="stat-chip"><span class="stat-label">Inversion adicional</span><span class="stat-val">${fmtNum(state.extraCost)}</span></div>` : ''}
      ${state.extraConsume !== undefined ? `<div class="stat-chip"><span class="stat-label">Cereal adicional</span><span class="stat-val">${fmtNum(state.extraConsume)}</span></div>` : ''}
    </div>
  `
}

/* ══════════════════════════════════════════════════════════════════
   RENDER TABLA DE RESULTADOS
   ══════════════════════════════════════════════════════════════════ */
function renderResultTable(steps){
  const body = $('resultTableBody')
  body.innerHTML = ''
  // Calcular percentiles del ratio para colorear
  const ratios = steps.map(s=>s.ratio).sort((a,b)=>a-b)
  const p33 = ratios[Math.floor(ratios.length*0.33)]
  const p66 = ratios[Math.floor(ratios.length*0.66)]

  steps.forEach(s => {
    const row = document.createElement('div')
    row.className = 'result-row'
    const ratioClass = s.ratio <= p33 ? 'good' : s.ratio >= p66 ? 'bad' : ''
    row.innerHTML = `
      <div class="rc"><span class="rc-num">#${s.stepNum}</span></div>
      <div class="rc left"><span class="rc-name">${fmtBuildingName(s.buildingName)}</span></div>
      <div class="rc"><span class="rc-level">Nv${s.fromLevel} → ${s.toLevel}</span></div>
      <div class="rc"><span class="rc-pc">+${s.pcGained}</span></div>
      <div class="rc"><span class="rc-cost">${fmtNum(s.costStep)}</span></div>
      <div class="rc"><span class="rc-ratio ${ratioClass}">${fmtNum(Math.round(s.ratio))}</span></div>
      <div class="rc"><span class="rc-consume">+${s.consumStep}</span></div>
      <div class="rc"><span class="rc-accum">${fmtNum(s.pcAccum)}</span></div>
    `
    body.appendChild(row)
  })
}

/* ══════════════════════════════════════════════════════════════════
   MATRIZ DE LA ALDEA
   ══════════════════════════════════════════════════════════════════ */
function renderMatrix(){
  const body = $('matrixBody')
  body.innerHTML = ''
  villageMatrix.forEach((row, idx) => renderMatrixRow(row, idx))
}

function renderMatrixRow(row, idx){
  const body = $('matrixBody')
  const div = document.createElement('div')
  div.className = 'matrix-row'
  div.id = `mrow-${row.id}`

  /* Selector de edificio */
  const selD = document.createElement('div'); selD.className = 'mc left'
  const sel = document.createElement('select')
  sel.innerHTML = '<option value="">-- Edificio --</option>'
  PC_BUILDINGS.forEach(b => {
    const o = document.createElement('option')
    o.value = b.nombre; o.textContent = fmtBuildingName(b.nombre)
    sel.appendChild(o)
  })
  sel.value = row.buildingName || ''
  sel.addEventListener('change', () => {
    row.buildingName = sel.value
    row.currentLevel = 0
    updateMatrixRowCalc(row)
  })
  selD.appendChild(sel); div.appendChild(selD)

  /* Nivel actual */
  const lvlD = document.createElement('div'); lvlD.className = 'mc'
  const lvlInp = document.createElement('input'); lvlInp.type = 'number'; lvlInp.min = '0'; lvlInp.value = String(row.currentLevel || 0)
  lvlInp.addEventListener('input', () => {
    row.currentLevel = Math.max(0, Math.floor(n0(lvlInp.value)))
    updateMatrixRowCalc(row)
  })
  lvlD.appendChild(lvlInp); div.appendChild(lvlD)

  /* PC acumulados */
  const pcD = document.createElement('div'); pcD.className = 'mc'
  pcD.innerHTML = `<span class="mc-val" id="mpc-${row.id}">—</span>`
  div.appendChild(pcD)

  /* Consumo */
  const conD = document.createElement('div'); conD.className = 'mc'
  conD.innerHTML = `<span class="mc-muted" id="mcon-${row.id}">—</span>`
  div.appendChild(conD)

  /* Costo acumulado */
  const costD = document.createElement('div'); costD.className = 'mc'
  costD.innerHTML = `<span class="mc-muted" id="mcost-${row.id}">—</span>`
  div.appendChild(costD)

  /* Eliminar */
  const delD = document.createElement('div'); delD.className = 'mc'
  const delBtn = document.createElement('button'); delBtn.className = 'btn-del'; delBtn.type = 'button'; delBtn.textContent = '×'
  delBtn.addEventListener('click', () => {
    villageMatrix = villageMatrix.filter(r => r.id !== row.id)
    div.remove()
  })
  delD.appendChild(delBtn); div.appendChild(delD)

  body.appendChild(div)
  updateMatrixRowCalc(row)
}

function updateMatrixRowCalc(row){
  if(!row.buildingName || row.currentLevel <= 0){
    const pc = $(`mpc-${row.id}`); if(pc) pc.textContent = '—'
    const con = $(`mcon-${row.id}`); if(con) con.textContent = '—'
    const cost = $(`mcost-${row.id}`); if(cost) cost.textContent = '—'
    return
  }
  const pc   = accumulatedPC(row.buildingName, row.currentLevel)
  const con  = accumulatedConsumption(row.buildingName, row.currentLevel)
  const cost = accumulatedCost(row.buildingName, row.currentLevel)
  const pcEl = $(`mpc-${row.id}`); if(pcEl) pcEl.textContent = fmtNum(pc)
  const conEl = $(`mcon-${row.id}`); if(conEl) conEl.textContent = fmtNum(con)
  const costEl = $(`mcost-${row.id}`); if(costEl) costEl.textContent = fmtNum(cost)
}

function addMatrixRow(){
  matrixCounter++
  const row = {id: matrixCounter, buildingName: '', currentLevel: 0}
  villageMatrix.push(row)
  renderMatrixRow(row, villageMatrix.length - 1)
}

/* ══ INIT ══ */
function init(){
  setTheme()

  $('btnCalc').addEventListener('click', calculate)
  $('btnAddBuilding').addEventListener('click', addMatrixRow)

  loadCatalog()
}
init()
