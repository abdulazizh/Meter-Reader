import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.log('Please ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY are set');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyStorageSetup() {
    console.log('🔍 Verifying Supabase Storage Setup...\n');
    
    // Check if we can list buckets
    console.log('1. Checking bucket access...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
        console.log('❌ Error listing buckets:', bucketError.message);
        return false;
    }
    
    console.log(`✅ Successfully connected to Supabase storage`);
    console.log(`📋 Available buckets: ${buckets.length > 0 ? buckets.map(b => b.name).join(', ') : 'None'}`);
    
    // Check if 'photos' bucket exists
    console.log('\n2. Checking for "photos" bucket...');
    const photosBucket = buckets.find(b => b.name === 'photos');
    
    if (photosBucket) {
        console.log('✅ "photos" bucket found!');
        console.log(`   - Name: ${photosBucket.name}`);
        console.log(`   - Public: ${photosBucket.public ? 'Yes' : 'No'}`);
        console.log(`   - Created: ${photosBucket.created_at}`);
    } else {
        console.log('❌ "photos" bucket not found!');
        console.log('\n🔧 Please create the bucket by following these steps:');
        console.log('   1. Go to https://app.supabase.com/project/thyxrumosbdfexgbdtma/storage/buckets');
        console.log('   2. Click "Create bucket"');
        console.log('   3. Name: photos');
        console.log('   4. Set as Public: Yes');
        console.log('   5. Click "Create bucket"');
        return false;
    }
    
    // Test upload capability
    console.log('\n3. Testing upload capability...');
    try {
        const testFileName = `test-${Date.now()}.txt`;
        const testContent = 'This is a test file to verify upload capability';
        const { data, error } = await supabase.storage
            .from('photos')
            .upload(testFileName, testContent, {
                contentType: 'text/plain',
                upsert: true
            });
        
        if (error) {
            console.log('❌ Upload test failed:', error.message);
            if (error.message.includes('Bucket not found')) {
                console.log('   The bucket may not be properly configured');
            }
            return false;
        }
        
        console.log('✅ Upload test successful!');
        console.log(`   Uploaded file: ${data.path}`);
        
        // Clean up test file
        console.log('\n4. Cleaning up test file...');
        const { error: deleteError } = await supabase.storage
            .from('photos')
            .remove([testFileName]);
        
        if (deleteError) {
            console.log('⚠️  Could not delete test file:', deleteError.message);
        } else {
            console.log('✅ Test file cleaned up');
        }
        
    } catch (error) {
        console.log('❌ Upload test failed with exception:', error.message);
        return false;
    }
    
    console.log('\n🎉 All checks passed! Storage is properly configured.');
    return true;
}

verifyStorageSetup().then(success => {
    if (!success) {
        process.exit(1);
    }
}).catch(error => {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
});