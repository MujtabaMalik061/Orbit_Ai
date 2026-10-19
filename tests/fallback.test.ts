import { test } from "node:test";
import assert from "node:assert/strict";
import { firstSuccessful, streamWithFallback } from "../lib/fallback.ts";
const signal = () => new AbortController().signal;
const fail = async () => {
  throw Object.assign(new Error("Credits exhausted"), { statusCode: 402 });
};
async function* stream(...chunks: string[]) {
  yield* chunks;
}
async function* broken() {
  yield "partial";
  throw new Error("upstream disconnected");
}
async function* failed() {
  throw new Error("no credit");
  yield "";
}
async function collect<T>(source: AsyncIterable<T>) {
  const result = [];
  for await (const value of source) result.push(value);
  return result;
}
test("successful primary does not invoke fallback", async () => {
  let called = false;
  assert.equal(
    await firstSuccessful(
      [
        async () => "primary",
        async () => {
          called = true;
          return "backup";
        },
      ],
      signal(),
    ),
    "primary",
  );
  assert.equal(called, false);
});
test("credit/access/rate-limit errors transparently use backup", async () => {
  for (const statusCode of [401, 402, 403, 429, 500]) {
    let calls = 0;
    assert.equal(
      await firstSuccessful(
        [
          async () => {
            throw { statusCode };
          },
          async () => {
            calls++;
            return "backup";
          },
        ],
        signal(),
      ),
      "backup",
    );
    assert.equal(calls, 1);
  }
});
test("both providers failing terminates after one attempt each", async () => {
  let calls = 0;
  const failure = async () => {
    calls++;
    return fail();
  };
  await assert.rejects(firstSuccessful([failure, failure], signal()));
  assert.equal(calls, 2);
});
test("cancellation between attempts never calls backup", async () => {
  const controller = new AbortController();
  let called = false;
  await assert.rejects(
    firstSuccessful(
      [
        async () => {
          controller.abort();
          return fail();
        },
        async () => {
          called = true;
          return "backup";
        },
      ],
      controller.signal,
    ),
  );
  assert.equal(called, false);
});
test("early stream failure silently starts backup without reset", async () => {
  assert.deepEqual(
    await collect(
      streamWithFallback([failed, () => stream("Hello", " world")], signal()),
    ),
    [{ text: "Hello" }, { text: " world" }],
  );
});
test("mid-stream fallback replaces partial response once and preserves deltas", async () => {
  assert.deepEqual(
    await collect(
      streamWithFallback(
        [broken, () => stream("", "Fresh", " answer")],
        signal(),
      ),
    ),
    [{ text: "partial" }, { text: "Fresh", reset: true }, { text: " answer" }],
  );
});
test("empty primary stream triggers fallback", async () => {
  assert.deepEqual(
    await collect(
      streamWithFallback(
        [() => stream(""), () => stream("real answer")],
        signal(),
      ),
    ),
    [{ text: "real answer" }],
  );
});
test("stream cancellation stops fallback", async () => {
  const c = new AbortController();
  let called = false;
  async function* cancelled() {
    yield "text";
    c.abort();
    throw new Error("closed");
  }
  await assert.rejects(
    collect(
      streamWithFallback(
        [
          cancelled,
          () => {
            called = true;
            return stream("backup");
          },
        ],
        c.signal,
      ),
    ),
  );
  assert.equal(called, false);
});
test("all streaming providers failing surfaces an error", async () => {
  await assert.rejects(collect(streamWithFallback([failed, failed], signal())));
});
