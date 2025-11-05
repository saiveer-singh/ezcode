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
  const jsonString = JSON.stringify(data);
  console.log(
    `📤 Sending response (${jsonString.length} bytes):`,
    jsonString.substring(0, 200)
  );
  res.end(jsonString);
}

// Helper to parse JSON body
function parseBody(req, callback) {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
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
      model: 'gpt-5-nano',
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
  if (
    pathname.startsWith('/api/coins/') &&
    !pathname.endsWith('/add') &&
    method === 'PUT'
  ) {
    const userId = pathname.split('/')[3];

    parseBody(req, (err, body) => {
      if (err) {
        return sendJSON(res, 400, {
          success: false,
          error: 'Invalid JSON'
        });
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
        return sendJSON(res, 400, {
          success: false,
          error: 'Invalid JSON'
        });
      }

      const currentCoins = userCoins.get(userId) || STARTING_COINS;
      const newCoins = currentCoins + body.amount;
      userCoins.set(userId, newCoins);

      console.log(
        `✅ Added ${body.amount} coins to User ${userId}. New balance: ${newCoins}`
      );

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
        console.error('❌ Body parse error:', err);
        return sendJSON(res, 400, {
          success: false,
          error: 'Invalid JSON'
        });
      }

      if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OpenAI API key not configured');
        return sendJSON(res, 500, {
          success: false,
          error: 'OpenAI API key not configured'
        });
      }

      if (!body.systemPrompt || !body.prompt) {
        console.error('❌ Missing systemPrompt or prompt');
        return sendJSON(res, 400, {
          success: false,
          error: 'Missing systemPrompt or prompt'
        });
      }

      try {
        console.log(
          `🤖 Calling OpenAI API with model: gpt-5-nano`
        );
        console.log(`📝 User prompt length: ${body.prompt.length}`);
        console.log(
          `📝 System prompt length: ${body.systemPrompt.length}`
        );

        const requestBody = {
          model: 'gpt-5-nano',
          messages: [
            { role: 'system', content: body.systemPrompt },
            { role: 'user', content: body.prompt }
          ],
          max_completion_tokens: 20000,
          response_format: { type: 'json_object' }
        };

        console.log('📤 Sending to OpenAI...');

        const response = await fetch(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify(requestBody)
          }
        );

        const data = await response.json();

        console.log('📥 OpenAI response status:', response.status);
        console.log(
          '📥 OpenAI response keys:',
          Object.keys(data).join(', ')
        );

        if (!response.ok) {
          console.error(
            '❌ OpenAI API Error:',
            JSON.stringify(data, null, 2)
          );
          return sendJSON(res, 500, {
            success: false,
            error: data.error?.message || 'OpenAI API error',
            details: data
          });
        }

        // Validate response structure
        if (
          !data.choices ||
          !Array.isArray(data.choices) ||
          data.choices.length === 0
        ) {
          console.error(
            '❌ Invalid response structure - no choices array'
          );
          console.error('Full response:', JSON.stringify(data, null, 2));
          return sendJSON(res, 500, {
            success: false,
            error: 'Invalid API response structure - no choices',
            debug: data
          });
        }

        if (!data.choices[0].message) {
          console.error('❌ Invalid response structure - no message');
          console.error('Full response:', JSON.stringify(data, null, 2));
          return sendJSON(res, 500, {
            success: false,
            error: 'Invalid API response structure - no message',
            debug: data
          });
        }

        const content = data.choices[0].message.content;

        if (!content || content.trim() === '') {
          console.error('❌ Empty content from OpenAI');
          console.error('Full response:', JSON.stringify(data, null, 2));
          return sendJSON(res, 500, {
            success: false,
            error: 'OpenAI returned empty content',
            debug: data
          });
        }

        console.log(`✅ Generation successful`);
        console.log(`📊 Tokens: ${data.usage?.total_tokens || 'N/A'}`);
        console.log(`📊 Content length: ${content.length} characters`);
        console.log(
          `📝 Content preview: ${content.substring(0, 100)}...`
        );

        return sendJSON(res, 200, {
          success: true,
          data: content,
          usage: data.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          },
          model: 'gpt-5-nano'
        });
      } catch (error) {
        console.error('❌ Generation error:', error);
        console.error('Stack:', error.stack);
        return sendJSON(res, 500, {
          success: false,
          error: error.message,
          stack: error.stack
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
  console.log('║   TISSUE AI BACKEND v3.7              ║');
  console.log('║   GPT-5 Nano - Memory Storage         ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`🤖 Model: gpt-5-nano`);
  console.log(
    `🔑 OpenAI: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Not configured'}`
  );
  console.log(`💾 Storage: In-Memory (resets on restart)`);
});