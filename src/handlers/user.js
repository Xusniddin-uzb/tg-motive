import { Markup } from 'telegraf';
import { nanoid } from 'nanoid';
import { getAIResponse } from '../ai/openrouter.js';
import { User, Group, Video, JournalEntry, Goal } from '../models/index.js';
import { userKeyboard, videoCategoryKeyboard, adminOrUserKeyboard, swearKeyboard, journalKeyboard } from '../keyboards/keyboards.js';

export const userStates = {};
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

// --- DATABASE & SCORE HELPERS ---
export const ensureUser = async (ctx) => {
    const userId = ctx.from.id;
    let user = await User.findOne({ userId: userId });

    if (!user) {
        user = new User({
            userId: userId,
            name: ctx.from.first_name || 'User',
            username: ctx.from.username,
        });
        await user.save();
    }
    if (!user.username && ctx.from.username) {
        user.username = ctx.from.username;
        await user.save();
    }
    return user;
};

export function updateFocusScore(user, points) {
    const today = new Date().toISOString().slice(0, 10);
    if (user.lastInteraction !== today) {
        user.focusScore = 0;
    }
    user.focusScore += points;
    user.lastInteraction = today;
}

// --- CORE ACTION HANDLERS ---

export async function handleStart(ctx) {
    await ensureUser(ctx);
    if (ctx.from.id.toString() === ADMIN_USER_ID) {
        return ctx.reply('Welcome, Admin. How do you wish to proceed?', adminOrUserKeyboard);
    }
    
    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
    const prompt = [{ role: 'user', content: `Generate a brutally short and intense message demanding a new user's commitment. Tell them to swear an oath by pressing the button. ABSOLUTE MAXIMUM 3 sentences.` }];
    const oathMessage = await getAIResponse(prompt);
    
    await ctx.replyWithMarkdown(oathMessage, swearKeyboard);
}

export async function handleSwear(ctx) {
    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
    const prompt = [{ role: 'user', content: `The user just swore an oath to be honest. Give a short, sharp acknowledgment. Something like 'Good. The contract is sealed.' Then welcome them.` }];
    const welcomeMessage = await getAIResponse(prompt);
    await ctx.editMessageText(welcomeMessage);
    await ctx.reply('Your toolkit is below.', userKeyboard);
}

export async function handleMotivate(ctx) {
    const user = await ensureUser(ctx);
    updateFocusScore(user, 1);
    await user.save();
    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
    const prompt = [{ role: 'user', content: `Give me a single, hard-hitting piece of advice about discipline, wealth, or mental toughness right now. Be direct.` }];
    const motivation = await getAIResponse(prompt, user.mode);
    await ctx.replyWithMarkdown(motivation);
}

export async function handleAddHabit(ctx) {
    if (ctx.chat.type !== 'private') return ctx.reply('Set habits in a private chat with me.');
    userStates[ctx.from.id] = { stage: 'awaiting_habit_name' };
    await ctx.reply('🧠 What is the new habit? Be specific (e.g., "Read a book," "Go for a run").');
}

export async function handleAddAddiction(ctx) {
    if (ctx.chat.type !== 'private') return ctx.reply('Set addictions in a private chat with me.');
    userStates[ctx.from.id] = { stage: 'awaiting_addiction' };
    await ctx.reply('🚫 What addiction are you ready to destroy? Name it.');
}

export async function handleViewProgress(ctx) {
    if (ctx.chat.type !== 'private') return ctx.reply('View your progress in a private chat with me.');
    const user = await ensureUser(ctx);
    
    let report = `📊 **YOUR STATUS REPORT** 📊\n\n`;
    report += `🎯 **Today's Focus Score:** ${user.focusScore || 0}\n\n`;
    report += "--- HABITS ---\n";
    if (user.habits.length > 0) {
        user.habits.forEach(h => {
            const progress = h.progress ? `(Today: ${h.progress} ${h.unit || ''})` : '';
            report += `- ${h.name}: **${h.streak}-day streak** 🔥 ${progress}\n`;
        });
    } else {
        report += "_No habits set. Define your discipline._\n";
    }
    report += "\n--- ADDICTIONS ---\n";
    if (user.addictions.length > 0) {
        user.addictions.forEach(a => {
            report += `- Quitting ${a.name}: **${a.streak} days clean** ✅\n`;
        });
    } else {
        report += "_No addictions logged. Define your enemy._\n";
    }
    await ctx.replyWithMarkdown(report, userKeyboard);
}

export async function handleRelapse(ctx) {
    if (ctx.chat.type !== 'private') return ctx.reply('Report a relapse in a private chat with me.');
    const user = await ensureUser(ctx);
    if (user.addictions.length === 0) return ctx.reply("You have no addictions logged to relapse on. Focus.");
    
    const buttons = user.addictions.map(addiction => Markup.button.callback(addiction.name, `relapse_${addiction.addictionId}`));
    const keyboard = Markup.inlineKeyboard(buttons, { columns: 1 });
    await ctx.reply('Which demon got you? Report it.', keyboard);
}


// --- JOURNAL & GOAL HANDLERS ---

export async function handleJournal(ctx) {
    if (ctx.chat.type !== 'private') return ctx.reply('Use the journal in a private chat with me.');
    await ctx.editMessageText('📓 Journal & Goals Menu', journalKeyboard);
}

export async function handleNewJournalEntry(ctx) {
    userStates[ctx.from.id] = { stage: 'awaiting_journal_entry' };
    await ctx.editMessageText('✍️ Write your journal entry. What were your wins and losses today?');
}

export async function handleSetNewGoal(ctx) {
    userStates[ctx.from.id] = { stage: 'awaiting_goal_description' };
    await ctx.editMessageText('🎯 What is your goal? Be specific and measurable.');
}

async function viewJournalEntryByDate(ctx, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const entry = await JournalEntry.findOne({
        userId: ctx.from.id,
        date: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ date: -1 });

    if (entry) {
        const message = `*Entry from ${startOfDay.toDateString()}:*\n\n${entry.content}`;
        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            ...journalKeyboard
        });
    } else {
        await ctx.answerCbQuery({ text: `No entry found for ${startOfDay.toDateString()}.`, show_alert: true });
    }
}

export async function handleViewToday(ctx) {
    await viewJournalEntryByDate(ctx, new Date());
}

export async function handleViewYesterday(ctx) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await viewJournalEntryByDate(ctx, yesterday);
}

export async function handleViewGoals(ctx) {
    const goals = await Goal.find({ userId: ctx.from.id, status: 'active' }).sort({ targetDate: 1 });

    if (goals.length === 0) {
        return await ctx.editMessageText("You have no active goals. It's time to set one.", journalKeyboard);
    }

    let goalText = "*🎯 Your Active Goals:*\n\n";
    goals.forEach(goal => {
        goalText += `*Goal:* ${goal.description}\n`;
        goalText += `*Target:* ${goal.targetDate.toDateString()}\n\n`;
    });

    await ctx.editMessageText(goalText, { parse_mode: 'Markdown', ...journalKeyboard });
}
// --- OTHER HANDLERS ---
export async function handleLeaderboard(ctx) {
    const allUsers = await User.find({ $or: [{ 'habits.0': { $exists: true } }, { 'addictions.0': { $exists: true } }] });

    const rankedUsers = allUsers.map(user => {
        const habitStreaks = user.habits.map(h => h.streak);
        const addictionStreaks = user.addictions.map(a => a.streak);
        const highestStreak = Math.max(0, ...habitStreaks, ...addictionStreaks);
        return { name: user.name, streak: highestStreak };
    })
    .filter(u => u.streak > 0)
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 5);

    let board = "🏆 **LEADERBOARD** 🏆\n\n";
    if (rankedUsers.length === 0) {
        board += "_The board is empty. No one is putting in the work. Pathetic._";
    } else {
        rankedUsers.forEach((user, index) => {
            const medals = ['🥇', '🥈', '🥉'];
            board += `${medals[index] || '🔹'} ${user.name} - **${user.streak} day streak**\n`;
        });
    }
    await ctx.replyWithMarkdown(board);
}

export async function handleScore(ctx) {
    const user = await ensureUser(ctx);
    const score = user.focusScore || 0;
    await ctx.reply(`🎯 **Today's Focus Score: ${score}**\n\nKeep putting in the work. Every action counts. Get your score up.`);
}

export async function handleSupport(ctx) {
    await ctx.replyWithMarkdown(
        `This bot is a one-man project. If it's providing you value, consider supporting its development.\n\n` +
        `To donate, please contact the creator directly on Telegram: **@invaluable\\_me**\n\n` +
        `Your support keeps the mission alive. Thank you.`
    );
}

export async function handleGetVideo(ctx) {
    await ctx.reply('Choose a video category:', videoCategoryKeyboard);
}

export async function handleToolkit(ctx) {
    await ctx.reply('Here is your toolkit:', userKeyboard);
}

export async function handleCheckin(ctx) {
    if (ctx.chat.type !== 'private') return;
    const user = await ensureUser(ctx);

    if (user.habits.length === 0) {
        return ctx.reply("You have no habits to check in on. Stop wasting time.");
    }
    
    await ctx.reply("Time to report. Answer honestly.");

    for (const habit of user.habits) {
        userStates[ctx.from.id] = { stage: 'awaiting_checkin', habitId: habit.habitId };
        if (habit.type === 'quantitative') {
            await ctx.reply(`For your habit "${habit.name}", how many ${habit.unit} did you complete today? (Enter a number)`);
        } else {
            await ctx.reply(`Did you complete your habit "${habit.name}" today?`, Markup.inlineKeyboard([
                Markup.button.callback('✅ Yes', `checkin_yes_${habit.habitId}`),
                Markup.button.callback('❌ No', `checkin_no_${habit.habitId}`),
            ]));
        }
    }
}

export async function handleWhy(ctx) {
    if (ctx.chat.type !== 'private') return;
    const user = await ensureUser(ctx);
    if (user.addictions.length === 0) return ctx.reply("You haven't logged an addiction.");
    
    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
    const whyMessages = user.addictions.map(a => `Addiction: ${a.name}\nReason: "${a.why}"`).join('\n\n');
    const prompt = [{ role: 'user', content: `Remind me why I started. Be powerful. My reasons:\n${whyMessages}` }];
    const aiResponse = await getAIResponse(prompt, user.mode);
    await ctx.replyWithMarkdown(aiResponse);
}

export async function handleEliteOn(ctx) {
    const user = await ensureUser(ctx);
    user.mode = 'elite';
    await user.save();
    await ctx.reply('Elite mode ON. No more games. 😠');
}

export async function handleEliteOff(ctx) {
    const user = await ensureUser(ctx);
    user.mode = 'normal';
    await user.save();
    await ctx.reply('Elite mode OFF. Standard procedure. 💪');
}