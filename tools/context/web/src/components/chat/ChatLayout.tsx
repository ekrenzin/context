import { useRef, useEffect } from "react";
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Stack,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

interface Props {
  messages: ChatMessage[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  disabled?: boolean;
  placeholder?: string;
  actions?: React.ReactNode;
}

export function ChatLayout({
  messages,
  input,
  onInputChange,
  onSend,
  sending,
  disabled,
  placeholder = "Type a message...",
  actions,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ flex: 1, overflow: "auto", pb: 2 }}>
        {messages.length === 0 && (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography variant="body2" color="text.secondary">
              No messages yet. Start a conversation.
            </Typography>
          </Box>
        )}
        {messages.map((msg, i) => (
          <Box
            key={i}
            sx={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              mb: 1.5,
            }}
          >
            <Card
              variant="outlined"
              sx={{
                maxWidth: "75%",
                bgcolor: msg.role === "user" ? "primary.main" : "background.paper",
              }}
            >
              <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: "pre-wrap",
                    color: msg.role === "user" ? "primary.contrastText" : "text.primary",
                  }}
                >
                  {msg.content}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        ))}
        {sending && (
          <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 1.5 }}>
            <CircularProgress size={20} />
          </Box>
        )}
        <div ref={bottomRef} />
      </Box>

      <Stack spacing={1} sx={{ flexShrink: 0, pt: 1 }}>
        {actions}
        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            multiline
            minRows={1}
            maxRows={4}
            placeholder={disabled ? "Unavailable" : placeholder}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            disabled={disabled || sending}
            onKeyDown={handleKeyDown}
            size="small"
          />
          <IconButton
            color="primary"
            onClick={onSend}
            disabled={disabled || sending || !input.trim()}
            sx={{ alignSelf: "flex-end" }}
          >
            {sending ? <CircularProgress size={20} /> : <SendIcon />}
          </IconButton>
        </Stack>
      </Stack>
    </Box>
  );
}
