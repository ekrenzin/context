import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Button,
  Chip,
  AppBar,
  Toolbar,
  BottomNavigation,
  BottomNavigationAction,
  CircularProgress,
} from "@mui/material";

type View = "sessions" | "analytics" | "tasks" | "memory";

interface Session {
  id: string;
  title: string;
  outcome: string;
  started_at: string;
}

interface MemoryEntry {
  id: string;
  title: string;
  category: string;
  content: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

async function supabaseQuery<T>(table: string, params = ""): Promise<T[]> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) return [];
  return res.json();
}

async function sendCommand(type: string, payload: Record<string, unknown> = {}): Promise<void> {
  const url = `${SUPABASE_URL}/rest/v1/commands`;
  await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ type, payload, status: "pending" }),
  });
}

function SessionsView() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseQuery<Session>("sessions", "order=started_at.desc&limit=20")
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CircularProgress sx={{ m: 4 }} />;

  return (
    <List>
      {sessions.map((s) => (
        <ListItem key={s.id}>
          <ListItemText
            primary={s.title || s.id.slice(0, 8)}
            secondary={new Date(s.started_at).toLocaleDateString()}
          />
          <Chip label={s.outcome} size="small" />
        </ListItem>
      ))}
    </List>
  );
}

function AnalyticsView() {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6">Analytics</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Analytics data syncs from the desktop app.
      </Typography>
    </Box>
  );
}

function TasksView() {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6">Commands</Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 2 }}>
        <Button variant="outlined" onClick={() => sendCommand("profiler-scan")}>
          Run Profiler Scan
        </Button>
        <Button variant="outlined" onClick={() => sendCommand("workspace-sync")}>
          Sync Workspace
        </Button>
      </Box>
    </Box>
  );
}

function MemoryView() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);

  useEffect(() => {
    supabaseQuery<MemoryEntry>("memory_summary", "order=created_at.desc&limit=30").then(
      setEntries,
    );
  }, []);

  return (
    <List>
      {entries.map((e) => (
        <Card key={e.id} sx={{ mb: 1, mx: 1 }}>
          <CardContent>
            <Typography variant="subtitle2">{e.title}</Typography>
            <Chip label={e.category} size="small" sx={{ mt: 0.5 }} />
            <Typography variant="body2" sx={{ mt: 1 }}>
              {e.content.slice(0, 120)}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </List>
  );
}

export default function PhoneApp() {
  const [view, setView] = useState<View>("sessions");

  const views: Record<View, JSX.Element> = {
    sessions: <SessionsView />,
    analytics: <AnalyticsView />,
    tasks: <TasksView />,
    memory: <MemoryView />,
  };

  return (
    <Box sx={{ pb: 8 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">Context</Typography>
        </Toolbar>
      </AppBar>

      {views[view]}

      <BottomNavigation
        value={view}
        onChange={(_, v) => setView(v as View)}
        sx={{ position: "fixed", bottom: 0, left: 0, right: 0 }}
        showLabels
      >
        <BottomNavigationAction label="Sessions" value="sessions" />
        <BottomNavigationAction label="Analytics" value="analytics" />
        <BottomNavigationAction label="Tasks" value="tasks" />
        <BottomNavigationAction label="Memory" value="memory" />
      </BottomNavigation>
    </Box>
  );
}
