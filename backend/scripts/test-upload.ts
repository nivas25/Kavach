import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

async function runTest() {
  const dummyFilePath = path.join(__dirname, 'dummy.txt');
  fs.writeFileSync(dummyFilePath, 'dummy contract content');

  const form = new FormData();
  form.append('file', fs.createReadStream(dummyFilePath));
  form.append('userType', 'Job Seeker');

  console.log('Sending upload request to Fastify...');
  try {
    const res = await fetch('http://localhost:8080/api/documents/upload', {
      method: 'POST',
      body: form
    });
    
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (err) {
    console.error('Request failed:', err);
  } finally {
    fs.unlinkSync(dummyFilePath);
  }
}

runTest();
