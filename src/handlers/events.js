// src/handlers/events.js
import { nanoid } from 'nanoid';
import { User, Video } from '../models/index.js';
import { userStates, ensureUser, updateFocusScore, handleSwear, handleMotivate, handleAddHabit, handleAddAddiction, handleViewProgress, handleJournal, handleRelapse, handleLeaderboard, handleScore, handleSupport, handleGetVideo } from './user.js';
import { handleAdminPanel, handleViewUserStats, handleViewUsers, handleUploadVideo } from './admin.js';
import { userKeyboard } from '../keyboards/keyboards.js';
import { getAIResponse } from '../ai/openrouter.js';

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

        if (state.stage !== 'awaiting_addiction' && state.stage !== 'awaiting_habit_name') {
            await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
        }

        if (state.stage === 'admin_awaiting_broadcast') {
            delete userStates[userId];
            const allUsers = await User.find({}, 'userId');
            await ctx.reply(`Starting broadcast to ${allUsers.length} users...`);
            let successCount = 0;
            for (const u of allUsers) {
                try {
                    await bot.telegram.sendMessage(u.userId, text);
                    successCount++;
                } catch (e) {
                    console.error(`Failed to broadcast to user ${u.userId}:`, e.message);
                }
            }
            return ctx.reply(`Broadcast finished. Sent to ${successCount}/${allUsers.length} users.`);
        }

        if (state.stage === 'awaiting_journal') {
            // <-- FIX: Inform the user first, then do the slow AI call
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
            const newVideo = new Video({
                categoryId: state.category,
                fileId: videoFileId,
            });
            await newVideo.save();

            // <-- FIX: Keep the user in the upload loop instead of resetting
            await ctx.reply(
                `✅ Video saved to **${state.category}**.\n\nSend another video to add it to this category, or choose an option below.`,
                { reply_markup: anotherVideoKeyboard.reply_markup, parse_mode: 'Markdown' }
            );
        }
    });

      bot.on('callback_query', async (ctx) => {
        // <-- FIX: Acknowledge the button press immediately
        await ctx.answerCbQuery().catch(err => console.error(err));

        const data = ctx.callbackQuery.data;
        const userId = ctx.from.id;
        const user = await ensureUser(ctx); // Ensure user exists for most operations

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
            'admin_view_users': handleViewUsers,
            'admin_upload_video': handleUploadVideo,
        };

        if (buttonActions[data]) {
            return buttonActions[data](ctx, user); // Pass user to handlers
        }

        // --- RELAPSE FIX ---
        if (data.startsWith('relapse_')) {
            const addictionId = data.split('_')[1];
            const addiction = user.addictions.find(a => a.addictionId === addictionId);

            if (addiction) {
                // <-- FIX: Inform the user first, then do the slow AI call
                await ctx.editMessageText(`You failed on "${addiction.name}". Analyzing...`);
                
                addiction.streak = 0;
                updateFocusScore(user, -10);
                await user.save();

                const prompt = [{ role: 'user', content: `I relapsed on "${addiction.name}". My reason for quitting was "${addiction.why}". Give me a harsh message to get me back on my feet immediately. Acknowledge the failure but demand I restart now.` }];
                const response = await getAIResponse(prompt, user.mode);
                return ctx.editMessageText(response);
            }
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
};