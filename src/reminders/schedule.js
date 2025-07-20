// src/reminders/schedule.js
import cron from 'node-cron';
import { bot } from '../bot.js';
import { db } from '../storage/database.js';
import { getAIResponse } from '../ai/openrouter.js';
import { Markup } from 'telegraf';

const sendDailyMotivation = async () => {
    console.log('Running daily motivation job...');
    await db.read(); // Ensure data is fresh
    const users = db.data.users;

    for (const userId in users) {
        try {
            const user = users[userId];
            const motivation = await getAIResponse(
                [{ role: 'user', content: "Generate a powerful, aggressive motivational message for me to wake up to. No fluff." }],
                user.mode
            );
            await bot.telegram.sendMessage(userId, motivation);
        } catch (error) {
            console.error(`Failed to send message to user ${userId}:`, error.message);
        }
    }
};

const sendEveningCheckin = async () => {
    console.log('Running evening check-in job...');
    await db.read();
    const users = db.data.users;

    for (const userId in users) {
        try {
            const user = users[userId];
            if (Object.keys(user.habits).length > 0 || Object.keys(user.addictions).length > 0) {
                 await bot.telegram.sendMessage(
                    userId,
                    "Evening report. Did you conquer the day or did the day conquer you? Answer honestly.",
                    Markup.inlineKeyboard([
                        Markup.button.callback('✅ I Won', 'checkin_yes'),
                        Markup.button.callback('❌ I Lost', 'checkin_no'),
                    ])
                );
            }
        } catch (error) {
            console.error(`Failed to send check-in to user ${userId}:`, error.message);
        }
    }
};

export const startSchedules = () => {
    // Schedule to run at 6:00 AM every day
    cron.schedule('0 6 * * *', sendDailyMotivation, {
        timezone: "Asia/Tashkent"
    });

    // Schedule to run at 9:00 PM (21:00) every day
    cron.schedule('0 21 * * *', sendEveningCheckin, {
        timezone: "Asia/Tashkent"
    });

    console.log('Cron jobs for motivation and check-ins have been scheduled.');
};