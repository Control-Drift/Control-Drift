# Enterprise Deployment Guide

This guide outlines how to deploy Control Drift in an enterprise environment using a single-server Proof of Concept (PoC) architecture. This setup includes:

1. **Supabase**: A self-hosted PostgreSQL database and authentication server.
2. **LiteLLM**: An AI proxy for securely managing access to OpenAI, Anthropic, or Gemini models without exposing your master API keys to the frontend.
3. **Control Drift**: The frontend React application served via Nginx.

---

## Prerequisites

- **Docker** and **Docker Compose** installed on your host machine.
- **Git** installed.
- (Optional but recommended) A valid API key for OpenAI, Anthropic, or Gemini if using the AI features.

---

## Step-by-Step Deployment

### 1. Clone the Control Drift Repository

First, clone the Control Drift repository to your server and navigate into it:

```bash
git clone https://github.com/your-org/control-drift.git
cd control-drift
```

### 2. Install and Start Supabase

We use the official Supabase Docker setup. Control Drift includes an automated script that fetches the necessary files, injects our schema, and starts the database. 

You can run the provided bash script or do it manually.

**Automated Approach:**
```bash
bash deploy/setup-enterprise.sh
```

**Manual Approach:**
If you prefer to run it manually:
```bash
# Fetch official Supabase docker repository
mkdir -p supabase && cd supabase
git init
git remote add -f origin https://github.com/supabase/supabase.git
git config core.sparseCheckout true
echo "docker/*" >> .git/info/sparse-checkout
git pull --depth=1 origin master
cd docker

# Copy default config and enable auto-confirmation for users
cp .env.example .env
echo "GOTRUE_MAILER_AUTOCONFIRM=true" >> .env

# Inject the Control Drift database schema
mkdir -p volumes/db/init
cp ../../../deploy/schema.sql volumes/db/init/01-schema.sql

# Start Supabase
docker compose pull
docker compose up -d
cd ../../../
```
*Supabase Studio will now be accessible at `http://localhost:8000`.*

### 3. Configure the AI Proxy (LiteLLM)

Control Drift uses LiteLLM as a proxy to keep your API keys secure. Create or modify `deploy/litellm-config.yaml` to define your available models:

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
  - model_name: claude-3-5-sonnet-20240620
    litellm_params:
      model: anthropic/claude-3-5-sonnet-20240620
```

Before starting the stack in the next step, ensure you pass your actual API keys to the Docker environment. You can set them in your shell:
```bash
export OPENAI_API_KEY="sk-your-openai-key"
export ANTHROPIC_API_KEY="sk-your-anthropic-key"
```

### 4. Configure Control Drift (`config.json`)

To tell the Control Drift frontend to use your new local Supabase instance and AI proxy, you need to create a `config.json` file inside the `deploy/` directory. This file is mounted directly into the Nginx container, meaning you can edit it later without rebuilding the container.

Create `deploy/config.json`:

```json
{
  "database": {
    "provider": "supabase",
    "endpoint": "http://127.0.0.1:8000",
    "apiKey": "<YOUR_SUPABASE_ANON_KEY>"
  },
  "ai": {
    "enabled": true,
    "endpointUrl": "http://127.0.0.1:4000/v1/chat/completions",
    "model": "gpt-4o",
    "proxy": true
  }
}
```
*(Note: The `apiKey` above is the default public anon key for a local Supabase docker instance. If you changed your JWT secret, update this key accordingly).*

### 5. Start Control Drift

Finally, build and start the Control Drift frontend and the LiteLLM proxy using the provided compose file:

```bash
cd deploy
docker compose pull litellm
docker compose up -d --build
```

---

## Accessing the Platform

Your deployment is now complete! You can access the services at:

- **Control Drift Frontend**: `http://localhost:80` (or your server's IP address)
- **Supabase Studio (Database Admin)**: `http://localhost:8000`
- **LiteLLM Proxy**: `http://localhost:4000`

### Initial Login
By design, Control Drift does not have a public "Sign Up" page. To log in for the first time, your administrator must provision your account via the Supabase Studio console.

---

## Provisioning Access & Database Schema

Control Drift uses a single-tenant workspace architecture. Here is how access and schema initialization work:

### Schema Initialization
When you run the automated `setup-enterprise.sh` script (or follow the manual steps), the `deploy/schema.sql` file is injected directly into Supabase's initialization volumes. This means that the first time the database boots up, it automatically creates all required tables (`exercises`, `gaps`, `simulations`, and `user_roles`) and configures Row Level Security (RLS). You do not need to manually run any SQL scripts!

### Provisioning New Users
For security reasons, access must be manually provisioned by an administrator. Because we set `GOTRUE_MAILER_AUTOCONFIRM=true`, administrators can create accounts without requiring an SMTP server or email verification:
1. Open Supabase Studio (`http://localhost:8000`).
2. Navigate to the **Authentication** tab.
3. Click **Add User** -> **Create New User**.
4. Enter the operator's email and a temporary password.

The operator can now use these credentials to log directly into Control Drift. To revoke access, simply delete or suspend the user account from this same tab.

### Role-Based Access Control (RBAC)
When an administrator provisions a new user, they are granted basic `operator` permissions by default. If you need to assign explicit roles (like `admin` or `readonly`), you can manage this via the `user_roles` table in Supabase Studio:
1. Navigate to the **Table Editor** in Supabase Studio.
2. Select the `user_roles` table.
3. Create a new row mapping the user's `uuid` (from the `auth.users` table) to the desired role string. Control Drift will automatically read this role upon their next login.
