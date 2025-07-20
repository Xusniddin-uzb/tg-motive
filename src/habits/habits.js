// Habit storage and tracking
const { v4: uuidv4 } = require('uuid');
const storage = require('../storage/data');

function addHabit(userId, name, time) {
  if (!storage.users[userId]) storage.users[userId] = { habits: [], addictions: [] };
  const habit = { id: uuidv4(), name, time, streak: 0, lastCompleted: null };
  storage.users[userId].habits.push(habit);
  storage.save();
  return habit;
}

function listHabits(userId) {
  return (storage.users[userId]?.habits) || [];
}

function completeHabit(userId, habitId) {
  const habit = storage.users[userId]?.habits.find(h => h.id === habitId);
  if (habit) {
    habit.streak++;
    habit.lastCompleted = new Date().toISOString();
    storage.save();
  }
  return habit;
}

module.exports = { addHabit, listHabits, completeHabit };
