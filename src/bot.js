// src/bot.js
import { Telegraf, Markup } from 'telegraf';
import { getAIResponse } from './ai/openrouter.js';
import { db } from './storage/database.js';
import { nanoid } from 'nanoid';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Simple in-memory state management
const userStates = {};

// Helper to ensure user exists in DB
const ensureUser = async (ctx) => {
    const userId = ctx.from.id;
    if (!db.data.users[userId]) {
        db.data.users[userId] = {
            id: userId,
            habits: {},
            addictions: {},
            mode: 'normal', // 'normal' or 'elite'
            streaks: {},
        };
        await db.write();
    }
    return db.data.users[userId];
};

// Reusable inline keyboard
const mainKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('💪 Motivate Me', 'motivate_me')],
    [Markup.button.callback('🧠 Set Habit', 'set_habit'), Markup.button.callback('🚫 Quit Addiction', 'quit_addiction')],
    [Markup.button.callback('📊 View Progress', 'view_progress')],
]);

// --- COMMANDS ---

bot.start(async (ctx) => {
    await ensureUser(ctx);
    const welcomeMessage = await getAIResponse([{ role: 'user', content: 'Give me a harsh, short welcome message for a user starting your discipline program.' }]);
    ctx.reply(welcomeMessage, mainKeyboard);
});

bot.command('motivate', async (ctx) => {
    const user = await ensureUser(ctx);
    const motivation = await getAIResponse(
        [{ role: 'user', content: 'Give me a custom, harsh motivational message right now. Be aggressive.' }],
        user.mode
    );
    ctx.reply(motivation);
});

bot.command('addhabit', async (ctx) => {
    await ensureUser(ctx);
    userStates[ctx.from.id] = 'awaiting_habit';
    const response = await getAIResponse([{ role: 'user', content: 'Ask me what habit I want to build. Be direct.' }]);
    ctx.reply(response);
});

bot.command('addaddiction', async (ctx) => {
    await ensureUser(ctx);
    userStates[ctx.from.id] = 'awaiting_addiction';
    const response = await getAIResponse([{ role: 'user', content: 'Ask me what addiction I want to quit. Be blunt.' }]);
    ctx.reply(response);
});

bot.command('checkin', async (ctx) => {
    const user = await ensureUser(ctx);
    if (Object.keys(user.habits).length === 0 && Object.keys(user.addictions).length === 0) {
        return ctx.reply("You haven't set any habits or addictions to track. Use /addhabit or /addaddiction first.");
    }
    ctx.reply(
        'Time to report. Did you stick to the plan today?',
        Markup.inlineKeyboard([
            Markup.button.callback('✅ Yes, I did it.', 'checkin_yes'),
            Markup.button.callback('❌ No, I failed.', 'checkin_no'),
        ])
    );
});

bot.command('why', async (ctx) => {
    const user = await ensureUser(ctx);
    const addictions = Object.values(user.addictions);
    if (addictions.length === 0) {
        return ctx.reply("You haven't logged an addiction to quit. Nothing to see here.");
    }
    const whyMessages = addictions.map(a => `Addiction: ${a.name}\nYour Reason: "${a.why}"`).join('\n\n');
    const aiResponse = await getAIResponse(
        [{ role: 'user', content: `The user wants to be reminded of why they started. Their reasons are:\n${whyMessages}\n\nGenerate a powerful message to remind them to stay strong.` }],
        user.mode
    );
    ctx.reply(aiResponse);
});

bot.command('eliteon', async (ctx) => {
    const user = await ensureUser(ctx);
    user.mode = 'elite';
    await db.write();
    ctx.reply('Elite mode engaged. Expect maximum intensity. No more games.');
});

bot.command('eliteoff', async (ctx) => {
    const user = await ensureUser(ctx);
    user.mode = 'normal';
    await db.write();
    ctx.reply('Elite mode disengaged. Back to standard procedure.');
});

// --- STATE-BASED TEXT HANDLING ---

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const state = userStates[userId];
    if (!state) return; // Ignore if no state

    const user = await ensureUser(ctx);
    const text = ctx.message.text;

    if (state === 'awaiting_habit') {
        const habitId = nanoid();
        user.habits[habitId] = { id: habitId, name: text, streak: 0, lastCheck: null };
        userStates[userId] = null; // Clear state
        await db.write();
        const response = await getAIResponse(
            [{ role: 'user', content: `Acknowledge that I've set the habit: "${text}". Tell me not to fail.` }],
            user.mode
        );
        ctx.reply(response, mainKeyboard);
    } else if (state === 'awaiting_addiction') {
        userStates[userId] = { stage: 'awaiting_why', name: text };
        const response = await getAIResponse(
            [{ role: 'user', content: `Now ask me WHY I want to quit "${text}". Make it deep and searching.` }],
            user.mode
        );
        ctx.reply(response);
    } else if (state && state.stage === 'awaiting_why') {
        const addictionId = nanoid();
        const addictionName = state.name;
        user.addictions[addictionId] = { id: addictionId, name: addictionName, why: text, streak: 0, lastCheck: null };
        userStates[userId] = null; // Clear state
        await db.write();
        const response = await getAIResponse(
            [{ role: 'user', content: `Confirm that I'm trying to quit "${addictionName}" because of "${text}". Tell me this reason is my anchor.` }],
            user.mode
        );
        ctx.reply(response, mainKeyboard);
    }
});


// --- INLINE BUTTON ACTIONS ---

bot.action('motivate_me', async (ctx) => {
    await ctx.answerCbQuery();
    await bot.telegram.sendMessage(ctx.from.id, '/motivate'); // Trigger command
    ctx.reply("Command triggered.", { reply_markup: { remove_keyboard: true } });
});

bot.action('set_habit', async (ctx) => {
    await ctx.answerCbQuery();
    await bot.telegram.sendMessage(ctx.from.id, '/addhabit');
    ctx.reply("Command triggered.", { reply_markup: { remove_keyboard: true } });
});

bot.action('quit_addiction', async (ctx) => {
    await ctx.answerCbQuery();
    await bot.telegram.sendMessage(ctx.from.id, '/addaddiction');
    ctx.reply("Command triggered.", { reply_markup: { remove_keyboard: true } });
});


bot.action('checkin_yes', async (ctx) => {
    const userId = ctx.from.id;
    const user = await ensureUser(ctx);
    
    // Logic to update streaks
    Object.keys(user.habits).forEach(id => user.habits[id].streak++);
    Object.keys(user.addictions).forEach(id => user.addictions[id].streak++);
    await db.write();

    const response = await getAIResponse(
        [{ role: 'user', content: `I completed my habits and stayed clean today. Give me a response that acknowledges the win but tells me not to get comfortable. My current streak is now ${Object.values(user.habits)[0]?.streak || Object.values(user.addictions)[0]?.streak || 1} days.` }],
        user.mode
    );
    await ctx.editMessageText(response);
});

bot.action('checkin_no', async (ctx) => {
    const userId = ctx.from.id;
    const user = await ensureUser(ctx);

    // Logic to reset streaks
    Object.keys(user.habits).forEach(id => user.habits[id].streak = 0);
    Object.keys(user.addictions).forEach(id => user.addictions[id].streak = 0);
    await db.write();
    
    const response = await getAIResponse(
        [{ role: 'user', content: `I failed my check-in today. I gave in. Be harsh. Tell me I'm weak for failing but that tomorrow is a new day to fight.` }],
        user.mode
    );
    await ctx.editMessageText(response);
});

bot.action('view_progress', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await ensureUser(ctx);
    let progressReport = "Here's your status:\n\n";

    progressReport += "--- HABITS ---\n";
    if(Object.keys(user.habits).length > 0) {
        Object.values(user.habits).forEach(h => {
            progressReport += `- ${h.name}: ${h.streak}-day streak 🔥\n`;
        });
    } else {
        progressReport += "No habits set.\n";
    }

    progressReport += "\n--- ADDICTIONS ---\n";
     if(Object.keys(user.addictions).length > 0) {
        Object.values(user.addictions).forEach(a => {
            progressReport += `- ${a.name}: ${a.streak} days clean ✅\n`;
        });
    } else {
        progressReport += "No addictions to quit.\n";
    }

    ctx.reply(progressReport, mainKeyboard);
});

export { bot };