import { test } from "node:test";
import assert from "node:assert/strict";
import { createCompletion, createTextStream } from "../lib/providers.ts";
test("SDK integration: exhausted Gateway falls back to Groq for JSON and SSE", async () => {
  const previousFetch = globalThis.fetch;
  const saved = Object.fromEntries(
    ["AI_GATEWAY_API_KEY", "GROQ_API_KEY", "GROQ_MODEL"].map((k) => [
      k,
      process.env[k],
    ]),
  );
  process.env.AI_GATEWAY_API_KEY = "test-gateway-key";
  process.env.GROQ_API_KEY = "test-groq-key";
  process.env.GROQ_MODEL = "openai/gpt-oss-20b";
  let gatewayCalls = 0,
    groqCalls = 0;
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes("api.groq.com")) {
      gatewayCalls++;
      return Response.json(
        { error: { message: "Credits exhausted" } },
        { status: 402 },
      );
    }
    groqCalls++;
    const body = JSON.parse(String(init?.body));
    assert.equal(body.messages.at(-1).content, "Hi");
    const base = {
      id: "chat-test",
      object: "chat.completion",
      created: 1,
      model: "openai/gpt-oss-20b",
    };
    if (body.stream) {
      return new Response(
        `data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { role: "assistant", content: "Backup answer" }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
        { headers: { "Content-Type": "text/event-stream" } },
      );
    }
    return Response.json({
      ...base,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Backup answer" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
    });
  };
  try {
    const input = [{ role: "user" as const, content: "Hi" }];
    const result = await createCompletion(input, new AbortController().signal);
    assert.equal(result.result.text, "Backup answer");
    assert.equal(result.model, "groq/openai/gpt-oss-20b");
    const events = [];
    for await (const event of createTextStream(
      input,
      new AbortController().signal,
    ))
      events.push(event);
    assert.deepEqual(events, [{ text: "Backup answer" }]);
    assert.ok(gatewayCalls >= 2);
    assert.equal(groqCalls, 2);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
