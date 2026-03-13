import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { api, type ProjectRecord } from "../../lib/api";

interface Props {
  value: string;
  onChange: (projectId: string) => void;
}

export function TerminalDefaultsCard({ value, onChange }: Props) {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);

  useEffect(() => {
    api.listProjects().then(setProjects).catch(() => {});
  }, []);

  function handleChange(e: SelectChangeEvent) {
    onChange(e.target.value);
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>Terminal Defaults</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          New terminals open in this project's root directory. When set to
          "None", terminals open in your home directory.
        </Typography>
        <FormControl fullWidth size="small">
          <InputLabel>Default project</InputLabel>
          <Select
            value={value}
            label="Default project"
            onChange={handleChange}
          >
            <MenuItem value="">None (home directory)</MenuItem>
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </CardContent>
    </Card>
  );
}
