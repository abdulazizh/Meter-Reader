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

async function detailedErrorTest() {
    console.log('🔍 Detailed error analysis...\n');
    
    // Test downloading a non-existent file
    console.log('1. Testing download of non-existent file:');
    const { data, error } = await supabase.storage
        .from('photos')
        .download('1111_002_1770407745530.jpg');
    
    console.log('Error object:', error);
    console.log('Error type:', typeof error);
    console.log('Error keys:', error ? Object.keys(error) : 'No error');
    
    if (error) {
        console.log('Error message:', error.message);
        console.log('Error name:', error.name);
        console.log('Error stack:', error.stack);
        
        // Check if it has originalError
        if ('originalError' in error) {
            console.log('Original error:', error.originalError);
            const originalError: any = error.originalError;
            if (originalError && originalError.body) {
                try {
                    const bodyText = await originalError.body.text();
                    console.log('Response body:', bodyText);
                } catch (e: any) {
                    console.log('Could not read response body:', e.message);
                }
            }
        }
    }
    
    console.log('\n2. Testing with a known existing file:');
    // First, let's upload a test file
    const testFileName = `error-test-${Date.now()}.jpg`;
    const testContent = 'test content';
    
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(testFileName, testContent, {
            contentType: 'image/jpeg',
            upsert: true
        });
    
    if (uploadError) {
        console.log('❌ Upload failed:', uploadError);
        return;
    }
    
    console.log('✅ Uploaded test file:', uploadData.path);
    
    // Now try to download it
    const { data: downloadData, error: downloadError } = await supabase.storage
        .from('photos')
        .download(testFileName);
    
    console.log('Download result - Data:', !!downloadData);
    console.log('Download result - Error:', downloadError);
    
    // Clean up
    await supabase.storage.from('photos').remove([testFileName]);
    console.log('✅ Cleaned up test file');
}

detailedErrorTest().catch(console.error);