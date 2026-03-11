const TOPIC_PREFIX = "ctx";
const STATUS_TOPIC = `${TOPIC_PREFIX}/status`;

export function topicFor(domain: string): string {
  return `${TOPIC_PREFIX}/${domain}`;
}

export function statusTopic(): string {
  return STATUS_TOPIC;
}
