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
let partyImportedVillages = []
let partyRowsState = []
let partyCentralKey = ""
let partyCentralCount = 1
let partyRowId = 0
let partyLastImportSummary = "Sin datos importados."
let partyLastRenderedPlan = null
let partySplitModeByVillage = {}
let partyLastGeneratedLinks = []
let partySentLinkState = {}
let partyLinksUiState = { status: "idle", message: "" }
let partyMapLookupByServer = {}

const RESOURCE_KEYS = ["wood", "clay", "iron", "crop"]
const PARTY_COST = withResourceTotal({
  wood: 29700,
  clay: 33250,
  iron: 32000,
  crop: 6700
})
const SERVER_UTC_OFFSET_HOURS = 1
const TRAVIAN_MAP_SIZE = 401
const MERCHANT_BASE_STATS = {
  ROMANO: { capacity: 500, speed: 16 },
  GALOS: { capacity: 750, speed: 24 },
  GERMANO: { capacity: 1000, speed: 12 },
  HUNOS: { capacity: 500, speed: 20 },
  EGIPTO: { capacity: 750, speed: 16 }
}
const PARTY_RACE_PREFIX = {
  GA: "GALOS",
  GE: "GERMANO",
  R: "ROMANO",
  E: "EGIPTO",
  S: "ESPARTANO",
  H: "HUNOS"
}

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

function compareVillageOrder(a, b){
  const byOrder = n0(a?.sourceOrder) - n0(b?.sourceOrder)
  if(byOrder) return byOrder
  return String(a?.name || "").localeCompare(String(b?.name || ""), "es")
}

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
    .replace(/ÃƒÆ’Ã‚Â¡/g, "a")
    .replace(/ÃƒÆ’Ã‚Â©/g, "e")
    .replace(/ÃƒÆ’Ã‚Â­/g, "i")
    .replace(/ÃƒÆ’Ã‚Â³/g, "o")
    .replace(/ÃƒÆ’Ã‚Âº/g, "u")
    .replace(/ÃƒÆ’Ã‚Â±/g, "n")
    .replace(/ÃƒÆ’ÃƒÂ/g, "A")
    .replace(/ÃƒÆ’Ã¢â‚¬Â°/g, "E")
    .replace(/ÃƒÆ’ÃƒÂ/g, "I")
    .replace(/ÃƒÆ’Ã¢â‚¬Å“/g, "O")
    .replace(/ÃƒÆ’Ã…Â¡/g, "U")
    .replace(/ÃƒÆ’Ã¢â‚¬Ëœ/g, "N")
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

function isInitialZoneVillageName(name){
  return /^ZI/i.test(String(cleanVillageNameText(name) || "").trim())
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
  return ["HUNOS","ROMANO","GERMANO","GALOS","EGIPTO","ESPARTANO"]
}

function parseVillagePartyTag(name){
  const displayName = cleanVillageNameText(name)
  const match = displayName.match(/^([FC])(?:\s*[:\-]\s*|\s*)(GA|GE|R|E|S|H)(?:\s*[:\-]\s*|\s+)(.+)$/i)
  if(!match){
    return {
      displayName,
      isPartyDestination: false,
      isPartyCentral: false,
      race: "",
      sigla: ""
    }
  }

  const mode = String(match[1] || "").toUpperCase()
  const prefix = String(match[2] || "").toUpperCase()
  const baseName = cleanVillageNameText(match[3] || "")
  const race = PARTY_RACE_PREFIX[prefix] || ""
  return {
    displayName: baseName || displayName,
    isPartyDestination: mode === "F" && Boolean(baseName),
    isPartyCentral: mode === "C" && Boolean(baseName),
    race,
    sigla: `${mode}${prefix}`
  }
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
  const isParty = m === "party"
  const hideClassic = isTraining || isParty
  $("modeTimePanel").style.display  = m === "time"  ? "block" : "none"
  $("modeExactPanel").style.display = m === "exact" ? "block" : "none"
  $("modeTrainingPanel").style.display = isTraining ? "block" : "none"
  $("modePartyPanel").style.display = isParty ? "block" : "none"
  $("classicNpcWrap").style.display = hideClassic ? "none" : "block"
  $("classicNpcSubtotal").style.display = hideClassic ? "none" : "block"
  $("classicNpcTable").style.display = hideClassic ? "none" : "table"
  $("toolRaceSelect").style.display = hideClassic ? "none" : "flex"
  $("toolEqOrder").style.display = hideClassic ? "none" : "flex"
  $("toolCurTotal").style.display = hideClassic ? "none" : "flex"
  $("addRow").style.display = hideClassic ? "none" : "inline-flex"
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
  return fixCommonMojibake(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function cleanTravianPaste(raw){
  return fixCommonMojibake(raw)
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

function multiplyResources(resources, factor){
  return withResourceTotal({
    wood: n0(resources?.wood) * factor,
    clay: n0(resources?.clay) * factor,
    iron: n0(resources?.iron) * factor,
    crop: n0(resources?.crop) * factor
  })
}

function getResourceSurplus(current, required){
  return withResourceTotal({
    wood: Math.max(0, n0(current?.wood) - n0(required?.wood)),
    clay: Math.max(0, n0(current?.clay) - n0(required?.clay)),
    iron: Math.max(0, n0(current?.iron) - n0(required?.iron)),
    crop: Math.max(0, n0(current?.crop) - n0(required?.crop))
  })
}

function findTableStart(lines, type){
  for(let i = 0; i < lines.length; i++){
    const line = lines[i]
    if(type === "capacity" && /^Village\s+Warehouse\s+Granary$/i.test(line)) return i + 1
    if(type === "resources" && /^Village(?:\s+.+)?\s+Merchants$/i.test(line)) return i + 1
  }

  for(let i = 0; i < lines.length; i++){
    if(/^Capacity$/i.test(lines[i])) return i + 1
  }

  return 0
}

function parsePartyCapacityRow(line){
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

function parsePartyResourcesRow(line){
  const matches = [...String(line || "").matchAll(/\d[\d,.]*/g)]
  if(matches.length < 4) return null

  const merchantTail = /\/\D*\d[\d,.]*\D*$/i.test(String(line || ""))
  const resourceMatches = merchantTail ? matches.slice(-6, -2) : matches.slice(-4)
  const merchantMatches = merchantTail ? matches.slice(-2) : []
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
    }),
    merchantsAvailable: merchantMatches.length === 2 ? parseNumberToken(merchantMatches[0][0]) : 0,
    merchantsTotal: merchantMatches.length === 2 ? parseNumberToken(merchantMatches[1][0]) : 0
  }
}

function parsePartyTravianTable(raw, rowParser, type){
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

function parseVillageCoordinates(raw){
  const lines = pasteLines(raw)
  const groupsStart = lines.findIndex(line => /^Village groups/i.test(line))
  const scoped = groupsStart >= 0 ? lines.slice(groupsStart + 1) : lines
  const coordsByKey = new Map()
  let pendingName = ""

  const parseCoordinateLine = (line) => {
    const compact = cleanTravianPaste(line)
      .replace(/[−‒–—﹣－]/g, "-")
      .replace(/[^\d|()\-+]/g, "")
      .replace(/\++/g, "+")
      .replace(/-+/g, "-")
    const match = compact.match(/\(([+\-]?\d+)\|([+\-]?\d+)\)/) || compact.match(/([+\-]?\d+)\|([+\-]?\d+)/)
    if(!match) return null
    return {
      x: Number(match[1]),
      y: Number(match[2])
    }
  }

  for(const line of scoped){
    const coord = parseCoordinateLine(line)
    if(coord && pendingName){
      const key = normalizeVillageKey(pendingName)
      if(!coordsByKey.has(key)) coordsByKey.set(key, { key, x: coord.x, y: coord.y })
      pendingName = ""
      continue
    }

    const nameLine = cleanVillageNameText(line)
    if(!nameLine) continue
    if(/^(Village|Sum|Population|Loyalty|Capacity|Warehouse|Production|Resources|Village groups|Task overview|Homepage|Overview|Culture points|Troops|Zona Inicial|Capital|Gasolinera|Aldeas OFF|Aldeas DEFF)$/i.test(nameLine)) continue
    if(/\d{3,}/.test(nameLine)) continue
    pendingName = nameLine
  }

  return coordsByKey
}

function defaultPartyImportedVillage(data, previous){
  const base = previous ? { ...previous } : {
    sourceOrder: Math.max(0, Math.floor(n0(data.sourceOrder))),
    merchantsAvailable: 0,
    merchantsTotal: 0,
    x: null,
    y: null,
    did: 0
  }

  const tag = parseVillagePartyTag(data.name)
  const name = tag.displayName || cleanVillageNameText(data.name)
  return {
    ...base,
    name,
    key: data.key,
    sourceOrder: Math.max(0, Math.floor(n0(data.sourceOrder ?? base.sourceOrder))),
    warehouseCap: Math.max(0, Math.floor(n0(data.warehouseCap))),
    granaryCap: Math.max(0, Math.floor(n0(data.granaryCap))),
    current: withResourceTotal(data.current),
    hasResources: Boolean(data.hasResources),
    merchantsAvailable: Math.max(0, Math.floor(n0(data.merchantsAvailable ?? base.merchantsAvailable))),
    merchantsTotal: Math.max(0, Math.floor(n0(data.merchantsTotal ?? base.merchantsTotal))),
    x: Number.isFinite(Number(data.x)) ? Number(data.x) : base.x,
    y: Number.isFinite(Number(data.y)) ? Number(data.y) : base.y,
    did: Math.max(0, Math.floor(n0(data.did ?? base.did))),
    isInitialZone: isInitialZoneVillageName(name),
    isTaggedPartyCentral: Boolean(tag.isPartyCentral),
    isTaggedPartyDestination: Boolean(tag.isPartyDestination),
    taggedRace: tag.race || "",
    taggedSigla: tag.sigla || ""
  }
}

function getVillageTotalCapacity(village){
  return Math.max(0, Math.floor(n0(village?.warehouseCap) * 3 + n0(village?.granaryCap)))
}

function findRecommendedPartyCentralKey(){
  const taggedCentrals = partyImportedVillages.filter(village => village.isTaggedPartyCentral && !village.isInitialZone)
  const source = taggedCentrals.length ? taggedCentrals : partyImportedVillages.filter(village => !village.isInitialZone)
  const best = source
    .slice()
    .sort((a, b) => {
      const byCurrent = n0(b.current?.total) - n0(a.current?.total)
      if(byCurrent) return byCurrent
      const capA = getVillageTotalCapacity(a)
      const capB = getVillageTotalCapacity(b)
      if(capB !== capA) return capB - capA
      return compareVillageOrder(a, b)
    })[0]
  return best?.key || ""
}

function getPartyCentralCandidates(){
  const taggedCentrals = partyImportedVillages.filter(village => village.isTaggedPartyCentral && !village.isInitialZone)
  const source = taggedCentrals.length ? taggedCentrals : partyImportedVillages.filter(village => !village.isInitialZone)
  return source
    .slice()
    .sort(compareVillageOrder)
}

function hasTaggedPartyDestinations(){
  return partyImportedVillages.some(village => village.isTaggedPartyDestination && !village.isInitialZone)
}

function getPartyDestinationCandidates(){
  const used = new Set(partyRowsState.map(row => row.villageKey))
  return partyImportedVillages
    .filter(village => {
      if(village.key === partyCentralKey) return false
      if(village.isInitialZone) return false
      if(used.has(village.key)) return false
      if(hasTaggedPartyDestinations()) return village.isTaggedPartyDestination
      return true
    })
    .slice()
    .sort(compareVillageOrder)
}

function getPartyVillageByKey(key){
  return partyImportedVillages.find(village => village.key === key) || null
}

function importPartyModeVillages(){
  const capacityRows = parsePartyTravianTable($("partyCapacityInput").value, parsePartyCapacityRow, "capacity")
  const resourceRows = parsePartyTravianTable($("partyResourcesInput").value, parsePartyResourcesRow, "resources")
  const coordsByKey = parseVillageCoordinates($("partyCapacityInput").value)
  const prevByKey = new Map(partyImportedVillages.map(village => [village.key, village]))
  const resourceMap = new Map(resourceRows.map(row => [row.key, row]))
  const resourceDisplayMap = new Map(resourceRows.map(row => [normalizeVillageKey(parseVillagePartyTag(row.name).displayName || row.name), row]))
  const resourceOrderMap = new Map(resourceRows.map((row, idx) => [row.key, idx]))
  const capacityOrderMap = new Map(capacityRows.map((row, idx) => [row.key, idx]))
  const merged = []

  for(const capacity of capacityRows){
    const capacityDisplayKey = normalizeVillageKey(parseVillagePartyTag(capacity.name).displayName || capacity.name)
    const resource = resourceMap.get(capacity.key) || resourceDisplayMap.get(capacityDisplayKey)
    const coords = coordsByKey.get(capacity.key) || coordsByKey.get(capacityDisplayKey)
    const sourceOrder = resourceOrderMap.has(capacity.key)
      ? resourceOrderMap.get(capacity.key)
      : resourceRows.length + n0(capacityOrderMap.get(capacity.key))

    merged.push(defaultPartyImportedVillage({
      ...capacity,
      sourceOrder,
      current: resource ? resource.current : zeroResources(),
      hasResources: Boolean(resource),
      merchantsAvailable: resource?.merchantsAvailable,
      merchantsTotal: resource?.merchantsTotal,
      x: coords?.x,
      y: coords?.y
    }, prevByKey.get(capacity.key)))
  }

  merged.sort(compareVillageOrder)
  partyImportedVillages = merged
  partyRowsState = partyRowsState.filter(row => partyImportedVillages.some(village => village.key === row.villageKey))

  const taggedCentral = merged.find(village => village.isTaggedPartyCentral && !village.isInitialZone)
  if(taggedCentral){
    partyCentralKey = taggedCentral.key
    if(taggedCentral.taggedRace && raceList().includes(taggedCentral.taggedRace) && $("partyCentralRace")){
      $("partyCentralRace").value = taggedCentral.taggedRace
    }
  } else if(!partyImportedVillages.some(village => village.key === partyCentralKey)){
    partyCentralKey = findRecommendedPartyCentralKey()
  }
  partyRowsState = partyRowsState.filter(row => row.villageKey !== partyCentralKey)

  return {
    capacityCount: capacityRows.length,
    resourceCount: resourceRows.length,
    mergedCount: merged.length,
    matchedCount: merged.filter(village => village.hasResources).length,
    missingResourceCount: merged.filter(village => !village.hasResources).length
  }
}

function getPartyRequirementForCount(count){
  const normalized = Math.max(0, Math.min(2, Math.floor(n0(count))))
  return multiplyResources(PARTY_COST, normalized)
}

function buildPartyCountsForCount(count){
  const normalized = Math.max(0, Math.min(2, Math.floor(n0(count))))
  if(normalized <= 0) return []
  return [{ label:"GF", troopName:"Grandes fiestas", units: normalized }]
}

function getPartyConfiguredRows(){
  return partyRowsState
    .map(row => ({
      row,
      village: getPartyVillageByKey(row.villageKey)
    }))
    .filter(item => item.village)
}

function getPartyConfiguredPartyTotal(planRows){
  return (Array.isArray(planRows) ? planRows : []).reduce((acc, item) => acc + Math.max(0, Math.floor(n0(item?.row?.partyCount))), 0)
}

function getPartyRowStatus(plan){
  if(n0(plan?.supportFromCentral?.total) > 0 && n0(plan?.supportFromVillages?.total) > 0) return "Envio + NPC"
  if(n0(plan?.supportFromCentral?.total) > 0) return "NPC"
  if(n0(plan?.supportFromVillages?.total) > 0) return "Envio"
  return "Lista"
}

function addPartyPlanRow(){
  const villageKey = String($("partyRowVillageSelect")?.value || "")
  if(!villageKey) return
  if(villageKey === partyCentralKey){
    const status = $("statusLine")
    status.className = "statusline status-bad"
    status.textContent = "La aldea central ya se configura aparte. Elige otra aldea destino."
    return
  }
  if(partyRowsState.some(row => row.villageKey === villageKey)){
    const status = $("statusLine")
    status.className = "statusline status-bad"
    status.textContent = "Esa aldea ya fue añadida al plan."
    return
  }
  partyRowsState.push({
    id: ++partyRowId,
    villageKey,
    partyCount: 1,
    isDelivered: false
  })
  recalc()
}

function renderPartyCentralMeta(){
  const meta = $("partyCentralMeta")
  const central = getPartyVillageByKey(partyCentralKey)
  if(!central){
    meta.textContent = partyImportedVillages.length
      ? "No hay aldeas validas para elegir como central."
      : "Importa aldeas para elegir una central."
    return
  }

  const reserve = getPartyRequirementForCount(partyCentralCount)
  const recommendedKey = findRecommendedPartyCentralKey()
  meta.innerHTML = `
    <div class="training-central-overview">
      <div class="training-central-card training-central-card-main">
        <div class="training-central-card-label">Central elegida</div>
        <div class="training-central-card-value">${central.name}</div>
        <div class="training-central-card-help">${central.isTaggedPartyCentral ? `Detectada por sigla ${central.taggedSigla}${central.taggedRace ? ` · ${central.taggedRace}` : ""}.` : (central.key === recommendedKey ? "Recomendada por ser la que mas recursos tiene ahora." : "Desde aqui sale el NPC y las rutas comerciales.")}</div>
      </div>
      <div class="training-central-card">
        <div class="training-central-card-label">Reserva fiestas</div>
        <div class="training-central-card-value">${fmtInt(reserve.total)}</div>
        <div class="training-central-card-help">${fmtInt(partyCentralCount)} fiesta(s) propias.</div>
      </div>
      <div class="training-central-card">
        <div class="training-central-card-label">Recursos actuales</div>
        <div class="training-central-card-value">${fmtInt(central.current.wood)} / ${fmtInt(central.current.clay)} / ${fmtInt(central.current.iron)} / ${fmtInt(central.current.crop)}</div>
        <div class="training-central-card-help">Madera / Barro / Hierro / Cereal</div>
      </div>
      <div class="training-central-card">
        <div class="training-central-card-label">Total y capacidad</div>
        <div class="training-central-card-value">${fmtInt(central.current.total)}</div>
        <div class="training-central-card-help">Almacen ${fmtInt(central.warehouseCap)} / Granero ${fmtInt(central.granaryCap)}</div>
      </div>
    </div>
  `
}

function updatePartyCentralSelect(){
  const select = $("partyCentralVillage")
  const options = getPartyCentralCandidates().map(village => ({
    value: village.key,
    label: `${village.name} - Total ${fmtInt(village.current.total)}`
  }))
  fillSelect(select, options, false)
  if(options.some(option => option.value === partyCentralKey)) select.value = partyCentralKey
  else select.value = options[0]?.value || ""
  partyCentralKey = select.value || ""
  const central = getPartyVillageByKey(partyCentralKey)
  if(central?.taggedRace && raceList().includes(central.taggedRace) && $("partyCentralRace")){
    $("partyCentralRace").value = central.taggedRace
  }
  renderPartyCentralMeta()
}

function updatePartyRowVillageOptions(){
  const select = $("partyRowVillageSelect")
  const options = getPartyDestinationCandidates()
    .map(village => ({
      value: village.key,
      label: `${village.name} - Total ${fmtInt(village.current.total)}`
    }))

  fillSelect(select, options, false)
}

function renderPartySelectionTable(){
  const body = $("partySelectionBody")
  const wrap = $("partySelectionWrap")
  body.innerHTML = ""

  if(!partyRowsState.length){
    wrap.style.display = "none"
    return
  }

  wrap.style.display = "block"
  const countOptions = [
    { value:"1", label:"1" },
    { value:"2", label:"2" }
  ]

  for(const row of partyRowsState){
    const village = getPartyVillageByKey(row.villageKey)
    if(!village) continue
    const tr = document.createElement("tr")

    const tdVillage = document.createElement("td")
    tdVillage.className = "left"
    const villageSelect = document.createElement("select")
    villageSelect.className = "training-select"
    const usedByOthers = new Set(partyRowsState.filter(item => item.id !== row.id).map(item => item.villageKey))
    const options = partyImportedVillages
      .filter(item => {
        if(item.key === partyCentralKey) return false
        if(item.isInitialZone) return false
        if(usedByOthers.has(item.key)) return false
        if(hasTaggedPartyDestinations()) return item.isTaggedPartyDestination
        return true
      })
      .slice()
      .sort(compareVillageOrder)
      .map(item => ({ value:item.key, label:item.name }))
    fillSelect(villageSelect, options, false)
    if(options.some(option => option.value === row.villageKey)) villageSelect.value = row.villageKey
    villageSelect.addEventListener("change", () => {
      row.villageKey = villageSelect.value || row.villageKey
      recalc()
    })
    tdVillage.appendChild(villageSelect)
    tr.appendChild(tdVillage)

    const tdCount = document.createElement("td")
    const countSelect = document.createElement("select")
    countSelect.className = "training-level-select"
    fillSelect(countSelect, countOptions, false)
    countSelect.value = String(Math.max(1, Math.min(2, Math.floor(n0(row.partyCount)))))
    countSelect.addEventListener("change", () => {
      row.partyCount = Math.max(1, Math.min(2, Math.floor(n0(countSelect.value))))
      recalc()
    })
    tdCount.appendChild(countSelect)
    tr.appendChild(tdCount)

    const readonlyValues = [
      fmtInt(village.current.wood),
      fmtInt(village.current.clay),
      fmtInt(village.current.iron),
      fmtInt(village.current.crop),
      fmtInt(village.current.total),
      fmtInt(village.warehouseCap),
      fmtInt(village.granaryCap)
    ]
    for(const value of readonlyValues){
      const td = document.createElement("td")
      td.className = "readonly"
      td.textContent = value
      tr.appendChild(td)
    }

    const tdDelete = document.createElement("td")
    const button = document.createElement("button")
    button.type = "button"
    button.className = "training-row-delete-btn"
    button.innerHTML = "&#128465;"
    button.addEventListener("click", () => {
      partyRowsState = partyRowsState.filter(item => item.id !== row.id)
      delete partySplitModeByVillage[row.villageKey]
      recalc()
    })
    tdDelete.appendChild(button)
    tr.appendChild(tdDelete)
    body.appendChild(tr)
  }
}

function renderPartySummary(plan){
  const summary = $("partySummary")
  if(!partyImportedVillages.length){
    summary.style.display = "none"
    summary.innerHTML = ""
    return
  }

  const configuredRows = getPartyConfiguredRows()
  const totalDestinationParties = getPartyConfiguredPartyTotal(configuredRows)
  const importedWithResources = partyImportedVillages.filter(village => village.hasResources).length
  summary.style.display = "grid"
  summary.innerHTML = `
    <div class="training-summary-card">
      <div class="training-summary-label">Aldeas importadas</div>
      <div class="training-summary-value">${fmtInt(partyImportedVillages.length)}</div>
    </div>
    <div class="training-summary-card">
      <div class="training-summary-label">Con recursos</div>
      <div class="training-summary-value">${fmtInt(importedWithResources)}</div>
    </div>
    <div class="training-summary-card">
      <div class="training-summary-label">Aldeas destino</div>
      <div class="training-summary-value">${fmtInt(configuredRows.length)}</div>
    </div>
    <div class="training-summary-card">
      <div class="training-summary-label">Fiestas totales</div>
      <div class="training-summary-value">${fmtInt((plan?.totalPartyCount ?? 0) || (partyCentralCount + totalDestinationParties))}</div>
    </div>
  `
}

function getCentralNpcCapError(central, resources){
  const warehouseCap = Math.max(0, Math.floor(n0(central?.warehouseCap)))
  const granaryCap = Math.max(0, Math.floor(n0(central?.granaryCap)))

  if(n0(resources?.wood) > warehouseCap) return `El reparto NPC supera el tope de madera del almacen central (${fmtInt(warehouseCap)}).`
  if(n0(resources?.clay) > warehouseCap) return `El reparto NPC supera el tope de barro del almacen central (${fmtInt(warehouseCap)}).`
  if(n0(resources?.iron) > warehouseCap) return `El reparto NPC supera el tope de hierro del almacen central (${fmtInt(warehouseCap)}).`
  if(n0(resources?.crop) > granaryCap) return `El reparto NPC supera el tope de cereal del granero central (${fmtInt(granaryCap)}).`
  return ""
}

function evaluatePartyModePlan(){
  if(!partyImportedVillages.length) return { feasible:false, reason:"Importa aldeas primero." }

  const central = getPartyVillageByKey(partyCentralKey)
  if(!central) return { feasible:false, reason:"Selecciona una aldea central." }

  const configuredRows = getPartyConfiguredRows()
  if(!configuredRows.length) return { feasible:false, reason:"Añade al menos una aldea destino al plan." }

  const centralReserve = getPartyRequirementForCount(partyCentralCount)
  if(n0(central.current?.total) < n0(centralReserve.total)){
    return {
      feasible:false,
      reason:`La aldea central no tiene total suficiente para reservar sus ${fmtInt(partyCentralCount)} grandes fiestas (${fmtInt(centralReserve.total)}).`
    }
  }

  const centralAvailableForNpc = Math.max(0, n0(central.current?.total) - n0(centralReserve.total))
  const plans = configuredRows.map(item => ({
    row: item.row,
    village: item.village,
    counts: buildPartyCountsForCount(item.row.partyCount),
    required: getPartyRequirementForCount(item.row.partyCount),
    deficit: zeroResources(),
    deficitBeforeVillageSupport: positiveDeficit(getPartyRequirementForCount(item.row.partyCount), item.village.current),
    surplus: getResourceSurplus(item.village.current, getPartyRequirementForCount(item.row.partyCount)),
    supportFromVillages: zeroResources(),
    supportFromCentral: zeroResources(),
    status: "Lista"
  }))

  const initialNpcNeed = plans.reduce((acc, plan) => addResources(acc, plan.deficitBeforeVillageSupport), zeroResources())
  const villageTransfers = []
  let remainingVillageSupportNeed = Math.max(0, n0(initialNpcNeed.total) - centralAvailableForNpc)

  if(remainingVillageSupportNeed > 0){
    for(const resource of RESOURCE_KEYS){
      const donors = plans
        .filter(item => n0(item.surplus?.[resource]) > 0)
        .sort((a, b) => n0(b.surplus?.[resource]) - n0(a.surplus?.[resource]))
      const receivers = plans
        .filter(item => n0(item.deficitBeforeVillageSupport?.[resource]) > 0)
        .sort((a, b) => n0(b.deficitBeforeVillageSupport?.[resource]) - n0(a.deficitBeforeVillageSupport?.[resource]))

      for(const receiver of receivers){
        let missing = Math.min(n0(receiver.deficitBeforeVillageSupport?.[resource]), remainingVillageSupportNeed)
        for(const donor of donors){
          if(donor.village.key === receiver.village.key || missing <= 0 || remainingVillageSupportNeed <= 0) continue
          const available = n0(donor.surplus?.[resource])
          if(available <= 0) continue
          const amount = Math.min(available, missing, remainingVillageSupportNeed)
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
          remainingVillageSupportNeed -= amount
        }
        if(remainingVillageSupportNeed <= 0) break
      }
      if(remainingVillageSupportNeed <= 0) break
    }
  }

  let centralNpcNeed = zeroResources()
  for(const plan of plans){
    plan.supportFromCentral = withResourceTotal(plan.deficitBeforeVillageSupport)
    plan.deficit = withResourceTotal(plan.deficitBeforeVillageSupport)
    plan.status = getPartyRowStatus(plan)
    centralNpcNeed = addResources(centralNpcNeed, plan.supportFromCentral)
  }

  const centralCapError = getCentralNpcCapError(central, centralNpcNeed)
  if(centralCapError) return { feasible:false, reason:centralCapError }

  if(n0(centralNpcNeed.total) > centralAvailableForNpc){
    return {
      feasible:false,
      reason:`La aldea central se agotaria tras reservar ${fmtInt(centralReserve.total)} y aun faltan ${fmtInt(centralNpcNeed.total)} para el NPC.`
    }
  }

  return {
    feasible:true,
    central,
    centralReserve,
    totalTransfer: centralNpcNeed,
    villageTransfers,
    villagePlans: plans,
    totalPartyCount: partyCentralCount + getPartyConfiguredPartyTotal(configuredRows)
  }
}

function getResourceUi(resourceKey){
  const resources = {
    wood: { label:"Madera", icon:"./icons/wood.svg", className:"resource-wood" },
    clay: { label:"Barro", icon:"./icons/clay.svg", className:"resource-clay" },
    iron: { label:"Hierro", icon:"./icons/iron.svg", className:"resource-iron" },
    crop: { label:"Cereal", icon:"./icons/crop.svg", className:"resource-crop" }
  }
  return resources[resourceKey] || { label:resourceKey, icon:"", className:"" }
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

function renderResourceBoxes(resources){
  return `
    <div class="npc-central-grid">
      ${RESOURCE_KEYS.map(resourceKey => {
        const info = getResourceUi(resourceKey)
        return `
          <div class="npc-central-item ${info.className}">
            <div class="npc-central-label">${renderResourceLabel(resourceKey)}</div>
            <div class="npc-central-value">${fmtInt(resources?.[resourceKey])}</div>
          </div>
        `
      }).join("")}
    </div>
  `
}

function getPartySplitFactorForVillage(villageKey){
  const factor = Math.floor(n0(partySplitModeByVillage[villageKey]))
  return factor === 2 || factor === 3 ? factor : 0
}

function togglePartySplitFactorForVillage(villageKey, factor){
  if(!villageKey || (factor !== 2 && factor !== 3)) return
  partySplitModeByVillage[villageKey] = getPartySplitFactorForVillage(villageKey) === factor ? 0 : factor
  if(partyLastRenderedPlan?.feasible) renderPartyModeResult(partyLastRenderedPlan)
}

function renderPartySplitButtons(villageKey){
  const factor = getPartySplitFactorForVillage(villageKey)
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
  const active = (Array.isArray(counts) ? counts : []).filter(item => n0(item.units) > 0)
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

function getVillageCapacityFit(village, deficit){
  const warehouseCap = Math.max(0, Math.floor(n0(village?.warehouseCap)))
  const granaryCap = Math.max(0, Math.floor(n0(village?.granaryCap)))
  const future = withResourceTotal({
    wood: n0(village?.current?.wood) + n0(deficit?.wood),
    clay: n0(village?.current?.clay) + n0(deficit?.clay),
    iron: n0(village?.current?.iron) + n0(deficit?.iron),
    crop: n0(village?.current?.crop) + n0(deficit?.crop)
  })
  const overflow = []
  if(future.wood > warehouseCap) overflow.push("Madera")
  if(future.clay > warehouseCap) overflow.push("Barro")
  if(future.iron > warehouseCap) overflow.push("Hierro")
  if(future.crop > granaryCap) overflow.push("Cereal")
  return {
    fits: overflow.length === 0,
    detail: overflow.length ? `Supera: ${overflow.join(", ")}` : "Entra completo"
  }
}

function splitResourcesForRepeat(resources, repeat){
  const factor = Math.max(1, Math.floor(n0(repeat)))
  return withResourceTotal({
    wood: Math.ceil(n0(resources?.wood) / factor),
    clay: Math.ceil(n0(resources?.clay) / factor),
    iron: Math.ceil(n0(resources?.iron) / factor),
    crop: Math.ceil(n0(resources?.crop) / factor)
  })
}

function getTradeOfficeBonus(level, race){
  const lvl = Math.max(0, Math.min(20, Math.floor(n0(level))))
  if(lvl <= 0) return 0
  return String(race || "").toUpperCase() === "ROMANO" ? lvl * 0.4 : lvl * 0.2
}

function getMerchantStatsForPartyVillage(village){
  const race = String($("partyCentralRace")?.value || village?.race || "HUNOS").toUpperCase()
  const base = MERCHANT_BASE_STATS[race] || { capacity:500, speed:16 }
  const serverSpeed = Math.max(1, n0($("serverSpeed")?.value || 1))
  const marketplaceLevel = Math.max(1, Math.floor(n0($("partyMarketplaceLevel")?.value || 20)))
  const officeEnabled = Boolean($("partyTradeOfficeEnabled")?.checked)
  const officeLevel = Math.max(0, Math.floor(n0($("partyTradeOfficeLevel")?.value || 20)))
  const officeBonus = officeEnabled ? getTradeOfficeBonus(officeLevel, race) : 0
  const capacityEach = Math.max(1, Math.floor(base.capacity * serverSpeed * (1 + officeBonus)))
  const speedTilesPerHour = Math.max(1, base.speed * serverSpeed)
  const parsedMerchantsTotal = Math.max(0, Math.floor(n0(village?.merchantsTotal)))
  const parsedMerchantsAvailable = Math.max(0, Math.floor(n0(village?.merchantsAvailable)))
  const merchantsTotal = Math.max(1, parsedMerchantsTotal || marketplaceLevel)
  const merchantsAvailable = Math.max(0, parsedMerchantsAvailable || merchantsTotal)
  return {
    race,
    capacityEach,
    speedTilesPerHour,
    merchantsAvailable,
    merchantsTotal
  }
}

function toroidalAxisDistance(a, b){
  const raw = Math.abs(n0(a) - n0(b))
  return Math.min(raw, TRAVIAN_MAP_SIZE - raw)
}

function getVillageDistance(a, b){
  if(!Number.isFinite(Number(a?.x)) || !Number.isFinite(Number(a?.y)) || !Number.isFinite(Number(b?.x)) || !Number.isFinite(Number(b?.y))) return Number.POSITIVE_INFINITY
  const dx = toroidalAxisDistance(a.x, b.x)
  const dy = toroidalAxisDistance(a.y, b.y)
  return Math.sqrt(dx * dx + dy * dy)
}

function getVillageDistanceLabel(a, b){
  const distance = getVillageDistance(a, b)
  return Number.isFinite(distance) ? distance.toFixed(2) : "-"
}

function ceilDateToMinute(date){
  const next = new Date(date.getTime())
  next.setSeconds(0, 0)
  if(next.getTime() < date.getTime()) next.setMinutes(next.getMinutes() + 1)
  return next
}

function ceilReturnedMerchantReadyDate(date){
  const next = ceilDateToMinute(date)
  if(date.getSeconds() === 0 && date.getMilliseconds() === 0) next.setMinutes(next.getMinutes() + 1)
  return next
}

function getServerTimeFromLocal(date){
  const base = new Date(date instanceof Date ? date.getTime() : Date.now())
  const utcMs = base.getTime() + base.getTimezoneOffset() * 60000
  return new Date(utcMs + SERVER_UTC_OFFSET_HOURS * 3600000)
}

function addMinutes(date, minutes){
  return new Date(date.getTime() + Math.max(0, n0(minutes)) * 60000)
}

function addSeconds(date, seconds){
  return new Date(date.getTime() + Math.max(0, n0(seconds)) * 1000)
}

function buildTradeRouteUrl(data){
  const host = String(data.serverHost || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "")
  const params = new URLSearchParams({
    gid: "17",
    t: "3",
    did_dest: String(Math.floor(n0(data.didDest))),
    r1: String(Math.floor(n0(data.wood))),
    r2: String(Math.floor(n0(data.clay))),
    r3: String(Math.floor(n0(data.iron))),
    r4: String(Math.floor(n0(data.crop))),
    trade_route_mode: "send",
    hour: String(Math.floor(n0(data.hour))),
    minute: String(Math.floor(n0(data.minute))),
    repeat: String(Math.max(1, Math.floor(n0(data.repeat)))),
    every: String(Math.max(1, Math.floor(n0(data.every)))),
    action: "traderoute"
  })
  return `https://${host}/build.php?${params.toString()}`
}

function chooseRepeatAndPayload(village, deficit, centralStats){
  const baseFit = getVillageCapacityFit(village, deficit)
  const minRepeat = baseFit.fits ? 1 : 2
  const merchantsPool = Math.max(1, Math.floor(n0(centralStats.merchantsTotal || centralStats.merchantsAvailable || 1)))
  const perTripCapacity = merchantsPool * Math.max(1, Math.floor(n0(centralStats.capacityEach)))

  for(let repeat = minRepeat; repeat <= 3; repeat++){
    const perTrip = splitResourcesForRepeat(deficit, repeat)
    const fit = getVillageCapacityFit(village, perTrip)
    if(!fit.fits) continue
    if(perTrip.total <= perTripCapacity){
      return {
        repeat,
        perTrip,
        fit,
        merchantsNeeded: Math.max(1, Math.ceil(perTrip.total / Math.max(1, centralStats.capacityEach))),
        overMerchantCapacity: false
      }
    }
  }

  const repeat = 3
  const perTrip = splitResourcesForRepeat(deficit, repeat)
  return {
    repeat,
    perTrip,
    fit: getVillageCapacityFit(village, perTrip),
    merchantsNeeded: Math.max(1, Math.ceil(perTrip.total / Math.max(1, centralStats.capacityEach))),
    overMerchantCapacity: perTrip.total > perTripCapacity
  }
}

function getTravelSecondsBetweenVillages(origin, target, speedTilesPerHour){
  const distance = getVillageDistance(origin, target)
  if(!Number.isFinite(distance)) return 0
  const seconds = (distance / Math.max(1, n0(speedTilesPerHour))) * 3600
  return Math.max(0, Math.ceil(seconds))
}

function reserveMerchantWindow(freeAtMsList, merchantsNeeded, earliestDate, occupiedSeconds){
  const baseMs = Math.max(0, new Date(earliestDate instanceof Date ? earliestDate.getTime() : Date.now()).getTime())
  const pool = Array.isArray(freeAtMsList) ? freeAtMsList : []
  const needed = Math.max(1, Math.min(Math.floor(n0(merchantsNeeded || 1)), Math.max(1, pool.length)))
  const picked = []

  pool.sort((a, b) => a - b)
  for(let idx = 0; idx < needed; idx++) picked.push(pool.shift() ?? baseMs)

  const earliestReadyMs = Math.max(baseMs, ...picked)
  const sendDate = earliestReadyMs > baseMs
    ? ceilReturnedMerchantReadyDate(new Date(earliestReadyMs))
    : ceilDateToMinute(new Date(earliestReadyMs))
  const releaseDate = addSeconds(sendDate, occupiedSeconds)
  const releaseMs = releaseDate.getTime()
  for(let idx = 0; idx < picked.length; idx++) pool.push(releaseMs)

  return { sendDate, releaseDate }
}

function formatDateAsServerHm(date){
  const serverDate = getServerTimeFromLocal(date)
  return {
    hour: serverDate.getHours(),
    minute: serverDate.getMinutes(),
    label: `${String(serverDate.getHours()).padStart(2, "0")}:${String(serverDate.getMinutes()).padStart(2, "0")}`
  }
}

function formatDateAsServerHms(date){
  const serverDate = getServerTimeFromLocal(date)
  return {
    label: `${String(serverDate.getHours()).padStart(2, "0")}:${String(serverDate.getMinutes()).padStart(2, "0")}:${String(serverDate.getSeconds()).padStart(2, "0")}`
  }
}

function escapeHtml(text){
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function updatePartyMapSqlStatus(message, tone){
  const status = $("partyMapSqlStatus")
  if(!status) return
  status.className = "training-map-status"
  if(tone === "ok") status.classList.add("is-ok")
  if(tone === "bad") status.classList.add("is-bad")
  status.textContent = message
}

function getManualPartyMapSqlText(){
  return String($("partyMapSqlInput")?.value || "").trim()
}

function parseMapSqlToLookup(sqlText){
  const lookup = {}
  const text = String(sqlText || "")
  const vdataInsertRegex = /INSERT INTO\s+`vdata`\s+VALUES\s*(.+?);/gis
  let insertMatch
  while((insertMatch = vdataInsertRegex.exec(text)) !== null){
    const valuesChunk = insertMatch[1]
    const rowRegex = /\((\d+),'((?:\\'|[^'])*)',(-?\d+),(-?\d+),/g
    let rowMatch
    while((rowMatch = rowRegex.exec(valuesChunk)) !== null){
      const did = Math.floor(n0(rowMatch[1]))
      const x = Math.floor(n0(rowMatch[3]))
      const y = Math.floor(n0(rowMatch[4]))
      lookup[`${x},${y}`] = did
    }
  }

  const xWorldInsertRegex = /INSERT INTO\s+`x_world`\s+VALUES\s*(.+?);/gis
  while((insertMatch = xWorldInsertRegex.exec(text)) !== null){
    const valuesChunk = insertMatch[1]
    const rowRegex = /\(\s*\d+\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*\d+\s*,\s*(\d+)\s*,/g
    let rowMatch
    while((rowMatch = rowRegex.exec(valuesChunk)) !== null){
      const x = Math.floor(n0(rowMatch[1]))
      const y = Math.floor(n0(rowMatch[2]))
      const did = Math.floor(n0(rowMatch[3]))
      if(did > 0) lookup[`${x},${y}`] = did
    }
  }
  return lookup
}

function parseManualPartyMapSql(){
  const text = getManualPartyMapSqlText()
  if(!text) return null
  const lookup = parseMapSqlToLookup(text)
  const count = Object.keys(lookup).length
  if(!count) throw new Error("El map.sql manual no contiene registros validos de aldeas.")
  return { lookup, count }
}

function refreshPartyMapSqlStatus(){
  const manualText = getManualPartyMapSqlText()
  if(!manualText){
    updatePartyMapSqlStatus("Si el servidor bloquea map.sql, pegalo aqui o carga el archivo para generar los links.", "")
    return
  }
  try {
    const parsed = parseManualPartyMapSql()
    updatePartyMapSqlStatus(`map.sql manual listo: ${fmtInt(parsed?.count)} aldeas detectadas.`, "ok")
  } catch (_error){
    updatePartyMapSqlStatus("El map.sql manual no parece valido. Debe contener inserts de aldeas.", "bad")
  }
}

async function getPartyMapDidLookup(serverHost){
  const host = String(serverHost || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "")
  const manual = parseManualPartyMapSql()
  if(manual){
    updatePartyMapSqlStatus(`Usando map.sql manual: ${fmtInt(manual.count)} aldeas detectadas.`, "ok")
    return manual.lookup
  }

  const localProjectUrl = new URL("../map.sql", window.location.href).toString()
  try {
    const localResponse = await fetch(localProjectUrl, { cache:"no-store" })
    if(localResponse.ok){
      const localText = await localResponse.text()
      const localLookup = parseMapSqlToLookup(localText)
      const localCount = Object.keys(localLookup).length
      if(localCount){
        updatePartyMapSqlStatus(`Usando map.sql del proyecto: ${fmtInt(localCount)} aldeas detectadas.`, "ok")
        return localLookup
      }
    }
  } catch (_error){
    // Seguimos con la descarga remota.
  }

  if(!host){
    updatePartyMapSqlStatus("Falta servidor Travian o map.sql manual para generar los links.", "bad")
    throw new Error("Define un servidor valido o carga map.sql para consultar los did.")
  }
  if(partyMapLookupByServer[host]) return partyMapLookupByServer[host]

  const response = await fetch(`https://${host}/map.sql`, { cache:"no-store" })
  if(!response.ok){
    updatePartyMapSqlStatus("No se pudo descargar map.sql del servidor. Usa el map.sql local o cargalo manualmente.", "bad")
    throw new Error(`HTTP ${response.status} al cargar map.sql desde ${host}.`)
  }
  const text = await response.text()
  const lookup = parseMapSqlToLookup(text)
  const count = Object.keys(lookup).length
  if(!count){
    updatePartyMapSqlStatus("Se descargo map.sql pero no se encontraron aldeas validas. Usa el archivo local o manual.", "bad")
    throw new Error(`El map.sql descargado desde ${host} no contiene aldeas validas.`)
  }
  partyMapLookupByServer[host] = lookup
  updatePartyMapSqlStatus(`Usando map.sql remoto: ${fmtInt(count)} aldeas detectadas.`, "ok")
  return lookup
}

async function readPartyMapSqlFile(file){
  if(!file) return ""
  if(typeof file.text === "function") return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("No se pudo leer el archivo map.sql."))
    reader.readAsText(file)
  })
}

function getPartyPlansInConfiguredOrder(plan){
  const orderByKey = new Map(partyRowsState.map((row, index) => [row.villageKey, index]))
  return (Array.isArray(plan?.villagePlans) ? plan.villagePlans : [])
    .slice()
    .sort((a, b) => n0(orderByKey.get(a?.village?.key)) - n0(orderByKey.get(b?.village?.key)))
}

async function generatePartyTradeLinks(plan){
  if(!plan?.feasible) throw new Error("No hay un plan NPC valido para generar links.")
  const serverHost = String($("partyServerHost")?.value || "").trim()
  if(!serverHost) throw new Error("Define el servidor Travian antes de calcular links.")

  const lookup = await getPartyMapDidLookup(serverHost)
  for(const village of partyImportedVillages){
    if(Number.isFinite(Number(village.x)) && Number.isFinite(Number(village.y))){
      village.did = Math.max(0, Math.floor(n0(lookup[`${village.x},${village.y}`])))
    }
  }

  const central = getPartyVillageByKey(partyCentralKey)
  if(!central) throw new Error("Selecciona una aldea central.")
  const centralStats = getMerchantStatsForPartyVillage(central)
  const now = addMinutes(new Date(), Math.max(0, Math.floor(n0($("partyLinkLeadMinutes")?.value || 1))))
  const merchantPoolSize = Math.max(1, Math.floor(n0(centralStats.merchantsTotal || centralStats.merchantsAvailable || 1)))
  const merchantFreeAtMs = Array.from({ length: merchantPoolSize }, () => now.getTime())

  const rows = []
  for(const item of getPartyPlansInConfiguredOrder(plan)){
    if(!item.counts.length || item.deficit.total <= 0) continue
    if(!Number.isFinite(Number(item.village.x)) || !Number.isFinite(Number(item.village.y))){
      rows.push({
        villageKey: item.village.key,
        villageName: item.village.name,
        error: "Faltan coordenadas en Capacidad aldea."
      })
      continue
    }
    if(n0(item.village.did) <= 0){
      rows.push({
        villageKey: item.village.key,
        villageName: item.village.name,
        error: "No se encontro did_dest en map.sql para esas coordenadas."
      })
      continue
    }

    const repeatInfo = chooseRepeatAndPayload(item.village, item.deficit, centralStats)
    const travelSeconds = getTravelSecondsBetweenVillages(central, item.village, centralStats.speedTilesPerHour)
    const roundTripSeconds = Math.max(0, travelSeconds * 2 * repeatInfo.repeat)
    const merchantWindow = reserveMerchantWindow(
      merchantFreeAtMs,
      repeatInfo.merchantsNeeded,
      now,
      roundTripSeconds
    )
    const sendInfo = formatDateAsServerHm(merchantWindow.sendDate)
    const url = buildTradeRouteUrl({
      serverHost,
      didDest: item.village.did,
      wood: repeatInfo.perTrip.wood,
      clay: repeatInfo.perTrip.clay,
      iron: repeatInfo.perTrip.iron,
      crop: repeatInfo.perTrip.crop,
      hour: sendInfo.hour,
      minute: sendInfo.minute,
      repeat: repeatInfo.repeat,
      every: 24
    })

    rows.push({
      villageKey: item.village.key,
      villageName: item.village.name,
      distanceLabel: getVillageDistanceLabel(central, item.village),
      didDest: item.village.did,
      travelSeconds,
      merchantSpeed: centralStats.speedTilesPerHour,
      repeat: repeatInfo.repeat,
      sendLabel: sendInfo.label,
      nextReadyLabel: formatDateAsServerHms(merchantWindow.releaseDate).label,
      perTripTotal: repeatInfo.perTrip.total,
      merchantsNeeded: repeatInfo.merchantsNeeded,
      capacityEach: centralStats.capacityEach,
      merchantTotalCapacity: repeatInfo.merchantsNeeded * centralStats.capacityEach,
      fitDetail: repeatInfo.fit.detail,
      fitOk: repeatInfo.fit.fits,
      overMerchantCapacity: Boolean(repeatInfo.overMerchantCapacity),
      url
    })
  }

  partyLastGeneratedLinks = rows
  return rows
}

function sanitizePartyLinkError(error){
  const raw = String(error?.message || error || "").trim()
  if(!raw) return "No se pudieron generar los links. Revisa el servidor y vuelve a intentar."
  if(/No hay un plan NPC valido/i.test(raw)) return "Primero genera un plan NPC valido."
  if(/Define el servidor|carga map\.sql/i.test(raw)) return "Define el servidor Travian o usa el map.sql del proyecto, pegado o cargado manualmente."
  if(/Selecciona una aldea central/i.test(raw)) return "Selecciona una aldea central para calcular los links."
  if(/manual no contiene registros validos/i.test(raw)) return "El map.sql manual no parece valido. Debe contener las aldeas del mapa."
  if(/Failed to fetch|NetworkError|Load failed|ERR_/i.test(raw)) return "No se pudo conectar con el servidor para descargar map.sql. Usa el map.sql del proyecto o cargalo manualmente."
  if(/HTTP\s+\d+/i.test(raw) && /map\.sql/i.test(raw)) return "No se pudo descargar map.sql del servidor configurado. Usa el map.sql del proyecto o cargalo manualmente."
  if(/map\.sql/i.test(raw)) return "No se pudo leer map.sql. Usa el archivo del proyecto o cargalo manualmente."
  return "No se pudieron generar los links. Revisa coordenadas, servidor y vuelve a intentar."
}

function getPartyLinkStateKey(item){
  return [
    String(item?.villageKey || item?.villageName || ""),
    String(Math.floor(n0(item?.didDest))),
    String(item?.sendLabel || ""),
    String(item?.url || "")
  ].join("|")
}

function renderPartyLinksFeedback(){
  const message = escapeHtml(partyLinksUiState.message || "")
  if(partyLinksUiState.status === "loading"){
    return `
      <div class="training-links-feedback is-loading" role="status" aria-live="polite">
        <div class="training-links-feedback-row">
          <strong>Generando links...</strong>
          <span>${message || "Consultando map.sql y calculando rutas comerciales."}</span>
        </div>
        <div class="training-links-progress" aria-hidden="true"><span></span></div>
      </div>
    `
  }
  if(partyLinksUiState.status === "error"){
    return `
      <div class="training-links-feedback is-error" role="alert">
        <strong>No se pudieron generar los links.</strong>
        <span>${message || "Revisa el servidor, las coordenadas y vuelve a intentar."}</span>
      </div>
    `
  }
  if(partyLinksUiState.status === "success" && partyLinksUiState.message){
    return `
      <div class="training-links-feedback is-success" role="status" aria-live="polite">
        <strong>Links listos.</strong>
        <span>${message}</span>
      </div>
    `
  }
  return ""
}

function renderPartyLinksTable(rows){
  if(!Array.isArray(rows) || !rows.length){
    return `<div class="training-note" style="margin-top:10px">Todavia no hay links calculados.</div>`
  }

  return `
    <table class="training-transfer-table training-links-table">
      <thead>
        <tr>
          <th class="left">Aldea</th>
          <th>Dist.</th>
          <th>DID</th>
          <th>Salida</th>
          <th>Velocidad</th>
          <th>Viaje</th>
          <th>Regreso</th>
          <th>Repeat</th>
          <th>Total viaje</th>
          <th>Merc.</th>
          <th>Detalle</th>
          <th>Enviar</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(item => {
          if(item.error){
            return `
              <tr>
                <td class="left">${escapeHtml(item.villageName)}</td>
                <td colspan="11" class="left training-link-error">${escapeHtml(item.error)}</td>
              </tr>
            `
          }
          return `
            <tr>
              <td class="left">${escapeHtml(item.villageName)}</td>
              <td>${escapeHtml(item.distanceLabel)}</td>
              <td>${fmtInt(item.didDest)}</td>
              <td>${escapeHtml(item.sendLabel)}</td>
              <td>${fmtInt(item.merchantSpeed)} c/h</td>
              <td>${fmtTime(item.travelSeconds)}</td>
              <td>${escapeHtml(item.nextReadyLabel)}</td>
              <td>${fmtInt(item.repeat)}</td>
              <td>${fmtInt(item.perTripTotal)}</td>
              <td>${fmtInt(item.merchantsNeeded)} x ${fmtInt(item.capacityEach)} = ${fmtInt(item.merchantTotalCapacity)}</td>
              <td>${escapeHtml(item.fitDetail)}${item.overMerchantCapacity ? " · Espera mercaderes" : ""}</td>
              <td><a class="btn btn-orange training-link-btn${partySentLinkState[getPartyLinkStateKey(item)] ? " is-sent" : ""}" data-link-key="${escapeHtml(getPartyLinkStateKey(item))}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${partySentLinkState[getPartyLinkStateKey(item)] ? "Enviado" : "Enviar"}</a></td>
            </tr>
          `
        }).join("")}
      </tbody>
    </table>
  `
}

function openAllPartyLinks(){
  const validLinks = partyLastGeneratedLinks.filter(item => item.url)
  for(const item of validLinks){
    window.open(item.url, "_blank", "noopener,noreferrer")
  }
}

function renderPartyModeResult(plan){
  const wrap = $("partyResultWrap")
  const body = $("partyResultBody")
  partyLastRenderedPlan = plan || null

  if(!plan?.feasible){
    wrap.style.display = "none"
    body.innerHTML = ""
    return
  }

  wrap.style.display = "block"
  const centralRemainingTotal = Math.max(0, n0(plan.central.current?.total) - n0(plan.centralReserve?.total) - n0(plan.totalTransfer?.total))
  const generatedLinksCount = partyLastGeneratedLinks.filter(item => item.url).length

  body.innerHTML = `
    <div class="training-result-meta">
      <div class="training-summary-card">
        <div class="training-summary-label">Aldea central</div>
        <div class="training-summary-value">${plan.central.name}</div>
      </div>
      <div class="training-summary-card">
        <div class="training-summary-label">Reserva central</div>
        <div class="training-summary-value">${fmtInt(plan.centralReserve.total)}</div>
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
        <div class="training-summary-label">Reserva central por fiestas</div>
        ${renderResourceBoxes(plan.centralReserve)}
      </div>
    </div>
    <div class="training-result-meta training-result-meta-wide">
      <div class="training-summary-card training-summary-card-wide">
        <div class="training-summary-label">NPC central</div>
        ${renderResourceBoxes(plan.totalTransfer)}
      </div>
    </div>
    <div class="training-result-actions">
      <button type="button" class="btn btn-orange" id="btnCalculatePartyLinks">Calcular links</button>
      <button type="button" class="btn" id="btnOpenAllPartyLinks" ${generatedLinksCount ? "" : "disabled"}>Abrir todo</button>
    </div>
    <table class="training-transfer-table">
      <thead>
        <tr>
          <th>Entregado?</th>
          <th class="left">Aldea</th>
          <th>Estado</th>
          <th>Fiestas</th>
          <th>${renderResourceLabel("wood")}</th>
          <th>${renderResourceLabel("clay")}</th>
          <th>${renderResourceLabel("iron")}</th>
          <th>${renderResourceLabel("crop")}</th>
          <th>Total</th>
          <th>CALZA?</th>
          <th>Quitar</th>
        </tr>
      </thead>
      <tbody>
        ${getPartyPlansInConfiguredOrder(plan).map(item => {
          const splitFactor = getPartySplitFactorForVillage(item.village.key)
          const deliveredClass = item.row.isDelivered ? " is-delivered" : ""
          const totalToSend = withResourceTotal(item.deficit)
          const capacityFit = getVillageCapacityFit(item.village, item.deficit)
          const warnStatus = /NPC|Envio/.test(item.status)
          return `
            <tr class="training-transfer-row${deliveredClass}" data-village-key="${item.village.key}">
              <td>
                <label class="training-delivered-toggle" title="Marcar aldea como entregada">
                  <input type="checkbox" class="training-delivered-check" data-row-id="${item.row.id}" ${item.row.isDelivered ? "checked" : ""}>
                  <span>OK</span>
                </label>
              </td>
              <td class="left"><span class="training-village-name">${item.village.name}</span></td>
              <td class="${warnStatus ? "training-status-warn" : "training-status-ok"}">${item.status}</td>
              <td>
                <div class="split-cell-main">${queueCountLabelWithSplit(item.counts, splitFactor)}</div>
                ${renderPartySplitButtons(item.village.key)}
              </td>
              <td><div class="split-cell-main">${fmtInt(item.deficit.wood)}</div>${renderSplitValue(item.deficit.wood, splitFactor)}</td>
              <td><div class="split-cell-main">${fmtInt(item.deficit.clay)}</div>${renderSplitValue(item.deficit.clay, splitFactor)}</td>
              <td><div class="split-cell-main">${fmtInt(item.deficit.iron)}</div>${renderSplitValue(item.deficit.iron, splitFactor)}</td>
              <td><div class="split-cell-main">${fmtInt(item.deficit.crop)}</div>${renderSplitValue(item.deficit.crop, splitFactor)}</td>
              <td><div class="split-cell-main">${fmtInt(totalToSend.total)}</div>${renderSplitValue(totalToSend.total, splitFactor)}</td>
              <td>
                <div class="training-fit-pill ${capacityFit.fits ? "ok" : "bad"}">${capacityFit.fits ? "SI" : "NO"}</div>
                <div class="training-fit-note">${capacityFit.detail}</div>
              </td>
              <td>
                <button type="button" class="training-row-delete-btn" data-row-id="${item.row.id}" title="Quitar esta aldea del calculo" aria-label="Quitar ${item.village.name} del calculo">&#128465;</button>
              </td>
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
              <td>${getResourceUi(item.resource).label}</td>
              <td>${fmtInt(item.amount)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    ` : ""}
    <div class="troop-matrix-title" style="margin-top:18px">Links Rutas Comerciales</div>
    ${renderPartyLinksFeedback()}
    <div class="training-links-wrap">${renderPartyLinksTable(partyLastGeneratedLinks)}</div>
  `

  body.querySelectorAll(".split-toggle-btn").forEach((button) => {
    button.addEventListener("click", () => {
      togglePartySplitFactorForVillage(
        button.getAttribute("data-village-key") || "",
        Math.floor(n0(button.getAttribute("data-factor")))
      )
    })
  })

  body.querySelectorAll(".training-delivered-check").forEach((input) => {
    input.addEventListener("change", () => {
      const rowId = Math.floor(n0(input.getAttribute("data-row-id")))
      const row = partyRowsState.find(item => item.id === rowId)
      if(row) row.isDelivered = Boolean(input.checked)
      renderPartyModeResult(partyLastRenderedPlan?.feasible ? partyLastRenderedPlan : null)
    })
  })

  body.querySelectorAll(".training-row-delete-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const rowId = Math.floor(n0(button.getAttribute("data-row-id")))
      const row = partyRowsState.find(item => item.id === rowId)
      if(row) delete partySplitModeByVillage[row.villageKey]
      partyRowsState = partyRowsState.filter(item => item.id !== rowId)
      recalc()
    })
  })

  body.querySelectorAll(".training-link-btn").forEach((link) => {
    link.addEventListener("click", () => {
      const key = link.getAttribute("data-link-key") || ""
      if(!key) return
      partySentLinkState[key] = true
      link.classList.add("is-sent")
      link.textContent = "Enviado"
    })
  })

  const calcLinksButton = body.querySelector("#btnCalculatePartyLinks")
  if(calcLinksButton){
    calcLinksButton.addEventListener("click", async () => {
      calcLinksButton.disabled = true
      partyLinksUiState = {
        status:"loading",
        message:"Consultando map.sql y calculando rutas comerciales."
      }
      renderPartyModeResult(partyLastRenderedPlan?.feasible ? partyLastRenderedPlan : null)
      try {
        const rows = await generatePartyTradeLinks(partyLastRenderedPlan?.feasible ? partyLastRenderedPlan : null)
        partySentLinkState = {}
        partyLinksUiState = {
          status:"success",
          message:`${fmtInt(rows.filter(item => item.url).length)} links generados.`
        }
        renderPartyModeResult(partyLastRenderedPlan?.feasible ? partyLastRenderedPlan : null)
        const status = $("statusLine")
        status.className = "statusline status-ok"
        status.textContent = `OK. Links generados: ${fmtInt(rows.filter(item => item.url).length)}`
      } catch (error){
        partyLinksUiState = {
          status:"error",
          message:sanitizePartyLinkError(error)
        }
        renderPartyModeResult(partyLastRenderedPlan?.feasible ? partyLastRenderedPlan : null)
        const status = $("statusLine")
        status.className = "statusline status-bad"
        status.textContent = partyLinksUiState.message
      } finally {
        const activeButton = $("btnCalculatePartyLinks")
        if(activeButton) activeButton.disabled = false
      }
    })
  }

  const openAllButton = body.querySelector("#btnOpenAllPartyLinks")
  if(openAllButton){
    openAllButton.addEventListener("click", () => {
      openAllPartyLinks()
    })
  }
}

function recalcPartyMode(){
  partyLastGeneratedLinks = []
  partySentLinkState = {}
  partyLinksUiState = { status:"idle", message:"" }

  updatePartyCentralSelect()
  updatePartyRowVillageOptions()
  renderPartySelectionTable()
  refreshPartyMapSqlStatus()

  if(!partyImportedVillages.length){
    partyLastImportSummary = "Sin datos importados."
    $("partyImportStatus").textContent = partyLastImportSummary
    renderPartySummary(null)
    renderPartyModeResult(null)
    const status = $("statusLine")
    status.className = "statusline"
    status.textContent = "Pega Capacidad aldea y Los Recursos para empezar."
    return
  }

  renderPartySummary(null)

  const missingResources = partyImportedVillages.filter(village => !village.hasResources)
  if(missingResources.length){
    $("partyImportStatus").textContent = partyLastImportSummary
    renderPartyModeResult(null)
    const status = $("statusLine")
    status.className = "statusline status-bad"
    status.textContent = `Capacidad importada para ${fmtInt(partyImportedVillages.length)} aldeas. Falta pegar Los Recursos para ${fmtInt(missingResources.length)}.`
    return
  }

  const plan = evaluatePartyModePlan()
  renderPartySummary(plan.feasible ? plan : null)
  renderPartyModeResult(plan.feasible ? plan : null)

  const status = $("statusLine")
  if(plan.feasible){
    $("partyImportStatus").textContent = `Fiestas totales: ${fmtInt(plan.totalPartyCount)} · Reserva central: ${fmtInt(plan.centralReserve.total)} · NPC central: ${fmtInt(plan.totalTransfer.total)}`
    status.className = "statusline status-ok"
    status.textContent = `OK. Aldeas destino: ${fmtInt(plan.villagePlans.length)} · NPC total: ${fmtInt(plan.totalTransfer.total)}`
  } else {
    $("partyImportStatus").textContent = partyLastImportSummary
    status.className = "statusline status-bad"
    status.textContent = plan.reason
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

  if($("excessMode").value === "party"){
    recalcPartyMode()
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

  fillSelect($("partyCentralRace"), raceList().map(r => ({ value:r, label:r })), false)
  $("partyCentralRace").value = "HUNOS"
  fillSelect($("partyMarketplaceLevel"), Array.from({ length: 20 }, (_, idx) => ({
    value: String(idx + 1),
    label: String(idx + 1)
  })), false)
  fillSelect($("partyTradeOfficeLevel"), Array.from({ length: 21 }, (_, idx) => ({
    value: String(idx),
    label: String(idx)
  })), false)
  $("partyMarketplaceLevel").value = "20"
  $("partyTradeOfficeLevel").value = "20"

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
  $("btnImportPartyMode").addEventListener("click", () => {
    const info = importPartyModeVillages()
    if(info.mergedCount > 0){
      if(info.resourceCount === 0){
        partyLastImportSummary = `Capacidad: ${fmtInt(info.capacityCount)} · Importadas: ${fmtInt(info.mergedCount)} · Falta pegar Los Recursos.`
      } else if(info.missingResourceCount > 0){
        partyLastImportSummary = `Capacidad: ${fmtInt(info.capacityCount)} · Recursos: ${fmtInt(info.resourceCount)} · Cruce valido: ${fmtInt(info.mergedCount)} · Con recursos: ${fmtInt(info.matchedCount)} · Sin recursos: ${fmtInt(info.missingResourceCount)}`
      } else {
        partyLastImportSummary = `Capacidad: ${fmtInt(info.capacityCount)} · Recursos: ${fmtInt(info.resourceCount)} · Cruce valido: ${fmtInt(info.mergedCount)}`
      }
    } else {
      partyLastImportSummary = info.capacityCount > 0
        ? "No se reconocieron aldeas validas para importar."
        : "No se encontraron aldeas en el bloque de Capacidad aldea."
    }
    $("partyImportStatus").textContent = partyLastImportSummary
    recalc()
  })
  $("partyCentralVillage").addEventListener("change", () => {
    partyCentralKey = $("partyCentralVillage").value || ""
    partyRowsState = partyRowsState.filter(row => row.villageKey !== partyCentralKey)
    recalc()
  })
  $("partyCentralCount").addEventListener("change", () => {
    partyCentralCount = Math.max(0, Math.min(2, Math.floor(n0($("partyCentralCount").value || 0))))
    recalc()
  })
  $("partyCentralRace").addEventListener("change", recalc)
  $("partyTradeOfficeEnabled").addEventListener("change", recalc)
  $("partyMarketplaceLevel").addEventListener("change", recalc)
  $("partyTradeOfficeLevel").addEventListener("change", recalc)
  $("partyServerHost").addEventListener("input", recalc)
  $("partyLinkLeadMinutes").addEventListener("input", recalc)
  $("partyMapSqlInput").addEventListener("input", () => {
    partyMapLookupByServer = {}
    refreshPartyMapSqlStatus()
  })
  $("partyMapSqlFile").addEventListener("change", async (ev) => {
    const file = ev.target?.files?.[0]
    if(!file) return
    try {
      $("partyMapSqlInput").value = await readPartyMapSqlFile(file)
      partyMapLookupByServer = {}
      refreshPartyMapSqlStatus()
      recalc()
    } catch (error){
      updatePartyMapSqlStatus(String(error?.message || "No se pudo leer el archivo map.sql."), "bad")
    } finally {
      ev.target.value = ""
    }
  })
  $("btnClearPartyMapSql").addEventListener("click", () => {
    $("partyMapSqlInput").value = ""
    partyMapLookupByServer = {}
    refreshPartyMapSqlStatus()
    recalc()
  })
  $("btnAddPartyRow").addEventListener("click", addPartyPlanRow)
  $("copyWood").addEventListener("click", copyNpcValue)
  $("copyClay").addEventListener("click", copyNpcValue)
  $("copyIron").addEventListener("click", copyNpcValue)
  $("copyCrop").addEventListener("click", copyNpcValue)

  $("addRow").addEventListener("click", addRowDefault)

  updateTroopSelectsForRace()

  rowsState = []
  const status = $("statusLine")
  if(status) status.textContent = ""
  renderRows()
  recalc()
}

init().catch((err) => {
  console.error("[NPC] Fallo de inicializacion", err)
  showInitError("Error cargando catalogos. Verifica los JSON y recarga la pagina.")
})
