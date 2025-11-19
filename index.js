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

// ========================================
// ANIMATION SCHEMAS - STRICT COMPLIANCE
// ========================================
const R15_ANIMATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    keyframes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          time: { type: "number", minimum: 0 },
          parts: {
            type: "object",
            additionalProperties: false,
            properties: {
              Root: { $ref: "#/$defs/joint" },
              Waist: { $ref: "#/$defs/joint" },
              Neck: { $ref: "#/$defs/joint" },
              LeftShoulder: { $ref: "#/$defs/joint" },
              LeftElbow: { $ref: "#/$defs/joint" },
              LeftWrist: { $ref: "#/$defs/joint" },
              RightShoulder: { $ref: "#/$defs/joint" },
              RightElbow: { $ref: "#/$defs/joint" },
              RightWrist: { $ref: "#/$defs/joint" },
              LeftHip: { $ref: "#/$defs/joint" },
              LeftKnee: { $ref: "#/$defs/joint" },
              LeftAnkle: { $ref: "#/$defs/joint" },
              RightHip: { $ref: "#/$defs/joint" },
              RightKnee: { $ref: "#/$defs/joint" },
              RightAnkle: { $ref: "#/$defs/joint" }
            },
            required: [
              "Root", "Waist", "Neck",
              "LeftShoulder", "LeftElbow", "LeftWrist",
              "RightShoulder", "RightElbow", "RightWrist",
              "LeftHip", "LeftKnee", "LeftAnkle",
              "RightHip", "RightKnee", "RightAnkle"
            ]
          }
        },
        required: ["time", "parts"]
      }
    }
  },
  required: ["keyframes"],
  $defs: {
    joint: {
      type: "object",
      additionalProperties: false,
      properties: {
        rot: {
          type: "array",
          items: { type: "number" },
          minItems: 3,
          maxItems: 3
        }
      },
      required: ["rot"]
    }
  }
};

const R6_ANIMATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    keyframes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          time: { type: "number", minimum: 0 },
          parts: {
            type: "object",
            additionalProperties: false,
            properties: {
              Torso: { $ref: "#/$defs/joint" },
              Head: { $ref: "#/$defs/joint" },
              "Left Arm": { $ref: "#/$defs/joint" },
              "Right Arm": { $ref: "#/$defs/joint" },
              "Left Leg": { $ref: "#/$defs/joint" },
              "Right Leg": { $ref: "#/$defs/joint" }
            },
            required: ["Torso", "Head", "Left Arm", "Right Arm", "Left Leg", "Right Leg"]
          }
        },
        required: ["time", "parts"]
      }
    }
  },
  required: ["keyframes"],
  $defs: {
    joint: {
      type: "object",
      additionalProperties: false,
      properties: {
        rot: {
          type: "array",
          items: { type: "number" },
          minItems: 3,
          maxItems: 3
        }
      },
      required: ["rot"]
    }
  }
};

// ========================================
// FEW-SHOT EXAMPLES (Makes Nano Smarter)
// ========================================
const ANIMATION_EXAMPLES = {
  r15_wave: `EXAMPLE - R15 wave:
Input: "wave"
Output: {"keyframes":[{"time":0.0,"parts":{"Root":{"rot":[0,0,0]},"Waist":{"rot":[0,0,0]},"Neck":{"rot":[0,0,0]},"LeftShoulder":{"rot":[0,0,0]},"LeftElbow":{"rot":[0,0,0]},"LeftWrist":{"rot":[0,0,0]},"RightShoulder":{"rot":[90,-30,0]},"RightElbow":{"rot":[90,0,0]},"RightWrist":{"rot":[0,0,0]},"LeftHip":{"rot":[0,0,0]},"LeftKnee":{"rot":[0,0,0]},"LeftAnkle":{"rot":[0,0,0]},"RightHip":{"rot":[0,0,0]},"RightKnee":{"rot":[0,0,0]},"RightAnkle":{"rot":[0,0,0]}}},{"time":0.5,"parts":{"Root":{"rot":[0,0,0]},"Waist":{"rot":[0,0,0]},"Neck":{"rot":[0,0,0]},"LeftShoulder":{"rot":[0,0,0]},"LeftElbow":{"rot":[0,0,0]},"LeftWrist":{"rot":[0,0,0]},"RightShoulder":{"rot":[120,-20,0]},"RightElbow":{"rot":[120,0,0]},"RightWrist":{"rot":[0,0,30]},"LeftHip":{"rot":[0,0,0]},"LeftKnee":{"rot":[0,0,0]},"LeftAnkle":{"rot":[0,0,0]},"RightHip":{"rot":[0,0,0]},"RightKnee":{"rot":[0,0,0]},"RightAnkle":{"rot":[0,0,0]}}},{"time":1.0,"parts":{"Root":{"rot":[0,0,0]},"Waist":{"rot":[0,0,0]},"Neck":{"rot":[0,0,0]},"LeftShoulder":{"rot":[0,0,0]},"LeftElbow":{"rot":[0,0,0]},"LeftWrist":{"rot":[0,0,0]},"RightShoulder":{"rot":[90,-30,0]},"RightElbow":{"rot":[90,0,0]},"RightWrist":{"rot":[0,0,0]},"LeftHip":{"rot":[0,0,0]},"LeftKnee":{"rot":[0,0,0]},"LeftAnkle":{"rot":[0,0,0]},"RightHip":{"rot":[0,0,0]},"RightKnee":{"rot":[0,0,0]},"RightAnkle":{"rot":[0,0,0]}}}]}`,
  
  r6_wave: `EXAMPLE - R6 wave:
Input: "wave"
Output: {"keyframes":[{"time":0.0,"parts":{"Torso":{"rot":[0,0,0]},"Head":{"rot":[0,0,0]},"Left Arm":{"rot":[10,0,-15]},"Right Arm":{"rot":[0,-10,90]},"Left Leg":{"rot":[0,0,0]},"Right Leg":{"rot":[0,0,0]}}},{"time":0.5,"parts":{"Torso":{"rot":[0,-5,-5]},"Head":{"rot":[5,15,0]},"Left Arm":{"rot":[10,0,-15]},"Right Arm":{"rot":[-15,-20,150]},"Left Leg":{"rot":[0,0,0]},"Right Leg":{"rot":[0,0,0]}}},{"time":1.0,"parts":{"Torso":{"rot":[0,0,0]},"Head":{"rot":[0,0,0]},"Left Arm":{"rot":[10,0,-15]},"Right Arm":{"rot":[0,-10,90]},"Left Leg":{"rot":[0,0,0]},"Right Leg":{"rot":[0,0,0]}}}]}`
};

// ========================================
// MINIMAL SMART PROMPT GENERATION
// ========================================
function generateSmartPrompt(description, rigType, duration, keyframes) {
  const example = rigType === 'r15' ? ANIMATION_EXAMPLES.r15_wave : ANIMATION_EXAMPLES.r6_wave;
  
  return `${example}

GENERATE ${rigType.toUpperCase()} ANIMATION:
- Duration: ${duration}s
- Keyframes: ${keyframes}
- Action: ${description}
- Output: VALID JSON ONLY`;
}

// ========================================
// VALIDATION & FIXING
// ========================================
function validateAnimation(jsonStr, rigType) {
  try {
    const parsed = JSON.parse(jsonStr);
    const requiredParts = rigType === 'r15'
      ? ["Root", "Waist", "Neck", "LeftShoulder", "LeftElbow", "LeftWrist", "RightShoulder", "RightElbow", "RightWrist", "LeftHip", "LeftKnee", "LeftAnkle", "RightHip", "RightKnee", "RightAnkle"]
      : ["Torso", "Head", "Left Arm", "Right Arm", "Left Leg", "Right Leg"];

    if (!parsed.keyframes || !Array.isArray(parsed.keyframes)) {
      return { valid: false, error: 'No keyframes array' };
    }

    for (const kf of parsed.keyframes) {
      for (const part of requiredParts) {
        if (!kf.parts[part]) {
          return { valid: false, error: `Missing part: ${part}` };
        }
        if (!Array.isArray(kf.parts[part].rot) || kf.parts[part].rot.length !== 3) {
          return { valid: false, error: `Invalid rotation for ${part}` };
        }
      }
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// ========================================
// SMART RETRY WITH MINI
// ========================================
async function retryWithMini(userPrompt, rigType, duration, keyframes, apiKey) {
  console.log('   🔄 Retrying with gpt-5.1...');
  
  const fixPrompt = userPrompt + "\n\nFIX: Ensure ALL parts in EVERY keyframe. Valid JSON.";
  
  const schema = rigType === 'r15' ? R15_ANIMATION_SCHEMA : R6_ANIMATION_SCHEMA;
  
  const response = await fetch(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-5.1',
        messages: [
          { role: 'user', content: fixPrompt }
        ],
        max_completion_tokens: 2500,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'animation',
            schema: schema,
            strict: true
          }
        },
        seed: 42
      })
    }
  );
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error?.message || 'Mini retry failed');
  }
  
  return {
    content: data.choices?.[0]?.message?.content,
    usage: data.usage,
    model: 'gpt-5.1'
  };
}

const server = http.createServer((req, res) => {
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
      message: 'Tissue AI v7.0 - HARDCORE OPTIMIZED',
      timestamp: new Date().toISOString(),
      model: 'gpt-5.1',
      status: 'operational',
      features: [
        '✅ Strict JSON schema validation',
        '✅ Few-shot examples in prompts',
        '✅ Ultra-minimal focused prompts',
        '✅ Smart nano→mini retry fallback',
        '✅ Post-validation fixing',
        '✅ Seed=42 determinism',
        '✅ reasoning_effort: low',
        '✅ No unsupported parameters'
      ]
    });
  }

  // ========================================
  // GET COINS
  // ========================================
  if (pathname.startsWith('/api/coins/') && req.method === 'GET') {
    const userId = pathname.split('/')[3];
    
    if (!userId) {
      return sendJSON(res, 400, { success: false, error: 'User ID required' });
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
  // UPDATE COINS
  // ========================================
  if (
    pathname.startsWith('/api/coins/') &&
    !pathname.endsWith('/add') &&
    req.method === 'PUT'
  ) {
    const userId = pathname.split('/')[3];
    
    if (!userId) {
      return sendJSON(res, 400, { success: false, error: 'User ID required' });
    }

    parseBody(req, (err, body) => {
      if (err) {
        return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      }

      if (typeof body.coins !== 'number' || body.coins < 0) {
        return sendJSON(res, 400, { success: false, error: 'Invalid coin amount' });
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
  // ADD COINS
  // ========================================
  if (pathname.endsWith('/add') && req.method === 'POST') {
    const userId = pathname.split('/')[3];
    
    if (!userId) {
      return sendJSON(res, 400, { success: false, error: 'User ID required' });
    }

    parseBody(req, (err, body) => {
      if (err) {
        return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      }

      if (typeof body.amount !== 'number' || body.amount <= 0) {
        return sendJSON(res, 400, { success: false, error: 'Invalid amount' });
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
  // AI GENERATION (FULLY OPTIMIZED)
  // ========================================
  if (pathname.startsWith('/api/generate/') && req.method === 'POST') {
    const type = pathname.split('/')[3];

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
        return sendJSON(res, 400, { success: false, error: 'Invalid JSON in request body' });
      }

      if (!process.env.OPENAI_API_KEY) {
        return sendJSON(res, 500, {
          success: false,
          error: 'OpenAI API key not configured on server'
        });
      }

      if (!body.prompt || !body.systemPrompt) {
        return sendJSON(res, 400, {
          success: false,
          error: 'Missing required fields: prompt and systemPrompt'
        });
      }

      const rigType = body.rigType || 'r15';
      const duration = body.duration || 1.0;
      const keyframes = body.keyframes || 5;
      const isAnimation = type === 'animation';

      try {
        console.log('════════════════════════════════════════');
        console.log(`🤖 Generation Request (v7.0 - GPT-5.1)`);
        console.log(`   Type: ${type}, Rig: ${rigType}`);
        console.log(`   Duration: ${duration}s, ${keyframes} keyframes`);

        const schema = isAnimation
          ? (rigType === 'r15' ? R15_ANIMATION_SCHEMA : R6_ANIMATION_SCHEMA)
          : null;
        const userPrompt = isAnimation
          ? generateSmartPrompt(body.prompt, rigType, duration, keyframes)
          : body.prompt;

        console.log(`📋 System Prompt: ${body.systemPrompt.length} chars`);
        console.log(`📋 User Prompt: ${userPrompt.length} chars`);

        const start = Date.now();

        // PRIMARY: GPT-5.1
        console.log(`🚀 Calling gpt-5.1...`);
        
        const requestPayload = {
          model: 'gpt-5.1',
          messages: [
            { role: 'system', content: body.systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_completion_tokens: 2000,
          reasoning_effort: 'low',
          seed: 42
        };

        if (schema) {
          requestPayload.response_format = {
            type: 'json_schema',
            json_schema: {
              name: 'animation',
              schema: schema,
              strict: true
            }
          };
        }

        const response = await fetch(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify(requestPayload)
          }
        );

        const data = await response.json();
        const elapsed = ((Date.now() - start) / 1000).toFixed(2);

        console.log(`⏱️  GPT-5.1 completed in ${elapsed}s`);

        if (!response.ok) {
          console.error('❌ GPT-5.1 failed:', data.error?.message);
          return sendJSON(res, 500, {
            success: false,
            error: data.error?.message || 'OpenAI API error',
            error_code: data.error?.code
          });
        }

        let content = data.choices?.[0]?.message?.content;
        let usage = data.usage;
        let model = 'gpt-5.1';

        // VALIDATE
        if (isAnimation) {
          const validation = validateAnimation(content, rigType);
          if (!validation.valid) {
            console.warn(`⚠️  GPT-5.1 validation failed: ${validation.error}`);
            
            try {
              const retryResult = await retryWithMini(userPrompt, rigType, duration, keyframes, process.env.OPENAI_API_KEY);
              content = retryResult.content;
              usage = retryResult.usage;
              model = retryResult.model;
              
              const revalidation = validateAnimation(content, rigType);
              if (!revalidation.valid) {
                console.error(`❌ Retry also failed: ${revalidation.error}`);
                return sendJSON(res, 500, {
                  success: false,
                  error: 'GPT-5.1 failed validation',
                  validation_error: revalidation.error
                });
              }
            } catch (retryErr) {
              console.error('❌ Retry error:', retryErr.message);
              return sendJSON(res, 500, {
                success: false,
                error: 'Retry failed: ' + retryErr.message
              });
            }
          }
        }

        if (!content || content.trim() === '') {
          return sendJSON(res, 500, {
            success: false,
            error: 'Model returned empty response'
          });
        }

        const totalElapsed = ((Date.now() - start) / 1000).toFixed(2);

        console.log(`✅ Success with ${model}`);
        console.log(`   Tokens: ${usage.total_tokens}`);
        console.log(`   Time: ${totalElapsed}s`);
        console.log('════════════════════════════════════════');

        return sendJSON(res, 200, {
          success: true,
          data: JSON.parse(content),
          raw: content,
          usage: usage,
          model: model,
          elapsed_seconds: parseFloat(totalElapsed),
          optimizations: [
            'Strict JSON schema',
            'Few-shot examples',
            'Minimal prompt',
            'Seed=42',
            'GPT-5.1 model',
            'Post-validation'
          ]
        });

      } catch (error) {
        console.error('════════════════════════════════════════');
        console.error('❌ FATAL ERROR:', error.message);
        console.error('════════════════════════════════════════');
        
        return sendJSON(res, 500, {
          success: false,
          error: error.message
        });
      }
    });
    return;
  }

  console.warn(`⚠️  404: ${pathname}`);
  sendJSON(res, 404, { success: false, error: 'Endpoint not found' });
});

server.listen(PORT, () => {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   TISSUE AI v7.0 - HARDCORE          ║');
  console.log('║   GPT-5.1 FULLY OPTIMIZED             ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('');
  console.log('🚀 OPTIMIZATIONS ENABLED:');
  console.log('   ✅ Strict JSON schema validation');
  console.log('   ✅ Few-shot learning examples');
  console.log('   ✅ Ultra-minimal focused prompts');
  console.log('   ✅ Seed=42 determinism');
  console.log('   ✅ GPT-5.1 model');
  console.log('   ✅ Post-generation validation');
  console.log('   ✅ reasoning_effort: low');
  console.log('   ✅ No unsupported parameters');
  console.log('');
  console.log(`🎯 Server running on port ${PORT}`);
  console.log('✅ Ready!');
});

process.on('SIGTERM', () => {
  console.log('⚠️  Shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('⚠️  Shutting down...');
  server.close(() => process.exit(0));
});