import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Chip,
  Button,
  TextField,
  Slider,
  InputAdornment,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { EMPTY_FILTERS, activeCount, toggleItem } from "../lib/filter-state";
import type { FilterState } from "../lib/filter-state";

export { EMPTY_FILTERS, activeCount };
export type { FilterState };

interface FilterOptions {
  repos: string[];
  verdicts: string[];
  skills: string[];
  complexityBounds: { min: number; max: number };
}

interface Props {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  options: FilterOptions;
  repoColors?: Record<string, string>;
  verdictColors?: Record<string, string>;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="overline" color="text.secondary" sx={{ mb: 0.75, display: "block" }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

export function FilterDialog({ open, onClose, filters, onChange, options, repoColors, verdictColors }: Props) {
  const [skillSearch, setSkillSearch] = useState("");

  const visibleSkills = skillSearch
    ? options.skills.filter((s) => s.toLowerCase().includes(skillSearch.toLowerCase()))
    : options.skills;

  const { complexityBounds } = options;
  const hasActiveFilters = activeCount(filters, complexityBounds) > 0;

  const handleClear = () => {
    setSkillSearch("");
    onChange({ ...EMPTY_FILTERS, complexityRange: [complexityBounds.min, complexityBounds.max] });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { maxHeight: "80vh" } }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 0.5 }}>
        <Typography variant="h6" fontWeight={700}>Filters</Typography>
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          {hasActiveFilters && (
            <Button size="small" onClick={handleClear}>Clear All</Button>
          )}
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        <Section label="Repository">
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {options.repos.map((repo) => {
              const active = filters.repos.includes(repo);
              const color = repoColors?.[repo] ?? "#546e7a";
              return (
                <Chip
                  key={repo}
                  size="small"
                  label={repo}
                  onClick={() => onChange({ ...filters, repos: toggleItem(filters.repos, repo) })}
                  sx={{
                    backgroundColor: active ? color : "transparent",
                    borderColor: color,
                    border: "1px solid",
                    color: active ? "#fff" : color,
                    fontWeight: 600,
                    fontSize: "0.68rem",
                    cursor: "pointer",
                  }}
                />
              );
            })}
          </Box>
        </Section>

        <Section label="Verdict">
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {options.verdicts.map((v) => {
              const active = filters.verdicts.includes(v);
              const color = verdictColors?.[v] ?? "#888";
              return (
                <Chip
                  key={v}
                  size="small"
                  label={v}
                  onClick={() => onChange({ ...filters, verdicts: toggleItem(filters.verdicts, v) })}
                  sx={{
                    backgroundColor: active ? color : "transparent",
                    borderColor: color,
                    border: "1px solid",
                    color: active ? "#fff" : color,
                    fontWeight: 600,
                    fontSize: "0.72rem",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                />
              );
            })}
          </Box>
        </Section>

        <Section label="Skills">
          {options.skills.length > 8 && (
            <TextField
              size="small"
              placeholder="Search skills..."
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
              fullWidth
              sx={{ mb: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          )}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, maxHeight: 200, overflowY: "auto" }}>
            {visibleSkills.map((skill) => {
              const active = filters.skills.includes(skill);
              return (
                <Chip
                  key={skill}
                  size="small"
                  label={skill}
                  onClick={() => onChange({ ...filters, skills: toggleItem(filters.skills, skill) })}
                  variant={active ? "filled" : "outlined"}
                  color={active ? "primary" : "default"}
                  sx={{ cursor: "pointer", fontSize: "0.68rem" }}
                />
              );
            })}
            {visibleSkills.length === 0 && (
              <Typography variant="caption" color="text.secondary">No matching skills</Typography>
            )}
          </Box>
        </Section>

        {complexityBounds.max > complexityBounds.min && (
          <Section label="Complexity (tool calls)">
            <Slider
              size="small"
              value={filters.complexityRange ?? [complexityBounds.min, complexityBounds.max]}
              min={complexityBounds.min}
              max={complexityBounds.max}
              onChange={(_, val) => onChange({ ...filters, complexityRange: val as [number, number] })}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${v} calls`}
              disableSwap
            />
          </Section>
        )}
      </DialogContent>
    </Dialog>
  );
}
