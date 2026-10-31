// Connects the site to your Supabase project.
// Find both values in Supabase under Project Settings > API Keys (and Data API for the URL).
// They are safe to publish: the rules in supabase/setup.sql decide who can change recipes.
// Leave them blank and the site still works, saving recipes in each browser only.
window.MC_CONFIG = {
  supabaseUrl: "https://ijvkfdglspzlpstwirvl.supabase.co",
  supabaseAnonKey: "sb_publishable_IFqfLPq81jywqgoVmBZN-Q_Y1GBYOon"
};
