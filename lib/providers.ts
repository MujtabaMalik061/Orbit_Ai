import { createGroq } from "@ai-sdk/groq";
import { generateText, streamText, type LanguageModel } from "ai";
import { firstSuccessful, streamWithFallback } from "./fallback.ts";
import type { Message } from "./request.ts";
const instructions =
  "You are Orbit, a helpful AI assistant. Be clear, accurate, warm, and practical. Use Markdown when useful. Be honest about uncertainty. You have no live web browsing or file tools.";
export function configuredProviders(): Array<{
  model: LanguageModel;
  id: string;
}> {
  const providers: Array<{ model: LanguageModel; id: string }> = [];
  if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) {
    const id = process.env.AI_MODEL || "alibaba/qwen3.5-flash";
    providers.push({ model: id, id });
  }
  if (process.env.GROQ_API_KEY) {
    const id = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
    providers.push({
      model: createGroq({ apiKey: process.env.GROQ_API_KEY })(id),
      id: `groq/${id}`,
    });
  }
  return providers;
}
export function createCompletion(messages: Message[], signal: AbortSignal) {
  return firstSuccessful(
    configuredProviders().map((provider) => async () => {
      const result = await generateText({
        model: provider.model,
        messages,
        instructions,
        maxOutputTokens: 2048,
        maxRetries: 0,
        abortSignal: AbortSignal.any([signal, AbortSignal.timeout(25000)]),
      });
      if (!result.text.trim()) throw new Error("Empty AI response.");
      return { result, model: provider.id };
    }),
    signal,
  );
}
export function createTextStream(messages: Message[], signal: AbortSignal) {
  return streamWithFallback(
    configuredProviders().map(
      (provider) => () =>
        streamText({
          model: provider.model,
          messages,
          instructions,
          maxOutputTokens: 2048,
          maxRetries: 0,
          // Avoid SDK default error logging, which can include the conversation.
          onError: () => {
            console.warn("AI stream provider failed:", provider.id);
          },
          abortSignal: AbortSignal.any([signal, AbortSignal.timeout(25000)]),
        }).textStream,
    ),
    signal,
  );
}
