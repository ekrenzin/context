import { useState, useEffect, useCallback } from "react";
import { useMqttBuffer } from "./useMqtt";

export interface PreviewEntry {
  id: string;
  path: string;
  filename: string;
  type: string;
  title: string;
  url: string;
  timestamp: string;
}

/**
 * Subscribes to preview entries via MQTT and seeds from the REST API.
 * Tracks unseen count for the FAB badge.
 */
export function usePreviewEntries() {
  const mqttEntries = useMqttBuffer<PreviewEntry>("ctx/preview/opened", 200);
  const [seeded, setSeeded] = useState<PreviewEntry[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [knownIds, setKnownIds] = useState<Set<string>>(new Set());

  // Seed existing entries from REST on mount
  useEffect(() => {
    fetch("/api/preview/entries")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PreviewEntry[]) => {
        if (data.length > 0) {
          setSeeded(data);
          setKnownIds(new Set(data.map((e) => e.id)));
          setUnseenCount(data.length);
        }
      })
      .catch(() => {});
  }, []);

  // Detect new MQTT entries, bump unseen count, trigger shake
  useEffect(() => {
    if (mqttEntries.length === 0) return;
    const newest = mqttEntries[mqttEntries.length - 1];
    if (newest && !knownIds.has(newest.id)) {
      setKnownIds((prev) => new Set(prev).add(newest.id));
      setUnseenCount((c) => c + 1);
      setShaking(true);
      setTimeout(() => setShaking(false), 800);
    }
  }, [mqttEntries, knownIds]);

  const markSeen = useCallback(() => setUnseenCount(0), []);

  // Deduplicate seeded + mqtt entries
  const allEntries = [...seeded];
  for (const entry of mqttEntries) {
    if (!allEntries.some((e) => e.id === entry.id)) {
      allEntries.push(entry);
    }
  }

  return { entries: allEntries, unseenCount, shaking, markSeen };
}
