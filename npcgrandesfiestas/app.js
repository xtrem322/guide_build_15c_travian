const $ = (id) => document.getElementById(id)

const RESOURCE_KEYS = ["wood", "clay", "iron", "crop"]
const PARTY_COST = withResourceTotal({
  wood: 29700,
  clay: 33250,
  iron: 32000,
  crop: 6700
})

let allVillages = []
let partyCentralKey = ""
let partyVillageId = 0
let partyLastImportSummary = "Sin datos importados."
let partyLastRenderedPlan = null
let partySplitModeByVillage = {}

function isInitialZoneVillageName(name){
  return /^ZI/i.test(String(cleanVillageNameText(name) || "").trim())
}

function n0(v){
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function fmtInt(n){
  return String(Math.max(0, Math.floor(n0(n))))
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
  const previous = keep ? sel.value : ""
  clearSelect(sel)
  for(const item of items){
    const opt = document.createElement("option")
    opt.value = item.value
    opt.textContent = item.label
    sel.appendChild(opt)
  }
  if(keep && previous && items.some(item => item.value === previous)) sel.value = previous
  if(!sel.value && sel.options.length) sel.value = sel.options[0].value
}

function compareVillageOrder(a, b){
  const byOrder = n0(a?.sourceOrder) - n0(b?.sourceOrder)
  if(byOrder) return byOrder
  return String(a?.name || "").localeCompare(String(b?.name || ""), "es")
}

function fixCommonMojibake(text){
  return String(text || "")
    .replace(/ÃƒÂ¡/g, "a")
    .replace(/ÃƒÂ©/g, "e")
    .replace(/ÃƒÂ­/g, "i")
    .replace(/ÃƒÂ³/g, "o")
    .replace(/ÃƒÂº/g, "u")
    .replace(/ÃƒÂ±/g, "n")
    .replace(/ÃƒÃ/g, "A")
    .replace(/Ãƒâ€°/g, "E")
    .replace(/ÃƒÃ/g, "I")
    .replace(/Ãƒâ€œ/g, "O")
    .replace(/ÃƒÅ¡/g, "U")
    .replace(/Ãƒâ€˜/g, "N")
}

function zeroResources(){
  return { wood:0, clay:0, iron:0, crop:0, total:0 }
}

function withResourceTotal(resources){
  const next = {
    wood: Math.max(0, Math.floor(n0(resources?.wood))),
    clay: Math.max(0, Math.floor(n0(resources?.clay))),
    iron: Math.max(0, Math.floor(n0(resources?.iron))),
    crop: Math.max(0, Math.floor(n0(resources?.crop))),
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

function multiplyResources(resources, factor){
  return withResourceTotal({
    wood: n0(resources?.wood) * factor,
    clay: n0(resources?.clay) * factor,
    iron: n0(resources?.iron) * factor,
    crop: n0(resources?.crop) * factor
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

function getResourceSurplus(current, required){
  return withResourceTotal({
    wood: Math.max(0, n0(current?.wood) - n0(required?.wood)),
    clay: Math.max(0, n0(current?.clay) - n0(required?.clay)),
    iron: Math.max(0, n0(current?.iron) - n0(required?.iron)),
    crop: Math.max(0, n0(current?.crop) - n0(required?.crop))
  })
}

function hasEnoughResources(have, need){
  return n0(have?.wood) >= n0(need?.wood) &&
    n0(have?.clay) >= n0(need?.clay) &&
    n0(have?.iron) >= n0(need?.iron) &&
    n0(have?.crop) >= n0(need?.crop)
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

function normalizeVillageKey(name){
  return fixCommonMojibake(name)
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
    .replace(/[âˆ’â€“â€”]/g, "-")
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
    if(/^Capacity$/i.test(lines[i])) return i + 1
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

function defaultVillage(data, previous){
  const base = previous ? { ...previous } : {
    id: ++partyVillageId,
    sourceOrder: Math.max(0, Math.floor(n0(data.sourceOrder))),
    partyCount: 1,
    isInitialZone: false,
    isDelivered: false,
    isExcluded: false
  }

  const name = cleanVillageNameText(data.name)
  const isInitialZone = isInitialZoneVillageName(name)
  const shouldExclude = isInitialZone || Boolean(base.isExcluded)

  return {
    ...base,
    name,
    key: data.key,
    sourceOrder: Math.max(0, Math.floor(n0(data.sourceOrder ?? base.sourceOrder))),
    warehouseCap: Math.max(0, Math.floor(n0(data.warehouseCap))),
    granaryCap: Math.max(0, Math.floor(n0(data.granaryCap))),
    current: withResourceTotal(data.current),
    hasResources: Boolean(data.hasResources),
    partyCount: n0(base.partyCount) === 2 ? 2 : 1,
    isInitialZone,
    isExcluded: shouldExclude
  }
}

function importPartyVillages(){
  const capacityRows = parseTravianTable($("partyCapacityInput").value, parseCapacityRow, "capacity")
  const resourceRows = parseTravianTable($("partyResourcesInput").value, parseResourcesRow, "resources")
  const prevByKey = new Map(allVillages.map(village => [village.key, village]))
  const resourceMap = new Map(resourceRows.map(row => [row.key, row]))
  const resourceOrderMap = new Map(resourceRows.map((row, idx) => [row.key, idx]))
  const capacityOrderMap = new Map(capacityRows.map((row, idx) => [row.key, idx]))
  const merged = []

  for(const capacity of capacityRows){
    const resource = resourceMap.get(capacity.key)
    const sourceOrder = resourceOrderMap.has(capacity.key)
      ? resourceOrderMap.get(capacity.key)
      : resourceRows.length + n0(capacityOrderMap.get(capacity.key))

    merged.push(defaultVillage({
      ...capacity,
      sourceOrder,
      current: resource ? resource.current : zeroResources(),
      hasResources: Boolean(resource)
    }, prevByKey.get(capacity.key)))
  }

  merged.sort(compareVillageOrder)
  allVillages = merged

  if(!allVillages.some(village => village.key === partyCentralKey)){
    partyCentralKey = findRecommendedCentralKey()
  }

  return {
    capacityCount: capacityRows.length,
    resourceCount: resourceRows.length,
    mergedCount: merged.length,
    matchedCount: merged.filter(village => village.hasResources).length,
    missingResourceCount: merged.filter(village => !village.hasResources).length
  }
}

function getVillagePartyCount(village){
  return n0(village?.partyCount) === 2 ? 2 : 1
}

function setVillagePartyCount(villageKey, count){
  const village = allVillages.find(item => item.key === villageKey)
  if(!village) return
  village.partyCount = Math.floor(n0(count)) === 2 ? 2 : 1
}

function getPartyRequirementForCount(count){
  const normalized = Math.floor(n0(count)) === 2 ? 2 : 1
  return multiplyResources(PARTY_COST, normalized)
}

function getPartyRequirementForVillage(village){
  return getPartyRequirementForCount(getVillagePartyCount(village))
}

function buildPartyCountsForVillage(village){
  return [{ label:"GF", troopName:"Grandes fiestas", units:getVillagePartyCount(village) }]
}

function getConfiguredPartyCountTotal(villages){
  return (Array.isArray(villages) ? villages : []).reduce((acc, village) => acc + getVillagePartyCount(village), 0)
}

function getCentralCandidates(){
  return allVillages.filter(village => !village.isInitialZone).slice().sort(compareVillageOrder)
}

function getVillageTotalCapacity(village){
  return Math.max(0, Math.floor(n0(village?.warehouseCap) * 3 + n0(village?.granaryCap)))
}

function findRecommendedCentralKey(){
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

function getActiveDestinationVillages(){
  return allVillages.filter(village => village.key !== partyCentralKey && !village.isExcluded)
}

function getExerciseVillages(){
  return allVillages.filter(village => !village.isExcluded || village.key === partyCentralKey)
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

function getPartyRowStatus(plan){
  if(n0(plan?.supportFromCentral?.total) > 0 && n0(plan?.supportFromVillages?.total) > 0) return "Envio + NPC"
  if(n0(plan?.supportFromCentral?.total) > 0) return "NPC"
  if(n0(plan?.supportFromVillages?.total) > 0) return "Envio"
  return "Lista"
}

function evaluatePartyPlan(){
  if(!allVillages.length) return { feasible:false, reason:"Importa aldeas primero." }

  const central = allVillages.find(village => village.key === partyCentralKey)
  if(!central) return { feasible:false, reason:"Selecciona una aldea central." }

  const activeVillages = getActiveDestinationVillages()
  if(!activeVillages.length) return { feasible:false, reason:"No quedan aldeas destino para repartir." }

  const centralReserve = getPartyRequirementForVillage(central)
  if(n0(central.current?.total) < n0(centralReserve.total)){
    return {
      feasible:false,
      reason:`La aldea central no tiene total suficiente para reservar sus ${fmtInt(getVillagePartyCount(central))} grandes fiestas (${fmtInt(centralReserve.total)}).`
    }
  }

  const centralAvailableForNpc = Math.max(0, n0(central.current?.total) - n0(centralReserve.total))
  const plans = activeVillages.map(village => ({
    village,
    counts: buildPartyCountsForVillage(village),
    required: getPartyRequirementForVillage(village),
    deficit: zeroResources(),
    deficitBeforeVillageSupport: positiveDeficit(getPartyRequirementForVillage(village), village.current),
    surplus: getResourceSurplus(village.current, getPartyRequirementForVillage(village)),
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
  if(centralCapError) return { feasible:false, reason: centralCapError }

  if(n0(centralNpcNeed.total) > centralAvailableForNpc){
    return {
      feasible:false,
      reason:`La aldea central se agotaria tras reservar ${fmtInt(centralReserve.total)} y aun faltan ${fmtInt(centralNpcNeed.total)} para el NPC.`
    }
  }

  return {
    feasible: true,
    totalPartyCount: getConfiguredPartyCountTotal(activeVillages) + getVillagePartyCount(central),
    villagePlans: plans,
    totalTransfer: centralNpcNeed,
    villageTransfers,
    central,
    centralAvailable: withResourceTotal(central.current),
    centralReserve,
    plannedVillages: activeVillages.length + 1
  }
}

function renderSummary(plan){
  const summary = $("partySummary")
  if(!allVillages.length){
    summary.style.display = "none"
    summary.innerHTML = ""
    return
  }

  const activeVillages = getActiveDestinationVillages()
  const central = allVillages.find(village => village.key === partyCentralKey)
  const totalPartyCount = plan?.totalPartyCount ?? getConfiguredPartyCountTotal(getExerciseVillages())

  summary.style.display = "grid"
  summary.innerHTML = `
    <div class="training-summary-card">
      <div class="training-summary-label">Aldeas importadas</div>
      <div class="training-summary-value">${fmtInt(allVillages.length)}</div>
    </div>
    <div class="training-summary-card">
      <div class="training-summary-label">Aldeas destino</div>
      <div class="training-summary-value">${fmtInt(activeVillages.length)}</div>
    </div>
    <div class="training-summary-card">
      <div class="training-summary-label">Fiestas central</div>
      <div class="training-summary-value">${fmtInt(getVillagePartyCount(central))}</div>
    </div>
    <div class="training-summary-card">
      <div class="training-summary-label">Fiestas totales</div>
      <div class="training-summary-value">${fmtInt(totalPartyCount)}</div>
    </div>
  `
}

function renderVillageHeader(){
  const row = $("partyHeaderRow")
  if(!row) return
  row.innerHTML = [
    { label:"Aldea", left:true },
    { label:"Rol" },
    { label:"Madera" },
    { label:"Barro" },
    { label:"Hierro" },
    { label:"Cereal" },
    { label:"Total" },
    { label:"Almacen" },
    { label:"Granero" },
    { label:"Fiestas" },
    { label:"Alcanza sola?" }
  ].map(item => `<th${item.left ? ' class="left"' : ""}>${item.label}</th>`).join("")
}

function renderVillageTable(){
  const body = $("partyVillageBody")
  const wrap = $("partyTableWrap")
  body.innerHTML = ""
  renderVillageHeader()

  if(!allVillages.length){
    wrap.style.display = "none"
    return
  }

  wrap.style.display = "block"
  const partyCountOptions = [
    { value: "1", label: "1" },
    { value: "2", label: "2" }
  ]

  for(const village of allVillages){
    const tr = document.createElement("tr")
    const isCentral = village.key === partyCentralKey
    const requirement = getPartyRequirementForVillage(village)
    const localEnough = village.hasResources && (isCentral
      ? n0(village.current?.total) >= n0(requirement.total)
      : hasEnoughResources(village.current, requirement))

    let role = "Destino"
    if(isCentral) role = "Central"
    if(village.isInitialZone) role = "Excluida ZI"
    else if(village.isExcluded && !isCentral) role = "Excluida"

    const fitLabel = !village.hasResources
      ? "Sin datos"
      : isCentral
        ? (localEnough ? "SI por total" : "NO por total")
        : (localEnough ? "SI" : "NO")

    const fitClass = !village.hasResources ? "training-empty" : (localEnough ? "training-status-ok" : "training-status-warn")

    tr.innerHTML = `
      <td class="left readonly">${village.name}</td>
      <td class="readonly ${isCentral ? "training-status-ok" : (village.isExcluded ? "training-empty" : "training-status-warn")}">${role}</td>
      <td class="readonly">${fmtInt(village.current.wood)}</td>
      <td class="readonly">${fmtInt(village.current.clay)}</td>
      <td class="readonly">${fmtInt(village.current.iron)}</td>
      <td class="readonly">${fmtInt(village.current.crop)}</td>
      <td class="readonly">${fmtInt(village.current.total)}</td>
      <td class="readonly">${fmtInt(village.warehouseCap)}</td>
      <td class="readonly">${fmtInt(village.granaryCap)}</td>
      <td class="party-count-cell"></td>
      <td class="readonly ${fitClass}">${fitLabel}</td>
    `
    const partyCell = tr.querySelector(".party-count-cell")
    const select = document.createElement("select")
    select.className = "training-level-select"
    fillSelect(select, partyCountOptions, false)
    select.value = String(getVillagePartyCount(village))
    select.disabled = village.isExcluded && !isCentral
    select.addEventListener("change", () => {
      setVillagePartyCount(village.key, select.value)
      recalc()
    })
    partyCell.appendChild(select)
    body.appendChild(tr)
  }
}

function updateCentralSelect(){
  const select = $("partyCentralVillage")
  const candidates = getCentralCandidates()
  const options = candidates.map(village => ({
    value: village.key,
    label: `${village.name} - Total ${fmtInt(village.current.total)}`
  }))
  fillSelect(select, options, false)
  if(options.some(option => option.value === partyCentralKey)) select.value = partyCentralKey
  else select.value = options[0]?.value || ""
  partyCentralKey = select.value || ""

  const central = allVillages.find(village => village.key === partyCentralKey)
  const meta = $("partyCentralMeta")
  if(!central){
    meta.textContent = allVillages.length
      ? "No hay aldeas validas para elegir como central. Las aldeas ZI se excluyen automaticamente."
      : "Importa aldeas para elegir una central."
    return
  }

  const reserve = getPartyRequirementForVillage(central)
  const recommendedKey = findRecommendedCentralKey()
  meta.innerHTML = `
    <div class="training-central-overview">
      <div class="training-central-card training-central-card-main">
        <div class="training-central-card-label">Central elegida</div>
        <div class="training-central-card-value">${central.name}</div>
        <div class="training-central-card-help">${central.key === recommendedKey ? "Recomendada por ser la que mas recursos tiene ahora." : "Desde aqui sale el NPC para cubrir faltantes."}</div>
      </div>
      <div class="training-central-card">
        <div class="training-central-card-label">Reserva fiestas</div>
        <div class="training-central-card-value">${fmtInt(reserve.total)}</div>
        <div class="training-central-card-help">${fmtInt(getVillagePartyCount(central))} fiesta(s) propias: ${fmtInt(reserve.wood)} / ${fmtInt(reserve.clay)} / ${fmtInt(reserve.iron)} / ${fmtInt(reserve.crop)}</div>
      </div>
      <div class="training-central-card">
        <div class="training-central-card-label">Recursos actuales</div>
        <div class="training-central-card-value">${fmtInt(central.current.wood)} / ${fmtInt(central.current.clay)} / ${fmtInt(central.current.iron)} / ${fmtInt(central.current.crop)}</div>
        <div class="training-central-card-help">Madera / Barro / Hierro / Cereal</div>
      </div>
      <div class="training-central-card">
        <div class="training-central-card-label">Total y capacidad</div>
        <div class="training-central-card-value">${fmtInt(central.current.total)}</div>
        <div class="training-central-card-help">Almacen ${fmtInt(central.warehouseCap)} / Granero ${fmtInt(central.granaryCap)} · Las aldeas que empiezan por ZI se excluyen.</div>
      </div>
    </div>
  `
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

function getSplitFactorForVillage(villageKey){
  const factor = Math.floor(n0(partySplitModeByVillage[villageKey]))
  return factor === 2 || factor === 3 ? factor : 0
}

function toggleSplitFactorForVillage(villageKey, factor){
  if(!villageKey || (factor !== 2 && factor !== 3)) return
  partySplitModeByVillage[villageKey] = getSplitFactorForVillage(villageKey) === factor ? 0 : factor
  if(partyLastRenderedPlan?.feasible) renderPartyResult(partyLastRenderedPlan)
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

  const formatItem = (item, units) => {
    const troopName = String(item.troopName || "").trim()
    return troopName ? `${item.label}: ${troopName} ${fmtInt(units)}` : `${item.label}:${fmtInt(units)}`
  }

  const main = active.map(item => formatItem(item, item.units)).join(" · ")
  if(factor <= 1) return main
  const split = active.map(item => formatItem(item, splitAmount(item.units, factor))).join(" · ")
  return `${main}<div class="split-subvalue">x${factor}: ${split}</div>`
}

function setPartyVillageDelivered(villageKey, delivered){
  const village = allVillages.find(item => item.key === villageKey)
  if(!village) return
  village.isDelivered = Boolean(delivered)
}

function excludePartyVillage(villageKey){
  const village = allVillages.find(item => item.key === villageKey)
  if(!village || village.key === partyCentralKey) return
  village.isExcluded = true
  delete partySplitModeByVillage[villageKey]
}

function getRenderedVillagePlans(plan){
  return (Array.isArray(plan?.villagePlans) ? plan.villagePlans : [])
    .slice()
    .sort((a, b) => {
      const deliveredDiff = Number(Boolean(a?.village?.isDelivered)) - Number(Boolean(b?.village?.isDelivered))
      if(deliveredDiff) return deliveredDiff
      return compareVillageOrder(a?.village, b?.village)
    })
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

function renderPartyResult(plan){
  const wrap = $("partyResultWrap")
  const body = $("partyResultBody")
  partyLastRenderedPlan = plan || null

  if(!plan?.feasible){
    wrap.style.display = "none"
    body.innerHTML = ""
    return
  }

  wrap.style.display = "block"
  const visibleVillagePlans = getRenderedVillagePlans(plan)
  const centralRemainingTotal = Math.max(0, n0(plan.centralAvailable?.total) - n0(plan.centralReserve?.total) - n0(plan.totalTransfer?.total))

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
        ${visibleVillagePlans.map(item => {
          const splitFactor = getSplitFactorForVillage(item.village.key)
          const deliveredClass = item.village.isDelivered ? " is-delivered" : ""
          const totalToSend = withResourceTotal(item.deficit)
          const capacityFit = getVillageCapacityFit(item.village, item.deficit)
          const warnStatus = /NPC|Envio/.test(item.status)
          return `
            <tr class="training-transfer-row${deliveredClass}" data-village-key="${item.village.key}">
              <td>
                <label class="training-delivered-toggle" title="Marcar aldea como entregada">
                  <input type="checkbox" class="training-delivered-check" data-village-key="${item.village.key}" ${item.village.isDelivered ? "checked" : ""}>
                  <span>OK</span>
                </label>
              </td>
              <td class="left"><span class="training-village-name">${item.village.name}</span></td>
              <td class="${warnStatus ? "training-status-warn" : "training-status-ok"}">${item.status}</td>
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
              <td>${getResourceUi(item.resource).label}</td>
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

  body.querySelectorAll(".training-delivered-check").forEach((input) => {
    input.addEventListener("change", () => {
      setPartyVillageDelivered(input.getAttribute("data-village-key") || "", input.checked)
      renderPartyResult(partyLastRenderedPlan?.feasible ? partyLastRenderedPlan : null)
    })
  })

  body.querySelectorAll(".training-row-delete-btn").forEach((button) => {
    button.addEventListener("click", () => {
      excludePartyVillage(button.getAttribute("data-village-key") || "")
      recalc()
    })
  })
}

function recalc(){
  updateCentralSelect()
  renderVillageTable()

  if(!allVillages.length){
    partyLastImportSummary = "Sin datos importados."
    $("partyImportStatus").textContent = partyLastImportSummary
    renderSummary(null)
    renderPartyResult(null)
    showStatus("Pega Capacidad aldea y Los Recursos para empezar.", "")
    return
  }

  renderSummary(null)

  const missingResources = allVillages.filter(village => !village.hasResources)
  if(missingResources.length){
    $("partyImportStatus").textContent = partyLastImportSummary
    renderPartyResult(null)
    showStatus(`Capacidad importada para ${fmtInt(allVillages.length)} aldeas. Falta pegar Los Recursos para ${fmtInt(missingResources.length)}.`, "bad")
    return
  }

  if(getActiveDestinationVillages().length === 0){
    $("partyImportStatus").textContent = partyLastImportSummary
    renderPartyResult(null)
    showStatus("No quedan aldeas destino para calcular. Usa otra central o vuelve a incluir aldeas.", "bad")
    return
  }

  const plan = evaluatePartyPlan()
  renderSummary(plan.feasible ? plan : null)
  renderPartyResult(plan.feasible ? plan : null)

  if(plan.feasible){
    $("partyImportStatus").textContent = `Fiestas totales: ${fmtInt(plan.totalPartyCount)} · Reserva central: ${fmtInt(plan.centralReserve.total)} · NPC central: ${fmtInt(plan.totalTransfer.total)}`
    showStatus(`OK. Central: ${fmtInt(getVillagePartyCount(plan.central))} fiesta(s) · NPC total: ${fmtInt(plan.totalTransfer.total)}`, "ok")
  } else {
    $("partyImportStatus").textContent = partyLastImportSummary
    showStatus(plan.reason, "bad")
  }
}

function init(){
  $("btnImportParty").addEventListener("click", () => {
    const info = importPartyVillages()
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
    recalc()
  })

  recalc()
}

init()
