const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;
    
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`failed to request: ${response.statusCode}`));
        return;
      }

      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const fileStream = fs.createWriteStream(filePath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(filePath);
      });

      fileStream.on('error', (err) => {
        fs.unlink(filePath, () => {}); 
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

const fileUrl = 'https://codeload.github.com/unicode-org/icu-data/zip/refs/heads/main';
const savePath = './icu-data.zip';

downloadFile(fileUrl, savePath)
  .then(() => console.log(`downloaded ${path.basename(savePath)}`))
  .catch(err => console.error('failed to download:', err));