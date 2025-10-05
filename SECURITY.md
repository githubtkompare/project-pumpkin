# Security Guidelines

This document outlines security best practices for Project Pumpkin.

## Credentials Management

### ⚠️ NEVER Commit Secrets to Git

**Protected files** (already in `.gitignore`):
- `.env` - Contains actual passwords and secrets
- `.env.local`, `.env.*.local` - Local environment overrides

**Safe to commit**:
- `.env.example` - Template with placeholder values only

### Environment Variables Setup

**First Time Setup:**

1. Copy the template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set a strong password:
   ```bash
   # Change this to a strong, unique password
   POSTGRES_PASSWORD=your_secure_password_here
   ```

3. Verify `.env` is in `.gitignore`:
   ```bash
   git check-ignore .env
   # Should output: .env
   ```

### Password Requirements

**Development:**
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- Don't reuse passwords from other projects

**Production:**
- Minimum 16 characters
- Generated randomly (use password manager)
- Rotated every 90 days
- Never shared via email/chat

### Example Strong Passwords

```bash
# Good examples (randomly generated)
MyP@ssw0rd!2025Dev
Tr0pic@lFish#Blue99
S3cur3*Pumpkin$Test

# Bad examples (too simple)
password123         # Too common
pumpkin             # Too short
123456789           # Only numbers
```

## Docker Security

### Development Environment

**Current setup (good for local development):**
- Database credentials in `.env` file
- Docker Compose reads from `.env` automatically
- Containers communicate via private network
- Database port exposed only to localhost

**What's protected:**
- ✅ `.env` file excluded from Git
- ✅ Containers isolated in private network
- ✅ Environment variables not visible in `docker ps`

### Production Deployment

**⚠️ DO NOT use `.env` files in production!**

Instead, use one of these secure methods:

#### Option 1: Docker Secrets (Swarm)

```yaml
# docker-compose.prod.yml
services:
  postgres:
    environment:
      - POSTGRES_PASSWORD_FILE=/run/secrets/db_password
    secrets:
      - db_password

secrets:
  db_password:
    external: true
```

```bash
# Create secret
echo "your-secret-password" | docker secret create db_password -

# Deploy stack
docker stack deploy -c docker-compose.prod.yml pumpkin
```

#### Option 2: Cloud Secrets Manager

**AWS Secrets Manager:**
```bash
# Store secret
aws secretsmanager create-secret \
  --name pumpkin/db/password \
  --secret-string "your-secret-password"

# Retrieve in application
aws secretsmanager get-secret-value \
  --secret-id pumpkin/db/password \
  --query SecretString --output text
```

**Google Cloud Secret Manager:**
```bash
# Store secret
echo -n "your-secret-password" | \
  gcloud secrets create pumpkin-db-password --data-file=-

# Access in application
gcloud secrets versions access latest \
  --secret=pumpkin-db-password
```

#### Option 3: Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: pumpkin-db-credentials
type: Opaque
data:
  password: <base64-encoded-password>
---
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: app
    env:
    - name: POSTGRES_PASSWORD
      valueFrom:
        secretKeyRef:
          name: pumpkin-db-credentials
          key: password
```

## Database Security

### Connection Security

**Development:**
- ✅ Database exposed only to `localhost:5432`
- ✅ No external network access
- ✅ Passwords in `.env` file (gitignored)

**Production checklist:**
- [ ] Enable SSL/TLS for all connections
- [ ] Use certificate-based authentication
- [ ] Restrict network access (firewall, VPC)
- [ ] Enable audit logging
- [ ] Regular security updates
- [ ] Automated backups with encryption

### PostgreSQL Hardening

**Enable SSL (production):**

```sql
-- In postgresql.conf
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'
```

**Connection string with SSL:**
```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

**Create read-only user (for reports):**

```sql
-- Create read-only user
CREATE USER reporter WITH PASSWORD 'strong-password';

-- Grant read-only access
GRANT CONNECT ON DATABASE playwright_metrics TO reporter;
GRANT USAGE ON SCHEMA public TO reporter;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO reporter;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO reporter;
```

## Git Security

### Check for Exposed Secrets

**Before committing:**

```bash
# Check what's being committed
git diff --cached

# Verify .env is ignored
git status --ignored

# Search for potential secrets
git grep -i "password\|secret\|key" -- ':!SECURITY.md' ':!.env.example'
```

### If You Accidentally Commit a Secret

**⚠️ Act immediately if real credentials were committed:**

1. **Rotate the exposed credential** (change password immediately)
2. **Remove from Git history:**

```bash
# Option A: Use BFG Repo-Cleaner (recommended)
brew install bfg  # macOS
bfg --replace-text passwords.txt  # File with strings to remove
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Option B: Use git filter-branch
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/secret/file" \
  --prune-empty --tag-name-filter cat -- --all
```

3. **Force push** (⚠️ destructive - coordinate with team):

```bash
git push origin --force --all
git push origin --force --tags
```

4. **Notify team members** to re-clone the repository

## Application Security

### Environment Variable Validation

The application enforces required environment variables:

```javascript
// src/database/client.js
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}
```

**This prevents:**
- Running with default/weak passwords
- Accidental production deployment without secrets
- Silent failures due to missing configuration

### Secure Coding Practices

**✅ Good:**
```javascript
// Read from environment
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL required');
```

**❌ Bad:**
```javascript
// Hardcoded credentials
const dbUrl = 'postgresql://user:password@host/db';
```

## Continuous Security

### Regular Security Audits

```bash
# Check for vulnerable npm packages
npm audit

# Fix vulnerabilities automatically
npm audit fix

# Check Docker image vulnerabilities
docker scan project-pumpkin:latest
```

### Dependency Updates

```bash
# Check for outdated packages
npm outdated

# Update dependencies
npm update

# Update major versions (check breaking changes)
npx npm-check-updates -u
npm install
```

### Security Monitoring

**Watch for:**
- Unauthorized database access attempts
- Failed login attempts (future feature)
- Unusual query patterns
- Large data exports

## Incident Response

### If Security Breach Suspected

1. **Immediately rotate all credentials**
2. **Review audit logs** (database, application, Docker)
3. **Check for unauthorized access** (query history, user activity)
4. **Assess data exposure** (what data was accessed?)
5. **Document timeline** (when did breach occur?)
6. **Update security measures** (prevent recurrence)

### Emergency Contacts

- **GitHub Security:** https://github.com/security
- **Docker Security:** https://www.docker.com/security
- **PostgreSQL Security:** https://www.postgresql.org/support/security/

## Security Checklist

### Development Setup
- [x] `.env` file in `.gitignore`
- [x] `.env.example` with placeholders only
- [x] Environment variable validation in code
- [x] No hardcoded credentials in source
- [x] Strong passwords (12+ characters)

### Production Deployment
- [ ] Secrets managed externally (not `.env`)
- [ ] SSL/TLS enabled for database
- [ ] Network access restricted (firewall/VPC)
- [ ] Regular automated backups
- [ ] Monitoring and alerting configured
- [ ] Security updates automated
- [ ] Audit logging enabled
- [ ] Incident response plan documented

### Code Review
- [ ] No secrets in commit history
- [ ] No console.log of sensitive data
- [ ] SQL injection prevention (parameterized queries)
- [ ] Input validation on all user data
- [ ] Rate limiting on APIs
- [ ] HTTPS enforced in production

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
- [Git Secrets Prevention](https://github.com/awslabs/git-secrets)
- [Node.js Security Checklist](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)

---

**Last Updated:** 2025-10-05
**Maintained By:** Project Pumpkin Team
**Questions?** Review [DATABASE.md](DATABASE.md) for database-specific security notes
