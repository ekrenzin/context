import fs from "fs";

const TOOL_CALL_RE = /^\[Tool call\]\s+(\w+)/;
const PATH_LINE_RE = /^\s+path:\s+(.+)$/;
const SKILL_PATH_RE = /\.cursor\/skills\/([^/]+)\/SKILL\.md$/;
const SUBAGENT_RE = /^\s+subagent_type:\s+(\w+)/;
const USER_TURN_RE = /^user:/;
const ASSISTANT_TURN_RE = /^assistant:/;
const THINKING_RE = /^\[Thinking\]/;

export interface ParsedSession {
  chatId: string;
  date: string;
  timestamp: string;
  firstQuery: string;
  fileBytes: number;
  userTurns: number;
  assistantTurns: number;
  totalCalls: number;
  tools: Record<string, number>;
  skills: string[];
  skillCounts: Record<string, number>;
  subagentTypes: Record<string, number>;
  planMode: boolean;
  thinkingBlocks: number;
  responseCharsTotal: number;
  responseCharsAvg: number;
  responseCharsMax: number;
}

export function parseTranscript(filePath: string, chatId: string): ParsedSession {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const stat = fs.statSync(filePath);

  const tools: Record<string, number> = {};
  const skillCounts: Record<string, number> = {};
  const subagentTypes: Record<string, number> = {};
  let userTurns = 0;
  let assistantTurns = 0;
  let totalCalls = 0;
  let thinkingBlocks = 0;
  let planMode = false;
  let firstQuery = "";
  let lastTool = "";
  let responseCharsTotal = 0;
  let responseCharsMax = 0;
  let currentResponseLen = 0;
  let inAssistant = false;

  for (const line of lines) {
    const toolMatch = TOOL_CALL_RE.exec(line);
    if (toolMatch) {
      const name = toolMatch[1];
      tools[name] = (tools[name] ?? 0) + 1;
      totalCalls++;
      lastTool = name;
      continue;
    }

    if (lastTool === "Read" || lastTool === "ReadFile") {
      const pathMatch = PATH_LINE_RE.exec(line);
      if (pathMatch) {
        const skillMatch = SKILL_PATH_RE.exec(pathMatch[1]);
        if (skillMatch) {
          const skill = skillMatch[1];
          skillCounts[skill] = (skillCounts[skill] ?? 0) + 1;
        }
      }
    }

    const subMatch = SUBAGENT_RE.exec(line);
    if (subMatch) {
      subagentTypes[subMatch[1]] = (subagentTypes[subMatch[1]] ?? 0) + 1;
    }

    if (USER_TURN_RE.test(line)) {
      userTurns++;
      if (userTurns === 1) firstQuery = line.replace(/^user:\s*/, "").slice(0, 200);
      if (inAssistant) {
        responseCharsTotal += currentResponseLen;
        if (currentResponseLen > responseCharsMax) responseCharsMax = currentResponseLen;
        currentResponseLen = 0;
        inAssistant = false;
      }
    }

    if (ASSISTANT_TURN_RE.test(line)) {
      assistantTurns++;
      inAssistant = true;
      currentResponseLen = 0;
    }

    if (inAssistant) currentResponseLen += line.length;
    if (THINKING_RE.test(line)) thinkingBlocks++;
    if (line.includes("plan") && line.includes("mode")) planMode = true;
  }

  if (inAssistant) {
    responseCharsTotal += currentResponseLen;
    if (currentResponseLen > responseCharsMax) responseCharsMax = currentResponseLen;
  }

  const skills = Object.keys(skillCounts);
  const avgResponse = assistantTurns > 0 ? Math.round(responseCharsTotal / assistantTurns) : 0;

  return {
    chatId,
    date: stat.mtime.toISOString().slice(0, 10),
    timestamp: stat.mtime.toISOString(),
    firstQuery,
    fileBytes: stat.size,
    userTurns,
    assistantTurns,
    totalCalls,
    tools,
    skills,
    skillCounts,
    subagentTypes,
    planMode,
    thinkingBlocks,
    responseCharsTotal,
    responseCharsAvg: avgResponse,
    responseCharsMax,
  };
}
