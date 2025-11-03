// server.js - COMPLETE VERSION WITH OPENAI + OPENROUTER SUPPORT
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting storage
const rateLimits = new Map();

// Simple rate limiter (20 requests per minute per user)
function checkRateLimit(userId) {
  const now = Date.now();
  const userLimit = rateLimits.get(userId) || { count: 0, resetTime: now + 60000 };
  
  if (now > userLimit.resetTime) {
    rateLimits.set(userId, { count: 1, resetTime: now + 60000 });
    return true;
  }
  
  if (userLimit.count >= 20) {
    return false;
  }
  
  userLimit.count++;
  rateLimits.set(userId, userLimit);
  return true;
}

// Check if user has purchased coins
async function checkUserHasPaidCoins(userId) {
  try {
    const firebaseUrl = `${process.env.FIREBASE_URL}/users/${userId}.json`;
    const response = await fetch(firebaseUrl);
    const data = await response.json();
    
    // User has paid if coins > 100 (starting amount)
    return data && data.coins > 100;
  } catch (error) {
    console.error('[Tier Check] Error:', error);
    return false;
  }
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'online', 
    message: 'Tissue AI Backend v1.0',
    endpoints: [
      '/api/gemini',
      '/api/generate',
      '/api/firebase/coins'
    ],
    tiers: {
      free: 'GLM-4.6 (via OpenRouter)',
      paid: 'GPT-5 Nano (via OpenAI)'
    }
  });
});

// Gemini API Proxy (for animations/VFX/UI)
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt, userId, temperature, maxTokens } = req.body;
    
    if (!prompt || !userId) {
      return res.status(400).json({ error: 'Missing prompt or userId' });
    }
    
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
    }
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: temperature || 0.8,
        maxOutputTokens: maxTokens || 8192,
        topP: 0.95
      }
    };
    
    console.log(`[Gemini] Request from user ${userId}`);
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('[Gemini] Error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });
    }
    
    console.log(`[Gemini] Success for user ${userId}`);
    res.json(data);
    
  } catch (error) {
    console.error('[Gemini] Exception:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Unified AI Generation Endpoint (Scripting - with tier support)
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, userId, temperature, maxTokens } = req.body;
    
    if (!prompt || !userId) {
      return res.status(400).json({ error: 'Missing prompt or userId' });
    }
    
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
    }
    
    // Check user tier
    const hasPaidCoins = await checkUserHasPaidCoins(userId);
    const tier = hasPaidCoins ? 'paid' : 'free';
    
    console.log(`[Generate] User ${userId} - Tier: ${tier.toUpperCase()}`);
    
    let data;
    
    if (hasPaidCoins) {
      // PAID TIER: Use OpenAI GPT-5 Nano
      console.log(`[OpenAI] Calling GPT-5 Nano for user ${userId}`);
      
      const payload = {
        model: 'gpt-5-nano',
        messages: [{ role: 'user', content: prompt }],
        temperature: temperature || 0.7,
        max_tokens: maxTokens || 4096
      };
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      data = await response.json();
      
      if (!response.ok) {
        console.error('[OpenAI] Error:', data);
        return res.status(response.status).json({ 
          error: data.error?.message || 'OpenAI API error' 
        });
      }
      
      data.tier = 'paid';
      data.model_used = 'gpt-5-nano';
      
    } else {
      // FREE TIER: Use OpenRouter GLM-4.6
      console.log(`[OpenRouter] Calling GLM-4.6 for user ${userId}`);
      
      const payload = {
        model: 'z-ai/glm-4-32b',
        messages: [{ role: 'user', content: prompt }],
        temperature: temperature || 0.7,
        max_tokens: maxTokens || 4096
      };
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/tissue-ai',
          'X-Title': 'Tissue AI Plugin'
        },
        body: JSON.stringify(payload)
      });
      
      data = await response.json();
      
      if (!response.ok) {
        console.error('[OpenRouter] Error:', data);
        return res.status(response.status).json({ 
          error: data.error?.message || 'OpenRouter API error' 
        });
      }
      
      data.tier = 'free';
      data.model_used = 'z-ai/glm-4-32b';
    }
    
    console.log(`[Generate] Success - Model: ${data.model_used}`);
    res.json(data);
    
  } catch (error) {
    console.error('[Generate] Exception:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Firebase Proxy - Load Coins
app.get('/api/firebase/coins/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }
    
    const firebaseUrl = `${process.env.FIREBASE_URL}/users/${userId}.json`;
    console.log(`[Firebase] Loading coins for user ${userId}`);
    
    const response = await fetch(firebaseUrl);
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Firebase error' });
    }
    
    if (data === null || !data.coins) {
      return res.json({ coins: 100, isNew: true });
    }
    
    res.json({ coins: data.coins, isNew: false });
    
  } catch (error) {
    console.error('[Firebase] Load exception:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Firebase Proxy - Save Coins
app.put('/api/firebase/coins/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { coins } = req.body;
    
    if (!userId || coins === undefined) {
      return res.status(400).json({ error: 'Missing userId or coins' });
    }
    
    const firebaseUrl = `${process.env.FIREBASE_URL}/users/${userId}.json`;
    
    const payload = {
      coins: coins,
      lastUpdated: Date.now(),
      userId: userId
    };
    
    console.log(`[Firebase] Saving ${coins} coins for user ${userId}`);
    
    const response = await fetch(firebaseUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Firebase error' });
    }
    
    res.json({ success: true, data });
    
  } catch (error) {
    console.error('[Firebase] Save exception:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('═══════════════════════════════════════');
  console.log('  🚀 Tissue AI Backend Server');
  console.log('═══════════════════════════════════════');
  console.log(`  📡 Server: http://localhost:${PORT}`);
  console.log('═══════════════════════════════════════');
  console.log('  🎯 Model Tiers:');
  console.log('  FREE:  GLM-4.6 (OpenRouter)');
  console.log('  PAID:  GPT-5 Nano (OpenAI)');
  console.log('═══════════════════════════════════════');
  console.log('  Endpoints:');
  console.log('  • POST /api/gemini (animations/VFX/UI)');
  console.log('  • POST /api/generate (scripting)');
  console.log('  • GET  /api/firebase/coins/:userId');
  console.log('  • PUT  /api/firebase/coins/:userId');
  console.log('═══════════════════════════════════════');
});