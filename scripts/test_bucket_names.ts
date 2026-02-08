import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBucketVariations() {
    console.log('🔍 Testing different bucket name variations...\n');
    
    const variations = [
        'photos',      // lowercase (what we're using in code)
        'PHOTOS',      // uppercase (what was in original error)
        'Photos',      // capitalized
        'photo',       // singular
        'Photo',       // singular capitalized
        'images',      // alternative name
        'Images'       // alternative capitalized
    ];
    
    for (const bucketName of variations) {
        console.log(`Testing bucket: "${bucketName}"`);
        
        try {
            // Try to upload a tiny test file
            const testFileName = `test-${Date.now()}.txt`;
            const testContent = 'test';
            
            const { data, error } = await supabase.storage
                .from(bucketName)
                .upload(testFileName, testContent, {
                    contentType: 'text/plain',
                    upsert: true
                });
            
            if (error) {
                console.log(`  ❌ Failed: ${error.message}`);
                // Check if it's a "bucket not found" error specifically
                if (error.message && error.message.toLowerCase().includes('bucket')) {
                    console.log(`     This confirms bucket "${bucketName}" doesn't exist`);
                }
            } else {
                console.log(`  ✅ SUCCESS! Bucket "${bucketName}" exists and is accessible`);
                console.log(`     File uploaded: ${data.path}`);
                
                // Clean up and exit since we found the working bucket
                await supabase.storage.from(bucketName).remove([testFileName]);
                console.log(`  ✅ Cleaned up test file`);
                console.log(`\n🎉 Found working bucket: "${bucketName}"`);
                console.log(`🔧 Update server/routes.ts to use bucket name: "${bucketName}"`);
                return bucketName;
            }
        } catch (error: any) {
            console.log(`  ❌ Exception: ${error.message}`);
        }
        
        console.log(''); // Empty line for readability
    }
    
    console.log('❌ None of the common bucket names worked');
    console.log('Please check your Supabase dashboard to verify:');
    console.log('1. You\'re looking at the correct project (thyxrumosbdfexgbdtma)');
    console.log('2. The bucket name exactly as it appears in the dashboard');
    console.log('3. The bucket is set to public');
    
    return null;
}

testBucketVariations().then(foundBucket => {
    if (foundBucket) {
        console.log(`\n✅ Solution: Update your server code to use bucket name "${foundBucket}"`);
    }
}).catch(console.error);