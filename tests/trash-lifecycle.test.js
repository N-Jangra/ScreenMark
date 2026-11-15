"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "../frontend/app.js"), "utf8");
const settings = fs.readFileSync(path.join(__dirname, "../frontend/pages/settings.js"), "utf8");

test("all title deletion entry points move the full item into Recently deleted before removing it", () => {
  const mainDelete = app.slice(app.indexOf("async function deleteItem("), app.indexOf("// ⋮ → Edit entry", app.indexOf("async function deleteItem(")));
  const detailDelete = app.slice(app.indexOf("function deleteFromDetails("), app.indexOf("function requestDeleteDetails(", app.indexOf("function deleteFromDetails(")));
  const sheetDelete = app.slice(app.indexOf('if (action === "remove")'), app.indexOf('else if (action !== "cancel")', app.indexOf('if (action === "remove")')));
  assert.match(app, /const moveToTrash = item =>/);
  assert.match(mainDelete, /moveToTrash\(item\)/);
  assert.match(detailDelete, /moveToTrash\(item\)/);
  assert.match(sheetDelete, /moveToTrash\(target\)/);
});

test("Recently deleted renders restore and permanent-delete actions handled by the page", () => {
  assert.match(settings, /settingsGroup === "trash"[\s\S]*data-trash-restore/);
  assert.match(settings, /data-trash-delete/);
  assert.match(app, /eventClosest\(event, "\[data-trash-restore\]"\)/);
  assert.match(app, /eventClosest\(event, "\[data-trash-delete\]"\)/);
});
