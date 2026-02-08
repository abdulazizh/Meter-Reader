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

async function debugSpecificFiles() {
    console.log('🔍 Debugging specific file access issues...\n');
    
    const testFiles = [
        '1111_002_1770407510652.jpg',
        '1111_002_1770407745530.jpg',
        'test-file.jpg'
    ];
    
    console.log('1. Testing access to specific problematic files:');
    
    for (const fileName of testFiles) {
        console.log(`\nTesting file: ${fileName}`);
        
        try {
            // Try to download the file
            const { data, error } = await supabase.storage
                .from('photos')
                .download(fileName);
            
            if (error) {
                console.log(`  ❌ Download failed: ${error.message}`);
                // The error object structure varies, so we'll just log the message
                
                // Try to list files to see what's actually in the bucket
                if (fileName === testFiles[testFiles.length - 1]) { // Last file
                    console.log('\n2. Listing files in bucket:');
                    const { data: files, error: listError } = await supabase.storage
                        .from('photos')
                        .list('', { limit: 10 });
                    
                    if (listError) {
                        console.log(`  ❌ List failed: ${listError.message}`);
                    } else {
                        if (files && files.length > 0) {
                            console.log(`  ✅ Found ${files.length} files:`);
                            files.forEach((file, index) => {
                                console.log(`     ${index + 1}. ${file.name} (${file.metadata?.size || 'unknown'} bytes)`);
                            });
                        } else {
                            console.log('  ✅ Bucket is empty');
                        }
                    }
                }
            } else {
                console.log(`  ✅ File exists and is accessible`);
                const size = data.size || (await data.arrayBuffer()).byteLength;
                console.log(`     Size: ${size} bytes`);
            }
        } catch (error: any) {
            console.log(`  ❌ Exception: ${error.message}`);
        }
    }
    
    console.log('\n3. Testing upload of a new file:');
    try {
        const newFileName = `debug-test-${Date.now()}.jpg`;
        const testContent = 'fake jpeg content for testing';
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('photos')
            .upload(newFileName, testContent, {
                contentType: 'image/jpeg',
                upsert: true
            });
        
        if (uploadError) {
            console.log(`  ❌ Upload failed: ${uploadError.message}`);
        } else {
            console.log(`  ✅ Upload successful: ${uploadData.path}`);
            
            // Try to download it immediately
            const { data: downloadData, error: downloadError } = await supabase.storage
                .from('photos')
                .download(newFileName);
            
            if (downloadError) {
                console.log(`  ❌ Immediate download failed: ${downloadError.message}`);
            } else {
                console.log(`  ✅ Immediate download successful`);
            }
            
            // Clean up
            await supabase.storage.from('photos').remove([newFileName]);
            console.log(`  ✅ Cleaned up test file`);
        }
    } catch (error: any) {
        console.log(`  ❌ Exception: ${error.message}`);
    }
}

debugSpecificFiles().catch(console.error);