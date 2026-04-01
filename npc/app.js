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
let lastCopyValues = { wood:"", clay:"", iron:"", crop:"" }
let trainingVillages = []
let trainingCentralKey = ""
let trainingVillageId = 0

function showInitError(message){
  const status = $("statusLine")
  if(!status) return
  status.className = "statusline status-bad"
  status.textContent = message
}

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

function raceList(){
  return ["HUNOS","ROMANO","GERMANO","GALOS","EGIPTO"]
}

function getTroopsByRaceAndTipo(race, tipo){
  const arr = (CATALOG_TROOPS || []).filter(t => String(t.race || "").toUpperCase() === String(race).toUpperCase())
  if(tipo) return arr.filter(t => String(t.tipo_edificio || "").toUpperCase() === tipo)
  return arr
}

function getTroopByName(race, name){
  const arr = getTroopsByRaceAndTipo(race, null)
  return arr.find(t => String(t.name) === String(name)) || null
}

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

function getEffectiveSecondsForTroopConfig(race, troopName, cfg){
  const t = getTroopByName(race, troopName)
  if(!t) return 0

  const JSON_SPEED   = 3
  const serverSpeed  = Math.max(1, n0(cfg?.serverSpeed))

  const timeAtJson   = parseTimeToSec(t.time)
  const timeBase     = timeAtJson * JSON_SPEED
  const timeServer   = timeBase / serverSpeed

  const tipo = String(t.tipo_edificio || "").toUpperCase()

  let lvl = 1
  if(tipo === "C") lvl = Math.max(1, Math.min(20, Math.floor(n0(cfg?.lvlBarracks))))
  if(tipo === "E") lvl = Math.max(1, Math.min(20, Math.floor(n0(cfg?.lvlStable))))
  if(tipo === "T") lvl = Math.max(1, Math.min(20, Math.floor(n0(cfg?.lvlWorkshop))))

  const factorB = BUILDING_TIME_FACTOR[lvl] || 1.0
  const ally    = n0(cfg?.allyBonus)
  const trooper = n0(cfg?.trooperBoost)

  let helmet = 0
  if(tipo === "C") helmet = n0(cfg?.helmetBarracks)
  if(tipo === "E") helmet = n0(cfg?.helmetStable)

  const seconds = timeServer * factorB * (1 - ally) * (1 - trooper) * (1 - helmet)
  return Math.max(0, seconds)
}

function getEffectiveSecondsForTroop(race, troopName){
  return getEffectiveSecondsForTroopConfig(race, troopName, {
    serverSpeed: $("serverSpeed").value,
    lvlBarracks: $("lvlBarracks").value,
    lvlStable: $("lvlStable").value,
    lvlWorkshop: $("lvlWorkshop").value,
    allyBonus: $("allyBonus").value,
    trooperBoost: $("trooperBoost").value,
    helmetBarracks: $("helmetBarracks").value,
    helmetStable: $("helmetStable").value
  })
}

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
      timeSec: q.acc
    }))
  }
}

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
  const isTraining = m === "training"
  $("modeTimePanel").style.display  = m === "time"  ? "block" : "none"
  $("modeExactPanel").style.display = m === "exact" ? "block" : "none"
  $("modeTrainingPanel").style.display = isTraining ? "block" : "none"
  $("classicNpcWrap").style.display = isTraining ? "none" : "block"
  $("classicNpcSubtotal").style.display = isTraining ? "none" : "block"
  $("classicNpcTable").style.display = isTraining ? "none" : "table"
  $("toolRaceSelect").style.display = isTraining ? "none" : "flex"
  $("toolEqOrder").style.display = isTraining ? "none" : "flex"
  $("toolCurTotal").style.display = isTraining ? "none" : "flex"
  $("addRow").style.display = isTraining ? "none" : "inline-flex"
}

function setText(id, v){
  $(id).textContent = fmtInt(v)
}

function updateCopyButtons(values){
  const nextValues = values || { wood:"", clay:"", iron:"", crop:"" }
  const hasData = Object.values(nextValues).some(Boolean)
  lastCopyValues = { ...nextValues }

  const keys = ["wood","clay","iron","crop"]
  for(const key of keys){
    const btn = document.querySelector(`[data-copy-key="${key}"]`)
    if(!btn) continue
    btn.hidden = !hasData
    btn.disabled = !nextValues[key]
  }
}

async function copyNpcValue(ev){
  const key = ev?.currentTarget?.dataset?.copyKey
  const value = key ? lastCopyValues[key] : ""
  if(!value) return
  const status = $("statusLine")
  try{
    await navigator.clipboard.writeText(value)
    status.className = "statusline status-ok"
    status.textContent = `Valor copiado: ${fmtInt(value)}`
  }catch(err){
    console.error("[NPC] No se pudo copiar el valor", err)
    status.className = "statusline status-bad"
    status.textContent = "No se pudo copiar. Verifica permisos del portapapeles."
  }
}

function zeroResources(){
  return { wood:0, clay:0, iron:0, crop:0, total:0 }
}

function withResourceTotal(res){
  const next = {
    wood: Math.max(0, Math.floor(n0(res?.wood))),
    clay: Math.max(0, Math.floor(n0(res?.clay))),
    iron: Math.max(0, Math.floor(n0(res?.iron))),
    crop: Math.max(0, Math.floor(n0(res?.crop))),
    total: 0
  }
  next.total = next.wood + next.clay + next.iron + next.crop
  return next
}

function addResources(a, b){
  return withResourceTotal({
    wood: n0(a?.wood) + n0(b?.wood),
    clay: n0(a?.clay) + n0(b?.clay),
    iron: n0(a?.iron) + n0(b?.iron),
    crop: n0(a?.crop) + n0(b?.crop)
  })
}

function subtractResources(a, b){
  return withResourceTotal({
    wood: n0(a?.wood) - n0(b?.wood),
    clay: n0(a?.clay) - n0(b?.clay),
    iron: n0(a?.iron) - n0(b?.iron),
    crop: n0(a?.crop) - n0(b?.crop)
  })
}

function positiveDeficit(required, current){
  return withResourceTotal({
    wood: Math.max(0, n0(required?.wood) - n0(current?.wood)),
    clay: Math.max(0, n0(required?.clay) - n0(current?.clay)),
    iron: Math.max(0, n0(required?.iron) - n0(current?.iron)),
    crop: Math.max(0, n0(required?.crop) - n0(current?.crop))
  })
}

function hasEnoughResources(have, need){
  return n0(have?.wood) >= n0(need?.wood) &&
    n0(have?.clay) >= n0(need?.clay) &&
    n0(have?.iron) >= n0(need?.iron) &&
    n0(have?.crop) >= n0(need?.crop)
}

function normalizeVillageKey(name){
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function cleanTravianPaste(raw){
  return String(raw || "")
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[−–—]/g, "-")
    .replace(/\r/g, "")
}

function pasteLines(raw){
  return cleanTravianPaste(raw)
    .split("\n")
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
}

function parseNumberToken(token){
  const digits = String(token || "").replace(/[^\d]/g, "")
  return digits ? Number(digits) : NaN
}

function isIntegerToken(token){
  return /^\d[\d,.\s]*$/.test(String(token || "").trim())
}

function shouldStopTravianTable(line){
  return /^(Sum\b|Team_|Population:|Loyalty:|Villages\b|Village groups|Task overview|Homepage\b)/i.test(line)
}

function parseCapacityRow(line){
  const tokens = line.split(" ").filter(Boolean)
  const numericIdx = []
  for(let i=0; i<tokens.length; i++){
    if(isIntegerToken(tokens[i])) numericIdx.push(i)
  }
  if(numericIdx.length < 2) return null

  const firstNumeric = numericIdx[numericIdx.length - 2]
  const warehouse = parseNumberToken(tokens[firstNumeric])
  const granary = parseNumberToken(tokens[firstNumeric + 1])
  const name = tokens.slice(0, firstNumeric).join(" ").trim()

  if(!name || !Number.isFinite(warehouse) || !Number.isFinite(granary)) return null
  if(/^(Village|Warehouse|Granary|Resources|Production|Capacity)$/i.test(name)) return null
  if(/^Sum$/i.test(name)) return null

  return { name, key: normalizeVillageKey(name), warehouseCap: warehouse, granaryCap: granary }
}

function parseResourcesRow(line){
  const tokens = line.split(" ").filter(Boolean)
  if(tokens[tokens.length - 1] && /^\d+\/\d+$/.test(tokens[tokens.length - 1])) tokens.pop()

  const trailing = []
  for(let i=tokens.length - 1; i>=0; i--){
    if(isIntegerToken(tokens[i])) trailing.push(i)
    else break
  }
  if(trailing.length < 4) return null

  const firstNumeric = trailing[trailing.length - 4]
  const numbers = tokens.slice(firstNumeric, firstNumeric + 4).map(parseNumberToken)
  const name = tokens.slice(0, firstNumeric).join(" ").trim()

  if(!name || numbers.some(v => !Number.isFinite(v))) return null
  if(/^(Village|Resources|Warehouse|Production|Capacity|Merchants)$/i.test(name)) return null
  if(/^Sum$/i.test(name)) return null

  return {
    name,
    key: normalizeVillageKey(name),
    current: withResourceTotal({
      wood: numbers[0],
      clay: numbers[1],
      iron: numbers[2],
      crop: numbers[3]
    })
  }
}

function parseTravianTable(raw, rowParser){
  const lines = pasteLines(raw)
  const startIdx = lines.findIndex(line => /^Capacity$/i.test(line))
  const scoped = startIdx >= 0 ? lines.slice(startIdx + 1) : lines
  const rows = []
  const seen = new Set()

  for(const line of scoped){
    if(shouldStopTravianTable(line)) break
    const row = rowParser(line)
    if(!row || seen.has(row.key)) continue
    seen.add(row.key)
    rows.push(row)
  }

  return rows
}

function defaultTrainingVillage(data, previous){
  const base = previous ? { ...previous } : {
    id: ++trainingVillageId,
    race: "HUNOS",
    barracksTroop: "",
    barracksLvl: 1,
    stableTroop: "",
    stableLvl: 1,
    workshopTroop: "",
    workshopLvl: 1,
    allyBonus: 0,
    trooperBoost: 0,
    helmetBarracks: 0,
    helmetStable: 0
  }

  return {
    ...base,
    name: data.name,
    key: data.key,
    warehouseCap: Math.max(0, Math.floor(n0(data.warehouseCap))),
    granaryCap: Math.max(0, Math.floor(n0(data.granaryCap))),
    current: withResourceTotal(data.current)
  }
}

function importTrainingVillages(){
  const capacityRows = parseTravianTable($("trainingCapacityInput").value, parseCapacityRow)
  const resourceRows = parseTravianTable($("trainingResourcesInput").value, parseResourcesRow)
  const prevByKey = new Map(trainingVillages.map(v => [v.key, v]))
  const merged = []
  const resourceMap = new Map(resourceRows.map(r => [r.key, r]))

  for(const cap of capacityRows){
    const res = resourceMap.get(cap.key)
    if(!res) continue
    merged.push(defaultTrainingVillage({
      ...cap,
      current: res.current
    }, prevByKey.get(cap.key)))
  }

  merged.sort((a, b) => a.name.localeCompare(b.name, "es"))
  trainingVillages = merged

  const centralCandidates = getTrainingCentralCandidates()
  if(!trainingVillages.some(v => v.key === trainingCentralKey)){
    trainingCentralKey = centralCandidates[0]?.key || ""
  }

  const skippedCapacity = capacityRows.length - merged.length
  const skippedResources = resourceRows.filter(r => !merged.some(v => v.key === r.key)).length

  return {
    capacityCount: capacityRows.length,
    resourceCount: resourceRows.length,
    mergedCount: merged.length,
    skippedCapacity,
    skippedResources
  }
}

function getTrainingCentralCandidates(){
  return trainingVillages
    .slice()
    .sort((a, b) => {
      const byCurrent = n0(b.current?.total) - n0(a.current?.total)
      if(byCurrent) return byCurrent
      const capA = n0(a.warehouseCap) * 3 + n0(a.granaryCap)
      const capB = n0(b.warehouseCap) * 3 + n0(b.granaryCap)
      if(capB !== capA) return capB - capA
      return a.name.localeCompare(b.name, "es")
    })
}

function trainingQueueConfig(village){
  return {
    serverSpeed: $("serverSpeed").value,
    lvlBarracks: village.barracksLvl,
    lvlStable: village.stableLvl,
    lvlWorkshop: village.workshopLvl,
    allyBonus: village.allyBonus,
    trooperBoost: village.trooperBoost,
    helmetBarracks: village.helmetBarracks,
    helmetStable: village.helmetStable
  }
}

function buildTrainingQueues(village){
  const out = []
  const cfg = trainingQueueConfig(village)
  const defs = [
    { type:"C", field:"barracksTroop", label:"C" },
    { type:"E", field:"stableTroop", label:"E" },
    { type:"T", field:"workshopTroop", label:"T" }
  ]

  for(const def of defs){
    const troopName = String(village[def.field] || "")
    if(!troopName) continue
    const troop = getTroopByName(village.race, troopName)
    if(!troop || String(troop.tipo_edificio || "").toUpperCase() !== def.type) continue
    const secEach = getEffectiveSecondsForTroopConfig(village.race, troopName, cfg)
    if(secEach <= 0) continue
    out.push({
      key: def.field,
      label: def.label,
      troopName,
      secEach,
      cost: withResourceTotal(troop)
    })
  }

  return out
}

function getTrainingRequirement(village, targetSec){
  const queues = buildTrainingQueues(village)
  const need = zeroResources()
  const counts = []

  for(const queue of queues){
    const units = targetSec > 0 ? Math.ceil(targetSec / queue.secEach) : 0
    counts.push({ label: queue.label, troopName: queue.troopName, units })
    need.wood += queue.cost.wood * units
    need.clay += queue.cost.clay * units
    need.iron += queue.cost.iron * units
    need.crop += queue.cost.crop * units
  }

  const resources = withResourceTotal(need)
  const fitsCap = resources.wood <= village.warehouseCap &&
    resources.clay <= village.warehouseCap &&
    resources.iron <= village.warehouseCap &&
    resources.crop <= village.granaryCap

  return { queues, counts, resources, fitsCap }
}

function findVillageCurrentTime(village){
  const probe = getTrainingRequirement(village, 1)
  if(!probe.queues.length) return 0

  let lo = 0
  let hi = 3600
  const maxSec = 60 * 60 * 24 * 30

  while(hi < maxSec){
    const req = getTrainingRequirement(village, hi)
    if(!req.fitsCap || !hasEnoughResources(village.current, req.resources)) break
    lo = hi
    hi *= 2
  }

  hi = Math.min(hi, maxSec)

  while(lo < hi){
    const mid = Math.floor((lo + hi + 1) / 2)
    const req = getTrainingRequirement(village, mid)
    if(req.fitsCap && hasEnoughResources(village.current, req.resources)) lo = mid
    else hi = mid - 1
  }

  return lo
}

function evaluateTrainingTarget(targetSec){
  if(!trainingVillages.length) return { feasible:false, reason:"Importa aldeas primero." }

  const central = trainingVillages.find(v => v.key === trainingCentralKey)
  if(!central) return { feasible:false, reason:"Selecciona una aldea central." }

  const villagePlans = []
  let totalTransfer = zeroResources()
  let centralNeed = zeroResources()
  let activeQueues = 0

  for(const village of trainingVillages){
    const currentTime = findVillageCurrentTime(village)
    const req = getTrainingRequirement(village, targetSec)

    if(!req.queues.length){
      villagePlans.push({
        village,
        currentTime,
        required: zeroResources(),
        deficit: zeroResources(),
        counts: [],
        status: "Sin colas"
      })
      continue
    }

    activeQueues += req.queues.length

    if(!req.fitsCap){
      return { feasible:false, reason:`${village.name} no soporta ese tiempo por almacén/granero.` }
    }

    if(village.key === trainingCentralKey){
      centralNeed = req.resources
      if(!hasEnoughResources(village.current, req.resources)){
        return { feasible:false, reason:`${village.name} no alcanza para sostener su propia cola objetivo.` }
      }
      villagePlans.push({
        village,
        currentTime,
        required: req.resources,
        deficit: zeroResources(),
        counts: req.counts,
        status: "Central"
      })
      continue
    }

    const deficit = positiveDeficit(req.resources, village.current)
    totalTransfer = addResources(totalTransfer, deficit)
    villagePlans.push({
      village,
      currentTime,
      required: req.resources,
      deficit,
      counts: req.counts,
      status: deficit.total > 0 ? "NPC" : "Lista"
    })
  }

  if(activeQueues === 0){
    return { feasible:false, reason:"Configura al menos una cola de entrenamiento." }
  }

  const centralAvailable = subtractResources(central.current, centralNeed)
  if(!hasEnoughResources(centralAvailable, totalTransfer)){
    return { feasible:false, reason:"La aldea central no tiene recursos suficientes para cubrir el reparto." }
  }

  return {
    feasible: true,
    targetSec,
    villagePlans,
    totalTransfer,
    central,
    centralNeed,
    centralAvailable,
    activeQueues
  }
}

function findBestTrainingPlan(){
  const base = evaluateTrainingTarget(0)
  if(!base.feasible) return base

  let best = base
  let lo = 0
  let hi = 3600
  const maxSec = 60 * 60 * 24 * 30

  while(hi < maxSec){
    const probe = evaluateTrainingTarget(hi)
    if(!probe.feasible) break
    best = probe
    lo = hi
    hi *= 2
  }

  hi = Math.min(hi, maxSec)

  while(lo < hi){
    const mid = Math.floor((lo + hi + 1) / 2)
    const probe = evaluateTrainingTarget(mid)
    if(probe.feasible){
      best = probe
      lo = mid
    } else {
      hi = mid - 1
    }
  }

  return best
}

function trainingSelectOptions(values, withBlank){
  const opts = []
  if(withBlank) opts.push({ value:"", label:"—" })
  for(const item of values) opts.push({ value:item, label:item })
  return opts
}

function renderSelectControl(options, value, onChange, className){
  const sel = document.createElement("select")
  if(className) sel.className = className
  fillSelect(sel, options, false)
  sel.value = options.some(opt => opt.value === value) ? value : (options[0]?.value || "")
  sel.addEventListener("change", () => onChange(sel.value))
  return sel
}

function renderTrainingVillageTable(){
  const body = $("trainingVillageBody")
  const wrap = $("trainingTableWrap")
  body.innerHTML = ""

  if(!trainingVillages.length){
    wrap.style.display = "none"
    return
  }

  wrap.style.display = "block"

  const allyOpts = [
    { value:"0", label:"0%" }, { value:"0.02", label:"2%" }, { value:"0.04", label:"4%" },
    { value:"0.06", label:"6%" }, { value:"0.08", label:"8%" }, { value:"0.10", label:"10%" }
  ]
  const trooperOpts = [
    { value:"0", label:"0%" }, { value:"0.25", label:"25%" }, { value:"0.50", label:"50%" }
  ]
  const helmetOpts = [
    { value:"0", label:"0%" }, { value:"0.10", label:"10%" }, { value:"0.15", label:"15%" }, { value:"0.20", label:"20%" }
  ]
  const levelOpts = Array.from({ length: 20 }, (_, idx) => ({ value:String(idx + 1), label:String(idx + 1) }))

  for(const village of trainingVillages){
    const tr = document.createElement("tr")

    const raceOptions = raceList().map(r => ({ value:r, label:r }))
    const barracksOptions = trainingSelectOptions(getTroopsByRaceAndTipo(village.race, "C").map(t => String(t.name)).sort((a,b)=>a.localeCompare(b,"es")), true)
    const stableOptions = trainingSelectOptions(getTroopsByRaceAndTipo(village.race, "E").map(t => String(t.name)).sort((a,b)=>a.localeCompare(b,"es")), true)
    const workshopOptions = trainingSelectOptions(getTroopsByRaceAndTipo(village.race, "T").map(t => String(t.name)).sort((a,b)=>a.localeCompare(b,"es")), true)
    village.barracksTroop = barracksOptions.some(opt => opt.value === village.barracksTroop) ? village.barracksTroop : ""
    village.stableTroop = stableOptions.some(opt => opt.value === village.stableTroop) ? village.stableTroop : ""
    village.workshopTroop = workshopOptions.some(opt => opt.value === village.workshopTroop) ? village.workshopTroop : ""

    const readonlyCells = [
      { text:village.name, left:true },
      null,
      { text:fmtInt(village.current.wood), readonly:true },
      { text:fmtInt(village.current.clay), readonly:true },
      { text:fmtInt(village.current.iron), readonly:true },
      { text:fmtInt(village.current.crop), readonly:true },
      { text:fmtInt(village.warehouseCap), readonly:true },
      { text:fmtInt(village.granaryCap), readonly:true }
    ]

    readonlyCells.forEach((cell, idx) => {
      if(idx === 1){
        const td = document.createElement("td")
        td.appendChild(renderSelectControl(raceOptions, village.race, (next) => {
          village.race = next
          village.barracksTroop = ""
          village.stableTroop = ""
          village.workshopTroop = ""
          recalc()
        }, "training-select"))
        tr.appendChild(td)
        return
      }

      const td = document.createElement("td")
      td.textContent = cell.text
      if(cell.left) td.classList.add("left")
      if(cell.readonly) td.classList.add("readonly")
      tr.appendChild(td)
    })

    const controls = [
      {
        options: barracksOptions,
        value: village.barracksTroop,
        onChange: (next) => { village.barracksTroop = next; recalc() },
        className: "training-select"
      },
      {
        options: levelOpts,
        value: String(village.barracksLvl),
        onChange: (next) => { village.barracksLvl = Math.max(1, Math.floor(n0(next))); recalc() },
        className: "training-level-select"
      },
      {
        options: stableOptions,
        value: village.stableTroop,
        onChange: (next) => { village.stableTroop = next; recalc() },
        className: "training-select"
      },
      {
        options: levelOpts,
        value: String(village.stableLvl),
        onChange: (next) => { village.stableLvl = Math.max(1, Math.floor(n0(next))); recalc() },
        className: "training-level-select"
      },
      {
        options: workshopOptions,
        value: village.workshopTroop,
        onChange: (next) => { village.workshopTroop = next; recalc() },
        className: "training-select"
      },
      {
        options: levelOpts,
        value: String(village.workshopLvl),
        onChange: (next) => { village.workshopLvl = Math.max(1, Math.floor(n0(next))); recalc() },
        className: "training-level-select"
      },
      {
        options: allyOpts,
        value: String(village.allyBonus),
        onChange: (next) => { village.allyBonus = Number(next); recalc() },
        className: "training-level-select"
      },
      {
        options: trooperOpts,
        value: String(village.trooperBoost),
        onChange: (next) => { village.trooperBoost = Number(next); recalc() },
        className: "training-level-select"
      },
      {
        options: helmetOpts,
        value: String(village.helmetBarracks),
        onChange: (next) => { village.helmetBarracks = Number(next); recalc() },
        className: "training-level-select"
      },
      {
        options: helmetOpts,
        value: String(village.helmetStable),
        onChange: (next) => { village.helmetStable = Number(next); recalc() },
        className: "training-level-select"
      }
    ]

    for(const control of controls){
      const td = document.createElement("td")
      td.appendChild(renderSelectControl(control.options, control.value, control.onChange, control.className))
      tr.appendChild(td)
    }

    body.appendChild(tr)
  }
}

function updateTrainingCentralSelect(){
  const sel = $("trainingCentralVillage")
  const candidates = getTrainingCentralCandidates()
  const options = candidates.map(v => ({
    value: v.key,
    label: `${v.name} · ${fmtInt(v.current.total)}`
  }))

  fillSelect(sel, options, false)
  if(options.some(opt => opt.value === trainingCentralKey)) sel.value = trainingCentralKey
  else sel.value = options[0]?.value || ""
  trainingCentralKey = sel.value || ""

  const central = trainingVillages.find(v => v.key === trainingCentralKey)
  const meta = $("trainingCentralMeta")
  if(!central){
    meta.textContent = "Importa aldeas para elegir una central."
    return
  }

  meta.innerHTML = `
    <span><strong>Recursos:</strong> ${fmtInt(central.current.wood)} / ${fmtInt(central.current.clay)} / ${fmtInt(central.current.iron)} / ${fmtInt(central.current.crop)}</span>
    <span><strong>Capacidad:</strong> ${fmtInt(central.warehouseCap)} / ${fmtInt(central.granaryCap)}</span>
  `
}

function renderTrainingSummary(plan){
  const summary = $("trainingSummary")
  if(!trainingVillages.length){
    summary.style.display = "none"
    summary.innerHTML = ""
    return
  }

  const activeVillageCount = trainingVillages.filter(v => buildTrainingQueues(v).length > 0).length
  summary.style.display = "grid"
  summary.innerHTML = `
    <div class="training-summary-card">
      <div class="training-summary-label">Aldeas importadas</div>
      <div class="training-summary-value">${fmtInt(trainingVillages.length)}</div>
    </div>
    <div class="training-summary-card">
      <div class="training-summary-label">Aldeas activas</div>
      <div class="training-summary-value">${fmtInt(activeVillageCount)}</div>
    </div>
    <div class="training-summary-card">
      <div class="training-summary-label">Colas activas</div>
      <div class="training-summary-value">${fmtInt(plan?.activeQueues || 0)}</div>
    </div>
    <div class="training-summary-card">
      <div class="training-summary-label">Tiempo común</div>
      <div class="training-summary-value">${fmtTime(plan?.targetSec || 0)}</div>
    </div>
  `
}

function queueCountLabel(counts){
  const used = counts.filter(item => item.units > 0)
  if(!used.length) return "—"
  return used.map(item => `${item.label}:${fmtInt(item.units)}`).join(" · ")
}

function renderTrainingResult(plan){
  const wrap = $("trainingResultWrap")
  const body = $("trainingResultBody")

  if(!plan?.feasible){
    wrap.style.display = "none"
    body.innerHTML = ""
    return
  }

  wrap.style.display = "block"

  const centralRemaining = subtractResources(plan.centralAvailable, plan.totalTransfer)

  body.innerHTML = `
    <div class="training-result-meta">
      <div class="training-summary-card">
        <div class="training-summary-label">Aldea central</div>
        <div class="training-summary-value">${plan.central.name}</div>
      </div>
      <div class="training-summary-card">
        <div class="training-summary-label">Tiempo objetivo</div>
        <div class="training-summary-value">${fmtTime(plan.targetSec)}</div>
      </div>
      <div class="training-summary-card">
        <div class="training-summary-label">NPC total</div>
        <div class="training-summary-value">${fmtInt(plan.totalTransfer.total)}</div>
      </div>
      <div class="training-summary-card">
        <div class="training-summary-label">Central restante</div>
        <div class="training-summary-value">${fmtInt(centralRemaining.total)}</div>
      </div>
    </div>
    <table class="training-transfer-table">
      <thead>
        <tr>
          <th class="left">Aldea</th>
          <th>Estado</th>
          <th>Tiempo actual</th>
          <th>Tiempo objetivo</th>
          <th>Colas</th>
          <th>Madera</th>
          <th>Barro</th>
          <th>Hierro</th>
          <th>Cereal</th>
        </tr>
      </thead>
      <tbody>
        ${plan.villagePlans.map(item => `
          <tr>
            <td class="left">${item.village.name}</td>
            <td class="${item.status === "NPC" ? "training-status-warn" : "training-status-ok"}">${item.status}</td>
            <td>${fmtTime(item.currentTime)}</td>
            <td>${item.counts.length ? fmtTime(plan.targetSec) : "—"}</td>
            <td>${queueCountLabel(item.counts)}</td>
            <td>${fmtInt(item.deficit.wood)}</td>
            <td>${fmtInt(item.deficit.clay)}</td>
            <td>${fmtInt(item.deficit.iron)}</td>
            <td>${fmtInt(item.deficit.crop)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `
}

function recalcTrainingMode(){
  updateCopyButtons()
  updateTrainingCentralSelect()
  renderTrainingVillageTable()

  const importStatus = $("trainingImportStatus")

  if(!trainingVillages.length){
    importStatus.textContent = "Sin datos importados."
    renderTrainingSummary(null)
    renderTrainingResult(null)
    return
  }

  const plan = findBestTrainingPlan()
  renderTrainingSummary(plan.feasible ? plan : null)
  renderTrainingResult(plan.feasible ? plan : null)

  if(plan.feasible){
    importStatus.textContent = `Tiempo común: ${fmtTime(plan.targetSec)} · NPC total: ${fmtInt(plan.totalTransfer.total)} · Aldeas: ${fmtInt(trainingVillages.length)}`
  } else {
    importStatus.textContent = plan.reason
  }
}

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

  const headers = ["Cola / Tropa","Cantidad","Madera","Barro","Hierro","Cereal","Total","Tiempo cola"]
  for(const h of headers){
    const cell = document.createElement("div")
    cell.className = "tm-hdr" + (h === "Cola / Tropa" ? " tm-left" : "")
    cell.textContent = h
    grid.appendChild(cell)
  }

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

  const timeTot = document.createElement("div")
  timeTot.className = "tm-total tm-time"
  timeTot.textContent = fmtTime(maxSec)
  grid.appendChild(timeTot)

  wrap.appendChild(grid)

  const leftDiv = document.createElement("div")
  leftDiv.className = "tm-leftover"
  leftDiv.innerHTML = `Excedente restante (se distribuye equitativamente): <strong>${fmtInt(leftover)}</strong>`
  wrap.appendChild(leftDiv)
}

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

  if($("excessMode").value === "training"){
    recalcTrainingMode()
    return
  }

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
    updateCopyButtons()
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

  const copyValues = {
    wood: fmtInt(sum.wood + dist.wood),
    clay: fmtInt(sum.clay + dist.clay),
    iron: fmtInt(sum.iron + dist.iron),
    crop: fmtInt(sum.crop + dist.crop)
  }
  const hasCopyData = Object.values(copyValues).some(v => Math.floor(n0(v)) > 0)
  updateCopyButtons(hasCopyData ? copyValues : undefined)
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

  const buildNames = Object.keys((CATALOG_BUILD && CATALOG_BUILD.buildings) || {}).sort((a,b)=>a.localeCompare(b,"es"))
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
    selName.addEventListener("change", () => { r.name = selName.value; updateRowCells(); recalc() })
    tdName.appendChild(selName)
    tr.appendChild(tdName)

    const tdCant  = document.createElement("td")
    const inpCant = makeNumInput(r.cant, 1)
    inpCant.addEventListener("input", ()=>{ r.cant = Math.max(1, Math.floor(n0(inpCant.value))); updateRowCells(); recalc() })
    tdCant.appendChild(inpCant)
    tr.appendChild(tdCant)

    const tdIni  = document.createElement("td")
    const inpIni = makeNumInput(r.ini, 0)
    inpIni.disabled = r.tipo !== "EDIFICIO"
    inpIni.addEventListener("input", ()=>{ r.ini = Math.max(0, Math.floor(n0(inpIni.value))); updateRowCells(); recalc() })
    tdIni.appendChild(inpIni)
    tr.appendChild(tdIni)

    const tdFin  = document.createElement("td")
    const inpFin = makeNumInput(r.fin, 0)
    inpFin.disabled = r.tipo !== "EDIFICIO"
    inpFin.addEventListener("input", ()=>{ r.fin = Math.max(0, Math.floor(n0(inpFin.value))); updateRowCells(); recalc() })
    tdFin.appendChild(inpFin)
    tr.appendChild(tdFin)

    const t = lineTotals[idx] || {wood:0,clay:0,iron:0,crop:0,total:0}
    const cellW = makeCell(fmtInt(t.wood))
    const cellC = makeCell(fmtInt(t.clay))
    const cellI = makeCell(fmtInt(t.iron))
    const cellP = makeCell(fmtInt(t.crop))
    const cellT = makeCell(fmtInt(t.total))
    tr.appendChild(cellW)
    tr.appendChild(cellC)
    tr.appendChild(cellI)
    tr.appendChild(cellP)
    tr.appendChild(cellT)

    function updateRowCells(){
      const race = $("raceSelect").value || "HUNOS"
      let cost = {wood:0,clay:0,iron:0,crop:0,total:0}
      if(r.tipo === "EDIFICIO"){
        const x = getBuildRowCost(race, r.name, r.ini, r.fin, r.cant)
        if(x) cost = x
      } else {
        const x = getTroopRowCost(race, r.name, r.cant)
        if(x) cost = x
      }
      cellW.textContent = fmtInt(cost.wood)
      cellC.textContent = fmtInt(cost.clay)
      cellI.textContent = fmtInt(cost.iron)
      cellP.textContent = fmtInt(cost.crop)
      cellT.textContent = fmtInt(cost.total)
    }

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

function addRowDefault(){
  const buildNames = Object.keys((CATALOG_BUILD && CATALOG_BUILD.buildings) || {}).sort((a,b)=>a.localeCompare(b,"es"))
  rowsState.push({tipo:"EDIFICIO", name: buildNames[0] || "", cant:1, ini:0, fin:1})
  renderRows()
}

async function loadCatalogs(){
  async function fetchJson(url){
    const resp = await fetch(url, { cache: "no-store" })
    if(!resp.ok) throw new Error(`HTTP ${resp.status} al cargar ${url}`)
    return resp.json()
  }

  const [b,t] = await Promise.all([
    fetchJson("./catalogo_edificios.json"),
    fetchJson("./catalogo_tropas.json")
  ])

  // Soporta formato nuevo (array) y viejo ({version, buildings:{...}})
  if(Array.isArray(b)){
    // Formato nuevo: [{nombre, niveles:[{nivel,madera,barro,hierro,cereal,total}]}]
    // Convertir al formato interno que usa el código: {buildings:{NOMBRE:{max,costs:[[m,b,h,c]]}}}
    const buildings = {}
    for(const ed of b){
      const nombre = String(ed.nombre || ed.name || "").trim()
      if(!nombre) continue
      const niveles = ed.niveles || ed.levels || []
      buildings[nombre] = {
        max: niveles.length,
        costs: niveles
          .slice()
          .sort((a,z) => (a.nivel||0) - (z.nivel||0))
          .map(n => [
            n.madera ?? n.wood ?? 0,
            n.barro  ?? n.clay ?? 0,
            n.hierro ?? n.iron ?? 0,
            n.cereal ?? n.crop ?? 0
          ])
      }
    }
    CATALOG_BUILD = { version: 2, buildings }
  } else {
    // Formato viejo: {version, buildings:{NOMBRE:{max,costs:[...]}}}
    CATALOG_BUILD = b
  }

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
  updateModePanels()
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
  $("serverSpeed").addEventListener("change",    recalc)

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
  const importBtn = $("btnImportTraining")
  if(importBtn){
    importBtn.addEventListener("click", () => {
      const info = importTrainingVillages()
      if(info.mergedCount > 0){
        $("trainingImportStatus").textContent = `Capacidad: ${fmtInt(info.capacityCount)} · Recursos: ${fmtInt(info.resourceCount)} · Cruce válido: ${fmtInt(info.mergedCount)}`
      } else {
        $("trainingImportStatus").textContent = "No se encontraron aldeas válidas al cruzar ambos pegados."
      }
      recalc()
    })
  }
  const centralVillageSel = $("trainingCentralVillage")
  if(centralVillageSel){
    centralVillageSel.addEventListener("change", () => {
      trainingCentralKey = $("trainingCentralVillage").value || ""
      recalc()
    })
  }
  $("copyWood").addEventListener("click", copyNpcValue)
  $("copyClay").addEventListener("click", copyNpcValue)
  $("copyIron").addEventListener("click", copyNpcValue)
  $("copyCrop").addEventListener("click", copyNpcValue)

  $("addRow").addEventListener("click", addRowDefault)

  updateTroopSelectsForRace()

  rowsState = []
  renderRows()
  recalc()
}

init().catch((err) => {
  console.error("[NPC] Fallo de inicializacion", err)
  showInitError("Error cargando catalogos. Verifica los JSON y recarga la pagina.")
})
