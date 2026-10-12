const LANGS = ["en", "de", "zh", "fr"];
const PAGE_SIZE = 5;
const $ = (sel) => document.querySelector(sel);
const state = { lang: "en", base: {}, strings: {}, projects: [], selected: 0, page: 0, theme: "light" };

/* Loads a JSON file. Leading "// ..." comment lines (e.g. "// de") are ignored. */
async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const text = await res.text();
  return JSON.parse(text.replace(/^(\s*\/\/.*(\r?\n|$))+/, ""));
}

const t = (key) => state.strings[key] ?? state.base[key] ?? key;

function applyStrings() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const v = state.strings[el.dataset.i18n] ?? state.base[el.dataset.i18n];
    if (v !== undefined) el.innerHTML = v;
  });
  $("#language-select").value = state.lang;
  renderTheme();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ---------- Projects ---------- */
async function loadProjects() {
  let ids;
  try {
    ids = await loadJSON("projects/projects.json");
  } catch {
    state.projects = [];
    return;
  }
  const order = [...new Set([state.lang, "en", ...LANGS])];
  const loaded = await Promise.all(ids.map(async (id) => {
    for (const lang of order) {
      try { return { id, lang, data: await loadJSON(`projects/${id}/${lang}.json`) }; } catch { }
    }
    return null;
  }));
  state.projects = loaded.filter(Boolean);
}

function renderProjects() {
  const list = $("#project-list");
  list.replaceChildren();
  const total = state.projects.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  state.selected = Math.min(state.selected, Math.max(0, total - 1));
  state.page = Math.min(state.page, pages - 1);

  state.projects.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE).forEach((p, i) => {
    const index = state.page * PAGE_SIZE + i;
    const li = el("li");
    const btn = el("button", "project-button" + (index === state.selected ? " active" : ""));
    btn.type = "button";
    btn.setAttribute("aria-pressed", String(index === state.selected));
    btn.append(el("span", "work-type", p.data.type || "N/A"), el("span", "title", p.data.title || p.id));
    btn.addEventListener("click", () => { state.selected = index; renderProjects(); });
    li.append(btn);
    list.append(li);
  });

  $("#pager").hidden = total <= PAGE_SIZE;
  $("#page-info").textContent = t("pageInfo").replace("{page}", state.page + 1).replace("{total}", pages);
  $("#prev-page").disabled = state.page === 0;
  $("#next-page").disabled = state.page >= pages - 1;
  renderDetail();
}

function renderDetail() {
  const box = $("#project-detail");
  box.replaceChildren();
  const p = state.projects[state.selected];
  if (!p) { box.append(el("p", "project-note", t("noProjects"))); return; }
  const d = p.data;

  const top = el("div", "project-topline");
  top.append(el("span", "work-type", t("featuredLabel")), el("span", "work-type", d.type || "N/A"));
  box.append(top, el("h3", "", d.title || p.id), el("p", "project-description", d.description || "N/A"));
  if (p.lang !== state.lang) box.append(el("p", "project-note", t("fallbackNote").replace("{lang}", p.lang.toUpperCase())));

  const dl = el("dl", "project-details");
  const row = (label, value) => { const div = el("div"); div.append(el("dt", "", label), value); dl.append(div); };
  row(t("projectStatus"), el("dd", "", d.status || "N/A"));
  const detailsVal = d.details || "N/A";
  if (detailsVal.startsWith("http")) {
    const a = el("a", "", detailsVal);
    a.href = detailsVal;
    a.target = "_blank";
    a.rel = "noopener";
    row(t("projectDetails"), a);
  } else {
    row(t("projectDetails"), el("dd", "", detailsVal));
  }
  const repo = el("dd");
  if (d.repository) {
    const a = el("a", "", "GitHub ↗");
    a.href = d.repository; a.target = "_blank"; a.rel = "noopener";
    repo.append(a);
  } else repo.textContent = "N/A";
  row(t("projectRepository"), repo);
  box.append(dl);
}

/* ---------- Language & theme ---------- */
async function setLanguage(lang) {
  if (!LANGS.includes(lang)) lang = "en";
  state.lang = lang;
  localStorage.setItem("language", lang);
  try {
    if (!Object.keys(state.base).length) state.base = await loadJSON("lang/en.json");
    state.strings = lang === "en" ? state.base : await loadJSON(`lang/${lang}.json`);
  } catch {
    $("#project-detail").textContent = "Could not load language files. Serve the site over http:// (e.g. python -m http.server).";
    return;
  }
  applyStrings();
  await loadProjects();
  renderProjects();
}

function renderTheme() {
  const dark = state.theme === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const btn = $("#theme-toggle");
  btn.textContent = t(dark ? "themeLight" : "themeDark");
  btn.setAttribute("aria-pressed", String(dark));
}

$("#language-select").addEventListener("change", (e) => setLanguage(e.target.value));
$("#theme-toggle").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", state.theme);
  renderTheme();
});
$("#prev-page").addEventListener("click", () => { state.page--; renderProjects(); });
$("#next-page").addEventListener("click", () => { state.page++; renderProjects(); });

state.theme = localStorage.getItem("theme") || "light";
setLanguage(localStorage.getItem("language") || (navigator.language || "en").slice(0, 2));
