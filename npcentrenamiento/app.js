const $ = (id) => document.getElementById(id)

const BUILDING_TIME_FACTOR = [
  0,
  1.0, 0.9, 0.81, 0.729, 0.656, 0.59, 0.531, 0.478, 0.43, 0.387,
  0.349, 0.314, 0.282, 0.254, 0.229, 0.206, 0.185, 0.167, 0.15, 0.135
]

let CATALOG_TROOPS = null
let allVillages = []
let trainingVillages = []
let trainingCentralKey = ""
let trainingVillageId = 0
let trainingLastImportSummary = "Sin datos importados."
let trainingLastRenderedPlan = null
let trainingSplitModeByVillage = {}
const trainingGlobalConfig = {
  allianceBonus: 0,
  trooperEnabled: false,
  trooperBoost: 0,
  helmetEnabled: false,
  helmetBarracks: 0,
  helmetStable: 0
}
const TRAINING_RACE_PREFIX = {
  GA: "GALOS",
  GE: "GERMANO",
  R: "ROMANO",
  E: "EGIPTO",
  S: "ESPARTANO",
  H: "HUNOS"
}
const RESOURCE_KEYS = ["wood", "clay", "iron", "crop"]

function fixCommonMojibake(text){
  return String(text || "")
    .replace(/Ã¡/g, "a")
    .replace(/Ã©/g, "e")
    .replace(/Ã­/g, "i")
    .replace(/Ã³/g, "o")
    .replace(/Ãº/g, "u")
    .replace(/Ã±/g, "n")
    .replace(/ÃÁ/g, "A")
    .replace(/Ã‰/g, "E")
    .replace(/ÃÍ/g, "I")
    .replace(/Ã“/g, "O")
    .replace(/Ãš/g, "U")
    .replace(/Ã‘/g, "N")
}

function n0(v){
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function fmtInt(n){
  return String(Math.max(0, Math.floor(n0(n))))
}

function fmtTime(sec){
  const s = Math.max(0, Math.floor(n0(sec)))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0") + ":" + String(ss).padStart(2, "0")
}

function parseTimeToSec(s){
  const t = String(s || "").trim()
  const m = t.match(/^(\d+):(\d{2}):(\d{2})$/)
  if(!m) return 0
  return n0(m[1]) * 3600 + n0(m[2]) * 60 + n0(m[3])
}

function showStatus(message, type){
  const status = $("statusLine")
  status.className = "statusline"
  if(type === "ok") status.classList.add("status-ok")
  if(type === "bad") status.classList.add("status-bad")
  status.textContent = message
}

function clearSelect(sel){
  while(sel.firstChild) sel.removeChild(sel.firstChild)
}

function fillSelect(sel, items, keep){
  const prev = keep ? sel.value : ""
  clearSelect(sel)
  for(const item of items){
    const opt = document.createElement("option")
    opt.value = item.value
    opt.textContent = item.label
    sel.appendChild(opt)
  }
  if(keep && prev && items.some(item => item.value === prev)) sel.value = prev
  if(!sel.value && sel.options.length) sel.value = sel.options[0].value
}

function raceList(){
  return ["HUNOS", "ROMANO", "GERMANO", "GALOS", "EGIPTO", "ESPARTANO"]
}

function parseVillageTrainingTag(name){
  const displayName = cleanVillageNameText(name)
  const match = displayName.match(/^F(?:\s*[:\-]\s*|\s*)(GA|GE|R|E|S|H)(?:\s*[:\-]\s*|\s+)(.+)$/i)
  if(!match){
    return {
      displayName,
      isTraining: false,
      race: "",
      raceSupported: true
    }
  }

  const prefix = String(match[1] || "").toUpperCase()
  const baseName = cleanVillageNameText(match[2] || "")
  const race = TRAINING_RACE_PREFIX[prefix] || ""
  return {
    displayName: baseName || displayName,
    isTraining: Boolean(baseName && race),
    race,
    raceSupported: raceList().includes(race)
  }
}

function getTroopsByRaceAndTipo(race, tipo){
  const items = (CATALOG_TROOPS || []).filter(t => String(t.race || "").toUpperCase() === String(race).toUpperCase())
  if(tipo) return items.filter(t => String(t.tipo_edificio || "").toUpperCase() === tipo)
  return items
}

function getTroopByName(race, name){
  return getTroopsByRaceAndTipo(race, null).find(t => String(t.name) === String(name)) || null
}

function getEffectiveSecondsForTroopConfig(race, troopName, cfg){
  const t = getTroopByName(race, troopName)
  if(!t) return 0

  const serverSpeed = Math.max(1, n0(cfg?.serverSpeed))
  const jsonSpeed = 3
  const timeAtJson = parseTimeToSec(t.time)
  const timeBase = timeAtJson * jsonSpeed
  const timeServer = timeBase / serverSpeed

  const tipo = String(t.tipo_edificio || "").toUpperCase()
  let lvl = 1
  if(tipo === "C") lvl = Math.max(1, Math.min(20, Math.floor(n0(cfg?.lvlBarracks))))
  if(tipo === "E") lvl = Math.max(1, Math.min(20, Math.floor(n0(cfg?.lvlStable))))
  if(tipo === "T") lvl = Math.max(1, Math.min(20, Math.floor(n0(cfg?.lvlWorkshop))))

  const ally = n0(cfg?.allyBonus)
  const trooper = n0(cfg?.trooperBoost)
  let helmet = 0
  if(tipo === "C") helmet = n0(cfg?.helmetBarracks)
  if(tipo === "E") helmet = n0(cfg?.helmetStable)

  const factor = BUILDING_TIME_FACTOR[lvl] || 1
  return Math.max(0, timeServer * factor * (1 - ally) * (1 - trooper) * (1 - helmet))
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

function getEffectiveTrainingVillages(){
  return trainingVillages.filter(v => v.key !== trainingCentralKey)
}

function getResourceSurplus(current, required){
  return withResourceTotal({
    wood: Math.max(0, n0(current?.wood) - n0(required?.wood)),
    clay: Math.max(0, n0(current?.clay) - n0(required?.clay)),
    iron: Math.max(0, n0(current?.iron) - n0(required?.iron)),
    crop: Math.max(0, n0(current?.crop) - n0(required?.crop))
  })
}

function normalizeVillageKey(name){
  return fixCommonMojibake(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function cleanVillageNameText(text){
  const tokens = fixCommonMojibake(text)
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map(token => {
      const cleaned = token.replace(/[^\p{Script=Latin}\d._()|'-]/gu, "")
      if(!cleaned) return ""
      if(cleaned === token) return cleaned
      if(cleaned.length > 1 || /\d/.test(cleaned) || /^[A-Za-z][:\-]*$/u.test(token)) return cleaned
      return ""
    })
    .filter(Boolean)

  return tokens.join(" ").trim()
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

function findTableStart(lines, type){
  for(let i = 0; i < lines.length; i++){
    const line = lines[i]
    if(type === "capacity" && /^Village\s+Warehouse\s+Granary$/i.test(line)) return i + 1
    if(type === "resources" && /^Village(?:\s+.+)?\s+Merchants$/i.test(line)) return i + 1
  }

  for(let i = 0; i < lines.length; i++){
    if(type === "capacity" && /^Capacity$/i.test(lines[i])) return i + 1
    if(type === "resources" && /^Capacity$/i.test(lines[i])) return i + 1
  }

  return 0
}

function parseCapacityRow(line){
  const matches = [...String(line || "").matchAll(/\d[\d,.]*/g)]
  if(matches.length < 2) return null

  const warehouseMatch = matches[matches.length - 2]
  const granaryMatch = matches[matches.length - 1]
  const warehouse = parseNumberToken(warehouseMatch[0])
  const granary = parseNumberToken(granaryMatch[0])
  const name = cleanVillageNameText(String(line || "").slice(0, warehouseMatch.index))

  if(!name || !Number.isFinite(warehouse) || !Number.isFinite(granary)) return null
  if(/^(Village|Warehouse|Granary|Resources|Production|Capacity)$/i.test(name)) return null
  if(/^Sum$/i.test(name)) return null

  return { name, key: normalizeVillageKey(name), warehouseCap: warehouse, granaryCap: granary }
}

function parseResourcesRow(line){
  const matches = [...String(line || "").matchAll(/\d[\d,.]*/g)]
  if(matches.length < 4) return null

  const merchantTail = /\/\D*\d[\d,.]*\D*$/i.test(String(line || ""))
  const resourceMatches = merchantTail ? matches.slice(-6, -2) : matches.slice(-4)
  if(resourceMatches.length < 4) return null

  const numbers = resourceMatches.map(match => parseNumberToken(match[0]))
  const name = cleanVillageNameText(String(line || "").slice(0, resourceMatches[0].index))

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

function parseTravianTable(raw, rowParser, type){
  const lines = pasteLines(raw)
  const startIdx = findTableStart(lines, type)
  const scoped = lines.slice(startIdx)
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
  const tag = parseVillageTrainingTag(data.name)
  const base = previous ? { ...previous } : {
    id: ++trainingVillageId,
    race: tag.race || "HUNOS",
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
    name: tag.displayName,
    key: data.key,
    warehouseCap: Math.max(0, Math.floor(n0(data.warehouseCap))),
    granaryCap: Math.max(0, Math.floor(n0(data.granaryCap))),
    current: withResourceTotal(data.current),
    hasResources: Boolean(data.hasResources),
    isTraining: tag.isTraining,
    race: tag.race || base.race,
    raceSupported: tag.raceSupported
  }
}

function getTrainingCentralCandidates(){
  return allVillages
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

function importTrainingVillages(){
  const capacityRows = parseTravianTable($("trainingCapacityInput").value, parseCapacityRow, "capacity")
  const resourceRows = parseTravianTable($("trainingResourcesInput").value, parseResourcesRow, "resources")
  const prevByKey = new Map(allVillages.map(v => [v.key, v]))
  const resourceMap = new Map(resourceRows.map(r => [r.key, r]))
  const merged = []

  for(const cap of capacityRows){
    const res = resourceMap.get(cap.key)
    merged.push(defaultTrainingVillage({
      ...cap,
      current: res ? res.current : zeroResources(),
      hasResources: Boolean(res)
    }, prevByKey.get(cap.key)))
  }

  merged.sort((a, b) => a.name.localeCompare(b.name, "es"))
  allVillages = merged
  trainingVillages = merged.filter(v => v.isTraining)

  const candidates = getTrainingCentralCandidates()
  if(!allVillages.some(v => v.key === trainingCentralKey)){
    trainingCentralKey = candidates[0]?.key || ""
  }

  return {
    capacityCount: capacityRows.length,
    resourceCount: resourceRows.length,
    mergedCount: merged.length,
    matchedCount: merged.filter(v => v.hasResources).length,
    missingResourceCount: merged.filter(v => !v.hasResources).length,
    trainingCount: trainingVillages.length
  }
}

function trainingQueueConfig(village){
  return {
    serverSpeed: $("serverSpeed").value,
    lvlBarracks: village.barracksLvl,
    lvlStable: village.stableLvl,
    lvlWorkshop: village.workshopLvl,
    allyBonus: trainingGlobalConfig.allianceBonus,
    trooperBoost: trainingGlobalConfig.trooperEnabled ? trainingGlobalConfig.trooperBoost : village.trooperBoost,
    helmetBarracks: trainingGlobalConfig.helmetEnabled ? trainingGlobalConfig.helmetBarracks : village.helmetBarracks,
    helmetStable: trainingGlobalConfig.helmetEnabled ? trainingGlobalConfig.helmetStable : village.helmetStable
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
  const required = zeroResources()
  const counts = []

  for(const queue of queues){
    const units = targetSec > 0 ? Math.ceil(targetSec / queue.secEach) : 0
    counts.push({ label: queue.label, troopName: queue.troopName, units })
    required.wood += queue.cost.wood * units
    required.clay += queue.cost.clay * units
    required.iron += queue.cost.iron * units
    required.crop += queue.cost.crop * units
  }

  const resources = withResourceTotal(required)
  return { queues, counts, resources }
}

function findVillageCurrentTime(village){
  const probe = getTrainingRequirement(village, 1)
  if(!probe.queues.length) return 0

  let lo = 0
  let hi = 3600
  const maxSec = 60 * 60 * 24 * 30

  while(hi < maxSec){
    const req = getTrainingRequirement(village, hi)
    if(!hasEnoughResources(village.current, req.resources)) break
    lo = hi
    hi *= 2
  }

  hi = Math.min(hi, maxSec)

  while(lo < hi){
    const mid = Math.floor((lo + hi + 1) / 2)
    const req = getTrainingRequirement(village, mid)
    if(hasEnoughResources(village.current, req.resources)) lo = mid
    else hi = mid - 1
  }

  return lo
}

function evaluateTrainingTarget(targetSec){
  const activeVillages = getEffectiveTrainingVillages()
  if(!activeVillages.length) return { feasible:false, reason:"Importa aldeas primero." }

  const central = allVillages.find(v => v.key === trainingCentralKey)
  if(!central) return { feasible:false, reason:"Selecciona una aldea central." }

  const plans = []
  let activeQueues = 0

  for(const village of activeVillages){
    const currentTime = findVillageCurrentTime(village)
    const req = getTrainingRequirement(village, targetSec)

    if(!req.queues.length){
      plans.push({
        village,
        currentTime,
        required: zeroResources(),
        deficit: zeroResources(),
        deficitBeforeVillageSupport: zeroResources(),
        surplus: zeroResources(),
        supportFromVillages: zeroResources(),
        supportFromCentral: zeroResources(),
        counts: [],
        status: "Sin colas"
      })
      continue
    }

    activeQueues += req.queues.length
    plans.push({
      village,
      currentTime,
      required: req.resources,
      deficit: zeroResources(),
      deficitBeforeVillageSupport: positiveDeficit(req.resources, village.current),
      surplus: getResourceSurplus(village.current, req.resources),
      supportFromVillages: zeroResources(),
      supportFromCentral: zeroResources(),
      counts: req.counts,
      status: "Lista"
    })
  }

  if(activeQueues === 0){
    return { feasible:false, reason:"Configura al menos una cola de entrenamiento." }
  }

  const villageTransfers = []
  for(const resource of RESOURCE_KEYS){
    const donors = plans
      .filter(item => n0(item.surplus?.[resource]) > 0)
      .sort((a, b) => n0(b.surplus?.[resource]) - n0(a.surplus?.[resource]))
    const receivers = plans
      .filter(item => n0(item.deficitBeforeVillageSupport?.[resource]) > 0)
      .sort((a, b) => n0(b.deficitBeforeVillageSupport?.[resource]) - n0(a.deficitBeforeVillageSupport?.[resource]))

    for(const receiver of receivers){
      let missing = n0(receiver.deficitBeforeVillageSupport?.[resource])
      for(const donor of donors){
        if(donor.village.key === receiver.village.key || missing <= 0) continue
        const available = n0(donor.surplus?.[resource])
        if(available <= 0) continue
        const amount = Math.min(available, missing)
        donor.surplus[resource] -= amount
        donor.surplus = withResourceTotal(donor.surplus)
        receiver.deficitBeforeVillageSupport[resource] -= amount
        receiver.deficitBeforeVillageSupport = withResourceTotal(receiver.deficitBeforeVillageSupport)
        receiver.supportFromVillages[resource] += amount
        receiver.supportFromVillages = withResourceTotal(receiver.supportFromVillages)
        villageTransfers.push({
          from: donor.village.name,
          to: receiver.village.name,
          resource,
          amount
        })
        missing -= amount
      }
    }
  }

  let centralNpcNeed = zeroResources()
  for(const plan of plans){
    plan.supportFromCentral = withResourceTotal(plan.deficitBeforeVillageSupport)
    plan.deficit = withResourceTotal(plan.deficitBeforeVillageSupport)
    centralNpcNeed = addResources(centralNpcNeed, plan.supportFromCentral)
    if(plan.supportFromCentral.total > 0) plan.status = "NPC"
    else if(plan.supportFromVillages.total > 0) plan.status = "Envio"
    else if(plan.counts.length) plan.status = "Lista"
  }

  if(n0(central.current?.total) < n0(centralNpcNeed.total)){
    return { feasible:false, reason:"La aldea central no tiene total suficiente para cubrir el reparto NPC." }
  }

  return {
    feasible: true,
    targetSec,
    villagePlans: plans,
    totalTransfer: centralNpcNeed,
    villageTransfers,
    central,
    centralAvailable: withResourceTotal(central.current),
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
  if(withBlank) opts.push({ value:"", label:"-" })
  for(const value of values) opts.push({ value, label:value })
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

function refreshGlobalTrainingControls(){
  $("globalTrooperWrap").style.display = trainingGlobalConfig.trooperEnabled ? "" : "none"
  $("globalHelmetBarracksWrap").style.display = trainingGlobalConfig.helmetEnabled ? "" : "none"
  $("globalHelmetStableWrap").style.display = trainingGlobalConfig.helmetEnabled ? "" : "none"
}

function syncGlobalTrainingConfigFromDom(){
  trainingGlobalConfig.allianceBonus = Number($("globalAllianceBonus")?.value || 0)
  trainingGlobalConfig.trooperEnabled = Boolean($("globalTrooperEnabled")?.checked)
  trainingGlobalConfig.trooperBoost = Number($("globalTrooperBoost")?.value || 0)
  trainingGlobalConfig.helmetEnabled = Boolean($("globalHelmetEnabled")?.checked)
  trainingGlobalConfig.helmetBarracks = Number($("globalHelmetBarracks")?.value || 0)
  trainingGlobalConfig.helmetStable = Number($("globalHelmetStable")?.value || 0)
}

function renderTrainingHeader(){
  const row = $("trainingHeaderRow")
  if(!row) return

  const headers = [
    { label:"Aldea", left:true },
    { label:"Raza" },
    { label:"Madera" },
    { label:"Barro" },
    { label:"Hierro" },
    { label:"Cereal" },
    { label:"Almacen" },
    { label:"Granero" },
    { label:"Cuartel" },
    { label:"Nv C" },
    { label:"Establo" },
    { label:"Nv E" },
    { label:"Taller" },
    { label:"Nv T" }
  ]

  if(!trainingGlobalConfig.trooperEnabled) headers.push({ label:"Tropero" })
  if(!trainingGlobalConfig.helmetEnabled){
    headers.push({ label:"Casco C" })
    headers.push({ label:"Casco E" })
  }

  row.innerHTML = headers.map(item => `<th${item.left ? ' class="left"' : ""}>${item.label}</th>`).join("")
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

  const central = allVillages.find(v => v.key === trainingCentralKey)
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

function renderTrainingVillageTable(){
  const body = $("trainingVillageBody")
  const wrap = $("trainingTableWrap")
  body.innerHTML = ""
  renderTrainingHeader()
  const activeVillages = getEffectiveTrainingVillages()

  if(!activeVillages.length){
    wrap.style.display = "none"
    return
  }

  wrap.style.display = "block"

  const trooperOpts = [
    { value:"0", label:"0%" }, { value:"0.25", label:"25%" }, { value:"0.50", label:"50%" }
  ]
  const helmetOpts = [
    { value:"0", label:"0%" }, { value:"0.10", label:"10%" }, { value:"0.15", label:"15%" }, { value:"0.20", label:"20%" }
  ]
  const levelOpts = Array.from({ length: 20 }, (_, idx) => ({ value:String(idx + 1), label:String(idx + 1) }))

  for(const village of activeVillages){
    const tr = document.createElement("tr")
    const barracksOptions = trainingSelectOptions(getTroopsByRaceAndTipo(village.race, "C").map(t => String(t.name)).sort((a, b) => a.localeCompare(b, "es")), true)
    const stableOptions = trainingSelectOptions(getTroopsByRaceAndTipo(village.race, "E").map(t => String(t.name)).sort((a, b) => a.localeCompare(b, "es")), true)
    const workshopOptions = trainingSelectOptions(getTroopsByRaceAndTipo(village.race, "T").map(t => String(t.name)).sort((a, b) => a.localeCompare(b, "es")), true)

    village.barracksTroop = barracksOptions.some(opt => opt.value === village.barracksTroop) ? village.barracksTroop : ""
    village.stableTroop = stableOptions.some(opt => opt.value === village.stableTroop) ? village.stableTroop : ""
    village.workshopTroop = workshopOptions.some(opt => opt.value === village.workshopTroop) ? village.workshopTroop : ""

    const fixedCells = [
      { text: village.name, left: true },
      null,
      { text: fmtInt(village.current.wood), readonly: true },
      { text: fmtInt(village.current.clay), readonly: true },
      { text: fmtInt(village.current.iron), readonly: true },
      { text: fmtInt(village.current.crop), readonly: true },
      { text: fmtInt(village.warehouseCap), readonly: true },
      { text: fmtInt(village.granaryCap), readonly: true }
    ]

    fixedCells.forEach((cell, idx) => {
      if(idx === 1){
        const td = document.createElement("td")
        td.textContent = village.raceSupported ? village.race : `${village.race} (sin catalogo)`
        td.classList.add("readonly")
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
      { options: barracksOptions, value: village.barracksTroop, onChange: (next) => { village.barracksTroop = next; recalc() }, className: "training-select" },
      { options: levelOpts, value: String(village.barracksLvl), onChange: (next) => { village.barracksLvl = Math.max(1, Math.floor(n0(next))); recalc() }, className: "training-level-select" },
      { options: stableOptions, value: village.stableTroop, onChange: (next) => { village.stableTroop = next; recalc() }, className: "training-select" },
      { options: levelOpts, value: String(village.stableLvl), onChange: (next) => { village.stableLvl = Math.max(1, Math.floor(n0(next))); recalc() }, className: "training-level-select" },
      { options: workshopOptions, value: village.workshopTroop, onChange: (next) => { village.workshopTroop = next; recalc() }, className: "training-select" },
      { options: levelOpts, value: String(village.workshopLvl), onChange: (next) => { village.workshopLvl = Math.max(1, Math.floor(n0(next))); recalc() }, className: "training-level-select" }
    ]

    if(!trainingGlobalConfig.trooperEnabled){
      controls.push({ options: trooperOpts, value: String(village.trooperBoost), onChange: (next) => { village.trooperBoost = Number(next); recalc() }, className: "training-level-select" })
    }

    if(!trainingGlobalConfig.helmetEnabled){
      controls.push({ options: helmetOpts, value: String(village.helmetBarracks), onChange: (next) => { village.helmetBarracks = Number(next); recalc() }, className: "training-level-select" })
      controls.push({ options: helmetOpts, value: String(village.helmetStable), onChange: (next) => { village.helmetStable = Number(next); recalc() }, className: "training-level-select" })
    }

    for(const control of controls){
      const td = document.createElement("td")
      td.appendChild(renderSelectControl(control.options, control.value, control.onChange, control.className))
      tr.appendChild(td)
    }

    body.appendChild(tr)
  }
}

function renderTrainingSummary(plan){
  const summary = $("trainingSummary")
  if(!allVillages.length){
    summary.style.display = "none"
    summary.innerHTML = ""
    return
  }

  const effectiveVillages = getEffectiveTrainingVillages()
  const activeVillages = effectiveVillages.filter(v => buildTrainingQueues(v).length > 0).length
  summary.style.display = "grid"
  summary.innerHTML = `
    <div class="training-summary-card">
      <div class="training-summary-label">Aldeas importadas</div>
      <div class="training-summary-value">${fmtInt(allVillages.length)}</div>
    </div>
    <div class="training-summary-card">
      <div class="training-summary-label">Aldeas entrenamiento</div>
      <div class="training-summary-value">${fmtInt(effectiveVillages.length)}</div>
    </div>
    <div class="training-summary-card">
      <div class="training-summary-label">Colas activas</div>
      <div class="training-summary-value">${fmtInt(plan?.activeQueues || activeVillages)}</div>
    </div>
    <div class="training-summary-card">
      <div class="training-summary-label">Tiempo comun</div>
      <div class="training-summary-value">${fmtTime(plan?.targetSec || 0)}</div>
    </div>
  `
}

function queueCountLabel(counts){
  const active = counts.filter(item => item.units > 0)
  if(!active.length) return "-"
  return active.map(item => `${item.label}:${fmtInt(item.units)}`).join(" · ")
}

function renderTrainingResult(plan){
  const wrap = $("trainingResultWrap")
  const body = $("trainingResultBody")
  trainingLastRenderedPlan = plan || null

  if(!plan?.feasible){
    wrap.style.display = "none"
    body.innerHTML = ""
    return
  }

  wrap.style.display = "block"
  const centralRemainingTotal = Math.max(0, n0(plan.centralAvailable?.total) - n0(plan.totalTransfer?.total))

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
        <div class="training-summary-value">${fmtInt(centralRemainingTotal)}</div>
      </div>
    </div>
    <div class="training-result-meta training-result-meta-wide">
      <div class="training-summary-card training-summary-card-wide">
        <div class="training-summary-label">NPC central</div>
        <div class="npc-central-grid">
          <div class="npc-central-item resource-wood">
            <div class="npc-central-label">${renderResourceLabel("wood")}</div>
            <div class="npc-central-value">${fmtInt(plan.totalTransfer.wood)}</div>
          </div>
          <div class="npc-central-item resource-clay">
            <div class="npc-central-label">${renderResourceLabel("clay")}</div>
            <div class="npc-central-value">${fmtInt(plan.totalTransfer.clay)}</div>
          </div>
          <div class="npc-central-item resource-iron">
            <div class="npc-central-label">${renderResourceLabel("iron")}</div>
            <div class="npc-central-value">${fmtInt(plan.totalTransfer.iron)}</div>
          </div>
          <div class="npc-central-item resource-crop">
            <div class="npc-central-label">${renderResourceLabel("crop")}</div>
            <div class="npc-central-value">${fmtInt(plan.totalTransfer.crop)}</div>
          </div>
        </div>
      </div>
    </div>
    <table class="training-transfer-table">
      <thead>
        <tr>
          <th class="left">Aldea</th>
          <th>Estado</th>
          <th title="Tiempo que la aldea ya sostiene con sus recursos actuales antes de NPC y envios">Tiempo actual</th>
          <th>Tiempo objetivo</th>
          <th>Colas</th>
          <th>${renderResourceLabel("wood")}</th>
          <th>${renderResourceLabel("clay")}</th>
          <th>${renderResourceLabel("iron")}</th>
          <th>${renderResourceLabel("crop")}</th>
        </tr>
      </thead>
      <tbody>
        ${plan.villagePlans.map(item => {
          const splitFactor = getSplitFactorForVillage(item.village.key)
          return `
            <tr>
              <td class="left">${item.village.name}</td>
              <td class="${item.status === "NPC" || item.status === "Envio" ? "training-status-warn" : "training-status-ok"}">${item.status}</td>
              <td>${fmtTime(item.currentTime)}</td>
              <td>${item.counts.length ? fmtTime(plan.targetSec) : "-"}</td>
              <td>
                <div class="split-cell-main">${queueCountLabelWithSplit(item.counts, splitFactor)}</div>
                ${renderSplitButtons(item.village.key)}
              </td>
              <td><div class="split-cell-main">${fmtInt(item.deficit.wood)}</div>${renderSplitValue(item.deficit.wood, splitFactor)}</td>
              <td><div class="split-cell-main">${fmtInt(item.deficit.clay)}</div>${renderSplitValue(item.deficit.clay, splitFactor)}</td>
              <td><div class="split-cell-main">${fmtInt(item.deficit.iron)}</div>${renderSplitValue(item.deficit.iron, splitFactor)}</td>
              <td><div class="split-cell-main">${fmtInt(item.deficit.crop)}</div>${renderSplitValue(item.deficit.crop, splitFactor)}</td>
            </tr>
          `
        }).join("")}
      </tbody>
    </table>
    ${plan.villageTransfers.length ? `
      <div class="troop-matrix-title" style="margin-top:18px">Envios Entre Aldeas</div>
      <table class="training-transfer-table">
        <thead>
          <tr>
            <th class="left">Desde</th>
            <th class="left">Hacia</th>
            <th>Recurso</th>
            <th>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          ${plan.villageTransfers.map(item => `
            <tr>
              <td class="left">${item.from}</td>
              <td class="left">${item.to}</td>
              <td>${item.resource}</td>
              <td>${fmtInt(item.amount)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    ` : ""}
  `

  body.querySelectorAll(".split-toggle-btn").forEach((button) => {
    button.addEventListener("click", () => {
      toggleSplitFactorForVillage(
        button.getAttribute("data-village-key") || "",
        Math.floor(n0(button.getAttribute("data-factor")))
      )
    })
  })
}

function getSplitFactorForVillage(villageKey){
  const factor = Math.floor(n0(trainingSplitModeByVillage[villageKey]))
  return factor === 2 || factor === 3 ? factor : 0
}

function toggleSplitFactorForVillage(villageKey, factor){
  const current = getSplitFactorForVillage(villageKey)
  trainingSplitModeByVillage[villageKey] = current === factor ? 0 : factor
  renderTrainingSummary(trainingLastRenderedPlan?.feasible ? trainingLastRenderedPlan : null)
  renderTrainingResult(trainingLastRenderedPlan?.feasible ? trainingLastRenderedPlan : null)
}

function renderSplitButtons(villageKey){
  const factor = getSplitFactorForVillage(villageKey)
  return `
    <div class="split-toggle-group">
      <button type="button" class="split-toggle-btn ${factor === 2 ? "active" : ""}" data-village-key="${villageKey}" data-factor="2">Entre 2</button>
      <button type="button" class="split-toggle-btn ${factor === 3 ? "active" : ""}" data-village-key="${villageKey}" data-factor="3">Entre 3</button>
    </div>
  `
}

function splitAmount(value, factor){
  return factor > 1 ? Math.ceil(n0(value) / factor) : 0
}

function renderSplitValue(value, factor){
  if(factor <= 1) return ""
  return `<div class="split-subvalue">x${factor}: ${fmtInt(splitAmount(value, factor))}</div>`
}

function queueCountLabelWithSplit(counts, factor){
  const active = counts.filter(item => item.units > 0)
  if(!active.length) return "-"
  const main = active.map(item => `${item.label}:${fmtInt(item.units)}`).join(" Â· ")
  if(factor <= 1) return main
  const split = active.map(item => `${item.label}:${fmtInt(splitAmount(item.units, factor))}`).join(" Â· ")
  return `${main}<div class="split-subvalue">x${factor}: ${split}</div>`
}

function queueCountLabel(counts){
  const active = counts.filter(item => item.units > 0)
  if(!active.length) return "-"
  return active.map(item => {
    const troopName = String(item.troopName || "").trim()
    return troopName ? `${item.label}: ${troopName} ${fmtInt(item.units)}` : `${item.label}:${fmtInt(item.units)}`
  }).join(" · ")
}

function queueCountLabelWithSplit(counts, factor){
  const active = counts.filter(item => item.units > 0)
  if(!active.length) return "-"
  const formatItem = (item, units) => {
    const troopName = String(item.troopName || "").trim()
    return troopName ? `${item.label}: ${troopName} ${fmtInt(units)}` : `${item.label}:${fmtInt(units)}`
  }
  const main = active.map(item => formatItem(item, item.units)).join(" · ")
  if(factor <= 1) return main
  const split = active.map(item => formatItem(item, splitAmount(item.units, factor))).join(" · ")
  return `${main}<div class="split-subvalue">x${factor}: ${split}</div>`
}

function getResourceUi(resourceKey){
  const resources = {
    wood: { label: "Madera", icon: "../npc/icons/wood.svg", className: "resource-wood" },
    clay: { label: "Barro", icon: "../npc/icons/clay.svg", className: "resource-clay" },
    iron: { label: "Hierro", icon: "../npc/icons/iron.svg", className: "resource-iron" },
    crop: { label: "Cereal", icon: "../npc/icons/crop.svg", className: "resource-crop" }
  }
  return resources[resourceKey] || { label: resourceKey, icon: "", className: "" }
}

function renderResourceLabel(resourceKey){
  const info = getResourceUi(resourceKey)
  return `
    <span class="resource-pill ${info.className}">
      <img src="${info.icon}" alt="${info.label}" class="resource-pill-icon">
      <span>${info.label}</span>
    </span>
  `
}

function queueCountLabel(counts){
  const active = counts.filter(item => item.units > 0)
  if(!active.length) return "-"
  return active.map(item => {
    const troopName = String(item.troopName || "").trim()
    return troopName ? `${item.label}: ${troopName} ${fmtInt(item.units)}` : `${item.label}:${fmtInt(item.units)}`
  }).join(" · ")
}

function queueCountLabelWithSplit(counts, factor){
  const active = counts.filter(item => item.units > 0)
  if(!active.length) return "-"
  const formatItem = (item, units) => {
    const troopName = String(item.troopName || "").trim()
    return troopName ? `${item.label}: ${troopName} ${fmtInt(units)}` : `${item.label}:${fmtInt(units)}`
  }
  const main = active.map(item => formatItem(item, item.units)).join(" · ")
  if(factor <= 1) return main
  const split = active.map(item => formatItem(item, splitAmount(item.units, factor))).join(" · ")
  return `${main}<div class="split-subvalue">x${factor}: ${split}</div>`
}

function recalc(){
  updateTrainingCentralSelect()
  renderTrainingVillageTable()

  if(!allVillages.length){
    allVillages = []
    trainingVillages = []
    trainingLastImportSummary = "Sin datos importados."
    $("trainingImportStatus").textContent = trainingLastImportSummary
    renderTrainingSummary(null)
    renderTrainingResult(null)
    showStatus("Pega Capacidad aldea y Los Recursos para empezar.", "")
    return
  }

  const missingResources = allVillages.filter(v => !v.hasResources)
  if(missingResources.length){
    $("trainingImportStatus").textContent = trainingLastImportSummary
    renderTrainingSummary(null)
    renderTrainingResult(null)
    showStatus(`Capacidad importada para ${fmtInt(allVillages.length)} aldeas. Falta pegar Los Recursos para ${fmtInt(missingResources.length)}.`, "bad")
    return
  }

  if(!getEffectiveTrainingVillages().length){
    $("trainingImportStatus").textContent = trainingLastImportSummary
    renderTrainingSummary(null)
    renderTrainingResult(null)
    showStatus("No se detectaron aldeas con siglas de raza para entrenamiento.", "bad")
    return
  }

  const plan = findBestTrainingPlan()
  renderTrainingSummary(plan.feasible ? plan : null)
  renderTrainingResult(plan.feasible ? plan : null)

  if(plan.feasible){
    $("trainingImportStatus").textContent = `Tiempo comun: ${fmtTime(plan.targetSec)} · NPC central: ${fmtInt(plan.totalTransfer.total)} · Aldeas: ${fmtInt(getEffectiveTrainingVillages().length)}`
    showStatus(`OK. Tiempo comun: ${fmtTime(plan.targetSec)} · NPC total: ${fmtInt(plan.totalTransfer.total)}`, "ok")
  } else {
    $("trainingImportStatus").textContent = trainingLastImportSummary
    showStatus(plan.reason, "bad")
  }
}

async function loadCatalogs(){
  const response = await fetch("../npc/catalogo_tropas.json", { cache: "no-store" })
  if(!response.ok) throw new Error(`HTTP ${response.status} al cargar catalogo_tropas.json`)
  const data = await response.json()
  CATALOG_TROOPS = (Array.isArray(data?.troops) ? data.troops : []).filter(item => item && item.name && item.race)
}

async function init(){
  await loadCatalogs()

  syncGlobalTrainingConfigFromDom()
  refreshGlobalTrainingControls()

  $("serverSpeed").addEventListener("change", recalc)
  $("globalAllianceBonus").addEventListener("change", () => {
    syncGlobalTrainingConfigFromDom()
    recalc()
  })
  $("globalTrooperEnabled").addEventListener("change", () => {
    syncGlobalTrainingConfigFromDom()
    refreshGlobalTrainingControls()
    recalc()
  })
  $("globalTrooperBoost").addEventListener("change", () => {
    syncGlobalTrainingConfigFromDom()
    recalc()
  })
  $("globalHelmetEnabled").addEventListener("change", () => {
    syncGlobalTrainingConfigFromDom()
    refreshGlobalTrainingControls()
    recalc()
  })
  $("globalHelmetBarracks").addEventListener("change", () => {
    syncGlobalTrainingConfigFromDom()
    recalc()
  })
  $("globalHelmetStable").addEventListener("change", () => {
    syncGlobalTrainingConfigFromDom()
    recalc()
  })
  $("btnImportTraining").addEventListener("click", () => {
    const info = importTrainingVillages()
    if(info.mergedCount > 0){
      if(info.resourceCount === 0){
        trainingLastImportSummary = `Capacidad: ${fmtInt(info.capacityCount)} · Importadas: ${fmtInt(info.mergedCount)} · Entrenamiento: ${fmtInt(info.trainingCount)} · Falta pegar Los Recursos.`
      } else if(info.missingResourceCount > 0){
        trainingLastImportSummary = `Capacidad: ${fmtInt(info.capacityCount)} · Recursos: ${fmtInt(info.resourceCount)} · Entrenamiento: ${fmtInt(info.trainingCount)} · Con recursos: ${fmtInt(info.matchedCount)} · Sin recursos: ${fmtInt(info.missingResourceCount)}`
      } else {
        trainingLastImportSummary = `Capacidad: ${fmtInt(info.capacityCount)} · Recursos: ${fmtInt(info.resourceCount)} · Cruce valido: ${fmtInt(info.mergedCount)} · Entrenamiento: ${fmtInt(info.trainingCount)}`
      }
    } else {
      trainingLastImportSummary = info.capacityCount > 0
        ? "No se reconocieron aldeas validas para importar."
        : "No se encontraron aldeas en el bloque de Capacidad aldea."
    }
    $("trainingImportStatus").textContent = trainingLastImportSummary
    recalc()
  })
  $("trainingCentralVillage").addEventListener("change", () => {
    trainingCentralKey = $("trainingCentralVillage").value || ""
    recalc()
  })

  recalc()
}

init().catch((err) => {
  console.error("[NPC TRAINING] Fallo de inicializacion", err)
  showStatus("Error cargando catalogos. Verifica la carpeta npc y recarga la pagina.", "bad")
})
