// ---------- age check ----------
// A one-tap "are you 21?" screen on a device's first visit. The <head> script hides it straight away
// for anyone who already said yes, so returning visitors never see it flash.
(function () {
  const gate = $("age-gate");
  if (!gate) return;
  if (!document.documentElement.classList.contains("age-ok")) setTimeout(() => $("age-yes").focus(), 0);
  $("age-yes").onclick = () => {
    try { localStorage.setItem("mc-age", "21"); } catch (e) {}
    document.documentElement.classList.add("age-ok");
  };
  $("age-no").onclick = () => { $("age-ask").hidden = true; $("age-sorry").hidden = false; };
})();
