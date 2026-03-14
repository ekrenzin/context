import { countMcpServers, upsertMcpServer } from "../db/queries/mcp-servers.js";
import type { McpServerInput } from "../db/queries/mcp-servers.js";

const DEFAULTS: McpServerInput[] = [
  {
    id: "awslabs.cloudwatch-mcp-server",
    name: "AWS CloudWatch",
    namespace: "com.amazonaws",
    command: "uvx",
    args: ["awslabs.cloudwatch-mcp-server@latest"],
    env: {
      AWS_PROFILE: "sos-gov",
      AWS_REGION: "us-gov-west-1",
      FASTMCP_LOG_LEVEL: "ERROR",
    },
    repoUrl: "https://github.com/awslabs/mcp",
    configSchema: [
      { key: "AWS_PROFILE", label: "AWS Profile", required: true, placeholder: "default" },
      { key: "AWS_REGION", label: "AWS Region", required: true, placeholder: "us-east-1" },
      { key: "FASTMCP_LOG_LEVEL", label: "Log Level", placeholder: "ERROR" },
    ],
  },
  {
    id: "awslabs.aws-documentation-mcp-server",
    name: "AWS Documentation",
    namespace: "com.amazonaws",
    command: "uvx",
    args: ["awslabs.aws-documentation-mcp-server@latest"],
    env: { FASTMCP_LOG_LEVEL: "ERROR" },
    repoUrl: "https://github.com/awslabs/mcp",
    configSchema: [
      { key: "FASTMCP_LOG_LEVEL", label: "Log Level", placeholder: "ERROR" },
    ],
  },
  {
    id: "@google-cloud/gcloud-mcp",
    name: "Google Cloud",
    namespace: "com.google",
    command: "npx",
    args: ["-y", "@google-cloud/gcloud-mcp"],
    env: {},
    repoUrl: "https://github.com/googleapis/gcloud-mcp",
    configSchema: [
      { key: "GOOGLE_APPLICATION_CREDENTIALS", label: "Service Account Key Path", description: "Path to JSON key file (or use gcloud auth)" },
      { key: "GCLOUD_PROJECT", label: "GCP Project ID", placeholder: "my-project" },
    ],
  },
  {
    id: "@azure/mcp",
    name: "Azure",
    namespace: "com.microsoft",
    command: "npx",
    args: ["-y", "@azure/mcp@latest", "server", "start"],
    env: {},
    repoUrl: "https://github.com/microsoft/mcp",
    configSchema: [
      { key: "AZURE_SUBSCRIPTION_ID", label: "Subscription ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
      { key: "AZURE_TENANT_ID", label: "Tenant ID" },
    ],
  },
  {
    id: "@playwright/mcp",
    name: "Playwright",
    namespace: "com.playwright",
    command: "npx",
    args: ["@playwright/mcp@latest", "--caps", "testing", "--viewport-size", "1280,720"],
    env: {},
    repoUrl: "https://github.com/anthropics/mcp-playwright",
    configSchema: [],
  },
  {
    id: "atlassian-mcp-server",
    name: "Atlassian (Jira + Confluence)",
    namespace: "com.atlassian",
    command: "npx",
    args: ["-y", "@anthropic/atlassian-mcp-server"],
    env: {},
    enabled: false,
    repoUrl: "https://github.com/atlassian/mcp-server",
    configSchema: [
      { key: "JIRA_URL", label: "Jira URL", required: true, placeholder: "https://yourco.atlassian.net" },
      { key: "JIRA_EMAIL", label: "Jira Email", required: true, placeholder: "you@company.com" },
      { key: "JIRA_API_TOKEN", label: "Jira API Token", required: true, secret: true, description: "Generate at id.atlassian.com/manage-profile/security/api-tokens" },
      { key: "CONFLUENCE_URL", label: "Confluence URL", placeholder: "https://yourco.atlassian.net/wiki" },
    ],
  },
];

export function seedMcpServers(): number {
  if (countMcpServers() > 0) return 0;
  for (const server of DEFAULTS) {
    upsertMcpServer(server);
  }
  return DEFAULTS.length;
}
