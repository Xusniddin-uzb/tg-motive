// Addiction tracking logic
const { v4: uuidv4 } = require('uuid');
const storage = require('../storage/data');

function addAddiction(userId, name, reason) {
  if (!storage.users[userId]) storage.users[userId] = { habits: [], addictions: [] };
  const addiction = { id: uuidv4(), name, reason, streak: 0, lastClean: null };
  storage.users[userId].addictions.push(addiction);
  storage.save();
  return addiction;
}

function listAddictions(userId) {
  return (storage.users[userId]?.addictions) || [];
}

function markClean(userId, addictionId, clean) {
  const addiction = storage.users[userId]?.addictions.find(a => a.id === addictionId);
  if (addiction) {
    if (clean) {
      addiction.streak++;
      addiction.lastClean = new Date().toISOString();
    } else {
      addiction.streak = 0;
    }
    storage.save();
  }
  return addiction;
}

module.exports = { addAddiction, listAddictions, markClean };
