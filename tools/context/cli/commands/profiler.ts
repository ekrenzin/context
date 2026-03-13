import { apiGet, apiPost } from "../client.js";

interface ScanResult {
  processed: number;
  total: number;
}

export async function scanCommand(): Promise<void> {
  const result = await apiPost<ScanResult>("/api/profiler/scan");
  console.log(`Processed ${result.processed} of ${result.total} transcripts.`);
}

interface AnalyzeResult {
  chatId: string;
  verdict: string;
  title: string;
}

export async function analyze(chatId?: string): Promise<void> {
  const endpoint = chatId ? `/api/profiler/analyze/${chatId}` : "/api/profiler/analyze";
  const result = await apiPost<AnalyzeResult>(endpoint);
  console.log(`[${result.verdict}] ${result.title}`);
}
