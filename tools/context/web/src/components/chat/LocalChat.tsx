import { useState, useEffect, useCallback } from "react";
import { Alert, Chip, Stack } from "@mui/material";
import { ChatLayout, type ChatMessage } from "./ChatLayout";
import { api } from "../../lib/api";

export function LocalChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ status: string; model: string | null } | null>(null);

  useEffect(() => {
    api.localAiStatus()
      .then(setStatus)
      .catch(() => setStatus({ status: "offline", model: null }));
  }, []);

  const online = status?.status === "online";

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !online) return;

    const userMsg: ChatMessage = { role: "user", content: text, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await api.localAiPrompt(text, { maxTokens: 500, temperature: 0.7 });
      if (res.ok && res.response) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.response!, ts: Date.now() },
        ]);
      } else {
        setError(res.error ?? "No response from local model");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }, [input, sending, online]);

  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {!online && status && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          Local AI is offline. Start Ollama to use this tab.
        </Alert>
      )}
      <ChatLayout
        messages={messages}
        input={input}
        onInputChange={setInput}
        onSend={send}
        sending={sending}
        disabled={!online}
        placeholder={online ? `Ask ${status?.model ?? "local model"}...` : "Local AI offline"}
        actions={
          <Stack direction="row" spacing={1}>
            <Chip
              label={online ? "Online" : "Offline"}
              size="small"
              color={online ? "success" : "error"}
              variant="outlined"
            />
            {status?.model && (
              <Chip label={status.model} size="small" variant="outlined" />
            )}
          </Stack>
        }
      />
    </>
  );
}
