# Fixing Supabase Storage Issues on Render Deployment

## Problem Summary

Your Render deployment is experiencing "StorageUnknownError" when trying to access photos because the environment variables are misconfigured.

## Root Cause

There's a mismatch between environment variable names:
- **Local development**: Uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`
- **Render configuration**: Was configured to use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

## Solution Implemented

I've updated the code to accept both variable naming conventions for maximum compatibility:

```javascript
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
```

## Required Actions

### 1. Update Render Environment Variables

In your Render dashboard, you need to set these environment variables:

**Required Variables:**
- `EXPO_PUBLIC_SUPABASE_URL` = `https://thyxrumosbdfexgbdtma.supabase.co`
- `EXPO_PUBLIC_SUPABASE_KEY` = `sb_publishable_IIU20EQ2ixlwP7zpPrCZqw_L9dkhOiA`

**Optional (if you prefer the old naming):**
- `SUPABASE_URL` = `https://thyxrumosbdfexgbdtma.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = (your service role key if you have one)

### 2. Redeploy Your Application

After updating the environment variables in Render dashboard:
1. Go to your Render dashboard
2. Find your "meter-reader-backend" service
3. Click "Manual Deploy" → "Clear build cache & deploy"

### 3. Verify the Fix

After deployment, test photo functionality:
1. Try accessing an existing photo through your API
2. Upload a new photo
3. Check Render logs for any remaining errors

## Additional Improvements Made

1. **Enhanced Error Handling**: The server now properly handles the case where Supabase returns a 400 status with a 404 message in the body
2. **Better Error Messages**: More informative error responses for debugging
3. **Backward Compatibility**: Code now works with both environment variable naming conventions

## Testing Locally

To verify the fix works locally:
```bash
npm run server:dev
```

Then test photo endpoints:
```bash
curl http://localhost:5000/api/photo/test.jpg
```

## Troubleshooting

If you still encounter issues after deployment:

1. **Check Render Logs**: Look for "Missing Supabase credentials" errors
2. **Verify Environment Variables**: Ensure they're correctly set in Render dashboard
3. **Check Bucket Name**: Confirm the "photos" bucket exists and is public in Supabase
4. **Test Supabase Connection**: Use the diagnostic scripts in `scripts/` folder

## Files Modified

- `server/routes.ts` - Added environment variable fallback logic
- `render.yaml` - Updated environment variable names (for future deployments)