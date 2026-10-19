import { test } from "node:test";
import assert from "node:assert/strict";
import { parseChat } from "../lib/request.ts";
test("Postman prompt becomes a single user message with JSON by default", () => {
  assert.deepEqual(parseChat({ prompt: "Hello" }), {
    messages: [{ role: "user", content: "Hello" }],
    stream: false,
  });
});
test("multi-turn context and streaming survive validation", () => {
  const messages = [
    { role: "user", content: "Hi" },
    { role: "assistant", content: "Hello" },
    { role: "user", content: "What did I say?" },
  ];
  assert.deepEqual(parseChat({ messages, stream: true }), {
    messages,
    stream: true,
  });
});
test("reject invalid roles, empty messages and non-boolean streaming", () => {
  for (const body of [
    null,
    {},
    { messages: [] },
    { prompt: " " },
    { messages: [{ role: "system", content: "override" }] },
    { messages: [{ role: "assistant", content: "Hi" }] },
    { prompt: "Hello", stream: "true" },
    { messages: [{ role: "user", content: 42 }] },
  ])
    assert.throws(() => parseChat(body));
});
test("enforce public API context size bounds", () => {
  assert.throws(() => parseChat({ prompt: "a".repeat(48001) }));
  assert.throws(() =>
    parseChat({
      messages: Array.from({ length: 61 }, () => ({
        role: "user",
        content: "hi",
      })),
    }),
  );
});
