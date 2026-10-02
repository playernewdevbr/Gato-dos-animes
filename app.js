"use strict";
/* Sim Dragon Animes — dados salvos no navegador (localStorage). Veja o README no chat sobre limites. */
const KEY = "hanabi_v1", WEEK = 7 * 864e5;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const id = () => Math.random().toString(36).slice(2, 10);
const sha = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, "0")).join("");
const safeUrl = u => /^(https?:\/\/|data:image\/)/i.test(u || "") ? u : "";

let db = JSON.parse(localStorage.getItem(KEY) || "null") || {
  users: [], session: null, feedback: [],
  works: [
    { id: id(), type: "anime", title: "Exemplo: Aventura Estelar", desc: "Obra de exemplo. O administrador pode apagar e publicar as suas.", cover: "", genres: "Ação, Aventura", items: [], ratings: {}, favs: [], comments: [] },
    { id: id(), type: "manga", title: "Exemplo: Sombras de Papel", desc: "Mangá de exemplo para você ver como fica o catálogo.", cover: "", genres: "Drama, Mistério", items: [], ratings: {}, favs: [], comments: [] }
  ],
  polls: [{ id: id(), q: "Qual gênero você quer ver mais aqui?", opts: [{ t: "Ação", v: [] }, { t: "Romance", v: [] }, { t: "Terror", v: [] }] }]
};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { toast("Armazenamento cheio: use imagens menores."); } };
const me = () => db.users.find(u => u.id === db.session);
const isAdmin = () => me() && db.users[0] && me().id === db.users[0].id;
const work = i => db.works.find(w => w.id === i);
const avg = w => { const v = Object.values(w.ratings); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length) : 0; };
const stars = n => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
const toast = t => { const e = $("#toast"); e.textContent = t; e.classList.add("show"); setTimeout(() => e.classList.remove("show"), 2600); };
const fd = f => Object.fromEntries(new FormData(f));
const need = () => { if (!me()) { authModal(); return false; } return true; };

let tab = "home", q = "", genre = "";

function cover(w) {
  const h = [...w.title].reduce((a, c) => a + c.charCodeAt(0), 0) % 360, u = safeUrl(w.cover);
  const bg = u ? `background-image:url('${esc(u)}')` : `background:linear-gradient(135deg,hsl(${h} 60% 45%),hsl(${(h + 60) % 360} 60% 25%))`;
  return `<div class="cv" style="${bg}">${u ? "" : esc(w.title.replace(/^Exemplo: /, "")[0] || "?")}</div>`;
}
const card = w => `<button class="card" data-open="${w.id}">${cover(w)}<b>${esc(w.title)}</b>${avg(w) ? `<i class="rt">★ ${avg(w).toFixed(1)}</i>` : ""}</button>`;

const TITLES = { home: "Início", manga: "Mangás", favs: "Favoritos", more: "Mais", profile: "Editar perfil", settings: "Configurações", polls: "Enquetes", feedback: "Feedback", news: "Novidades", admin: "Administração" };
const MAIN = ["home", "manga", "favs", "more"];
const ICO = p => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IC = { user: ICO('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'), gear: ICO('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'), out: ICO('<path d="M9 4H5v16h4"/><path d="m16 8 4 4-4 4M20 12H9"/>'), poll: ICO('<path d="M5 20V10M12 20V4M19 20v-7"/>'), chat: ICO('<path d="M4 5h16v11H9l-5 4z"/>'), bell: ICO('<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'), shield: ICO('<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>'), back: ICO('<path d="M19 12H5M12 5l-7 7 7 7"/>'), share: ICO('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'), play: ICO('<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z" fill="currentColor"/>'), like: ICO('<path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2l-1 7a2 2 0 0 1-2 2H7"/>'), heart: ICO('<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>'), sort: ICO('<path d="M3 6h9M3 12h6M3 18h3M17 20V5M13 9l4-4 4 4"/>'), filter: ICO('<path d="M4 6h16M7 12h10M10 18h4"/>'), send: ICO('<path d="M3 11 21 3l-8 18-2-8z"/>') };

function render() {
  const u = me(), on = MAIN.includes(tab) ? tab : "more";
  document.querySelectorAll(".bnav button").forEach(b => b.classList.toggle("on", b.dataset.tab === on));
  $("#ptitle").textContent = TITLES[tab];
  $("#meBtn").innerHTML = u ? av(u) : IC.user;
  const v = { home, manga: mangaView, favs, more, profile, settings, polls, feedback, news, admin }[tab];
  $("#app").innerHTML = (MAIN.includes(tab) ? "" : `<button class="btn ghost sm" data-tab="more">← Voltar</button>`) + v();
}
const byType = t => db.works.filter(w => w.type === t);
const rowOf = (t, ws) => ws.length ? `<h2>${t}</h2><div class="hrow">${ws.map(card).join("")}</div>` : "";
const histOf = t => { const u = me(); return u ? Object.keys(u.prog || {}).map(work).filter(w => w && w.type === t) : []; };
const topOf = ws => [...ws].filter(avg).sort((a, b) => avg(b) - avg(a)).slice(0, 12);
const genreRows = ws => { const c = {}; ws.forEach(w => w.genres.split(",").map(g => g.trim()).filter(Boolean).forEach(g => (c[g] ||= []).push(w))); return Object.entries(c).sort((a, b) => b[1].length - a[1].length).slice(0, 6).map(([g, l]) => rowOf(esc(g), l)).join(""); };
function home() {
  const ws = byType("anime");
  return ws.length ? rowOf("Recém adicionados", [...ws].reverse().slice(0, 12)) + rowOf("Seu histórico", histOf("anime")) + rowOf("Mais bem avaliados", topOf(ws)) + genreRows(ws) : `<p class="empty">Nenhum anime publicado ainda.</p>`;
}
function mangaView() {
  const ws = byType("manga");
  return ws.length ? rowOf("Recomendados", topOf(ws).length ? topOf(ws) : [...ws].slice(0, 12)) + rowOf("Continuar lendo", histOf("manga")) + rowOf("Recém atualizados", [...ws].reverse().slice(0, 12)) + genreRows(ws) : `<p class="empty">Nenhum mangá publicado ainda.</p>`;
}
function favs() {
  const u = me(); if (!u) return `<p class="empty">Entre para ver seus favoritos.</p><p style="text-align:center"><button class="btn" data-act="login">Entrar</button></p>`;
  const f = t => db.works.filter(w => w.type === t && w.favs.includes(u.id)), a = f("anime"), m = f("manga");
  const g = (t, l) => l.length ? `<h2>${t}</h2><div class="grid">${l.map(card).join("")}</div>` : "";
  return g("Animes", a) + g("Mangás", m) || `<p class="empty">Nenhum favorito ainda. Abra uma obra e toque em Favoritar.</p>`;
}
function more() {
  const u = me(), it = (t, i, a, b) => `<button class="mi" data-tab="${t}">${i}<span><b>${a}</b><small>${b}</small></span></button>`;
  return (u ? `<div class="ucard">${av(u, "xl")}<span><b>${esc(u.nick)}</b><small>${esc(u.email)}</small></span><button class="ic" data-act="logout" aria-label="Sair">${IC.out}</button></div>`
    : `<div class="ucard col"><b>Entre para personalizar sua conta</b><p><button class="btn" data-act="login">Entrar</button> <button class="btn ghost" data-act="register">Criar conta</button></p></div>`)
    + `<div class="mlist">${u ? it("profile", IC.user, "Editar perfil", "Deixe sua conta do seu jeito") : ""}${it("settings", IC.gear, "Configurações", "Ajustes do Sim Dragon Animes")}${it("polls", IC.poll, "Enquetes", "Vote e dê sua opinião")}${it("feedback", IC.chat, "Feedback", "Conte o que está bom ou o que quebrou")}${it("news", IC.bell, "Novidades", "Avisos e atualizações")}${isAdmin() ? it("admin", IC.shield, "Administração", "Publique obras e gerencie o site") : ""}<a class="mi" href="${DISCORD}" target="_blank" rel="noopener">${dIcon}<span><b>Entre no nosso Discord!</b><small>Fique por dentro das novidades, relate bugs ou dê sugestões para o Sim Dragon Animes</small></span></a></div>`;
}
function settings() {
  const L = I18N.lang;
  return `<div class="panel"><b>Idioma</b><small class="mute">Escolha o idioma do site</small>${[["pt-BR", "Português (Brasil)"], ["pt-PT", "Português (Portugal)"], ["en", "English"]].map(([c, n]) => `<button class="opt lang ${c === L ? "on" : ""}" data-lang="${c}"><span>${n}${c === L ? " ✓" : ""}</span></button>`).join("")}</div>`;
}
function searchModal() {
  const m = $("#modal");
  m.className = ""; m.innerHTML = `<input id="gsearch" type="search" placeholder="Buscar animes e mangás" autocomplete="off"><div id="gres" class="grid" style="margin-top:16px"></div><p><button class="btn ghost sm" data-close>Fechar</button></p>`;
  m.showModal(); $("#gsearch").focus();
}
const searchRes = s => { const k = s.trim().toLowerCase(); if (!k) return ""; const r = db.works.filter(w => w.title.toLowerCase().includes(k) || w.genres.toLowerCase().includes(k)); return r.map(card).join("") || `<p class="mute">Nenhum resultado. Tente outra busca.</p>`; };

function polls() {
  const u = me();
  return `<h1>Enquetes</h1>${db.polls.map(p => {
    const tot = p.opts.reduce((a, o) => a + o.v.length, 0);
    return `<h2>${esc(p.q)}</h2>${p.opts.map((o, i) => `<button class="opt" data-vote="${p.id}:${i}"><i style="width:${tot ? o.v.length / tot * 100 : 0}%"></i><span>${esc(o.t)}${u && o.v.includes(u.id) ? " ✓" : ""}<b>${o.v.length}</b></span></button>`).join("")}`;
  }).join("") || '<p class="mute">Nenhuma enquete ativa.</p>'}`;
}

function feedback() {
  return `<h1>Feedback</h1><p class="mute">Conte o que está bom, o que quebrou ou o que você quer ver.</p>
  <form class="box" id="fbForm"><textarea name="t" rows="4" maxlength="800" required placeholder="Escreva sua mensagem"></textarea><button class="btn">Enviar feedback</button></form>
  ${db.feedback.slice().reverse().map(f => `<div class="cmt"><b>${esc(f.u)}</b> <span class="mute">${new Date(f.d).toLocaleDateString("pt-BR")}</span><br>${esc(f.t)}</div>`).join("")}`;
}

function admin() {
  if (!isAdmin()) return "<p>Acesso restrito.</p>";
  const opts = db.works.map(w => `<option value="${w.id}">${esc(w.title)} (${w.type})</option>`).join("");
  return `<h1>Painel</h1>
  <form class="box" id="workForm"><b>Publicar anime ou mangá</b>
  <select name="type"><option value="anime">Anime</option><option value="manga">Mangá</option></select>
  <input name="title" placeholder="Título" required>
  <label>Capa (da galeria)<input type="file" name="coverfile" accept="image/*"></label><input name="cover" placeholder="ou URL da capa (https://...)">
  <input name="genres" placeholder="Gêneros separados por vírgula"><input name="year" placeholder="Ano (ex.: 2012)"><input name="age" placeholder="Classificação (ex.: 12, L, 16)"><textarea name="desc" rows="3" placeholder="Descrição" required></textarea><button class="btn">Publicar</button></form>
  <form class="box" id="itemForm"><b>Adicionar episódio ou capítulo</b><select name="wid" required>${opts}</select>
  <input name="title" placeholder="Título (ex.: Capítulo 1)" required><textarea name="desc" rows="2" placeholder="Descrição do episódio/capítulo"></textarea><input name="dur" placeholder="Duração (ex.: 22 minutos)"><label>Miniatura (da galeria)<input type="file" name="thumb" accept="image/*"></label>
  <label>Mangá: páginas da galeria (selecione várias, na ordem do nome)<input type="file" name="pages" accept="image/*" multiple></label>
  <textarea name="src" rows="3" placeholder="Anime: link do vídeo (mp4 ou YouTube).&#10;Mangá: links de imagem extras, um por linha (opcional)."></textarea><button class="btn">Adicionar</button></form>
  <form class="box" id="newsForm"><b>Publicar novidade</b><input name="t" placeholder="Título" required><textarea name="b" rows="3" placeholder="Texto" required></textarea><button class="btn">Publicar novidade</button></form>
  <form class="box" id="pollForm"><b>Criar enquete</b><input name="q" placeholder="Pergunta" required><textarea name="o" rows="3" placeholder="Uma opção por linha (mínimo 2)" required></textarea><button class="btn">Criar enquete</button></form>
  <h2>Gerenciar</h2>${(db.news || []).map(n => `<div class="row"><span>Novidade: ${esc(n.t)}</span><button class="btn ghost sm" data-delnews="${n.id}">Apagar</button></div>`).join("")}${db.works.map(w => `<div class="row"><span>${esc(w.title)}</span><button class="btn ghost sm" data-del="${w.id}">Apagar</button></div>`).join("")}
  ${db.polls.map(p => `<div class="row"><span>Enquete: ${esc(p.q)}</span><button class="btn ghost sm" data-delpoll="${p.id}">Apagar</button></div>`).join("")}`;
}

/* ---------- Perfil, imagens e extras ---------- */
const SORTS = { new: "Mais recentes", top: "Melhor nota", az: "A–Z", fav: "Mais favoritos" };
let sort = "new";
const sortW = l => sort === "top" ? [...l].sort((a, b) => avg(b) - avg(a)) : sort === "az" ? [...l].sort((a, b) => a.title.localeCompare(b.title)) : sort === "fav" ? [...l].sort((a, b) => b.favs.length - a.favs.length) : [...l].reverse();
const gain = n => { const u = me(); if (u) u.xp = (u.xp || 0) + n; };
const lvl = u => { const x = u.xp || 0, n = Math.floor(x / 100) + 1, t = n >= 10 ? "Dragão Supremo" : n >= 6 ? "Mestre Dragão" : n >= 3 ? "Guerreiro" : "Novato"; return `<div class="lvl"><b>Nv ${n} · ${t}</b><i><u style="width:${x % 100}%"></u></i><small class="mute">${x} XP</small></div>`; };
const newsCard = n => `<article class="row" style="display:block"><b>${esc(n.t)}</b> <small class="mute">${new Date(n.d).toLocaleDateString("pt-BR")}</small><p style="margin:6px 0 0">${esc(n.b)}</p></article>`;
const news = () => `<h1>Novidades</h1>${(db.news || []).map(newsCard).join("") || '<p class="mute">Sem novidades por enquanto.</p>'}`;
const DISCORD = "https://discord.gg/aMRP29tGwy";
const dIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.3 4.4A17 17 0 0 0 16 3l-.2.4a15 15 0 0 1 3.7 1.9 14 14 0 0 0-15 0A15 15 0 0 1 8.2 3.4L8 3a17 17 0 0 0-4.3 1.4C1 8.500.3 12.500.6 16.400a17 17 0 0 0 5.200 2.600l1.100-1.800a11 11 0 0 1-1.700-.8l.4-.3a12 12 0 0 0 10.800 0l.4.3c-.5.3-1.100.6-1.700.8l1.100 1.800a17 17 0 0 0 5.200-2.600c.4-4.500-.7-8.400-3.100-12zM8.700 14c-1 0-1.800-.9-1.800-2s.8-2 1.800-2 1.800.9 1.800 2-.8 2-1.800 2zm6.600 0c-1 0-1.800-.9-1.800-2s.8-2 1.800-2 1.800.9 1.800 2-.8 2-1.800 2z"/></svg>`;
const STATUS = { watching: "Em andamento", plan: "Quero ver/ler", done: "Concluído", drop: "Abandonado" };
const usr = i => db.users.find(x => x.id === i);
const av = (x, c = "") => x.avatar ? `<img class="av ${c}" src="${esc(x.avatar)}" alt="">` : `<span class="av ${c}">${esc((x.nick[0] || "?").toUpperCase())}</span>`;
const who = (i, n = "Usuário") => { const x = usr(i); return x ? `<button class="who" data-user="${x.id}">${av(x)}${esc(x.nick)}</button>` : `<b>${esc(n)}</b>`; };
let rd = null;

const toImg = (file, w, h, q = .8) => new Promise((ok, no) => {
  const r = new FileReader(); r.onerror = no;
  r.onload = () => { const i = new Image(); i.onerror = no; i.onload = () => {
    const s = Math.min(1, w / i.width), cw = h ? w : i.width * s, ch = h ? h : i.height * s;
    const c = document.createElement("canvas"); c.width = cw; c.height = ch; const x = c.getContext("2d");
    if (h) { const k = Math.max(w / i.width, h / i.height); x.drawImage(i, (w - i.width * k) / 2, (h - i.height * k) / 2, i.width * k, i.height * k); } else x.drawImage(i, 0, 0, cw, ch);
    ok(c.toDataURL("image/jpeg", q)); }; i.src = r.result; };
  r.readAsDataURL(file);
});
const idb = () => new Promise((ok, no) => { const r = indexedDB.open("hanabi_img", 1); r.onupgradeneeded = () => r.result.createObjectStore("p"); r.onsuccess = () => ok(r.result); r.onerror = no; });
const idbPut = async (k, v) => { const d = await idb(); return new Promise((ok, no) => { const t = d.transaction("p", "readwrite"); t.objectStore("p").put(v, k); t.oncomplete = ok; t.onerror = no; }); };
const idbGet = async k => { const d = await idb(); return new Promise(ok => { const r = d.transaction("p").objectStore("p").get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); }); };

const head = u => `<div class="phead"><div class="ban" style="${u.banner ? `background-image:url('${esc(u.banner)}')` : ""}"></div>${av(u, "lg")}
  <h1 style="font-size:2rem;margin:8px 0 0">${esc(u.nick)}</h1><span class="perm">${esc(u.perm)}</span>${lvl(u)}
  <p>${esc(u.bio) || '<span class="mute">Sem descrição ainda.</span>'}</p>
  <a class="dbtn" href="${DISCORD}" target="_blank" rel="noopener">${dIcon} Entrar no Discord</a></div>`;
const lists = u => Object.entries(STATUS).map(([k, l]) => { const ws = db.works.filter(w => u.list?.[w.id] === k); return ws.length ? `<h2>${l}</h2><div class="grid">${ws.map(card).join("")}</div>` : ""; }).join("")
  + `<h2>Favoritos</h2><div class="grid">${db.works.filter(w => w.favs.includes(u.id)).map(card).join("") || '<p class="mute">Nenhum favorito.</p>'}</div>`;

function profile() {
  const u = me(); if (!u) return `<h1>Perfil</h1><p>Entre para ver seu perfil.</p>`;
  const left = u.nickChanged + WEEK - Date.now(), can = left <= 0;
  return `${head(u)}
  <p><button class="btn" data-act="checkin">Check-in diário (+XP) · sequência: ${u.streak || 0} dia(s)</button></p>
  <form class="box" id="profForm"><b>Editar perfil</b>
  <label>Foto de perfil (da galeria)<input type="file" name="avatar" accept="image/*"></label>
  <label>Banner (da galeria)<input type="file" name="banner" accept="image/*"></label>
  <label>Descrição<textarea name="bio" rows="3" maxlength="300">${esc(u.bio)}</textarea></label>
  <label>Quem pode ver seu perfil<select name="pub"><option value="1" ${u.pub !== false ? "selected" : ""}>Público</option><option value="0" ${u.pub === false ? "selected" : ""}>Privado</option></select></label>
  <button class="btn">Salvar perfil</button></form>
  <form class="box" id="nickForm"><label>Novo nick<input name="nick" minlength="3" maxlength="20" required ${can ? "" : "disabled"}></label>
  <button class="btn" ${can ? "" : "disabled"}>Trocar nick</button><span class="mute">${can ? "Você pode trocar uma vez por semana." : `Próxima troca em ${Math.ceil(left / 864e5)} dia(s).`}</span></form>
  ${lists(u)}`;
}
function showUser(i) {
  const x = usr(i), m = $("#modal"); if (!x) return;
  const ok = x.pub !== false || (me() && me().id === x.id);
  m.className = ""; m.innerHTML = `<button class="btn ghost sm" data-close>Fechar</button>${ok ? head(x) + lists(x) : `<h2>${av(x)} ${esc(x.nick)}</h2><p class="mute">Este perfil é privado.</p>`}`;
  if (!m.open) m.showModal();
}
/* ---------- Detalhe da obra e player ---------- */
let esort = "old", csort = "old", curW = null, replyTo = null;
const fmt = n => n >= 1000 ? (n / 1000).toFixed(1) + "k" : n;
const grad = w => { const h = [...w.title].reduce((a, c) => a + c.charCodeAt(0), 0) % 360; return `linear-gradient(135deg,hsl(${h} 60% 45%),hsl(${(h + 60) % 360} 60% 25%))`; };
const ago = d => { const m = (Date.now() - d) / 6e4; if (m < 1) return "agora"; if (m < 60) return `${Math.floor(m)} min atrás`; const h = m / 60; if (h < 24) return `${Math.floor(h)} h atrás`; const x = h / 24; if (x < 30) return `${Math.floor(x)} dia(s) atrás`; if (x < 365) return `${Math.floor(x / 30)} mes(es) atrás`; return `${Math.floor(x / 365)} ano(s) atrás`; };
const ccount = w => w.comments.reduce((a, c) => a + 1 + (c.r || []).length, 0);
const cav = c => { const x = usr(c.uid); return x ? `<button class="who" data-user="${x.id}" aria-label="Perfil">${av(x)}</button>` : `<span class="av">?</span>`; };
const cmHtml = (w, c, k) => { const x = usr(c.uid), lk = me() && (c.l || []).includes(me().id);
  return `<div class="cm"><div class="cmain">${cav(c)}<div class="cbody"><b>${esc(x ? x.nick : c.u)}</b><p>${esc(c.t)}</p><small class="mute">${ago(c.d)} · <button class="lk" data-reply="${w.id}:${k}">Responder</button></small></div><button class="hl ${lk ? "on" : ""}" data-like="${w.id}:${k}" aria-label="Curtir">${IC.heart}<span>${(c.l || []).length}</span></button></div>${(c.r || []).map(r => `<div class="rp">${cav(r)}<div><b>${esc(usr(r.uid)?.nick || r.u)}</b><p>${esc(r.t)}</p><small class="mute">${ago(r.d)}</small></div></div>`).join("")}</div>`; };

function openWork(wid) {
  const w = work(wid), u = me(), m = $("#modal"), mine = u ? w.ratings[u.id] || 0 : 0, st = u?.list?.[w.id] || "";
  const done = u?.done?.[w.id] || [], p = u?.prog?.[w.id], cu = safeUrl(w.cover);
  const bg = cu ? `background-image:url('${esc(cu)}')` : `background:${grad(w)}`, fav = u && w.favs.includes(u.id), liked = u && (w.likes || []).includes(u.id);
  const rows = w.items.map((it, i) => ({ it, i })); if (esort === "new") rows.reverse(); curW = wid;
  m.className = "full";
  m.innerHTML = `<div class="hero2" style="${bg}"><div class="hbar"><button class="ic" data-close aria-label="Voltar">${IC.back}</button><button class="ic" data-share="${w.id}" aria-label="Compartilhar">${IC.share}</button></div>
  <div class="hinfo"><button class="btn pill" data-view="${w.id}:${w.items[p] ? p : 0}" ${w.items.length ? "" : "hidden"}>${IC.play} ${w.items[p] ? "Continuar" : w.type === "anime" ? "Assistir" : "Ler"}</button>
  <h1>${esc(w.title)}</h1><p class="meta">${w.age ? `<span class="age a${esc(w.age)}">${esc(w.age)}</span> ` : ""}${esc(w.genres)}${w.year ? " • " + esc(w.year) : ""}</p></div></div>
  <div class="acts"><button data-cm="${w.id}">${ccount(w) ? `<span class="bd">${fmt(ccount(w))}</span>` : ""}${IC.chat}<small>Comentários</small></button>
  <button class="${liked ? "on" : ""}" data-wlike="${w.id}">${(w.likes || []).length ? `<span class="bd">${fmt(w.likes.length)}</span>` : ""}${IC.like}<small>Curtir</small></button>
  <button class="${fav ? "on" : ""}" data-fav="${w.id}">${IC.heart}<small>${fav ? "Favoritado" : "Favoritar"}</small></button></div>
  <p class="desc">${esc(w.desc)}</p>
  <div class="srow"><div class="stars">${[1, 2, 3, 4, 5].map(n => `<button class="${n <= mine ? "on" : ""}" data-rate="${w.id}:${n}" aria-label="${n} estrelas">★</button>`).join("")}<small class="mute"> ${avg(w) ? avg(w).toFixed(1) : "sem notas"} (${Object.keys(w.ratings).length})</small></div>
  <select data-status="${w.id}" aria-label="Minha lista"><option value="">Adicionar à minha lista</option>${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${k === st ? "selected" : ""}>${l}</option>`).join("")}</select></div>
  <div class="sortrow"><button class="btn ghost" data-esort>${esort === "old" ? "Antigos" : "Recentes"} ${IC.sort}</button></div>
  ${rows.map(({ it, i }) => `<button class="ep" data-view="${w.id}:${i}"><span class="th" style="${safeUrl(it.thumb) ? `background-image:url('${esc(it.thumb)}')` : bg}"></span><span class="et"><b>${i + 1}. ${esc(it.title)}</b><small class="mute">${esc(it.dur || it.desc || "")}</small>${done.includes(i) ? ' <i class="ok">✓</i>' : ""}</span></button>`).join("") || '<p class="empty">Ainda sem conteúdo publicado.</p>'}
  <h2 class="rtv">Avaliações</h2><div class="rtv">${Object.entries(w.ratings).map(([k, n]) => `<div class="row">${who(k)}<span class="star">${stars(n)}</span></div>`).join("") || '<p class="mute">Seja o primeiro a avaliar.</p>'}</div><div style="height:40px"></div>`;
  if (!m.open) m.showModal();
}
function openComments(wid) {
  const w = work(wid), u = me(), m = $("#modal"), top = m.scrollTop; curW = wid;
  const l = w.comments.map((c, k) => ({ c, k })); if (csort === "new") l.reverse();
  const to = replyTo !== null ? w.comments[replyTo] : null;
  m.className = "full";
  m.innerHTML = `<div class="chead"><button class="ic" data-open="${w.id}" aria-label="Voltar">${IC.back}</button><h2>Comentários</h2><button class="ic lbl" data-csort aria-label="Ordenar">${csort === "old" ? "Antigos" : "Recentes"} ${IC.filter}</button></div>
  <div class="clist">${l.map(({ c, k }) => cmHtml(w, c, k)).join("") || '<p class="empty">Seja o primeiro a comentar.</p>'}</div>
  <form id="cmtForm" class="cbar" data-w="${w.id}" data-r="${replyTo ?? ""}">${u ? av(u) : IC.user}<input name="t" maxlength="500" required autocomplete="off" placeholder="${to ? `Respondendo a ${esc(usr(to.uid)?.nick || to.u)}…` : "Adicione um comentário…"}"><button class="ic" aria-label="Enviar">${IC.send}</button></form>`;
  if (!m.open) m.showModal(); m.scrollTop = top;
}
async function viewer(wid, i) {
  const w = work(wid), it = w.items[i], m = $("#modal"), u = me();
  if (u) { (u.prog ||= {})[wid] = i; if (!(u.done?.[wid] || []).includes(i)) u.xp = (u.xp || 0) + 5; (u.done ||= {})[wid] = [...new Set([...(u.done[wid] || []), i])]; save(); }
  const nav = `<p>${i > 0 ? `<button class="btn ghost sm" data-view="${wid}:${i - 1}">← Anterior</button> ` : ""}${i < w.items.length - 1 ? `<button class="btn sm" data-view="${wid}:${i + 1}">Próximo →</button>` : ""}</p>`;
  m.className = "full"; m.innerHTML = `<div class="pad"><button class="btn ghost sm" data-open="${wid}">← ${esc(w.title)}</button><h2>${esc(it.title)}</h2><p class="mute">${esc(it.desc)}</p>
  ${w.type === "manga" ? `<div class="bar"><button class="btn ghost sm" data-mode="v">Rolagem</button><button class="btn ghost sm" data-mode="p">Página a página</button></div>` : ""}<div class="viewer" id="vw">Carregando…</div>${nav}</div>`;
  if (w.type === "manga") {
    const src = it.pages || (it.src || "").split("\n");
    const imgs = (await Promise.all(src.map(async s => s.startsWith("idb:") ? await idbGet(s) : safeUrl(s.trim())))).filter(Boolean);
    rd = { imgs, n: 0, mode: localStorage.getItem("hanabi_rd") || "v" }; drawRd();
  } else {
    rd = null; const l = safeUrl((it.src || "").trim()), yt = l.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
    $("#vw").innerHTML = yt ? `<iframe src="https://www.youtube.com/embed/${yt[1]}" allowfullscreen></iframe>` : l ? `<video src="${esc(l)}" controls autoplay></video>` : "<p>Link inválido.</p>";
    $("#vw video")?.addEventListener("ended", () => i < w.items.length - 1 && viewer(wid, i + 1));
  }
}
function drawRd() {
  const el = $("#vw"); if (!el || !rd) return;
  if (!rd.imgs.length) return el.innerHTML = "<p>Sem páginas.</p>";
  el.innerHTML = rd.mode === "v" ? rd.imgs.map(s => `<img loading="lazy" src="${esc(s)}" alt="Página">`).join("")
    : `<img src="${esc(rd.imgs[rd.n])}" alt="Página ${rd.n + 1}" data-next><p class="mute">Página ${rd.n + 1} de ${rd.imgs.length} · toque na imagem ou use as setas do teclado</p>`;
}
const step = d => { if (rd?.mode === "p") { rd.n = Math.max(0, Math.min(rd.imgs.length - 1, rd.n + d)); drawRd(); } };
document.addEventListener("keydown", e => { if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); });

/* ---------- Conta ---------- */
function authModal(mode = "login") {
  const m = $("#modal"), reg = mode === "register";
  m.className = ""; m.innerHTML = `<h2>${reg ? "Criar conta" : "Entrar"}</h2><form class="box" id="authForm" data-mode="${mode}" style="max-width:none">
  ${reg ? `<label>Nick (pode trocar 1x por semana)<input name="nick" minlength="3" maxlength="20" required></label><label>Nick perm (fixo, aparece abaixo do nick)<input name="perm" minlength="3" maxlength="20" required></label>` : ""}
  <label>E-mail<input name="email" type="email" required></label><label>Senha<input name="pass" type="password" minlength="6" required></label>
  <button class="btn">${reg ? "Criar conta" : "Entrar"}</button>
  <button type="button" class="btn ghost" data-act="${reg ? "login" : "register"}">${reg ? "Já tenho conta" : "Quero criar conta"}</button></form>`;
  if (!m.open) m.showModal();
}

/* ---------- Eventos ---------- */
document.addEventListener("click", async e => {
  const t = e.target.closest("button,a"); if (!t) return;
  const d = t.dataset;
  if (d.tab) { e.preventDefault(); tab = d.tab; q = genre = ""; $("#modal").close(); render(); window.scrollTo(0, 0); }
  else if (d.open) openWork(d.open);
  else if (d.act === "search") searchModal();
  else if (d.lang) { I18N.set(d.lang); render(); }
  else if (d.cm) { replyTo = null; openComments(d.cm); }
  else if (d.csort !== undefined) { csort = csort === "old" ? "new" : "old"; openComments(curW); }
  else if (d.esort !== undefined) { esort = esort === "old" ? "new" : "old"; openWork(curW); }
  else if (d.wlike) { if (!need()) return; const w = work(d.wlike), x = me().id; w.likes = (w.likes || []).includes(x) ? w.likes.filter(y => y !== x) : [...(w.likes || []), x]; save(); openWork(w.id); }
  else if (d.reply) { const [wi, k] = d.reply.split(":"); replyTo = +k; openComments(wi); $("#cmtForm input").focus(); }
  else if (d.share) { const w = work(d.share); if (navigator.share) navigator.share({ title: w.title, url: location.href }).catch(() => {}); else { navigator.clipboard?.writeText(location.href); toast("Link copiado!"); } }
  else if (d.user) showUser(d.user);
  else if (d.mode) { localStorage.setItem("hanabi_rd", d.mode); if (rd) { rd.mode = d.mode; drawRd(); } }
  else if (d.view) viewer(...d.view.split(":").map((v, i) => i ? +v : v));
  else if (d.close !== undefined) $("#modal").close();
  else if (d.act === "login") authModal("login");
  else if (d.act === "register") authModal("register");
  else if (d.act === "checkin") { const u = me(), hoje = new Date().toDateString(), ontem = new Date(Date.now() - 864e5).toDateString(); if (u.last === hoje) toast("Você já fez o check-in hoje."); else { u.streak = u.last === ontem ? (u.streak || 0) + 1 : 1; u.last = hoje; gain(15 + Math.min(u.streak, 7)); save(); render(); toast(`Check-in feito! Sequência: ${u.streak} dia(s).`); } }
  else if (d.like) { if (!need()) return; const [wi, k] = d.like.split(":"), c = work(wi).comments[+k], x = me().id; c.l = c.l || []; c.l = c.l.includes(x) ? c.l.filter(y => y !== x) : [...c.l, x]; save(); openComments(wi); }
  else if (d.delnews) { db.news = db.news.filter(n => n.id !== d.delnews); save(); render(); }
  else if (d.act === "logout") { db.session = null; save(); tab = "home"; render(); toast("Você saiu."); }
  else if (d.fav) { if (!need()) return; const w = work(d.fav), u = me(); w.favs = w.favs.includes(u.id) ? w.favs.filter(x => x !== u.id) : [...w.favs, u.id]; save(); openWork(w.id); render(); }
  else if (d.rate) { if (!need()) return; const [w, n] = d.rate.split(":"); { const r = work(w).ratings, uu = me(); if (!r[uu.id]) gain(5); r[uu.id] = +n; } save(); openWork(w); render(); toast("Nota registrada!"); }
  else if (d.vote) { if (!need()) return; const [pid, i] = d.vote.split(":"), p = db.polls.find(x => x.id === pid), u = me(); p.opts.forEach(o => o.v = o.v.filter(x => x !== u.id)); p.opts[+i].v.push(u.id); save(); render(); }
  else if (d.del && confirm(tr("Apagar esta obra?"))) { db.works = db.works.filter(w => w.id !== d.del); save(); render(); }
  else if (d.delpoll && confirm(tr("Apagar esta enquete?"))) { db.polls = db.polls.filter(p => p.id !== d.delpoll); save(); render(); }
});
document.addEventListener("input", e => {
  if (e.target.id === "gsearch") $("#gres").innerHTML = searchRes(e.target.value);
});
document.addEventListener("click", e => { if (e.target.dataset.next !== undefined) step(1); });
document.addEventListener("change", e => {
  const k = e.target.dataset.status;
  if (k) { if (!need()) { e.target.value = ""; return; } const u = me(); u.list ||= {}; e.target.value ? u.list[k] = e.target.value : delete u.list[k]; save(); toast("Lista atualizada!"); return; }
  if (e.target.id === "genre") { genre = e.target.value; render(); }
  if (e.target.id === "sort") { sort = e.target.value; render(); } });

document.addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, v = fd(f), u = me();
  if (f.id === "authForm") {
    const email = v.email.trim().toLowerCase(), hash = await sha(email + v.pass);
    if (f.dataset.mode === "register") {
      if (db.users.some(x => x.email === email)) return toast("Este e-mail já tem conta.");
      if (db.users.some(x => x.nick.toLowerCase() === v.nick.toLowerCase() || x.perm.toLowerCase() === v.perm.toLowerCase())) return toast("Nick ou Nick perm já em uso.");
      const nu = { id: id(), email, hash, nick: v.nick.trim(), perm: v.perm.trim(), nickChanged: 0, bio: "", pub: true, list: {}, prog: {}, done: {} };
      db.users.push(nu); db.session = nu.id; toast(db.users.length === 1 ? "Conta criada! Você é o administrador." : "Conta criada!");
    } else {
      const f2 = db.users.find(x => x.email === email && x.hash === hash);
      if (!f2) return toast("E-mail ou senha incorretos.");
      db.session = f2.id; toast("Bem-vindo de volta, " + f2.nick + "!");
    }
    save(); $("#modal").close(); render();
  } else if (f.id === "profForm") {
    const a = f.elements.avatar.files[0], b = f.elements.banner.files[0];
    if (a) u.avatar = await toImg(a, 256, 256, .85); if (b) u.banner = await toImg(b, 1000, 300, .8);
    u.bio = v.bio.trim(); u.pub = v.pub === "1"; save(); render(); toast("Perfil salvo!");
  } else if (f.id === "nickForm") {
    if (db.users.some(x => x.id !== u.id && x.nick.toLowerCase() === v.nick.toLowerCase())) return toast("Esse nick já está em uso.");
    u.nick = v.nick.trim(); u.nickChanged = Date.now(); save(); render(); toast("Nick atualizado!");
  } else if (f.id === "fbForm") {
    if (!need()) return; db.feedback.push({ u: u.nick, t: v.t.trim(), d: Date.now() }); gain(10); save(); render(); toast("Obrigado pelo feedback!");
  } else if (f.id === "cmtForm") {
    if (!need()) return; const w = work(f.dataset.w), o = { uid: u.id, u: u.nick, t: v.t.trim(), d: Date.now() };
    if (f.dataset.r !== "") (w.comments[+f.dataset.r].r ||= []).push(o); else w.comments.push({ ...o, l: [] });
    replyTo = null; gain(10); save(); openComments(w.id);
  } else if (f.id === "workForm" && isAdmin()) {
    let cv = v.cover.trim(); if (v.coverfile.size) cv = await toImg(v.coverfile, 400, 560, .8);
    db.works.push({ id: id(), type: v.type, title: v.title.trim(), desc: v.desc.trim(), cover: cv, genres: v.genres, year: v.year.trim(), age: v.age.trim(), items: [], ratings: {}, favs: [], comments: [] }); save(); render(); toast("Publicado!");
  } else if (f.id === "itemForm" && isAdmin()) {
    const w = work(v.wid), it = { title: v.title.trim(), desc: v.desc.trim(), dur: v.dur.trim(), src: v.src.trim() };
    if (v.thumb.size) it.thumb = await toImg(v.thumb, 480, 270, .7);
    if (w.type === "manga") {
      toast("Enviando páginas…"); it.pages = [];
      for (const file of [...f.elements.pages.files].sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }))) { const k = "idb:" + id(); await idbPut(k, await toImg(file, 900, 0, .7)); it.pages.push(k); }
      it.pages.push(...it.src.split("\n").map(x => x.trim()).filter(Boolean));
      if (!it.pages.length) return toast("Adicione ao menos uma página.");
    } else if (!it.src) return toast("Coloque o link do vídeo.");
    w.items.push(it); save(); render(); toast("Adicionado!");
  } else if (f.id === "newsForm" && isAdmin()) {
    (db.news ||= []).unshift({ id: id(), t: v.t.trim(), b: v.b.trim(), d: Date.now() }); save(); render(); toast("Novidade publicada!");
  } else if (f.id === "pollForm" && isAdmin()) {
    const o = v.o.split("\n").map(s => s.trim()).filter(Boolean);
    if (o.length < 2) return toast("Coloque ao menos 2 opções.");
    db.polls.push({ id: id(), q: v.q.trim(), opts: o.map(t => ({ t, v: [] })) }); save(); render(); toast("Enquete criada!");
  }
});
render();
