import 'dotenv/config';
import { db } from '../server/db';
import { readings } from '@shared/schema';
import { sql } from 'drizzle-orm';

async function checkReadings() {
    console.log('Checking readings with photos...');
    
    const readingsWithPhotos = await db
        .select()
        .from(readings)
        .where(sql`${readings.photoPath} IS NOT NULL`)
        .limit(10);
    
    console.log(`Found ${readingsWithPhotos.length} readings with photos:`);
    readingsWithPhotos.forEach(reading => {
        console.log(`- ID: ${reading.id}, Photo Path: ${reading.photoPath}`);
    });
    
    // Check if any have the old PHOTOS bucket format
    const oldFormatReadings = readingsWithPhotos.filter(r => 
        r.photoPath && r.photoPath.includes('PHOTOS/')
    );
    
    if (oldFormatReadings.length > 0) {
        console.log(`\nFound ${oldFormatReadings.length} readings with old PHOTOS format:`);
        oldFormatReadings.forEach(reading => {
            console.log(`- ID: ${reading.id}, Photo Path: ${reading.photoPath}`);
        });
    }
}

checkReadings().catch(console.error);