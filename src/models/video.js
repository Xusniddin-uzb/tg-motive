// src/models/video.js
import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema({
    categoryId: { type: String, required: true, index: true },
    fileId: { type: String, required: true, unique: true },
});

export const Video = mongoose.model('Video', videoSchema);