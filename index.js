const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3000;

// In-memory storage
const userCoins = new Map();
const STARTING_COINS = 100;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, corsHeaders);
  const jsonString = JSON.stringify(data);
  console.log(`📤 Response (${statusCode}): ${jsonString.length} bytes`);
  res.end(jsonString);
}

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
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  console.log(`\n${method} ${pathname}`);

  // Test endpoint
  if (pathname === '/test' && method === 'GET') {
    return sendJSON(res, 200, {
      success: true,
      message: 'Tissue AI Backend v4.0 - Optimized',
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
  if (pathname.startsWith('/api/coins/') && !pathname.endsWith('/add') && method === 'PUT') {
    const userId = pathname.split('/')[3];
    parseBody(req, (err, body) => {
      if (err) {
        return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      }
      userCoins.set(userId, body.coins);
      console.log(`✅ User ${userId}: ${body.coins} coins`);
      return sendJSON(res, 200, { success: true, coins: body.coins });
    });
    return;
  }

  // Add coins
  if (pathname.endsWith('/add') && method === 'POST') {
    const userId = pathname.split('/')[3];
    parseBody(req, (err, body) => {
      if (err) {
        return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      }
      const currentCoins = userCoins.get(userId) || STARTING_COINS;
      const newCoins = currentCoins + body.amount;
      userCoins.set(userId, newCoins);
      console.log(`✅ +${body.amount} coins → User ${userId}: ${newCoins} total`);
      return sendJSON(res, 200, { success: true, coins: newCoins });
    });
    return;
  }

  // AI Generation endpoints
  if (pathname.startsWith('/api/generate/') && method === 'POST') {
    const type = pathname.split('/')[3];

    parseBody(req, async (err, body) => {
      if (err) {
        console.error('❌ Parse error:', err);
        return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      }

      if (!process.env.OPENAI_API_KEY) {
        return sendJSON(res, 500, { success: false, error: 'API key not configured' });
      }

      if (!body.systemPrompt || !body.prompt) {
        return sendJSON(res, 400, { success: false, error: 'Missing systemPrompt or prompt' });
      }

      try {
        console.log(`🤖 Type: ${type}`);
        console.log(`📝 Prompt: ${body.prompt.length} chars`);
        console.log(`📋 System: ${body.systemPrompt.length} chars`);

        // CRITICAL FIX: Reduce max tokens based on type
        const maxTokensByType = {
          animation: 8000,  // Was 20000 - way too high!
          vfx: 4000,
          script: 6000,
          ui: 5000
        };

        const maxTokens = maxTokensByType[type] || 4000;
        console.log(`🎯 Max tokens: ${maxTokens}`);

        const requestBody = {
          model: 'gpt-5-nano',
          messages: [
            { role: 'system', content: body.systemPrompt },
            { role: 'user', content: body.prompt }
          ],
          max_completion_tokens: maxTokens,  // REDUCED!
          response_format: { type: 'json_object' },
          temperature: 0.7  // Add some creativity control
        };

        console.log('⏳ Calling OpenAI...');
        const startTime = Date.now();

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
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`⏱️ Time: ${elapsed}s`);
        console.log(`📊 Status: ${response.status}`);

        if (!response.ok) {
          console.error('❌ OpenAI error:', data.error?.message);
          return sendJSON(res, 500, {
            success: false,
            error: data.error?.message || 'OpenAI API error'
          });
        }

        if (!data.choices?.[0]?.message?.content) {
          console.error('❌ Empty/invalid response');
          console.error('Finish reason:', data.choices?.[0]?.finish_reason);
          return sendJSON(res, 500, {
            success: false,
            error: 'Empty response from AI',
            finish_reason: data.choices?.[0]?.finish_reason
          });
        }

        const content = data.choices[0].message.content;
        const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        console.log(`✅ Success!`);
        console.log(`📊 Tokens: ${usage.total_tokens} (in: ${usage.prompt_tokens}, out: ${usage.completion_tokens})`);
        console.log(`📏 Content: ${content.length} chars`);
        console.log(`🏁 Finish: ${data.choices[0].finish_reason}`);

        // Warn if hitting limits
        if (data.choices[0].finish_reason === 'length') {
          console.warn('⚠️ WARNING: Hit token limit! Response may be incomplete.');
        }

        return sendJSON(res, 200, {
          success: true,
          data: content,
          usage: usage,
          model: data.model,
          finish_reason: data.choices[0].finish_reason,
          elapsed_seconds: parseFloat(elapsed)
        });

      } catch (error) {
        console.error('❌ Exception:', error.message);
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
  console.log('║   TISSUE AI BACKEND v4.0              ║');
  console.log('║   GPT-5 Nano - OPTIMIZED              ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🤖 Model: gpt-5-nano`);
  console.log(`🔑 OpenAI: ${process.env.OPENAI_API_KEY ? '✅' : '❌'}`);
  console.log(`⚡ Max tokens: animation=8000, vfx=4000, script=6000, ui=5000`);
  console.log('');
});