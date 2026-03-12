# Cross-Repo Impact Checklist

Use this checklist when planning features that span multiple repositories or services.

## Infrastructure & Schema
- [ ] **Database**: Does this change alter schemas or ENUMs? Coordinate migration in `your-app`.
- [ ] **SQS/Kinesis**: Does this change message formats? Update `your-service` handlers.
- [ ] **MQTT**: Does this change topics or payloads? Update `your-gateway`, `your-app` subscribers, and local dev tooling (`ctx/cc/*` topics shared by Command Center, VS Code ext, Teams bot).

## Services & APIs
- [ ] **API Contracts**: Does this change existing endpoint responses? Update consumers and documentation.
- [ ] **Notification Flow**: Does this change delivery logic? Verify multi-channel delivery (SMS, Email, Siren) in `your-service`.
- [ ] **Hardware/Firmware**: If updating firmware metadata, ensure `your-app` and `hardware-bridge-communicator` are aligned.

## Operational Awareness
- [ ] **Logging**: Does this follow the Unified Structured Logging Strategy? Use JSON strategy to reduce CloudWatch noise.
- [ ] **Jira**: Link commits to tickets and transition statuses based on progress.
