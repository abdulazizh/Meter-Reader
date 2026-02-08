# Supabase Storage Setup Instructions

## Problem
The application is encountering a "StorageUnknownError" when trying to access photos in Supabase storage. This is because the required storage bucket doesn't exist or isn't properly configured.

## Solution

### Step 1: Create the Storage Bucket

1. Go to your Supabase project dashboard: https://app.supabase.com/project/thyxrumosbdfexgbdtma
2. Navigate to **Storage** in the left sidebar
3. Click **Create bucket**
4. Enter the following details:
   - **Bucket name**: `photos` (lowercase)
   - **Public bucket**: ✅ Check this box
5. Click **Create bucket**

### Step 2: Configure RLS Policies (if needed)

If you want to restrict access to photos, you can set up Row Level Security policies:

1. In the Storage section, click on your `photos` bucket
2. Go to the **Policies** tab
3. You can either:
   - Keep it public (recommended for this app)
   - Create custom policies for authenticated access

### Step 3: Verify the Setup

After creating the bucket, restart your server:

```bash
npm run server:dev
```

The server should now be able to upload and download photos successfully.

## Error Messages You Might See

### "Storage bucket not found"
This means the `photos` bucket hasn't been created yet. Follow the steps above to create it.

### "new row violates row-level security policy"
This occurs when trying to create a bucket programmatically with a public key. This is expected behavior - buckets must be created through the dashboard.

## Testing Photo Upload

Once the bucket is set up, you can test photo functionality by:
1. Running the mobile app
2. Taking a meter reading with a photo
3. The photo should upload successfully to Supabase storage

## Troubleshooting

If you continue to have issues:

1. **Check bucket name**: Make sure the bucket is named exactly `photos` (lowercase)
2. **Check bucket permissions**: Ensure the bucket is set to public
3. **Check Supabase credentials**: Verify `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` in your `.env` file
4. **Check server logs**: Look for detailed error messages in the server console

## Technical Details

- **Bucket name**: `photos` (must be lowercase)
- **Access type**: Public (for this application)
- **URL format**: `https://thyxrumosbdfexgbdtma.supabase.co/storage/v1/object/photos/{filename}`