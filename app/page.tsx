"use client";
import { useEffect, useRef, useState } from "react";
type Message = { role: "user" | "assistant"; content: string };
type Chat = { id: string; title: string; messages: Message[] };
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="m6 12 6-6 6 6M12 6v13" />,
    chat: <path d="M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0Z" />,
    code: (
      <>
        <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-12-2 18" />
      </>
    ),
    write: (
      <>
        <path d="m16 3 5 5-12 12H4v-5L16 3ZM14 5l5 5" />
      </>
    ),
    learn: (
      <>
        <path d="m2 8 10-5 10 5-10 5L2 8Zm4 2v7l6 4 6-4v-7M22 8v8" />
      </>
    ),
    spark: (
      <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" />
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="13" rx="2" />
        <path d="M16 8V3H3v13h5" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.spark}
    </svg>
  );
}
function Content({ text }: { text: string }) {
  return (
    <div className="message-text">
      {text.split(/(```[\s\S]*?```)/g).map((part, i) =>
        part.startsWith("```") ? (
          <pre key={i}>
            <code>{part.replace(/^```[^\n]*\n?/, "").replace(/```$/, "")}</code>
          </pre>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </div>
  );
}
const starters = [
  {
    icon: "write",
    title: "Find the right words",
    detail: "A first draft, a fresh perspective",
    prompt:
      "Help me write a clear, engaging introduction for a project I am working on. Ask me about the project first.",
  },
  {
    icon: "code",
    title: "Build something great",
    detail: "From a small bug to a big idea",
    prompt:
      "Help me turn an app idea into a practical development plan. Ask me what I want to build.",
  },
  {
    icon: "learn",
    title: "Make it make sense",
    detail: "Explore a topic, one step at a time",
    prompt:
      "Teach me a complicated topic in a simple way. Ask me what I want to learn.",
  },
  {
    icon: "spark",
    title: "Follow your curiosity",
    detail: "Give your next idea a little space",
    prompt:
      "Help me brainstorm creative ideas for a new side project. Ask me about my interests.",
  },
];
export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]),
    [active, setActive] = useState<string | null>(null),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [api, setApi] = useState(false),
    [mobile, setMobile] = useState(false),
    [ready, setReady] = useState(false),
    [configured, setConfigured] = useState<boolean | null>(null),
    [copied, setCopied] = useState("");
  const controller = useRef<AbortController | null>(null),
    bottom = useRef<HTMLDivElement>(null),
    inputRef = useRef<HTMLTextAreaElement>(null);
  const chat = chats.find((c) => c.id === active);
  const messages = chat?.messages || [];
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("orbit-chats") || "[]");
      if (Array.isArray(saved))
        setChats(
          saved.filter(
            (c) =>
              typeof c.id === "string" &&
              typeof c.title === "string" &&
              Array.isArray(c.messages) &&
              c.messages.every(
                (m: Message) =>
                  ["user", "assistant"].includes(m.role) &&
                  typeof m.content === "string",
              ),
          ),
        );
    } catch {}
    setReady(true);
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setConfigured(d.aiConfigured))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("orbit-chats", JSON.stringify(chats));
      } catch {}
  }, [chats, ready]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages.at(-1)?.content]);
  function newChat() {
    if (busy) return;
    setActive(null);
    setError("");
    setInput("");
    setApi(false);
    setMobile(false);
    inputRef.current?.focus();
  }
  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      setError("Clipboard unavailable. Please select and copy the text.");
    }
  }
  async function send(prompt = input) {
    if (busy || !prompt.trim()) return;
    const id = active || crypto.randomUUID();
    const history = [
      ...messages,
      { role: "user" as const, content: prompt.trim() },
    ];
    setInput("");
    setError("");
    setBusy(true);
    setActive(id);
    const abort = new AbortController();
    controller.current = abort;
    setChats((prev) => {
      const existing = prev.find((c) => c.id === id);
      return existing
        ? prev.map((c) => (c.id === id ? { ...c, messages: history } : c))
        : [
            { id, title: prompt.trim().slice(0, 44), messages: history },
            ...prev,
          ];
    });
    let responseText = "";
    const update = () =>
      setChats((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                messages: [
                  ...history,
                  { role: "assistant", content: responseText },
                ],
              }
            : c,
        ),
      );
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, stream: true }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Unable to get a response.");
      }
      if (!response.body) throw new Error("Streaming is unavailable.");
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "",
        doneEvent = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let split;
        while ((split = buffer.indexOf("\n\n")) !== -1) {
          const event = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          if (!event.startsWith("data: ")) continue;
          const payload = event.slice(6);
          if (payload === "[DONE]") {
            doneEvent = true;
            continue;
          }
          const data = JSON.parse(payload);
          if (data.error) throw new Error(data.error);
          if (typeof data.text === "string") {
            responseText += data.text;
            update();
          }
        }
      }
      if (!doneEvent)
        throw new Error("The response was interrupted. Please try again.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }
  const endpoint =
    typeof window === "undefined"
      ? "https://orbitai-online.vercel.app/api/chat"
      : `${window.location.origin}/api/chat`;
  const example = `curl ${endpoint} \\\n  -H 'Content-Type: application/json' \\\n  -d '{"prompt":"Explain APIs in simple terms"}'`;
  return (
    <div className="app-shell">
      <button
        className="mobile-toggle icon-btn"
        aria-label="Open menu"
        onClick={() => setMobile(!mobile)}
      >
        <Icon name="menu" />
      </button>
      {mobile && <div className="scrim" onClick={() => setMobile(false)} />}
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <a href="/" className="brand">
          <img
            className="brand-logo"
            src="/orbit-mark.svg"
            width="42"
            height="42"
            alt=""
          />{" "}
          orbit
        </a>
        <button className="new-chat" onClick={newChat} disabled={busy}>
          <Icon name="plus" size={18} /> New conversation <span>↗</span>
        </button>
        <div className="section-label">YOUR WORKSPACE</div>
        <button
          className={!api ? "nav active" : "nav"}
          onClick={() => {
            setApi(false);
            setMobile(false);
          }}
        >
          <Icon name="chat" size={18} /> Chat{" "}
          <span className="nav-pill">Personal</span>
        </button>
        <button
          className={api ? "nav active" : "nav"}
          onClick={() => {
            setApi(true);
            setMobile(false);
          }}
        >
          <Icon name="code" size={18} /> API playground{" "}
          <span className="external-arrow">↗</span>
        </button>
        <div className="history-label">
          <span>RECENT CONVERSATIONS</span>
          {chats.length > 0 && <span>{chats.length}</span>}
        </div>
        <div className="history">
          {chats.length === 0 ? (
            <div className="empty-history">
              <Icon name="chat" size={22} />
              <p>A little quiet in here.</p>
              <span>Your conversations will appear here.</span>
            </div>
          ) : (
            chats.map((c) => (
              <div
                key={c.id}
                className={`history-row ${active === c.id && !api ? "selected" : ""}`}
              >
                <button
                  disabled={busy}
                  onClick={() => {
                    setActive(c.id);
                    setApi(false);
                    setError("");
                    setMobile(false);
                  }}
                >
                  <Icon name="chat" size={15} />
                  <span>{c.title}</span>
                </button>
                <button
                  className="delete-chat"
                  aria-label={`Delete ${c.title}`}
                  disabled={busy}
                  onClick={() => {
                    setChats((prev) => prev.filter((x) => x.id !== c.id));
                    if (active === c.id) setActive(null);
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="open-note">
            <span className="green-dot" />
            <span>Open to everyone</span>
            <span className="tiny-pill">No sign-up</span>
          </div>
          <div className="local-profile">
            <span className="avatar">Y</span>
            <div>
              You, with possibilities
              <span>Conversations saved on this device</span>
            </div>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <div className="workspace-title">
            {api ? "Developer workspace" : "Your thinking space"} <span>/</span>{" "}
            <b>{api ? "API" : "Orbit AI"}</b>
          </div>
          <div className="header-right">
            <span className="live-dot" /> No account. Just ideas.
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setApi(!api);
              }}
            >
              <Icon name="code" size={16} />{" "}
              {api ? "Back to chat" : "Use the API"} <span>↗</span>
            </a>
          </div>
        </header>
        {api ? (
          <section className="api-page">
            <span className="eyebrow">BUILT TO CONNECT</span>
            <h1>
              Your ideas.
              <br />
              Anywhere you build.
            </h1>
            <p className="subtitle">
              One public endpoint. Connect Orbit to Postman, your website, or
              your next project.
            </p>
            <div className="endpoint">
              <span>POST</span>
              <code>{endpoint}</code>
              <button
                className="icon-btn"
                aria-label="Copy endpoint"
                onClick={() => copy(endpoint, "endpoint")}
              >
                <Icon
                  name={copied === "endpoint" ? "check" : "copy"}
                  size={17}
                />
              </button>
            </div>
            <div className="api-code">
              <div>
                <span>Quick start · cURL</span>
                <button onClick={() => copy(example, "example")}>
                  <Icon
                    name={copied === "example" ? "check" : "copy"}
                    size={15}
                  />
                  {copied === "example" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre>{example}</pre>
            </div>
            <div className="api-info">
              <div>
                <h3>No client authentication</h3>
                <p>
                  Send JSON with a prompt, or a messages array containing user
                  and assistant messages.
                </p>
              </div>
              <div>
                <h3>Stream as you go</h3>
                <p>
                  Add <code>"stream": true</code> for SSE events with text
                  deltas. Default requests return JSON with{" "}
                  <code>response</code> and <code>choices</code>.
                </p>
              </div>
            </div>
            <button
              className="download-button"
              onClick={() => {
                const data = {
                  info: {
                    name: "Orbit AI",
                    schema:
                      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
                  },
                  item: [
                    {
                      name: "Chat",
                      request: {
                        method: "POST",
                        header: [
                          { key: "Content-Type", value: "application/json" },
                        ],
                        url: endpoint,
                        body: {
                          mode: "raw",
                          raw: JSON.stringify(
                            { prompt: "Hello Orbit!" },
                            null,
                            2,
                          ),
                        },
                      },
                    },
                  ],
                };
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "orbit.postman_collection.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Icon name="download" size={17} /> Download Postman collection
            </button>
            {configured === false && (
              <div className="setup-note">
                One step before liftoff: set AI_GATEWAY_API_KEY in your server
                environment to enable AI responses.
              </div>
            )}
          </section>
        ) : (
          <>
            <div
              className={`conversation ${messages.length ? "has-messages" : ""}`}
            >
              {messages.length === 0 ? (
                <section className="welcome">
                  <div className="welcome-orbit">
                    <img
                      src="/orbit-mark.svg"
                      width="58"
                      height="58"
                      alt="Orbit"
                    />
                  </div>
                  <div className="eyebrow">A LITTLE SPACE TO THINK BIGGER</div>
                  <h1>
                    Where should we
                    <br />
                    <span>go from here?</span>
                  </h1>
                  <p className="subtitle">
                    An idea, a question, a blank page. Let’s start with what’s
                    on your mind.
                  </p>
                  <div className="starter-grid">
                    {starters.map((s) => (
                      <button
                        key={s.title}
                        onClick={() => {
                          setInput(s.prompt);
                          inputRef.current?.focus();
                        }}
                      >
                        <span className={`starter-icon ${s.icon}`}>
                          <Icon name={s.icon} />
                        </span>
                        <strong>{s.title}</strong>
                        <span>{s.detail}</span>
                        <i>↗</i>
                      </button>
                    ))}
                  </div>
                  <div className="welcome-note">
                    <span className="green-dot" /> No sign-up needed{" "}
                    <span>·</span> Your space, your pace
                  </div>
                </section>
              ) : (
                <div className="messages">
                  {messages.map((m, i) => (
                    <article className={`message ${m.role}`} key={i}>
                      <div className={`message-avatar ${m.role}`}>
                        {m.role === "assistant" ? (
                          <img
                            src="/orbit-mark.svg"
                            width="25"
                            height="25"
                            alt=""
                          />
                        ) : (
                          "Y"
                        )}
                      </div>
                      <div className="message-body">
                        <div className="message-author">
                          {m.role === "assistant" ? "Orbit" : "You"}
                          {m.role === "assistant" && <span>AI</span>}
                        </div>
                        <Content text={m.content} />
                        {m.role === "assistant" && (
                          <button
                            className="copy-message"
                            onClick={() => copy(m.content, `m${i}`)}
                          >
                            <Icon
                              name={copied === `m${i}` ? "check" : "copy"}
                              size={14}
                            />
                            {copied === `m${i}` ? "Copied" : "Copy"}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                  {busy && messages.at(-1)?.role === "user" && (
                    <div className="thinking">
                      <span>✳</span> Orbit is thinking <i />
                      <i />
                      <i />
                    </div>
                  )}
                  <div ref={bottom} />
                </div>
              )}
            </div>
            <div className="composer-wrap">
              {error && (
                <div className="error" role="alert">
                  {error}
                  <button
                    onClick={() => setError("")}
                    aria-label="Dismiss error"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              )}
              <form
                className="composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <textarea
                  ref={inputRef}
                  aria-label="Message Orbit"
                  placeholder="Ask anything, or dream up something new…"
                  value={input}
                  maxLength={12000}
                  rows={2}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <div className="composer-bottom">
                  <div className="model-badge">
                    <img
                      className="model-logo"
                      src="/orbit-mark.svg"
                      width="22"
                      height="22"
                      alt=""
                    />{" "}
                    Orbit <span className="fast-badge">Fast</span>
                  </div>
                  <div className="send-tools">
                    <span>Shift + Enter for a new line</span>
                    {busy ? (
                      <button
                        type="button"
                        className="send"
                        aria-label="Stop generating"
                        onClick={() => controller.current?.abort()}
                      >
                        <Icon name="stop" size={17} />
                      </button>
                    ) : (
                      <button
                        className="send"
                        disabled={!input.trim()}
                        aria-label="Send message"
                      >
                        <Icon name="arrow" size={20} />
                      </button>
                    )}
                  </div>
                </div>
              </form>
              <p className="disclaimer">
                A little intelligence, a lot of possibility. Orbit can make
                mistakes — double-check what matters.
              </p>
            </div>
          </>
        )}
        <footer>
          <span>
            MADE FOR YOUR NEXT <b>“WHAT IF?”</b>
          </span>
          <span>
            Powered by curiosity <span className="footer-spark">✳</span>
          </span>
        </footer>
      </main>
    </div>
  );
}
