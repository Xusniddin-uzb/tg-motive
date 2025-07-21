import mongoose from 'mongoose';

const journalEntrySchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    content: { type: String, required: true },
    date: { type: Date, default: Date.now,  expires: '365d' }
});

export const JournalEntry = mongoose.model('JournalEntry', journalEntrySchema);