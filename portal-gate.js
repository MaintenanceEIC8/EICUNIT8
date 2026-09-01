// Client-side portal gate — shared guard for the pages that sit behind the
// home hub. index.html owns the actual password prompt; every other page that
// includes this script just bounces the visitor back to the hub if they never
// unlocked the portal on this device.
//
// This is a light convenience gate, not real security (the password lives in
// the page source). It only needs to be included by root-level pages; a page
// in a subfolder would have to point the redirect at "../index.html".
(function () {
  var KEY = 'eic8_portal_unlock';
  try {
    if (localStorage.getItem(KEY) === '1') return;
  } catch (e) {
    return; // storage blocked/unavailable — fail open rather than trap the user
  }
  location.replace('index.html');
})();
