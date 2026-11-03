import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
const app=read("App.jsx");
const topBar=read("app/AppShellFeatures.jsx");
const chatbot=read("AskEngage.jsx");
const menu=read("Onboarding.jsx");
const mobileNav=read("AdminMobileNav.jsx");
const api=read("api.js");

test("Desktop shows a small floating Ask Engage bot on every page, not sidebar",()=>{
  assert.match(app,/adminDesktop && <button type="button" aria-label="Ask Engage"/);
  assert.match(app,/position:"fixed",right:24,bottom:24,width:49,height:49/);
  assert.match(app,/<BotMessageSquare size={24}/);
  assert.match(app,/showAskEngage && <AskEngage key={session\.id}/);
  assert.doesNotMatch(read("DesktopSidebar.jsx"),/Ask Engage/);
});

test("On phone Ask Engage is beside notifications, not in More or bottom tabs",()=>{
  assert.match(topBar,/session\?\.role === "admin" && !hidePageNavigation && onOpenAskEngage/);
  assert.match(topBar,/title="Ask Engage" aria-label="Ask Engage"/);
  const botIndex=topBar.indexOf('title="Ask Engage"');
  const bellIndex=topBar.indexOf('title="Notifications"');
  assert.ok(botIndex > 0 && bellIndex > botIndex && bellIndex - botIndex < 1000);
  assert.match(app,/onOpenAskEngage={session\?\.role === "admin" && !adminDesktop/);
  assert.doesNotMatch(menu,/Ask Engage/);
  assert.doesNotMatch(mobileNav,/Ask Engage/);
});

test("Chatbot asks authenticated read-only backend with no local persistence or invented CRM figures",()=>{
  assert.match(api,/askEngage: body => request\('\/admin\/ask-engage\/ask', \{method:'POST',body\}\)/);
  assert.match(chatbot,/api\.askEngage\(\{question,previousQuestion\}\)/);
  assert.match(chatbot,/getSession\(\)\?\.role!=="admin"/);
  assert.match(chatbot,/data\.answer/);
  assert.match(chatbot,/m\.data\?\.totals/);
  assert.match(chatbot,/m\.data\?\.items/);
  assert.match(chatbot,/Gemini receives your question, not payment or deal rows/);
  assert.doesNotMatch(chatbot,/localStorage|indexedDB|sessionStorage|adminUpdateLead|adminRecordPayment|fakeResults/);
  assert.doesNotMatch(chatbot,/GEMINI_API_KEY/);
});

test("Panel is accessible on small screens and keeps desktop compact",()=>{
  const css=read("ask-engage.css");
  assert.match(css,/\.ae-panel\{position:fixed;right:24px;bottom:83px/);
  assert.match(css,/@media\(max-width:1023px\)/);
  assert.match(css,/height:100dvh/);
  assert.match(chatbot,/role="dialog" aria-modal="true" aria-label="Ask Engage chatbot"/);
  assert.match(chatbot,/aria-label="Close Ask Engage"/);
  assert.match(chatbot,/aria-label="Send question"/);
});
