const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3000;

// In-memory storage (use database in production)
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`${req.method} ${pathname}`);

  // ========================================
  // TEST ENDPOINT
  // ========================================
  if (pathname === '/test' && req.method === 'GET') {
    return sendJSON(res, 200, {
      success: true,
      message: 'Tissue AI v4.1 - GPT-5-Nano Enhanced',
      timestamp: new Date().toISOString(),
      model: 'gpt-5-nano',
      status: 'operational'
    });
  }

  // ========================================
  // GET COINS
  // ========================================
  if (pathname.startsWith('/api/coins/') && req.method === 'GET') {
    const userId = pathname.split('/')[3];
    
    if (!userId) {
      return sendJSON(res, 400, { 
        success: false, 
        error: 'User ID required' 
      });
    }

    if (!userCoins.has(userId)) {
      userCoins.set(userId, STARTING_COINS);
      console.log(`💰 New user ${userId}: ${STARTING_COINS} coins`);
    }
    
    return sendJSON(res, 200, {
      success: true,
      coins: userCoins.get(userId),
      userId: userId
    });
  }

  // ========================================
  // UPDATE COINS (PUT)
  // ========================================
  if (
    pathname.startsWith('/api/coins/') &&
    !pathname.endsWith('/add') &&
    req.method === 'PUT'
  ) {
    const userId = pathname.split('/')[3];
    
    if (!userId) {
      return sendJSON(res, 400, { 
        success: false, 
        error: 'User ID required' 
      });
    }

    parseBody(req, (err, body) => {
      if (err) {
        return sendJSON(res, 400, { 
          success: false, 
          error: 'Invalid JSON' 
        });
      }

      if (typeof body.coins !== 'number' || body.coins < 0) {
        return sendJSON(res, 400, { 
          success: false, 
          error: 'Invalid coin amount' 
        });
      }

      const oldBalance = userCoins.get(userId) || STARTING_COINS;
      userCoins.set(userId, body.coins);
      
      console.log(`💰 User ${userId}: ${oldBalance} → ${body.coins}`);
      
      return sendJSON(res, 200, { 
        success: true, 
        coins: body.coins,
        previous: oldBalance
      });
    });
    return;
  }

  // ========================================
  // ADD COINS (POST)
  // ========================================
  if (pathname.endsWith('/add') && req.method === 'POST') {
    const userId = pathname.split('/')[3];
    
    if (!userId) {
      return sendJSON(res, 400, { 
        success: false, 
        error: 'User ID required' 
      });
    }

    parseBody(req, (err, body) => {
      if (err) {
        return sendJSON(res, 400, { 
          success: false, 
          error: 'Invalid JSON' 
        });
      }

      if (typeof body.amount !== 'number' || body.amount <= 0) {
        return sendJSON(res, 400, { 
          success: false, 
          error: 'Invalid amount' 
        });
      }

      const current = userCoins.get(userId) || STARTING_COINS;
      const newTotal = current + body.amount;
      userCoins.set(userId, newTotal);
      
      console.log(`💰 User ${userId}: +${body.amount} → ${newTotal}`);
      
      return sendJSON(res, 200, { 
        success: true, 
        coins: newTotal,
        added: body.amount,
        previous: current
      });
    });
    return;
  }

  // ========================================
  // AI GENERATION
  // ========================================
  if (pathname.startsWith('/api/generate/') && req.method === 'POST') {
    const type = pathname.split('/')[3];

    // Validate generation type
    const validTypes = ['animation', 'vfx', 'script', 'ui'];
    if (!validTypes.includes(type)) {
      return sendJSON(res, 400, {
        success: false,
        error: 'Invalid generation type',
        valid_types: validTypes
      });
    }

    parseBody(req, async (err, body) => {
      if (err) {
        return sendJSON(res, 400, { 
          success: false, 
          error: 'Invalid JSON in request body' 
        });
      }

      // Validate API key
      if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY not set in environment');
        return sendJSON(res, 500, {
          success: false,
          error: 'OpenAI API key not configured on server'
        });
      }

      // Validate required fields
      if (!body.systemPrompt || !body.prompt) {
        return sendJSON(res, 400, {
          success: false,
          error: 'Missing required fields: systemPrompt and prompt'
        });
      }

      try {
        console.log('════════════════════════════════════════');
        console.log(`🤖 Generation Request`);
        console.log(`   Type: ${type}`);
        console.log(`   User Prompt: ${body.prompt.length} chars`);
        console.log(`   System Prompt: ${body.systemPrompt.length} chars`);

        // ENHANCED token limits to prevent truncation
        const maxTokens = {
          animation: 20000,  // Increased from 12000
          vfx: 8000,        // Increased from 5000
          script: 12000,    // Increased from 8000
          ui: 10000         // Increased from 6000
        }[type] || 8000;

        console.log(`   Max Output Tokens: ${maxTokens}`);

        const start = Date.now();

        // Call OpenAI API
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
                { 
                  role: 'system', 
                  content: body.systemPrompt + '\n\nIMPORTANT: Respond with valid JSON immediately. Do not overthink. Generate the JSON structure directly.'
                },
                { 
                  role: 'user', 
                  content: body.prompt 
                }
              ],
              max_completion_tokens: maxTokens,
              response_format: { type: 'json_object' },
              reasoning_effort: 'low'  // CRITICAL: Reduces internal reasoning tokens
            })
          }
        );

        const data = await response.json();
        const elapsed = ((Date.now() - start) / 1000).toFixed(2);

        console.log(`⏱️  Request completed in ${elapsed}s`);
        console.log(`   HTTP Status: ${response.status}`);

        // Handle OpenAI API errors
        if (!response.ok) {
          console.error('❌ OpenAI API Error:');
          console.error(`   Message: ${data.error?.message}`);
          console.error(`   Type: ${data.error?.type}`);
          console.error(`   Code: ${data.error?.code}`);
          
          return sendJSON(res, 500, {
            success: false,
            error: data.error?.message || 'OpenAI API error',
            error_type: data.error?.type,
            error_code: data.error?.code,
            details: data.error
          });
        }

        // Extract response content
        const content = data.choices?.[0]?.message?.content;
        const finishReason = data.choices?.[0]?.finish_reason;
        const usage = data.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        };

        const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens || 0;
        const outputTokens = usage.completion_tokens - reasoningTokens;

        console.log(`📊 Token Usage:`);
        console.log(`   Prompt: ${usage.prompt_tokens}`);
        console.log(`   Completion: ${usage.completion_tokens}`);
        console.log(`     - Reasoning: ${reasoningTokens}`);
        console.log(`     - Output: ${outputTokens}`);
        console.log(`   Total: ${usage.total_tokens}`);
        console.log(`   Finish Reason: ${finishReason}`);

        // Handle empty response (all reasoning, no output)
        if (!content || content.trim() === '') {
          console.error('❌ EMPTY RESPONSE DETECTED');
          console.error(`   Reasoning consumed: ${reasoningTokens} tokens`);
          console.error(`   Visible output: 0 tokens`);
          console.error(`   Finish reason: ${finishReason}`);
          
          return sendJSON(res, 500, {
            success: false,
            error: 'Model used all tokens for reasoning with no visible output',
            finish_reason: finishReason,
            reasoning_tokens: reasoningTokens,
            max_tokens: maxTokens,
            suggestion: 'Try simplifying the prompt or increase max_completion_tokens',
            usage: usage
          });
        }

        // Warn if truncated
        if (finishReason === 'length') {
          console.warn('⚠️  WARNING: Response hit token limit');
          console.warn(`   Output may be incomplete or truncated`);
          console.warn(`   Consider increasing max_completion_tokens for ${type}`);
        }

        // Success!
        console.log(`✅ Generation successful`);
        console.log(`   Response length: ${content.length} chars`);
        console.log('════════════════════════════════════════');

        return sendJSON(res, 200, {
          success: true,
          data: content,
          usage: usage,
          finish_reason: finishReason,
          elapsed_seconds: parseFloat(elapsed),
          model: 'gpt-5-nano',
          reasoning_tokens: reasoningTokens,
          output_tokens: outputTokens
        });

      } catch (error) {
        console.error('════════════════════════════════════════');
        console.error('❌ FATAL ERROR');
        console.error(`   Message: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
        console.error('════════════════════════════════════════');
        
        return sendJSON(res, 500, {
          success: false,
          error: error.message,
          error_type: error.name,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    });
    return;
  }

  // ========================================
  // 404 - NOT FOUND
  // ========================================
  console.warn(`⚠️  404 Not Found: ${pathname}`);
  sendJSON(res, 404, { 
    success: false, 
    error: 'Endpoint not found',
    path: pathname,
    method: req.method
  });
});

// ========================================
// SERVER STARTUP
// ========================================
server.listen(PORT, () => {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   TISSUE AI BACKEND v4.1              ║');
  console.log('║   GPT-5-NANO ENHANCED                 ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🤖 AI Model: gpt-5-nano`);
  console.log(`⚡ Token Limits:`);
  console.log(`   - Animation: 20,000`);
  console.log(`   - VFX: 8,000`);
  console.log(`   - Scripting: 12,000`);
  console.log(`   - UI: 10,000`);
  console.log(`🔧 Reasoning Effort: LOW`);
  console.log('');
  console.log('📡 Available Endpoints:');
  console.log('   GET  /test');
  console.log('   GET  /api/coins/:userId');
  console.log('   PUT  /api/coins/:userId');
  console.log('   POST /api/coins/:userId/add');
  console.log('   POST /api/generate/animation');
  console.log('   POST /api/generate/vfx');
  console.log('   POST /api/generate/script');
  console.log('   POST /api/generate/ui');
  console.log('');
  console.log('✅ Ready to process requests!');
  console.log('════════════════════════════════════════');
});

// ========================================
// GRACEFUL SHUTDOWN
// ========================================
process.on('SIGTERM', () => {
  console.log('');
  console.log('⚠️  SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('');
  console.log('⚠️  SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});