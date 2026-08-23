# ADR 0001: Auth Security and Persistence

- Status: Accepted
- Date: 2026-08-23

## Context

Authentication, Store membership and fixed-role authorization are implemented in-house in the NestJS modular monolith. PostgreSQL owns users, opaque-cookie sessions, tokens, Stores, memberships and authorization data. This ADR fixes the security, delivery and persistence choices before those modules are implemented.

## Decisions

### Passwords and compromised-password checks

- Passwords use Argon2id with a 19 MiB memory cost, 2 iterations and 1 lane. The `PasswordHasher` port accepts a plaintext password and returns a hash, and verifies a plaintext password against a hash; it does not expose algorithm details to callers.
- Passwords remain at least 12 characters. Identity rejects common passwords and checks the Have I Been Pwned Pwned Passwords API using k-anonymity (the first five SHA-1 prefix characters only). A network or provider failure fails closed for registration and password changes. The full password and full hash are never sent to or logged by the provider.

The approved port is:

```ts
interface PasswordHasher {
  hash(plainText: string): Promise<string>;
  verify(plainText: string, encodedHash: string): Promise<boolean>;
}
```

### Login protection and tokens

- After 5 failed password attempts for one normalized email and source address within the active counter window, login is locked for 15 minutes. A successful login clears the counter. The API returns a generic `401` for invalid credentials and `423` for an active temporary lockout; neither response reveals whether an account exists. Rate limiting remains `429`.
- Verification tokens expire after 24 hours. Password-reset and email-change tokens expire after 1 hour. Invitation tokens remain 7 days as defined by the approved design.
- Every token is generated with a cryptographically secure random source, stored only as a SHA-256 hash, is single-use, and is rejected after expiry, revocation or consumption. URLs and raw tokens are not logged.
- Expired or revoked sessions return `401`; authenticated Store or permission failures return `403`.

### PostgreSQL and migrations

- Application access uses the existing `pg` PostgreSQL driver with parameterized SQL, explicit transactions for multi-record mutations, and a small repository layer. No ORM is introduced for this subsystem.
- Migrations remain raw SQL files consumed by the existing migration runner. They are forward-only in normal deployment, idempotent where practical, and each migration has a paired safe down migration for controlled local/test rollback. The Phase 0 empty baseline remains unchanged.

### Email delivery

- Production uses an SMTP adapter behind the `EmailDelivery` port. The port exposes `sendVerification`, `sendPasswordReset`, `sendEmailChange` and `sendInvitation`, each accepting a typed recipient, subject/template data and a public action URL. Implementations never log URLs, tokens or credentials.
- Development and test use an in-memory adapter selected by `EMAIL_DELIVERY_MODE=memory`. It records typed message payloads in process and sends nothing. Tests assert recipient, template data and action URL through the adapter's captured messages, not through a network mock or an SMTP server. Production requires `EMAIL_DELIVERY_MODE=smtp`, `EMAIL_FROM` and a secret `SMTP_URL`.

The approved delivery contract is:

```ts
type EmailMessage = {
  recipient: string;
  actionUrl: string;
  templateData: Record<string, string>;
};

interface EmailDelivery {
  sendVerification(message: EmailMessage): Promise<void>;
  sendPasswordReset(message: EmailMessage): Promise<void>;
  sendEmailChange(message: EmailMessage): Promise<void>;
  sendInvitation(message: EmailMessage): Promise<void>;
}
```

### CSRF and cookies

- All cookie-authenticated mutations require a synchronizer double-submit token: the API sets a non-HttpOnly CSRF cookie and requires the matching `X-CSRF-Token` header. The token is bound to the session with an HMAC using `CSRF_SECRET` and compared in constant time. Safe methods do not require the header.
- Session cookies contain only an opaque identifier and are `HttpOnly`, `Path=/`, `SameSite=Lax`, and `Secure` in production. Cross-site embedding is not supported. `CSRF_SECRET` is required in production, is never included in `.env.example`, and must be supplied by the deployment secret manager.

## Configuration Contract

`packages/config` validates the lockout threshold and duration, the three token TTLs, email mode/from address, SMTP URL and production CSRF secret before NestJS starts. Local `.env.example` values select memory delivery and contain no secret. Production rejects missing, malformed or placeholder security settings.

## Consequences

This keeps the team on a small, auditable dependency surface and preserves the approved in-house PostgreSQL-session architecture. Have I Been Pwned availability becomes part of account-creation availability. SMTP and CSRF secrets belong to deployment configuration, not source control. Later tasks must implement the stated ports and raw SQL repositories without weakening these invariants.
