
const fs = require('fs');
try {
    // Try utf16le first as per error message
    const content = fs.readFileSync('kv_list.json', 'utf16le');
    console.log(content);
} catch (e) {
    console.log('Error reading utf16le, trying utf8');
    const content = fs.readFileSync('kv_list.json', 'utf8');
    console.log(content);
}
