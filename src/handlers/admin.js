// src/handlers/admin.js
import { User, Group } from '../models/index.js';
import { adminKeyboard, videoCategoryKeyboard } from '../keyboards/keyboards.js';
import { userStates } from './user.js'; // Share state with user handlers

// <-- FIX: The escape function now includes the hyphen/minus character '-'
function escapeMarkdown(text) {
    if (text === null || text === undefined) return '';
    // This now escapes all special characters required by MarkdownV2
    return text.toString().replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

export async function handleAdminPanel(ctx) {
    await ctx.editMessageText('👑 Admin Panel', adminKeyboard);
}

export async function handleViewUserStats(ctx) {
    const totalUsers = await User.countDocuments();
    const usersWithHabits = await User.countDocuments({ 'habits.0': { $exists: true } });
    const usersWithAddictions = await User.countDocuments({ 'addictions.0': { $exists: true } });

    let stats = `**Bot Statistics**\n\n`;
    stats += `• **Total Users:** ${totalUsers}\n`;
    stats += `• **Users w/ Habits:** ${usersWithHabits}\n`;
    stats += `• **Users w/ Addictions:** ${usersWithAddictions}`;
    
    await ctx.replyWithMarkdown(stats, { parse_mode: 'MarkdownV2' });
}

export async function handleViewUsers(ctx) {
    const users = await User.find({}).sort({ _id: -1 }).limit(20);
    let userList = `👥 **Last 20 Registered Users:**\n\n`;
    if (users.length === 0) {
        userList += "_No users found._";
    } else {
        users.forEach(user => {
            const username = user.username ? `@${escapeMarkdown(user.username)}` : 'N/A';
            userList += `• *Name:* ${escapeMarkdown(user.name)}\n`;
            userList += `  *Username:* ${username}\n`;
            userList += `  *ID:* \`${user.userId}\`\n`;
            userList += `  *Habits:* ${user.habits.length}, *Addictions:* ${user.addictions.length}\n`;
            // <-- FIX: The user's score is now also passed through the escape function
            userList += `  *Score:* ${escapeMarkdown(user.focusScore)}\n\n`;
        });
    }
    
    await ctx.replyWithMarkdown(userList, { parse_mode: 'MarkdownV2' });
}

export async function handleBroadcastPrompt(ctx) {
    userStates[ctx.from.id] = { stage: 'admin_awaiting_broadcast' };
    await ctx.reply('Enter the message you want to broadcast to all users. To cancel, send /cancel.');
}

export async function handleUploadVideo(ctx) {
    userStates[ctx.from.id] = { stage: 'admin_awaiting_video_category' };
    await ctx.editMessageText('Select the category for the video you are about to upload:', videoCategoryKeyboard);
}

export async function handleActivateGroup(ctx) {
    if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
        return ctx.reply('This command only works in groups.');
    }
    const member = await ctx.getChatMember(ctx.from.id);
    if (member.status !== 'administrator' && member.status !== 'creator') {
        return ctx.reply('Only group admins can activate me.');
    }
    
    const groupId = ctx.chat.id;
    let group = await Group.findOne({ groupId: groupId });
    if (!group) {
        group = new Group({ groupId: groupId, title: ctx.chat.title });
        await group.save();
    }
    
    await ctx.reply('This group is now activated for daily motivational messages. Let\'s build warriors. ⚔️');
}