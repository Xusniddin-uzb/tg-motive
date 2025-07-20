// src/keyboards/keyboards.js
import { Markup } from 'telegraf';

export const userKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('💪 Motivate', 'action_motivate'), Markup.button.callback('🎬 Get Videos', 'action_get_video')],
    [Markup.button.callback('✍️ Journal', 'action_journal'), Markup.button.callback('📊 Progress', 'action_view_progress')],
    [Markup.button.callback('🧠 Add Habit', 'action_add_habit'), Markup.button.callback('🚫 Quit Addiction', 'action_add_addiction')],
    [Markup.button.callback('📉 Relapse', 'action_relapse'), Markup.button.callback('🎯 My Score', 'action_score')],
    [Markup.button.callback('🏆 Leaderboard', 'action_leaderboard'), Markup.button.callback('❤️ Support', 'action_support')]
]);

export const adminKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📊 View User Stats', 'admin_view_stats'), Markup.button.callback('👥 View Users', 'admin_view_users')],
    [Markup.button.callback('📤 Upload Video', 'admin_upload_video'), Markup.button.callback('💬 Broadcast', 'admin_broadcast_prompt')],
    [Markup.button.callback('⬅️ Back to User Mode', 'action_swear')]
]);

export const videoCategoryKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Tate Motivation', 'video_cat_tate'), Markup.button.callback('Gym Motivation', 'video_cat_gym')],
    [Markup.button.callback('Money Mindset', 'video_cat_money'), Markup.button.callback('Self Improvement', 'video_cat_self_improvement')]
]);

export const adminOrUserKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('👑 Admin Panel', 'admin_panel')],
    [Markup.button.callback('👤 Normal User', 'action_swear')]
]);

export const swearKeyboard = Markup.inlineKeyboard([
    Markup.button.callback("I Swear The Oath ⚔️", "action_swear")
]);