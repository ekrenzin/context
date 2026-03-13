import { useState, useEffect, useCallback } from "react";
import { useMqttTopic } from "./useMqtt";

/**
 * Returns an incrementing generation counter that bumps when a message
 * arrives on the given MQTT topic. Use as a useEffect dependency to
 * trigger data refetches.
 */
export function useRefetchOnMqtt(topic: string): {
  generation: number;
  bump: () => void;
} {
  const [generation, setGeneration] = useState(0);
  const msg = useMqttTopic(topic);

  useEffect(() => {
    if (msg !== null) {
      setGeneration((g) => g + 1);
    }
  }, [msg]);

  const bump = useCallback(() => setGeneration((g) => g + 1), []);

  return { generation, bump };
}
