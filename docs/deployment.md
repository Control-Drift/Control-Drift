# Enterprise Deployment Guide (PoC)

This guide outlines how to deploy Control Drift in an enterprise environment using a single-server Proof of Concept (PoC) architecture. This setup includes:

1. **Supabase**: A self-hosted PostgreSQL database and authentication server.
2. **LiteLLM**: An AI proxy for securely managing access to OpenAI, Anthropic, or Gemini models without exposing API keys to the frontend.
3. **Control Drift**: The frontend React application served via Nginx.

---

## Prerequisites

- **Docker** and **Docker Compose** installed on your host machine.
- **Git** installed.
- (Optional but recommended) A valid API key for your AI provider of choice.

---

## Step-by-Step Deployment

### 1. Install Docker Desktop
Before running the scripts, you must have Docker installed. 
- Download and install **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (Windows/Mac) or Docker Engine (Linux).
- Ensure the Docker application is running in the background before proceeding.

### 2. Clone the Repository
Clone the Control Drift repository to your machine and navigate into it:
```bash
git clone https://github.com/Control-Drift/Control-Drift.git
cd Control-Drift
```
### 3. Run the Automated Setup Script
Run the automated enterprise setup script for your operating system. This script will download Supabase, inject the database schema, configure the AI proxy, generate your config files, and boot up the entire platform.

**On Windows (PowerShell):**
```powershell
.\deploy\setup-enterprise.ps1
```
*(Note: If you get an execution policy error, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first).*

**On Linux/Mac (Bash):**
```bash
bash deploy/setup-enterprise.sh
```

### 4. Verify the Deployment
Once the script finishes, everything is running! The deployment script automatically fetches your generated Supabase `ANON_KEY` and injects it into `deploy/config.json` for you.

*(Note: Because `config.json` is mounted directly into the container, if you ever need to manually rotate or update your API key in the future, you do not need to restart Docker after saving the file).*

---

## Accessing the Platform

Your deployment is now complete and fully secured behind an Nginx TLS reverse proxy! You can access the services at:

- **Control Drift Frontend**: `https://<SERVER_IP>`
- **Supabase API Gateway (Backend/Kong)**: `https://<SERVER_IP>/auth/v1` (and `/rest/v1`, etc.)
- **Supabase Studio (Database Admin UI)**: `http://127.0.0.1:3000` (Restricted to localhost for security)
- **LiteLLM Proxy**: `https://<SERVER_IP>/litellm/`

*(Note: Because the scripts generate self-signed certificates for the Nginx proxy, your browser will show a "Not secure" warning on your first visit. You must explicitly tell your browser to proceed to the IP address. The connection itself is fully encrypted.)*

### Initial Login
To access the application when connected to a database, you must provision accounts via the Supabase API Gateway (Backend/Kong) (`https://<SERVER_IP>/auth/v1`).

---

## Provisioning Access & Database Schema

Control Drift uses a single-tenant workspace architecture. Here is how access and schema initialization work:

### Schema Initialization
When you run the automated setup script (or follow the manual steps), the `deploy/schema.sql` file is injected directly into Supabase's initialization volumes. This means that the first time the database boots up, it automatically creates all required tables (`exercises`, `gaps`, `simulations`, and `user_roles`) and configures Row Level Security (RLS). 

### Provisioning New Users
For security reasons, access must be manually provisioned by an administrator. Because we set `GOTRUE_MAILER_AUTOCONFIRM=true`, administrators can create accounts without requiring an SMTP server or email verification:
1. Open **Supabase Studio (Database Admin UI)**: `http://<SERVER_IP>:3000`.
2. Navigate to the **Authentication** tab.
3. Click **Add User** -> **Create New User**.
4. Enter the user's email and a temporary password.

The user can now use these credentials to log directly into Control Drift. To revoke access, simply delete or suspend the user account from this same tab.

### Role-Based Access Control (RBAC) Foundation
*Note: In this PoC enterprise setup, Row Level Security (RLS) policies are configured to grant full read/write access to all authenticated users by default. Strict RBAC is not enforced out-of-the-box.*

If your organization implements strict RLS policies, you can assign explicit roles (like `admin` or `readonly`) via the `user_roles` table in Supabase Studio:
1. Navigate to the **Table Editor** in Supabase Studio.
2. Select the `user_roles` table.
3. Create a new row mapping the user's `uuid` (from the `auth.users` table) to the desired role string. This provides the groundwork for scalable, multi-tenant permission models.

---

## Managing the Services

If you ever need to restart your server or manually shut down the backend, use the following commands:

### Stopping and Starting the Database (Supabase)
The Supabase stack is managed via Docker Compose within its own directory:
```bash
# Navigate to the initialized docker directory
cd supabase/docker/

# To shut down the database stack
docker compose down

# To start the database stack back up
docker compose up -d
```
*(Because the database volumes are physically mounted on your server, all of your user accounts, tables, and settings are completely saved and will persist through shutdowns!)*

### Stopping and Starting the Frontend & AI Proxy
The Control Drift frontend and the LiteLLM proxy are also managed by their own Compose stack in the `deploy` directory:
```bash
# Navigate to the deployment directory
cd deploy/

# To shut down the frontend and proxy
docker compose down

# To start them back up
docker compose up -d
```

---

## Manual Security Configuration (Without Scripts)

If you are deploying Control Drift manually and do not wish to use the automated setup scripts, you must manually secure your deployment to prevent exposing sensitive internal services (like Supabase Studio and the AI Proxy) to the public web.

### 1. Bind Supabase Studio to Localhost
By default, Supabase's `docker-compose.yml` binds Studio to `0.0.0.0:3000`. To restrict this, create a `docker-compose.override.yml` in the `supabase/docker/` directory:
```yaml
services:
  studio:
    ports:
      - "127.0.0.1:3000:3000/tcp"
```

### 2. Generate TLS Certificates
In the `deploy/` directory, create a `certs` folder and generate self-signed certificates (or drop in your own enterprise certificates):
```bash
mkdir certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Security/CN=localhost"
```

### 3. Route Traffic Through Nginx
Ensure your `deploy/docker-compose.yml` includes the `nginx.conf` and `certs` volume mounts for the `control-drift` frontend service, and that the LiteLLM proxy port `4000` is **not** exposed to the host network (only exposed internally within the `supabase_default` network).

### 4. Update Supabase Environment Variables
In `supabase/docker/.env`, update your external URLs to point to your Nginx proxy (Port 443) instead of Port 8000:
```env
API_EXTERNAL_URL=https://<SERVER_IP>/auth/v1
SUPABASE_PUBLIC_URL=https://<SERVER_IP>
ADDITIONAL_REDIRECT_URLS=https://<SERVER_IP>,https://localhost,http://127.0.0.1:3000,http://localhost:3000
```
