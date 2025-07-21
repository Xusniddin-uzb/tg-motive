// src/reminders/schedule.js
import cron from 'node-cron';
import { bot } from '../bot.js';
import { getAIResponse } from '../ai/openrouter.js';
import { Markup } from 'telegraf';
import { User, Group, Goal } from '../models/index.js';

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
async function sendGoalMotivation(bot) {
    console.log('Running daily goal motivation job...');
    const usersWithGoals = await User.find({
        _id: { $in: await Goal.distinct('userId', { status: 'active' }) }
    });

    for (const user of usersWithGoals) {
        try {
            const goals = await Goal.find({ userId: user.userId, status: 'active' });
            if (goals.length === 0) continue;

            const goalText = goals.map(g => `- ${g.description} (by ${g.targetDate.toLocaleDateString()})`).join('\n');
            
            const prompt = [{ role: 'user', content: `I am a user of your motivational bot. My active goals are:\n${goalText}\n\nGenerate a short, powerful, personalized message for me this morning to remind me of my mission and push me to work on these goals TODAY. Be direct and intense.` }];
            
            const motivation = await getAIResponse(prompt, user.mode);
            
            await bot.telegram.sendMessage(user.userId, motivation, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error(`Failed to send goal motivation to user ${user.userId}:`, error.message);
        }
    }
    console.log('Daily goal motivation job finished.');
}
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

export const scheduleJobs = (bot) => {
    cron.schedule('0 9 * * *', () => scheduleDailyCheckin(bot));
    cron.schedule('0 8 * * *', () => sendGoalMotivation(bot));

    console.log('Cron jobs scheduled: Daily Check-in (9am) and Goal Motivation (8am).');
}