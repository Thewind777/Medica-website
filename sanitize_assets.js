
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, 'assets');
const LOG_FILE = path.join(__dirname, 'sanitization_v2.log');

function log(message) {
    console.log(message);
    fs.appendFileSync(LOG_FILE, message + '\n');
}

/**
 * Normalizes filename:
 * 1. Lowercase
 * 2. Replace spaces with dashes
 * 3. Removes extension for comparison
 */
function normalizeName(filename) {
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);
    return name.toLowerCase().replace(/\s+/g, '-');
}

async function sanitizeAssets() {
    log('Starting Asset Sanitization (ESM)...');

    if (!fs.existsSync(ASSETS_DIR)) {
        log('Assets directory not found!');
        return;
    }

    const files = fs.readdirSync(ASSETS_DIR);
    const processedCodes = new Set();

    for (const file of files) {
        if (file.startsWith('.')) continue; // Skip hidden

        const originalPath = path.join(ASSETS_DIR, file);
        try {
            const stats = fs.statSync(originalPath);
            if (stats.isDirectory()) continue;
        } catch (e) {
            continue;
        }

        const ext = path.extname(file).toLowerCase();
        if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
            continue;
        }

        const normalizedBase = normalizeName(file);
        const newFilename = `${normalizedBase}.webp`;
        const newPath = path.join(ASSETS_DIR, newFilename);

        // If it's already WebP and correctly named (lowercase etc), just track it
        if (ext === '.webp' && file === newFilename) {
            processedCodes.add(normalizedBase);
            continue;
        }

        try {
            log(`Processing: ${file} -> ${newFilename}`);

            // Convert using Sharp
            const tempPath = newPath + '.tmp';
            await sharp(originalPath)
                .webp({ quality: 80 })
                .toFile(tempPath);

            // If successful, rename tmp to target
            // If target exists (and is different file), we overwrite it (dedupe)
            // But if target IS original (e.g. converting foo.webp to foo.webp - handled above), 
            // Here target != originalPath because ext is different OR case is different

            fs.renameSync(tempPath, newPath);

            // Delete original ONLY if it is not the new file
            // (Windows is case-insensitive, so 'NOR100.png' vs 'nor100.png' are different files? No, same file if name matches case-insensitive. But here new extensin is .webp)
            // If original was .png, verify we aren't deleting something we shouldn't.
            if (originalPath.toLowerCase() !== newPath.toLowerCase()) {
                fs.unlinkSync(originalPath);
                log(`Deleted original: ${file}`);
            }

            processedCodes.add(normalizedBase);

        } catch (err) {
            log(`ERROR processing ${file}: ${err.message}`);
        }
    }

    log('Sanitization Complete.');
}

sanitizeAssets();
