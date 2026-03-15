
/* nav.js — Navegación compartida de Travian Tools
   Colocar en la raíz del proyecto (un nivel arriba de cada carpeta) */
(function(){
  const PAGES = [
    { label: 'ROI Produccion',      href: '../roi/'     },
    { label: 'NPC Optimizador',     href: '../npc/'     },
    { label: 'Farm Oasis',          href: '../oasis/'   },
    { label: 'Lista de Vacas',      href: '../listadevacas/' },
    { label: 'Puntos Cultura',      href: '../cultura/' },
  ]

  // Detecta qué página es la activa comparando el path
  const currentPath = window.location.pathname

  function buildNav(){
    const wrap = document.getElementById('nav')
    if(!wrap) return

    // Inyectar estilos del nav para garantizar consistencia entre páginas
    if(!document.getElementById('nav-style')){
      const style = document.createElement('style')
      style.id = 'nav-style'
      style.textContent = `
        .topline{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
        .theme-toggle{background:var(--panel,#fff);color:var(--text,#0f172a);border:1px solid var(--border,#cbd5e1);padding:6px 12px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px}
        .top-actions{display:flex;align-items:center;gap:8px;font-weight:800;font-size:13px}
        .nav-link{color:#0b3a6a;text-decoration:none;font-weight:800;font-size:13px}
        .nav-link.active{text-decoration:underline}
        .nav-link:hover{text-decoration:underline}
        .nav-sep{color:var(--muted,#475569)}
      `
      document.head.appendChild(style)
    }

    const topline = document.createElement('div')
    topline.className = 'topline'

    const themeBtn = document.createElement('button')
    themeBtn.id = 'themeToggle'
    themeBtn.className = 'theme-toggle'
    themeBtn.type = 'button'
    themeBtn.textContent = '🌙 Modo Oscuro'
    themeBtn.addEventListener('click', toggleTheme)
    topline.appendChild(themeBtn)

    const actions = document.createElement('div')
    actions.className = 'top-actions'

    PAGES.forEach((page, i) => {
      if(i > 0){
        const sep = document.createElement('span')
        sep.className = 'nav-sep'
        sep.textContent = '|'
        actions.appendChild(sep)
      }
      const a = document.createElement('a')
      a.className = 'nav-link'
      a.href = page.href
      a.textContent = page.label
      // Activa si el path contiene la carpeta de esa página
      const folder = page.href.replace('../','').replace('/','')
      if(currentPath.includes('/' + folder + '/') || currentPath.includes('/' + folder + '/index')) {
        a.classList.add('active')
      }
      actions.appendChild(a)
    })

    topline.appendChild(actions)
    wrap.appendChild(topline)
    setTheme()
  }

  function setTheme(){
    const dark = localStorage.getItem('theme') === 'dark'
    document.body.classList.toggle('dark', dark)
    const btn = document.getElementById('themeToggle')
    if(btn) btn.textContent = dark ? '☀️ Modo Claro' : '🌙 Modo Oscuro'
  }

  function toggleTheme(){
    document.body.classList.toggle('dark')
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light')
    setTheme()
  }

  // Exponer setTheme globalmente por si alguna página lo llama
  window.setTheme = setTheme
  window.toggleTheme = toggleTheme

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', buildNav)
  } else {
    buildNav()
  }
})()
