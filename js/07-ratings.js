// The Cocktail Locker: ratings. Scripts share one global scope and load in numbered order.
// ---------- ratings ----------
async function loadRatings() {
  if (!sb) return;
  let { data, error } = await sb.from("ratings").select("drink_id, user_id, stars, note, updated_at");
  S.notesOff = false;
  if (error) { S.notesOff = true; ({ data, error } = await sb.from("ratings").select("drink_id, user_id, stars")); }
  if (error) { S.ratingsOff = true; return; }
  S.ratingRows = {};
  (data || []).forEach(r => (S.ratingRows[r.drink_id] = S.ratingRows[r.drink_id] || []).push(r));
  S.ratingsOff = false;
  const m = {};
  (data || []).forEach(r => { const x = m[r.drink_id] || (m[r.drink_id] = { sum: 0, count: 0, mine: 0 }); x.sum += r.stars; x.count++; if (r.user_id === uid()) x.mine = r.stars; });
  S.ratings = m;
}
const ratingOf = d => S.ratings[d.id] || { sum: 0, count: 0, mine: 0 };
const avgOf = d => { const r = ratingOf(d); return r.count ? r.sum / r.count : 0; };
const starText = n => "★★★★★".slice(0, Math.round(n)) + "☆☆☆☆☆".slice(0, 5 - Math.round(n));
async function rateDrink(d, stars) {
  if (!uid()) { toast("Sign in to rate drinks."); return; }
  const prev = ratingOf(d).mine;
  const row = { drink_id: d.id, user_id: uid(), stars, updated_at: new Date().toISOString() };
  if (!S.notesOff) row.note = myNote(d) || null;
  const q = stars ? sb.from("ratings").upsert(row)
                  : sb.from("ratings").delete().eq("drink_id", d.id).eq("user_id", uid());
  const { error } = await q;
  if (error) { toast("Couldn't save your rating. Try again."); return; }
  const r = S.ratings[d.id] || (S.ratings[d.id] = { sum: 0, count: 0, mine: 0 });
  if (prev) { r.sum -= prev; r.count--; }
  if (stars) { r.sum += stars; r.count++; }
  r.mine = stars;
  const rows = S.ratingRows[d.id] || (S.ratingRows[d.id] = []);
  const mineRow = rows.find(x => x.user_id === uid());
  if (!stars) S.ratingRows[d.id] = rows.filter(x => x.user_id !== uid());
  else if (mineRow) mineRow.stars = stars; else rows.push({ user_id: uid(), stars, note: "", updated_at: row.updated_at });
  toast(stars ? `Rated ${d.name} ${stars} star${stars === 1 ? "" : "s"}` : "Rating removed");
  renderFilters(); renderList(); renderMain();
}
function ratingSummary(d) {
  const r = ratingOf(d);
  return r.count ? `<span class="avg" aria-label="Average ${(r.sum / r.count).toFixed(1)} out of 5"><span class="stars">${starText(r.sum / r.count)}</span> ${(r.sum / r.count).toFixed(1)} · ${r.count} rating${r.count === 1 ? "" : "s"}</span>` : "";
}
function rateBlock(d) {
  if (S.backend !== "supabase" || S.ratingsOff) return "";
  const mine = ratingOf(d).mine;
  if (!uid()) return `<div class="rate"><span class="label">Made it?</span><span class="hint">Sign in to rate this drink.</span></div>`;
  return `<div class="rate"><span class="label">${mine ? "Your rating" : "Made it? Rate it"}</span>
    <div class="rate-stars" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="star${n <= mine ? " on" : ""}" data-star="${n}" role="radio" aria-checked="${n === mine}" aria-label="${n} star${n === 1 ? "" : "s"}">★</button>`).join("")}</div>
    ${mine ? `<button type="button" class="linkish" id="rate-clear">Remove</button>` : ""}</div>${noteForm(d)}`;
}
