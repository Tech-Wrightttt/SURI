// Run with: node scripts/test-tutorials.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Match the existing dependency-free TypeScript test scripts. */
const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { TUTORIALS, parseTutorialPreferences, tutorialStorageKey, tutorialForPage, tutorialIsPending } = require("../lib/tutorials.ts");
const { positionTutorialCard } = require("../lib/tutorialLayout.ts");

// Stored preferences are untrusted and can be left by earlier versions or browser extensions.
for (const value of [null, "bad json", "null", "[]", "17", '{"seen":null}', '{"disabled":"true","seen":{"calculator":"wrong"}}']) {
  assert.deepEqual(parseTutorialPreferences(value), { disabled: false, seen: {} });
}
assert.deepEqual(parseTutorialPreferences('{"disabled":true,"seen":{"dashboard":"completed","calculator":"skipped","quiz-step":"unknown"}}'), {
  disabled: true, seen: { dashboard: "completed", calculator: "skipped" },
});
assert.notEqual(tutorialStorageKey("student-a"), tutorialStorageKey("student-b"));
assert.notEqual(tutorialStorageKey(), tutorialStorageKey("student-a"));

const timerState = { identityReady: true, hasUser: true, loaded: true, preferences: { disabled: false, seen: {} } };
assert.equal(tutorialIsPending("quiz-step", timerState), true, "New learners keep the timer paused before the guide appears");
assert.equal(tutorialIsPending("quiz-step", { ...timerState, identityReady: false, hasUser: false }), true, "Wait for account lookup before starting the timer");
assert.equal(tutorialIsPending("quiz-step", { ...timerState, hasUser: false }), false, "Failed identity/progress lookup must not pause the quiz forever");
for (const status of ["completed", "skipped"]) {
  const preferences = { disabled: false, seen: { "quiz-step": status } };
  assert.equal(tutorialIsPending("quiz-step", { ...timerState, preferences }), false);
  assert.equal(tutorialIsPending("quiz-step", { ...timerState, preferences, activeId: "quiz-step" }), true, "Replays also pause the timer");
}
assert.equal(tutorialIsPending("quiz-step", { ...timerState, preferences: { disabled: true, seen: {} } }), false);

// A tour is shared across topic/session IDs, but each learning phase receives its own guide.
for (const route of ["dashboard", "topics", "calculator", "progress"]) assert.equal(tutorialForPage(`/${route}`).id, route);
for (const route of ["/login", "/register"]) {
  assert.equal(tutorialForPage(route), null, "Authentication pages must not show any tutorial");
  assert.equal(tutorialForPage(route, "dashboard"), null);
}
assert.equal(TUTORIALS.login, undefined);
assert.equal(TUTORIALS.register, undefined);
assert.equal(tutorialForPage("/topics/QE").id, "topic");
assert.equal(tutorialForPage("/topics/SLE").id, "topic");
for (const scope of ["diagnostic-intro", "practice-intro", "quiz-intro"]) {
  assert.equal(TUTORIALS[scope], undefined, "Battle introductions must not have a tutorial or replay guide");
  assert.equal(tutorialForPage("/session/first/diagnostic", scope), null);
  assert.equal(tutorialForPage("/session/second/practice", scope), null);
  assert.equal(tutorialForPage("/session/third/quiz", scope), null);
}
for (const scope of ["lesson", "diagnostic-battle", "practice-battle", "quiz-step", "quiz-summary", "results"]) {
  assert.equal(tutorialForPage("/session/first/lesson", scope).id, scope);
  assert.equal(tutorialForPage("/session/second/lesson", scope).id, scope);
}
for (const scope of ["playground-topics", "playground-difficulty", "playground-problem"]) assert.equal(tutorialForPage("/playground", scope).id, scope);
assert.equal(tutorialForPage("/session/id/lesson"), null, "Loading sessions must not select a tutorial before their view is ready");
assert.equal(tutorialForPage("/playground", "unknown"), null);
assert.equal(tutorialForPage("/"), null);

for (const [id, tour] of Object.entries(TUTORIALS)) {
  assert.equal(tour.id, id);
  assert.ok(tour.ready && tour.steps.length >= 2);
  for (const step of tour.steps) {
    assert.ok(step.title && step.description);
    assert.equal(step.action, undefined, `${id}: guide steps must not require a click or input`);
    assert.equal(step.instruction, undefined, `${id}: remove instructions that gate progression`);
  }
}

// Phones, tablets, landscape, browser zoom/panning, and a visible software keyboard.
for (const [width, height, left, top, landscape] of [[320,568,0,0,false], [390,844,0,0,false], [844,390,0,0,true], [768,1024,0,0,false], [1024,768,0,0,true], [390,270,0,0,false], [320,250,20,70,false]]) {
  for (const target of [undefined, { left: -400, top: -300, right: 1500, bottom: 2000, width: 1900, height: 2300 }]) {
    const layout = positionTutorialCard({ width, height, left, top, compact: true, landscape }, 900, target);
    assert.ok(layout.cardX >= left + 12 && layout.cardX + layout.cardWidth <= left + width - 12);
    assert.ok(layout.cardY >= top + 12 && layout.cardY + layout.maxHeight <= top + height - 12);
    assert.ok(layout.cardWidth > 0 && layout.maxHeight > 0);
  }
}
for (const target of [undefined, { left: 400, top: 200, right: 500, bottom: 250, width: 100, height: 50 }]) {
  const layout = positionTutorialCard({ width: 1440, height: 900, left: 0, top: 0, compact: false, landscape: true }, 340, target);
  assert.ok(layout.cardX >= 12 && layout.cardX + layout.cardWidth <= 1428);
  assert.ok(layout.cardY >= 12 && layout.cardY + 340 <= 888);
}
console.log("Tutorial checks passed: preferences, timers, route coverage, optional steps, and phone/tablet/keyboard layouts.");
