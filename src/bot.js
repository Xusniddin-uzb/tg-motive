// src/bot.js
import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import { nanoid } from 'nanoid';
import { getAIResponse } from './ai/openrouter.js';

// Import Mongoose Models
import { User } from './models/user.js';
import { Group } from './models/group.js';
import { Video } from './models/video.js';

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const userStates = {};
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

// --- DATABASE & SCORE HELPERS ---
const ensureUser = async (ctx) => {
    const userId = ctx.from.id;
    let user = await User.findOne({ userId: userId });

    if (!user) {
        user = new User({
            userId: userId,
            name: ctx.from.first_name || 'User',
        });
        await user.save();
    }
    return user;
};

function updateFocusScore(user, points) {
    const today = new Date().toISOString().slice(0, 10);
    if (user.lastInteraction !== today) {
        user.focusScore = 0;
    }
    user.focusScore += points;
    user.lastInteraction = today;
}

const ensureGroup = async (ctx) => {
    if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') return null;
    const groupId = ctx.chat.id;
    let group = await Group.findOne({ groupId: groupId });
    if (!group) {
        group = new Group({
            groupId: groupId,
            title: ctx.chat.title
        });
        await group.save();
    }
    return group;
};


// --- KEYBOARDS ---
const userKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('💪 Motivate', 'action_motivate'), Markup.button.callback('🎬 Get Videos', 'action_get_video')],
    [Markup.button.callback('✍️ Journal', 'action_journal'), Markup.button.callback('📊 Progress', 'action_view_progress')],
    [Markup.button.callback('🧠 Add Habit', 'action_add_habit'), Markup.button.callback('🚫 Quit Addiction', 'action_add_addiction')],
    [Markup.button.callback('📉 Relapse', 'action_relapse'), Markup.button.callback('🎯 My Score', 'action_score')],
    [Markup.button.callback('🏆 Leaderboard', 'action_leaderboard'), Markup.button.callback('❤️ Support', 'action_support')]
]);

const adminKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📊 View User Stats', 'admin_view_stats')],
    [Markup.button.callback('📤 Upload Video', 'admin_upload_video')],
    [Markup.button.callback('⬅️ Back to User Mode', 'action_swear')]
]);

const videoCategoryKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Tate Motivation', 'video_cat_tate'), Markup.button.callback('Gym Motivation', 'video_cat_gym')],
    [Markup.button.callback('Money Mindset', 'video_cat_money'), Markup.button.callback('Self Improvement', 'video_cat_self_improvement')]
]);


// --- ACTION HANDLERS ---

async function handleStart(ctx) {
    await ensureUser(ctx);
    if (ctx.from.id.toString() === ADMIN_USER_ID) {
        return ctx.reply('Welcome, Admin. How do you wish to proceed?', Markup.inlineKeyboard([
            [Markup.button.callback('👑 Admin Panel', 'admin_panel')],
            [Markup.button.callback('👤 Normal User', 'action_swear')]
        ]));
    }
    
    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
    const prompt = [{ role: 'user', content: `Generate a brutally short and intense message demanding a new user's commitment. Tell them to swear an oath by pressing the button. ABSOLUTE MAXIMUM 3 sentences.` }];
    const oathMessage = await getAIResponse(prompt);
    
    await ctx.replyWithMarkdown(oathMessage, Markup.inlineKeyboard([
        Markup.button.callback("I Swear The Oath ⚔️", "action_swear")
    ]));
}

async function handleSwear(ctx) {
    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
    const prompt = [{ role: 'user', content: `The user just swore an oath to be honest. Give a short, sharp acknowledgment. Something like 'Good. The contract is sealed.' Then welcome them.` }];
    const welcomeMessage = await getAIResponse(prompt);
    await ctx.editMessageText(welcomeMessage);
    await ctx.reply('Your toolkit is below.', userKeyboard);
}

async function handleMotivate(ctx) {
    const user = await ensureUser(ctx);
    updateFocusScore(user, 1);
    await user.save();
    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
    const prompt = [{ role: 'user', content: `Give me a single, hard-hitting piece of advice about discipline, wealth, or mental toughness right now. Be direct.` }];
    const motivation = await getAIResponse(prompt, user.mode);
    await ctx.replyWithMarkdown(motivation);
}

async function handleAddHabit(ctx) {
    if (ctx.chat.type !== 'private') return ctx.reply('Set habits in a private chat with me.');
    await ensureUser(ctx);
    userStates[ctx.from.id] = { stage: 'awaiting_habit_name' };
    await ctx.reply('🧠 What is the new habit? Be specific (e.g., "Read a book," "Go for a run").');
}

async function handleAddAddiction(ctx) {
    if (ctx.chat.type !== 'private') return ctx.reply('Set addictions in a private chat with me.');
    await ensureUser(ctx);
    userStates[ctx.from.id] = { stage: 'awaiting_addiction' };
    await ctx.reply('🚫 What addiction are you ready to destroy? Name it.');
}

async function handleViewProgress(ctx) {
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

async function handleJournal(ctx) {
    if (ctx.chat.type !== 'private') return ctx.reply('Use the journal in a private chat with me.');
    await ensureUser(ctx);
    userStates[ctx.from.id] = { stage: 'awaiting_journal' };
    await ctx.reply('✍️ Journal entry. What were your wins and losses today? Be honest.');
}

async function handleRelapse(ctx) {
    if (ctx.chat.type !== 'private') return ctx.reply('Report a relapse in a private chat with me.');
    const user = await ensureUser(ctx);
    if (user.addictions.length === 0) return ctx.reply("You have no addictions logged to relapse on. Focus.");
    
    const buttons = user.addictions.map(addiction => Markup.button.callback(addiction.name, `relapse_${addiction.addictionId}`));
    const keyboard = Markup.inlineKeyboard(buttons, { columns: 1 });
    await ctx.reply('Which demon got you? Report it.', keyboard);
}

async function handleLeaderboard(ctx) {
    const allUsers = await User.find({ $or: [{ 'habits.1': { $exists: true } }, { 'addictions.1': { $exists: true } }] });

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

async function handleScore(ctx) {
    const user = await ensureUser(ctx);
    const score = user.focusScore || 0;
    await ctx.reply(`🎯 **Today's Focus Score: ${score}**\n\nKeep putting in the work. Every action counts. Get your score up.`);
}

async function handleSupport(ctx) {
    await ctx.replyWithMarkdown(
        `This bot is a one-man project. If it's providing you value, consider supporting its development.\n\n` +
        `To donate, please contact the creator directly on Telegram: **@invaluable\\_me**\n\n` +
        `Your support keeps the mission alive. Thank you.`
    );
}

// --- ADMIN HANDLERS ---

async function handleAdminPanel(ctx) {
    await ctx.editMessageText('👑 Admin Panel', adminKeyboard);
}

async function handleViewUserStats(ctx) {
    const totalUsers = await User.countDocuments();
    const usersWithHabits = await User.countDocuments({ 'habits.0': { $exists: true } });
    const usersWithAddictions = await User.countDocuments({ 'addictions.0': { $exists: true } });
    const recentUsers = await User.find().sort({ _id: -1 }).limit(10);

    let stats = `**Bot Statistics**\n\n`;
    stats += `- **Total Users:** ${totalUsers}\n`;
    stats += `- **Users w/ Habits:** ${usersWithHabits}\n`;
    stats += `- **Users w/ Addictions:** ${usersWithAddictions}\n\n`;
    stats += `**Recent Users:**\n`;
    recentUsers.forEach(user => {
        stats += `- ${user.name} (ID: ${user.userId}): ${user.habits.length} habits, ${user.addictions.length} addictions.\n`;
    });

    await ctx.reply(stats);
}

async function handleUploadVideo(ctx) {
    userStates[ctx.from.id] = { stage: 'admin_awaiting_video_category' };
    await ctx.editMessageText('Select the category for the video you are about to upload:', videoCategoryKeyboard);
}

// --- VIDEO & TOOLKIT HANDLERS ---

async function handleGetVideo(ctx) {
    await ctx.reply('Choose a video category:', videoCategoryKeyboard);
}

// <-- NEW: Handler for the /toolkit command
async function handleToolkit(ctx) {
    await ctx.reply('Here is your toolkit:', userKeyboard);
}


// --- COMMANDS ---
bot.start(handleStart);
bot.command('motivate', handleMotivate);
bot.command('addhabit', handleAddHabit);
bot.command('addaddiction', handleAddAddiction);
bot.command('progress', handleViewProgress);
bot.command('journal', handleJournal);
bot.command('relapse', handleRelapse);
bot.command('leaderboard', handleLeaderboard);
bot.command('score', handleScore);
bot.command('support', handleSupport);
bot.command('videos', handleGetVideo); // <-- NEW: Command alias for videos
bot.command('toolkit', handleToolkit); // <-- NEW: Command to show the menu

bot.command('checkin', async (ctx) => {
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
});

bot.command('why', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const user = await ensureUser(ctx);
    if (user.addictions.length === 0) return ctx.reply("You haven't logged an addiction.");
    
    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
    const whyMessages = user.addictions.map(a => `Addiction: ${a.name}\nReason: "${a.why}"`).join('\n\n');
    const prompt = [{ role: 'user', content: `Remind me why I started. Be powerful. My reasons:\n${whyMessages}` }];
    const aiResponse = await getAIResponse(prompt, user.mode);
    await ctx.replyWithMarkdown(aiResponse);
});

bot.command('eliteon', async (ctx) => {
    const user = await ensureUser(ctx);
    user.mode = 'elite';
    await user.save();
    await ctx.reply('Elite mode ON. No more games. 😠');
});

bot.command('eliteoff', async (ctx) => {
    const user = await ensureUser(ctx);
    user.mode = 'normal';
    await user.save();
    await ctx.reply('Elite mode OFF. Standard procedure. 💪');
});

bot.command('activate_group', async (ctx) => {
    if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
        return ctx.reply('This command only works in groups.');
    }
    const member = await ctx.getChatMember(ctx.from.id);
    if (member.status !== 'administrator' && member.status !== 'creator') {
        return ctx.reply('Only group admins can activate me.');
    }
    await ensureGroup(ctx);
    await ctx.reply('This group is now activated for daily motivational messages. Let\'s build warriors. ⚔️');
});


// --- MESSAGE HANDLERS (text and video) ---
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const state = userStates[userId];
    if (!state || !state.stage) return;

    const user = await ensureUser(ctx);
    const text = ctx.message.text.trim();

    if (state.stage !== 'awaiting_addiction' && state.stage !== 'awaiting_habit_name') {
        await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
    }

    if (state.stage === 'awaiting_journal') {
        delete userStates[userId];
        updateFocusScore(user, 5);
        await user.save();
        const prompt = [{ role: 'user', content: `Analyze my journal entry with brutal honesty. Focus on mindset, money, and fitness. Entry:\n\n"${text}"` }];
        const response = await getAIResponse(prompt, user.mode);
        await ctx.replyWithMarkdown(response, userKeyboard);
        return;
    }

    if (state.stage === 'awaiting_habit_name') {
        userStates[userId] = { stage: 'awaiting_habit_type', name: text };
        await ctx.reply(`Got it: "${text}".\n\nHow should we track this?`, Markup.inlineKeyboard([
            [Markup.button.callback('Just "Done" or "Not Done"', 'habit_type_binary')],
            [Markup.button.callback('By a Number (e.g., pages, km, reps)', 'habit_type_quantitative')],
        ]));
    } else if (state.stage === 'awaiting_habit_unit') {
        user.habits.push({ habitId: nanoid(8), name: state.name, type: 'quantitative', unit: text });
        updateFocusScore(user, 2);
        await user.save();
        delete userStates[userId];
        const prompt = [{ role: 'user', content: `Acknowledge I've set the habit: "${state.name}", tracked by "${text}". Tell me not to fail.` }];
        const response = await getAIResponse(prompt, user.mode);
        await ctx.replyWithMarkdown(response, userKeyboard);
    }
    
    else if (state.stage === 'awaiting_addiction') {
        userStates[userId] = { stage: 'awaiting_why', name: text };
        await ctx.reply(`And WHY do you want to quit "${text}"? This is your anchor. Dig deep.`);
    } else if (state.stage === 'awaiting_why') {
        user.addictions.push({ addictionId: nanoid(8), name: state.name, why: text });
        updateFocusScore(user, 2);
        await user.save();
        delete userStates[userId];
        const prompt = [{ role: 'user', content: `Confirm that I'm quitting "${state.name}" because of "${text}". Tell me this reason is my anchor.` }];
        const response = await getAIResponse(prompt, user.mode);
        await ctx.replyWithMarkdown(response, userKeyboard);
    }
    
    else if (state.stage === 'awaiting_checkin' && state.habitId) {
        const number = parseInt(text, 10);
        if (isNaN(number)) {
            return ctx.reply('That\'s not a valid number. Try again.');
        }

        const habit = user.habits.find(h => h.habitId === state.habitId);
        if (habit) {
            habit.progress = number;
            if (number > 0) {
                habit.streak++;
                updateFocusScore(user, 10);
                await ctx.reply(`Logged: ${number} ${habit.unit}. Good work. Keep pushing. 🔥`);
            } else {
                habit.streak = 0;
                updateFocusScore(user, -5);
                await ctx.reply(`Zero? Pathetic. Don't let it happen again.`);
            }
            await user.save();
        }
        delete userStates[userId];
    }
});

bot.on('video', async (ctx) => {
    const userId = ctx.from.id;
    const state = userStates[userId];

    if (userId.toString() === ADMIN_USER_ID && state && state.stage === 'admin_awaiting_video_upload') {
        const videoFileId = ctx.message.video.file_id;
        const newVideo = new Video({
            categoryId: state.category,
            fileId: videoFileId,
        });
        await newVideo.save();

        delete userStates[userId];
        await ctx.reply(`✅ Video successfully saved to **${state.category}** category.\nFile ID: \`${videoFileId}\``, { parse_mode: 'Markdown' });
        await ctx.reply('👑 Admin Panel', adminKeyboard);
    }
});


// --- CALLBACK QUERY HANDLER ---
bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    await ctx.answerCbQuery().catch(err => console.error(err));
    const userId = ctx.from.id;

    const buttonActions = {
        'action_swear': handleSwear,
        'action_motivate': handleMotivate,
        'action_add_habit': handleAddHabit,
        'action_add_addiction': handleAddAddiction,
        'action_view_progress': handleViewProgress,
        'action_journal': handleJournal,
        'action_relapse': handleRelapse,
        'action_leaderboard': handleLeaderboard,
        'action_score': handleScore,
        'action_support': handleSupport,
        'action_get_video': handleGetVideo,
        'admin_panel': handleAdminPanel,
        'admin_view_stats': handleViewUserStats,
        'admin_upload_video': handleUploadVideo,
    };

    if (buttonActions[data]) {
        return buttonActions[data](ctx);
    }

    if (data.startsWith('video_cat_')) {
        const category = data.split('_')[2];
        const state = userStates[userId];

        if (userId.toString() === ADMIN_USER_ID && state && state.stage === 'admin_awaiting_video_category') {
            userStates[userId] = { stage: 'admin_awaiting_video_upload', category: category };
            await ctx.editMessageText(`OK. Now, send me the video file to upload to the **${category}** category.`);
            return;
        }

        const videos = await Video.find({ categoryId: category });
        
        if (videos.length === 0) {
            return ctx.reply(`Sorry, no videos found in the "${category}" category yet. Check back later.`);
        }

        const randomVideo = videos[Math.floor(Math.random() * videos.length)];
        try {
            await ctx.replyWithVideo(randomVideo.fileId);
        } catch (error) {
            console.error(`Failed to send video ${randomVideo.fileId}:`, error);
            await ctx.reply('There was an error sending that video. It might have been deleted. Try again.');
        }
        return;
    }

    if (data.startsWith('habit_type_')) {
        const type = data.split('_')[2];
        const state = userStates[userId];
        if (state && state.stage === 'awaiting_habit_type') {
            const user = await ensureUser(ctx);
            if (type === 'binary') {
                user.habits.push({ habitId: nanoid(8), name: state.name, type: 'binary' });
                updateFocusScore(user, 2);
                await user.save();
                delete userStates[userId];
                await ctx.editMessageText(`Habit "${state.name}" set. Tracked as Done/Not Done. Now execute.`);
                return ctx.reply("What's next?", userKeyboard);
            } else if (type === 'quantitative') {
                userStates[userId] = { stage: 'awaiting_habit_unit', name: state.name };
                return ctx.editMessageText('What is the unit of measurement? (e.g., "pages", "km", "minutes", "reps")');
            }
        }
    }
    
    if (data.startsWith('relapse_') || data.startsWith('checkin_')) {
        await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
    }
    
    if (data.startsWith('relapse_')) {
        const addictionId = data.split('_')[1];
        const user = await ensureUser(ctx);
        const addiction = user.addictions.find(a => a.addictionId === addictionId);
        if (addiction) {
            addiction.streak = 0;
            updateFocusScore(user, -10);
            await user.save();
            const prompt = [{ role: 'user', content: `I relapsed on "${addiction.name}". My reason for quitting was "${addiction.why}". Give me a harsh message to get me back on my feet immediately. Acknowledge the failure but demand I restart now.` }];
            const response = await getAIResponse(prompt, user.mode);
            return ctx.editMessageText(response);
        }
    }

    if (data.startsWith('checkin_yes_')) {
        const habitId = data.substring('checkin_yes_'.length);
        const user = await ensureUser(ctx);
        const habit = user.habits.find(h => h.habitId === habitId);
        if (habit) {
            habit.streak++;
            habit.progress = 1;
            updateFocusScore(user, 10);
            await user.save();
            await ctx.editMessageText(`"${habit.name}" - Done. Good. Consistency is key. ⚔️`);
        }
    }

    if (data.startsWith('checkin_no_')) {
        const habitId = data.substring('checkin_no_'.length);
        const user = await ensureUser(ctx);
        const habit = user.habits.find(h => h.habitId === habitId);
        if (habit) {
            habit.streak = 0;
            habit.progress = 0;
            updateFocusScore(user, -5);
            await user.save();
            await ctx.editMessageText(`"${habit.name}" - Missed. Weakness. Do better tomorrow.`);
        }
    }
});

// Global error handler to prevent crashes
bot.catch((err, ctx) => {
    console.error(`❌ Unhandled error for ${ctx.updateType}:`, err);
});