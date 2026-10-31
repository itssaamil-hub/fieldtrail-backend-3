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


test("AI Writer V2 defaults to English without opting users into Google", () => {
  const writer=read("lead/LeadAiWriter.jsx");
  const training=read("AiTrainingCentre.jsx");
  assert.match(writer,/const \[language,setLanguage\]=useState\("english"\)/);
  assert.match(writer,/const \[useGemini,setUseGemini\]=useState\(false\)/);
  assert.match(writer,/language: \[\["english","English"\]/);
  assert.match(training,/const defaults = \{ type:"after", language:"english"/);
  assert.match(training,/language: \[\["english","English"\]/);
  assert.match(writer,/previous draft plus limited lead context are shared with Google/);
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
  assert.match(writer,/Enable Gemini AI to refine/);
  assert.match(writer,/type!=="custom"&&<SelectField name="goal"/);
  assert.doesNotMatch(writer,/Message style|setVariant|labels\.variant/);
  assert.match(writer,/Open WhatsApp/);
  assert.match(writer,/Nothing is sent automatically/);
  assert.match(writer,/onClick=\{saveGoodExample\}/);
});
