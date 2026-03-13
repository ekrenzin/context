```markdown
---
name: security-audit
description: Comprehensive security audit workflow for code reviews with interactive checklist tracking
triggers:
  - security review required
  - code audit needed
  - vulnerability assessment
  - compliance check
  - pre-deployment security scan
related_skills:
  - code-review
  - vulnerability-scan
  - compliance-check
  - penetration-test
---

# Security Audit

## When to Use

- Before production deployments
- During code review processes
- After security incidents
- For compliance requirements
- When integrating third-party dependencies
- During architecture changes

## Workflow

1. **Initialize Audit Scope**
   - Define audit boundaries and components
   - Identify critical assets and data flows
   - Set security requirements and standards

2. **Authentication & Authorization Review**
   - Verify authentication mechanisms
   - Check authorization controls
   - Validate session management
   - Review access control matrices

3. **Input Validation Analysis**
   - Check all input sanitization
   - Verify parameter validation
   - Test injection vulnerability points
   - Review file upload security

4. **Data Protection Assessment**
   - Verify encryption at rest and transit
   - Check sensitive data handling
   - Review data retention policies
   - Validate PII protection measures

5. **Infrastructure Security Check**
   - Review server configurations
   - Check network security settings
   - Validate container security
   - Assess cloud security posture

6. **Dependency Vulnerability Scan**
   - Scan third-party libraries
   - Check for known vulnerabilities
   - Review dependency licenses
   - Validate update policies

7. **Code Quality Security Review**
   - Check for hardcoded secrets
   - Review error handling
   - Validate logging practices
   - Assess code complexity risks

8. **Generate Audit Report**
   - Document findings and severity
   - Provide remediation recommendations
   - Create executive summary
   - Track remediation progress

## Validation

- All critical vulnerabilities identified and categorized
- Security checklist items completed with evidence
- Remediation plan created with timelines
- Audit report approved by security team
- Compliance requirements verified and documented
```