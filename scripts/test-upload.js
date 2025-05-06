const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000/api';
const TOKEN = 'YOUR_JWT_TOKEN'; // Replace with your actual JWT token

async function testFileUpload() {
  try {
    // 1. Upload a resource material
    console.log('\n1. Testing Resource Material Upload:');
    const resourceForm = new FormData();
    resourceForm.append('file', fs.createReadStream(path.join(__dirname, 'test-files', 'sample.pdf')));
    resourceForm.append('title', 'Test Resource');
    resourceForm.append('description', 'Test Description');

    const resourceResponse = await fetch(`${API_URL}/upload/resource-material`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: resourceForm
    });

    const resourceData = await resourceResponse.json();
    console.log('Resource Upload Response:', resourceData);

    // 2. Upload a quiz image
    console.log('\n2. Testing Quiz Image Upload:');
    const quizId = 'YOUR_QUIZ_ID'; // Replace with an actual quiz ID
    const imageForm = new FormData();
    imageForm.append('file', fs.createReadStream(path.join(__dirname, 'test-files', 'sample.jpg')));

    const imageResponse = await fetch(`${API_URL}/upload/quiz/${quizId}/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: imageForm
    });

    const imageData = await imageResponse.json();
    console.log('Image Upload Response:', imageData);

    // 3. Test file retrieval
    console.log('\n3. Testing File Retrieval:');
    if (resourceData.fileUrl) {
      const fileResponse = await fetch(resourceData.fileUrl);
      console.log('File accessible:', fileResponse.ok);
    }

  } catch (error) {
    console.error('Error testing uploads:', error);
  }
}

// Create test files directory and sample files
const testDir = path.join(__dirname, 'test-files');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir);
}

// Create a sample PDF file
fs.writeFileSync(
  path.join(testDir, 'sample.pdf'),
  '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'
);

// Create a sample JPG file
fs.writeFileSync(
  path.join(testDir, 'sample.jpg'),
  Buffer.from('fake jpg content')
);

console.log('Test files created. Running upload tests...');
testFileUpload(); 