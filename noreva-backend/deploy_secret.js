
import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the JSON file from the parent directory
const jsonPath = path.join(__dirname, '..', 'rozana-484317-8e7cb4ea773f.json');
console.log(`Reading JSON from: ${jsonPath}`);

try {
    const rawContent = readFileSync(jsonPath, 'utf8');
    // Parse and stringify to ensure it is valid compressed JSON (single line)
    const minified = JSON.stringify(JSON.parse(rawContent));

    console.log('Uploading secret GOOGLE_SERVICE_ACCOUNT_JSON...');

    const child = spawn('npx.cmd', ['wrangler', 'secret', 'put', 'GOOGLE_SERVICE_ACCOUNT_JSON'], {
        cwd: __dirname, // Run in noreva-backend dir
        stdio: ['pipe', 'inherit', 'inherit'],
        shell: true
    });

    child.stdin.write(minified);
    child.stdin.end();

    child.on('close', (code) => {
        if (code === 0) {
            console.log('Secret uploaded successfully!');
        } else {
            console.error(`Upload failed with code ${code}`);
            process.exit(code);
        }
    });

    child.on('error', (err) => {
        console.error('Spawn error:', err);
    });

} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
}
