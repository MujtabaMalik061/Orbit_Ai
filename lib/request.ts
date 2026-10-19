export type Message = { role: "user" | "assistant"; content: string };
export function parseChat(body: unknown): {
  messages: Message[];
  stream: boolean;
} {
  if (!body || typeof body !== "object")
    throw new Error("Send a JSON object with prompt or messages.");
  const b = body as Record<string, unknown>;
  if (b.stream !== undefined && typeof b.stream !== "boolean")
    throw new Error("stream must be a boolean.");
  const raw =
    b.messages ??
    (typeof b.prompt === "string"
      ? [{ role: "user", content: b.prompt }]
      : null);
  if (!Array.isArray(raw) || !raw.length || raw.length > 60)
    throw new Error("Provide 1–60 messages, or a prompt string.");
  let total = 0;
  const messages = raw.map((m: unknown): Message => {
    if (!m || typeof m !== "object")
      throw new Error("Each message needs role and content.");
    const v = m as Record<string, unknown>;
    if (
      (v.role !== "user" && v.role !== "assistant") ||
      typeof v.content !== "string" ||
      !v.content.trim()
    )
      throw new Error(
        "Messages require a user/assistant role and nonempty text content.",
      );
    total += v.content.length;
    return { role: v.role, content: v.content };
  });
  if (total > 48000)
    throw new Error(
      "Conversation exceeds 48,000 characters. Start a new chat.",
    );
  if (messages.at(-1)?.role !== "user")
    throw new Error("The last message must be from the user.");
  return { messages, stream: b.stream === true };
}
