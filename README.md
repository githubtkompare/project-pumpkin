# Project Pumpkin 🎃

## A Docker-based web performance testing platform powered by Playwright

Project Pumpkin automates website performance testing using Playwright and
Firefox. It captures screenshots, records network activity, measures load
times, and stores all results in a PostgreSQL database. View detailed
performance reports through an interactive web dashboard.

---

## Table of Contents

1. [What is Project Pumpkin?](#what-is-project-pumpkin)
2. [What You'll Need](#what-youll-need)
3. [System Requirements](#system-requirements)
4. [Step-by-Step Installation Guide](#step-by-step-installation-guide)
5. [First-Time Setup](#first-time-setup)
6. [Starting the Application](#starting-the-application)
7. [Using the Dashboard](#using-the-dashboard)
8. [Running Website Tests](#running-website-tests)
9. [Viewing Test Results](#viewing-test-results)
10. [Stopping the Application](#stopping-the-application)
11. [Troubleshooting](#troubleshooting)
12. [What's Next?](#whats-next)
13. [Getting Help](#getting-help)

---

## What is Project Pumpkin?

Project Pumpkin is a **self-contained web performance testing system** that:

✅ **Tests websites** - Automatically visits URLs and measures performance
✅ **Captures evidence** - Takes full-page screenshots and records all network traffic
✅ **Measures everything** - DNS lookup, page load time, resource counts, HTTP errors
✅ **Stores history** - Keeps all test results in a database for trend analysis
✅ **Provides reports** - Interactive web dashboard with charts and comparisons

**Use cases:**

- Monitor website performance over time
- Detect broken pages (404 errors, slow loads)
- Compare performance across multiple domains
- Generate performance reports for stakeholders

---

## What You'll Need

Before starting, you need these programs installed on your server:

### Required Software

| Software | Minimum Version | Purpose | Installation Link |
|----------|----------------|---------|------------------|
| **Git** | 2.0+ | Download the project code | [git-scm.com](https://git-scm.com/downloads) |
| **Docker** | 20.10+ | Run the application containers | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |
| **Docker Compose** | 2.0+ | Manage multiple containers | Usually included with Docker Desktop |
| **Text Editor** | Any | Edit configuration files | nano, vim, VS Code, or Notepad++ |

### How to Check If Software Is Installed

Open a terminal (command line) and run these commands:

```bash
# Check Git
git --version
# Should show: git version 2.x.x or higher

# Check Docker
docker --version
# Should show: Docker version 20.10.x or higher

# Check Docker Compose
docker-compose --version
# Should show: Docker Compose version 2.x.x or higher
```

**If any command fails** (says "command not found"), you need to install that software first.

---

## System Requirements

### Recommended Operating Systems

✅ **Best choice:** Ubuntu Linux 20.04+ or macOS 12+
✅ **Also works:** Windows 10/11 with WSL2 (Windows Subsystem for Linux)
✅ **Server:** Any Linux distribution with Docker support

### Hardware Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **CPU** | 2 cores | 4+ cores (for parallel testing) |
| **RAM** | 4 GB | 8+ GB |
| **Disk Space** | 5 GB | 20+ GB (for test history) |
| **Network** | Any | Stable internet connection |

**Why these specs?**

- Playwright runs a full Firefox browser (needs RAM)
- Screenshots and network logs accumulate over time (needs disk space)
- Parallel testing runs multiple tests at once (benefits from more CPU cores)

---

## Step-by-Step Installation Guide

### Step 1: Choose a Directory

First, decide where you want to install Project Pumpkin on your server.

**Good choices:**

- `/home/yourusername/projects/` (Linux/macOS)
- `C:\Users\yourusername\Documents\` (Windows)

Open a terminal and navigate to your chosen directory:

```bash
# Example for Linux/macOS:
cd ~
mkdir -p projects
cd projects

# Example for Windows (in PowerShell):
cd C:\Users\yourusername\Documents\
mkdir projects
cd projects
```

### Step 2: Download the Project

Clone the Project Pumpkin repository from GitHub:

```bash
git clone https://github.com/yourusername/project-pumpkin.git
```

**What this does:** Downloads all the project files to your computer.

**You should see:**

```text
Cloning into 'project-pumpkin'...
remote: Enumerating objects: 150, done.
remote: Counting objects: 100% (150/150), done.
...
```

### Step 3: Enter the Project Directory

Move into the newly created project folder:

```bash
cd project-pumpkin
```

### Step 4: Verify the Files

Check that all files were downloaded correctly:

```bash
ls -la
```

**You should see these important files:**

- `docker-compose.yml` - Defines the containers
- `.env.example` - Template for environment variables
- `Dockerfile` - Instructions for building the Docker image
- `package.json` - Node.js dependencies
- `src/` - Application source code
- `tests/` - Playwright test files
- `db/` - Database schema

**If you don't see these files**, go back to Step 2 and try cloning again.

---

## First-Time Setup

### Step 5: Create Your Environment File

The `.env` file stores your database password and other settings.
**This file should NEVER be committed to Git** because it contains secrets.

**Create the file:**

```bash
# Copy the example file to create your .env file
cp .env.example .env
```

**What this does:** Creates a new file named `.env` based on the template.

### Step 6: Set a Secure Password

Now you need to edit the `.env` file and set a strong password for your database.

**🔑 How this works:** When you start Docker (in Step 9), it will read this
password from `.env` and automatically create the PostgreSQL database with
your chosen password. You're setting it **before** the database exists, and
Docker handles the rest!

**Open the file in a text editor:**

```bash
# Using nano (beginner-friendly)
nano .env

# OR using vim
vim .env

# OR on Windows with Notepad
notepad .env
```

**You'll see this:**

```bash
# PostgreSQL Database Configuration
POSTGRES_USER=pumpkin
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=playwright_metrics

# Database Connection URL (used by Node.js application)
DATABASE_URL=postgresql://pumpkin:your_secure_password_here@postgres:5432/playwright_metrics

# Local database connection (when accessing from host machine)
DATABASE_URL_LOCAL=postgresql://pumpkin:your_secure_password_here@localhost:5432/playwright_metrics

# Application Configuration
NODE_ENV=development
PORT=3000
```

**Change `your_secure_password_here` to a strong password** in THREE places:

1. `POSTGRES_PASSWORD=your_secure_password_here`
2. `DATABASE_URL=postgresql://pumpkin:your_secure_password_here@postgres:5432/playwright_metrics`
3. `DATABASE_URL_LOCAL=postgresql://pumpkin:your_secure_password_here@localhost:5432/playwright_metrics`

**Example of a strong password:**

```env
POSTGRES_PASSWORD=SecureP@ssw0rd!2025
DATABASE_URL=postgresql://pumpkin:SecureP@ssw0rd!2025@postgres:5432/playwright_metrics
DATABASE_URL_LOCAL=postgresql://pumpkin:SecureP@ssw0rd!2025@localhost:5432/playwright_metrics
```

**Password requirements:**

- At least 12 characters long
- Mix of uppercase and lowercase letters
- Include numbers and symbols
- Don't use common words or your username

**Save and exit:**

- In nano: Press `Ctrl + X`, then `Y`, then `Enter`
- In vim: Press `Esc`, type `:wq`, press `Enter`
- In Notepad: Click File → Save

**⚠️ IMPORTANT SECURITY NOTE:**

- Keep this `.env` file private
- Never share it via email or chat
- Never commit it to Git (it's already in `.gitignore`)
- Use a different password than your other accounts

### Step 7: Verify Your Configuration

Double-check that your `.env` file has the password set correctly:

```bash
# This command checks if your password is still the default (which is bad)
grep "your_secure_password_here" .env
```

**If this command shows any output**, you forgot to change the password! Go back to Step 6.

**If it shows nothing**, you're good! ✅

---

## Starting the Application

### Step 8: Build the Docker Images

Before running the application for the first time, you need to build the
Docker images. This downloads all dependencies and creates the containers.

**Run this command:**

```bash
docker-compose build
```

**What this does:**

- Downloads the Playwright Docker image (~2 GB)
- Downloads PostgreSQL Docker image (~200 MB)
- Installs Node.js dependencies
- Installs Firefox browser with all required libraries
- Prepares everything to run

**This will take 5-10 minutes** depending on your internet speed.

**You'll see lots of output** like:

```text
[+] Building 234.5s (15/15) FINISHED
 => [internal] load build definition from Dockerfile
 => => transferring dockerfile: 32B
 => [internal] load .dockerignore
...
```

**When it's done**, you'll see:

```text
Successfully tagged project-pumpkin:latest
```

### Step 9: Start the Services

Now start all the containers (database + application + testing environment):

```bash
docker-compose up -d
```

**What this does:**

- Reads your password from `.env` file
- Starts PostgreSQL database with your chosen password (first time only)
- Creates database tables automatically (using `db/init.sql`)
- Starts the web application on port 3000
- Prepares the Playwright testing environment

**🔐 Note:** The password you set in Step 6 is now being used to create the
PostgreSQL database. On future startups, PostgreSQL will remember this password.

**The `-d` flag** means "detached mode" - runs in the background.

**You should see:**

```text
[+] Running 4/4
 ✔ Network project-pumpkin_playwright-network  Created
 ✔ Volume "project-pumpkin_postgres-data"      Created
 ✔ Container project-pumpkin-db                Started
 ✔ Container project-pumpkin-app-1             Started
```

### Step 10: Verify Everything Started

Check that all containers are running:

```bash
docker-compose ps
```

**You should see:**

```text
NAME                     STATUS          PORTS
project-pumpkin-db       Up 30 seconds   0.0.0.0:5432->5432/tcp
project-pumpkin-app-1    Up 30 seconds   0.0.0.0:3000->3000/tcp
```

**Both should show `Up`**. If any show `Exited`, something went wrong - see the [Troubleshooting](#troubleshooting) section.

### Step 11: Check the Logs

View the application logs to make sure there are no errors:

```bash
docker-compose logs app
```

**You should see:**

```text
🐈 Project Pumpkin server running on port 3000
📊 Dashboard: http://localhost:3000
🔌 API: http://localhost:3000/api
```

**If you see errors** about database connection, wait 30 seconds (database may
still be initializing) and run the command again.

---

## Using the Dashboard

### Step 12: Access the Web Interface

Open a web browser and go to:

```text
http://localhost:3000
```

**If you're on a remote server**, replace `localhost` with your server's IP address:

```text
http://192.168.1.100:3000
```

**You should see:**

- The Project Pumpkin dashboard
- A list of recent test runs (will be empty on first launch)
- Navigation to view reports and search results

**If the page doesn't load**, check:

1. Is the app container running? (`docker-compose ps`)
2. Is port 3000 open in your firewall?
3. Are you using the correct IP address?

### What You Can Do in the Dashboard

🔍 **View Test Runs** - See all historical test executions
📊 **Performance Reports** - Charts showing load times and trends
🔎 **Search Results** - Filter by domain, date, or error status
📈 **Compare Runs** - See how performance changed over time

---

## Running Website Tests

### Step 13: Enter the Testing Environment

To run tests, you need to enter the interactive Playwright container:

```bash
docker-compose run --rm playwright
```

**What this does:**

- Starts a new container with Playwright installed
- Gives you a bash shell inside the container
- Automatically connects to the database
- The `--rm` flag removes the container when you exit

**You should see:**

```bash
root@abc123:/app#
```

**You are now inside the container**. The command prompt changed!

### Step 14: Test a Single Website

Inside the container, run a test on a single URL:

```bash
# Test the default URL (www.uchicago.edu)
npx playwright test --project=firefox

# Test a custom URL
TEST_URL=https://www.google.com npx playwright test --project=firefox
```

**What this does:**

1. Opens Firefox browser (headless mode)
2. Navigates to the URL
3. Scrolls down to load all content
4. Takes a screenshot
5. Records all network traffic (HAR file)
6. Measures performance metrics
7. Saves everything to the database

**You'll see output like:**

```text
Running 1 test using 1 worker

  ✓  1 tests/uchicago-screenshot.spec.js:3:1 › Screenshot test (5s)

  1 passed (6s)
```

**Test results are saved to:**

- **Screenshot:** `test-history/2025-10-05T14-30-22-123Z__www.google.com/screenshot.png`
- **HAR file:** `test-history/2025-10-05T14-30-22-123Z__www.google.com/network.har`
- **Database:** Performance metrics stored in PostgreSQL

### Step 15: Test Multiple Websites in Parallel

To test all URLs from the `tests/urls.txt` file (40+ domains):

```bash
# Run with 4 parallel workers (default)
./test-urls-parallel.sh

# Run with 8 parallel workers (faster on powerful servers)
./test-urls-parallel.sh 8
```

**What this does:**

- Reads all URLs from `tests/urls.txt`
- Runs multiple tests simultaneously
- Creates one test run record in the database
- Shows real-time progress

**You'll see:**

```text
Starting parallel test run with 4 workers...
Test run ID: 42
Testing 39 URLs...

Running 39 tests using 4 workers
  ✓  [1/39] www.uchicago.edu (4.2s)
  ✓  [2/39] its.uchicago.edu (3.8s)
  ✓  [3/39] getsecure.uchicago.edu (5.1s)
...
```

**This will take 5-15 minutes** depending on your server speed and number of workers.

### Step 16: Exit the Testing Environment

When you're done running tests, exit the container:

```bash
exit
```

**You're now back on your server** (the prompt changed back to normal).

---

## Viewing Test Results

### Option 1: View in the Dashboard (Easiest)

Open your web browser to:

```text
http://localhost:3000
```

**Click through the interface:**

- **Home page:** Recent test runs
- **Run Details:** Click any run to see all tested URLs
- **URL Results:** Click any URL to see detailed metrics
- **Charts:** Visual performance graphs

### Option 2: Query the Database (Advanced)

#### Latest Test Run Summary

```bash
npm run db:query latest
```

**Shows:**

- When the test ran
- How many URLs were tested
- Pass/fail counts
- Average performance metrics

#### Show Recent Test Runs

```bash
npm run db:query runs 10
```

**Shows:** Last 10 test runs with summary data.

#### Show All URLs Tested in a Run

```bash
# Replace 123 with the actual run ID from the database
npm run db:query urls 123
```

#### Performance Trend for a Domain

```bash
npm run db:query trend www.uchicago.edu 10
```

**Shows:** Last 10 tests for this domain with load times.

#### Find Slowest Domains

```bash
npm run db:query slowest 10
```

#### Find Tests with Errors

```bash
npm run db:query errors
```

#### Find Pages with 404 Errors

```bash
npm run db:query 404s
```

#### Search for Domains

```bash
npm run db:query search "%uchicago%"
```

#### Generate Full Report

```bash
npm run db:report
```

**Generates a comprehensive report** including:

- Average load times
- Resource counts
- HTTP status codes
- Slowest/fastest domains
- Error summary

### Option 3: Access the Database Directly (Expert)

Connect to PostgreSQL with `psql`:

```bash
docker exec -it project-pumpkin-db psql -U pumpkin -d playwright_metrics
```

**You're now in the PostgreSQL shell**. Run SQL queries:

```sql
-- Show all tables
\dt

-- Show recent test runs
SELECT * FROM test_runs ORDER BY run_timestamp DESC LIMIT 5;

-- Show latest URL tests
SELECT domain, total_page_load_ms, status
FROM url_tests
ORDER BY test_timestamp DESC
LIMIT 10;

-- Exit PostgreSQL
\q
```

---

## Stopping the Application

### To Stop All Services

```bash
docker-compose down
```

**What this does:**

- Stops all running containers
- Removes containers
- **Keeps your data** (database volume and test-history files)

### To Stop and Remove Everything (Including Data)

⚠️ **WARNING: This deletes all test results from the database!**

```bash
docker-compose down -v
```

**The `-v` flag** removes volumes (deletes the database).

**Use this only if:**

- You want to start completely fresh
- You're uninstalling the project
- You've backed up important data

---

## Troubleshooting

### Problem: "Cannot connect to Docker daemon"

**Error message:**

```text
Cannot connect to the Docker daemon at unix:///var/run/docker.sock
```

**Solution:**

1. Make sure Docker Desktop is running (look for the whale icon in your system tray)
2. Try: `sudo systemctl start docker` (Linux)
3. Restart your computer

### Problem: "Port 3000 is already in use"

**Error message:**

```text
Error: bind: address already in use
```

**Solution:**

**Option A:** Stop the other application using port 3000

```bash
# Find what's using port 3000
lsof -i :3000   # macOS/Linux
netstat -ano | findstr :3000   # Windows

# Kill the process (replace PID with the actual process ID)
kill -9 PID
```

**Option B:** Change Project Pumpkin's port

Edit `.env` file:

```bash
PORT=3001
```

Then restart:

```bash
docker-compose down
docker-compose up -d
```

Access at: `http://localhost:3001`

### Problem: "Database connection failed"

**Symptoms:**

- Dashboard shows "database: disconnected"
- Logs show PostgreSQL connection errors

**Solutions:**

1. **Wait 30 seconds** - Database takes time to initialize on first start

2. **Check if database is running:**

   ```bash
   docker-compose ps
   ```

3. **Check database logs:**

   ```bash
   docker-compose logs postgres
   ```

4. **Verify password in `.env` matches in all three places**

5. **Restart everything:**

   ```bash
   docker-compose restart
   ```

### Problem: "Permission denied" when running commands

**On Linux**, you might need to add `sudo` before commands:

```bash
sudo docker-compose up -d
```

**Better solution:** Add your user to the docker group:

```bash
sudo usermod -aG docker $USER
```

Then **log out and log back in** for changes to take effect.

### Problem: Tests fail with "Browser not found"

**Solution:** Rebuild the Docker image:

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Problem: "Out of disk space"

**Symptoms:**

- Tests fail randomly
- Container won't start

**Solution:** Clean up old Docker images and test files

```bash
# Remove unused Docker images
docker system prune -a

# Remove old test results (older than 30 days)
# First, dry run to see what will be deleted:
npm run db:cleanup -- --dry-run

# Then actually delete:
npm run db:cleanup
```

### Problem: "Cannot find module" errors

**Error message:**

```text
Error: Cannot find module 'express'
```

**Solution:** Rebuild containers to reinstall dependencies

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Problem: Dashboard loads but shows no data

**Possible causes:**

1. **No tests have been run yet**
   - Run tests first (see [Step 13](#step-13-enter-the-testing-environment))

2. **Database is empty**
   - Check: `npm run db:query latest`
   - If empty, run tests to populate data

3. **Browser cache issue**
   - Try hard refresh: `Ctrl+F5` (Windows/Linux) or `Cmd+Shift+R` (macOS)

### Problem: Need to change the database password

**Scenario:** You already created the database but want to change the password.

⚠️ **Important:** You can't just change the password in `.env` - PostgreSQL already has a password set from the first startup.

#### Solution: Reset the database with a new password

```bash
# Step 1: Stop all containers
docker-compose down

# Step 2: Remove the database volume (⚠️ this deletes all test data!)
docker volume rm project-pumpkin_postgres-data

# Step 3: Edit .env with your new password
nano .env

# Step 4: Start containers (database will be recreated with new password)
docker-compose up -d
```

#### Alternative: Change password in existing database

If you want to keep your test data:

```bash
# Step 1: Connect to the database
docker exec -it project-pumpkin-db psql -U pumpkin -d playwright_metrics

# Step 2: Change the password (replace with your new password)
ALTER USER pumpkin WITH PASSWORD 'YourNewPassword123!';

# Step 3: Exit PostgreSQL
\q

# Step 4: Update .env file to match the new password
nano .env

# Step 5: Restart containers
docker-compose restart
```

### Getting More Help

If you're still stuck:

1. **Check the logs:**

   ```bash
   docker-compose logs
   ```

2. **Check detailed documentation:**
   - [DATABASE.md](DATABASE.md) - Database troubleshooting
   - [SECURITY.md](SECURITY.md) - Security best practices

3. **File an issue on GitHub** with:
   - What you were trying to do
   - The exact error message
   - Output of `docker-compose ps`
   - Output of `docker-compose logs`

---

## What's Next?

Now that you have Project Pumpkin running, here are some advanced topics:

### Customize the URL List

Edit which websites to test:

```bash
# Edit the URL list
nano tests/urls.txt

# Add one URL per line:
https://www.example.com
https://www.another-site.org
https://www.my-company.com
```

### Schedule Automatic Tests

Set up a cron job to run tests automatically:

```bash
# Edit crontab
crontab -e

# Run tests every day at 2 AM
0 2 * * * cd /path/to/project-pumpkin && docker-compose run --rm playwright ./test-urls-parallel.sh
```

### Backup Your Data

Backup the database:

```bash
# Create backup
docker exec project-pumpkin-db pg_dump -U pumpkin playwright_metrics > backup.sql

# Restore from backup
cat backup.sql | docker exec -i project-pumpkin-db psql -U pumpkin -d playwright_metrics
```

### Production Deployment

For production servers, read:

- [SECURITY.md](SECURITY.md) - Secure credential management
- [DATABASE.md](DATABASE.md) - Performance optimization and backups

**Key production changes:**

- Use Docker Secrets instead of `.env` files
- Enable SSL/TLS for database connections
- Set up automated backups
- Configure firewall rules
- Use a reverse proxy (nginx/Caddy) for HTTPS

### View Screenshots and HAR Files

All test artifacts are saved to `test-history/`:

```bash
# List all test results
ls -la test-history/

# Open a screenshot
open test-history/2025-10-05T14-30-22-123Z__www.google.com/screenshot.png

# Analyze HAR file
# Import into Chrome DevTools: Network tab → right-click → "Import HAR file"
```

### API Integration

Project Pumpkin provides a REST API at `http://localhost:3000/api`:

**Endpoints:**

- `GET /api/runs` - List all test runs
- `GET /api/runs/:id` - Get specific test run details
- `GET /api/urls/:id` - Get specific URL test details
- `GET /api/health` - Health check

**Example:**

```bash
# Get latest test runs
curl http://localhost:3000/api/runs?limit=10

# Get specific test run
curl http://localhost:3000/api/runs/42
```

### Contributing

Want to improve Project Pumpkin?

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

See the project documentation for development guidelines.

---

## Getting Help

### Documentation

- **[DATABASE.md](DATABASE.md)** - Database schema and queries
- **[SECURITY.md](SECURITY.md)** - Security best practices
- **[Playwright Docs](https://playwright.dev)** - Playwright testing framework

### Support Channels

- **GitHub Issues:** Report bugs or request features
- **Discussions:** Ask questions and share ideas
- **Email:** <contact@your-domain.com>

### Quick Reference Commands

```bash
# Start application
docker-compose up -d

# Stop application
docker-compose down

# View logs
docker-compose logs -f

# Run tests
docker-compose run --rm playwright ./test-urls-parallel.sh

# Query database
npm run db:query latest
npm run db:report

# Backup database
docker exec project-pumpkin-db pg_dump -U pumpkin playwright_metrics > backup.sql

# Access database
docker exec -it project-pumpkin-db psql -U pumpkin -d playwright_metrics

# Rebuild containers
docker-compose build --no-cache
docker-compose up -d
```

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- **Playwright** - Web testing framework by Microsoft
- **PostgreSQL** - Powerful open-source database
- **Docker** - Container platform
- **Express.js** - Web application framework

---

Made with 🎃 by the Project Pumpkin Team

Last updated: 2025-10-05
