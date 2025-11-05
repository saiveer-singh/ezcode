const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3000;

const userCoins = new Map();
const STARTING_COINS = 100;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, corsHeaders);
  res.end(JSON.stringify(data));
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

  console.log(`${req.method} ${pathname}`);

  // Test
  if (pathname === '/test' && req.method === 'GET') {
    return sendJSON(res, 200, {
      success: true,
      message: 'Tissue AI v4.0 - GPT-5-Nano Optimized',
      timestamp: new Date().toISOString()
    });
  }

  // Get coins
  if (pathname.startsWith('/api/coins/') && req.method === 'GET') {
    const userId = pathname.split('/')[3];
    if (!userCoins.has(userId)) {
      userCoins.set(userId, STARTING_COINS);
    }
    return sendJSON(res, 200, {
      success: true,
      coins: userCoins.get(userId)
    });
  }

  // Update coins
  if (
    pathname.startsWith('/api/coins/') &&
    !pathname.endsWith('/add') &&
    req.method === 'PUT'
  ) {
    const userId = pathname.split('/')[3];
    parseBody(req, (err, body) => {
      if (err)
        return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      userCoins.set(userId, body.coins);
      return sendJSON(res, 200, { success: true, coins: body.coins });
    });
    return;
  }

  // Add coins
  if (pathname.endsWith('/add') && req.method === 'POST') {
    const userId = pathname.split('/')[3];
    parseBody(req, (err, body) => {
      if (err)
        return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      const current = userCoins.get(userId) || STARTING_COINS;
      const newTotal = current + body.amount;
      userCoins.set(userId, newTotal);
      return sendJSON(res, 200, { success: true, coins: newTotal });
    });
    return;
  }

  // AI Generation
  if (pathname.startsWith('/api/generate/') && req.method === 'POST') {
    const type = pathname.split('/')[3];

    parseBody(req, async (err, body) => {
      if (err) {
        return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      }

      if (!process.env.OPENAI_API_KEY) {
        return sendJSON(res, 500, {
          success: false,
          error: 'API key missing'
        });
      }

      if (!body.systemPrompt || !body.prompt) {
        return sendJSON(res, 400, {
          success: false,
          error: 'Missing prompts'
        });
      }

      try {
        console.log(
          `🤖 Type: ${type} | Prompt: ${body.prompt.length}c | System: ${body.systemPrompt.length}c`
        );

        // INCREASED token limits to prevent truncation
        const maxTokens = {
          animation: 12000, // Increased from 6000
          vfx: 5000, // Increased from 3000
          script: 8000, // Increased from 4000
          ui: 6000 // Increased from 3500
        }[type] || 5000;

        console.log(`🎯 Max tokens: ${maxTokens}`);

        const start = Date.now();

        const response = await fetch(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gpt-5-nano',
              messages: [
                { role: 'system', content: body.systemPrompt },
                { role: 'user', content: body.prompt }
              ],
              max_completion_tokens: maxTokens,
              response_format: { type: 'json_object' }
            })
          }
        );

        const data = await response.json();
        const elapsed = ((Date.now() - start) / 1000).toFixed(2);

        console.log(`⏱️ ${elapsed}s | Status: ${response.status}`);

        if (!response.ok) {
          console.error(`❌ OpenAI error: ${data.error?.message}`);
          return sendJSON(res, 500, {
            success: false,
            error: data.error?.message || 'OpenAI error',
            details: data.error
          });
        }

        const content = data.choices?.[0]?.message?.content;
        const finishReason = data.choices?.[0]?.finish_reason;

        // Enhanced empty response handling
        if (!content || content.trim() === '') {
          console.error(
            `❌ Empty response | Finish: ${finishReason} | Full response:`
          );
          console.error(JSON.stringify(data, null, 2));

          return sendJSON(res, 500, {
            success: false,
            error: 'Empty AI response - model may not support this request',
            finish_reason: finishReason,
            model_used: 'gpt-5-nano',
            suggestion:
              'Try using gpt-4o-mini if gpt-5-nano is not available',
            raw_response: data
          });
        }

        const usage = data.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        };

        console.log(
          `✅ ${usage.total_tokens}t (${usage.prompt_tokens}+${usage.completion_tokens}) | ${content.length}c`
        );

        if (finishReason === 'length') {
          console.warn(
            `⚠️ Hit token limit! Response may be incomplete. Consider increasing max_completion_tokens.`
          );
        }

        return sendJSON(res, 200, {
          success: true,
          data: content,
          usage: usage,
          finish_reason: finishReason,
          elapsed_seconds: parseFloat(elapsed)
        });
      } catch (error) {
        console.error(`❌ ${error.message}`);
        console.error(error.stack);
        return sendJSON(res, 500, {
          success: false,
          error: error.message,
          stack: error.stack
        });
      }
    });
    return;
  }

  sendJSON(res, 404, { success: false, error: 'Not found' });
});

server.listen(PORT, () => {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   TISSUE AI v4.0 - OPTIMIZED          ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🤖 Model: gpt-5-nano`);
  console.log(
    `⚡ Max: anim=12k, vfx=5k, script=8k, ui=6k`
  );
});