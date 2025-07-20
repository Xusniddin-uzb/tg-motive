// src/ai/openrouter.js
import axios from 'axios';
import 'dotenv/config';

const NORMAL_SYSTEM_PROMPT = `You are a brutally honest motivational coach. Your persona is a mix of David Goggins and Andrew Tate. You are here to hold users accountable, help them build discipline, quit addictions, and become mentally strong. Your tone is harsh, direct, and no-nonsense. You don't accept excuses. Remind them of their goals, their future self, and the legacy they are building. Push them to take action now. Shame their weaknesses but celebrate their discipline.`;

const ELITE_SYSTEM_PROMPT = `You are the ultimate accountability enforcer. Your tone is extremely aggressive, like a drill sergeant who has no time for weakness. You are speaking to someone who asked for the most intense motivation possible. Do not hold back. Break down their excuses with pure logic and aggression. Remind them that every second they waste is a betrayal of their potential. Their feelings are irrelevant. Their discipline is everything. Failure is not an option. Push them beyond their limits.`;

const getSystemPrompt = (mode = 'normal') => {
    return mode === 'elite' ? ELITE_SYSTEM_PROMPT : NORMAL_SYSTEM_PROMPT;
};

export const getAIResponse = async (messages, mode = 'normal') => {
    try {
        const systemMessage = {
            role: 'system',
            content: getSystemPrompt(mode),
        };

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: process.env.OPENROUTER_MODEL,
                messages: [systemMessage, ...messages],
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error('Error fetching AI response:', error.response ? error.response.data : error.message);
        return "The AI is offline. But your discipline shouldn't be. Get to work.";
    }
};