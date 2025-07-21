import { nanoid } from 'nanoid';
import { User, Video, JournalEntry, Goal } from '../models/index.js';
import {
    userStates, ensureUser, updateFocusScore, handleSwear, handleMotivate, handleAddHabit, handleAddAddiction,
    handleViewProgress, handleJournal, handleRelapse, handleLeaderboard, handleScore, handleSupport, handleGetVideo,
    handleNewJournalEntry, handleViewThisWeek, handleViewLastWeek, handleSetNewGoal, handleViewGoals, handleShowToolkit
} from './user.js';
import { handleAdminPanel, handleViewUserStats, handleViewUsers, handleUploadVideo } from './admin.js';
import { userKeyboard, anotherVideoKeyboard, journalKeyboard } from '../keyboards/keyboards.js';
import { getAIResponse } from '../ai/openrouter.js';
import { Markup } from 'telegraf';
import { addWeeks, addMonths, addDays, parse } from 'date-fns';

const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

export const registerEventHandlers = (bot) => {
    bot.on('text', async (ctx) => {
        const userId = ctx.from.id;
        const state = userStates[userId];
        if (!state || !state.stage) return;

        const user = await ensureUser(ctx);
        const text = ctx.message.text.trim();

        if (text === '/cancel') {
            delete userStates[userId];
            return ctx.reply('Operation cancelled.');
        }

        // --- CHECK-IN ANSWER HANDLER ---
        if (state.stage === 'awaiting_checkin_quantitative') {
            const number = parseInt(text, 10);
            if (isNaN(number)) {
                return ctx.reply("That's not a valid number. Try again.");
            }

            const habitId = state.habitQueue[state.currentIndex];
            const habit = user.habits.find(h => h.habitId === habitId);

            if (habit) {
                habit.progress = number;
                if (number > 0) {
                    habit.streak++;
                    updateFocusScore(user, 10);
                } else {
                    habit.streak = 0;
                    updateFocusScore(user, -5);
                }
                await user.save();
            }

            state.currentIndex++;
            await promptNextHabit(ctx, user); 
            return;
        }


        // Handle states for journal and goals
        if (state.stage === 'awaiting_journal_entry') {
            await ctx.reply('Analyzing and saving your entry...');
            delete userStates[userId];
            const newEntry = new JournalEntry({ userId, content: text });
            await newEntry.save();
            updateFocusScore(user, 5);
            await user.save();
            const prompt = [{ role: 'user', content: `Analyze my journal entry with brutal honesty... Entry:\n\n"${text}"` }];
            const response = await getAIResponse(prompt, user.mode);
            await ctx.replyWithMarkdown(response, userKeyboard);
            return;
        }

        if (state.stage === 'awaiting_goal_description') {
            userStates[userId] = { stage: 'awaiting_goal_date', description: text };
            await ctx.reply(`Goal set: "${text}".\n\nWhen do you want to achieve this by? (e.g., "tomorrow", "3 weeks", "2025-12-31")`);
            return;
        }

        if (state.stage === 'awaiting_goal_date') {
            delete userStates[userId];
            const { description } = state;
            let targetDate;
            try {
                const now = new Date();
                const textLower = text.toLowerCase();
                if (textLower.includes('week')) {
                    const weeks = parseInt(textLower.match(/\d+/)?.[0] || 1);
                    targetDate = addWeeks(now, weeks);
                } else if (textLower.includes('month')) {
                    const months = parseInt(textLower.match(/\d+/)?.[0] || 1);
                    targetDate = addMonths(now, months);
                } else if (textLower.includes('tomorrow')) {
                    targetDate = addDays(now, 1);
                } else {
                     targetDate = parse(text, 'yyyy-MM-dd', new Date());
                     if (isNaN(targetDate.getTime())) targetDate = new Date(text);
                }   
                if (isNaN(targetDate.getTime())) throw new Error('Invalid date format');
            } catch (e) {
                return ctx.reply("That date doesn't look right. Please try setting your goal again using a format like YYYY-MM-DD or a term like '3 weeks'.", journalKeyboard);
            }
            const newGoal = new Goal({ userId, description, targetDate });
            await newGoal.save();
            await ctx.reply(`✅ Goal saved!\n\n*Goal:* ${description}\n*Target:* ${targetDate.toDateString()}`, { parse_mode: 'Markdown', ...userKeyboard });
            return;
        }

        if (state.stage === 'awaiting_journal_entry') {
            await ctx.reply('Analyzing and saving your entry...');
            delete userStates[userId];

            const newEntry = new JournalEntry({ userId, content: text });
            await newEntry.save();
            updateFocusScore(user, 5);
            await user.save();

            const prompt = [{ role: 'user', content: `Analyze my journal entry with brutal honesty... Entry:\n\n"${text}"` }];
            const response = await getAIResponse(prompt, user.mode);
            await ctx.replyWithMarkdown(response, userKeyboard);
            return;
        }
        if (state.stage === 'awaiting_journal') {
            await ctx.reply('Analyzing your journal entry, please wait...');
            
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
                const newVideo = new Video({ categoryId: state.category, fileId: videoFileId });
                await newVideo.save();
                await ctx.reply(`✅ Video saved to **${state.category}**.\n\nSend another video to add it to this category, or choose an option below.`, anotherVideoKeyboard);
            }
    });


    bot.on('callback_query', async (ctx) => {
        await ctx.answerCbQuery().catch(err => console.error(err));

        const data = ctx.callbackQuery.data;
        const userId = ctx.from.id;
        const user = await ensureUser(ctx);
        const state = userStates[userId];
        const buttonActions = {
            'action_swear': handleSwear,
            'action_motivate': handleMotivate,
            'action_add_habit': handleAddHabit,
            'action_add_addiction': handleAddAddiction,
            'action_view_progress': handleViewProgress,
            'action_relapse': handleRelapse,
            'action_leaderboard': handleLeaderboard,
            'action_score': handleScore,
            'action_support': handleSupport,
            'action_get_video': handleGetVideo,
            'action_show_toolkit': handleShowToolkit,
            'admin_panel': handleAdminPanel,
            'admin_view_stats': handleViewUserStats,
            'admin_view_users': handleViewUsers,
            'admin_upload_video': handleUploadVideo,
            'action_journal': handleJournal,
            'journal_new_entry': handleNewJournalEntry,
            'goal_new': handleSetNewGoal,
            'journal_view_this_week': handleViewThisWeek,
            'journal_view_last_week': handleViewLastWeek,
            'goal_view_active': handleViewGoals
        };

        if (buttonActions[data]) {
            return buttonActions[data](ctx, user);
        }

        if (journalActions[data]) {
            return journalActions[data](ctx);
        }

          if (data.startsWith('relapse_')) {
            const addictionId = data.split('_')[1];
            const addiction = user.addictions.find(a => a.addictionId === addictionId);
            if (addiction) {
                await ctx.editMessageText(`You failed on "${addiction.name}". Analyzing...`);
                addiction.streak = 0;
                updateFocusScore(user, -10);
                await user.save();
                const prompt = [{ role: 'user', content: `I relapsed on "${addiction.name}". My reason for quitting was "${addiction.why}". Give me a harsh message to get me back on my feet immediately.` }];
                const response = await getAIResponse(prompt, user.mode);
                return ctx.editMessageText(response);
            }
        }

        if (data.startsWith('video_cat_')) {
            const category = data.split('_')[2];
            const state = userStates[userId];
            if (userId.toString() === ADMIN_USER_ID && state && state.stage === 'admin_awaiting_video_category') {
                userStates[userId] = { stage: 'admin_awaiting_video_upload', category: category };
                return ctx.editMessageText(`OK. Now, send me the video file to upload to the **${category}** category.`);
            }
            const videos = await Video.find({ categoryId: category });
            if (videos.length === 0) {
                return ctx.reply(`Sorry, no videos found in the "${category}" category yet. Check back later.`);
            }
            const randomVideo = videos[Math.floor(Math.random() * videos.length)];
            return ctx.replyWithVideo(randomVideo.fileId).catch(err => console.error(err));
        }

        if (data.startsWith('habit_type_')) {
            const type = data.split('_')[2];
            const state = userStates[userId];
            if (state && state.stage === 'awaiting_habit_type') {
                if (type === 'binary') {
                    user.habits.push({ habitId: nanoid(8), name: state.name, type: 'binary' });
                    updateFocusScore(user, 2);
                    await user.save();
                    delete userStates[userId];
                    await ctx.editMessageText(`Habit "${state.name}" set. Tracked as Done/Not Done. Now execute.`);
                    return ctx.reply("What's next?", userKeyboard);
                } else if (type === 'quantitative') {
                    userStates[userId] = { stage: 'awaiting_habit_unit', name: state.name };
                    return ctx.editMessageText('What is the unit of measurement? (e.g., "pages", "km", "minutes")');
                }
            }
        }

        if (data.startsWith('checkin_yes_') || data.startsWith('checkin_no_')) {
            if (!state || state.stage !== 'awaiting_checkin_binary') return;

            const isYes = data.startsWith('checkin_yes_');
            const habitId = state.habitQueue[state.currentIndex];
            const habit = user.habits.find(h => h.habitId === habitId);

            if (habit) {
                if (isYes) {
                    habit.streak++;
                    habit.progress = 1;
                    updateFocusScore(user, 10);
                    await ctx.editMessageText(`"${habit.name}" - Done. Good. ⚔️`);
                } else {
                    habit.streak = 0;
                    habit.progress = 0;
                    updateFocusScore(user, -5);
                    await ctx.editMessageText(`"${habit.name}" - Missed. Weakness.`);
                }
                await user.save();
            }
            state.currentIndex++;
            await promptNextHabit(ctx, user); // Ask next question
            return;
        }
    });
};