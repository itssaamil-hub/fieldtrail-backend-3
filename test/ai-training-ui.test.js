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
  assert.match(writer,/leadId:lead.id,message:current,language,type,goal,tone/);
  assert.match(writer,/Submitted for admin approval/);
  assert.match(writer,/Known customer names and contact details are removed/);
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
