import 'dotenv/config';
import mongoose from 'mongoose';
import { bot } from './bot.js';
import { scheduleJobs } from './reminders/schedule.js'; // <-- FIX: Import scheduleJobs

async function main() {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not defined in the .env file. Bot cannot start.');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');

    await bot.telegram.setMyCommands([
        { command: 'start', description: 'Restart the bot & see the menu' },
        { command: 'toolkit', description: 'Show the main toolkit menu' },
        { command: 'motivate', description: 'Get a dose of harsh motivation' },
        { command: 'progress', description: 'View your streaks and stats' },
        { command: 'checkin', description: 'Check in your daily habits' },
        { command: 'journal', description: 'Open the journal menu' },
        { command: 'score', description: 'Check your daily Focus Score' },
        { command: 'videos', description: 'Get motivational videos' },
        { command: 'help', description: 'Show help and instructions' } // <-- FIX: Add the help command here

    ]);
    
    // <-- FIX: Pass the 'bot' object to the scheduling function
    scheduleJobs(bot);

    // This line starts the bot that is defined in src/bot.js
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