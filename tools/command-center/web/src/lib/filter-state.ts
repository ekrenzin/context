export interface FilterState {
  repos: string[];
  verdicts: string[];
  skills: string[];
  complexityRange: [number, number] | null;
}

export const EMPTY_FILTERS: FilterState = {
  repos: [],
  verdicts: [],
  skills: [],
  complexityRange: null,
};

export function activeCount(
  filters: FilterState,
  bounds: { min: number; max: number },
): number {
  let count = 0;
  if (filters.repos.length > 0) count++;
  if (filters.verdicts.length > 0) count++;
  if (filters.skills.length > 0) count++;
  const cr = filters.complexityRange;
  if (cr && (cr[0] > bounds.min || cr[1] < bounds.max)) count++;
  return count;
}

export function toggleItem(list: string[], item: string): string[] {
  return list.includes(item)
    ? list.filter((v) => v !== item)
    : [...list, item];
}
