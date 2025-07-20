// index.js
import 'dotenv/config';
import { bot } from './src/bot.js';
import { startSchedules } from './src/reminders/schedule.js';
import { db } from './src/storage/database.js';

async function main() {
    // Start the cron jobs
    startSchedules();

    // Launch the bot
    bot.launch();
    console.log('Discipline AI Bot is running...');

    // Enable graceful stop
    process.once('SIGINT', async () => {
        await db.write(); // Ensure data is saved before exit
        bot.stop('SIGINT');
    });
    process.once('SIGTERM', async () => {
        await db.write(); // Ensure data is saved before exit
        bot.stop('SIGTERM');
    });
}

main().catch(console.error);