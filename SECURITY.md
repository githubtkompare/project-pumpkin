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

## Network Security

### Docker Network Isolation

Project Pumpkin uses a private Docker network for container communication:

```yaml
# docker-compose.yml
networks:
  playwright-network:
    driver: bridge
```

**Security benefits:**
- ✅ Containers isolated from host network
- ✅ Inter-container communication controlled
- ✅ External access limited to exposed ports only

### Port Exposure

**Default exposed ports:**

| Port | Service | Risk Level | Recommendation |
|------|---------|------------|----------------|
| 5432 | PostgreSQL | 🔴 High | Bind to localhost only in production |
| 3000 | Web App | 🟡 Medium | Use reverse proxy with HTTPS |

#### Secure Port Configuration

**Development (current):**
```yaml
ports:
  - "5432:5432"  # PostgreSQL accessible from host
  - "3000:3000"  # App accessible from host
```

**Production (recommended):**
```yaml
postgres:
  ports:
    - "127.0.0.1:5432:5432"  # Bind to localhost only
  # Or remove ports entirely for maximum isolation

app:
  # Don't expose directly, use reverse proxy
  expose:
    - "3000"
```

### Firewall Configuration

**Linux (ufw):**
```bash
# Allow only SSH and HTTPS
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow https
sudo ufw enable

# If you must expose database (NOT recommended)
sudo ufw allow from 192.168.1.0/24 to any port 5432
```

**Docker and Firewall:**

⚠️ Docker bypasses ufw rules by default! To fix:

```bash
# /etc/ufw/after.rules - Add at the end
*filter
:DOCKER-USER - [0:0]
:ufw-user-input - [0:0]

-A DOCKER-USER -j ufw-user-input
-A DOCKER-USER -j RETURN
COMMIT
```

### Network Access Control

**Production network security:**

1. **Use VPC/Private Network** (cloud deployments)
   - Isolate database in private subnet
   - Only app server can access database
   - App server behind load balancer

2. **VPN Access** (on-premise)
   - Require VPN connection for database access
   - Limit dashboard access to VPN users

3. **Bastion Host** (SSH tunneling)
   ```bash
   # Access database through bastion host
   ssh -L 5432:postgres-host:5432 user@bastion-host
   psql -h localhost -U pumpkin -d playwright_metrics
   ```

### Docker Container Security

**Run containers as non-root user:**

```dockerfile
# Dockerfile
FROM mcr.microsoft.com/playwright:v1.48.2-jammy

# Create non-root user
RUN groupadd -r pumpkin && useradd -r -g pumpkin pumpkin

# Set ownership
WORKDIR /app
COPY --chown=pumpkin:pumpkin . .

# Switch to non-root user
USER pumpkin
```

**Read-only root filesystem:**

```yaml
# docker-compose.yml
services:
  app:
    read_only: true
    tmpfs:
      - /tmp
      - /var/tmp
```

**Limit container resources:**

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

**Enable Docker security scanning:**

```bash
# Scan for vulnerabilities
docker scan project-pumpkin:latest

# Or use Trivy
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image project-pumpkin:latest
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

## Web Application Security

### Current Security Status

**⚠️ Important:** Project Pumpkin is designed for **internal/trusted network use**. The web application currently has:

- ❌ **No authentication** - Dashboard and API are publicly accessible
- ❌ **No authorization** - All users have full read access to all data
- ❌ **No rate limiting** - API endpoints are not rate-limited
- ❌ **No CORS restrictions** - Cross-origin requests are not controlled
- ❌ **No security headers** - Missing helmet.js or equivalent
- ✅ **Parameterized queries** - SQL injection protection via pg library
- ✅ **Input validation** - Basic type checking on query parameters

### Production Web Security Checklist

For production deployments, implement these security measures:

#### 1. Add Authentication

```javascript
// Example: Basic auth middleware
import basicAuth from 'express-basic-auth';

app.use(basicAuth({
  users: { 'admin': process.env.ADMIN_PASSWORD },
  challenge: true,
  realm: 'Project Pumpkin'
}));
```

**Better options:**
- OAuth2/OIDC (Google, GitHub, Okta)
- SAML for enterprise SSO
- API keys for programmatic access

#### 2. Add Rate Limiting

```bash
npm install express-rate-limit
```

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

#### 3. Add Security Headers

```bash
npm install helmet
```

```javascript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"]
    }
  }
}));
```

#### 4. Configure CORS

```bash
npm install cors
```

```javascript
import cors from 'cors';

app.use(cors({
  origin: 'https://your-domain.com',
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

#### 5. Secure File Serving

**Current risk:** `/test-history` serves all screenshots and HAR files publicly.

**Mitigation:**

```javascript
// Add authentication check before serving files
app.use('/test-history', authMiddleware, express.static('test-history'));

// Or serve files through API with access control
app.get('/api/files/:testId/:filename', async (req, res) => {
  // Validate user has access to this test
  // Sanitize filename to prevent directory traversal
  // Serve file with appropriate headers
});
```

#### 6. Input Validation

Add comprehensive input validation:

```bash
npm install joi
```

```javascript
import Joi from 'joi';

const querySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(1000),
  timezone: Joi.string().pattern(/^[A-Za-z_]+\/[A-Za-z_]+$/),
  id: Joi.number().integer().positive()
});

// Use in routes
const { error, value } = querySchema.validate(req.query);
if (error) return res.status(400).json({ error: error.details[0].message });
```

#### 7. API Security Best Practices

- ✅ Use HTTPS only in production (see reverse proxy section)
- ✅ Validate all inputs (query params, path params, body)
- ✅ Sanitize outputs to prevent XSS
- ✅ Set appropriate cache headers
- ✅ Implement request logging for audit trail
- ✅ Add request ID tracing
- ✅ Implement proper error handling (don't leak stack traces)

### Data Exposure Risks

**Screenshots and HAR files may contain:**
- Session tokens and cookies
- API keys in URLs or headers
- Personal information visible on pages
- Internal network details
- Authentication credentials

**Mitigations:**
1. Review test data before storing
2. Redact sensitive information from HAR files
3. Implement access controls on test-history
4. Use short retention periods for test artifacts
5. Encrypt sensitive test data at rest

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

## Dependency Security

### Current Dependencies

Project Pumpkin uses minimal dependencies to reduce attack surface:

**Production dependencies:**
- `express` - Web framework
- `pg` - PostgreSQL client

**Development dependencies:**
- `@playwright/test` - Browser testing
- `markdownlint-cli` - Markdown linting

### Vulnerability Scanning

**Check for vulnerable packages:**

```bash
# Run npm audit
npm audit

# View detailed report
npm audit --json

# Fix vulnerabilities automatically
npm audit fix

# Fix including breaking changes
npm audit fix --force
```

**Example output:**
```text
found 0 vulnerabilities in 150 scanned packages
```

**Set up automated scanning:**

```bash
# Add to package.json scripts
"scripts": {
  "security:audit": "npm audit",
  "security:check": "npm audit --audit-level=moderate"
}

# Run before commits
npm run security:check
```

### GitHub Security Features

**Enable Dependabot:**

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
      - "security"
```

**Enable vulnerability alerts:**
- Go to Settings → Security & analysis
- Enable "Dependency graph"
- Enable "Dependabot alerts"
- Enable "Dependabot security updates"

### Container Image Security

**Scan Docker images:**

```bash
# Using Docker Scout
docker scout cves project-pumpkin:latest

# Using Trivy (comprehensive)
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image --severity HIGH,CRITICAL \
  project-pumpkin:latest

# Using Snyk
snyk container test project-pumpkin:latest
```

**Update base images regularly:**

```dockerfile
# Use specific version tags, not 'latest'
FROM mcr.microsoft.com/playwright:v1.48.2-jammy

# Check for updates monthly
# https://github.com/microsoft/playwright/releases
```

### Supply Chain Security

**Verify package integrity:**

```bash
# Check package lock file
npm ci  # Use in CI/CD instead of npm install

# Verify package signatures
npm config set audit true
npm config set fund false
```

**Review new dependencies before adding:**

```bash
# Check package info
npm view <package-name>

# Check download stats (popularity indicator)
npm view <package-name> downloads

# Review on npm
open https://www.npmjs.com/package/<package-name>

# Check GitHub repo
# - Last commit date
# - Number of contributors
# - Open issues
# - Security policy
```

### Dependency Update Policy

**Update strategy:**

1. **Security patches** - Apply immediately
   ```bash
   npm audit fix
   ```

2. **Minor versions** - Weekly review
   ```bash
   npm outdated
   npm update
   ```

3. **Major versions** - Monthly review
   ```bash
   npx npm-check-updates
   # Review breaking changes before updating
   npx npm-check-updates -u
   npm install
   npm test  # Ensure nothing breaks
   ```

4. **Playwright updates** - Follow official releases
   - Review changelog
   - Test in development first
   - Update Dockerfile version

## Data Privacy & Retention

### Sensitive Data in Test Results

**Test artifacts may contain sensitive information:**

| Artifact | Potential Data Exposure |
|----------|------------------------|
| Screenshots | PII, credentials visible on page, session info |
| HAR files | Cookies, auth tokens, API keys in URLs/headers |
| Database | All URLs tested, timestamps, patterns |
| Report files | Aggregate data may reveal internal systems |

### Data Minimization

**Reduce sensitive data collection:**

```javascript
// Redact sensitive headers in HAR files
const redactedHeaders = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token'
];

// Remove from HAR before storage
function redactHAR(harContent) {
  // Implementation to remove sensitive headers
}
```

### Data Retention Policy

**Recommended retention periods:**

```sql
-- Keep detailed test data for 30 days
DELETE FROM url_tests
WHERE test_timestamp < NOW() - INTERVAL '30 days';

-- Keep summary data for 1 year
-- (aggregate to daily averages, delete detailed records)

-- Archive historical trends beyond 1 year
```

**Automated cleanup:**

```bash
# Add to crontab
0 2 * * 0 cd /path/to/project && npm run db:cleanup

# Or create systemd timer
# /etc/systemd/system/pumpkin-cleanup.timer
```

### GDPR/Privacy Compliance

**If testing sites with EU visitors:**

1. **Data Subject Access Requests**
   - Ability to search and export specific user data
   - Ability to delete specific user data

2. **Data Processing Agreement**
   - Document what data is collected
   - Document retention period
   - Document access controls

3. **Privacy by Design**
   - Minimize data collection
   - Encrypt at rest and in transit
   - Regular data purges

### Data Encryption

**Encrypt test-history volume:**

```bash
# Linux: LUKS encrypted volume
cryptsetup luksFormat /dev/sdb1
cryptsetup open /dev/sdb1 pumpkin-data
mkfs.ext4 /dev/mapper/pumpkin-data
mount /dev/mapper/pumpkin-data /var/lib/docker/volumes/pumpkin_test-history
```

**Encrypt database backups:**

```bash
# Backup with encryption
docker exec project-pumpkin-db pg_dump -U pumpkin playwright_metrics | \
  gpg --encrypt --recipient admin@example.com > backup.sql.gpg

# Restore encrypted backup
gpg --decrypt backup.sql.gpg | \
  docker exec -i project-pumpkin-db psql -U pumpkin -d playwright_metrics
```

## Backup Security

### Secure Backup Strategy

**Backup schedule:**
- Daily: Incremental backups
- Weekly: Full backups
- Monthly: Archive backups (long-term retention)

**3-2-1 Backup Rule:**
- **3** copies of data
- **2** different storage types
- **1** offsite backup

### Encrypted Backups

**Using GPG encryption:**

```bash
# Generate GPG key for backups
gpg --gen-key

# Backup with encryption
docker exec project-pumpkin-db pg_dump -U pumpkin playwright_metrics | \
  gzip | \
  gpg --encrypt --recipient backup@example.com \
  > backup-$(date +%Y%m%d).sql.gz.gpg

# Verify backup
gpg --decrypt backup-20250105.sql.gz.gpg | gunzip | head -n 10
```

**Using openssl encryption:**

```bash
# Backup with AES-256 encryption
docker exec project-pumpkin-db pg_dump -U pumpkin playwright_metrics | \
  gzip | \
  openssl enc -aes-256-cbc -salt -pbkdf2 \
  -out backup-$(date +%Y%m%d).sql.gz.enc

# Restore
openssl enc -aes-256-cbc -d -pbkdf2 -in backup-20250105.sql.gz.enc | \
  gunzip | \
  docker exec -i project-pumpkin-db psql -U pumpkin -d playwright_metrics
```

### Backup Storage Security

**Cloud storage with encryption:**

```bash
# AWS S3 with server-side encryption
aws s3 cp backup.sql.gpg s3://pumpkin-backups/ \
  --sse AES256 \
  --storage-class STANDARD_IA

# With lifecycle policy for automatic deletion
aws s3api put-bucket-lifecycle-configuration \
  --bucket pumpkin-backups \
  --lifecycle-configuration file://lifecycle.json
```

**Backup verification:**

```bash
# Test restore monthly
docker exec -i project-pumpkin-db \
  psql -U pumpkin -d playwright_metrics_test < backup.sql

# Compare row counts
docker exec project-pumpkin-db psql -U pumpkin -d playwright_metrics \
  -c "SELECT COUNT(*) FROM url_tests;"
```

### Backup Access Control

**Restrict backup access:**

```bash
# Set restrictive permissions
chmod 600 backup-*.sql.gpg
chown backup-user:backup-group backup-*.sql.gpg

# Store in secure directory
mkdir -p /var/backups/pumpkin
chmod 700 /var/backups/pumpkin
```

**Audit backup access:**

```bash
# Log all backup operations
exec >> /var/log/pumpkin-backup.log 2>&1
echo "$(date): Starting backup"
# ... backup commands ...
echo "$(date): Backup completed"
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

## Production Reverse Proxy Configuration

**⚠️ Never expose the Node.js application directly to the internet!**

Always use a reverse proxy to terminate HTTPS, add security headers, rate limit, and protect your application.

### Option 1: Nginx with Let's Encrypt

**Install nginx:**
```bash
sudo apt update && sudo apt install nginx certbot python3-certbot-nginx
```

**Configure** `/etc/nginx/sites-available/pumpkin`:

```nginx
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name pumpkin.example.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name pumpkin.example.com;

    # SSL (managed by certbot)
    ssl_certificate /etc/letsencrypt/live/pumpkin.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pumpkin.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=pumpkin:10m rate=10r/s;
    limit_req zone=pumpkin burst=20 nodelay;

    # Proxy to app
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Block sensitive files
    location ~ /\. { deny all; }
    location ~ \.(env|sql|log)$ { deny all; }
}
```

**Enable and get SSL:**
```bash
sudo ln -s /etc/nginx/sites-available/pumpkin /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d pumpkin.example.com
```

### Option 2: Caddy (Automatic HTTPS)

**Install Caddy:**
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

**Configure** `/etc/caddy/Caddyfile`:

```caddyfile
pumpkin.example.com {
    # Automatic HTTPS
    header Strict-Transport-Security "max-age=31536000; includeSubDomains"
    header X-Frame-Options "SAMEORIGIN"
    header X-Content-Type-Options "nosniff"

    reverse_proxy localhost:3000
}
```

**Reload:**
```bash
sudo systemctl reload caddy
```

### Option 3: Traefik with Docker

Add to your `docker-compose.yml`:

```yaml
services:
  traefik:
    image: traefik:v2.10
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.le.acme.email=admin@example.com"
      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.le.acme.tlschallenge=true"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik-certs:/letsencrypt

  app:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.pumpkin.rule=Host(`pumpkin.example.com`)"
      - "traefik.http.routers.pumpkin.tls.certresolver=le"
      - "traefik.http.middlewares.pumpkin-headers.headers.stsSeconds=31536000"
      - "traefik.http.routers.pumpkin.middlewares=pumpkin-headers"

volumes:
  traefik-certs:
```

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
- [ ] Reverse proxy configured (nginx/Caddy/Traefik)
- [ ] HTTPS with automatic renewal (Let's Encrypt)
- [ ] Authentication added to dashboard/API
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Container vulnerability scanning enabled
- [ ] Non-root users in containers
- [ ] Resource limits set on containers

### Code Review
- [ ] No secrets in commit history
- [ ] No console.log of sensitive data
- [ ] SQL injection prevention (parameterized queries)
- [ ] Input validation on all user data
- [ ] Rate limiting on APIs
- [ ] HTTPS enforced in production
- [ ] XSS prevention (output encoding)
- [ ] CSRF protection if forms added
- [ ] Secure file upload handling

## Production Reverse Proxy Setup

See detailed reverse proxy configurations earlier in this document for:
- **Nginx with Let's Encrypt** - Full configuration with SSL, security headers, rate limiting
- **Caddy with automatic HTTPS** - Simplified config with auto-SSL
- **Traefik with Docker** - Container-native reverse proxy with Docker labels

**Quick Nginx setup:**
```bash
# Install
sudo apt install nginx certbot python3-certbot-nginx

# Configure (see full config in "Production Deployment with Reverse Proxy" section above)
sudo nano /etc/nginx/sites-available/pumpkin

# Enable and test
sudo ln -s /etc/nginx/sites-available/pumpkin /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d pumpkin.example.com
```

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
