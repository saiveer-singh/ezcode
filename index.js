// Tissue AI Railway Backend - FIXED WITH FIREBASE AUTH
// Version 3.1 - Properly Authenticated

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Environment Variables
const FIREBASE_URL = process.env.FIREBASE_URL || 'https://tissueai-coins-default-rtdb.firebaseio.com';
const FIREBASE_AUTH = process.env.FIREBASE_AUTH || ''; // You need to set this!
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());

// Logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ========================================
// FIREBASE FUNCTIONS (FIXED)
// ========================================

function getFirebaseURL(userId) {
  // Add auth parameter if provided
  const authParam = FIREBASE_AUTH ? `?auth=${FIREBASE_AUTH}` : '';
  return `${FIREBASE_URL}/users/${userId}.json${authParam}`;
}

async function loadCoinsFromFirebase(userId) {
  try {
    const url = getFirebaseURL(userId);
    console.log(`Loading coins for user ${userId}...`);
    
    const response = await axios.get(url);
    
    // Handle new user (null response)
    if (response.data === null || response.data === '') {
      console.log(`New user ${userId} - initializing with 100 coins`);
      await saveCoinsToFirebase(userId, 100);
      return 100;
    }
    
    const coins = response.data.coins || 100;
    console.log(`✅ Loaded ${coins} coins for user ${userId}`);
    return coins;
    
  } catch (error) {
    console.error('Load coins error:', error.message);
    
    // If 404, user doesn't exist yet
    if (error.response?.status === 404) {
      console.log(`User ${userId} not found - initializing`);
      await saveCoinsToFirebase(userId, 100);
      return 100;
    }
    
    throw error;
  }
}

async function saveCoinsToFirebase(userId, coins) {
  try {
    const url = getFirebaseURL(userId);
    console.log(`Saving ${coins} coins for user ${userId}...`);
    
    const data = {
      coins: coins,
      lastUpdated: Date.now(),
      userId: userId
    };
    
    await axios.put(url, data);
    console.log(`✅ Saved ${coins} coins for user ${userId}`);
    return true;
    
  } catch (error) {
    console.error('Save coins error:', error.message);
    throw error;
  }
}

// ========================================
// AI GENERATION (USING OPENROUTER)
// ========================================

async function callAI(systemPrompt, userPrompt) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }
  
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://tissue-ai.com',
          'X-Title': 'Tissue AI Plugin'
        }
      }
    );
    
    return {
      text: response.data.choices[0].message.content,
      usage: response.data.usage
    };
    
  } catch (error) {
    console.error('AI Error:', error.message);
    throw error;
  }
}

// ========================================
// ROUTES
// ========================================

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Backend is running!',
    firebase: FIREBASE_URL,
    hasAuth: !!FIREBASE_AUTH
  });
});

// Load coins
app.get('/api/coins/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (!userId || userId <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid user ID' 
      });
    }
    
    const coins = await loadCoinsFromFirebase(userId);
    
    res.json({ 
      success: true, 
      coins: coins 
    });
    
  } catch (error) {
    console.error('Load coins endpoint error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Save coins
app.put('/api/coins/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { coins } = req.body;
    
    if (!userId || userId <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid user ID' 
      });
    }
    
    if (typeof coins !== 'number' || coins < 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid coin amount' 
      });
    }
    
    await saveCoinsToFirebase(userId, coins);
    
    res.json({ 
      success: true, 
      coins: coins 
    });
    
  } catch (error) {
    console.error('Save coins endpoint error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Add coins (for purchases)
app.post('/api/coins/:userId/add', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { amount } = req.body;
    
    if (!userId || userId <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid user ID' 
      });
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid amount' 
      });
    }
    
    const currentCoins = await loadCoinsFromFirebase(userId);
    const newCoins = currentCoins + amount;
    await saveCoinsToFirebase(userId, newCoins);
    
    res.json({ 
      success: true, 
      coins: newCoins,
      added: amount
    });
    
  } catch (error) {
    console.error('Add coins endpoint error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Generate Animation
app.post('/api/generate/animation', async (req, res) => {
  try {
    const { prompt, systemPrompt } = req.body;
    
    if (!prompt || !systemPrompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing prompt or systemPrompt' 
      });
    }
    
    const result = await callAI(systemPrompt, prompt);
    
    res.json({ 
      success: true, 
      data: result.text,
      usage: result.usage
    });
    
  } catch (error) {
    console.error('Animation generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Generate VFX
app.post('/api/generate/vfx', async (req, res) => {
  try {
    const { prompt, systemPrompt } = req.body;
    
    if (!prompt || !systemPrompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing prompt or systemPrompt' 
      });
    }
    
    const result = await callAI(systemPrompt, prompt);
    
    res.json({ 
      success: true, 
      data: result.text,
      usage: result.usage
    });
    
  } catch (error) {
    console.error('VFX generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Generate Script
app.post('/api/generate/script', async (req, res) => {
  try {
    const { prompt, systemPrompt } = req.body;
    
    if (!prompt || !systemPrompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing prompt or systemPrompt' 
      });
    }
    
    const result = await callAI(systemPrompt, prompt);
    
    res.json({ 
      success: true, 
      data: result.text,
      usage: result.usage
    });
    
  } catch (error) {
    console.error('Script generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Generate UI
app.post('/api/generate/ui', async (req, res) => {
  try {
    const { prompt, systemPrompt } = req.body;
    
    if (!prompt || !systemPrompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing prompt or systemPrompt' 
      });
    }
    
    const result = await callAI(systemPrompt, prompt);
    
    res.json({ 
      success: true, 
      data: result.text,
      usage: result.usage
    });
    
  } catch (error) {
    console.error('UI generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   TISSUE AI RAILWAY BACKEND v3.1     ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📦 Firebase: ${FIREBASE_URL}`);
  console.log(`🔐 Auth: ${FIREBASE_AUTH ? 'Configured ✅' : 'NOT SET ⚠️'}`);
  console.log(`🤖 OpenRouter: ${OPENROUTER_API_KEY ? 'Ready' : 'Not configured'}`);
  console.log('');
  console.log('Ready to accept requests!');
});