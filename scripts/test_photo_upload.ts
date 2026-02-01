
import fetch from 'node-fetch';
import fs from 'fs';

async function testUpload() {
  const apiUrl = 'https://meter-reader-backend.onrender.com'; 
  
  // Dummy 1x1 pixel white JPEG in base64
  const dummyBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAFA3PEY8ED5GWEZGPDpCUXFiS0VEXFhceGxcamViayZlZWRpZHRtc3Rxc3RlbXV2eH6He3p7f8S9f8L/2wBDATpGPDpCUXFiS0VEXFhceGxcamViayZlZWRpZHRtc3Rxc3RlbXV2eH6He3p7f8S9f8L/2wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc_1eJv/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECBA1ADRBRAhEhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4_T15ufo6erx8vP09fb3_Pn6/9oADAMBAAIRAxEAPwD5fof_2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCABAAEADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf_xAAUEAEAAAAAAAAAAAAAAAAAAAAA_8QAFAEBAAAAAAAAAAAAAAAAAAAAAP_EABQRAAAAAAAAAAAAAAAAAAAAAP_aAAwDAQACE MEMBERS OF THE BOARD OF DIRECTORS:';
  const fileName = `test_photo_${Date.now()}.jpg`;

  console.log(`Testing upload for file: ${fileName}...`);

  try {
    const response = await fetch(`${apiUrl}/api/upload-photo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        photoBase64: dummyBase64,
        fileName: fileName,
      }),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Upload Successful!');
      console.log('Result:', result);
      console.log(`Verify photo at: ${apiUrl}/api/photo/${result.photoPath}`);
    } else {
      console.error('❌ Upload Failed!');
      console.error('Status:', response.status);
      console.error('Error:', result);
    }
  } catch (error) {
    console.error('❌ Error connecting to server:', error.message);
  }
}

testUpload();
