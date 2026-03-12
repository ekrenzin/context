# Repository-to-Template Mapping

Template selection is **repo-specific**. Determine which repository you're working in by checking the current directory.

| Repository | Template |
|------------|----------|
| Root context (workspace root) | `tools/context-templates/PR_SUMMARY_TEMPLATE.md` (default) |
| `repos/your-app` | `tools/context-templates/PR_SUMMARY_TEMPLATE.md` |
| `repos/your-service` | `tools/context-templates/PR_SUMMARY_TEMPLATE_NOTIFIER.md` |
| `repos/your-gateway` | `tools/context-templates/PR_SUMMARY_TEMPLATE.md` (default) |
| `repos/lora-firmware` | `tools/context-templates/PR_SUMMARY_TEMPLATE.md` (default) |
| `repos/sos-documentation` | `tools/context-templates/PR_SUMMARY_TEMPLATE.md` (default) |
| `repos/sos-tickets` | `tools/context-templates/PR_SUMMARY_TEMPLATE.md` (default) |

## Template-Specific Guidelines

### your-app (PR_SUMMARY_TEMPLATE.md)

- **Environments**: In almost all cases, this should be `- No changes`
- **Frontend**: List React components, UI changes, Material-UI updates, Redux changes
- **Backend**: List API endpoints, database migrations, service logic, AWS integrations
- **Testing**: Check boxes for Unit Tests and System Tests if applicable

### your-service (PR_SUMMARY_TEMPLATE_NOTIFIER.md)

- **Changes**: List backend/serverless changes (Lambda functions, SQS handlers, notification delivery logic)
- **Testing**: Check boxes for Unit Tests and System Tests if applicable

### Other repos (default template)

- Follow the structure of `tools/context-templates/PR_SUMMARY_TEMPLATE.md`
- Adapt sections to match the repo's structure (e.g., Python repos may not have Frontend/Backend sections)
