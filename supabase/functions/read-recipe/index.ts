// read-recipe: turns a photo of a cocktail recipe into a Cocktail Locker drink.
// Deploy in Supabase: Edge Functions > Deploy a new function > Via Editor, name it "read-recipe",
// paste this file, and add the secret ANTHROPIC_API_KEY under Edge Functions > Secrets.
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = Deno.env.get("RECIPE_MODEL") || "claude-sonnet-5-5";
const DAILY_LIMIT = Number(Deno.env.get("RECIPE_DAILY_LIMIT") || 25);

const UNITS = ["oz", "ml", "cl", "barspoon", "tsp", "tbsp", "dash", "each"];
const METHODS = ["Stirred", "Shaken", "Built", "Blended", "Thrown"];
const TYPES = ["Sour", "Spirit-forward", "Highball", "Tiki", "Fizz & Collins", "Spritz & bubbly", "Flip & creamy", "Punch", "Hot", "Shot", "Other"];
const BASES = ["Gin", "Vodka", "Rum", "Tequila", "Mezcal", "Whiskey", "Brandy", "Liqueur", "Wine & fortified", "No alcohol", "Other"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const TOOL = {
  name: "save_recipe",
  description: "Save the cocktail recipe read from the photo.",
  input_schema: {
    type: "object",
    properties: {
      found: { type: "boolean", description: "False if the photo has no readable cocktail recipe." },
      name: { type: "string" },
      method: { type: "string", enum: METHODS },
      glass: { type: "string", description: "Glass type, e.g. Rocks, Coupe, Collins. Empty if not given." },
      garnish: { type: "string", description: "Garnish, empty if none." },
      type: { type: "string", enum: [...TYPES, ""], description: "Cocktail family; empty if unsure." },
      base: { type: "string", enum: [...BASES, ""], description: "Main spirit; empty if unsure." },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            amount: { type: "number", description: "Amount for ONE drink, as a decimal." },
            unit: { type: "string", enum: UNITS },
            name: { type: "string", description: "Generic ingredient, e.g. 'London dry gin', 'Fresh lime juice'." },
            brand: { type: "string", description: "Named product if the recipe names one, else empty." },
            float: { type: "boolean", description: "True if floated or layered on top of the finished drink." },
          },
          required: ["amount", "unit", "name"],
        },
      },
      notes: { type: "string", description: "Short method steps or tips from the recipe, empty if none." },
      warning: { type: "string", description: "Anything the person should double-check: guesses, unreadable parts, conversions, other recipes in the photo. Empty if none." },
    },
    required: ["found", "name", "method", "ingredients"],
  },
};

const PROMPT = `This photo should show a cocktail recipe: printed, handwritten, a menu, a book page or a screenshot.
Read it and call save_recipe with ONE drink.
- Amounts are for a single drink. Convert fractions to decimals (3/4 = 0.75, 1 1/2 = 1.5).
- Use the unit written when it is allowed. "Bar spoon" = barspoon, "dashes" = dash, "teaspoon" = tsp.
- "Parts": treat 1 part as 1 oz and say so in warning. A batch recipe: divide down to one drink and say so.
- Whole items (egg white, mint leaves, cherry, sugar cube) use unit "each".
- "Top with soda" or similar with no amount: estimate a typical amount and say so in warning.
- Name generic ingredients; put a named product (Campari, Cointreau and Angostura count as ingredients themselves) in brand only when the recipe names a specific bottle for a generic ingredient.
- float = true only for something floated or layered on top of the finished drink.
- The garnish goes in garnish, not ingredients.
- Pick the method from the instructions (shake = Shaken, stir = Stirred, build in glass = Built, blend = Blended).
- If several recipes are shown, use the most prominent one and list the others' names in warning.
- If nothing readable is a cocktail recipe, set found to false.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    // Allow whatever headers the browser asks for, so newer Supabase client versions aren't blocked.
    const asked = req.headers.get("Access-Control-Request-Headers");
    return new Response("ok", { headers: { ...CORS, ...(asked ? { "Access-Control-Allow-Headers": asked } : {}), "Access-Control-Max-Age": "86400" } });
  }
  if (req.method !== "POST") return reply(405, { error: "method" });

  const apiKey = (Deno.env.get("ANTHROPIC_API_KEY") || "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey) return reply(500, { error: "not_configured" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: who, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !who?.user) return reply(401, { error: "signed_out" });
  const userId = who.user.id;

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("recipe_scans").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) return reply(429, { error: "daily_limit", limit: DAILY_LIMIT });

  let body: { image?: string; mediaType?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "bad_request" }); }
  const image = String(body.image || "").replace(/^data:[^,]+,/, "");
  const mediaType = String(body.mediaType || "image/jpeg");
  if (!image || !/^image\/(jpeg|png|webp|gif)$/.test(mediaType)) return reply(400, { error: "bad_image" });
  if (image.length > 6_500_000) return reply(413, { error: "too_large" });

  await admin.from("recipe_scans").insert({ user_id: userId });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "save_recipe" },
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
        { type: "text", text: PROMPT },
      ] }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Anthropic error", res.status, text);
    const code = res.status === 401 ? "bad_key"
      : res.status === 403 ? "key_not_allowed"
      : /credit balance/i.test(text) ? "no_credit"
      : res.status === 404 && /model/i.test(text) ? "bad_model"
      : res.status === 429 || res.status === 529 ? "busy"
      : "reader_failed";
    return reply(502, { error: code, detail: text.slice(0, 300) });
  }
  const out = await res.json();
  const call = (out.content || []).find((c: { type: string }) => c.type === "tool_use");
  if (!call?.input) return reply(502, { error: "reader_failed" });
  if (!call.input.found || !(call.input.ingredients || []).length) return reply(422, { error: "no_recipe" });
  return reply(200, { recipe: call.input });
});
