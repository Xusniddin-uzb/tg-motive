// src/storage/database.js
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';

// Since we are using ES Modules, __dirname is not available directly.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file = path.join(__dirname, 'data.json');

// Configure lowdb to write to JSONFile
const adapter = new JSONFile(file);
const db = new Low(adapter, { users: {} }); // Default data

// Read data from JSON file, this will set db.data content
await db.read();

export { db };