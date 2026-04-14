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

let oasisList = []
let oasisCounter = 0
let importTroops = [{name:"", qty:0}]

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

function travelMin(dist,name,srv){
  const spd=(TROOP_SPEED[name]||0)*srv
  return spd>0?(dist/spd)*60:Infinity
}

function currentRace()    { return $("raceSelect").value||"HUNOS" }
function currentSpeed()   { return Math.max(1,n0($("serverSpeed").value)) }
function currentInterval(){ return Math.max(1,n0($("intervalMin").value)) }
function troopsForRace(r) { return TROOPS_BY_RACE[r]||[] }

/* ══════════════════════════════════════════════════════════════════
   SIMULACIÓN CON POOL COMPARTIDO Y RETORNO DE TROPAS
   ══════════════════════════════════════════════════════════════════
   Algoritmo:
   - Cada oasis tiene un tiempo de ida (tIda) y necesita `cant` tropas por ataque
   - Los ataques se lanzan cada `interval` minutos
   - Las tropas regresan al pool en t + tIda*2
   - Buscamos el mínimo pool inicial que permita cubrir TODOS los oasis
     en TODOS los ciclos sin déficit, durante N ciclos hasta estado estable
   - "Estado estable": todos los ciclos desde C en adelante son idénticos
     (ningún oasis queda sin ataque)
   ══════════════════════════════════════════════════════════════════ */
function simulateLegacyBinarySearch(){
  const srv      = currentSpeed()
  const interval = currentInterval()

  /* Construir lista de "trabajos": cada oasis × cada tipo de tropa */
  const jobs = []
  for(const oasis of oasisList){
    for(const tr of oasis.troops){
      if(!tr.name||tr.qty<=0) continue
      const tIda = travelMin(oasis.dist, tr.name, srv)
      if(!isFinite(tIda)||tIda<=0) continue
      jobs.push({
        oasisId: oasis.id,
        troopName: tr.name,
        cant: tr.qty,          // tropas por ataque
        tIda,
        tIV: tIda*2,           // tiempo ida+vuelta en minutos
      })
    }
  }

  if(jobs.length===0) return {troopsNeeded:0, cyclesStable:0, troopsByName:{}}

  /* Agrupamos por nombre de tropa porque el pool es POR TIPO de tropa
     (un Merodeador no puede reemplazar a un Jinete estepario) */
  const troopNames = [...new Set(jobs.map(j=>j.troopName))]

  /* Para cada tipo de tropa, simulamos su pool por separado */
  const resultByTroop = {}

  for(const troopName of troopNames){
    const myJobs = jobs.filter(j=>j.troopName===troopName)

    /* Búsqueda binaria del mínimo pool para este tipo de tropa */
    /* Máximo teórico: suma simple de ceil(tIV/interval)*cant por job */
    let lo = 1
    let hi = myJobs.reduce((s,j)=> s + Math.ceil(j.tIV/interval)*j.cant, 0)

    let bestPool = hi, bestCycles = 1

    while(lo<=hi){
      const mid = Math.floor((lo+hi)/2)
      const {ok, cycles} = runSimulation(myJobs, mid, interval)
      if(ok){
        bestPool = mid
        bestCycles = cycles
        hi = mid-1
      } else {
        lo = mid+1
      }
    }

    resultByTroop[troopName] = {needed: bestPool, cycles: bestCycles}
  }

  /* Ciclos hasta estabilidad = el máximo entre todos los tipos */
  const cyclesStable = Math.max(...Object.values(resultByTroop).map(r=>r.cycles))
  const troopsByName = {}
  for(const [name,r] of Object.entries(resultByTroop)) troopsByName[name]=r.needed

  return {troopsNeeded: Object.values(troopsByName).reduce((a,b)=>a+b,0), cyclesStable, troopsByName}
}

/* Simula con un pool fijo de `poolSize` tropas de un tipo.
   Retorna {ok: bool, cycles: número de ciclos hasta estabilidad} */
function runSimulation(jobs, poolSize, interval){
  const MAX_CYCLES = 500;
  const EPS = 1e-6;

  let returns = [];   // {returnAt, cant}
  let available = poolSize;

  function releaseUpTo(t){
    let gained = 0;
    const keep = [];
    for(const r of returns){
      if(r.returnAt <= t + EPS) gained += r.cant;
      else keep.push(r);
    }
    returns = keep;
    available += gained;
  }

  // Estado “visto” en ticks: cuántos intervalos faltan para cada retorno
  function stateKey(t){
    const buckets = new Map(); // step -> totalCant
    for(const r of returns){
      const dt = r.returnAt - t;
      const step = Math.max(0, Math.ceil((dt - EPS) / interval));
      buckets.set(step, (buckets.get(step) || 0) + r.cant);
    }
    const sorted = [...buckets.entries()].sort((a,b)=>a[0]-b[0]);
    return `${available}|` + sorted.map(([k,v])=>`${k}:${v}`).join(",");
  }

  let prevPreKey = null;

  // “ciclo” = número de envíos realizados (1er envío en t=interval)
  for(let cycle=1; cycle<=MAX_CYCLES; cycle++){
    const t = cycle * interval;

    // 1) Regresan todas las que hayan vuelto en (t-interval, t]
    releaseUpTo(t);

    // 2) Estado pre-envío (aquí defines tu “mínimo necesario”)
    const preKey = stateKey(t);
    if(prevPreKey !== null && preKey === prevPreKey){
      return { ok:true, cycles: cycle }; // ya entró a régimen estable
    }
    prevPreKey = preKey;

    // 3) Salen los envíos de este tick
    for(const job of jobs){
      if(available < job.cant){
        return { ok:false, cycles: cycle };
      }
      available -= job.cant;
      returns.push({ returnAt: t + job.tIV, cant: job.cant });
    }
  }

  return { ok:true, cycles: MAX_CYCLES };
}
/* ── Resultado de simulación para mostrar por oasis (tIda, tIV, grps del slowest) ── */
// Ruta activa para calcular el pool minimo en envios sincronizados.
function simulateSyncPool(){
  const srv = currentSpeed()
  const interval = currentInterval()
  const jobsByTroop = new Map()

  for(const oasis of oasisList){
    for(const tr of oasis.troops){
      if(!tr.name||tr.qty<=0) continue
      const tIda = travelMin(oasis.dist, tr.name, srv)
      if(!isFinite(tIda)||tIda<=0) continue

      const job = {
        oasisId: oasis.id,
        troopName: tr.name,
        cant: tr.qty,
        tIda,
        tIV: tIda*2,
        groups: Math.max(1, Math.ceil((tIda * 2) / interval)),
      }

      if(!jobsByTroop.has(tr.name)) jobsByTroop.set(tr.name, [])
      jobsByTroop.get(tr.name).push(job)
    }
  }

  if(jobsByTroop.size===0) return {troopsNeeded:0, cyclesStable:0, troopsByName:{}}

  const resultByTroop = {}
  for(const [troopName, jobs] of jobsByTroop.entries()){
    // En un envio sincronizado, cada oasis ocupa `groups` tandas simultaneas.
    const needed = jobs.reduce((sum, job)=>sum + (job.groups * job.cant), 0)
    const sim = runSimulation(jobs, needed, interval)
    resultByTroop[troopName] = {
      needed,
      cycles: sim.ok ? sim.cycles : Math.max(...jobs.map(job=>job.groups)) + 1,
    }
  }

  const troopsByName = {}
  for(const [name, result] of Object.entries(resultByTroop)) troopsByName[name]=result.needed
  const cyclesStable = Math.max(...Object.values(resultByTroop).map(result=>result.cycles))

  return {
    troopsNeeded: Object.values(troopsByName).reduce((sum, qty)=>sum+qty, 0),
    cyclesStable,
    troopsByName,
    simulationSteps: sim.steps || [],
  }
}
function runGroupSimulation(jobs, poolByTroop, interval){
  const MAX_CYCLES = 500
  const EPS = 1e-6
  const troopNames = Object.keys(poolByTroop).sort()
  const available = {}
  troopNames.forEach(name=>{ available[name] = poolByTroop[name] || 0 })
  const fixedSendCounts = {}
  const steps = []

  for(const job of jobs){
    for(const [name, qty] of Object.entries(job.counts)){
      fixedSendCounts[name] = (fixedSendCounts[name] || 0) + qty
    }
  }

  let returns = []

  function cloneCounts(source){
    const clone = {}
    for(const name of troopNames) clone[name] = source[name] || 0
    return clone
  }

  function collectTransitCounts(){
    const transit = {}
    for(const name of troopNames) transit[name] = 0
    for(const ret of returns){
      for(const [name, qty] of Object.entries(ret.counts)){
        transit[name] = (transit[name] || 0) + qty
      }
    }
    return transit
  }

  function releaseUpTo(t){
    const keep = []
    const returnedCounts = {}
    const returnedOasis = []
    for(const ret of returns){
      if(ret.returnAt <= t + EPS){
        for(const [name, qty] of Object.entries(ret.counts)){
          available[name] = (available[name] || 0) + qty
          returnedCounts[name] = (returnedCounts[name] || 0) + qty
        }
        returnedOasis.push(ret.oasisId)
      } else {
        keep.push(ret)
      }
    }
    returns = keep
    return {returnedCounts, returnedOasis}
  }

  function stateKey(t){
    const availKey = troopNames.map(name=>`${name}:${available[name] || 0}`).join(",")
    const buckets = new Map()

    for(const ret of returns){
      const dt = ret.returnAt - t
      const step = Math.max(0, Math.ceil((dt - EPS) / interval))
      if(!buckets.has(step)) buckets.set(step, {})
      const bucketCounts = buckets.get(step)
      for(const [name, qty] of Object.entries(ret.counts)){
        bucketCounts[name] = (bucketCounts[name] || 0) + qty
      }
    }

    const bucketKey = [...buckets.entries()]
      .sort((a,b)=>a[0]-b[0])
      .map(([step, counts])=>{
        const countsKey = troopNames
          .filter(name=>counts[name] > 0)
          .map(name=>`${name}:${counts[name]}`)
          .join(",")
        return `${step}:${countsKey}`
      })
      .join("|")

    return `${availKey}||${bucketKey}`
  }

  let prevPreKey = null

  for(let cycle=1; cycle<=MAX_CYCLES; cycle++){
    const t = cycle * interval
    const released = releaseUpTo(t)
    const availableBefore = cloneCounts(available)

    const preKey = stateKey(t)
    if(prevPreKey !== null && preKey === prevPreKey){
      steps.push({
        cycle,
        minute: t,
        returnedCounts: released.returnedCounts,
        returnedOasis: released.returnedOasis.slice().sort((a,b)=>a-b),
        availableBefore,
        sentCounts: cloneCounts(fixedSendCounts),
        availableAfter: cloneCounts(available),
        inTransitAfter: collectTransitCounts(),
        status: "stable",
        note: "El estado previo al envio se repite; desde aqui el patron queda estable.",
      })
      return { ok:true, cycles: cycle, steps }
    }
    prevPreKey = preKey

    for(const job of jobs){
      for(const [name, qty] of Object.entries(job.counts)){
        if((available[name] || 0) < qty){
          steps.push({
            cycle,
            minute: t,
            returnedCounts: released.returnedCounts,
            returnedOasis: released.returnedOasis.slice().sort((a,b)=>a-b),
            availableBefore,
            sentCounts: cloneCounts(fixedSendCounts),
            availableAfter: cloneCounts(available),
            inTransitAfter: collectTransitCounts(),
            status: "fail",
            note: `Falta ${job.troopName || name} para sostener el envio sincronizado.`,
          })
          return { ok:false, cycles: cycle, steps }
        }
      }
      for(const [name, qty] of Object.entries(job.counts)){
        available[name] -= qty
      }
      returns.push({ returnAt: t + job.tIV, counts: job.counts, oasisId: job.oasisId })
    }

    steps.push({
      cycle,
      minute: t,
      returnedCounts: released.returnedCounts,
      returnedOasis: released.returnedOasis.slice().sort((a,b)=>a-b),
      availableBefore,
      sentCounts: cloneCounts(fixedSendCounts),
      availableAfter: cloneCounts(available),
      inTransitAfter: collectTransitCounts(),
      status: "progress",
      note: "Ciclo ejecutado; el pool sigue acumulando retornos hacia el estado estable.",
    })
  }

  return { ok:true, cycles: MAX_CYCLES, steps }
}

function simulateSyncGroupPool(){
  const interval = currentInterval()
  const jobs = []
  const troopsByName = {}

  for(const oasis of oasisList){
    const active = oasis.troops.filter(tr=>tr.name && tr.qty>0)
    if(!active.length) continue

    const {tIda, tIV, grps} = calcOasis(oasis)
    if(!isFinite(tIda)||!isFinite(tIV)||grps<=0) continue

    const counts = {}
    for(const tr of active){
      counts[tr.name] = (counts[tr.name] || 0) + tr.qty
      troopsByName[tr.name] = (troopsByName[tr.name] || 0) + (grps * tr.qty)
    }

    jobs.push({
      oasisId: oasis.id,
      counts,
      tIda,
      tIV,
      groups: grps,
    })
  }

  if(jobs.length===0) return {troopsNeeded:0, cyclesStable:0, troopsByName:{}}

  const sim = runGroupSimulation(jobs, troopsByName, interval)
  const cyclesStable = sim.ok ? sim.cycles : Math.max(...jobs.map(job=>job.groups)) + 1

  return {
    troopsNeeded: Object.values(troopsByName).reduce((sum, qty)=>sum+qty, 0),
    cyclesStable,
    troopsByName,
    simulationSteps: sim.steps || [],
  }
}

function formatCountMap(counts){
  const entries = Object.entries(counts||{}).filter(([,qty])=>qty>0)
  if(!entries.length) return '<span class="sim-muted">Sin movimiento</span>'
  return entries
    .sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([name, qty])=>`<div class="sim-block-line"><strong>${name}</strong>: ${qty}</div>`)
    .join("")
}

function formatReturnedBlock(step){
  const lines = []
  if(step.returnedOasis && step.returnedOasis.length){
    lines.push(`<div class="sim-block-line"><strong>Oasis</strong>: ${step.returnedOasis.map(id=>`#${id}`).join(", ")}</div>`)
  }
  const countsHtml = formatCountMap(step.returnedCounts)
  lines.push(countsHtml.includes("sim-muted") ? countsHtml : `<div class="sim-block">${countsHtml}</div>`)
  return lines.join("")
}

function renderSimulationDetails(steps){
  const wrap = $("simulationDetail")
  const body = $("simulationRows")
  body.innerHTML = ""

  if(!steps || !steps.length){
    wrap.style.display = "none"
    return
  }

  wrap.style.display = "block"

  steps.forEach(step=>{
    const row = document.createElement("div")
    row.className = "sim-row"

    const stateClass = step.status === "stable" ? "stable" : step.status === "fail" ? "fail" : "progress"
    const stateLabel = step.status === "stable" ? "Estable" : step.status === "fail" ? "No alcanza" : "En progreso"
    row.innerHTML = [
      `<div class="sim-cell"><span class="sim-cycle">${step.cycle}</span></div>`,
      `<div class="sim-cell"><span class="sim-minute">${fmtTime(step.minute)}</span></div>`,
      `<div class="sim-cell left"><div class="sim-block">${formatReturnedBlock(step)}</div></div>`,
      `<div class="sim-cell left"><div class="sim-block">${formatCountMap(step.availableBefore)}</div></div>`,
      `<div class="sim-cell left"><div class="sim-block">${formatCountMap(step.sentCounts)}</div></div>`,
      `<div class="sim-cell left"><div class="sim-block">${formatCountMap(step.availableAfter)}</div></div>`,
      `<div class="sim-cell left"><div class="sim-block">${formatCountMap(step.inTransitAfter)}</div></div>`,
      `<div class="sim-cell"><div class="sim-block"><span class="sim-state ${stateClass}">${stateLabel}</span><span class="sim-block-line sim-muted">${step.note}</span></div></div>`,
    ].join("")

    body.appendChild(row)
  })
}

function calcOasis(oasis){
  const srv=currentSpeed(), interval=currentInterval()
  const active=oasis.troops.filter(t=>t.name&&t.qty>0)
  if(!active.length) return {slowName:"—",tIda:Infinity,tIV:Infinity,grps:0}
  const times=active.map(t=>({name:t.name,tMin:travelMin(oasis.dist,t.name,srv)}))
  const slowest=times.reduce((a,b)=>a.tMin>b.tMin?a:b)
  const tIda=slowest.tMin, tIV=tIda*2
  // grps individual (sin pool compartido, solo orientativo por fila)
  const grps = Math.max(1,Math.ceil(tIV/interval))
  return {slowName:slowest.name, tIda, tIV, grps}
}

function fillRaceSelect(){
  const sel=$("raceSelect")
  for(const r of Object.keys(TROOPS_BY_RACE)){
    const o=document.createElement("option"); o.value=r; o.textContent=r; sel.appendChild(o)
  }
  sel.value="HUNOS"
}

/* ══ PANEL DE IMPORT ══ */
function renderImportTroops(){
  const wrap=$("importTroops"); wrap.innerHTML=""
  const troops=troopsForRace(currentRace())

  importTroops.forEach((tr,idx)=>{
    if(!tr.name||!troops.includes(tr.name)) tr.name=troops[0]||""
    const row=document.createElement("div"); row.className="import-troop-row"
    const sel=document.createElement("select")
    troops.forEach(name=>{ const o=document.createElement("option"); o.value=name; o.textContent=name; sel.appendChild(o) })
    sel.value=tr.name
    sel.addEventListener("change",()=>{ tr.name=sel.value })
    const qty = document.createElement("input"); qty.type = "number"; qty.min = "1"; tr.qty = Math.max(1, Math.floor(n0(tr.qty) || 1));	qty.value = String(tr.qty); qty.placeholder="Cant"
    qty.addEventListener("input",()=>{ tr.qty=Math.max(1,Math.floor(n0(qty.value))) })
    const rm=document.createElement("button"); rm.className="btn-rm-troop"; rm.type="button"; rm.textContent="×"
    rm.addEventListener("click",()=>{ if(importTroops.length>1){ importTroops.splice(idx,1); renderImportTroops() } })
    row.appendChild(sel); row.appendChild(qty); row.appendChild(rm)
    wrap.appendChild(row)
  })

  if(importTroops.length<3){
    const addBtn=document.createElement("button"); addBtn.className="btn-add-troop-import"; addBtn.type="button"; addBtn.textContent="+ Añadir tropa"
    addBtn.addEventListener("click",()=>{ importTroops.push({name:troopsForRace(currentRace())[0]||"",qty:1}); renderImportTroops() })
    wrap.appendChild(addBtn)
  }
}

/* ══ PARSER ══ */
function parseOasisText(raw){
  const lines=raw.split("\n").map(l=>l.trim()).filter(l=>l.length>0)
  const distances=[]
  for(const line of lines){
    if(/oasis/i.test(line)){
      const m=line.match(/(\d+\.?\d*)$/)
      if(m){ const d=parseFloat(m[1]); if(d>0) distances.push(d) }
    }
  }
  return distances
}

/* ══ PROCESAR ══ */
function processGroup(){
  const raw=$("taImport").value
  const distances=parseOasisText(raw)
  if(distances.length===0){ alert("No se encontraron oasis en el texto."); return }

  const troopsCopy=importTroops.filter(t=>t.name&&t.qty>0).map(t=>({...t}))
  if(troopsCopy.length===0){ alert("Selecciona al menos una tropa con cantidad > 0."); return }

  distances.forEach(dist=>{
    oasisCounter++
    const oasis={id:oasisCounter, index:oasisCounter, dist, troops:troopsCopy.map(t=>({...t}))}
    oasisList.push(oasis)
    $("emptyState").style.display="none"
    $("oasisTableWrap").style.display="block"
    $("oasisTableBody").appendChild(renderRow(oasis))
  })

  recalcGlobal()
  $("taImport").value=""
}

/* ══ RENDER FILA ══ */
function renderRow(oasis){
  const {slowName,tIda,tIV,grps}=calcOasis(oasis)
  const row=document.createElement("div"); row.className="oasis-row"; row.id=`orow-${oasis.id}`

  /* # */
  const numD=document.createElement("div"); numD.className="oc"
  numD.innerHTML=`<span class="oc-num">#${oasis.index}</span>`
  row.appendChild(numD)

  /* Distancia — readonly */
  const distD=document.createElement("div"); distD.className="oc"
  distD.innerHTML=`<span class="oc-dist" id="dist-${oasis.id}">${oasis.dist}</span>`
  row.appendChild(distD)

  /* 3 slots tropa — readonly (solo texto, no inputs) */
  for(let i=0;i<3;i++){
    const tr=oasis.troops[i]
    /* nombre tropa */
    const nameD=document.createElement("div"); nameD.className="oc left"
    nameD.innerHTML=tr?`<span class="oc-troop-name">${tr.name}</span>`:""
    row.appendChild(nameD)
    /* cantidad */
    const qtyD=document.createElement("div"); qtyD.className="oc"
    qtyD.innerHTML=tr?`<span class="oc-troop-qty">${tr.qty}</span>`:""
    row.appendChild(qtyD)
  }

  /* Limitante */
  const slowD=document.createElement("div"); slowD.className="oc"
  slowD.innerHTML=`<span class="oc-slow" id="slow-${oasis.id}" title="${slowName}">${slowName}</span>`
  row.appendChild(slowD)

  /* Ida */
  const idaD=document.createElement("div"); idaD.className="oc"
  idaD.innerHTML=`<span class="oc-time" id="ida-${oasis.id}">${fmtTime(tIda)}</span>`
  row.appendChild(idaD)

  /* I+V */
  const ivD=document.createElement("div"); ivD.className="oc"
  ivD.innerHTML=`<span class="oc-time" id="iv-${oasis.id}">${fmtTime(tIV)}</span>`
  row.appendChild(ivD)

  /* Grupos (sin pool) */
  const grpD=document.createElement("div"); grpD.className="oc"
  grpD.innerHTML=`<span class="oc-needed${grps===0?" zero":""}" id="grp-${oasis.id}">${grps===0?"—":grps}</span>`
  row.appendChild(grpD)

  /* Eliminar */
  const delD=document.createElement("div"); delD.className="oc"
  const delBtn=document.createElement("button"); delBtn.className="btn-del"; delBtn.type="button"; delBtn.textContent="🗑"
  delBtn.addEventListener("click",()=>{ oasisList=oasisList.filter(o=>o.id!==oasis.id); row.remove(); checkEmpty(); recalcGlobal() })
  delD.appendChild(delBtn); row.appendChild(delD)

  return row
}

function recalcRow(id){
  const oasis=oasisList.find(o=>o.id===id); if(!oasis) return
  const {slowName,tIda,tIV,grps}=calcOasis(oasis)
  const sl=$(`slow-${id}`); if(sl){sl.textContent=slowName;sl.title=slowName}
  const id_=$(`ida-${id}`); if(id_) id_.textContent=fmtTime(tIda)
  const iv=$(`iv-${id}`);   if(iv)  iv.textContent=fmtTime(tIV)
  const gr=$(`grp-${id}`);  if(gr){gr.textContent=grps===0?"—":String(grps);gr.className="oc-needed"+(grps===0?" zero":"")}
}

function recalc(){ oasisList.forEach(o=>recalcRow(o.id)); recalcGlobal() }

/* ══ GLOBAL — muestra resultado de simulación con pool compartido ══ */
function recalcGlobal(){
  const grEl=$("globalResult"), list=$("globalTroopList")
  list.innerHTML=""

  if(!oasisList.length){ grEl.style.display="none"; renderSimulationDetails([]); return }

  const {troopsByName, cyclesStable, simulationSteps} = simulateSyncGroupPool()
  const entries=Object.entries(troopsByName).filter(([,v])=>v>0)
  if(!entries.length){ grEl.style.display="none"; renderSimulationDetails([]); return }

  grEl.style.display="block"

  /* chips de tropas */
  entries.sort((a,b)=>b[1]-a[1]).forEach(([name,qty])=>{
    const chip=document.createElement("div"); chip.className="gr-troop-chip"
    chip.innerHTML=`<span class="gr-troop-name">${name}</span><span class="gr-troop-qty">${qty}</span>`
    list.appendChild(chip)
  })

  /* info de ciclos */
  const cycleInfo=document.createElement("div"); cycleInfo.className="gr-cycles"
  cycleInfo.innerHTML=`<span class="gr-cycle-label">Estado estable en ciclo</span><span class="gr-cycle-num">${cyclesStable}</span><span class="gr-cycle-label">· cada ${currentInterval()} min</span>`
  list.appendChild(cycleInfo)
  renderSimulationDetails(simulationSteps)
}

function checkEmpty(){
  const empty=oasisList.length===0
  $("emptyState").style.display=empty?"block":"none"
  $("oasisTableWrap").style.display=empty?"none":"block"
  if(empty){
    $("globalResult").style.display="none"
    $("simulationDetail").style.display="none"
    $("simulationRows").innerHTML=""
  }
}

/* ══ INIT ══ */
function init(){
  fillRaceSelect()
  renderImportTroops()
  $("raceSelect").addEventListener("change",()=>{ renderImportTroops(); recalc() })
  $("serverSpeed").addEventListener("change", recalc)
  $("intervalMin").addEventListener("input",  recalc)
  $("btnProcess").addEventListener("click",   processGroup)
  $("btnClearAll").addEventListener("click",()=>{
    oasisList=[]; oasisCounter=0
    $("oasisTableBody").innerHTML=""
    checkEmpty()
  })
}

init()
