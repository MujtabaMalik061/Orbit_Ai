import {
  configuredProviders,
  createCompletion,
  createTextStream,
} from "@/lib/providers";
import { parseChat } from "@/lib/request";
export const runtime = "nodejs";
export const maxDuration = 60;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store",
};
const error = (message: string, status: number) =>
  Response.json({ error: { message } }, { status, headers: cors });
export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    return error("Use Content-Type: application/json.", 415);
  let input;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 200000)
      return error("Request body is too large.", 413);
    input = parseChat(JSON.parse(raw));
  } catch (e) {
    return error(
      e instanceof SyntaxError ? "Invalid JSON body." : (e as Error).message,
      400,
    );
  }
  if (!configuredProviders().length)
    return error(
      "AI is not configured yet. The site owner must set AI_GATEWAY_API_KEY or GROQ_API_KEY in the server environment.",
      503,
    );
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(55000)]);
  try {
    if (input.stream) {
      // Wait for the first chunk so provider failures produce a proper HTTP error.
      const iterator = createTextStream(input.messages, signal);
      const first = await iterator.next();
      if (first.done)
        return error(
          "The AI provider returned an empty response. Please retry.",
          502,
        );
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(first.value)}\n\n`),
          );
        },
        async pull(controller) {
          try {
            const next = await iterator.next();
            if (next.done) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            } else
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(next.value)}\n\n`),
              );
          } catch {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: "Response interrupted. Please retry." })}\n\n`,
              ),
            );
            controller.close();
          }
        },
        async cancel() {
          await iterator.return?.(undefined);
        },
      });
      return new Response(stream, {
        headers: {
          ...cors,
          "Content-Type": "text/event-stream; charset=utf-8",
          "X-Accel-Buffering": "no",
        },
      });
    }
    const { result, model } = await createCompletion(input.messages, signal);
    return Response.json(
      {
        id: `chatcmpl-${crypto.randomUUID()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        response: result.text,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: result.text },
            finish_reason: result.finishReason,
          },
        ],
        usage: result.usage,
      },
      { headers: cors },
    );
  } catch {
    return error(
      "The AI provider could not complete this request. All configured providers are unavailable. Please try again shortly.",
      502,
    );
  }
}
