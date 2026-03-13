import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Alert,
  Box,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ListSubheader,
  TextField,
  IconButton,
  Typography,
  CircularProgress,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import StopIcon from "@mui/icons-material/Stop";
import MenuIcon from "@mui/icons-material/Menu";
import type { AiModelOption } from "../../lib/api";
import { useConversations } from "../../hooks/useConversations";
import { useChatStream } from "../../hooks/useChatStream";
import { MessageBubble } from "./MessageBubble";
import { ToolCallCard } from "./ToolCallCard";
import { ConversationSidebar } from "./ConversationSidebar";
import type { ChatMessage } from "../../types/chat";

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Claude",
  openai: "ChatGPT",
};

interface Props {
  models: AiModelOption[];
}

export function CloudChat({ models }: Props) {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const convState = useConversations();

  const activeIdRef = useRef(convState.activeId);
  activeIdRef.current = convState.activeId;

  const onStreamDone = useCallback((text: string, title?: string) => {
    const id = activeIdRef.current;
    if (text && id) {
      const msg: ChatMessage = {
        id: Date.now(),
        conversation_id: id,
        role: "assistant",
        content: text,
        tool_calls: null,
        tool_results: null,
        created_at: new Date().toISOString(),
      };
      convState.setMessages((prev) => [...prev, msg]);
    }
    if (title && id) {
      convState.updateTitle(id, title);
    }
  }, [convState.setMessages, convState.updateTitle]);

  const chatStream = useChatStream(onStreamDone);

  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].id);
    }
  }, [models, selectedModel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convState.messages.length, chatStream.streamingText, chatStream.toolCalls.length]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || chatStream.streaming) return;

    let convId = convState.activeId;
    if (!convId) {
      const conv = await convState.create();
      convId = conv.id;
    }

    const userMsg: ChatMessage = {
      id: Date.now(),
      conversation_id: convId,
      role: "user",
      content: text,
      tool_calls: null,
      tool_results: null,
      created_at: new Date().toISOString(),
    };
    convState.setMessages((prev) => [...prev, userMsg]);
    setInput("");

    chatStream.send(convId, text, selectedModel || undefined);
  }, [input, chatStream, convState, selectedModel]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const groupedItems = useMemo(() => {
    const items: React.ReactNode[] = [];
    const byProvider = new Map<string, AiModelOption[]>();
    for (const m of models) {
      const list = byProvider.get(m.provider) ?? [];
      list.push(m);
      byProvider.set(m.provider, list);
    }
    for (const [provider, group] of byProvider) {
      items.push(
        <ListSubheader key={`header-${provider}`}>
          {PROVIDER_LABELS[provider] ?? provider}
        </ListSubheader>,
      );
      for (const m of group) {
        items.push(<MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>);
      }
    }
    return items;
  }, [models]);

  const modelSelector = (
    <FormControl size="small" fullWidth>
      <InputLabel>Model</InputLabel>
      <Select
        value={selectedModel}
        label="Model"
        onChange={(e: SelectChangeEvent) => setSelectedModel(e.target.value)}
        disabled={models.length === 0}
      >
        {groupedItems}
      </Select>
    </FormControl>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ConversationSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={convState.conversations}
        activeId={convState.activeId}
        onSelect={convState.select}
        onCreate={convState.create}
        onDelete={convState.remove}
        extraContent={modelSelector}
      />
      {chatStream.error && (
        <Alert severity="error" sx={{ m: 1 }}>
          {chatStream.error}
        </Alert>
      )}
      <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
        {convState.messages.length === 0 && !chatStream.streaming && (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography variant="body2" color="text.secondary">
              Start a conversation with the AI assistant.
            </Typography>
          </Box>
        )}
        {convState.messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {chatStream.toolCalls.map((tc) => (
          <ToolCallCard key={tc.id} tool={tc} />
        ))}
        {chatStream.streaming && chatStream.streamingText && (
          <MessageBubble role="assistant" content={chatStream.streamingText} />
        )}
        {chatStream.streaming && !chatStream.streamingText && chatStream.toolCalls.length === 0 && (
          <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 1.5 }}>
            <CircularProgress size={20} />
          </Box>
        )}
        <div ref={bottomRef} />
      </Box>
      <Stack direction="row" spacing={1} sx={{ flexShrink: 0, p: 1.5, pt: 0.5 }}>
        <IconButton
          size="small"
          onClick={() => setSidebarOpen(true)}
          sx={{ alignSelf: "flex-end" }}
        >
          <MenuIcon />
        </IconButton>
        <TextField
          fullWidth
          multiline
          minRows={1}
          maxRows={4}
          placeholder={models.length === 0 ? "No AI configured" : "Type a message..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={chatStream.streaming || models.length === 0}
          onKeyDown={handleKeyDown}
          size="small"
        />
        {chatStream.streaming ? (
          <IconButton onClick={chatStream.abort} sx={{ alignSelf: "flex-end" }}>
            <StopIcon />
          </IconButton>
        ) : (
          <IconButton
            color="primary"
            onClick={send}
            disabled={!input.trim() || models.length === 0}
            sx={{ alignSelf: "flex-end" }}
          >
            <SendIcon />
          </IconButton>
        )}
      </Stack>
    </Box>
  );
}
