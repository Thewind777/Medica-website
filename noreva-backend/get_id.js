
const fs = require('fs');
try {
    const content = fs.readFileSync('kv_list.json', 'utf16le');
    const matches = [];
    const re = /"id":\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        matches.push(m[1]);
    }
    console.log("IDs found:", matches.join(', '));

    const titleRe = /"title":\s*"([^"]+)"/g;
    while ((m = titleRe.exec(content)) !== null) {
        console.log("Title found:", m[1]);
    }

} catch (e) {
    console.log(e.message);
}
