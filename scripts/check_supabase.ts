
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
    console.log('Checking Supabase Storage...');
    
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
        console.error('Error listing buckets:', error.message);
        return;
    }
    
    console.log('Available buckets:', buckets.map(b => b.name));
    
    const photosBucket = buckets.find(b => b.name === 'photos');
    if (!photosBucket) {
        console.log('❌ "photos" bucket not found! Creating it...');
        const { data, error: createError } = await supabase.storage.createBucket('photos', {
            public: true
        });
        if (createError) {
            console.error('Error creating "photos" bucket:', createError.message);
        } else {
            console.log('✅ "photos" bucket created successfully.');
        }
    } else {
        console.log('✅ "photos" bucket exists.');
    }
}

checkStorage();
