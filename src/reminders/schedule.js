// src/reminders/schedule.js
import cron from 'node-cron';
import { bot } from '../bot.js';
import { db } from '../storage/database.js';
import { getAIResponse } from '../ai/openrouter.js';
import { Markup } from 'telegraf';

const sendDailyMotivation = async () => {
    console.log('⏰ Running daily 6 AM motivation job...');
    await db.read();
    const { users, groups } = db.data;
    const allChatIds = [...Object.keys(users), ...Object.keys(groups)];
    
    const uniqueChatIds = new Set(allChatIds);

    for (const chatId of uniqueChatIds) {
        try {
            const userMode = users[chatId]?.mode || 'normal';
            const motivation = await getAIResponse(
                [{ role: 'user', content: "Generate a powerful, aggressive motivational message for me to wake up to. Short and punchy." }],
                userMode
            );
            await bot.telegram.sendMessage(chatId, motivation);
        } catch (error) {
            console.error(`Failed to send motivation to chat ${chatId}:`, error.message);
        }
    }
};

const sendEveningCheckin = async () => {
    console.log('⏰ Running evening 9 PM check-in job...');
    await db.read();
    const { users } = db.data;

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
    const timezone = process.env.TIMEZONE || 'Asia/Tashkent';

    cron.schedule('0 6 * * *', sendDailyMotivation, { timezone });
    cron.schedule('0 21 * * *', sendEveningCheckin, { timezone });

    console.log(`✅ Cron jobs scheduled in timezone: ${timezone}`);
};