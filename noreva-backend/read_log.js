
const fs = require('fs');
try {
    const content = fs.readFileSync('dry_kv.log', 'utf16le');
    console.log(content);
} catch (e) {
    console.log("Error reading utf16le, trying utf8");
    try {
        const content = fs.readFileSync('dry_kv.log', 'utf8');
        console.log(content);
    } catch (e2) {
        console.log(e2.message);
    }
}
