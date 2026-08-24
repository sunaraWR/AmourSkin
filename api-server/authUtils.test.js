const test = require("node:test");
const assert = require("node:assert/strict");

const { parseJsonValue, serializeJsonValue } = require("./authUtils");

test("parseJsonValue returns null for malformed stored JSON", () => {
  assert.equal(parseJsonValue('{"bad":'), null);
});

test("serializeJsonValue preserves data for circular structures", () => {
  const data = { name: "demo" };
  data.self = data;

  const serialized = serializeJsonValue(data);
  assert.equal(typeof serialized, "string");
  assert.match(serialized, /"name":"demo"/);
});
