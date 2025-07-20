// src/models/user.js
import mongoose from 'mongoose';

const habitSchema = new mongoose.Schema({
    habitId: { type: String, required: true, unique: true, sparse: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['binary', 'quantitative'], required: true },
    unit: { type: String, default: '' },
    streak: { type: Number, default: 0 },
    progress: { type: Number, default: 0 },
});

const addictionSchema = new mongoose.Schema({
    addictionId: { type: String, required: true, unique: true, sparse: true },
    name: { type: String, required: true },
    why: { type: String, required: true },
    streak: { type: Number, default: 0 },
});

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    habits: [habitSchema],
    addictions: [addictionSchema],
    mode: { type: String, default: 'normal' },
    focusScore: { type: Number, default: 0 },
    lastInteraction: { type: String, default: null },
});

export const User = mongoose.model('User', userSchema);