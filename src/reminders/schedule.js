// src/reminders/schedule.js
import cron from 'node-cron';
import { bot } from '../bot.js';
import { getAIResponse } from '../ai/openrouter.js';
import { Markup } from 'telegraf';
import { User, Group } from '../models/index.js';

const sendDailyMotivation = async () => {
    console.log('⏰ Running daily 6 AM motivation job...');
    const users = await User.find({}, 'userId mode');
    const groups = await Group.find({}, 'groupId');
    const allChatIds = [...users.map(u => u.userId), ...groups.map(g => g.groupId)];
    
    const uniqueChatIds = new Set(allChatIds);

    for (const chatId of uniqueChatIds) {
        try {
            const user = users.find(u => u.userId === chatId);
            const userMode = user ? user.mode : 'normal';
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
    const users = await User.find({ $or: [{ 'habits.0': { $exists: true } }, { 'addictions.0': { $exists: true } }] });

    for (const user of users) {
        try {
            await bot.telegram.sendMessage(
                user.userId,
                "Evening report. Did you conquer the day or did the day conquer you? Answer honestly.",
                Markup.inlineKeyboard([
                    Markup.button.callback('✅ I Won', 'checkin_yes_all'), // Simplified check-in
                    Markup.button.callback('❌ I Lost', 'checkin_no_all'),
                ])
            );
        } catch (error) {
            console.error(`Failed to send check-in to user ${user.userId}:`, error.message);
        }
    }
};

export const startSchedules = () => {
    const timezone = process.env.TIMEZONE || 'Asia/Tashkent';

    cron.schedule('0 6 * * *', sendDailyMotivation, { timezone });
    cron.schedule('0 21 * * *', sendEveningCheckin, { timezone });

    console.log(`✅ Cron jobs scheduled in timezone: ${timezone}`);
};