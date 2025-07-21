// src/bot.js
import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { registerEventHandlers  } from './handlers/events.js';
// Import all your command handlers
import * as user from './handlers/user.js';
import * as admin from './handlers/admin.js';

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

// Middleware to check if the user is an admin
const adminOnly = (ctx, next) => {
    if (ctx.from && ctx.from.id.toString() === ADMIN_USER_ID) {
        return next();
    }
    // Silently ignore non-admins trying to use admin commands
};

// --- Register all commands ---

// User Commands
bot.start(user.handleStart);
bot.command('motivate', user.handleMotivate);
bot.command('addhabit', user.handleAddHabit);
bot.command('addaddiction', user.handleAddAddiction);
bot.command('progress', user.handleViewProgress);
bot.command('journal', user.handleJournal);
bot.command('relapse', user.handleRelapse);
bot.command('leaderboard', user.handleLeaderboard);
bot.command('score', user.handleScore);
bot.command('support', user.handleSupport);
bot.command('videos', user.handleGetVideo);
bot.command('toolkit', user.handleToolkit);
bot.command('checkin', user.handleCheckin);
bot.command('why', user.handleWhy);
bot.command('eliteon', user.handleEliteOn);
bot.command('eliteoff', user.handleEliteOff);
bot.command('help', user.handleHelp);

// Admin Commands (with middleware)
bot.command('users', adminOnly, admin.handleViewUsers);
bot.command('broadcast', adminOnly, (ctx) => {
    user.userStates[ctx.from.id] = { stage: 'admin_awaiting_broadcast' };
    ctx.reply('Enter the message to broadcast to all users. Send /cancel to abort.');
});

// Group Commands
bot.command('activate_group', admin.handleActivateGroup);


// --- Register Event Handlers (for text, video, callbacks) ---
registerEventHandlers(bot);

// --- Global Error Handler ---
bot.catch((err, ctx) => {
    console.error(`❌ Unhandled error for ${ctx.updateType}`, err);
});