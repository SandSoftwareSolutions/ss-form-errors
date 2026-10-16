import assert from "node:assert/strict";
import { test } from "node:test";

import { firstError, foldUnknownFields, hasErrors, normalizePath, toFieldErrors } from "./src/index.js";

test("normalizePath understands pointers, JSONPath and arrays", () => {
  for (const p of ["items.0.name", "/items/0/name", "#/items/0/name", "$.items[0].name", ["items", 0, "name"], "items[0]['name']"]) {
    assert.equal(normalizePath(p), "items.0.name", String(p));
  }
  assert.equal(normalizePath(undefined), "");
  assert.equal(normalizePath(""), "");
});

test("problem details with an errors list", () => {
  const r = toFieldErrors({
    type: "https://example.com/validation", title: "Validation failed", status: 422,
    errors: [{ pointer: "/email", detail: "Not an email" }, { field: "name", message: "Required" }, { field: "name", message: "Required" }]
  });
  assert.deepEqual(r, { fields: { email: ["Not an email"], name: ["Required"] }, form: [] });
});

test("errors as an object of messages", () => {
  const r = toFieldErrors({ errors: { email: ["Bad", "Worse"], name: "Required" } });
  assert.deepEqual(r.fields, { email: ["Bad", "Worse"], name: ["Required"] });
});

test("validator issues with path arrays", () => {
  const r = toFieldErrors({ issues: [{ path: ["address", "street"], message: "Required", code: "too_small" }, { path: [], message: "Passwords differ" }] });
  assert.deepEqual(r, { fields: { "address.street": ["Required"] }, form: ["Passwords differ"] });
});

test("flattened form errors", () => {
  const r = toFieldErrors({ fieldErrors: { a: ["x"], b: ["y"] }, formErrors: ["z"] });
  assert.deepEqual(r, { fields: { a: ["x"], b: ["y"] }, form: ["z"] });
});

test("JSON:API style and wrapped errors", () => {
  assert.deepEqual(toFieldErrors({ errors: [{ source: { pointer: "/data/attributes/title" }, detail: "Too long" }] }).fields, { "data.attributes.title": ["Too long"] });
  assert.deepEqual(toFieldErrors({ error: { message: "Nope" } }).form, ["Nope"]);
});

test("translate decides the text, with the code and parameters", () => {
  const calls = [];
  const r = toFieldErrors(
    { errors: [{ path: "age", code: "too_small", message: "Too small", params: { min: 18 } }, { path: "name", code: "unknown", message: "Server text" }] },
    { translate: (i) => { calls.push(i); return i.code === "too_small" ? `Minimaal ${i.params.min}` : undefined; } }
  );
  assert.deepEqual(r.fields, { age: ["Minimaal 18"], name: ["Server text"] });
  assert.equal(calls[0].path, "age");
});

test("anything unexpected still ends up as a form error and never throws", () => {
  assert.deepEqual(toFieldErrors("Kapot").form, ["Kapot"]);
  assert.deepEqual(toFieldErrors(new Error("Netwerk")).form, ["Netwerk"]);
  assert.deepEqual(toFieldErrors(null).form, ["Something went wrong"]);
  assert.deepEqual(toFieldErrors(undefined, { fallback: "Mislukt" }).form, ["Mislukt"]);
  assert.deepEqual(toFieldErrors({ status: 500, title: "Internal Server Error" }).form, ["Internal Server Error"]);
  assert.deepEqual(toFieldErrors({ detail: "Gebruiker bestaat al", code: "exists" }).form, ["Gebruiker bestaat al"]);
  assert.deepEqual(toFieldErrors({ errors: [] }).form, ["Something went wrong"]);
  assert.deepEqual(toFieldErrors(42).form, ["Something went wrong"]);
});

test("helpers", () => {
  const r = toFieldErrors({ errors: [{ path: "a", message: "x" }, { path: "items.3.name", message: "y" }] });
  assert.equal(firstError(r, "a"), "x");
  assert.equal(firstError(r, "zzz"), undefined);
  assert.equal(hasErrors(r), true);
  assert.equal(hasErrors({ fields: {}, form: [] }), false);
  assert.deepEqual(foldUnknownFields(r, ["a"]), { fields: { a: ["x"] }, form: ["items.3.name: y"] });
});
