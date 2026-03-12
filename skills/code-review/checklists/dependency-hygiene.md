# Dependency Hygiene

## Verification

- Before suggesting code that uses a library, check `package.json`, `requirements.txt`, or `go.mod` to confirm it is a project dependency.
- If a library is missing, check if an existing dependency provides similar functionality before adding a new one.

## Cleanup

- **Dead Dependencies**: If you refactor code and remove the last usage of a library, proactively remove it from the dependency manifest.
- **Virtual Environments**: For Python scripts, ensure they are compatible with a standard virtual environment to avoid "break-system-packages" errors.
