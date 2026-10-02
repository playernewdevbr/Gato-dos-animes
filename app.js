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
  return `<div class="cv" style="${bg}">${u ? "" : esc(w.title.replace(/^Exemplo: /, "")[0] || "?")}<span class="tag">${w.type === "anime" ? "Anime" : "Mangá"}</span></div>`;
}
const card = w => `<button class="card" data-open="${w.id}">${cover(w)}<b>${esc(w.title)}</b><span class="mute"><span class="star">★</span> ${avg(w) ? avg(w).toFixed(1) : "—"} · ${w.favs.length} favoritos</span></button>`;

function render() {
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  $("#navAdmin").hidden = !isAdmin();
  const u = me();
  $("#userbox").innerHTML = u
    ? `<button class="btn ghost sm" data-tab="profile">${av(u)} <b>${esc(u.nick)}</b><span class="perm">${esc(u.perm)}</span></button> <button class="btn ghost sm" data-act="logout">Sair</button>`
    : `<button class="btn sm" data-act="login">Entrar</button> <button class="btn ghost sm" data-act="register">Criar conta</button>`;
  const v = { home, news, anime: () => catalog("anime"), manga: () => catalog("manga"), polls, feedback, profile, admin }[tab];
  $("#app").innerHTML = v();
}

function home() {
  const top = [...db.works].sort((a, b) => avg(b) - avg(a))[0];
  const rec = [...db.works].reverse().slice(0, 12);
  return `${top ? `<section class="hero"><div><p class="mute">Em destaque</p><h1>${esc(top.title)}</h1><p>${esc(top.desc).slice(0, 220)}</p><button class="btn" data-open="${top.id}">Ver detalhes</button></div>${cover(top)}</section>` : `<h1>Bem-vindo ao Sim Dragon Animes</h1>`}
  ${extras()}<h2>Adicionados recentemente</h2><div class="grid">${rec.map(card).join("") || '<p class="mute">Nada publicado ainda.</p>'}</div>`;
}

function catalog(type) {
  let list = db.works.filter(w => w.type === type && w.title.toLowerCase().includes(q.toLowerCase()) && (!genre || w.genres.toLowerCase().includes(genre.toLowerCase())));
  list = sortW(list);
  const gs = [...new Set(db.works.filter(w => w.type === type).flatMap(w => w.genres.split(",").map(g => g.trim()).filter(Boolean)))];
  return `<h1>${type === "anime" ? "Animes" : "Mangás"}</h1>
  <div class="bar"><input id="search" placeholder="Buscar título" value="${esc(q)}" aria-label="Buscar"><select id="sort" aria-label="Ordenar">${Object.entries(SORTS).map(([k, l]) => `<option value="${k}" ${k === sort ? "selected" : ""}>${l}</option>`).join("")}</select><select id="genre"><option value="">Todos os gêneros</option>${gs.map(g => `<option ${g === genre ? "selected" : ""}>${esc(g)}</option>`).join("")}</select></div>
  <div class="grid">${list.map(card).join("") || '<p class="mute">Nenhum resultado. Tente outra busca.</p>'}</div>`;
}

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
  <input name="genres" placeholder="Gêneros separados por vírgula"><textarea name="desc" rows="3" placeholder="Descrição" required></textarea><button class="btn">Publicar</button></form>
  <form class="box" id="itemForm"><b>Adicionar episódio ou capítulo</b><select name="wid" required>${opts}</select>
  <input name="title" placeholder="Título (ex.: Capítulo 1)" required><textarea name="desc" rows="2" placeholder="Descrição do episódio/capítulo"></textarea>
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
  m.innerHTML = `<button class="btn ghost sm" data-close>Fechar</button>${ok ? head(x) + lists(x) : `<h2>${av(x)} ${esc(x.nick)}</h2><p class="mute">Este perfil é privado.</p>`}`;
  if (!m.open) m.showModal();
}
function extras() {
  const u = me(), cont = u ? Object.entries(u.prog || {}).filter(([w, i]) => work(w)?.items[i]) : [];
  const top = [...db.works].filter(avg).sort((a, b) => avg(b) - avg(a)).slice(0, 5);
  const nw = (db.news || []).slice(0, 2);
  return (nw.length ? `<h2>Novidades</h2>${nw.map(newsCard).join("")}` : "") + (cont.length ? `<h2>Continuar de onde parou</h2>${cont.map(([w, i]) => `<div class="row"><span>${esc(work(w).title)} — ${esc(work(w).items[i].title)}</span><button class="btn sm" data-view="${w}:${i}">Continuar</button></div>`).join("")}` : "")
    + (top.length ? `<h2>Mais bem avaliados</h2>${top.map((w, n) => `<button class="row" data-open="${w.id}"><span>#${n + 1} ${esc(w.title)}</span><span class="star">★ ${avg(w).toFixed(1)}</span></button>`).join("")}` : "");
}

/* ---------- Detalhe da obra e player ---------- */
function openWork(wid) {
  const w = work(wid), u = me(), m = $("#modal"), mine = u ? w.ratings[u.id] || 0 : 0, st = u?.list?.[w.id] || "";
  const done = u?.done?.[w.id] || [], p = u?.prog?.[w.id];
  m.innerHTML = `<div class="det">${cover(w)}<div><h1 style="font-size:2rem">${esc(w.title)}</h1>
  <p class="mute">${esc(w.genres)}</p><p><span class="star">${stars(avg(w))}</span> ${avg(w) ? avg(w).toFixed(1) : "sem notas"} (${Object.keys(w.ratings).length})</p>
  <p>${esc(w.desc)}</p>
  <button class="btn" data-fav="${w.id}">${u && w.favs.includes(u.id) ? "★ Favoritado" : "☆ Favoritar"}</button> <button class="btn ghost" data-close>Fechar</button>
  <p><select data-status="${w.id}" aria-label="Minha lista"><option value="">Adicionar à minha lista</option>${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${k === st ? "selected" : ""}>${l}</option>`).join("")}</select></p>
  <p class="mute">Sua nota:</p><div class="stars">${[1, 2, 3, 4, 5].map(n => `<button class="${n <= mine ? "on" : ""}" data-rate="${w.id}:${n}" aria-label="${n} estrelas">★</button>`).join("")}</div></div></div>
  <h2>${w.type === "anime" ? "Episódios" : "Capítulos"}</h2>
  ${w.items[p] ? `<button class="btn" data-view="${w.id}:${p}">Continuar: ${esc(w.items[p].title)}</button>` : ""}
  ${w.items.map((it, i) => `<div class="row"><span>${done.includes(i) ? "✓ " : ""}${esc(it.title)}<br><small class="mute">${esc(it.desc)}</small></span><button class="btn sm" data-view="${w.id}:${i}">${w.type === "anime" ? "Assistir" : "Ler"}</button></div>`).join("") || '<p class="mute">Ainda sem conteúdo publicado.</p>'}
  <h2>Avaliações</h2>${Object.entries(w.ratings).map(([k, n]) => `<div class="row">${who(k)}<span class="star">${stars(n)}</span></div>`).join("") || '<p class="mute">Seja o primeiro a avaliar.</p>'}
  <h2>Comentários</h2><form id="cmtForm" data-w="${w.id}" class="box" style="max-width:none"><textarea name="t" rows="2" maxlength="500" required placeholder="${u ? "Escreva um comentário" : "Entre para comentar"}"></textarea><button class="btn sm">Comentar</button></form>
  ${w.comments.map((c, k) => ({ c, k })).reverse().map(({ c, k }) => `<div class="cmt">${who(c.uid, c.u)} <span class="mute">${new Date(c.d).toLocaleDateString("pt-BR")}</span><br>${esc(c.t)}<br><button class="like ${u && (c.l || []).includes(u.id) ? "on" : ""}" data-like="${w.id}:${k}">♥ ${(c.l || []).length}</button></div>`).join("")}`;
  if (!m.open) m.showModal();
}
async function viewer(wid, i) {
  const w = work(wid), it = w.items[i], m = $("#modal"), u = me();
  if (u) { (u.prog ||= {})[wid] = i; if (!(u.done?.[wid] || []).includes(i)) u.xp = (u.xp || 0) + 5; (u.done ||= {})[wid] = [...new Set([...(u.done[wid] || []), i])]; save(); }
  const nav = `<p>${i > 0 ? `<button class="btn ghost sm" data-view="${wid}:${i - 1}">← Anterior</button> ` : ""}${i < w.items.length - 1 ? `<button class="btn sm" data-view="${wid}:${i + 1}">Próximo →</button>` : ""}</p>`;
  m.innerHTML = `<button class="btn ghost sm" data-open="${wid}">← ${esc(w.title)}</button><h2>${esc(it.title)}</h2><p class="mute">${esc(it.desc)}</p>
  ${w.type === "manga" ? `<div class="bar"><button class="btn ghost sm" data-mode="v">Rolagem</button><button class="btn ghost sm" data-mode="p">Página a página</button></div>` : ""}<div class="viewer" id="vw">Carregando…</div>${nav}`;
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
  m.innerHTML = `<h2>${reg ? "Criar conta" : "Entrar"}</h2><form class="box" id="authForm" data-mode="${mode}" style="max-width:none">
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
  else if (d.user) showUser(d.user);
  else if (d.mode) { localStorage.setItem("hanabi_rd", d.mode); if (rd) { rd.mode = d.mode; drawRd(); } }
  else if (d.view) viewer(...d.view.split(":").map((v, i) => i ? +v : v));
  else if (d.close !== undefined) $("#modal").close();
  else if (d.act === "login") authModal("login");
  else if (d.act === "register") authModal("register");
  else if (d.act === "checkin") { const u = me(), hoje = new Date().toDateString(), ontem = new Date(Date.now() - 864e5).toDateString(); if (u.last === hoje) toast("Você já fez o check-in hoje."); else { u.streak = u.last === ontem ? (u.streak || 0) + 1 : 1; u.last = hoje; gain(15 + Math.min(u.streak, 7)); save(); render(); toast(`Check-in feito! Sequência: ${u.streak} dia(s).`); } }
  else if (d.like) { if (!need()) return; const [wi, k] = d.like.split(":"), c = work(wi).comments[+k], x = me().id; c.l = c.l || []; c.l = c.l.includes(x) ? c.l.filter(y => y !== x) : [...c.l, x]; save(); openWork(wi); }
  else if (d.delnews) { db.news = db.news.filter(n => n.id !== d.delnews); save(); render(); }
  else if (d.act === "logout") { db.session = null; save(); tab = "home"; render(); toast("Você saiu."); }
  else if (d.fav) { if (!need()) return; const w = work(d.fav), u = me(); w.favs = w.favs.includes(u.id) ? w.favs.filter(x => x !== u.id) : [...w.favs, u.id]; save(); openWork(w.id); render(); }
  else if (d.rate) { if (!need()) return; const [w, n] = d.rate.split(":"); { const r = work(w).ratings, uu = me(); if (!r[uu.id]) gain(5); r[uu.id] = +n; } save(); openWork(w); render(); toast("Nota registrada!"); }
  else if (d.vote) { if (!need()) return; const [pid, i] = d.vote.split(":"), p = db.polls.find(x => x.id === pid), u = me(); p.opts.forEach(o => o.v = o.v.filter(x => x !== u.id)); p.opts[+i].v.push(u.id); save(); render(); }
  else if (d.del && confirm("Apagar esta obra?")) { db.works = db.works.filter(w => w.id !== d.del); save(); render(); }
  else if (d.delpoll && confirm("Apagar esta enquete?")) { db.polls = db.polls.filter(p => p.id !== d.delpoll); save(); render(); }
});
document.addEventListener("input", e => {
  if (e.target.id === "search") { q = e.target.value; const p = e.target.selectionStart; render(); const s = $("#search"); s.focus(); s.setSelectionRange(p, p); }
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
    if (!need()) return; work(f.dataset.w).comments.push({ uid: u.id, u: u.nick, t: v.t.trim(), d: Date.now(), l: [] }); gain(10); save(); openWork(f.dataset.w);
  } else if (f.id === "workForm" && isAdmin()) {
    let cv = v.cover.trim(); if (v.coverfile.size) cv = await toImg(v.coverfile, 400, 560, .8);
    db.works.push({ id: id(), type: v.type, title: v.title.trim(), desc: v.desc.trim(), cover: cv, genres: v.genres, items: [], ratings: {}, favs: [], comments: [] }); save(); render(); toast("Publicado!");
  } else if (f.id === "itemForm" && isAdmin()) {
    const w = work(v.wid), it = { title: v.title.trim(), desc: v.desc.trim(), src: v.src.trim() };
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
