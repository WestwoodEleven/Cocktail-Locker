// A small in-memory stand-in for the Supabase client, used by the browser tests.
// Set window.__MOCK = { user: "u1" | null, tables: {...}, invoke: async (name, body) => ({ data, error }) } before the page loads.
(() => {
  const M = window.__MOCK || (window.__MOCK = {});
  M.tables = M.tables || {};
  M.writes = [];
  const keyOf = { drinks: ["id"], profiles: ["id"], ratings: ["drink_id", "user_id"], favorites: ["user_id", "drink_id"], bars: ["user_id"],
    standard_recipes: ["slug"], collections: ["id"], collection_items: ["collection_id", "drink_id"], follows: ["follower", "followee"],
    bottles: ["slug"], bottle_reviews: ["slug", "user_id"], bottle_photos: ["id"], bottle_reports: ["id"], site_admins: ["user_id"] };
  function builder(t) {
    const rows = () => (M.tables[t] = M.tables[t] || []);
    let filters = [], op = "select", payload = null, single = false, lim = null;
    const match = r => filters.every(f => f(r));
    const run = () => {
      let out = null;
      if (op === "select") { out = rows().filter(match); if (lim) out = out.slice(0, lim); if (single) out = out[0] || null; }
      else if (op === "insert" || op === "upsert") {
        const list = [].concat(payload);
        if (t === "reports" && list.some(p => rows().some(r => r.reporter === p.reporter && r.kind === p.kind && r.target === p.target)))
          return Promise.resolve({ data: null, error: { code: "23505", message: "duplicate key" } });
        list.forEach(p => {
          const row = Object.assign({}, p);
          if (t === "collections" && !row.id) row.id = "c" + Math.random().toString(36).slice(2, 8);
          if (["bottle_photos", "bottle_reports", "reports", "photo_reviews"].includes(t) && !row.id) row.id = Math.floor(Math.random() * 1e9);
          if (["bars", "ratings", "favorites", "collections", "follows", "photo_reviews"].includes(t)) {
            const who = M.user; const col = { bars: "user_id", ratings: "user_id", favorites: "user_id", collections: "owner", follows: "follower", photo_reviews: "user_id" }[t];
            if (!row[col]) row[col] = who;
          }
          const k = keyOf[t] || ["id"];
          const i = rows().findIndex(r => k.every(c => r[c] === row[c]));
          if (i >= 0 && op === "upsert") rows()[i] = Object.assign(rows()[i], row); else rows().push(row);
          out = row;
        });
        if (single === false && Array.isArray(payload)) out = list;
      } else if (op === "update") { rows().filter(match).forEach(r => Object.assign(r, payload)); out = rows().filter(match); }
      else if (op === "delete") { const keep = rows().filter(r => !match(r)); M.tables[t] = keep; }
      out = out == null ? out : JSON.parse(JSON.stringify(out)); // real responses are copies, not live rows
      M.writes.push(op === "select" ? null : [t, op, payload]);
      M.writes = M.writes.filter(Boolean);
      return Promise.resolve({ data: out, error: null });
    };
    const b = {
      select() { return b; }, insert(p) { op = "insert"; payload = p; return b; }, upsert(p) { op = "upsert"; payload = p; return b; },
      update(p) { op = "update"; payload = p; return b; }, delete() { op = "delete"; return b; },
      eq(c, v) { filters.push(r => r[c] === v); return b; }, neq(c, v) { filters.push(r => r[c] !== v); return b; },
      in(c, v) { filters.push(r => v.includes(r[c])); return b; }, gte() { return b; }, order() { return b; },
      or() { return b; }, limit(n) { lim = n; return b; },
      maybeSingle() { single = true; return run(); }, single() { single = true; return run(); },
      then(a, c) { return run().then(a, c); }
    };
    return b;
  }
  window.supabase = { createClient: () => ({
    from: builder,
    auth: {
      getSession: () => Promise.resolve({ data: { session: M.user ? { user: { id: M.user, email: M.user + "@example.com" } } : null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: () => Promise.resolve({}), signInWithOtp: () => Promise.resolve({ error: null }),
      verifyOtp: async o => { M.lastVerify = o; return o.token === "123456" ? { data: {}, error: null } : { data: null, error: { message: "Token has expired or is invalid" } }; }
    },
    channel: () => { const c = { on: () => c, subscribe: () => c }; return c; },
    storage: { from: () => ({ getPublicUrl: p => ({ data: { publicUrl: "photo/" + p } }), upload: async () => ({ error: null }), remove: async () => ({}) }) },
    rpc: async (name, args) => { M.lastRpc = name;
      if (name === "record_view") { M.viewCalls = (M.viewCalls || []).concat(args.p_drink); return { data: null, error: null }; } return M.rpc && M.rpc[name] !== undefined ? { data: M.rpc[name], error: null } : { data: null, error: { message: "function not found", code: "PGRST202" } }; },
    functions: { invoke: async (name, opts) => { M.lastInvoke = opts.body; return M.invoke ? M.invoke(name, opts.body) : { data: null, error: { name: "FunctionsFetchError" } }; } }
  }) };
})();
