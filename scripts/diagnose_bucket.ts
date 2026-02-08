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

async function diagnoseBucket() {
    console.log('🔍 Diagnosing Supabase Storage Bucket...\n');
    
    // List all buckets to see what's available
    console.log('1. Listing all available buckets:');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
        console.log('❌ Error listing buckets:', bucketError.message);
        return;
    }
    
    if (buckets && buckets.length > 0) {
        console.log(`✅ Found ${buckets.length} bucket(s):`);
        buckets.forEach((bucket, index) => {
            console.log(`   ${index + 1}. ${bucket.name} (${bucket.public ? 'Public' : 'Private'})`);
        });
    } else {
        console.log('❌ No buckets found!');
        return;
    }
    
    // Check specifically for photos bucket (case insensitive)
    console.log('\n2. Checking for photos bucket:');
    const photosBuckets = buckets.filter(b => 
        b.name.toLowerCase() === 'photos' || 
        b.name === 'PHOTOS' || 
        b.name === 'Photos'
    );
    
    if (photosBuckets.length > 0) {
        console.log('✅ Found photos-related bucket(s):');
        photosBuckets.forEach(bucket => {
            console.log(`   - Name: "${bucket.name}" (Public: ${bucket.public ? 'Yes' : 'No'})`);
        });
        
        // Test with the actual bucket name
        const actualBucketName = photosBuckets[0].name;
        console.log(`\n3. Testing with bucket name: "${actualBucketName}"`);
        
        // Try to upload a small test file
        console.log('   Uploading test file...');
        const testFileName = `diagnostic-test-${Date.now()}.txt`;
        const testContent = 'Diagnostic test content';
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(actualBucketName)
            .upload(testFileName, testContent, {
                contentType: 'text/plain',
                upsert: true
            });
        
        if (uploadError) {
            console.log('❌ Upload failed:', uploadError.message);
            console.log('   Error details:', uploadError);
        } else {
            console.log('✅ Upload successful!');
            console.log(`   File path: ${uploadData.path}`);
            
            // Try to download it back
            console.log('   Downloading test file...');
            const { data: downloadData, error: downloadError } = await supabase.storage
                .from(actualBucketName)
                .download(testFileName);
            
            if (downloadError) {
                console.log('❌ Download failed:', downloadError.message);
            } else {
                console.log('✅ Download successful!');
                const content = await downloadData.text();
                console.log(`   Content: "${content}"`);
            }
            
            // Clean up
            console.log('   Cleaning up test file...');
            await supabase.storage.from(actualBucketName).remove([testFileName]);
            console.log('✅ Cleaned up');
        }
    } else {
        console.log('❌ No photos bucket found!');
        console.log('   Available buckets:', buckets.map(b => `"${b.name}"`).join(', '));
    }
    
    console.log('\n4. Checking server configuration:');
    console.log(`   EXPO_PUBLIC_SUPABASE_URL: ${supabaseUrl}`);
    console.log(`   Bucket name in server code: "photos" (lowercase)`);
}

diagnoseBucket().catch(console.error);