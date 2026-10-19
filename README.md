# Orbit AI

A public AI chat workspace built with Next.js, React, and the Vercel AI SDK. Visitors can chat without an account. Includes streamed responses, stop generation, local conversation history, conversation deletion, code blocks, copy buttons, responsive layout, API instructions, and a downloadable Postman collection.

This is an application powered by an external language model, not a locally trained model. The site owner supplies provider access; visitors need no credentials. Requests try Vercel AI Gateway first, then Groq directly when configured, independently of Vercel credits. History stays in the current browser's local storage; prompts are sent to the configured AI provider.

## Run locally

Requires Node.js 22 or newer.

```sh
npm install
cp .env.example .env.local
# Set AI_GATEWAY_API_KEY in .env.local to a real Vercel AI Gateway key.
npm run dev
```

Open http://localhost:3000. With neither provider key configured, the interface works and the API returns an explicit 503 setup error. No canned AI responses are used.

## Deploy on Vercel

1. Push this directory to a Git repository and import it into Vercel, or run `npx vercel` from this directory.
2. Keep the detected Next.js preset and default build settings.
3. Set `AI_GATEWAY_API_KEY` in the project's environment variables. To enable automatic fallback, also set `GROQ_API_KEY` from https://console.groq.com/keys. Keep the Groq account on its Free plan if you want free-tier inference only.
4. Optionally set `AI_MODEL` to a supported Gateway model ID. The default is `alibaba/qwen3.5-flash`. Groq defaults to `openai/gpt-oss-20b`; override with `GROQ_MODEL` if needed.
5. Deploy or redeploy after updating variables. To allow anonymous access, turn off Vercel Authentication / Deployment Protection for the deployment you share.

The app has no login or API authentication. All AI calls use server credentials and consume the owner's provider balance. Set a provider spending limit appropriate for your public app. No global rate limiter is included.

## Public API

`POST https://YOUR-APP.vercel.app/api/chat`

Headers: `Content-Type: application/json`. No Authorization header needed. Cross-origin browser requests are supported through CORS and OPTIONS.

```sh
curl https://YOUR-APP.vercel.app/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Explain APIs in simple terms"}'
```

The JSON response contains `response` and an OpenAI-style `choices[0].message.content`, plus model, ID, finish reason and SDK usage metadata. `/api/v1/chat/completions` is an alias with the same request contract; it is not a complete OpenAI protocol implementation. Models are configured by the owner, not by the caller.

Multi-turn request:

```json
{
  "messages": [
    { "role": "user", "content": "My name is Alex." },
    { "role": "assistant", "content": "Hello, Alex!" },
    { "role": "user", "content": "What is my name?" }
  ]
}
```

JavaScript:

```js
const result = await fetch("https://YOUR-APP.vercel.app/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "Hello!" }),
});
const data = await result.json();
if (!result.ok) throw new Error(data.error.message);
console.log(data.response);
```

For streaming add `"stream": true`. Responses use SSE events `data: {"text":"delta"}` followed by `data: [DONE]`. When recovering from a partial answer, an event `{ "text": "replacement start", "reset": true }` tells clients to replace the accumulated answer, then append subsequent deltas. The built-in chat handles this automatically. A failure after streaming starts sends `data: {"error":"..."}`. This streaming format is Orbit's own, not OpenAI's chunk schema.

In Postman, create a POST request, choose Body → raw → JSON, enter `{"prompt":"Hello!"}`, and send. The app's API playground can export a ready-to-import collection with the correct deployment URL.

`GET /api/health` returns server availability and whether an AI credential is present, not whether the credential or provider balance is valid.

Limits: 60 messages, 48,000 total text characters, 200 KB request body, 2,048 output tokens, and a 55 second overall generation timeout (25 seconds per provider attempt). Errors return `{ "error": { "message": "..." } }` with 400, 413, 415, 502, or 503 status codes. Only user and assistant text messages are accepted. Web search, file upload, images, and voice are not included.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

Live model responses require valid server-side credentials and provider balance. Fonts load from Google Fonts with system font fallbacks.

## Automatic provider fallback

Set `GROQ_API_KEY` in `.env.local` for development and in Vercel environment variables for deployment. No visitor setup is needed. If Gateway is absent but Groq is configured, Groq works on its own. Keys are never sent to the browser.

Each request tries Gateway once, then Groq once on provider failures, exhausted credits, rate limits, access errors, empty responses, or a 25-second attempt timeout. The same full conversation is sent to the backup. Provider changes require no page reload or manual retry. Stop generation cancels the active request and prevents fallback. JSON clients receive the successful answer and actual model ID; streaming clients receive the same SSE contract with the reset event described above. If both providers fail, the app reports an error rather than inventing a response.

Groq free-tier quotas and model availability can change: https://console.groq.com/docs/rate-limits. This does not make Vercel hosting unlimited or guarantee free inference forever. The code cannot enforce a provider's billing plan; keep the backup account on its Free plan to avoid paid fallback usage. Live backup verification requires your own valid Groq key.
