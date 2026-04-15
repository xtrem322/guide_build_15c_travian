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
let trainingLastGeneratedLinks = []
let trainingSentLinkState = {}
let trainingLinksUiState = { status: "idle", message: "" }
let trainingMapLookupByServer = {}
const trainingGlobalConfig = {
  allianceBonus: 0,
  marketBonus: 0,
  linkLeadMinutes: 1,
  marketplaceLevel: 20,
  useDestinationCapacityCap: false,
  trooperEnabled: false,
  trooperBoost: 0,
  helmetEnabled: false,
  helmetBarracks: 0,
  helmetStable: 0,
  serverHost: "eternos.x3.hispano.travian.com",
  tradeOfficeEnabled: true,
  tradeOfficeLevel: 20
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
const SERVER_UTC_OFFSET_HOURS = 1
const TRAVIAN_MAP_SIZE = 401
const MERCHANT_BASE_STATS = {
  ROMANO: { capacity: 500, speed: 16 },
  GALOS: { capacity: 750, speed: 24 },
  GERMANO: { capacity: 1000, speed: 12 },
  HUNOS: { capacity: 500, speed: 20 },
  EGIPTO: { capacity: 750, speed: 16 }
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
  const match = displayName.match(/^([FC])(?:\s*[:\-]\s*|\s*)(GA|GE|R|E|S|H)(?:\s*[:\-]\s*|\s+)(.+)$/i)
  if(!match){
    return {
      displayName,
      isTraining: false,
      isCentral: false,
      race: "",
      raceSupported: true
    }
  }

  const mode = String(match[1] || "").toUpperCase()
  const prefix = String(match[2] || "").toUpperCase()
  const baseName = cleanVillageNameText(match[3] || "")
  const race = TRAINING_RACE_PREFIX[prefix] || ""
  return {
    displayName: baseName || displayName,
    isTraining: mode === "F" && Boolean(baseName && race),
    isCentral: mode === "C" && Boolean(baseName && race),
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

function zeroTrainingQueueTimes(){
  return { C:0, E:0, T:0, G:0 }
}

function withTrainingQueueTimes(times){
  const asSec = (value) => {
    const text = String(value ?? "").trim()
    if(/^(\d+):(\d{2}):(\d{2})$/.test(text)) return parseTimeToSec(text)
    return Math.max(0, Math.floor(n0(value)))
  }
  return {
    C: asSec(times?.C),
    E: asSec(times?.E),
    T: asSec(times?.T),
    G: asSec(times?.G)
  }
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
  return trainingVillages.filter(v => v.key !== trainingCentralKey && !v.isExcluded)
}

function getResourceSurplus(current, required){
  return withResourceTotal({
    wood: Math.max(0, n0(current?.wood) - n0(required?.wood)),
    clay: Math.max(0, n0(current?.clay) - n0(required?.clay)),
    iron: Math.max(0, n0(current?.iron) - n0(required?.iron)),
    crop: Math.max(0, n0(current?.crop) - n0(required?.crop))
  })
}

function getVillageIncomingCapacityRoom(village){
  return withResourceTotal({
    wood: Math.max(0, Math.floor(n0(village?.warehouseCap) - n0(village?.current?.wood))),
    clay: Math.max(0, Math.floor(n0(village?.warehouseCap) - n0(village?.current?.clay))),
    iron: Math.max(0, Math.floor(n0(village?.warehouseCap) - n0(village?.current?.iron))),
    crop: Math.max(0, Math.floor(n0(village?.granaryCap) - n0(village?.current?.crop)))
  })
}

function normalizeVillageKey(name){
  return fixCommonMojibake(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[:\-]+/g, " ")
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
      const tag = parseVillageTrainingTag(pendingName)
      const displayName = tag.displayName || pendingName
      const key = normalizeVillageKey(displayName)
      if(!coordsByKey.has(key)){
        coordsByKey.set(key, {
          key,
          x: coord.x,
          y: coord.y
        })
      }
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

function parseResourcesRow(line){
  const matches = [...String(line || "").matchAll(/\d[\d,.]*/g)]
  if(matches.length < 4) return null

  const merchantTail = /\/\D*\d[\d,.]*\D*$/i.test(String(line || ""))
  const resourceMatches = merchantTail ? matches.slice(-6, -2) : matches.slice(-4)
  if(resourceMatches.length < 4) return null
  const merchantMatches = merchantTail ? matches.slice(-2) : []

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

function isTrainingTimeToken(token){
  return /^(\d+):(\d{2}):(\d{2})$/.test(String(token || "").trim()) || /^(?:-|\u2022)$/u.test(String(token || "").trim())
}

function findTrainingTimesStart(lines){
  let sawTraining = false

  for(let i = 0; i < lines.length; i++){
    const line = lines[i]
    if(/^Training$/i.test(line)){
      sawTraining = true
      continue
    }
    if(sawTraining && /^Village\b/i.test(line)) return i + 1
  }

  for(let i = 0; i < lines.length; i++){
    if(/^Village\b/i.test(lines[i])) return i + 1
  }

  return 0
}

function parseTrainingTimesRow(line){
  const tokens = String(line || "").trim().split(/\s+/).filter(Boolean)
  if(tokens.length < 2) return null

  const tail = []
  let idx = tokens.length - 1
  while(idx >= 0 && tail.length < 4 && isTrainingTimeToken(tokens[idx])){
    tail.unshift(tokens[idx])
    idx -= 1
  }

  if(!tail.length) return null

  const queueTimes = withTrainingQueueTimes({
    C: tail[0],
    E: tail[1],
    T: tail[2],
    G: tail[3]
  })

  const name = cleanVillageNameText(tokens.slice(0, idx + 1).join(" "))
  if(!name || /^Village$/i.test(name) || /^Sum$/i.test(name)) return null

  return {
    name,
    key: normalizeVillageKey(name),
    currentTrainingByQueue: queueTimes,
    currentTrainingSec: queueTimes.C + queueTimes.E + queueTimes.T
  }
}

function parseTrainingTimesTable(raw){
  const lines = pasteLines(raw)
  const startIdx = findTrainingTimesStart(lines)
  const scoped = lines.slice(startIdx)
  const rows = []
  const seen = new Set()

  for(const line of scoped){
    if(shouldStopTravianTable(line)) break
    const row = parseTrainingTimesRow(line)
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
    sourceOrder: Math.max(0, Math.floor(n0(data.sourceOrder))),
    race: tag.race || "HUNOS",
    barracksTroop: "",
    barracksLvl: 20,
    stableTroop: "",
    stableLvl: 20,
    workshopTroop: "",
    workshopLvl: 20,
    allyBonus: 0,
    trooperBoost: 0,
    helmetBarracks: 0,
    helmetStable: 0,
    currentTrainingByQueue: zeroTrainingQueueTimes(),
    currentTrainingSec: 0,
    x: null,
    y: null,
    did: 0,
    merchantsAvailable: 0,
    merchantsTotal: 0,
    isDelivered: false,
    isExcluded: false,
    isCentral: false
  }

  return {
    ...base,
    name: tag.displayName,
    key: data.key,
    sourceOrder: Math.max(0, Math.floor(n0(data.sourceOrder ?? base.sourceOrder))),
    warehouseCap: Math.max(0, Math.floor(n0(data.warehouseCap))),
    granaryCap: Math.max(0, Math.floor(n0(data.granaryCap))),
    current: withResourceTotal(data.current),
    hasResources: Boolean(data.hasResources),
    x: Number.isFinite(Number(data.x)) ? Number(data.x) : base.x,
    y: Number.isFinite(Number(data.y)) ? Number(data.y) : base.y,
    did: Math.max(0, Math.floor(n0(data.did ?? base.did))),
    merchantsAvailable: Math.max(0, Math.floor(n0(data.merchantsAvailable ?? base.merchantsAvailable))),
    merchantsTotal: Math.max(0, Math.floor(n0(data.merchantsTotal ?? base.merchantsTotal))),
    currentTrainingByQueue: withTrainingQueueTimes(data.currentTrainingByQueue ?? base.currentTrainingByQueue),
    currentTrainingSec: Math.max(0, Math.floor(n0(data.currentTrainingSec ?? base.currentTrainingSec))),
    isTraining: tag.isTraining,
    isCentral: tag.isCentral,
    race: tag.race || base.race,
    raceSupported: tag.raceSupported
  }
}

function getTrainingCentralCandidates(){
  const detectedCentrals = getDetectedTrainingCentrals()
  const source = detectedCentrals.length ? detectedCentrals : allVillages
  return source
    .slice()
    .sort(compareVillageOrder)
}

function getDetectedTrainingCentrals(){
  return allVillages.filter(v => v.isCentral).sort(compareVillageOrder)
}

function getVillageTotalCapacity(village){
  return Math.max(0, Math.floor(n0(village?.warehouseCap) * 3 + n0(village?.granaryCap)))
}

function findRecommendedTrainingCentralKey(){
  const best = allVillages
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

function getTradeOfficeBonus(level, race){
  const lvl = Math.max(0, Math.min(20, Math.floor(n0(level))))
  if(lvl <= 0) return 0
  return String(race || "").toUpperCase() === "ROMANO" ? lvl * 0.4 : lvl * 0.2
}

function getMerchantStatsForVillage(village){
  const race = String(village?.race || "").toUpperCase()
  const base = MERCHANT_BASE_STATS[race] || { capacity: 500, speed: 16 }
  const serverSpeed = Math.max(1, n0($("serverSpeed")?.value || 1))
  const marketBonus = Math.max(0, n0(trainingGlobalConfig.marketBonus))
  const marketplaceLevel = Math.max(1, Math.floor(n0(trainingGlobalConfig.marketplaceLevel || 20)))
  const officeBonus = trainingGlobalConfig.tradeOfficeEnabled ? getTradeOfficeBonus(trainingGlobalConfig.tradeOfficeLevel, race) : 0
  const capacityEach = Math.max(1, Math.floor(base.capacity * serverSpeed * (1 + marketBonus) * (1 + officeBonus)))
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
    merchantsTotal,
    marketplaceLevel,
    officeBonus,
    marketBonus
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

function updateTrainingMapSqlStatus(message, tone){
  const status = $("trainingMapSqlStatus")
  if(!status) return
  status.className = "training-map-status"
  if(tone === "ok") status.classList.add("is-ok")
  if(tone === "bad") status.classList.add("is-bad")
  status.textContent = message
}

function getManualTrainingMapSqlText(){
  return String($("trainingMapSqlInput")?.value || "").trim()
}

function parseManualTrainingMapSql(){
  const text = getManualTrainingMapSqlText()
  if(!text) return null
  const lookup = parseMapSqlToLookup(text)
  const count = Object.keys(lookup).length
  if(!count) throw new Error("El map.sql manual no contiene registros validos de aldeas.")
  return { lookup, count }
}

function refreshTrainingMapSqlStatus(){
  const manualText = getManualTrainingMapSqlText()
  if(!manualText){
    updateTrainingMapSqlStatus("Si el servidor bloquea map.sql, pegalo aqui o carga el archivo para generar los links.", "")
    return
  }
  try {
    const parsed = parseManualTrainingMapSql()
    updateTrainingMapSqlStatus(`map.sql manual listo: ${fmtInt(parsed?.count)} aldeas detectadas.`, "ok")
  } catch (error){
    updateTrainingMapSqlStatus("El map.sql manual no parece valido. Debe contener inserts de aldeas.", "bad")
  }
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

async function getMapDidLookup(serverHost){
  const host = String(serverHost || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "")
  const manual = parseManualTrainingMapSql()
  if(manual){
    updateTrainingMapSqlStatus(`Usando map.sql manual: ${fmtInt(manual.count)} aldeas detectadas.`, "ok")
    return manual.lookup
  }

  const localProjectUrl = new URL("../map.sql", window.location.href).toString()
  try {
    const localResponse = await fetch(localProjectUrl, { cache: "no-store" })
    if(localResponse.ok){
      const localText = await localResponse.text()
      const localLookup = parseMapSqlToLookup(localText)
      const localCount = Object.keys(localLookup).length
      if(localCount){
        updateTrainingMapSqlStatus(`Usando map.sql del proyecto: ${fmtInt(localCount)} aldeas detectadas.`, "ok")
        return localLookup
      }
    }
  } catch (_error){
    // Seguimos con la descarga remota.
  }

  if(!host){
    updateTrainingMapSqlStatus("Falta servidor Travian o map.sql manual para generar los links.", "bad")
    throw new Error("Define un servidor valido o carga map.sql para consultar los did.")
  }
  if(trainingMapLookupByServer[host]) return trainingMapLookupByServer[host]

  const response = await fetch(`https://${host}/map.sql`, { cache: "no-store" })
  if(!response.ok){
    updateTrainingMapSqlStatus("No se pudo descargar map.sql del servidor. Usa el map.sql local del proyecto o cargalo manualmente.", "bad")
    throw new Error(`HTTP ${response.status} al cargar map.sql desde ${host}.`)
  }
  const text = await response.text()
  const lookup = parseMapSqlToLookup(text)
  const count = Object.keys(lookup).length
  if(!count){
    updateTrainingMapSqlStatus("Se descargo map.sql pero no se encontraron aldeas validas. Usa el archivo local o manual.", "bad")
    throw new Error(`El map.sql descargado desde ${host} no contiene aldeas validas.`)
  }
  trainingMapLookupByServer[host] = lookup
  updateTrainingMapSqlStatus(`Usando map.sql remoto: ${fmtInt(count)} aldeas detectadas.`, "ok")
  return lookup
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

function importTrainingVillages(){
  const capacityRows = parseTravianTable($("trainingCapacityInput").value, parseCapacityRow, "capacity")
  const resourceRows = parseTravianTable($("trainingResourcesInput").value, parseResourcesRow, "resources")
  const coordsByKey = parseVillageCoordinates($("trainingCapacityInput").value)
  const prevByKey = new Map(allVillages.map(v => [v.key, v]))
  const resourceMap = new Map(resourceRows.map(r => [r.key, r]))
  const resourceOrderMap = new Map(resourceRows.map((row, idx) => [row.key, idx]))
  const capacityOrderMap = new Map(capacityRows.map((row, idx) => [row.key, idx]))
  const merged = []

  for(const cap of capacityRows){
    const capDisplayKey = normalizeVillageKey(parseVillageTrainingTag(cap.name).displayName || cap.name)
    const res = resourceMap.get(cap.key) || resourceMap.get(capDisplayKey)
    const coords = coordsByKey.get(cap.key) || coordsByKey.get(capDisplayKey)
    const sourceOrder = resourceOrderMap.has(cap.key)
      ? resourceOrderMap.get(cap.key)
      : (resourceOrderMap.has(capDisplayKey)
          ? resourceOrderMap.get(capDisplayKey)
          : resourceRows.length + n0(capacityOrderMap.get(cap.key)))
    merged.push(defaultTrainingVillage({
      ...cap,
      sourceOrder,
      x: coords?.x,
      y: coords?.y,
      current: res ? res.current : zeroResources(),
      hasResources: Boolean(res),
      merchantsAvailable: res?.merchantsAvailable,
      merchantsTotal: res?.merchantsTotal
    }, prevByKey.get(cap.key)))
  }

  merged.sort(compareVillageOrder)
  allVillages = merged
  trainingVillages = merged.filter(v => v.isTraining)

  const detectedCentrals = merged.filter(v => v.isCentral)
  if(detectedCentrals.length){
    if(!detectedCentrals.some(v => v.key === trainingCentralKey)){
      trainingCentralKey = detectedCentrals[0]?.key || ""
    }
  } else if(!allVillages.some(v => v.key === trainingCentralKey)){
    trainingCentralKey = findRecommendedTrainingCentralKey()
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
  const requestedTrainingByQueue = {}
  const currentTrainingByQueue = {}
  const equalizedByCurrent = isEqualTrainingTimeModeEnabled()

  for(const queue of queues){
    const currentQueueSec = equalizedByCurrent ? getQueueCurrentTrainingSec(village, queue.label) : 0
    const requestedQueueSec = equalizedByCurrent
      ? Math.max(0, Math.floor(n0(targetSec) - currentQueueSec))
      : Math.max(0, Math.floor(n0(targetSec)))
    const units = requestedQueueSec > 0 ? Math.ceil(requestedQueueSec / queue.secEach) : 0
    currentTrainingByQueue[queue.label] = currentQueueSec
    requestedTrainingByQueue[queue.label] = requestedQueueSec
    counts.push({
      label: queue.label,
      troopName: queue.troopName,
      units,
      currentSec: currentQueueSec,
      requestedSec: requestedQueueSec,
      finalSec: equalizedByCurrent ? currentQueueSec + requestedQueueSec : requestedQueueSec
    })
    required.wood += queue.cost.wood * units
    required.clay += queue.cost.clay * units
    required.iron += queue.cost.iron * units
    required.crop += queue.cost.crop * units
  }

  const resources = withResourceTotal(required)
  return {
    queues,
    counts,
    resources,
    currentTrainingByQueue: withTrainingQueueTimes(currentTrainingByQueue),
    requestedTrainingByQueue: withTrainingQueueTimes(requestedTrainingByQueue),
    maxCurrentSec: counts.reduce((max, item) => Math.max(max, n0(item.currentSec)), 0),
    maxRequestedSec: counts.reduce((max, item) => Math.max(max, n0(item.requestedSec)), 0)
  }
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

function doesVillageRequirementFitDestinationCapacity(village, required){
  const deficit = positiveDeficit(required, village?.current)
  const room = getVillageIncomingCapacityRoom(village)
  return deficit.wood <= room.wood &&
    deficit.clay <= room.clay &&
    deficit.iron <= room.iron &&
    deficit.crop <= room.crop
}

function findVillageDestinationCapacityTarget(village, desiredTargetSec){
  const desired = Math.max(0, Math.floor(n0(desiredTargetSec)))
  if(desired <= 0) return 0

  let lo = 0
  let hi = desired
  while(lo < hi){
    const mid = Math.floor((lo + hi + 1) / 2)
    const req = getTrainingRequirement(village, mid)
    if(doesVillageRequirementFitDestinationCapacity(village, req.resources)) lo = mid
    else hi = mid - 1
  }
  return lo
}

function findVillageDestinationCapacityUpperBound(village){
  const probe = getTrainingRequirement(village, 1)
  if(!probe.queues.length) return 0

  let lo = 0
  let hi = 3600
  const maxSec = 60 * 60 * 24 * 30

  while(hi < maxSec){
    const req = getTrainingRequirement(village, hi)
    if(!doesVillageRequirementFitDestinationCapacity(village, req.resources)) break
    lo = hi
    hi *= 2
  }

  hi = Math.min(hi, maxSec)
  while(lo < hi){
    const mid = Math.floor((lo + hi + 1) / 2)
    const req = getTrainingRequirement(village, mid)
    if(doesVillageRequirementFitDestinationCapacity(village, req.resources)) lo = mid
    else hi = mid - 1
  }

  return lo
}

function buildTrainingPlanForTargets(getTargetSec, options = {}){
  const activeVillages = getEffectiveTrainingVillages()
  if(!activeVillages.length) return { feasible:false, reason:"Importa aldeas primero." }

  const central = allVillages.find(v => v.key === trainingCentralKey)
  if(!central) return { feasible:false, reason:"Selecciona una aldea central." }

  const equalizedByCurrent = isEqualTrainingTimeModeEnabled()
  const useDestinationCapacityCap = Boolean(options.useDestinationCapacityCap)
  const plans = []
  let activeQueues = 0

  for(const village of activeVillages){
    const requestedTargetSec = Math.max(0, Math.floor(n0(getTargetSec(village))))
    let effectiveTargetSec = requestedTargetSec
    let req = getTrainingRequirement(village, effectiveTargetSec)
    const currentTime = equalizedByCurrent ? req.maxCurrentSec : findVillageCurrentTime(village)

    if(!req.queues.length){
      plans.push({
        village,
        currentTime,
        currentTrainingByQueue: zeroTrainingQueueTimes(),
        requestedTrainingByQueue: zeroTrainingQueueTimes(),
        requestedTargetSec,
        totalTargetSec: 0,
        required: zeroResources(),
        deficit: zeroResources(),
        deficitBeforeVillageSupport: zeroResources(),
        surplus: zeroResources(),
        supportFromVillages: zeroResources(),
        supportFromCentral: zeroResources(),
        counts: [],
        cappedByDestination: false,
        status: "Sin colas"
      })
      continue
    }

    if(useDestinationCapacityCap){
      effectiveTargetSec = findVillageDestinationCapacityTarget(village, requestedTargetSec)
      if(effectiveTargetSec !== requestedTargetSec){
        req = getTrainingRequirement(village, effectiveTargetSec)
      }
    }

    activeQueues += req.queues.length
    plans.push({
      village,
      currentTime,
      currentTrainingByQueue: req.currentTrainingByQueue,
      requestedTrainingByQueue: req.requestedTrainingByQueue,
      requestedTargetSec,
      totalTargetSec: effectiveTargetSec,
      required: req.resources,
      deficit: zeroResources(),
      deficitBeforeVillageSupport: positiveDeficit(req.resources, village.current),
      surplus: getResourceSurplus(village.current, req.resources),
      supportFromVillages: zeroResources(),
      supportFromCentral: zeroResources(),
      counts: req.counts,
      cappedByDestination: useDestinationCapacityCap && effectiveTargetSec < requestedTargetSec,
      status: "Lista"
    })
  }

  if(activeQueues === 0){
    return { feasible:false, reason:"Configura al menos una cola de entrenamiento." }
  }

  const initialNpcNeed = plans.reduce((acc, plan) => addResources(acc, plan.deficitBeforeVillageSupport), zeroResources())
  const villageTransfers = []
  let remainingVillageSupportNeed = Math.max(0, n0(initialNpcNeed.total) - n0(central.current?.total))

  if(remainingVillageSupportNeed > 0 && !useDestinationCapacityCap){
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
    centralNpcNeed = addResources(centralNpcNeed, plan.supportFromCentral)
    if(plan.supportFromCentral.total > 0 && plan.supportFromVillages.total > 0) plan.status = "Envio + NPC"
    else if(plan.supportFromCentral.total > 0) plan.status = "NPC"
    else if(plan.supportFromVillages.total > 0) plan.status = "Envio"
    else if(plan.counts.length) plan.status = "Lista"
  }

  const centralCapError = getCentralNpcCapError(central, centralNpcNeed)
  if(centralCapError){
    return { feasible:false, reason: centralCapError }
  }

  if(n0(central.current?.total) < n0(centralNpcNeed.total)){
    return { feasible:false, reason:"La aldea central no tiene total suficiente para cubrir el reparto NPC." }
  }

  return {
    feasible: true,
    targetSec: Math.max(0, ...plans.map(item => Math.max(0, n0(item.totalTargetSec)))),
    equalizedByCurrent,
    usesDestinationCapacityCap: useDestinationCapacityCap,
    villagePlans: plans,
    totalTransfer: centralNpcNeed,
    villageTransfers,
    central,
    centralAvailable: withResourceTotal(central.current),
    activeQueues
  }
}

function evaluateTrainingTarget(targetSec, options = {}){
  const desiredTargetSec = Math.max(0, Math.floor(n0(targetSec)))
  return buildTrainingPlanForTargets(() => desiredTargetSec, options)
}

function evaluateTrainingTargetsMap(targetByVillageKey, options = {}){
  const map = targetByVillageKey || {}
  return buildTrainingPlanForTargets((village) => n0(map[village.key]), options)
}

function findBestTrainingPlanUsingDestinationCapacity(){
  const queuedVillages = getEffectiveTrainingVillages().filter(village => getTrainingRequirement(village, 1).queues.length > 0)
  const capByVillageKey = {}
  let maxCapTargetSec = 0

  for(const village of queuedVillages){
    const capTargetSec = findVillageDestinationCapacityUpperBound(village)
    capByVillageKey[village.key] = capTargetSec
    maxCapTargetSec = Math.max(maxCapTargetSec, capTargetSec)
  }

  let lo = 0
  let hi = maxCapTargetSec
  let bestPlan = evaluateTrainingTarget(0, { useDestinationCapacityCap: true })

  while(lo < hi){
    const mid = Math.floor((lo + hi + 1) / 2)
    const probe = evaluateTrainingTarget(mid, { useDestinationCapacityCap: true })
    if(probe.feasible){
      bestPlan = probe
      lo = mid
    } else {
      hi = mid - 1
    }
  }

  let currentLevel = lo
  const targetByVillageKey = {}
  for(const village of queuedVillages){
    targetByVillageKey[village.key] = Math.min(currentLevel, capByVillageKey[village.key])
  }
  bestPlan = evaluateTrainingTargetsMap(targetByVillageKey, { useDestinationCapacityCap: true })

  let activeVillages = queuedVillages.filter(village => capByVillageKey[village.key] > n0(targetByVillageKey[village.key]))
  while(activeVillages.length){
    const nextCapLevel = activeVillages.reduce((min, village) => Math.min(min, capByVillageKey[village.key]), Infinity)
    let low = currentLevel
    let high = nextCapLevel
    let roundBestPlan = bestPlan

    while(low < high){
      const mid = Math.floor((low + high + 1) / 2)
      const probeTargets = { ...targetByVillageKey }
      for(const village of activeVillages){
        probeTargets[village.key] = mid
      }
      const probe = evaluateTrainingTargetsMap(probeTargets, { useDestinationCapacityCap: true })
      if(probe.feasible){
        roundBestPlan = probe
        low = mid
      } else {
        high = mid - 1
      }
    }

    currentLevel = low
    for(const village of activeVillages){
      targetByVillageKey[village.key] = currentLevel
    }
    bestPlan = roundBestPlan

    if(currentLevel < nextCapLevel) break
    activeVillages = activeVillages.filter(village => capByVillageKey[village.key] > currentLevel)
  }

  const finalLevel = Math.max(0, ...((bestPlan?.villagePlans) || []).map(item => Math.max(0, n0(item.totalTargetSec))))
  if(bestPlan?.villagePlans?.length){
    bestPlan.targetSec = finalLevel
    bestPlan.villagePlans = bestPlan.villagePlans.map(item => ({
      ...item,
      cappedByDestination: Boolean(item.counts?.length) && n0(item.totalTargetSec) < finalLevel
    }))
  }

  return bestPlan
}

function findBestTrainingPlan(){
  if(isDestinationCapacityLimitEnabled()){
    return findBestTrainingPlanUsingDestinationCapacity()
  }
  const minTargetSec = isEqualTrainingTimeModeEnabled()
    ? getEffectiveTrainingVillages().reduce((max, village) => {
      const queues = buildTrainingQueues(village)
      if(!queues.length) return max
      return queues.reduce((queueMax, queue) => Math.max(queueMax, getQueueCurrentTrainingSec(village, queue.label)), max)
    }, 0)
    : 0
  const base = evaluateTrainingTarget(minTargetSec)
  if(!base.feasible){
    if(minTargetSec <= 0) return base

    const fallbackBase = evaluateTrainingTarget(0)
    if(!fallbackBase.feasible) return base

    let best = fallbackBase
    let lo = 0
    let hi = minTargetSec - 1

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

  let best = base
  let lo = minTargetSec
  let hi = Math.max(minTargetSec + 3600, 3600)
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
  trainingGlobalConfig.marketBonus = Number($("globalMarketBonus")?.value || 0)
  trainingGlobalConfig.linkLeadMinutes = Math.max(0, Math.floor(n0($("trainingLinkLeadMinutes")?.value || 1)))
  trainingGlobalConfig.marketplaceLevel = Math.max(1, Math.floor(n0($("trainingMarketplaceLevel")?.value || 20)))
  if($("useDestinationCapacityCap")) trainingGlobalConfig.useDestinationCapacityCap = Boolean($("useDestinationCapacityCap")?.checked)
  trainingGlobalConfig.trooperEnabled = Boolean($("globalTrooperEnabled")?.checked)
  trainingGlobalConfig.trooperBoost = Number($("globalTrooperBoost")?.value || 0)
  trainingGlobalConfig.helmetEnabled = Boolean($("globalHelmetEnabled")?.checked)
  trainingGlobalConfig.helmetBarracks = Number($("globalHelmetBarracks")?.value || 0)
  trainingGlobalConfig.helmetStable = Number($("globalHelmetStable")?.value || 0)
  trainingGlobalConfig.serverHost = String($("trainingServerHost")?.value || "").trim()
  trainingGlobalConfig.tradeOfficeEnabled = Boolean($("trainingTradeOfficeEnabled")?.checked)
  trainingGlobalConfig.tradeOfficeLevel = Math.max(0, Math.floor(n0($("trainingTradeOfficeLevel")?.value || 20)))
}

function isEqualTrainingTimeModeEnabled(){
  return Boolean($("equalizeTrainingTimes")?.checked)
}

function isDestinationCapacityLimitEnabled(){
  return Boolean(trainingGlobalConfig.useDestinationCapacityCap)
}

function refreshTrainingTimeModeControls(){
  const wrap = $("trainingTimesWrap")
  if(wrap) wrap.style.display = isEqualTrainingTimeModeEnabled() ? "" : "none"
}

function getVillageCurrentTrainingSec(village){
  return Math.max(0, Math.floor(n0(village?.currentTrainingSec)))
}

function getQueueCurrentTrainingSec(village, queueLabel){
  return Math.max(0, Math.floor(n0(village?.currentTrainingByQueue?.[queueLabel])))
}

function syncTrainingTimesFromDom(){
  for(const village of allVillages){
    village.currentTrainingByQueue = zeroTrainingQueueTimes()
    village.currentTrainingSec = 0
  }

  if(!isEqualTrainingTimeModeEnabled()){
    return { enabled:false, ok:true, parsedCount:0, matchedCount:0, missingNames:[] }
  }

  const raw = $("trainingTimesInput")?.value || ""
  if(!raw.trim()){
    return {
      enabled:true,
      ok:false,
      parsedCount:0,
      matchedCount:0,
      missingNames: [],
      reason:"Marca Igualar Tiempos y pega el bloque Training con los tiempos actuales."
    }
  }

  const rows = parseTrainingTimesTable(raw)
  if(!rows.length){
    return {
      enabled:true,
      ok:false,
      parsedCount:0,
      matchedCount:0,
      missingNames: [],
      reason:"No se reconocieron filas validas en el bloque Training."
    }
  }

  const map = new Map(rows.map(row => [row.key, row]))
  let matchedCount = 0
  for(const village of allVillages){
    const row = map.get(village.key)
    village.currentTrainingByQueue = withTrainingQueueTimes(row?.currentTrainingByQueue)
    village.currentTrainingSec = row ? row.currentTrainingSec : 0
    if(row) matchedCount += 1
  }

  const missingNames = getEffectiveTrainingVillages()
    .filter(village => buildTrainingQueues(village).length > 0)
    .filter(village => !map.has(village.key))
    .map(village => village.name)

  if(missingNames.length){
    return {
      enabled:true,
      ok:false,
      parsedCount: rows.length,
      matchedCount,
      missingNames,
      reason:`Faltan tiempos vigentes para: ${missingNames.join(", ")}.`
    }
  }

  return { enabled:true, ok:true, parsedCount: rows.length, matchedCount, missingNames: [] }
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
  const equalizedByCurrent = Boolean(plan?.equalizedByCurrent || isEqualTrainingTimeModeEnabled())
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
      <div class="training-summary-label">${equalizedByCurrent ? "Tiempo comun por edificio" : "Tiempo comun"}</div>
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
    <div class="training-result-actions">
      <button type="button" class="btn btn-orange" id="btnCalculateTrainingLinks">Calcular links</button>
      <button type="button" class="btn" id="btnOpenAllTrainingLinks" ${trainingLastGeneratedLinks.some(item => item.url) ? "" : "disabled"}>Abrir todo</button>
    </div>
    <table class="training-transfer-table">
      <thead>
        <tr>
          <th class="left">Aldea</th>
          <th>Estado</th>
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
              <td class="left"><span class="training-village-name">${item.village.name}</span></td>
              <td class="${item.status === "NPC" || item.status === "Envio" ? "training-status-warn" : "training-status-ok"}">${item.status}</td>
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
    <div class="troop-matrix-title" style="margin-top:18px">Links Rutas Comerciales</div>
    ${renderTrainingLinksFeedback()}
    <div class="training-links-wrap">${renderTrainingLinksTable(trainingLastGeneratedLinks)}</div>
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

function updateTrainingCentralSelect(){
  const sel = $("trainingCentralVillage")
  const candidates = getTrainingCentralCandidates()
  const options = candidates.map(v => ({
    value: v.key,
    label: `${v.isCentral ? "[Central] " : ""}${v.name} - Total ${fmtInt(v.current.total)}`
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

  const recommendedKey = findRecommendedTrainingCentralKey()
  const centralStats = getMerchantStatsForVillage(central)
  const detectedCentrals = getDetectedTrainingCentrals()
  const hasCoords = Number.isFinite(central.x) && Number.isFinite(central.y)
  const coordsLabel = hasCoords ? `(${central.x}|${central.y})` : "Sin coordenadas"
  const didLabel = n0(central.did) > 0 ? fmtInt(central.did) : "Se resuelve al calcular links"
  const detectedLabel = detectedCentrals.length ? detectedCentrals.map(item => item.name).join(", ") : "ninguna"
  meta.innerHTML = `
    <div class="training-central-overview">
      <div class="training-central-card training-central-card-main">
        <div class="training-central-card-label">Central elegida</div>
        <div class="training-central-card-value">${central.name}</div>
        <div class="training-central-card-help">${central.isCentral ? `Detectada por sigla ${central.race}.` : (central.key === recommendedKey ? "Recomendada por ser la que mas recursos tiene ahora." : "Desde aqui sale el NPC para cubrir faltantes.")}</div>
      </div>
      <div class="training-central-card">
        <div class="training-central-card-label">Recursos actuales</div>
        <div class="training-central-card-value">${fmtInt(central.current.wood)} / ${fmtInt(central.current.clay)} / ${fmtInt(central.current.iron)} / ${fmtInt(central.current.crop)}</div>
        <div class="training-central-card-help">Madera / Barro / Hierro / Cereal</div>
      </div>
      <div class="training-central-card">
        <div class="training-central-card-label">Capacidad maxima</div>
        <div class="training-central-card-value">${fmtInt(central.warehouseCap)} / ${fmtInt(central.granaryCap)}</div>
        <div class="training-central-card-help">Almacen / Granero</div>
      </div>
      <div class="training-central-card">
        <div class="training-central-card-label">Total disponible</div>
        <div class="training-central-card-value">${fmtInt(central.current.total)}</div>
        <div class="training-central-card-help">Suma de recursos que puede repartir como base del calculo.</div>
      </div>
      <div class="training-central-card">
        <div class="training-central-card-label">Mercaderes</div>
        <div class="training-central-card-value">${centralStats.merchantsAvailable} / ${centralStats.merchantsTotal}</div>
        <div class="training-central-card-help">Mercado nv ${fmtInt(centralStats.marketplaceLevel)} · Capacidad c/u: ${fmtInt(centralStats.capacityEach)} · Velocidad: ${fmtInt(centralStats.speedTilesPerHour)} casillas/h</div>
      </div>
      <div class="training-central-card">
        <div class="training-central-card-label">Raza / mapa</div>
        <div class="training-central-card-value">${central.race || "-"} · ${coordsLabel}</div>
        <div class="training-central-card-help">did: ${didLabel} · Centrales detectadas: ${detectedCentrals.length ? detectedCentrals.map(item => item.name).join(", ") : "ninguna"}</div>
      </div>
    </div>
  `
}

function setTrainingVillageDelivered(villageKey, delivered){
  const village = allVillages.find(item => item.key === villageKey)
  if(!village) return
  village.isDelivered = Boolean(delivered)
}

function excludeTrainingVillage(villageKey){
  const village = trainingVillages.find(item => item.key === villageKey)
  if(!village) return
  village.isExcluded = true
  delete trainingSplitModeByVillage[villageKey]
}

function getRenderedVillagePlans(plan){
  return (Array.isArray(plan?.villagePlans) ? plan.villagePlans : [])
    .slice()
    .sort((a, b) => {
      const deliveredDiff = Number(Boolean(a?.village?.isDelivered)) - Number(Boolean(b?.village?.isDelivered))
      if(deliveredDiff) return deliveredDiff
      const distA = getVillageDistance(plan?.central, a?.village)
      const distB = getVillageDistance(plan?.central, b?.village)
      if(Number.isFinite(distA) && Number.isFinite(distB) && distA !== distB) return distA - distB
      if(Number.isFinite(distA) && !Number.isFinite(distB)) return -1
      if(!Number.isFinite(distA) && Number.isFinite(distB)) return 1
      return compareVillageOrder(a?.village, b?.village)
    })
}

function getVillageCapacityFit(village, deficit){
  if(isDestinationCapacityLimitEnabled()){
    return {
      fits: true,
      detail: "Si calza"
    }
  }
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
        usesCapacityFallback: repeat > 1 || !baseFit.fits
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
    usesCapacityFallback: true,
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
  for(let idx = 0; idx < needed; idx++){
    picked.push(pool.shift() ?? baseMs)
  }

  const earliestReadyMs = Math.max(baseMs, ...picked)
  const sendDate = earliestReadyMs > baseMs
    ? ceilReturnedMerchantReadyDate(new Date(earliestReadyMs))
    : ceilDateToMinute(new Date(earliestReadyMs))
  const releaseDate = addSeconds(sendDate, occupiedSeconds)
  const releaseMs = releaseDate.getTime()
  for(let idx = 0; idx < picked.length; idx++) pool.push(releaseMs)

  return {
    sendDate,
    releaseDate
  }
}

function getSortedVillagePlansForLinks(plan){
  return (Array.isArray(plan?.villagePlans) ? plan.villagePlans : [])
    .slice()
    .sort((a, b) => {
      const distA = getVillageDistance(plan.central, a.village)
      const distB = getVillageDistance(plan.central, b.village)
      if(Number.isFinite(distA) && Number.isFinite(distB) && distA !== distB) return distA - distB
      if(Number.isFinite(distA) && !Number.isFinite(distB)) return -1
      if(!Number.isFinite(distA) && Number.isFinite(distB)) return 1
      return compareVillageOrder(a.village, b.village)
    })
}

function getVillagePlansInConfiguredOrder(plan){
  return (Array.isArray(plan?.villagePlans) ? plan.villagePlans : [])
    .slice()
    .sort((a, b) => compareVillageOrder(a?.village, b?.village))
}

function formatTrainingCountsForCopy(counts, factor){
  const active = (Array.isArray(counts) ? counts : []).filter(item => n0(item?.units) > 0)
  if(!active.length) return []
  const formatItem = (item, units) => {
    const troopName = String(item?.troopName || "").trim()
    const label = String(item?.label || "").trim() || "?"
    return troopName ? `${label}: ${troopName} ${fmtInt(units)}` : `${label}: ${fmtInt(units)}`
  }
  const lines = active.map(item => formatItem(item, item.units))
  if(factor > 1){
    lines.push(`x${factor} por aldea:`)
    for(const item of active) lines.push(formatItem(item, splitAmount(item.units, factor)))
  }
  return lines
}

function formatTrainingCountCell(item, factor){
  if(!item || n0(item?.units) <= 0) return "-"
  const troopName = String(item?.troopName || "").trim()
  const main = troopName ? `${troopName}: ${fmtInt(item.units)}` : fmtInt(item.units)
  if(factor <= 1) return main
  const splitUnits = splitAmount(item.units, factor)
  const split = troopName ? `${troopName}: ${fmtInt(splitUnits)}` : fmtInt(splitUnits)
  return `${main} (x${factor}: ${split})`
}

function getTrainingCountCellByLabel(counts, queueLabel, factor){
  const matches = (Array.isArray(counts) ? counts : [])
    .filter(item => String(item?.label || "").trim().toUpperCase() === String(queueLabel || "").trim().toUpperCase() && n0(item?.units) > 0)

  if(!matches.length) return "-"
  return matches.map(item => formatTrainingCountCell(item, factor)).join(" + ")
}

function buildTrainingDistributionCopyText(plan){
  const orderedPlans = getVillagePlansInConfiguredOrder(plan)
    .filter(item => (Array.isArray(item?.counts) ? item.counts : []).some(count => n0(count?.units) > 0))

  if(!orderedPlans.length) return ""

  const lines = ["[b]Distribucion de tropas[/b]"]
  for(const item of orderedPlans){
    const villageName = String(item?.village?.name || "").trim() || "Aldea sin nombre"
    const splitFactor = getSplitFactorForVillage(item?.village?.key || "")
    lines.push("")
    lines.push(`[b]${villageName}[/b]`)
    lines.push(...formatTrainingCountsForCopy(item.counts, splitFactor))
  }
  return lines.join("\n").trim()
}

function buildTrainingDistributionTableCopyText(plan){
  const orderedPlans = getVillagePlansInConfiguredOrder(plan)
    .filter(item => (Array.isArray(item?.counts) ? item.counts : []).some(count => {
      const label = String(count?.label || "").trim().toUpperCase()
      return (label === "C" || label === "E" || label === "T") && n0(count?.units) > 0
    }))

  if(!orderedPlans.length) return ""

  const lines = [
    "[b]Distribucion de tropas - formato tabla[/b]",
    "[b]ALDEA[/b] | [b]CUARTEL[/b] | [b]ESTABLO[/b] | [b]TALLER[/b]"
  ]

  for(const item of orderedPlans){
    const villageName = String(item?.village?.name || "").trim() || "Aldea sin nombre"
    const splitFactor = getSplitFactorForVillage(item?.village?.key || "")
    lines.push([
      villageName,
      getTrainingCountCellByLabel(item?.counts, "C", splitFactor),
      getTrainingCountCellByLabel(item?.counts, "E", splitFactor),
      getTrainingCountCellByLabel(item?.counts, "T", splitFactor)
    ].join(" | "))
  }

  return lines.join("\n").trim()
}

async function copyTextToClipboard(text){
  const value = String(text || "")
  if(!value.trim()) throw new Error("No hay texto para copiar.")

  if(navigator?.clipboard?.writeText){
    await navigator.clipboard.writeText(value)
    return
  }

  const area = document.createElement("textarea")
  area.value = value
  area.setAttribute("readonly", "readonly")
  area.style.position = "fixed"
  area.style.top = "-9999px"
  area.style.left = "-9999px"
  document.body.appendChild(area)
  area.focus()
  area.select()

  try {
    const ok = document.execCommand("copy")
    if(!ok) throw new Error("No se pudo copiar el resumen.")
  } finally {
    document.body.removeChild(area)
  }
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
    hour: serverDate.getHours(),
    minute: serverDate.getMinutes(),
    second: serverDate.getSeconds(),
    label: `${String(serverDate.getHours()).padStart(2, "0")}:${String(serverDate.getMinutes()).padStart(2, "0")}:${String(serverDate.getSeconds()).padStart(2, "0")}`
  }
}

async function generateTrainingTradeLinks(plan){
  if(!plan?.feasible) throw new Error("No hay un plan NPC valido para generar links.")
  const serverHost = String(trainingGlobalConfig.serverHost || "").trim()
  if(!serverHost) throw new Error("Define el servidor Travian antes de calcular links.")

  const lookup = await getMapDidLookup(serverHost)
  for(const village of allVillages){
    if(Number.isFinite(Number(village.x)) && Number.isFinite(Number(village.y))){
      village.did = Math.max(0, Math.floor(n0(lookup[`${village.x},${village.y}`])))
    }
  }

  const central = allVillages.find(v => v.key === trainingCentralKey)
  if(!central) throw new Error("Selecciona una aldea central.")
  const centralStats = getMerchantStatsForVillage(central)
  const now = addMinutes(new Date(), Math.max(0, Math.floor(n0(trainingGlobalConfig.linkLeadMinutes || 1))))
  const merchantPoolSize = Math.max(1, Math.floor(n0(centralStats.merchantsTotal || centralStats.merchantsAvailable || 1)))
  const merchantFreeAtMs = Array.from({ length: merchantPoolSize }, () => now.getTime())

  const rows = []
  for(const item of getSortedVillagePlansForLinks(plan)){
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
      distance: getVillageDistance(central, item.village),
      distanceLabel: getVillageDistanceLabel(central, item.village),
      didDest: item.village.did,
      travelSeconds,
      merchantSpeed: centralStats.speedTilesPerHour,
      repeat: repeatInfo.repeat,
      sendLabel: sendInfo.label,
      nextReadyLabel: formatDateAsServerHms(merchantWindow.releaseDate).label,
      perTrip: repeatInfo.perTrip,
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

  trainingLastGeneratedLinks = rows
  return rows
}

function escapeHtml(text){
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function sanitizeTrainingLinkError(error){
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

function getTrainingLinkStateKey(item){
  return [
    String(item?.villageKey || item?.villageName || ""),
    String(Math.floor(n0(item?.didDest))),
    String(item?.sendLabel || ""),
    String(item?.url || "")
  ].join("|")
}

function renderTrainingLinksFeedback(){
  const message = escapeHtml(trainingLinksUiState.message || "")
  if(trainingLinksUiState.status === "loading"){
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
  if(trainingLinksUiState.status === "error"){
    return `
      <div class="training-links-feedback is-error" role="alert">
        <strong>No se pudieron generar los links.</strong>
        <span>${message || "Revisa el servidor, las coordenadas y vuelve a intentar."}</span>
      </div>
    `
  }
  if(trainingLinksUiState.status === "success" && trainingLinksUiState.message){
    return `
      <div class="training-links-feedback is-success" role="status" aria-live="polite">
        <strong>Links listos.</strong>
        <span>${message}</span>
      </div>
    `
  }
  return ""
}

function renderTrainingLinksTable(rows){
  if(!rows.length) return `<div class="training-empty">Todavia no hay links calculados.</div>`
  return `
    <table class="training-transfer-table training-links-table">
      <thead>
        <tr>
          <th class="left">Aldea</th>
          <th>Dist.</th>
          <th>did</th>
          <th>Salida</th>
          <th>Viaje</th>
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
                <td colspan="9" class="left training-link-error">${escapeHtml(item.error)}</td>
              </tr>
            `
          }
          return `
            <tr>
              <td class="left">${escapeHtml(item.villageName)}</td>
              <td>${escapeHtml(item.distanceLabel)}</td>
              <td>${fmtInt(item.didDest)}</td>
              <td>${escapeHtml(item.sendLabel)}</td>
              <td>${fmtTime(item.travelSeconds)}</td>
              <td>${fmtInt(item.repeat)}</td>
              <td>${fmtInt(item.perTripTotal)}</td>
              <td>${fmtInt(item.merchantsNeeded)} x ${fmtInt(item.capacityEach)}</td>
              <td>${escapeHtml(item.fitDetail)}${item.overMerchantCapacity ? " · Espera mercaderes" : ""}</td>
              <td><a class="btn btn-orange training-link-btn${trainingSentLinkState[getTrainingLinkStateKey(item)] ? " is-sent" : ""}" data-link-key="${escapeHtml(getTrainingLinkStateKey(item))}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${trainingSentLinkState[getTrainingLinkStateKey(item)] ? "Enviado" : "Enviar"}</a></td>
            </tr>
          `
        }).join("")}
      </tbody>
    </table>
  `
}

function renderTrainingLinksTable(rows){
  if(!rows.length) return `<div class="training-empty">Todavia no hay links calculados.</div>`
  return `
    <table class="training-transfer-table training-links-table">
      <thead>
        <tr>
          <th class="left">Aldea</th>
          <th>Dist.</th>
          <th>did</th>
          <th>Salida</th>
          <th>Vel.</th>
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
              <td><a class="btn btn-orange training-link-btn${trainingSentLinkState[getTrainingLinkStateKey(item)] ? " is-sent" : ""}" data-link-key="${escapeHtml(getTrainingLinkStateKey(item))}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${trainingSentLinkState[getTrainingLinkStateKey(item)] ? "Enviado" : "Enviar"}</a></td>
            </tr>
          `
        }).join("")}
      </tbody>
    </table>
  `
}

async function readTrainingMapSqlFile(file){
  if(!file) return ""
  if(typeof file.text === "function") return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("No se pudo leer el archivo map.sql."))
    reader.readAsText(file)
  })
}

function openTrainingLinksPreview(rows){
  const popup = window.open("", "_blank")
  if(!popup) return false
  popup.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Links NPC Entrenamiento</title><style>body{font-family:Segoe UI,Tahoma,sans-serif;padding:16px;background:#f4f7fa;color:#0f172a}table{width:100%;border-collapse:collapse;background:#fff}th,td{border:1px solid #cbd5e1;padding:8px}th{background:#1d4ed8;color:#fff}.btn{display:inline-block;padding:8px 12px;border-radius:8px;background:#ea580c;color:#fff;text-decoration:none;font-weight:700}</style></head><body><h1>Links NPC Entrenamiento</h1>${renderTrainingLinksTable(rows)}</body></html>`)
  popup.document.close()
  return true
}

function openAllTrainingLinks(){
  const validLinks = trainingLastGeneratedLinks.filter(item => item.url)
  for(const item of validLinks){
    window.open(item.url, "_blank", "noopener,noreferrer")
  }
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
  const visibleVillagePlans = getRenderedVillagePlans(plan)
  const timeLabel = plan.equalizedByCurrent ? "Tiempo comun por edificio" : "Tiempo objetivo"
  const generatedLinksCount = trainingLastGeneratedLinks.filter(item => item.url).length

  body.innerHTML = `
    <div class="training-result-meta">
      <div class="training-summary-card">
        <div class="training-summary-label">Aldea central</div>
        <div class="training-summary-value">${plan.central.name}</div>
      </div>
      <div class="training-summary-card">
        <div class="training-summary-label">${timeLabel}</div>
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
    <div class="training-result-actions">
      <button type="button" class="btn btn-orange" id="btnCalculateTrainingLinks">Calcular links</button>
      <button type="button" class="btn" id="btnOpenAllTrainingLinks" ${generatedLinksCount ? "" : "disabled"}>Abrir todo</button>
      <label class="training-inline-check training-inline-check-boxed">
        <input type="checkbox" id="useDestinationCapacityCap" ${plan.usesDestinationCapacityCap ? "checked" : ""}>
        <span>Usar tope almacen Aldea destino?</span>
      </label>
      <button type="button" class="btn" id="btnCopyTrainingDistribution">Copiar Distribucion de tropas</button>
      <button type="button" class="btn" id="btnCopyTrainingDistributionTable">COPIAR DISTRIBUCION FORMATO TABLA</button>
    </div>
    <table class="training-transfer-table">
      <thead>
        <tr>
          <th>Entregado?</th>
          <th class="left">Aldea</th>
          <th>Estado</th>
          <th>${timeLabel}</th>
          <th>Colas</th>
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
        ${visibleVillagePlans.map(item => {
          const splitFactor = getSplitFactorForVillage(item.village.key)
          const deliveredClass = item.village.isDelivered ? " is-delivered" : ""
          const totalToSend = withResourceTotal(item.deficit)
          const capacityFit = plan.usesDestinationCapacityCap
            ? {
              fits: true,
              detail: item.cappedByDestination ? "Si calza · Tope destino aplicado" : "Si calza"
            }
            : getVillageCapacityFit(item.village, item.deficit)
          return `
            <tr class="training-transfer-row${deliveredClass}" data-village-key="${item.village.key}">
              <td>
                <label class="training-delivered-toggle" title="Marcar aldea como entregada">
                  <input type="checkbox" class="training-delivered-check" data-village-key="${item.village.key}" ${item.village.isDelivered ? "checked" : ""}>
                  <span>OK</span>
                </label>
              </td>
              <td class="left"><span class="training-village-name">${item.village.name}</span></td>
              <td class="${item.status === "NPC" || item.status === "Envio" ? "training-status-warn" : "training-status-ok"}">${item.status}</td>
              <td>${item.counts.length ? fmtTime(item.totalTargetSec ?? plan.targetSec) : "-"}</td>
              <td>
                <div class="split-cell-main">${queueCountLabelWithSplit(item.counts, splitFactor)}</div>
                ${renderSplitButtons(item.village.key)}
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
                <button type="button" class="training-row-delete-btn" data-village-key="${item.village.key}" title="Quitar esta aldea del calculo" aria-label="Quitar ${item.village.name} del calculo">&#128465;</button>
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
              <td>${item.resource}</td>
              <td>${fmtInt(item.amount)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    ` : ""}
    <div class="troop-matrix-title" style="margin-top:18px">Links Rutas Comerciales</div>
    ${renderTrainingLinksFeedback()}
    <div class="training-links-wrap">${renderTrainingLinksTable(trainingLastGeneratedLinks)}</div>
  `

  body.querySelectorAll(".split-toggle-btn").forEach((button) => {
    button.addEventListener("click", () => {
      toggleSplitFactorForVillage(
        button.getAttribute("data-village-key") || "",
        Math.floor(n0(button.getAttribute("data-factor")))
      )
    })
  })
  body.querySelectorAll(".training-delivered-check").forEach((input) => {
    input.addEventListener("change", () => {
      setTrainingVillageDelivered(input.getAttribute("data-village-key") || "", input.checked)
      renderTrainingResult(trainingLastRenderedPlan?.feasible ? trainingLastRenderedPlan : null)
    })
  })
  body.querySelectorAll(".training-row-delete-btn").forEach((button) => {
    button.addEventListener("click", () => {
      excludeTrainingVillage(button.getAttribute("data-village-key") || "")
      recalc()
    })
  })
  body.querySelectorAll(".training-link-btn").forEach((link) => {
    link.addEventListener("click", () => {
      const key = link.getAttribute("data-link-key") || ""
      if(!key) return
      trainingSentLinkState[key] = true
      link.classList.add("is-sent")
      link.textContent = "Enviado"
    })
  })
  const calcLinksButton = body.querySelector("#btnCalculateTrainingLinks")
  if(calcLinksButton){
    calcLinksButton.addEventListener("click", async () => {
      calcLinksButton.disabled = true
      trainingLinksUiState = {
        status: "loading",
        message: "Consultando map.sql y calculando rutas comerciales."
      }
      renderTrainingResult(trainingLastRenderedPlan?.feasible ? trainingLastRenderedPlan : null)
      const loadingButton = $("btnCalculateTrainingLinks")
      if(loadingButton) loadingButton.disabled = true
      try {
        const rows = await generateTrainingTradeLinks(trainingLastRenderedPlan?.feasible ? trainingLastRenderedPlan : null)
        trainingSentLinkState = {}
        trainingLinksUiState = {
          status: "success",
          message: `${fmtInt(rows.filter(item => item.url).length)} links generados.`
        }
        renderTrainingResult(trainingLastRenderedPlan?.feasible ? trainingLastRenderedPlan : null)
        showStatus(`OK. Links generados: ${fmtInt(rows.filter(item => item.url).length)}`, "ok")
      } catch (error){
        trainingLinksUiState = {
          status: "error",
          message: sanitizeTrainingLinkError(error)
        }
        renderTrainingResult(trainingLastRenderedPlan?.feasible ? trainingLastRenderedPlan : null)
        showStatus(trainingLinksUiState.message, "bad")
      } finally {
        const activeButton = $("btnCalculateTrainingLinks")
        if(activeButton) activeButton.disabled = false
      }
    })
  }
  const openAllButton = body.querySelector("#btnOpenAllTrainingLinks")
  if(openAllButton){
    openAllButton.addEventListener("click", () => {
      openAllTrainingLinks()
    })
  }
  const copyDistributionButton = body.querySelector("#btnCopyTrainingDistribution")
  if(copyDistributionButton){
    copyDistributionButton.addEventListener("click", async () => {
      copyDistributionButton.disabled = true
      try {
        const text = buildTrainingDistributionCopyText(trainingLastRenderedPlan?.feasible ? trainingLastRenderedPlan : null)
        await copyTextToClipboard(text)
        showStatus("Resumen de distribucion copiado al portapapeles.", "ok")
      } catch (error){
        showStatus(String(error?.message || "No se pudo copiar el resumen."), "bad")
      } finally {
        copyDistributionButton.disabled = false
      }
    })
  }
  const copyDistributionTableButton = body.querySelector("#btnCopyTrainingDistributionTable")
  if(copyDistributionTableButton){
    copyDistributionTableButton.addEventListener("click", async () => {
      copyDistributionTableButton.disabled = true
      try {
        const text = buildTrainingDistributionTableCopyText(trainingLastRenderedPlan?.feasible ? trainingLastRenderedPlan : null)
        await copyTextToClipboard(text)
        showStatus("Resumen tabulado de distribucion copiado al portapapeles.", "ok")
      } catch (error){
        showStatus(String(error?.message || "No se pudo copiar el resumen tabulado."), "bad")
      } finally {
        copyDistributionTableButton.disabled = false
      }
    })
  }
  const destinationCapCheckbox = body.querySelector("#useDestinationCapacityCap")
  if(destinationCapCheckbox){
    destinationCapCheckbox.addEventListener("change", () => {
      trainingGlobalConfig.useDestinationCapacityCap = destinationCapCheckbox.checked
      recalc()
    })
  }
}

function recalc(){
  trainingLastGeneratedLinks = []
  trainingSentLinkState = {}
  trainingLinksUiState = { status: "idle", message: "" }
  updateTrainingCentralSelect()
  refreshTrainingTimeModeControls()
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

  const trainingTimeInfo = syncTrainingTimesFromDom()
  if(!trainingTimeInfo.ok){
    $("trainingImportStatus").textContent = trainingLastImportSummary
    renderTrainingSummary(null)
    renderTrainingResult(null)
    showStatus(trainingTimeInfo.reason, "bad")
    return
  }

  const plan = findBestTrainingPlan()
  renderTrainingSummary(plan.feasible ? plan : null)
  renderTrainingResult(plan.feasible ? plan : null)

  if(plan.feasible){
    const timeSummaryLabel = plan.equalizedByCurrent ? "Tiempo comun por edificio" : "Tiempo comun"
    const trainingSuffix = trainingTimeInfo.enabled ? ` · Tiempos vigentes: ${fmtInt(trainingTimeInfo.parsedCount)}` : ""
    $("trainingImportStatus").textContent = `${timeSummaryLabel}: ${fmtTime(plan.targetSec)} · NPC central: ${fmtInt(plan.totalTransfer.total)} · Aldeas: ${fmtInt(getEffectiveTrainingVillages().length)}${trainingSuffix}`
    showStatus(`OK. ${timeSummaryLabel}: ${fmtTime(plan.targetSec)} · NPC total: ${fmtInt(plan.totalTransfer.total)}`, "ok")
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

  fillSelect($("trainingTradeOfficeLevel"), Array.from({ length: 21 }, (_, idx) => ({
    value: String(idx),
    label: String(idx)
  })), false)
  fillSelect($("trainingMarketplaceLevel"), Array.from({ length: 20 }, (_, idx) => ({
    value: String(idx + 1),
    label: String(idx + 1)
  })), false)
  $("trainingMarketplaceLevel").value = "20"
  $("trainingTradeOfficeLevel").value = "20"

  syncGlobalTrainingConfigFromDom()
  refreshGlobalTrainingControls()
  refreshTrainingTimeModeControls()

  $("serverSpeed").addEventListener("change", recalc)
  $("globalAllianceBonus").addEventListener("change", () => {
    syncGlobalTrainingConfigFromDom()
    recalc()
  })
  $("globalMarketBonus").addEventListener("change", () => {
    syncGlobalTrainingConfigFromDom()
    recalc()
  })
  $("trainingLinkLeadMinutes").addEventListener("input", () => {
    syncGlobalTrainingConfigFromDom()
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
  $("equalizeTrainingTimes").addEventListener("change", () => {
    refreshTrainingTimeModeControls()
    syncGlobalTrainingConfigFromDom()
    recalc()
  })
  $("trainingServerHost").addEventListener("input", () => {
    syncGlobalTrainingConfigFromDom()
  })
  $("trainingMapSqlInput").addEventListener("input", () => {
    refreshTrainingMapSqlStatus()
  })
  $("trainingMapSqlFile").addEventListener("change", async (event) => {
    const file = event.target.files?.[0]
    if(!file) return
    try {
      $("trainingMapSqlInput").value = await readTrainingMapSqlFile(file)
      refreshTrainingMapSqlStatus()
      showStatus(`OK. map.sql cargado: ${file.name}`, "ok")
    } catch (error){
      updateTrainingMapSqlStatus("No se pudo leer el archivo map.sql.", "bad")
      showStatus("No se pudo leer el archivo map.sql.", "bad")
    } finally {
      event.target.value = ""
    }
  })
  $("btnClearTrainingMapSql").addEventListener("click", () => {
    $("trainingMapSqlInput").value = ""
    refreshTrainingMapSqlStatus()
  })
  $("trainingTradeOfficeEnabled").addEventListener("change", () => {
    syncGlobalTrainingConfigFromDom()
    recalc()
  })
  $("trainingMarketplaceLevel").addEventListener("change", () => {
    syncGlobalTrainingConfigFromDom()
    recalc()
  })
  $("trainingTradeOfficeLevel").addEventListener("change", () => {
    syncGlobalTrainingConfigFromDom()
    recalc()
  })
  $("trainingTimesInput").addEventListener("input", recalc)
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

  refreshTrainingMapSqlStatus()
  recalc()
}

init().catch((err) => {
  console.error("[NPC TRAINING] Fallo de inicializacion", err)
  showStatus("Error cargando catalogos. Verifica la carpeta npc y recarga la pagina.", "bad")
})
