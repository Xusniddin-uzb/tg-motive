// src/storage/database.js
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Modules require this setup to get __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to your JSON file
const file = path.join(__dirname, 'data.json');

const adapter = new JSONFile(file);
const defaultData = { users: {}, groups: {} };
const db = new Low(adapter, defaultData);

// Read data from JSON file, this will set db.data content
await db.read();

export { db };