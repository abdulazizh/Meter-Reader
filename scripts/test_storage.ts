import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStorage() {
    console.log('Testing storage access...');
    
    // Try to download a non-existent file to see the actual error
    const { data, error } = await supabase.storage
        .from('photos')
        .download('test.jpg');
    
    console.log('Error:', error);
    if (error && error.message) {
        console.log('Error message:', error.message);
    }
    
    // Also try to list buckets to see what we have access to
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    console.log('Buckets:', buckets);
    console.log('Bucket error:', bucketError);
}

testStorage().catch(console.error);