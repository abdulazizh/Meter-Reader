# Deployment Guide for Render

This guide explains how to deploy the Meter-Reader application on Render.

## Prerequisites

1. **PostgreSQL Database**: You need to have a PostgreSQL database provisioned. On Render, you can create a "PostgreSQL" add-on.
2. **GitHub Repository**: Your code should be hosted on GitHub, GitLab, or Bitbucket.

## Steps to Deploy

### Step 1: Prepare Your Database

1. Create a PostgreSQL instance on Render (or any other provider)
2. Note down the database connection URL

### Step 2: Configure Environment Variables

In your Render dashboard, under your service settings, configure these environment variables:

- `DATABASE_URL` - Your PostgreSQL database connection string
- `DIRECT_URL` - Same as DATABASE_URL (for Drizzle)
- `SESSION_SECRET` - Random secret string for session encryption (Render will auto-generate if not provided)
- `SUPABASE_URL` - Your Supabase project URL (if using Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (if using Supabase)
- `EXPO_PUBLIC_DOMAIN` - Your Render service URL (e.g., `your-service-name.onrender.com`)

### Step 3: Connect Your Repository

1. Go to https://dashboard.render.com/select-repo
2. Select your GitHub/GitLab/Bitbucket repository containing the Meter-Reader code
3. Choose "Web Service" as the environment
4. Set the runtime to Node
5. Use the existing `render.yaml` configuration

### Step 4: Build and Start Commands

The build and start commands are already configured in your `render.yaml` file:

- Build Command: Builds the server and pushes the database schema
- Start Command: Runs the built server in production mode

### Step 5: Environment Configuration

Make sure your environment variables are properly set in the Render dashboard:

```yaml
services:
  - type: web
    name: meter-reader-backend
    runtime: node
    buildCommand: |
      npm run server:build
      npm run db:push
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false # You will provide this in Render Dashboard
      - key: DIRECT_URL
        sync: false # You will provide this in Render Dashboard
      - key: SESSION_SECRET
        generateValue: true # Generates a secure random secret
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: EXPO_PUBLIC_DOMAIN
        sync: false # This will be your Render URL (e.g., app-name.onrender.com)
      - key: REPLIT_DOMAINS
        sync: false # For Replit deployment if needed
      - key: REPLIT_DEV_DOMAIN
        sync: false # For Replit deployment if needed
```

## Post-Deployment Setup

After deployment:

1. Access your admin panel at `https://your-service-name.onrender.com/admin/login`
2. Default admin credentials: username `admin`, password `admin123`
3. Change these credentials immediately after first login

## Troubleshooting

### Common Issues:

1. **Database Connection Errors**: Make sure your `DATABASE_URL` is correctly set and the database is accessible
2. **Build Failures**: Check that all dependencies are properly defined in `package.json`
3. **Environment Variables**: Ensure all required environment variables are set in the Render dashboard

### Logs:

Check your service logs in the Render dashboard for detailed error messages.

## Updating Your Deployment

Changes pushed to your connected repository branch will automatically trigger a new deployment.

# Admin Panel Features

Once deployed, your admin panel will include:
- User management (readers)
- Meter/subscription management
- Reading tracking
- Bulk assignment of meters to readers (by account range, block, record, or category)
- Data import/export capabilities (supporting JSON, CSV, and Excel formats)
- Downloadable Excel templates for easy data import