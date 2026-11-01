// The Cocktail Locker: data. Scripts share one global scope and load in numbered order.
// ---------- storage ----------
const LOCAL_KEY = "mc-drinks-local";
const LOCAL_STARTERS = [
  { id: "negroni", name: "Negroni", glass: "Rocks", method: "Stirred", garnish: "Orange peel", starter: true,
    ingredients: [{amount:1,unit:"oz",name:"Gin"},{amount:1,unit:"oz",name:"Campari"},{amount:1,unit:"oz",name:"Sweet vermouth"}], notes: "" },
  { id: "daiquiri", name: "Daiquiri", glass: "Coupe", method: "Shaken", garnish: "Lime wheel", starter: true,
    ingredients: [{amount:2,unit:"oz",name:"White rum"},{amount:1,unit:"oz",name:"Fresh lime juice"},{amount:0.75,unit:"oz",name:"Simple syrup (1:1)"}], notes: "" }
];
function localLoad() {
  try { const raw = localStorage.getItem(LOCAL_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
  return LOCAL_STARTERS.slice();
}
function localSave() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(S.drinks)); } catch (e) {} }

const CFG = window.MC_CONFIG || {};
const sb = CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;
const BUCKET = "photos";
const photoUrl = p => sb && p ? sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl : "";

const uid = () => S.session && S.session.user ? S.session.user.id : null;
const isMine = d => S.backend === "local" || (!!uid() && d.owner === uid());
const lockerName = id => !id ? "Unclaimed" : (S.profiles[id] && S.profiles[id].display_name) || "Unnamed locker";
const myProfile = () => uid() ? S.profiles[uid()] : null;

function refreshAuthUI() {
  if (S.backend !== "supabase") { $("auth-btn").hidden = true; $("locker-btn").hidden = true; $("new-btn").hidden = false; $("scan-btn").hidden = true; $("make-btn").hidden = true; S.canWrite = true; return; }
  S.canWrite = !!S.session;
  $("auth-btn").hidden = false;
  $("auth-btn").textContent = S.session ? "Sign out" : "Sign in or join";
  $("new-btn").hidden = !S.canWrite;
  $("scan-btn").hidden = !S.canWrite;
  $("make-btn").hidden = !S.canWrite;
  const me = myProfile();
  $("locker-btn").hidden = !S.session;
  $("locker-btn").textContent = me && me.display_name ? "My locker" : "Name your locker";
  $("locker-btn").title = "Open my locker";
  $("locker-btn").setAttribute("aria-label", "My locker: " + $("locker-btn").textContent);
  if (S.session) $("signin").hidden = true;
  setStatus(S.session ? "ok" : "", S.session ? "Signed in" : "Browsing");
}

async function loadProfiles() {
  const { data, error } = await sb.from("profiles").select("id, display_name");
  if (!error) { S.profiles = {}; (data || []).forEach(p => S.profiles[p.id] = p); }
  refreshAuthUI();
  if (S.session && S.loaded && !(myProfile() && myProfile().display_name)) openNameForm(true);
}

async function loadDrinks() {
  const { data, error } = await sb.from("drinks").select("id, owner, data");
  if (error) { setStatus("warn", "Couldn't load drinks. Refresh to try again."); S.loaded = true; afterData(); return; }
  S.drinks = (data || []).map(r => Object.assign({}, r.data, { id: r.id, owner: r.owner }));
  S.loaded = true; afterData();
}

async function startStorage() {
  if (!sb) {
    S.backend = "local"; S.drinks = localLoad(); S.loaded = true;
    refreshAuthUI();
    setStatus("warn", "No database connected. Saving in this browser only.");
    afterData(); return;
  }
  S.backend = "supabase";
  try { const { data } = await sb.auth.getSession(); S.session = data.session; } catch (e) {}
  refreshAuthUI();
  sb.auth.onAuthStateChange((_ev, session) => {
    const changed = uid() !== (session && session.user ? session.user.id : null);
    S.session = session; refreshAuthUI();
    if (changed) {
      if (S.view !== "detail") { S.view = "detail"; S.editing = null; S.ideasState = null; }
      S.bar = { liquors: [], syrups: [], bitters: [] }; loadBar();
      loadRatings().then(() => { renderFilters(); renderList(); renderMain(); });
      if (!session) { $("name-form").hidden = true; if (S.f.owner === "mine" || S.f.owner === "fav") S.f.owner = ""; }
      loadFavorites().then(() => { renderFilters(); renderList(); if (S.view === "detail") renderMain(); });
      loadProfiles(); renderFilters(); renderList(); renderMain();
    }
  });
  await Promise.all([loadProfiles(), loadDrinks(), loadRatings(), loadFavorites(), loadStd()]);
  loadBar();
  renderFilters(); renderList(); if (S.view === "detail") renderMain();
  if (S.session && !(myProfile() && myProfile().display_name)) openNameForm(true);
  try {
    sb.channel("drinks-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "drinks" }, () => loadDrinks())
      .on("postgres_changes", { event: "*", schema: "public", table: "standard_recipes" }, () => loadStd().then(() => renderList()))
      .on("postgres_changes", { event: "*", schema: "public", table: "ratings" }, () => loadRatings().then(() => { renderFilters(); renderList(); if (S.view === "detail") renderMain(); }))
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadProfiles().then(() => { renderFilters(); renderList(); renderMain(); }))
      .subscribe();
  } catch (e) {}
}

function upsertMem(d) { const i = S.drinks.findIndex(x => x.id === d.id); if (i >= 0) S.drinks[i] = d; else S.drinks.push(d); }
async function saveDrink(d) {
  if (S.backend === "supabase") {
    if (!uid()) { toast("Sign in to save changes."); return false; }
    const body = JSON.parse(JSON.stringify(d)); delete body.id; delete body.owner;
    const owner = d.owner || uid();
    const { error } = await sb.from("drinks").upsert({ id: d.id, owner, name: d.name, data: body, updated_at: new Date().toISOString() });
    if (error) { toast(owner !== uid() ? "You can only change drinks in your own locker." : "Couldn't save. Try again."); return false; }
    upsertMem(Object.assign({}, d, { owner })); return true;
  }
  upsertMem(d); localSave(); return true;
}
async function removeDrink(id) {
  if (S.backend === "supabase") {
    const { error } = await sb.from("drinks").delete().eq("id", id);
    if (error) { toast("Couldn't delete. Try again."); return false; }
  }
  S.drinks = S.drinks.filter(x => x.id !== id);
  if (S.backend === "local") localSave();
  return true;
}

$("auth-btn").onclick = async () => {
  if (S.session) { await sb.auth.signOut(); toast("Signed out"); return; }
  $("signin").hidden = false; $("signin-msg").textContent = "New here? The link creates your locker."; $("signin-email").focus();
};
$("signin-cancel").onclick = () => { $("signin").hidden = true; };
$("signin").onsubmit = async ev => {
  ev.preventDefault();
  const email = $("signin-email").value.trim(); if (!email) return;
  $("signin-msg").textContent = "Sending…";
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname } });
  $("signin-msg").textContent = !error ? "Check your email and tap the link to sign in."
    : /rate|seconds|too many/i.test(error.message || "") ? "Too many sign-in emails just now. Wait a few minutes and try again."
    : /signup|not allowed/i.test(error.message || "") ? "New sign-ups are turned off for this site."
    : "Couldn't send the link. Check the address and try again.";
};

function openNameForm(first) {
  const me = myProfile();
  $("name-form").hidden = false;
  $("locker-name").value = me && me.display_name ? me.display_name : "";
  $("name-msg").textContent = first ? "Welcome. Pick a name for your locker; everyone sees it on your drinks." : "Everyone sees this name on your drinks.";
  $("name-cancel").hidden = !!first && !(me && me.display_name);
  $("locker-name").focus();
}
$("locker-btn").onclick = () => { const me = myProfile(); if (me && me.display_name) openProfile(); else openNameForm(true); };
$("name-cancel").onclick = () => { $("name-form").hidden = true; };
$("name-form").onsubmit = async ev => {
  ev.preventDefault();
  const name = $("locker-name").value.trim().slice(0, 40);
  if (!name) { $("name-msg").textContent = "Enter a name, like Mitch's Bar."; return; }
  $("name-msg").textContent = "Saving…";
  const { error } = await sb.from("profiles").upsert({ id: uid(), display_name: name });
  if (error) { $("name-msg").textContent = "Couldn't save the name. Try again."; return; }
  S.profiles[uid()] = { id: uid(), display_name: name };
  $("name-form").hidden = true; refreshAuthUI(); renderFilters(); renderList(); if (S.view === "profile") renderProfile(); else renderMain();
  toast("Locker named " + name);
};

const byName = (a, b) => (a.name || "").localeCompare(b.name || "");
function sorted() { return S.drinks.slice().sort(byName); }
const allDrinks = () => S.drinks.concat(S.std || []);
function allSorted() { return allDrinks().sort(byName); }
function current() { return allDrinks().find(d => d.id === S.selected) || null; }
// Weighted rating: a drink needs a few ratings before it can outrank well-rated ones.
const score = d => { const r = ratingOf(d); return (2 * 3.5 + r.sum) / (2 + r.count); };
function sortItems(list) {
  const k = S.sort;
  return list.sort((a, b) => k === "az" ? byName(a, b)
    : k === "new" ? (String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")) || byName(a, b))
    : (score(b) - score(a)) || (ratingOf(b).count - ratingOf(a).count) || byName(a, b));
}
function afterData() {
  const want = hashId();
  if (want === "my-locker" && !S._hashDone && uid() && S.loaded) { S._hashDone = true; S.view = "profile"; }
  if (want && !S._hashDone && allDrinks().some(d => d.id === want)) { S.selected = want; S._hashDone = true; S.f = { owner: "", type: "", base: "", method: "", kind: "", rating: "" }; }
  if (!current() && S.view === "detail") { const s = filtered(); S.selected = s[0] ? s[0].id : (sorted()[0] || {}).id || null; }
  renderFilters(); renderList(); if (S.view === "detail") renderMain();
}
