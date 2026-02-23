let BUILDINGS=null
let TROOPS=null
let TROOPS_BY_RACE={}
let TROOPS_LOOKUP_BY_RACE={}

function i(v){v=parseInt(v,10);return Number.isFinite(v)?v:0}
function f0(v){return Math.max(0,i(v))}
function sum4(a,b){return[a[0]+b[0],a[1]+b[1],a[2]+b[2],a[3]+b[3]]}
function mul4(a,k){return[a[0]*k,a[1]*k,a[2]*k,a[3]*k]}
function total4(a){return a[0]+a[1]+a[2]+a[3]}
function setText(id,val){document.getElementById(id).textContent=String(Math.max(0,i(val)))}

function timeToSec(t){
  t=String(t||'').trim()
  if(!t)return 0
  const p=t.split(':').map(x=>parseInt(x,10))
  if(p.some(x=>!Number.isFinite(x)))return 0
  if(p.length===3)return p[0]*3600+p[1]*60+p[2]
  if(p.length===2)return p[0]*60+p[1]
  return 0
}

function distributeEquitably(E, order){
  E=Math.max(0,i(E))
  const q=Math.floor(E/4)
  let r=E%4
  const out=[q,q,q,q]
  const ordMap={M:0,B:1,H:2,C:3}
  const seq=(order||'MBHC').split('').map(ch=>ordMap[ch]).filter(x=>x!==undefined)
  let idx=0
  while(r>0){
    out[seq[idx%seq.length]]+=1
    r-=1
    idx+=1
  }
  return out
}

async function loadCatalogs(){
  const [b,t]=await Promise.all([
    fetch('./catalogo_edificios.json').then(r=>r.json()),
    fetch('./catalogo_tropas.json').then(r=>r.json())
  ])
  BUILDINGS=b.buildings||{}
  TROOPS=t.troops||[]
  TROOPS_BY_RACE={}
  TROOPS_LOOKUP_BY_RACE={}
  for(const tr of TROOPS){
    const race=String(tr.race||'').toUpperCase().trim()
    const name=String(tr.name||'').trim()
    if(!race||!name)continue
    if(!TROOPS_BY_RACE[race])TROOPS_BY_RACE[race]=[]
    TROOPS_BY_RACE[race].push(tr)
    if(!TROOPS_LOOKUP_BY_RACE[race])TROOPS_LOOKUP_BY_RACE[race]={}
    TROOPS_LOOKUP_BY_RACE[race][name]=tr
  }
  for(const r of Object.keys(TROOPS_BY_RACE)){
    TROOPS_BY_RACE[r].sort((a,b)=>String(a.name).localeCompare(String(b.name)))
  }
}

function buildingNames(){
  return Object.keys(BUILDINGS).sort((a,b)=>a.localeCompare(b))
}

function troopNames(race, tipoFilter){
  const list=TROOPS_BY_RACE[race]||[]
  const f=String(tipoFilter||'').toUpperCase()
  return list.filter(t=>{
    const te=String(t.tipo_edificio||'').toUpperCase().trim()
    if(!f||f==='ANY')return true
    if(f==='CET')return te==='C'||te==='E'||te==='T'||te===''
    return te===f||te===''
  }).map(t=>String(t.name)).sort((a,b)=>a.localeCompare(b))
}

function rowTemplate(){
  return `
  <tr>
    <td>
      <select class="tipo">
        <option value="EDIFICIO" selected>EDIFICIO</option>
        <option value="TROPA">TROPA</option>
      </select>
    </td>
    <td class="left">
      <select class="nombre"></select>
    </td>
    <td><input class="cant" type="number" min="0" value="1"></td>
    <td><input class="ini" type="number" min="0" value="0"></td>
    <td><input class="fin" type="number" min="0" value="1"></td>
    <td class="madera">0</td>
    <td class="barro">0</td>
    <td class="hierro">0</td>
    <td class="cereal">0</td>
    <td class="total">0</td>
    <td><button class="del" type="button">✕</button></td>
  </tr>
  `
}

function setSelectOptions(sel, names, keepValue){
  const prev = keepValue ? sel.value : ''
  sel.innerHTML = names.length ? names.map(n=>`<option value="${n}">${n}</option>`).join('') : `<option value="">-</option>`
  if(keepValue && prev && names.includes(prev)) sel.value = prev
  if(!sel.value && sel.options.length) sel.value = sel.options[0].value
}

function updateNombreSelect(tr, keepValue){
  const tipo=tr.querySelector('.tipo').value
  const sel=tr.querySelector('.nombre')
  if(tipo==='EDIFICIO'){
    setSelectOptions(sel, buildingNames(), keepValue)
  }else{
    const race=document.getElementById('raceSelect').value
    setSelectOptions(sel, troopNames(race,'ANY'), keepValue)
  }
}

function applyTipoBehavior(tr){
  const tipo=tr.querySelector('.tipo').value
  const ini=tr.querySelector('.ini')
  const fin=tr.querySelector('.fin')
  if(tipo==='TROPA'){
    ini.value=0
    fin.value=0
    ini.disabled=true
    fin.disabled=true
  }else{
    ini.disabled=false
    fin.disabled=false
  }
}

function getBuildCost(name, fromLvl, toLvl, qty){
  const b=BUILDINGS[name]
  if(!b)return[0,0,0,0]
  const max=b.max||0
  let f=Math.max(0,Math.min(max,f0(fromLvl)))
  let t=Math.max(0,Math.min(max,f0(toLvl)))
  let q=Math.max(0,f0(qty))
  if(q===0||t<=f)return[0,0,0,0]
  let out=[0,0,0,0]
  for(let lvl=f+1;lvl<=t;lvl++){
    const c=b.costs[lvl-1]||[0,0,0,0]
    out=sum4(out,c)
  }
  return mul4(out,q)
}

function troopCost(race, name, qty){
  const t=(TROOPS_LOOKUP_BY_RACE[race]||{})[name]||null
  const q=Math.max(0,f0(qty))
  if(!t||q===0)return[0,0,0,0]
  return mul4([f0(t.wood),f0(t.clay),f0(t.iron),f0(t.crop)],q)
}

function computeRequired(race){
  const trs=Array.from(document.querySelectorAll('#rows tr'))
  let req=[0,0,0,0]
  for(const tr of trs){
    const tipo=tr.querySelector('.tipo').value
    const name=tr.querySelector('.nombre').value
    const cant=f0(tr.querySelector('.cant').value)
    const ini=f0(tr.querySelector('.ini').value)
    const fin=f0(tr.querySelector('.fin').value)
    let r=[0,0,0,0]
    if(tipo==='EDIFICIO'){
      r=getBuildCost(name,ini,fin,cant)
    }else{
      r=troopCost(race,name,cant)
    }
    tr.querySelector('.madera').textContent=String(r[0])
    tr.querySelector('.barro').textContent=String(r[1])
    tr.querySelector('.hierro').textContent=String(r[2])
    tr.querySelector('.cereal').textContent=String(r[3])
    tr.querySelector('.total').textContent=String(total4(r))
    req=sum4(req,r)
  }
  return req
}

function activeQueues(race){
  const out=[]
  const bOn=document.getElementById('qBarracksOn').checked
  const sOn=document.getElementById('qStableOn').checked
  const wOn=document.getElementById('qWorkshopOn').checked
  if(bOn) out.push({key:'C', troop:document.getElementById('qBarracksTroop').value, timeSec:0, race})
  if(sOn) out.push({key:'E', troop:document.getElementById('qStableTroop').value, timeSec:0, race})
  if(wOn) out.push({key:'T', troop:document.getElementById('qWorkshopTroop').value, timeSec:0, race})
  return out
}

function eligibleTroopForExcess(t, key){
  const te=String(t.tipo_edificio||'').toUpperCase().trim()
  if(key==='C')return te==='C'
  if(key==='E')return te==='E'
  if(key==='T')return te==='T'
  return false
}

function computeExcessEq(E, order){
  return distributeEquitably(E,order)
}

function computeExcessTime(race, E, order){
  E=Math.max(0,i(E))
  const qs=activeQueues(race)
  if(qs.length===0||E===0){
    return {extra:distributeEquitably(E,order), detail:[], units:{}}
  }
  const units={}
  for(const q of qs) units[q.key]=0
  let extra=[0,0,0,0]
  let guard=0
  while(E>0 && guard<200000){
    guard++
    let bestIdx=0
    let bestTime=Infinity
    for(let k=0;k<qs.length;k++){
      if(qs[k].timeSec<bestTime){
        bestTime=qs[k].timeSec
        bestIdx=k
      }
    }
    const q=qs[bestIdx]
    const t=(TROOPS_LOOKUP_BY_RACE[race]||{})[q.troop]||null
    if(!t)break
    if(!eligibleTroopForExcess(t,q.key))break
    const unit=[f0(t.wood),f0(t.clay),f0(t.iron),f0(t.crop)]
    const unitTotal=total4(unit)
    if(unitTotal<=0)break
    if(E<unitTotal)break
    E-=unitTotal
    extra=sum4(extra,unit)
    units[q.key]+=1
    q.timeSec+=Math.max(0,i(t.time_sec||timeToSec(t.time)))
  }
  extra=sum4(extra,distributeEquitably(E,order))
  const detail=qs.map(q=>{
    const t=(TROOPS_LOOKUP_BY_RACE[race]||{})[q.troop]||null
    const nm=t?String(t.name):String(q.troop||'')
    const mins=Math.round((q.timeSec||0)/60)
    return `${q.key}: ${nm} x${units[q.key]||0} (${mins}m)`
  })
  return {extra, detail, units}
}

function computeExcessExact(race, E, order){
  E=Math.max(0,i(E))
  const name=document.getElementById('exactTroop').value
  const t=(TROOPS_LOOKUP_BY_RACE[race]||{})[name]||null
  let extra=[0,0,0,0]
  let units=0
  if(t){
    const te=String(t.tipo_edificio||'').toUpperCase().trim()
    if(te==='C'||te==='E'||te==='T'){
      const unit=[f0(t.wood),f0(t.clay),f0(t.iron),f0(t.crop)]
      const unitTotal=total4(unit)
      if(unitTotal>0){
        units=Math.floor(E/unitTotal)
        E-=units*unitTotal
        extra=sum4(extra,mul4(unit,units))
      }
    }
  }
  extra=sum4(extra,distributeEquitably(E,order))
  return {extra, units}
}

function refreshModePanels(){
  const m=document.getElementById('excessMode').value
  document.getElementById('modeTimePanel').style.display=(m==='time')?'block':'none'
  document.getElementById('modeExactPanel').style.display=(m==='exact')?'block':'none'
}

function refreshTroopSelects(){
  const race=document.getElementById('raceSelect').value
  setSelectOptions(document.getElementById('qBarracksTroop'), troopNames(race,'C'), true)
  setSelectOptions(document.getElementById('qStableTroop'), troopNames(race,'E'), true)
  setSelectOptions(document.getElementById('qWorkshopTroop'), troopNames(race,'T'), true)
  setSelectOptions(document.getElementById('exactTroop'), troopNames(race,'CET'), true)
  const trs=Array.from(document.querySelectorAll('#rows tr'))
  for(const tr of trs){
    if(tr.querySelector('.tipo').value==='TROPA'){
      updateNombreSelect(tr,true)
    }
  }
}

function recalc(){
  if(!BUILDINGS||!TROOPS)return
  const race=document.getElementById('raceSelect').value
  const order=document.getElementById('eqOrder').value
  const req=computeRequired(race)
  const reqSum=total4(req)

  setText('reqWood',req[0])
  setText('reqClay',req[1])
  setText('reqIron',req[2])
  setText('reqCrop',req[3])
  setText('reqAll',reqSum)

  const curTotal=f0(document.getElementById('curTotal').value)
  const status=document.getElementById('statusLine')

  if(reqSum===0){
    setText('tgtWood',0);setText('tgtClay',0);setText('tgtIron',0);setText('tgtCrop',0);setText('tgtAll',0)
    status.innerHTML=`<span class="bad">No hay nada en la matriz.</span>`
    return
  }

  if(curTotal<reqSum){
    setText('tgtWood',req[0]);setText('tgtClay',req[1]);setText('tgtIron',req[2]);setText('tgtCrop',req[3]);setText('tgtAll',reqSum)
    const falta=reqSum-curTotal
    status.innerHTML=`<span class="bad">NO ALCANZA.</span> Falta total: <span class="mono">${falta}</span>`
    return
  }

  const E=curTotal-reqSum
  const mode=document.getElementById('excessMode').value
  refreshModePanels()

  let extra=[0,0,0,0]
  let info=''

  if(mode==='eq'){
    extra=computeExcessEq(E,order)
    info=`Excedente equitativo: <span class="mono">${E}</span>`
  }else if(mode==='time'){
    const r=computeExcessTime(race,E,order)
    extra=r.extra
    info=`Excedente por tiempo: <span class="mono">${E}</span> | ${r.detail.join(' | ')}`
  }else{
    const r=computeExcessExact(race,E,order)
    extra=r.extra
    info=`Excedente exacto: <span class="mono">${E}</span> → <span class="mono">${document.getElementById('exactTroop').value}</span> x${r.units}`
  }

  const tgt=sum4(req,extra)
  setText('tgtWood',tgt[0])
  setText('tgtClay',tgt[1])
  setText('tgtIron',tgt[2])
  setText('tgtCrop',tgt[3])
  setText('tgtAll', total4(tgt))

  status.innerHTML=`<span class="good">OK.</span> ${info}`
}

function addRow(){
  const tbody=document.getElementById('rows')
  tbody.insertAdjacentHTML('beforeend',rowTemplate())
  const tr=tbody.lastElementChild
  applyTipoBehavior(tr)
  updateNombreSelect(tr,false)
  recalc()
}

function wire(){
  document.getElementById('addRow').addEventListener('click',addRow)

  document.getElementById('rows').addEventListener('input',e=>{
    if(!e.target.closest('tr'))return
    recalc()
  })

  document.getElementById('rows').addEventListener('change',e=>{
    const tr=e.target.closest('tr')
    if(!tr)return
    if(e.target.classList.contains('tipo')){
      applyTipoBehavior(tr)
      updateNombreSelect(tr,false)
    }
    recalc()
  })

  document.getElementById('rows').addEventListener('click',e=>{
    const del=e.target.closest('.del')
    if(!del)return
    del.closest('tr').remove()
     
    recalc()
  })

  document.getElementById('raceSelect').addEventListener('change',()=>{
    refreshTroopSelects()
    recalc()
  })

  document.getElementById('excessMode').addEventListener('change',recalc)
  document.getElementById('eqOrder').addEventListener('change',recalc)

  document.getElementById('qBarracksOn').addEventListener('change',recalc)
  document.getElementById('qStableOn').addEventListener('change',recalc)
  document.getElementById('qWorkshopOn').addEventListener('change',recalc)
  document.getElementById('qBarracksTroop').addEventListener('change',recalc)
  document.getElementById('qStableTroop').addEventListener('change',recalc)
  document.getElementById('qWorkshopTroop').addEventListener('change',recalc)
  document.getElementById('exactTroop').addEventListener('change',recalc)

  document.getElementById('curTotal').addEventListener('input',recalc)
}

function fillRace(){
  const sel=document.getElementById('raceSelect')
  const races=Object.keys(TROOPS_BY_RACE).sort((a,b)=>a.localeCompare(b))
  sel.innerHTML=races.map(r=>`<option value="${r}">${r}</option>`).join('')
  if(races.includes('HUNOS')) sel.value='HUNOS'
  else if(races.includes('HUNO')) sel.value='HUNO'
  else if(!sel.value && sel.options.length) sel.value=sel.options[0].value
}

function toggleTheme(){
  const body=document.body
  const btn=document.getElementById('themeToggle')
  body.classList.toggle('light-mode')
  if(body.classList.contains('light-mode')){
    btn.textContent='🌙 Modo Oscuro'
    localStorage.setItem('theme','light')
  }else{
    btn.textContent='☀️ Modo Claro'
    localStorage.setItem('theme','dark')
  }
}

function initTheme(){
  const saved=localStorage.getItem('theme')
  const btn=document.getElementById('themeToggle')
  if(saved==='light'){
    document.body.classList.add('light-mode')
    btn.textContent='🌙 Modo Oscuro'
  }else{
    btn.textContent='☀️ Modo Claro'
  }
  btn.addEventListener('click',toggleTheme)
}

window.addEventListener('load',async()=>{
  initTheme()
  await loadCatalogs()
  fillRace()
  refreshTroopSelects()
  refreshModePanels()
  addRow()
  wire()
  recalc()
})