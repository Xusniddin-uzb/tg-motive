import mongoose from 'mongoose';

const goalSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    description: { type: String, required: true },
    targetDate: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'completed'], default: 'active' }
});

export const Goal = mongoose.model('Goal', goalSchema);