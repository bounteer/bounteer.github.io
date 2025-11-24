# Security Issues and TODOs

This document outlines security vulnerabilities and issues found in the Bounteer codebase that need to be addressed before deploying to production.

## CRITICAL SECURITY ISSUES

### 1. Hardcoded API Keys in Source Code

**Severity**: CRITICAL
**Location**: `src/constant.ts:4`

```typescript
directus_key: "9Qfz6A4s0RjzSPLLIR0yT7NTptiPfTGQ", // guest account
```

**Issue**: The Directus API key is hardcoded directly in the source code and committed to the public GitHub repository. This key is exposed to anyone who can view the repository.

**Impact**:
- Attackers can use this key to make unauthorized API requests to your Directus instance
- Even though labeled as "guest account", this provides access to your backend
- Key is used throughout the codebase for Bearer token authentication
- Found in 10+ locations across the codebase

**Files using this key**:
- `src/lib/utils.ts:321`
- `src/components/interactive/JobDescriptionCard.tsx:74`
- `src/components/interactive/OrbitCallDashboard.tsx:305,752`
- `src/components/interactive/ReportCard.tsx:177,188,255`
- `src/scripts/cvUploader.js:47,59,101`

**Solution**:
- [ ] Move API key to environment variables
- [ ] Create `.env` file (add to `.gitignore`)
- [ ] Use `import.meta.env.PUBLIC_DIRECTUS_KEY` or similar for client-side
- [ ] Use `import.meta.env.DIRECTUS_KEY` for server-side only
- [ ] Rotate the current API key immediately (it's already compromised)
- [ ] Set up proper Directus permissions to limit guest account access
- [ ] Consider using Directus public roles instead of a guest token

---

### 2. Guest User ID Exposed

**Severity**: HIGH
**Location**: `src/constant.ts:5`

```typescript
guest_user_id: "f25f8ce7-e4c9-40b8-ab65-40cde3409f27", // guest user id
```

**Issue**: The guest user UUID is hardcoded in source code.

**Impact**:
- Attackers know which user ID represents guest users
- Could be used to bypass authentication checks or forge guest requests
- May enable privilege escalation if not properly secured in Directus

**Solution**:
- [ ] Move to environment variable
- [ ] Review Directus permissions for the guest user
- [ ] Ensure guest user has minimal read-only permissions
- [ ] Consider if guest user is even necessary

---

### 3. XSS Vulnerability in Cover Letter Card

**Severity**: HIGH
**Location**: `src/components/interactive/CoverLetterCard.tsx:58-62`

```typescript
tempDiv.innerHTML = `
  <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px;">
    <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Cover Letter</h1>
  </div>
  <div style="white-space: pre-wrap; text-align: justify;">${editableCoverLetter}</div>
`;
```

**Issue**: User-provided content (`editableCoverLetter`) is directly interpolated into `innerHTML` without sanitization.

**Impact**:
- Cross-Site Scripting (XSS) attack vector
- Attackers can inject malicious JavaScript
- Could steal user data, cookies, or session tokens
- Could redirect users to phishing sites

**Solution**:
- [ ] Sanitize HTML content using a library like DOMPurify
- [ ] Use `textContent` instead of `innerHTML` if HTML formatting isn't needed
- [ ] Implement Content Security Policy (CSP) headers
- [ ] Review other uses of `innerHTML` in codebase:
  - `src/components/interactive/MagicGlowEffect.tsx`
  - `src/components/interactive/RainbowGlowWrapper.tsx`
  - `src/pages/unsubscribe.astro`

---

## MEDIUM SECURITY ISSUES

### 4. Placeholder Webhook URL

**Severity**: MEDIUM
**Location**: `src/constant.ts:8`

```typescript
webhook_url: "https://webhook.site/your-webhook-endpoint" // Replace with actual webhook endpoint
```

**Issue**: Placeholder webhook URL is checked into source code.

**Impact**:
- If not replaced, webhooks will fail silently or leak data to webhook.site
- Webhook.site is a public service where anyone can view requests
- Sensitive job description data could be exposed

**Solution**:
- [ ] Move webhook URL to environment variable
- [ ] Set up actual webhook endpoint
- [ ] Add validation to ensure webhook URL is properly configured
- [ ] Consider webhook authentication/signing

---

### 5. Missing Environment Variable Configuration

**Severity**: MEDIUM
**Location**: Project-wide

**Issue**: No environment variables are used. All configuration is hardcoded in `src/constant.ts`.

**Impact**:
- Cannot have different configs for dev/staging/production
- Secrets are exposed in git history forever
- Makes it difficult to rotate keys or update endpoints

**Current hardcoded values**:
- `directus_url`: Should support different environments
- `directus_key`: MUST be in environment variables
- `guest_user_id`: Should be in environment variables
- `auth_idp_key`: Could be environment-specific
- `auth_idp_logput_url`: Could be environment-specific
- `webhook_url`: MUST be in environment variables
- `onboarding_form_url`: Could be environment-specific

**Solution**:
- [ ] Create `.env.example` file with all required variables
- [ ] Add `.env` to `.gitignore` (already missing)
- [ ] Update Astro config to load environment variables
- [ ] Refactor `src/constant.ts` to use `import.meta.env.*`
- [ ] Update deployment workflows to inject environment variables
- [ ] Document all required environment variables in README

Example `.env.example`:
```env
# Directus Configuration
PUBLIC_DIRECTUS_URL=https://directus.bounteer.com
DIRECTUS_GUEST_TOKEN=your-guest-token-here
DIRECTUS_GUEST_USER_ID=your-guest-user-id

# Authentication
PUBLIC_AUTH_IDP_KEY=logto
PUBLIC_AUTH_LOGOUT_URL=https://logto-app.bounteer.com/oidc/session/end

# Integrations
WEBHOOK_URL=https://your-webhook-endpoint.com
PUBLIC_ONBOARDING_FORM_URL=https://form.typeform.com/to/FOz4fXGm
```

---

### 6. Contact Form Without Authentication

**Severity**: MEDIUM
**Location**: `src/components/interactive/ContactForm.tsx:41-45`

```typescript
const res = await fetch(`${EXTERNAL.directus_url}/items/message`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(values),
});
```

**Issue**: Contact form submissions don't include authentication headers, relying on Directus being openly accessible for POST requests to `/items/message`.

**Impact**:
- If Directus permissions aren't configured correctly, anyone can spam the message collection
- No rate limiting on form submissions
- Could be used for DoS attacks
- Spam/bot submissions aren't prevented

**Solution**:
- [ ] Review Directus permissions for `message` collection
- [ ] Implement rate limiting (client-side and server-side)
- [ ] Add CAPTCHA or similar bot protection
- [ ] Consider using the guest token for this endpoint
- [ ] Add input validation on server-side (Directus)
- [ ] Set up webhook notifications for new messages

---

### 7. Authorization Header Exposure in Client-Side Code

**Severity**: MEDIUM
**Location**: Multiple files (see list below)

**Issue**: Authorization headers with Bearer tokens are used extensively in client-side code.

**Affected files**:
- `src/components/interactive/JobDescriptionCard.tsx:74`
- `src/components/interactive/OrbitCallDashboard.tsx:305,752`
- `src/components/interactive/ReportCard.tsx:177,188`
- `src/scripts/cvUploader.js:47,59,101`

**Impact**:
- API keys visible in browser DevTools Network tab
- Can be extracted and reused by attackers
- Guest token has whatever permissions assigned to it

**Solution**:
- [ ] Minimize use of guest token in client-side code
- [ ] Rely on user session cookies for authenticated requests where possible
- [ ] For public data, use Directus public role instead of guest token
- [ ] Implement server-side proxy for sensitive operations
- [ ] Review and minimize permissions on guest account

---

## LOW SECURITY ISSUES

### 8. TODO Comment About Authentication

**Severity**: LOW
**Location**: `src/lib/utils.ts:316`

```typescript
// TODO check if we are ussing the logged in user's session or a generic guest token
```

**Issue**: Uncertainty about authentication mechanism.

**Solution**:
- [ ] Review and document authentication flow
- [ ] Clarify when session cookies vs guest token should be used
- [ ] Update code comments with clear explanation

---

### 9. Missing .env File Configuration

**Severity**: LOW
**Location**: `.gitignore:1-5`

**Issue**: `.gitignore` doesn't explicitly include `.env*` files (though no .env files currently exist).

**Current .gitignore**:
```
/.astro
/node_modules
.DS_Store
/dist
```

**Solution**:
- [ ] Add `.env` and `.env.*` to `.gitignore`
- [ ] Add `*.env.local` pattern
- [ ] Ensure `.env.example` is NOT ignored

---

## RECOMMENDATIONS

### Immediate Actions Required

1. **IMMEDIATELY** - Rotate the exposed Directus API key (`9Qfz6A4s0RjzSPLLIR0yT7NTptiPfTGQ`)
2. **IMMEDIATELY** - Remove the hardcoded key from `src/constant.ts`
3. **IMMEDIATELY** - Set up environment variables for all secrets
4. **IMMEDIATELY** - Update `.gitignore` to include `.env*`
5. **IMMEDIATELY** - Fix XSS vulnerability in CoverLetterCard.tsx

### Short-term Actions

6. Review Directus permissions and minimize guest account access
7. Implement HTML sanitization across the codebase
8. Set up proper webhook endpoint and authentication
9. Add rate limiting to public forms
10. Implement Content Security Policy headers

### Long-term Improvements

11. Set up security scanning in CI/CD pipeline
12. Implement API request monitoring and alerting
13. Add security headers (CSP, X-Frame-Options, etc.)
14. Regular security audits of dependencies
15. Implement proper logging and audit trails
16. Consider Web Application Firewall (WAF)
17. Set up vulnerability disclosure policy

---

## Additional Security Checks Needed

- [ ] Review all Directus role permissions
- [ ] Audit Directus access logs for suspicious activity
- [ ] Check if the exposed API key has been used by unauthorized parties
- [ ] Review CORS configuration on Directus
- [ ] Ensure HTTPS is enforced everywhere
- [ ] Check for SQL injection vulnerabilities in custom Directus flows/hooks
- [ ] Review file upload security (size limits, file type validation)
- [ ] Ensure proper session management and timeout settings
- [ ] Check for CSRF protection on state-changing operations

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Astro Environment Variables](https://docs.astro.build/en/guides/environment-variables/)
- [Directus Access Control](https://docs.directus.io/configuration/security.html)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

**Last Updated**: 2025-11-24
**Audited By**: Claude Code Security Audit
