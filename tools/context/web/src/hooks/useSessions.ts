import { useState, useEffect, useCallback } from "react";
import { api, type SessionsPage, type SessionRecord, type SessionAnalysis } from "../lib/api";
import { useMqttTopic } from "./useMqtt";

export function useSessions() {
  const [pageLocal, setPageLocal] = useState<SessionsPage>({
    records: [],
    page: 0,
    totalPages: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    record: SessionRecord | null;
    analysis: SessionAnalysis | null;
  } | null>(null);

  const mqttPage = useMqttTopic<SessionsPage>("ctx/sessions");
  const page = mqttPage ?? pageLocal;

  const fetchPage = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const data = await api.sessions(pageNum);
      setPageLocal(data);
    } catch { /* network error */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  useEffect(() => {
    if (mqttPage) setLoading(false);
  }, [mqttPage]);

  const expand = useCallback(async (chatId: string) => {
    if (expandedId === chatId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(chatId);
    try {
      const d = await api.sessionDetail(chatId);
      setDetail(d);
    } catch {
      setDetail(null);
    }
  }, [expandedId]);

  return {
    page,
    loading,
    fetchPage,
    expandedId,
    detail,
    expand,
  };
}
