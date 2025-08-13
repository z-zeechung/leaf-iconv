const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const zipFilePath = './icu-data.zip';
const targetFolderInZip = 'icu-data-main/charset/data/ucm/';
const outputFolder = './meta/ucm/';

if (!fs.existsSync(outputFolder)) {
  fs.mkdirSync(outputFolder, { recursive: true });
}

const zip = new AdmZip(zipFilePath);
const zipEntries = zip.getEntries();

zipEntries.forEach((entry) => {

  if (entry.entryName.startsWith(targetFolderInZip) && !entry.isDirectory) {
    
    const relativePath = entry.entryName.substring(targetFolderInZip.length);
    const fullOutputPath = path.join(outputFolder, relativePath);
    
    
    const dir = path.dirname(fullOutputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    
    zip.extractEntryTo(entry, path.dirname(fullOutputPath), false, true, path.basename(fullOutputPath));
    console.log(`decompress: ${entry.entryName} -> ${fullOutputPath}`);
  }
});

console.log('decompressed');