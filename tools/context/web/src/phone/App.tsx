import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Chip,
  AppBar,
  Toolbar,
  BottomNavigation,
  BottomNavigationAction,
  CircularProgress,
} from "@mui/material";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { TerminalsView } from "./views/Terminals";
import { CommandsView } from "./views/Commands";
import { QuickActionsView } from "./views/QuickActions";

type View = "sessions" | "terminals" | "commands" | "quick" | "memory";

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
  const [view, setView] = useState<View>("terminals");

  const views: Record<View, JSX.Element> = {
    sessions: <SessionsView />,
    terminals: <TerminalsView />,
    commands: <CommandsView />,
    quick: <QuickActionsView />,
    memory: <MemoryView />,
  };

  return (
    <Box sx={{ pb: 8 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flex: 1 }}>Context</Typography>
          <ConnectionStatus />
        </Toolbar>
      </AppBar>

      {views[view]}

      <BottomNavigation
        value={view}
        onChange={(_, v) => setView(v as View)}
        sx={{ position: "fixed", bottom: 0, left: 0, right: 0 }}
        showLabels
      >
        <BottomNavigationAction label="Terminals" value="terminals" />
        <BottomNavigationAction label="Commands" value="commands" />
        <BottomNavigationAction label="Quick" value="quick" />
        <BottomNavigationAction label="Sessions" value="sessions" />
        <BottomNavigationAction label="Memory" value="memory" />
      </BottomNavigation>
    </Box>
  );
}
