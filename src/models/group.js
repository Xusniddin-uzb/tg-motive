import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
    groupId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
});

export const Group = mongoose.model('Group', groupSchema);