// ---------- delete my account ----------
// Asks for "DELETE" to be typed, then has the read-recipe function remove the account, its photos
// and everything that belongs to it, then signs out on this device.
function accountHtml() {
  return `<section class="make-sec" id="prof-account">
    <div class="sec-head"><h3>Account</h3></div>
    <p class="hint" style="margin:0">Deleting your account removes your cart and everything in it for good. See the <a href="privacy.html">privacy policy</a> for what we keep.</p>
    <div class="panel-actions" style="justify-content:flex-start"><button class="btn small danger ghost" type="button" id="prof-delete">Delete my account</button></div>
  </section>`;
}
function wireAccount() { const b = $("prof-delete"); if (b) b.onclick = openDeleteAccount; }

const DELETE_ERR = {
  not_deployed: "Account deletion isn't switched on yet. The site owner needs to redeploy the read-recipe function.",
  signed_out: "You've been signed out. Sign in again, then try once more.",
  unreachable: "Couldn't reach the server. Check your connection and try again."
};

function openDeleteAccount() {
  const me = myProfile();
  const name = me && me.display_name ? me.display_name : "your cart";
  const drinks = S.drinks.filter(d => isMine(d)).length;
  const body = sheet("Delete your account?", `
    <p style="margin:0">This permanently deletes <b>${esc(name)}</b> and everything in it: ${drinks === 1 ? "your 1 drink" : `your ${drinks} drinks`} and their photos, your ratings, notes and bottle comments, bottle photos, lists, favorites, bar, and who you follow.</p>
    <p class="hint" style="margin:0">It can't be undone. Copies other people made of your drinks stay in their carts. Shared standard recipes and bottle guide entries stay, without your name.</p>
    <div class="field"><label for="del-confirm">Type DELETE to confirm</label>
      <input id="del-confirm" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false"></div>
    <div class="share-actions"><button class="btn danger danger-solid" type="button" id="del-go" disabled>Delete account</button><button class="btn" type="button" id="del-keep">Keep it</button></div>
    <p class="hint" id="del-msg" role="status" style="margin:0"></p>`);
  const input = $("del-confirm"), go = $("del-go");
  input.oninput = () => { go.disabled = input.value.trim().toUpperCase() !== "DELETE"; };
  $("del-keep").onclick = closeSheet;
  go.onclick = async () => {
    go.disabled = true; input.disabled = true; $("del-keep").disabled = true;
    go.textContent = "Deleting…"; $("del-msg").textContent = "";
    const { data, code } = await invokeHelper({ mode: "delete_account", confirm: "DELETE" });
    if (!data || !data.deleted) {
      $("del-msg").textContent = DELETE_ERR[code] || "Couldn't delete your account. Nothing was changed if this keeps happening; email privacy@mycocktailcart.com and we'll do it for you.";
      go.textContent = "Delete account"; go.disabled = false; input.disabled = false; $("del-keep").disabled = false;
      return;
    }
    closeSheet();
    try { await sb.auth.signOut({ scope: "local" }); } catch (e) {}
    S.view = "detail"; S.selected = null; setHash("");
    await loadDrinks(); renderFilters(); renderList(); renderMain();
    toast("Your account has been deleted.");
  };
  input.focus();
  return body;
}
