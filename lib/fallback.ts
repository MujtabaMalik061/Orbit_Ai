/** Try configured providers once each. Cancellation never starts another request. */
export async function firstSuccessful<T>(
  attempts: Array<() => Promise<T>>,
  signal: AbortSignal,
): Promise<T> {
  let lastError: unknown = new Error("No AI providers configured.");
  for (const attempt of attempts) {
    signal.throwIfAborted();
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }
  signal.throwIfAborted();
  throw lastError;
}
export type TextEvent = { text: string; reset?: true };
export async function* streamWithFallback(
  attempts: Array<() => AsyncIterable<string>>,
  signal: AbortSignal,
): AsyncGenerator<TextEvent> {
  let lastError: unknown = new Error("No AI providers configured.");
  let hasVisibleText = false;
  for (const attempt of attempts) {
    signal.throwIfAborted();
    let hasAttemptText = false;
    try {
      for await (const text of attempt()) {
        signal.throwIfAborted();
        if (!text) continue;
        // Replace an interrupted answer only when the backup starts answering.
        yield {
          text,
          ...(!hasAttemptText && hasVisibleText
            ? { reset: true as const }
            : {}),
        };
        hasAttemptText = true;
        hasVisibleText = true;
      }
      if (!hasAttemptText) throw new Error("Empty AI response.");
      return;
    } catch (error) {
      lastError = error;
    }
  }
  signal.throwIfAborted();
  throw lastError;
}
