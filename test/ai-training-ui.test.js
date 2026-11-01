import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = name => fs.readFileSync(new URL("../src/"+name,import.meta.url),"utf8");

test("AI Training Centre is admin-only and linked from existing settings",()=>{
  const shell=read("app/AppShellFeatures.jsx");
  const app=read("App.jsx");
  assert.match(shell,/isAdmin && onOpenAiTraining/);
  assert.match(app,/session\?\.role === "admin" && showAiTraining/);
  assert.match(app,/lazyDefault\(\(\) => import\("\.\/AiTrainingCentre\.jsx"\)\)/);
});
test("AI Writer only submits an edited example on explicit click",()=>{
  const writer=read("lead/LeadAiWriter.jsx");
  assert.match(writer,/onClick=\{saveGoodExample\}/);
  assert.match(writer,/leadId:lead.id,message:draft,language/);
  assert.match(writer,/Submitted for admin approval/);
  assert.match(writer,/Known customer details are redacted/);
});
test("AI Training Centre includes knowledge, example review and isolated test flow",()=>{
  const screen=read("AiTrainingCentre.jsx"),api=read("api.js");
  assert.match(screen,/Company Knowledge/);
  assert.match(screen,/AI Writing Instructions/);
  assert.match(screen,/Approve/);
  assert.match(screen,/Generate test message/);
  assert.match(api,/aiTrainingSaveConfig:/);
  assert.match(api,/aiTrainingReviewExample:/);
  assert.match(api,/aiTrainingTest:/);
});


test("AI Writer defaults to English with Gemini-only generation", () => {
  const writer=read("lead/LeadAiWriter.jsx");
  const training=read("AiTrainingCentre.jsx");
  assert.match(writer,/const \[language,setLanguage\]=useState\("english"\)/);
  assert.doesNotMatch(writer,/useGemini,setUseGemini|type="checkbox"/);
  assert.match(writer,/useGemini:true/);
  assert.match(writer,/result.source!=="gemini"/);
  assert.match(writer,/language: \[\["english","English"\]/);
  assert.match(training,/const defaults = \{ type:"after", language:"english"/);
  assert.match(training,/language: \[\["english","English"\]/);
  assert.match(writer,/AI drafting processes your request and redacted notes with Google/);
  assert.match(writer,/setDraft\(nextDraft\)/);
});

test("conversational AI Writer offers one editable message and a Write My Own type",()=>{
  const writer=read("lead/LeadAiWriter.jsx");
  const api=read("api.js");
  assert.match(writer,/\["custom","Write My Own"\]/);
  assert.match(writer,/Describe what you want AI to write/);
  assert.match(writer,/api\.converseLeadAiMessage/);
  assert.match(api,/converseLeadAiMessage:/);
  assert.match(writer,/previousMessage:refining\?draft:""/);
  assert.match(writer,/role:"assistant"/);
  assert.match(writer,/value=\{draft\}/);
  assert.match(writer,/More natural/);
  assert.match(writer,/Less salesy/);
  assert.match(writer,/Write your own request/);
  assert.match(writer,/Ask AI to refine this message/);
  assert.doesNotMatch(writer,/Enable Gemini AI|Private template draft|api\.generateLeadAiMessage|labels\.variant/);
  assert.match(writer,/type!=="custom"&&<SelectField name="goal"/);
  assert.doesNotMatch(writer,/Message style|setVariant|labels\.variant/);
  assert.match(writer,/Open WhatsApp/);
  assert.match(writer,/Nothing is sent automatically/);
  assert.match(writer,/onClick=\{saveGoodExample\}/);
});

test("AI-only generation has no template branch and shows errors on failure",()=>{
  const writer=read("lead/LeadAiWriter.jsx");
  assert.match(writer,/const result=await api\.converseLeadAiMessage/);
  assert.match(writer,/type,goal,language,tone,notes,useGemini:true/);
  assert.match(writer,/if\(!result\?\.message\?\.trim\(\)\|\|result\.source!=="gemini"\)/);
  assert.match(writer,/setError\(e\?\.message\|\|/);
  assert.doesNotMatch(writer,/useGemini:false|generateLeadAiMessage|fallbackDrafts|setUseGemini/);
  assert.match(writer,/disabled=\{busy\}/);
  assert.match(writer,/More natural/);
  assert.match(writer,/Write My Own/);
  assert.match(writer,/Nothing is sent automatically/);
});

test("AI Training Centre Gemini test produces one message, with no legacy variants or fallback",()=>{
  const screen=read("AiTrainingCentre.jsx");
  assert.match(screen,/\["custom","Write My Own"\]/);
  assert.match(screen,/api\.aiTrainingTest/);
  assert.match(screen,/res\.source!=="gemini"/);
  assert.match(screen,/setPreview\(res\)/);
  assert.match(screen,/preview\.message/);
  assert.doesNotMatch(screen,/preview\.drafts|Private template fallback|Test returned private templates/);
  assert.match(screen,/test\.type==="custom"\?test\.message:""/);
  assert.match(screen,/type==="custom"\?"stay"/);
});
test("Write My Own examples are submitted with the distinct type",()=>{
  const screen=read("AiTrainingCentre.jsx");
  const writer=read("lead/LeadAiWriter.jsx");
  assert.match(writer,/type,goal:type==="custom"\?"stay":goal,tone/);
  assert.doesNotMatch(writer,/type:type==="custom"\?"after":type/);
  assert.match(writer,/Write My Own examples are reviewed in their own training category/);
  assert.match(screen,/row\.message_type==="custom"\?"Write My Own"/);
  assert.match(screen,/example\.type==="custom"/);
});
test("Phone layout swaps AI Writer and Location Verified without altering desktop",()=>{
  const panel=read("lead/LeadFeaturesCore.jsx");
  const css=fs.readFileSync(new URL("../src/lead/lead-detail-ai-mobile.css",import.meta.url),"utf8");
  assert.match(panel,/import "\.\/lead-detail-ai-mobile\.css"/);
  assert.match(panel,/ft-lead-detail-ai-mobile/);
  assert.match(panel,/ft-lead-detail-ai-desktop/);
  assert.match(panel,/ft-lead-detail-header-verification/);
  assert.match(panel,/ft-lead-detail-info-verification/);
  assert.match(panel,/Lead Information/);
  assert.match(css,/@media \(max-width: 640px\)/);
  assert.match(css,/\.ft-lead-detail-ai-mobile \{ display: none; \}/);
  assert.match(css,/\.ft-lead-detail-ai-desktop \{ display: inline-flex; \}/);
  assert.match(css,/\.ft-lead-detail-header-verification \{ display: none; \}/);
  assert.match(css,/\.ft-lead-detail-info-verification \{ display: inline-flex/);
});
