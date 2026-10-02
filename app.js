"use strict";
/* Hanabi — dados salvos no navegador (localStorage). Veja o README no chat sobre limites. */
const KEY = "hanabi_v1", WEEK = 7 * 864e5;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const id = () => Math.random().toString(36).slice(2, 10);
const sha = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, "0")).join("");
const safeUrl = u => /^https?:\/\//i.test(u || "") ? u : "";

let db = JSON.parse(localStorage.getItem(KEY) || "null") || {
  users: [], session: null, feedback: [],
  works: [
    { id: id(), type: "anime", title: "Exemplo: Aventura Estelar", desc: "Obra de exemplo. O administrador pode apagar e publicar as suas.", cover: "", genres: "Ação, Aventura", items: [], ratings: {}, favs: [], comments: [] },
    { id: id(), type: "manga", title: "Exemplo: Sombras de Papel", desc: "Mangá de exemplo para você ver como fica o catálogo.", cover: "", genres: "Drama, Mistério", items: [], ratings: {}, favs: [], comments: [] }
  ],
  polls: [{ id: id(), q: "Qual gênero você quer ver mais aqui?", opts: [{ t: "Ação", v: [] }, { t: "Romance", v: [] }, { t: "Terror", v: [] }] }]
};
const save = () => localStorage.setItem(KEY, JSON.stringify(db));
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
    ? `<button class="btn ghost sm" data-tab="profile"><b>${esc(u.nick)}</b><span class="perm">${esc(u.perm)}</span></button> <button class="btn ghost sm" data-act="logout">Sair</button>`
    : `<button class="btn sm" data-act="login">Entrar</button> <button class="btn ghost sm" data-act="register">Criar conta</button>`;
  const v = { home, anime: () => catalog("anime"), manga: () => catalog("manga"), polls, feedback, profile, admin }[tab];
  $("#app").innerHTML = v();
}

function home() {
  const top = [...db.works].sort((a, b) => avg(b) - avg(a))[0];
  const rec = [...db.works].reverse().slice(0, 12);
  return `${top ? `<section class="hero"><div><p class="mute">Em destaque</p><h1>${esc(top.title)}</h1><p>${esc(top.desc).slice(0, 220)}</p><button class="btn" data-open="${top.id}">Ver detalhes</button></div>${cover(top)}</section>` : `<h1>Bem-vindo ao Hanabi</h1>`}
  <h2>Adicionados recentemente</h2><div class="grid">${rec.map(card).join("") || '<p class="mute">Nada publicado ainda.</p>'}</div>`;
}

function catalog(type) {
  let list = db.works.filter(w => w.type === type && w.title.toLowerCase().includes(q.toLowerCase()) && (!genre || w.genres.toLowerCase().includes(genre.toLowerCase())));
  const gs = [...new Set(db.works.filter(w => w.type === type).flatMap(w => w.genres.split(",").map(g => g.trim()).filter(Boolean)))];
  return `<h1>${type === "anime" ? "Animes" : "Mangás"}</h1>
  <div class="bar"><input id="search" placeholder="Buscar título" value="${esc(q)}" aria-label="Buscar"><select id="genre"><option value="">Todos os gêneros</option>${gs.map(g => `<option ${g === genre ? "selected" : ""}>${esc(g)}</option>`).join("")}</select></div>
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

function profile() {
  const u = me(); if (!u) return `<h1>Perfil</h1><p>Entre para ver seu perfil.</p>`;
  const left = u.nickChanged + WEEK - Date.now(), can = left <= 0;
  return `<h1>${esc(u.nick)}</h1><p class="perm" style="font-size:1rem">${esc(u.perm)}</p><p class="mute">${esc(u.email)}${isAdmin() ? " · Administrador" : ""}</p>
  <form class="box" id="nickForm"><label>Novo nick<input name="nick" minlength="3" maxlength="20" required ${can ? "" : "disabled"}></label>
  <button class="btn" ${can ? "" : "disabled"}>Trocar nick</button><span class="mute">${can ? "Você pode trocar uma vez por semana." : `Próxima troca em ${Math.ceil(left / 864e5)} dia(s).`}</span></form>
  <h2>Meus favoritos</h2><div class="grid">${db.works.filter(w => w.favs.includes(u.id)).map(card).join("") || '<p class="mute">Favorite uma obra para ela aparecer aqui.</p>'}</div>`;
}

function admin() {
  if (!isAdmin()) return "<p>Acesso restrito.</p>";
  const opts = db.works.map(w => `<option value="${w.id}">${esc(w.title)} (${w.type})</option>`).join("");
  return `<h1>Painel</h1>
  <form class="box" id="workForm"><b>Publicar anime ou mangá</b>
  <select name="type"><option value="anime">Anime</option><option value="manga">Mangá</option></select>
  <input name="title" placeholder="Título" required><input name="cover" placeholder="URL da capa (https://...)">
  <input name="genres" placeholder="Gêneros separados por vírgula"><textarea name="desc" rows="3" placeholder="Descrição" required></textarea><button class="btn">Publicar</button></form>
  <form class="box" id="itemForm"><b>Adicionar episódio ou capítulo</b><select name="wid" required>${opts}</select>
  <input name="title" placeholder="Título (ex.: Episódio 1)" required>
  <textarea name="src" rows="4" placeholder="Anime: link do vídeo (mp4 ou YouTube).&#10;Mangá: um link de imagem por linha, na ordem das páginas." required></textarea><button class="btn">Adicionar</button></form>
  <form class="box" id="pollForm"><b>Criar enquete</b><input name="q" placeholder="Pergunta" required><textarea name="o" rows="3" placeholder="Uma opção por linha (mínimo 2)" required></textarea><button class="btn">Criar enquete</button></form>
  <h2>Gerenciar</h2>${db.works.map(w => `<div class="row"><span>${esc(w.title)}</span><button class="btn ghost sm" data-del="${w.id}">Apagar</button></div>`).join("")}
  ${db.polls.map(p => `<div class="row"><span>Enquete: ${esc(p.q)}</span><button class="btn ghost sm" data-delpoll="${p.id}">Apagar</button></div>`).join("")}`;
}

/* ---------- Detalhe da obra ---------- */
function openWork(wid) {
  const w = work(wid), u = me(), m = $("#modal"), mine = u ? w.ratings[u.id] || 0 : 0;
  const lab = w.type === "anime" ? "Episódios" : "Capítulos";
  m.innerHTML = `<div class="det">${cover(w)}<div><h1 style="font-size:2rem">${esc(w.title)}</h1>
  <p class="mute">${esc(w.genres)}</p><p><span class="star">${stars(avg(w))}</span> ${avg(w) ? avg(w).toFixed(1) : "sem notas"} (${Object.keys(w.ratings).length})</p>
  <p>${esc(w.desc)}</p>
  <button class="btn" data-fav="${w.id}">${u && w.favs.includes(u.id) ? "★ Favoritado" : "☆ Favoritar"}</button> <button class="btn ghost" data-close>Fechar</button>
  <p class="mute">Sua nota:</p><div class="stars">${[1, 2, 3, 4, 5].map(n => `<button class="${n <= mine ? "on" : ""}" data-rate="${w.id}:${n}" aria-label="${n} estrelas">★</button>`).join("")}</div></div></div>
  <h2>${lab}</h2>${w.items.map((it, i) => `<div class="row"><span>${esc(it.title)}</span><button class="btn sm" data-view="${w.id}:${i}">${w.type === "anime" ? "Assistir" : "Ler"}</button></div>`).join("") || '<p class="mute">Ainda sem conteúdo publicado.</p>'}
  <h2>Comentários</h2><form id="cmtForm" data-w="${w.id}" class="box" style="max-width:none"><textarea name="t" rows="2" maxlength="500" required placeholder="${u ? "Escreva um comentário" : "Entre para comentar"}"></textarea><button class="btn sm">Comentar</button></form>
  ${w.comments.slice().reverse().map(c => `<div class="cmt"><b>${esc(c.u)}</b> <span class="mute">${new Date(c.d).toLocaleDateString("pt-BR")}</span><br>${esc(c.t)}</div>`).join("")}`;
  if (!m.open) m.showModal();
}
function viewer(wid, i) {
  const w = work(wid), it = w.items[i], m = $("#modal");
  let body;
  if (w.type === "manga") body = it.src.split("\n").map(s => safeUrl(s.trim())).filter(Boolean).map(s => `<img loading="lazy" src="${esc(s)}" alt="Página">`).join("");
  else {
    const u = safeUrl(it.src.trim()), yt = u.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
    body = yt ? `<iframe src="https://www.youtube.com/embed/${yt[1]}" allowfullscreen></iframe>` : `<video src="${esc(u)}" controls></video>`;
  }
  m.innerHTML = `<button class="btn ghost sm" data-open="${w.id}">← Voltar</button><h2>${esc(w.title)} — ${esc(it.title)}</h2><div class="viewer">${body || "<p>Link inválido.</p>"}</div>
  <p>${i > 0 ? `<button class="btn ghost sm" data-view="${w.id}:${i - 1}">Anterior</button> ` : ""}${i < w.items.length - 1 ? `<button class="btn sm" data-view="${w.id}:${i + 1}">Próximo</button>` : ""}</p>`;
}

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
  else if (d.view) viewer(...d.view.split(":").map((v, i) => i ? +v : v));
  else if (d.close !== undefined) $("#modal").close();
  else if (d.act === "login") authModal("login");
  else if (d.act === "register") authModal("register");
  else if (d.act === "logout") { db.session = null; save(); tab = "home"; render(); toast("Você saiu."); }
  else if (d.fav) { if (!need()) return; const w = work(d.fav), u = me(); w.favs = w.favs.includes(u.id) ? w.favs.filter(x => x !== u.id) : [...w.favs, u.id]; save(); openWork(w.id); render(); }
  else if (d.rate) { if (!need()) return; const [w, n] = d.rate.split(":"); work(w).ratings[me().id] = +n; save(); openWork(w); render(); toast("Nota registrada!"); }
  else if (d.vote) { if (!need()) return; const [pid, i] = d.vote.split(":"), p = db.polls.find(x => x.id === pid), u = me(); p.opts.forEach(o => o.v = o.v.filter(x => x !== u.id)); p.opts[+i].v.push(u.id); save(); render(); }
  else if (d.del && confirm("Apagar esta obra?")) { db.works = db.works.filter(w => w.id !== d.del); save(); render(); }
  else if (d.delpoll && confirm("Apagar esta enquete?")) { db.polls = db.polls.filter(p => p.id !== d.delpoll); save(); render(); }
});
document.addEventListener("input", e => {
  if (e.target.id === "search") { q = e.target.value; const p = e.target.selectionStart; render(); const s = $("#search"); s.focus(); s.setSelectionRange(p, p); }
});
document.addEventListener("change", e => { if (e.target.id === "genre") { genre = e.target.value; render(); } });

document.addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, v = fd(f), u = me();
  if (f.id === "authForm") {
    const email = v.email.trim().toLowerCase(), hash = await sha(email + v.pass);
    if (f.dataset.mode === "register") {
      if (db.users.some(x => x.email === email)) return toast("Este e-mail já tem conta.");
      if (db.users.some(x => x.nick.toLowerCase() === v.nick.toLowerCase() || x.perm.toLowerCase() === v.perm.toLowerCase())) return toast("Nick ou Nick perm já em uso.");
      const nu = { id: id(), email, hash, nick: v.nick.trim(), perm: v.perm.trim(), nickChanged: 0 };
      db.users.push(nu); db.session = nu.id; toast(db.users.length === 1 ? "Conta criada! Você é o administrador." : "Conta criada!");
    } else {
      const f2 = db.users.find(x => x.email === email && x.hash === hash);
      if (!f2) return toast("E-mail ou senha incorretos.");
      db.session = f2.id; toast("Bem-vindo de volta, " + f2.nick + "!");
    }
    save(); $("#modal").close(); render();
  } else if (f.id === "nickForm") {
    if (db.users.some(x => x.id !== u.id && x.nick.toLowerCase() === v.nick.toLowerCase())) return toast("Esse nick já está em uso.");
    u.nick = v.nick.trim(); u.nickChanged = Date.now(); save(); render(); toast("Nick atualizado!");
  } else if (f.id === "fbForm") {
    if (!need()) return; db.feedback.push({ u: u.nick, t: v.t.trim(), d: Date.now() }); save(); render(); toast("Obrigado pelo feedback!");
  } else if (f.id === "cmtForm") {
    if (!need()) return; work(f.dataset.w).comments.push({ u: u.nick, t: v.t.trim(), d: Date.now() }); save(); openWork(f.dataset.w);
  } else if (f.id === "workForm" && isAdmin()) {
    db.works.push({ id: id(), type: v.type, title: v.title.trim(), desc: v.desc.trim(), cover: v.cover.trim(), genres: v.genres, items: [], ratings: {}, favs: [], comments: [] }); save(); render(); toast("Publicado!");
  } else if (f.id === "itemForm" && isAdmin()) {
    work(v.wid).items.push({ title: v.title.trim(), src: v.src.trim() }); save(); render(); toast("Adicionado!");
  } else if (f.id === "pollForm" && isAdmin()) {
    const o = v.o.split("\n").map(s => s.trim()).filter(Boolean);
    if (o.length < 2) return toast("Coloque ao menos 2 opções.");
    db.polls.push({ id: id(), q: v.q.trim(), opts: o.map(t => ({ t, v: [] })) }); save(); render(); toast("Enquete criada!");
  }
});
render();
