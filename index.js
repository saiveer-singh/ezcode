const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3000;

// In-memory storage (replace with database later)
const userCoins = new Map();
const STARTING_COINS = 100;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Helper to send JSON response
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, corsHeaders);
  res.end(JSON.stringify(data));
}

// Helper to parse JSON body
function parseBody(req, callback) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      callback(null, JSON.parse(body));
    } catch (err) {
      callback(err);
    }
  });
}

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  console.log(`${method} ${pathname}`);

  // Test endpoint
  if (pathname === '/test' && method === 'GET') {
    return sendJSON(res, 200, {
      success: true,
      message: 'Tissue AI Backend - Memory Storage',
      timestamp: new Date().toISOString()
    });
  }

  // Get user coins
  if (pathname.startsWith('/api/coins/') && method === 'GET') {
    const userId = pathname.split('/')[3];
    
    if (!userCoins.has(userId)) {
      userCoins.set(userId, STARTING_COINS);
    }
    
    return sendJSON(res, 200, {
      success: true,
      coins: userCoins.get(userId)
    });
  }

  // Update user coins
  if (pathname.startsWith('/api/coins/') && !pathname.endsWith('/add') && method === 'PUT') {
    const userId = pathname.split('/')[3];
    
    parseBody(req, (err, body) => {
      if (err) {
        return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      }
      
      userCoins.set(userId, body.coins);
      console.log(`✅ Updated User ${userId}: ${body.coins} coins`);
      
      return sendJSON(res, 200, {
        success: true,
        coins: body.coins
      });
    });
    return;
  }

  // Add coins to user
  if (pathname.endsWith('/add') && method === 'POST') {
    const userId = pathname.split('/')[3];
    
    parseBody(req, (err, body) => {
      if (err) {
        return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      }
      
      const currentCoins = userCoins.get(userId) || STARTING_COINS;
      const newCoins = currentCoins + body.amount;
      userCoins.set(userId, newCoins);
      
      console.log(`✅ Added ${body.amount} coins to User ${userId}. New balance: ${newCoins}`);
      
      return sendJSON(res, 200, {
        success: true,
        coins: newCoins
      });
    });
    return;
  }

  // AI Generation endpoints
  if (pathname.startsWith('/api/generate/') && method === 'POST') {
    const type = pathname.split('/')[3];
    
    parseBody(req, async (err, body) => {
      if (err) {
        return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      }

      if (!process.env.OPENAI_API_KEY) {
        return sendJSON(res, 500, {
          success: false,
          error: 'OpenAI API key not configured'
        });
      }

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [
              { role: 'system', content: body.systemPrompt },
              { role: 'user', content: body.prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || 'OpenAI API error');
        }

        return sendJSON(res, 200, {
          success: true,
          data: data.choices[0].message.content,
          usage: data.usage
        });

      } catch (error) {
        console.error('Generation error:', error);
        return sendJSON(res, 500, {
          success: false,
          error: error.message
        });
      }
    });
    return;
  }

  // 404
  sendJSON(res, 404, { success: false, error: 'Not found' });
});

server.listen(PORT, () => {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   TISSUE AI BACKEND v3.1              ║');
  console.log('║   Zero Dependencies - Memory Storage  ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`🤖 OpenAI: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`💾 Storage: In-Memory (resets on restart)`);
});