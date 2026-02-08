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

async function getResponseBody() {
    console.log('🔍 Getting detailed response body...\n');
    
    try {
        // Direct fetch to get the actual response
        const response = await fetch(
            `${supabaseUrl}/storage/v1/object/photos/1111_002_1770407745530.jpg`,
            {
                headers: {
                    'Authorization': `Bearer ${supabaseKey}`,
                    'apikey': supabaseKey
                } as Record<string, string>
            }
        );
        
        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);
        console.log('Headers:', Object.fromEntries(response.headers.entries()));
        
        const bodyText = await response.text();
        console.log('Response Body:', bodyText);
        
        const bodyJson = JSON.parse(bodyText);
        console.log('Parsed JSON:', bodyJson);
        
    } catch (error: any) {
        console.log('Fetch error:', error.message);
    }
}

getResponseBody().catch(console.error);