const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database table
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_coins (
        user_id BIGINT PRIMARY KEY,
        coins INTEGER NOT NULL DEFAULT 100,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database init failed:', error);
  }
}

initDatabase();

app.use(cors());
app.use(express.json());

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Tissue AI Backend - PostgreSQL Version',
    timestamp: new Date().toISOString()
  });
});

// Get user coins
app.get('/api/coins/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const result = await pool.query(
      'SELECT coins FROM user_coins WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // User doesn't exist, create with 100 starting coins
      await pool.query(
        'INSERT INTO user_coins (user_id, coins) VALUES ($1, $2)',
        [userId, 100]
      );
      return res.json({ success: true, coins: 100 });
    }

    res.json({ success: true, coins: result.rows[0].coins });
  } catch (error) {
    console.error('Get coins error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user coins
app.put('/api/coins/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { coins } = req.body;

    await pool.query(
      `INSERT INTO user_coins (user_id, coins, last_updated) 
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) 
       DO UPDATE SET coins = $2, last_updated = CURRENT_TIMESTAMP`,
      [userId, coins]
    );

    res.json({ success: true, coins });
  } catch (error) {
    console.error('Update coins error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add coins to user
app.post('/api/coins/:userId/add', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { amount } = req.body;

    const result = await pool.query(
      `INSERT INTO user_coins (user_id, coins, last_updated) 
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         coins = user_coins.coins + $2,
         last_updated = CURRENT_TIMESTAMP
       RETURNING coins`,
      [userId, amount]
    );

    const newBalance = result.rows[0].coins;
    console.log(`✅ Added ${amount} coins to User ${userId}. New balance: ${newBalance}`);
    
    res.json({ success: true, coins: newBalance });
  } catch (error) {
    console.error('Add coins error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI Generation endpoints (using OpenAI)
app.post('/api/generate/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { prompt, systemPrompt } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'OpenAI API key not configured' 
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'OpenAI API error');
    }

    res.json({
      success: true,
      data: data.choices[0].message.content,
      usage: data.usage
    });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   TISSUE AI BACKEND - POSTGRESQL      ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log(`🤖 OpenAI: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured'}`);
});