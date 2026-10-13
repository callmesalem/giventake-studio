import test from "node:test";
import assert from "node:assert/strict";
import { MERGE_FIELDS, renderTemplate, unknownMergeFields } from "../src/lib/campaign-template.ts";

test("the supported set is exactly name, firstName and company", () => {
  assert.deepEqual([...MERGE_FIELDS], ["name", "firstName", "company"]);
});

test("renders every supported field, with spaces inside the braces tolerated", () => {
  const out = renderTemplate("Hi {{firstName}} ({{ name }}) at {{company}}", {
    name: "Ana Marks",
    company: "Marks & Co",
  });
  assert.equal(out, "Hi Ana (Ana Marks) at Marks & Co");
});

test("falls back to neutral words when the lead has no name or company", () => {
  const out = renderTemplate("Hi {{firstName}}, {{name}}, {{company}}", {
    name: null,
    company: "",
  });
  assert.equal(out, "Hi there, there, your business");
});

test("a name containing replacement patterns is inserted verbatim", () => {
  assert.equal(renderTemplate("{{name}}", { name: "$& $' $1", company: null }), "$& $' $1");
});

test("unknown tokens are reported at authoring time and left alone at send time", () => {
  assert.deepEqual(unknownMergeFields("Hi {{name}}, re {{Company}} and {{deal}} {{deal}}"), [
    "Company",
    "deal",
  ]);
  assert.deepEqual(unknownMergeFields("plain text"), []);
  assert.equal(renderTemplate("{{deal}}", { name: "x", company: null }), "{{deal}}");
});
