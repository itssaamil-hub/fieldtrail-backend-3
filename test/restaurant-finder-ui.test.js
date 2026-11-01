import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
const menu=read("Onboarding.jsx");
const shell=read("app/AppShellFeatures.jsx");
const app=read("App.jsx");
const api=read("api.js");
const finder=read("RestaurantLeadFinder.jsx");

test("Only admins see the new Menu item; employee and desktop navigation stay unchanged",()=>{
  assert.match(menu,/signedIn&&role==='admin'&&onRestaurantLeadFinder&&<button/);
  assert.match(menu,/Restaurant Lead Finder<\/button>/);
  assert.match(shell,/onRestaurantLeadFinder=\{session\?\.role === 'admin' \? onOpenRestaurantLeadFinder : undefined\}/);
  assert.match(app,/onOpenRestaurantLeadFinder=\{session\?\.role === "admin" \?/);
  assert.match(app,/session\?\.role === "admin" && showRestaurantFinder && <RestaurantLeadFinder/);
  assert.match(finder,/if\(getSession\(\)\?\.role!=="admin"\) return null/);
  assert.doesNotMatch(read("DesktopSidebar.jsx"),/Restaurant Lead Finder/);
  assert.doesNotMatch(read("AdminMobileNav.jsx"),/Restaurant Lead Finder/);
});

test("Finder connects to new admin API and does not write CRM records or persist Google content",()=>{
  assert.match(api,/restaurantFinderStatus: \(\) => request\('\/admin\/restaurant-finder\/status'\)/);
  assert.match(api,/restaurantFinderSearch: body => request\('\/admin\/restaurant-finder\/search'/);
  assert.match(api,/restaurantFinderContact: placeId => request\('\/admin\/restaurant-finder\/contact'/);
  assert.match(finder,/api\.restaurantFinderSearch\(/);
  assert.match(finder,/api\.restaurantFinderContact\(/);
  assert.match(finder,/setResults\(/);
  assert.match(finder,/Powered by Google/);
  assert.match(finder,/not added to CRM/);
  assert.doesNotMatch(finder,/localStorage|sessionStorage|indexedDB|api\.adminCreateLead|api\.addLead/);
  assert.doesNotMatch(finder,/AIza[0-9A-Za-z_-]{20,}/);
});
