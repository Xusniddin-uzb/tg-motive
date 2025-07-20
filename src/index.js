// index.js
import 'dotenv/config';
import mongoose from 'mongoose';
import { bot } from './bot.js';
import { startSchedules } from './reminders/schedule.js';

async function main() {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not defined in the .env file. Bot cannot start.');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');

    // <-- NEW: Set the bot commands for the menu button
    await bot.telegram.setMyCommands([
        { command: 'start', description: 'Restart the bot & see the menu' },
        { command: 'motivate', description: 'Get a dose of harsh motivation' },
        { command: 'progress', description: 'View your streaks and stats' },
        { command: 'checkin', description: 'Check in your daily habits' },
        { command: 'journal', description: 'Write a new journal entry' },
        { command: 'score', description: 'Check your daily Focus Score' },
        { command: 'videos', description: 'Get motivational videos' },
        { command: 'toolkit', description: 'Show the main toolkit menu' },
    ]);
    
    startSchedules();

    bot.launch();
    console.log('✅ Discipline AI Bot is running...');

    const stopBot = async () => {
        console.log('Stopping bot and disconnecting from MongoDB...');
        bot.stop('SIGINT');
        await mongoose.disconnect();
        process.exit(0);
    };

    process.once('SIGINT', stopBot);
    process.once('SIGTERM', stopBot);
}

main().catch(error => {
    console.error("❌ Fatal error during startup:", error);
    process.exit(1);
});