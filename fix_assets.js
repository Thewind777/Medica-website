
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_DIR = path.join(__dirname, 'assets');

console.log('Starting Asset Fix...');

const files = fs.readdirSync(ASSETS_DIR);

for (const file of files) {
    if (file.endsWith('.tmp')) {
        const tempPath = path.join(ASSETS_DIR, file);
        const targetName = file.replace('.tmp', '');
        const targetPath = path.join(ASSETS_DIR, targetName);

        console.log(`Fixing: ${targetName}`);

        try {
            // Force delete target if it exists (avoids EPERM on overwrite sometimes)
            if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
                console.log(`  Deleted existing target: ${targetName}`);
            }

            // Rename tmp to target
            fs.renameSync(tempPath, targetPath);
            console.log(`  Renamed .tmp to: ${targetName}`);

        } catch (e) {
            console.error(`  ERROR fixing ${file}: ${e.message}`);
        }
    }
}

// Second pass: Ensure everything is lowercase
const finalFiles = fs.readdirSync(ASSETS_DIR);
for (const file of finalFiles) {
    if (file === file.toLowerCase()) continue;

    const oldPath = path.join(ASSETS_DIR, file);
    const newPath = path.join(ASSETS_DIR, file.toLowerCase());

    // Rename case only
    try {
        fs.renameSync(oldPath, newPath);
        console.log(`Lowercased: ${file} -> ${file.toLowerCase()}`);
    } catch (e) {
        console.error(`  ERROR lowercasing ${file}: ${e.message}`);
    }
}

console.log('Fix Complete.');
