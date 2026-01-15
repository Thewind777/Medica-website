
const fs = require('fs');
try {
    const content = fs.readFileSync('kv_list.json', 'utf16le');
    const re = /"id":\s*"([^"]+)"/;
    const m = re.exec(content);
    if (m) {
        fs.writeFileSync('id.txt', m[1], 'utf8');
        console.log("Written to id.txt");
    } else {
        console.log("No match");
    }
} catch (e) {
    console.log(e.message);
}
