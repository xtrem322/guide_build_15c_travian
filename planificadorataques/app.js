const $ = (id) => document.getElementById(id)

const DEFAULT_ATTACK_SERVER_HOST = "eternos.x3.hispano.travian.com"
const ATTACK_CONFIG_SCHEMA = "travian-attack-planner-config"
const ATTACK_CONFIG_VERSION = 1
const TRAVIAN_MAP_SIZE = 401
const TOURNAMENT_FREE_TILES = 20
const TOURNAMENT_BONUS_PER_LEVEL = 0.2
const SERVER_SPEED_TROOP_FACTOR = {
  1: 1,
  2: 2,
  3: 2,
  5: 2,
  10: 4
}

const ATTACK_TROOPS_BY_RACE = {
  ROMANO: [
    { name: "Legionario", speed: 6, token: "t1", kind: "C" },
    { name: "Pretoriano", speed: 5, token: "t2", kind: "C" },
    { name: "Imperano", speed: 7, token: "t3", kind: "C", aliases: ["Imperian"] },
    { name: "Equites Legati", speed: 16, token: "t4", kind: "E" },
    { name: "Equites Imperatoris", speed: 14, token: "t5", kind: "E" },
    { name: "Equites Caesaris", speed: 10, token: "t6", kind: "E" },
    { name: "Carnero", speed: 4, token: "t7", kind: "T", aliases: ["Battering Ram"] },
    { name: "Catapulta de fuego", speed: 3, token: "t8", kind: "T", aliases: ["Fire Catapult"] },
    { name: "Colono", speed: 5, token: "t9", kind: "R", aliases: ["Settler"] },
    { name: "Senador", speed: 4, token: "t10", kind: "R", aliases: ["Senator"] },
    { name: "Heroe", speed: 6, token: "t11", kind: "H", aliases: ["Hero"] }
  ],
  GERMANO: [
    { name: "Luchador de porra", speed: 7, token: "t1", kind: "C", aliases: ["Clubswinger", "Macemen"] },
    { name: "Lancero", speed: 7, token: "t2", kind: "C", aliases: ["Spearman"] },
    { name: "Luchador de Hacha", speed: 6, token: "t3", kind: "C", aliases: ["Axeman"] },
    { name: "Emisario", speed: 9, token: "t4", kind: "C", aliases: ["Scout"] },
    { name: "Paladin", speed: 10, token: "t5", kind: "E", aliases: ["Paladin"] },
    { name: "Jinete Teuton", speed: 9, token: "t6", kind: "E", aliases: ["Teutonic Knight"] },
    { name: "Ariete de madera", speed: 4, token: "t7", kind: "T", aliases: ["Ram"] },
    { name: "Catapulta", speed: 3, token: "t8", kind: "T", aliases: ["Catapult"] },
    { name: "Colono", speed: 5, token: "t9", kind: "R", aliases: ["Settler"] },
    { name: "Cabecilla", speed: 4, token: "t10", kind: "R", aliases: ["Chief", "Administrator"] },
    { name: "Heroe", speed: 7, token: "t11", kind: "H", aliases: ["Hero"] }
  ],
  GALOS: [
    { name: "Falange", speed: 7, token: "t1", kind: "C", aliases: ["Phalanx"] },
    { name: "Espadachin", speed: 6, token: "t2", kind: "C", aliases: ["Swordsman"] },
    { name: "Batidor", speed: 17, token: "t3", kind: "E", aliases: ["Pathfinder", "Scout"] },
    { name: "Rayo de Theutates", speed: 19, token: "t4", kind: "E", aliases: ["Theutates Thunder"] },
    { name: "Jinete Druida", speed: 16, token: "t5", kind: "E", aliases: ["Druidrider"] },
    { name: "Jinete Eduo", speed: 13, token: "t6", kind: "E", aliases: ["Haeduan"] },
    { name: "Ariete de madera", speed: 4, token: "t7", kind: "T", aliases: ["Ram"] },
    { name: "Catapulta de guerra", speed: 3, token: "t8", kind: "T", aliases: ["Trebuchet"] },
    { name: "Colono", speed: 5, token: "t9", kind: "R", aliases: ["Settler"] },
    { name: "Cacique", speed: 5, token: "t10", kind: "R", aliases: ["Chieftain"] },
    { name: "Heroe", speed: 7, token: "t11", kind: "H", aliases: ["Hero"] }
  ],
  EGIPTO: [
    { name: "Infante esclavo", speed: 7, token: "t1", kind: "C", aliases: ["Slave Militia"] },
    { name: "Guardia Ash", speed: 6, token: "t2", kind: "C", aliases: ["Ash Warden"] },
    { name: "Guerreros de Khopes", speed: 7, token: "t3", kind: "C", aliases: ["Khopesh Warrior"] },
    { name: "Explorador Sopdu", speed: 16, token: "t4", kind: "E", aliases: ["Sopdu Explorer", "Sophu Explorer"] },
    { name: "Guarda Osiris", speed: 15, token: "t5", kind: "E", aliases: ["Anhur Guard"] },
    { name: "Carro de Reshef", speed: 10, token: "t6", kind: "E", aliases: ["Resheph Chariot"] },
    { name: "Ariete", speed: 4, token: "t7", kind: "T", aliases: ["Ram"] },
    { name: "Catapulta de piedra", speed: 3, token: "t8", kind: "T", aliases: ["Stone Catapult"] },
    { name: "Colono", speed: 5, token: "t9", kind: "R", aliases: ["Settler"] },
    { name: "Visir", speed: 4, token: "t10", kind: "R", aliases: ["Nomarch"] },
    { name: "Heroe", speed: 7, token: "t11", kind: "H", aliases: ["Hero"] }
  ],
  HUNOS: [
    { name: "Mercenario", speed: 6, token: "t1", kind: "C", aliases: ["Mercenary"] },
    { name: "Arquero", speed: 6, token: "t2", kind: "C", aliases: ["Bowman"] },
    { name: "Observador", speed: 19, token: "t3", kind: "E", aliases: ["Spotter", "Scout"] },
    { name: "Jinete estepario", speed: 16, token: "t4", kind: "E", aliases: ["Steppe Rider", "Steppe"] },
    { name: "Jinete certero", speed: 16, token: "t5", kind: "E", aliases: ["Marksman"] },
    { name: "Merodeador", speed: 14, token: "t6", kind: "E", aliases: ["Marauder"] },
    { name: "Ariete", speed: 4, token: "t7", kind: "T", aliases: ["Ram"] },
    { name: "Catapulta", speed: 3, token: "t8", kind: "T", aliases: ["Catapult"] },
    { name: "Colono", speed: 5, token: "t9", kind: "R", aliases: ["Settler"] },
    { name: "Logades", speed: 5, token: "t10", kind: "R", aliases: ["Logades"] },
    { name: "Heroe", speed: 7, token: "t11", kind: "H", aliases: ["Hero"] }
  ],
  ESPARTANO: [
    { name: "Hoplite", speed: 6, token: "t1", kind: "C" },
    { name: "Sentinel", speed: 9, token: "t2", kind: "C", aliases: ["Scout"] },
    { name: "Shieldsman", speed: 8, token: "t3", kind: "C" },
    { name: "Twinsteel Therion", speed: 6, token: "t4", kind: "C" },
    { name: "Elpida Rider", speed: 16, token: "t5", kind: "E" },
    { name: "Corinthian Crusher", speed: 9, token: "t6", kind: "E" },
    { name: "Ram", speed: 4, token: "t7", kind: "T" },
    { name: "Ballista", speed: 3, token: "t8", kind: "T" },
    { name: "Settler", speed: 5, token: "t9", kind: "R", aliases: ["Colono"] },
    { name: "Ephor", speed: 4, token: "t10", kind: "R" },
    { name: "Heroe", speed: 7, token: "t11", kind: "H", aliases: ["Hero"] }
  ]
}

let attackRows = []
let attackNextId = 1
let attackEditorTarget = { kind: "draft", id: null }
let attackEditorState = null
let attackDraft = null
let attackMapLookupByServer = {}
let attackLastVillageLookup = {}
let attackAudioContext = null
let attackReminderLoopId = 0

function n0(v){
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function fmtInt(n){
  return String(Math.max(0, Math.floor(n0(n))))
}

function fmtTime(totalSeconds){
  const sec = Math.max(0, Math.floor(n0(totalSeconds)))
  const hh = Math.floor(sec / 3600)
  const mm = Math.floor((sec % 3600) / 60)
  const ss = sec % 60
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
}

function escapeHtml(text){
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function showStatus(message, type){
  const status = $("statusLine")
  status.className = "statusline"
  if(type === "ok") status.classList.add("status-ok")
  if(type === "bad") status.classList.add("status-bad")
  status.textContent = message
}

function fillSelect(selectEl, items, keep){
  if(!selectEl) return
  const previous = keep ? String(selectEl.value || "") : ""
  while(selectEl.firstChild) selectEl.removeChild(selectEl.firstChild)
  for(const item of items){
    const opt = document.createElement("option")
    opt.value = item.value
    opt.textContent = item.label
    selectEl.appendChild(opt)
  }
  if(keep && previous && items.some(item => item.value === previous)) selectEl.value = previous
  if(!selectEl.value && items.length) selectEl.value = items[0].value
}

function normalizeText(text){
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
}

function raceList(){
  return Object.keys(ATTACK_TROOPS_BY_RACE)
}

function getTroopsByRace(race){
  return ATTACK_TROOPS_BY_RACE[String(race || "").toUpperCase()] || []
}

function getTroopByName(race, troopName){
  const target = normalizeText(troopName)
  return getTroopsByRace(race).find((item) => {
    if(normalizeText(item.name) === target) return true
    return (Array.isArray(item.aliases) ? item.aliases : []).some(alias => normalizeText(alias) === target)
  }) || null
}

function getDefaultTroopNameForRace(race){
  return getTroopsByRace(race)[0]?.name || ""
}

function createTroopLine(race){
  return {
    uid: `line-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    name: getDefaultTroopNameForRace(race),
    quantity: 1
  }
}

function createDefaultDraft(race){
  const safeRace = String(race || "HUNOS").toUpperCase()
  return {
    race: safeRace,
    originX: "",
    originY: "",
    targetX: "",
    targetY: "",
    tournamentLevel: 0,
    arrivalAt: "",
    arrivalAuto: true,
    troops: [createTroopLine(safeRace)]
  }
}

function cloneTroops(lines, race){
  const safeRace = String(race || "HUNOS").toUpperCase()
  const copy = (Array.isArray(lines) ? lines : []).map((item) => ({
    uid: item?.uid || `line-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    name: String(item?.name || getDefaultTroopNameForRace(safeRace)),
    quantity: Math.max(0, Math.floor(n0(item?.quantity)))
  }))
  return copy.length ? copy : [createTroopLine(safeRace)]
}

function toCoords(x, y){
  const xx = Math.floor(n0(x))
  const yy = Math.floor(n0(y))
  return `(${xx}|${yy})`
}

function decodeSqlText(text){
  return String(text || "")
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\")
}

function updateAttackMapSqlStatus(message, type){
  const node = $("attackMapSqlStatus")
  node.textContent = message
  node.className = "attack-map-status"
  if(type === "ok") node.classList.add("ok")
  if(type === "bad") node.classList.add("bad")
}

function getManualAttackMapSqlText(){
  return String($("attackMapSqlInput")?.value || "").trim()
}

function parseMapSqlToVillageLookup(sqlText){
  const lookup = {}
  const text = String(sqlText || "")

  const applyVillage = (x, y, did, name) => {
    const key = `${Math.floor(n0(x))},${Math.floor(n0(y))}`
    const next = {
      x: Math.floor(n0(x)),
      y: Math.floor(n0(y)),
      did: Math.max(0, Math.floor(n0(did))),
      name: String(name || "").trim()
    }
    if(!lookup[key]){
      lookup[key] = next
      return
    }
    if(next.did > 0) lookup[key].did = next.did
    if(next.name) lookup[key].name = next.name
  }

  const vdataInsertRegex = /INSERT INTO\s+`vdata`\s+VALUES\s*(.+?);/gis
  let insertMatch
  while((insertMatch = vdataInsertRegex.exec(text)) !== null){
    const chunk = insertMatch[1]
    const rowRegex = /\((\d+),'((?:\\'|[^'])*)',(-?\d+),(-?\d+),/g
    let rowMatch
    while((rowMatch = rowRegex.exec(chunk)) !== null){
      applyVillage(rowMatch[3], rowMatch[4], rowMatch[1], decodeSqlText(rowMatch[2]))
    }
  }

  const xWorldInsertRegex = /INSERT INTO\s+`x_world`\s+VALUES\s*(.+?);/gis
  while((insertMatch = xWorldInsertRegex.exec(text)) !== null){
    const chunk = insertMatch[1]
    const rowRegex = /\(\s*\d+\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*\d+\s*,\s*(\d+)\s*,\s*'((?:\\'|[^'])*)'/g
    let rowMatch
    while((rowMatch = rowRegex.exec(chunk)) !== null){
      applyVillage(rowMatch[1], rowMatch[2], rowMatch[3], decodeSqlText(rowMatch[4]))
    }
  }

  return lookup
}

function parseManualAttackMapSql(){
  const text = getManualAttackMapSqlText()
  if(!text) return null
  const lookup = parseMapSqlToVillageLookup(text)
  const count = Object.keys(lookup).length
  if(!count) throw new Error("El map.sql manual no contiene aldeas validas.")
  return { lookup, count }
}

function refreshAttackMapSqlStatus(){
  const manualText = getManualAttackMapSqlText()
  if(!manualText){
    updateAttackMapSqlStatus("Se intentara usar el map.sql del proyecto por defecto.", "")
    return
  }
  try {
    const parsed = parseManualAttackMapSql()
    updateAttackMapSqlStatus(`map.sql manual listo: ${fmtInt(parsed?.count)} aldeas detectadas.`, "ok")
  } catch (_error){
    updateAttackMapSqlStatus("El map.sql manual no parece valido. Debe contener aldeas del mapa.", "bad")
  }
}

async function readMapSqlFile(file){
  return readTextFile(file, "No se pudo leer el archivo map.sql.")
}

async function readTextFile(file, errorMessage){
  if(!file) return ""
  if(typeof file.text === "function") return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error(errorMessage || "No se pudo leer el archivo."))
    reader.readAsText(file)
  })
}

async function getAttackVillageLookup(serverHost){
  const host = String(serverHost || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "")
  const manual = parseManualAttackMapSql()
  if(manual){
    updateAttackMapSqlStatus(`Usando map.sql manual: ${fmtInt(manual.count)} aldeas detectadas.`, "ok")
    attackLastVillageLookup = manual.lookup
    return manual.lookup
  }

  const localProjectUrl = new URL("../map.sql", window.location.href).toString()
  try {
    const localResponse = await fetch(localProjectUrl, { cache: "no-store" })
    if(localResponse.ok){
      const localText = await localResponse.text()
      const localLookup = parseMapSqlToVillageLookup(localText)
      const localCount = Object.keys(localLookup).length
      if(localCount){
        updateAttackMapSqlStatus(`Usando map.sql del proyecto: ${fmtInt(localCount)} aldeas detectadas.`, "ok")
        attackLastVillageLookup = localLookup
        return localLookup
      }
    }
  } catch (_error){
    // Seguimos con remoto.
  }

  if(!host){
    updateAttackMapSqlStatus("Falta servidor Travian o map.sql manual para resolver nombres.", "bad")
    return {}
  }
  if(attackMapLookupByServer[host]){
    attackLastVillageLookup = attackMapLookupByServer[host]
    return attackMapLookupByServer[host]
  }

  const response = await fetch(`https://${host}/map.sql`, { cache: "no-store" })
  if(!response.ok){
    updateAttackMapSqlStatus("No se pudo descargar map.sql remoto. Usa el archivo local o uno manual.", "bad")
    throw new Error(`HTTP ${response.status} al cargar map.sql desde ${host}.`)
  }
  const text = await response.text()
  const lookup = parseMapSqlToVillageLookup(text)
  const count = Object.keys(lookup).length
  if(!count){
    updateAttackMapSqlStatus("Se descargo map.sql pero no se encontraron aldeas validas.", "bad")
    throw new Error(`El map.sql remoto desde ${host} no contiene aldeas validas.`)
  }
  attackMapLookupByServer[host] = lookup
  attackLastVillageLookup = lookup
  updateAttackMapSqlStatus(`Usando map.sql remoto: ${fmtInt(count)} aldeas detectadas.`, "ok")
  return lookup
}

function getWrappedDistanceComponent(a, b){
  const raw = Math.abs(Math.floor(n0(a)) - Math.floor(n0(b)))
  return Math.min(raw, TRAVIAN_MAP_SIZE - raw)
}

function getVillageDistance(origin, target){
  const dx = getWrappedDistanceComponent(origin?.x, target?.x)
  const dy = getWrappedDistanceComponent(origin?.y, target?.y)
  if(!Number.isFinite(dx) || !Number.isFinite(dy)) return 0
  return Math.sqrt(dx * dx + dy * dy)
}

function getServerTroopFactor(){
  return SERVER_SPEED_TROOP_FACTOR[Math.floor(n0($("serverSpeed")?.value || 3))] || 1
}

function getTravelSeconds(distance, troopSpeed, tournamentLevel){
  const safeDistance = Math.max(0, Number(distance) || 0)
  const baseSpeed = Math.max(1, Number(troopSpeed) || 1) * getServerTroopFactor()
  const level = Math.max(0, Math.floor(n0(tournamentLevel)))
  if(safeDistance <= TOURNAMENT_FREE_TILES || level <= 0){
    return Math.ceil((safeDistance / baseSpeed) * 3600)
  }
  const boostedSpeed = baseSpeed * (1 + (level * TOURNAMENT_BONUS_PER_LEVEL))
  const seconds = ((TOURNAMENT_FREE_TILES / baseSpeed) + ((safeDistance - TOURNAMENT_FREE_TILES) / boostedSpeed)) * 3600
  return Math.ceil(seconds)
}

function getAttackReminderSeconds(){
  return Math.max(1, Math.floor(n0($("attackReminderSeconds")?.value || 60)))
}

function getAttackExtraMinutes(){
  return Math.max(0, Math.ceil(n0($("attackExtraMinutes")?.value || 0)))
}

function getAttackCountMultiplier(){
  return Math.max(1, Math.floor(n0($("attackCountMultiplier")?.value || 1)))
}

function getAttackKind(){
  return String($("attackKind")?.value || "REAL").toUpperCase() === "FAKE" ? "FAKE" : "REAL"
}

function getAttackServerHost(){
  return String($("attackServerHost")?.value || DEFAULT_ATTACK_SERVER_HOST).trim()
}

function parseCoordsFromAttack(attack){
  return {
    origin: {
      x: Math.floor(n0(attack?.originX)),
      y: Math.floor(n0(attack?.originY))
    },
    target: {
      x: Math.floor(n0(attack?.targetX)),
      y: Math.floor(n0(attack?.targetY))
    }
  }
}

function getVillageInfoByCoords(lookup, x, y){
  return lookup?.[`${Math.floor(n0(x))},${Math.floor(n0(y))}`] || null
}

function getValidTroopEntries(attack){
  const result = []
  for(const troop of Array.isArray(attack?.troops) ? attack.troops : []){
    const meta = getTroopByName(attack?.race, troop?.name)
    const quantity = Math.max(0, Math.floor(n0(troop?.quantity)))
    if(!meta || quantity <= 0) continue
    result.push({
      name: meta.name,
      quantity,
      speed: meta.speed,
      token: meta.token
    })
  }
  return result
}

function getSlowestTroopEntry(entries){
  if(!entries.length) return null
  return entries.reduce((slowest, item) => {
    if(!slowest) return item
    if(item.speed < slowest.speed) return item
    if(item.speed === slowest.speed && item.name.localeCompare(slowest.name, "es") < 0) return item
    return slowest
  }, null)
}

function getSelectedSlowestTroopEntry(entries, selectedName){
  const target = normalizeText(selectedName)
  if(target){
    const matched = entries.find(item => normalizeText(item.name) === target)
    if(matched) return matched
  }
  return getSlowestTroopEntry(entries)
}

function parseDateTimeLocal(value){
  const text = String(value || "").trim()
  if(!text) return null
  const date = new Date(text)
  if(Number.isNaN(date.getTime())) return null
  return date
}

function formatDateTimeLocal(date){
  const d = date instanceof Date ? new Date(date.getTime()) : new Date()
  const pad = (value) => String(value).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDateLabel(date){
  if(!(date instanceof Date) || Number.isNaN(date.getTime())) return "-"
  const pad = (value) => String(value).padStart(2, "0")
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatDateTimeLabel(date){
  if(!(date instanceof Date) || Number.isNaN(date.getTime())) return "-"
  const pad = (value) => String(value).padStart(2, "0")
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function addSeconds(date, seconds){
  return new Date(date.getTime() + (Math.floor(n0(seconds)) * 1000))
}

function ceilDateToMinute(date){
  const d = date instanceof Date ? new Date(date.getTime()) : new Date()
  if(d.getSeconds() > 0 || d.getMilliseconds() > 0) d.setMinutes(d.getMinutes() + 1)
  d.setSeconds(0, 0)
  return d
}

function buildAttackLink(attack, troopEntries){
  const host = String(getAttackServerHost() || DEFAULT_ATTACK_SERVER_HOST).trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "")
  if(!host || !troopEntries.length) return ""
  const coords = parseCoordsFromAttack(attack)
  const params = new URLSearchParams({
    id: "39",
    tt: "2",
    x: String(coords.target.x),
    y: String(coords.target.y),
    c: "3",
    gid: "16",
    eventType: "3"
  })
  for(const troop of troopEntries){
    params.append(`troop[${troop.token}]`, String(troop.quantity))
  }
  return `https://${host}/build.php?${params.toString()}`
}

function summarizeTroops(entries){
  if(!entries.length) return "Sin tropas configuradas."
  return entries.map(item => `${item.name}: ${fmtInt(item.quantity)}`).join(" · ")
}

function computeAttackRowView(attack, lookup){
  const coords = parseCoordsFromAttack(attack)
  const originInfo = getVillageInfoByCoords(lookup, coords.origin.x, coords.origin.y)
  const targetInfo = getVillageInfoByCoords(lookup, coords.target.x, coords.target.y)
  const distance = getVillageDistance(coords.origin, coords.target)
  const troopEntries = getValidTroopEntries(attack)
  const slowest = getSelectedSlowestTroopEntry(troopEntries, attack?.slowestTroopName)
  const travelSeconds = slowest ? getTravelSeconds(distance, slowest.speed, attack?.tournamentLevel) : 0
  const arrivalDate = parseDateTimeLocal(attack?.arrivalAt)
  const sendDate = arrivalDate ? addSeconds(arrivalDate, -travelSeconds) : null
  const reminderDate = sendDate ? addSeconds(sendDate, -getAttackReminderSeconds()) : null
  const reminderKey = reminderDate ? `${Math.floor(reminderDate.getTime() / 1000)}|${fmtInt(getAttackReminderSeconds())}` : ""
  return {
    originName: originInfo?.name || "Sin resolver",
    targetName: targetInfo?.name || "Sin resolver",
    originDid: originInfo?.did || 0,
    targetDid: targetInfo?.did || 0,
    distance,
    distanceLabel: distance > 0 ? distance.toFixed(2) : "0.00",
    troopEntries,
    slowest,
    travelSeconds,
    sendDate,
    arrivalDate,
    reminderDate,
    reminderKey,
    troopSummary: summarizeTroops(troopEntries),
    attackLink: buildAttackLink(attack, troopEntries)
  }
}

function getSuggestedArrivalDate(attack){
  const view = computeAttackRowView(attack, attackLastVillageLookup || {})
  const now = new Date()
  const baseSeconds = Math.max(0, view.travelSeconds) + (getAttackExtraMinutes() * 60)
  return ceilDateToMinute(addSeconds(now, baseSeconds))
}

function getSuggestedArrivalDateForPlanner(){
  const attacks = attackRows.length ? attackRows.slice() : []
  if(attackDraft) attacks.push(attackDraft)
  const longestTravel = attacks.reduce((max, attack) => {
    const view = computeAttackRowView(attack, attackLastVillageLookup || {})
    return Math.max(max, view.travelSeconds || 0)
  }, 0)
  return ceilDateToMinute(addSeconds(new Date(), longestTravel + (getAttackExtraMinutes() * 60)))
}

function syncDraftFromDom(){
  if(!attackDraft) return
  attackDraft.race = String($("attackRace")?.value || attackDraft.race || "HUNOS").toUpperCase()
  attackDraft.originX = String($("attackOriginX")?.value || "").trim()
  attackDraft.originY = String($("attackOriginY")?.value || "").trim()
  attackDraft.targetX = String($("attackTargetX")?.value || "").trim()
  attackDraft.targetY = String($("attackTargetY")?.value || "").trim()
  attackDraft.tournamentLevel = Math.max(0, Math.floor(n0($("attackTournamentLevel")?.value || 0)))
  attackDraft.arrivalAt = String($("attackArrivalAt")?.value || "").trim()
}

function syncDraftToDom(){
  if(!attackDraft) return
  $("attackRace").value = attackDraft.race
  $("attackOriginX").value = attackDraft.originX
  $("attackOriginY").value = attackDraft.originY
  $("attackTargetX").value = attackDraft.targetX
  $("attackTargetY").value = attackDraft.targetY
  $("attackTournamentLevel").value = String(Math.max(0, Math.floor(n0(attackDraft.tournamentLevel))))
  $("attackArrivalAt").value = attackDraft.arrivalAt
}

function openAttackEditor(kind, id){
  attackEditorTarget = { kind, id: id ?? null }
  let target = attackDraft
  if(kind === "row"){
    target = attackRows.find(item => item.id === id) || attackDraft
  }
  attackEditorState = {
    kind,
    id: id ?? null,
    race: String(target?.race || "HUNOS").toUpperCase(),
    troops: cloneTroops(target?.troops, target?.race)
  }
  renderAttackEditor()
}

function updateAttackTroopOptions(race){
  const datalist = $("attackTroopOptions")
  while(datalist.firstChild) datalist.removeChild(datalist.firstChild)
  for(const troop of getTroopsByRace(race)){
    const option = document.createElement("option")
    option.value = troop.name
    datalist.appendChild(option)
  }
}

function renderAttackEditor(){
  if(!attackEditorState) openAttackEditor("draft", null)
  const targetLabel = attackEditorState.kind === "draft"
    ? "Borrador actual"
    : (() => {
      const row = attackRows.find(item => item.id === attackEditorState.id)
      return row ? `Fila #${fmtInt(row.id)} · ${toCoords(row.originX, row.originY)} -> ${toCoords(row.targetX, row.targetY)}` : "Fila"
    })()
  $("attackEditorSubtitle").textContent = targetLabel
  updateAttackTroopOptions(attackEditorState.race)

  const list = $("attackEditorList")
  list.innerHTML = ""
  if(!attackEditorState.troops.length){
    const empty = document.createElement("div")
    empty.className = "attack-editor-empty"
    empty.textContent = "Todavia no hay tropas en el editor."
    list.appendChild(empty)
    return
  }

  for(const troop of attackEditorState.troops){
    const row = document.createElement("div")
    row.className = "attack-editor-row"
    row.innerHTML = `
      <div class="tool">
        <div class="tool-label">Tropa</div>
        <select class="attack-editor-name" data-line-id="${escapeHtml(troop.uid)}">
          ${getTroopsByRace(attackEditorState.race).map((option) => `<option value="${escapeHtml(option.name)}" ${option.name === troop.name ? "selected" : ""}>${escapeHtml(option.name)}</option>`).join("")}
        </select>
      </div>
      <div class="tool">
        <div class="tool-label">Cantidad</div>
        <input type="number" min="0" step="1" class="attack-editor-qty" data-line-id="${escapeHtml(troop.uid)}" value="${fmtInt(troop.quantity)}">
      </div>
      <button class="btn btn-small attack-editor-delete" type="button" data-line-id="${escapeHtml(troop.uid)}">X</button>
    `
    list.appendChild(row)
  }

  list.querySelectorAll(".attack-editor-name").forEach((input) => {
    const updateName = () => {
      const line = attackEditorState.troops.find(item => item.uid === input.getAttribute("data-line-id"))
      if(!line) return
      line.name = input.value
    }
    input.addEventListener("input", updateName)
    input.addEventListener("change", updateName)
  })
  list.querySelectorAll(".attack-editor-qty").forEach((input) => {
    input.addEventListener("input", () => {
      const line = attackEditorState.troops.find(item => item.uid === input.getAttribute("data-line-id"))
      if(!line) return
      line.quantity = Math.max(0, Math.floor(n0(input.value)))
    })
  })
  list.querySelectorAll(".attack-editor-delete").forEach((button) => {
    button.addEventListener("click", () => {
      attackEditorState.troops = attackEditorState.troops.filter(item => item.uid !== button.getAttribute("data-line-id"))
      if(!attackEditorState.troops.length) attackEditorState.troops = [createTroopLine(attackEditorState.race)]
      renderAttackEditor()
    })
  })
}

function saveAttackEditorTroops(){
  if(!attackEditorState) return
  const cleaned = cloneTroops(attackEditorState.troops, attackEditorState.race)
  if(attackEditorState.kind === "draft"){
    attackDraft.troops = cleaned
    showStatus("Tropas del borrador actualizadas.", "ok")
  } else {
    const row = attackRows.find(item => item.id === attackEditorState.id)
    if(row){
      row.troops = cleaned
      if(row.slowestTroopName && !getValidTroopEntries(row).some(item => normalizeText(item.name) === normalizeText(row.slowestTroopName))){
        row.slowestTroopName = ""
      }
      row.lastAlertKey = ""
      showStatus(`Tropas guardadas en la fila ${fmtInt(row.id)}.`, "ok")
    }
  }
  renderAttackPlanner()
}

function addEditorTroopLine(){
  if(!attackEditorState) return
  attackEditorState.troops.push(createTroopLine(attackEditorState.race))
  renderAttackEditor()
}

function applySuggestedArrivalToDraft(){
  syncDraftFromDom()
  const suggested = getSuggestedArrivalDateForPlanner()
  const suggestedValue = formatDateTimeLocal(suggested)
  attackDraft.arrivalAt = suggestedValue
  attackDraft.arrivalAuto = true
  $("attackArrivalAt").value = suggestedValue
  attackRows = attackRows.map((row) => ({
    ...row,
    arrivalAt: suggestedValue,
    realArrivalAt: row.realArrivalAt || suggestedValue,
    lastAlertKey: ""
  }))
  renderAttackPlanner()
}

function renderDraftPreview(lookup){
  const wrap = $("attackDraftPreview")
  const view = computeAttackRowView(attackDraft, lookup)
  wrap.innerHTML = `
    <div class="attack-preview-card">
      <div class="attack-preview-label">Origen</div>
      <div class="attack-preview-value">${escapeHtml(view.originName)}</div>
      <div class="attack-inline-help">${escapeHtml(toCoords(attackDraft.originX, attackDraft.originY))}</div>
    </div>
    <div class="attack-preview-card">
      <div class="attack-preview-label">Destino</div>
      <div class="attack-preview-value">${escapeHtml(view.targetName)}</div>
      <div class="attack-inline-help">${escapeHtml(toCoords(attackDraft.targetX, attackDraft.targetY))}</div>
    </div>
    <div class="attack-preview-card">
      <div class="attack-preview-label">Distancia</div>
      <div class="attack-preview-value">${escapeHtml(view.distanceLabel)} casillas</div>
    </div>
    <div class="attack-preview-card">
      <div class="attack-preview-label">Tropa lenta</div>
      <div class="attack-preview-value">${escapeHtml(view.slowest ? `${view.slowest.name} · ${fmtInt(view.slowest.speed)} c/h` : "Sin tropas")}</div>
    </div>
    <div class="attack-preview-card">
      <div class="attack-preview-label">Viaje</div>
      <div class="attack-preview-value">${escapeHtml(view.travelSeconds ? fmtTime(view.travelSeconds) : "-")}</div>
    </div>
    <div class="attack-preview-card">
      <div class="attack-preview-label">Llegada sugerida</div>
      <div class="attack-preview-value">${escapeHtml(formatDateTimeLabel(getSuggestedArrivalDateForPlanner()))}</div>
    </div>
  `
}

function getReminderBadge(view, row){
  if(!view.reminderDate || !view.sendDate) return `<span class="attack-pill bad">Sin fecha</span>`
  const now = Date.now()
  const reminderMs = view.reminderDate.getTime()
  const sendMs = view.sendDate.getTime()
  if(now > sendMs) return `<span class="attack-pill bad">Vencido</span>`
  if(now >= reminderMs){
    if(row?.lastAlertKey === view.reminderKey) return `<span class="attack-pill warn">${fmtInt(getAttackReminderSeconds())}</span>`
    return `<span class="attack-pill warn">${fmtInt(getAttackReminderSeconds())}</span>`
  }
  return `<span class="attack-pill">${fmtTime(Math.floor((reminderMs - now) / 1000))}</span>`
}

function renderAttackRows(lookup){
  const body = $("attackRowsBody")
  if(!attackRows.length){
    body.innerHTML = `<tr><td colspan="16" class="attack-empty">Todavia no hay ataques en la matriz.</td></tr>`
    return
  }

  body.innerHTML = attackRows.map((row) => {
    const view = computeAttackRowView(row, lookup)
    const now = Date.now()
    const sendMs = view.sendDate?.getTime() || 0
    const reminderMs = view.reminderDate?.getTime() || 0
    const rowClasses = [
      row.attackKind === "FAKE" ? "is-fake-attack" : "is-real-attack",
      now > sendMs && sendMs > 0 ? "is-overdue" : "",
      now >= reminderMs && now <= sendMs && reminderMs > 0 ? "is-alerting" : ""
    ].filter(Boolean).join(" ")
    const slowestOptions = view.troopEntries.length
      ? view.troopEntries.map((item) => `<option value="${escapeHtml(item.name)}" ${view.slowest?.name === item.name ? "selected" : ""}>${escapeHtml(item.name)} · ${fmtInt(item.speed)} c/h</option>`).join("")
      : `<option value="">Sin tropas</option>`
    return `
      <tr class="${rowClasses}" data-attack-id="${fmtInt(row.id)}">
        <td>${fmtInt(row.id)}</td>
        <td>
          <div class="attack-name">${escapeHtml(view.originName)}</div>
          <div class="attack-sub">${escapeHtml(toCoords(row.originX, row.originY))} · ${escapeHtml(row.race)}</div>
        </td>
        <td>
          <div class="attack-name">${escapeHtml(view.targetName)}</div>
          <div class="attack-sub">${escapeHtml(toCoords(row.targetX, row.targetY))}</div>
        </td>
        <td>
          <select class="attack-slowest-select" data-attack-id="${fmtInt(row.id)}" ${view.troopEntries.length ? "" : "disabled"}>
            ${slowestOptions}
          </select>
          <div class="attack-sub">${escapeHtml(view.slowest ? `${fmtInt(view.slowest.speed)} c/h` : "Sin tropas")}</div>
        </td>
        <td><span class="attack-pill">${escapeHtml(row.attackKind === "FAKE" ? "FAKE" : "REAL")}</span></td>
        <td>${escapeHtml(view.distanceLabel)}</td>
        <td>${escapeHtml(view.travelSeconds ? fmtTime(view.travelSeconds) : "-")}</td>
        <td>${getReminderBadge(view, row)}</td>
        <td><div class="attack-summary-list">${view.troopEntries.length ? view.troopEntries.map(item => `<span>${escapeHtml(item.name)}: ${fmtInt(item.quantity)}</span>`).join("") : `<span class="attack-sub">Sin tropas</span>`}</div></td>
        <td><span class="attack-pill">x${fmtInt(row.attackCountMultiplier || getAttackCountMultiplier())}</span></td>
        <td class="attack-send-time">
          <div class="attack-name">${escapeHtml(formatDateLabel(view.sendDate))}</div>
          <div class="attack-sub">${escapeHtml(view.sendDate ? view.sendDate.toLocaleDateString("es-CO") : "-")}</div>
        </td>
        <td class="attack-send-time">
          <div class="attack-name">${escapeHtml(formatDateLabel(view.sendDate))}</div>
          <div class="attack-sub">${escapeHtml(view.sendDate ? view.sendDate.toLocaleDateString("es-CO") : "-")}</div>
        </td>
        <td class="attack-send-time">
          <div class="attack-name">${escapeHtml(formatDateLabel(view.arrivalDate))}</div>
          <div class="attack-sub">${escapeHtml(view.arrivalDate ? view.arrivalDate.toLocaleDateString("es-CO") : "-")}</div>
        </td>
        <td>
          <input class="attack-real-arrival-input" type="datetime-local" data-attack-id="${fmtInt(row.id)}" value="${escapeHtml(row.realArrivalAt || row.arrivalAt || "")}">
        </td>
        <td>
          <div class="attack-link-actions">
            <a class="btn btn-orange btn-small" href="${escapeHtml(view.attackLink || "#")}" target="_blank" rel="noopener noreferrer" ${view.attackLink ? "" : "aria-disabled=\"true\""}>Abrir</a>
            <button class="btn btn-small attack-copy-link" type="button" data-attack-id="${fmtInt(row.id)}" ${view.attackLink ? "" : "disabled"}>Copiar</button>
          </div>
        </td>
        <td>
          <div class="attack-row-actions">
            <button class="btn btn-small attack-edit" type="button" data-attack-id="${fmtInt(row.id)}">Editar tropas</button>
            <button class="btn btn-small attack-use-base" type="button" data-attack-id="${fmtInt(row.id)}">Usar base</button>
            <button class="btn btn-small attack-delete" type="button" data-attack-id="${fmtInt(row.id)}">Borrar</button>
          </div>
        </td>
      </tr>
    `
  }).join("")

  body.querySelectorAll(".attack-edit").forEach((button) => {
    button.addEventListener("click", () => {
      openAttackEditor("row", Math.floor(n0(button.getAttribute("data-attack-id"))))
    })
  })
  body.querySelectorAll(".attack-slowest-select").forEach((select) => {
    select.addEventListener("change", () => {
      const row = attackRows.find(item => item.id === Math.floor(n0(select.getAttribute("data-attack-id"))))
      if(!row) return
      row.slowestTroopName = String(select.value || "").trim()
      row.lastAlertKey = ""
      renderAttackPlanner()
      showStatus(`Tropa lenta actualizada en fila ${fmtInt(row.id)}.`, "ok")
    })
  })
  body.querySelectorAll(".attack-real-arrival-input").forEach((input) => {
    input.addEventListener("input", () => {
      const row = attackRows.find(item => item.id === Math.floor(n0(input.getAttribute("data-attack-id"))))
      if(!row) return
      row.realArrivalAt = String(input.value || "").trim()
    })
    input.addEventListener("change", () => {
      const row = attackRows.find(item => item.id === Math.floor(n0(input.getAttribute("data-attack-id"))))
      if(!row) return
      row.realArrivalAt = String(input.value || "").trim()
      showStatus(`Hora de llegada real actualizada en fila ${fmtInt(row.id)}.`, "ok")
    })
  })
  body.querySelectorAll(".attack-use-base").forEach((button) => {
    button.addEventListener("click", () => {
      const row = attackRows.find(item => item.id === Math.floor(n0(button.getAttribute("data-attack-id"))))
      if(!row) return
      attackDraft = {
        race: row.race,
        originX: row.originX,
        originY: row.originY,
        targetX: row.targetX,
        targetY: row.targetY,
        tournamentLevel: row.tournamentLevel,
        arrivalAt: row.arrivalAt,
        arrivalAuto: false,
        slowestTroopName: row.slowestTroopName || "",
        troops: cloneTroops(row.troops, row.race)
      }
      syncDraftToDom()
      openAttackEditor("draft", null)
      renderAttackPlanner()
      showStatus(`La fila ${fmtInt(row.id)} se cargo en el borrador.`, "ok")
    })
  })
  body.querySelectorAll(".attack-delete").forEach((button) => {
    button.addEventListener("click", () => {
      const rowId = Math.floor(n0(button.getAttribute("data-attack-id")))
      attackRows = attackRows.filter(item => item.id !== rowId)
      if(attackEditorTarget.kind === "row" && attackEditorTarget.id === rowId) openAttackEditor("draft", null)
      renderAttackPlanner()
      showStatus(`Fila ${fmtInt(rowId)} eliminada.`, "ok")
    })
  })
  body.querySelectorAll(".attack-copy-link").forEach((button) => {
    button.addEventListener("click", async () => {
      const row = attackRows.find(item => item.id === Math.floor(n0(button.getAttribute("data-attack-id"))))
      if(!row) return
      const view = computeAttackRowView(row, lookup)
      if(!view.attackLink) return
      try {
        await copyTextToClipboard(view.attackLink)
        showStatus(`Link de la fila ${fmtInt(row.id)} copiado al portapapeles.`, "ok")
      } catch (error){
        showStatus(String(error?.message || "No se pudo copiar el link."), "bad")
      }
    })
  })
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
    if(!ok) throw new Error("No se pudo copiar el texto.")
  } finally {
    document.body.removeChild(area)
  }
}

function serializeAttackForConfig(row){
  const arrivalDate = parseDateTimeLocal(row?.arrivalAt)
  const realArrivalDate = parseDateTimeLocal(row?.realArrivalAt || row?.arrivalAt)
  return {
    id: Math.max(0, Math.floor(n0(row?.id))),
    race: String(row?.race || "HUNOS").toUpperCase(),
    originX: String(row?.originX ?? ""),
    originY: String(row?.originY ?? ""),
    targetX: String(row?.targetX ?? ""),
    targetY: String(row?.targetY ?? ""),
    tournamentLevel: Math.max(0, Math.floor(n0(row?.tournamentLevel))),
    attackCountMultiplier: Math.max(1, Math.floor(n0(row?.attackCountMultiplier || getAttackCountMultiplier()))),
    attackKind: String(row?.attackKind || getAttackKind()).toUpperCase() === "FAKE" ? "FAKE" : "REAL",
    slowestTroopName: String(row?.slowestTroopName || ""),
    arrivalAtIso: arrivalDate ? arrivalDate.toISOString() : "",
    realArrivalAtIso: realArrivalDate ? realArrivalDate.toISOString() : "",
    troops: cloneTroops(row?.troops, row?.race)
  }
}

function buildAttackConfigExport(){
  return {
    schema: ATTACK_CONFIG_SCHEMA,
    version: ATTACK_CONFIG_VERSION,
    exportedAt: new Date().toISOString(),
    settings: {
      serverSpeed: String($("serverSpeed")?.value || "3"),
      serverHost: getAttackServerHost(),
      reminderSeconds: getAttackReminderSeconds(),
      extraMinutes: getAttackExtraMinutes(),
      attackCountMultiplier: getAttackCountMultiplier(),
      attackKind: getAttackKind()
    },
    draft: serializeAttackForConfig(attackDraft || createDefaultDraft("HUNOS")),
    attacks: attackRows.map(serializeAttackForConfig)
  }
}

function downloadTextFile(filename, text, mimeType){
  const blob = new Blob([String(text || "")], { type: mimeType || "text/plain" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function exportAttackConfig(){
  if(!attackRows.length){
    showStatus("No hay ataques para exportar.", "bad")
    return
  }
  const config = buildAttackConfigExport()
  const filename = `planificador-ataques-${new Date().toISOString().slice(0, 10)}.json`
  downloadTextFile(filename, JSON.stringify(config, null, 2), "application/json")
  showStatus(`Configuracion exportada: ${fmtInt(attackRows.length)} ataques.`, "ok")
}

function buildAttackReport(lookup){
  if(!attackRows.length) throw new Error("No hay ataques para reportar.")
  return attackRows.map((row) => {
    const coords = parseCoordsFromAttack(row)
    const view = computeAttackRowView(row, lookup || attackLastVillageLookup || {})
    const realArrival = parseDateTimeLocal(row.realArrivalAt || row.arrivalAt)
    return `${view.targetName} ${toCoords(coords.target.x, coords.target.y)} - ${formatDateTimeLabel(realArrival)}`
  }).join("\n")
}

async function generateAttackReport(){
  try {
    const report = buildAttackReport(attackLastVillageLookup || {})
    await copyTextToClipboard(report)
    showStatus(`Reporte copiado al portapapeles: ${fmtInt(attackRows.length)} ataques.`, "ok")
  } catch (error){
    showStatus(String(error?.message || "No se pudo generar el reporte."), "bad")
  }
}

function dateTimeLocalFromImportedIso(value){
  const text = String(value || "").trim()
  if(!text) return ""
  const date = new Date(text)
  if(Number.isNaN(date.getTime())) return ""
  return formatDateTimeLocal(date)
}

function hydrateAttackFromConfig(item, fallbackId){
  const race = String(item?.race || "HUNOS").toUpperCase()
  const arrivalAt = dateTimeLocalFromImportedIso(item?.arrivalAtIso) || String(item?.arrivalAt || "").trim()
  const realArrivalAt = dateTimeLocalFromImportedIso(item?.realArrivalAtIso) || String(item?.realArrivalAt || arrivalAt || "").trim()
  return {
    id: Math.max(1, Math.floor(n0(item?.id || fallbackId))),
    race,
    originX: String(item?.originX ?? ""),
    originY: String(item?.originY ?? ""),
    targetX: String(item?.targetX ?? ""),
    targetY: String(item?.targetY ?? ""),
    tournamentLevel: Math.max(0, Math.floor(n0(item?.tournamentLevel))),
    attackCountMultiplier: Math.max(1, Math.floor(n0(item?.attackCountMultiplier || getAttackCountMultiplier()))),
    attackKind: String(item?.attackKind || getAttackKind()).toUpperCase() === "FAKE" ? "FAKE" : "REAL",
    slowestTroopName: String(item?.slowestTroopName || ""),
    arrivalAt,
    realArrivalAt,
    troops: cloneTroops(item?.troops, race),
    lastAlertKey: ""
  }
}

function applyAttackConfig(config){
  if(!config || config.schema !== ATTACK_CONFIG_SCHEMA || !Array.isArray(config.attacks)){
    throw new Error("El archivo no es una configuracion valida del planificador de ataques.")
  }
  if(config.settings){
    if(config.settings.serverSpeed != null) $("serverSpeed").value = String(config.settings.serverSpeed)
    if(config.settings.serverHost != null) $("attackServerHost").value = String(config.settings.serverHost)
    if(config.settings.reminderSeconds != null) $("attackReminderSeconds").value = fmtInt(config.settings.reminderSeconds)
    if(config.settings.extraMinutes != null) $("attackExtraMinutes").value = fmtInt(config.settings.extraMinutes)
    if(config.settings.attackCountMultiplier != null) $("attackCountMultiplier").value = String(Math.max(1, Math.floor(n0(config.settings.attackCountMultiplier))))
    if(config.settings.attackKind != null) $("attackKind").value = String(config.settings.attackKind).toUpperCase() === "FAKE" ? "FAKE" : "REAL"
  }

  attackRows = config.attacks.map((item, idx) => hydrateAttackFromConfig(item, idx + 1))
  attackNextId = attackRows.reduce((max, row) => Math.max(max, row.id), 0) + 1
  const draftSource = config.draft || attackRows[0] || createDefaultDraft("HUNOS")
  const draft = hydrateAttackFromConfig(draftSource, 0)
  attackDraft = {
    race: draft.race,
    originX: draft.originX,
    originY: draft.originY,
    targetX: draft.targetX,
    targetY: draft.targetY,
    tournamentLevel: draft.tournamentLevel,
    arrivalAt: draft.arrivalAt,
    arrivalAuto: false,
    realArrivalAt: draft.realArrivalAt,
    slowestTroopName: draft.slowestTroopName,
    troops: cloneTroops(draft.troops, draft.race)
  }
  syncDraftToDom()
  openAttackEditor("draft", null)
  renderAttackPlanner()
  showStatus(`Configuracion importada: ${fmtInt(attackRows.length)} ataques listos.`, "ok")
}

async function importAttackConfigFile(file){
  const text = await readTextFile(file, "No se pudo leer la configuracion.")
  const config = JSON.parse(text)
  applyAttackConfig(config)
}

function validateDraftAttack(){
  syncDraftFromDom()
  if(attackDraft.originX === "" || attackDraft.originY === "") throw new Error("Define coordenadas de aldea origen.")
  if(attackDraft.targetX === "" || attackDraft.targetY === "") throw new Error("Define coordenadas de aldea destino.")
  if(!parseDateTimeLocal(attackDraft.arrivalAt)) throw new Error("Define una hora objetivo de llegada valida.")
  if(!getValidTroopEntries(attackDraft).length) throw new Error("Configura al menos una tropa con cantidad mayor a cero.")
}

function addDraftAttack(){
  try {
    validateDraftAttack()
    const row = {
      id: attackNextId++,
      race: attackDraft.race,
      originX: attackDraft.originX,
      originY: attackDraft.originY,
      targetX: attackDraft.targetX,
      targetY: attackDraft.targetY,
      tournamentLevel: Math.max(0, Math.floor(n0(attackDraft.tournamentLevel))),
      attackCountMultiplier: getAttackCountMultiplier(),
      attackKind: getAttackKind(),
      slowestTroopName: attackDraft.slowestTroopName || "",
      arrivalAt: attackDraft.arrivalAt,
      realArrivalAt: attackDraft.arrivalAt,
      troops: cloneTroops(attackDraft.troops, attackDraft.race),
      lastAlertKey: ""
    }
    attackRows.push(row)
    renderAttackPlanner()
    showStatus(`Fila ${fmtInt(row.id)} agregada al planificador.`, "ok")
  } catch (error){
    showStatus(String(error?.message || "No se pudo agregar la fila."), "bad")
  }
}

function requestAttackNotifications(){
  if(!("Notification" in window)){
    showStatus("Este navegador no soporta notificaciones.", "bad")
    return
  }
  Notification.requestPermission().then((permission) => {
    updateNotificationsButton()
    if(permission === "granted") showStatus("Notificaciones activadas.", "ok")
    else showStatus("Notificaciones no permitidas. Se usara sonido y aviso visual.", "bad")
  })
}

function updateNotificationsButton(){
  const button = $("btnAttackNotifications")
  if(!("Notification" in window)){
    button.textContent = "Notificaciones no disponibles"
    button.disabled = true
    return
  }
  const permission = Notification.permission
  if(permission === "granted") button.textContent = "Notificaciones activadas"
  else if(permission === "denied") button.textContent = "Notificaciones bloqueadas"
  else button.textContent = "Activar notificaciones"
}

function getAttackAudioContext(){
  if(attackAudioContext) return attackAudioContext
  const AudioCtor = window.AudioContext || window.webkitAudioContext
  if(!AudioCtor) return null
  attackAudioContext = new AudioCtor()
  return attackAudioContext
}

function unlockAttackAudio(){
  const ctx = getAttackAudioContext()
  if(!ctx) return
  if(ctx.state === "suspended"){
    ctx.resume().catch(() => {})
  }
}

function playAttackReminderSound(){
  const ctx = getAttackAudioContext()
  if(!ctx) return
  const base = ctx.currentTime + 0.01
  ;[880, 660, 880].forEach((frequency, idx) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(frequency, base + (idx * 0.22))
    gain.gain.setValueAtTime(0.0001, base + (idx * 0.22))
    gain.gain.exponentialRampToValueAtTime(0.12, base + (idx * 0.22) + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, base + (idx * 0.22) + 0.18)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(base + (idx * 0.22))
    osc.stop(base + (idx * 0.22) + 0.2)
  })
}

function notifyAttackRow(row, view){
  playAttackReminderSound()
  if("Notification" in window && Notification.permission === "granted"){
    new Notification("Ataque por enviar", {
      body: `Fila ${fmtInt(row.id)} · Enviar ${formatDateLabel(view.sendDate)} hacia ${view.targetName}`,
      tag: `attack-reminder-${fmtInt(row.id)}`
    })
  }
}

function processAttackReminders(){
  const lookup = attackLastVillageLookup || {}
  const now = Date.now()
  let triggered = false
  for(const row of attackRows){
    const view = computeAttackRowView(row, lookup)
    if(!view.reminderDate || !view.sendDate || !view.reminderKey) continue
    const reminderMs = view.reminderDate.getTime()
    const sendMs = view.sendDate.getTime()
    if(now < reminderMs || now > sendMs) continue
    if(row.lastAlertKey === view.reminderKey) continue
    row.lastAlertKey = view.reminderKey
    notifyAttackRow(row, view)
    triggered = true
  }
  if(triggered) renderAttackRows(lookup)
}

function renderAttackPlannerWithLookup(lookup){
  renderDraftPreview(lookup)
  renderAttackRows(lookup)
  renderAttackEditor()
}

async function renderAttackPlanner(){
  syncDraftFromDom()
  try {
    const lookup = await getAttackVillageLookup(getAttackServerHost())
    renderAttackPlannerWithLookup(lookup || {})
  } catch (error){
    renderAttackPlannerWithLookup(attackLastVillageLookup || {})
    showStatus(String(error?.message || "No se pudo resolver el map.sql."), "bad")
  }
}

function startAttackReminderLoop(){
  if(attackReminderLoopId) window.clearInterval(attackReminderLoopId)
  attackReminderLoopId = window.setInterval(() => {
    renderAttackRows(attackLastVillageLookup || {})
    processAttackReminders()
  }, 1000)
}

function initAttackRaceSelect(){
  fillSelect($("attackRace"), raceList().map(item => ({ value: item, label: item })), false)
}

function initTournamentLevelSelect(){
  fillSelect($("attackTournamentLevel"), Array.from({ length: 21 }, (_, idx) => ({
    value: String(idx),
    label: String(idx)
  })), false)
  $("attackTournamentLevel").value = "0"
}

function bindDraftEvents(){
  $("serverSpeed").addEventListener("change", () => {
    renderAttackPlanner()
  })
  $("attackServerHost").addEventListener("input", () => {
    renderAttackPlanner()
  })
  $("attackReminderSeconds").addEventListener("input", () => {
    renderAttackPlanner()
  })
  $("attackExtraMinutes").addEventListener("input", () => {
    renderAttackPlanner()
  })
  $("attackCountMultiplier").addEventListener("change", () => {
    renderAttackPlanner()
  })
  $("attackKind").addEventListener("change", () => {
    renderAttackPlanner()
  })
  $("attackRace").addEventListener("change", () => {
    const nextRace = String($("attackRace").value || "HUNOS").toUpperCase()
    attackDraft.race = nextRace
    attackDraft.troops = cloneTroops(attackDraft.troops, nextRace).map((line, idx) => {
      if(getTroopByName(nextRace, line.name)) return line
      return idx === 0 ? createTroopLine(nextRace) : null
    }).filter(Boolean)
    if(!attackDraft.troops.length) attackDraft.troops = [createTroopLine(nextRace)]
    if(attackEditorTarget.kind === "draft") openAttackEditor("draft", null)
    renderAttackPlanner()
  })
  ;["attackOriginX", "attackOriginY", "attackTargetX", "attackTargetY", "attackTournamentLevel"].forEach((id) => {
    $(id).addEventListener("input", () => {
      renderAttackPlanner()
    })
    $(id).addEventListener("change", () => {
      renderAttackPlanner()
    })
  })
  $("attackArrivalAt").addEventListener("input", () => {
    attackDraft.arrivalAuto = false
    syncDraftFromDom()
    renderAttackPlanner()
  })
  $("attackMapSqlInput").addEventListener("input", () => {
    refreshAttackMapSqlStatus()
    renderAttackPlanner()
  })
  $("attackMapSqlFile").addEventListener("change", async (event) => {
    const file = event.target.files?.[0]
    if(!file) return
    try {
      $("attackMapSqlInput").value = await readMapSqlFile(file)
      refreshAttackMapSqlStatus()
      renderAttackPlanner()
      showStatus(`OK. map.sql cargado: ${file.name}`, "ok")
    } catch (_error){
      updateAttackMapSqlStatus("No se pudo leer el archivo map.sql.", "bad")
      showStatus("No se pudo leer el archivo map.sql.", "bad")
    } finally {
      event.target.value = ""
    }
  })
  $("btnClearAttackMapSql").addEventListener("click", () => {
    $("attackMapSqlInput").value = ""
    refreshAttackMapSqlStatus()
    renderAttackPlanner()
  })
  $("btnUseSuggestedArrival").addEventListener("click", () => {
    applySuggestedArrivalToDraft()
  })
  $("btnAddAttackRow").addEventListener("click", () => {
    addDraftAttack()
  })
  $("btnEditDraftTroops").addEventListener("click", () => {
    openAttackEditor("draft", null)
  })
  $("btnAttackReport").addEventListener("click", () => {
    generateAttackReport()
  })
  $("btnExportAttackConfig").addEventListener("click", () => {
    exportAttackConfig()
  })
  $("attackConfigFile").addEventListener("change", async (event) => {
    const file = event.target.files?.[0]
    if(!file) return
    try {
      await importAttackConfigFile(file)
    } catch (error){
      showStatus(String(error?.message || "No se pudo importar la configuracion."), "bad")
    } finally {
      event.target.value = ""
    }
  })
  $("btnAddEditorTroop").addEventListener("click", () => {
    addEditorTroopLine()
  })
  $("btnSaveEditorTroops").addEventListener("click", () => {
    saveAttackEditorTroops()
  })
  $("btnAttackNotifications").addEventListener("click", () => {
    requestAttackNotifications()
  })
  document.addEventListener("click", unlockAttackAudio, { passive: true })
}

async function init(){
  initAttackRaceSelect()
  initTournamentLevelSelect()
  attackDraft = createDefaultDraft("HUNOS")
  syncDraftToDom()
  openAttackEditor("draft", null)
  updateNotificationsButton()
  refreshAttackMapSqlStatus()
  bindDraftEvents()
  startAttackReminderLoop()
  await renderAttackPlanner()
}

init().catch((error) => {
  showStatus(String(error?.message || "No se pudo iniciar el planificador de ataques."), "bad")
})
