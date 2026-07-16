# Control Drift: One-Server Deployment Guide

This guide provides completely beginner-friendly instructions on how to deploy a production-ready instance of Control Drift on a single server or VM. 

By following these steps, you will use Docker Compose to run both your web application frontend and your self-hosted Supabase database backend.

---

## 1. Prerequisites

Before starting, ensure your server meets the following requirements:
- A Linux or Windows server/VM with at least 4GB of RAM and 2 CPUs.
- **Docker** and **Docker Compose** installed. If you haven't installed them, [download Docker here](https://docs.docker.com/get-docker/).
- Your server must be able to accept incoming network traffic.

## 2. Start the Supabase Database Backend

Control Drift uses Supabase as its database for syncing data across your entire team. The deployment comes with a pre-configured Docker setup that will automatically spin up PostgreSQL, a REST API, and configure the database schema for you.

1. Open your terminal or command prompt and navigate to the Supabase docker folder:
   ```bash
   cd supabase/docker
   ```

2. Bring up the backend database services:
   ```bash
   docker compose up -d
   ```

3. Wait a minute for the database to fully initialize. Supabase will automatically run the initialization scripts to create the required tables (`exercises`, `gaps`, `simulations`). It will be accessible on port `8000` via the Kong API gateway.

## 3. Configure the Application

The web frontend needs to know where to send its data. Since it will be running in a browser on *your* local machine (not the server), you need to tell it the public IP address of the server. 

You also need to configure the AI integration if you are using an Enterprise AI Proxy.

1. Open the configuration file located at `deploy/config.json` in any text editor.
2. Change the `endpoint` IP address from `127.0.0.1` to the **actual IP address** of your server (for example, `10.0.0.210` or your public IP).
3. If you have an AI proxy or custom AI endpoint, configure the `ai` section similarly.

**Example `deploy/config.json`:**
```json
{
  "database": {
    "provider": "supabase",
    "endpoint": "http://10.0.0.210:8000",
    "apiKey": "your-anon-key-here"
  },
  "ai": {
    "enabled": true,
    "endpointUrl": "http://10.0.0.210:1234/v1/chat/completions",
    "model": "gpt-4o",
    "proxy": true
  }
}
```
*Note: Do not use `127.0.0.1` or `localhost` here! If you do, when you load the app on your laptop, your laptop will try to connect to its own database instead of the server's database.*

## 4. Deploy the Frontend

With your configuration saved, you can now start the web application.

1. Navigate to the `deploy/` directory:
   ```bash
   cd ../../deploy
   ```

2. Build and start the frontend container:
   ```bash
   docker compose up -d --build
   ```

The application is now running! 

To use Control Drift, simply open a web browser on any device on your network and navigate to your server's IP address (e.g., `http://10.0.0.210`). The app will load and connect directly to your newly deployed Supabase database and AI proxy.

---

### Managing the Deployment

To gracefully shut down the platform at any time:

```bash
# Stop the frontend
cd deploy
docker compose down

# Stop the backend
cd ../supabase/docker
docker compose down
```
