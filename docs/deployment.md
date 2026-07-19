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

Setting up the single-server Enterprise environment is designed to be as effortless as possible using our automated scripts.

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

### 3. Set Your AI Keys
Our script automatically configures an AI Proxy (LiteLLM) to keep your API keys secure. You just need to pass your keys to the terminal so the proxy can grab them.

**On Windows (PowerShell):**
```powershell
$env:OPENAI_API_KEY="sk-your-openai-key"
```
**On Linux/Mac (Bash):**
```bash
export OPENAI_API_KEY="sk-your-openai-key"
```

### 4. Run the Automated Setup Script
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

### 5. Link the Database to Control Drift
Once the script finishes, everything is running! Control Drift just needs the API key for your newly created database.

1. Open your browser and go to **`http://<SERVER_IP>:3000`** (This is your Supabase Studio).
2. Look in the project settings for your **API Keys** and copy the `anon` / `public` key.
3. Open the `deploy/config.json` file in your repository.
4. Replace `<YOUR_SUPABASE_ANON_KEY>` with the key you just copied.

*(Note: Because `config.json` is mounted directly into the container, you do not need to restart Docker after saving the file).*

---

## Accessing the Platform

Your deployment is now complete! You can access the services at:

- **Control Drift Frontend**: `http://<SERVER_IP>:80`
- **Supabase Studio (Database Admin)**: `http://<SERVER_IP>:3000`
- **LiteLLM Proxy**: `http://<SERVER_IP>:4000`

### Initial Login
By design, Control Drift does not have a public "Sign Up" page. To log in for the first time, your administrator must provision your account via the Supabase Studio console.

---

## Provisioning Access & Database Schema

Control Drift uses a single-tenant workspace architecture. Here is how access and schema initialization work:

### Schema Initialization
When you run the automated `setup-enterprise.sh` script (or follow the manual steps), the `deploy/schema.sql` file is injected directly into Supabase's initialization volumes. This means that the first time the database boots up, it automatically creates all required tables (`exercises`, `gaps`, `simulations`, and `user_roles`) and configures Row Level Security (RLS). You do not need to manually run any SQL scripts!

### Provisioning New Users
For security reasons, access must be manually provisioned by an administrator. Because we set `GOTRUE_MAILER_AUTOCONFIRM=true`, administrators can create accounts without requiring an SMTP server or email verification:
1. Open Supabase Studio (`http://<SERVER_IP>:3000`).
2. Navigate to the **Authentication** tab.
3. Click **Add User** -> **Create New User**.
4. Enter the operator's email and a temporary password.

The operator can now use these credentials to log directly into Control Drift. To revoke access, simply delete or suspend the user account from this same tab.

### Role-Based Access Control (RBAC)
When an administrator provisions a new user, they are granted basic `operator` permissions by default. If you need to assign explicit roles (like `admin` or `readonly`), you can manage this via the `user_roles` table in Supabase Studio:
1. Navigate to the **Table Editor** in Supabase Studio.
2. Select the `user_roles` table.
3. Create a new row mapping the user's `uuid` (from the `auth.users` table) to the desired role string. Control Drift will automatically read this role upon their next login.
