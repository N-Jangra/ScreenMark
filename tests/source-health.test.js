"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "frontend/backend/features/discover.js"), "utf8");
const block = source.slice(source.indexOf("  const sourceHealth = new Map();"), source.indexOf("  const sourceHealthOf"));
const health = source.slice(source.indexOf("  const sourceHealthOf"), source.indexOf("\n", source.indexOf("  const sourceHealthOf")));

function make(raw) {
  return new Function("runSourceSearchRaw", `${block}\n${health}\nreturn { runSourceSearch, sourceHealthOf };`)(raw);
}

test("a source that fails three times in a row is paused, other sources keep working, and success resets it", async () => {
  let calls = 0, fail = true;
  const { runSourceSearch, sourceHealthOf } = make(async () => { calls++; if (fail) throw new Error("boom"); return [{ title: "x" }]; });
  const dead = { key: "dead", name: "Dead" };
  for (let i = 0; i < 3; i++) await assert.rejects(() => runSourceSearch(dead, "q", "series", {}), /boom/);
  assert.equal(calls, 3);
  assert.equal(sourceHealthOf("dead").paused, true);
  // paused: rejected immediately without calling the network
  await assert.rejects(() => runSourceSearch(dead, "q", "series", {}), /paused after repeated failures/);
  assert.equal(calls, 3);
  // another source is unaffected
  fail = false;
  assert.equal((await runSourceSearch({ key: "ok", name: "Ok" }, "q", "series", {})).length, 1);
  // the Test button bypasses the pause, and a success clears it
  assert.equal((await runSourceSearch(dead, "q", "series", { bypassSourceHealth: true })).length, 1);
  assert.equal(sourceHealthOf("dead").paused, false);
  assert.equal(sourceHealthOf("dead").fails, 0);
});

test("an empty result is not a failure", async () => {
  const { runSourceSearch, sourceHealthOf } = make(async () => []);
  for (let i = 0; i < 5; i++) await runSourceSearch({ key: "quiet" }, "q", "series", {});
  assert.equal(sourceHealthOf("quiet").paused, false);
});
