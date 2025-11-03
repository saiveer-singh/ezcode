import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables from Railway
const FIREBASE_URL = process.env.FIREBASE_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/', (req, res) => {
	res.json({
		status: 'online',
		service: 'Tissue AI Backend',
		version: '2.1.0'
	});
});

// Test endpoint
app.get('/test', (req, res) => {
	res.json({
		message: 'Backend is working!',
		firebase: !!FIREBASE_URL,
		gemini: !!GEMINI_API_KEY,
		openrouter: !!OPENROUTER_API_KEY
	});
});

// Generate Animation
app.post('/api/generate/animation', async (req, res) => {
	try {
		const { prompt, duration, rigType, systemPrompt } = req.body;

		if (!prompt || !systemPrompt) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		const response = await axios.post(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
			{
				contents: [{ parts: [{ text: systemPrompt }] }],
				generationConfig: {
					temperature: 0.8,
					maxOutputTokens: 8192,
					topP: 0.95
				}
			},
			{
				headers: { 'Content-Type': 'application/json' }
			}
		);

		if (response.data.candidates && response.data.candidates[0]) {
			const aiText = response.data.candidates[0].content.parts[0].text;
			res.json({
				success: true,
				data: aiText,
				usage: response.data.usageMetadata || null
			});
		} else {
			res.status(500).json({ error: 'Invalid AI response' });
		}
	} catch (error) {
		console.error('Animation generation error:', error.message);
		res.status(500).json({
			error: error.response?.data?.error?.message || error.message
		});
	}
});

// Generate VFX
app.post('/api/generate/vfx', async (req, res) => {
	try {
		const { prompt, systemPrompt } = req.body;

		if (!prompt || !systemPrompt) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		const response = await axios.post(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
			{
				contents: [{ parts: [{ text: systemPrompt }] }],
				generationConfig: {
					temperature: 0.8,
					maxOutputTokens: 8192,
					topP: 0.95
				}
			},
			{
				headers: { 'Content-Type': 'application/json' }
			}
		);

		if (response.data.candidates && response.data.candidates[0]) {
			const aiText = response.data.candidates[0].content.parts[0].text;
			res.json({
				success: true,
				data: aiText,
				usage: response.data.usageMetadata || null
			});
		} else {
			res.status(500).json({ error: 'Invalid AI response' });
		}
	} catch (error) {
		console.error('VFX generation error:', error.message);
		res.status(500).json({
			error: error.response?.data?.error?.message || error.message
		});
	}
});

// Generate Script
app.post('/api/generate/script', async (req, res) => {
	try {
		const { prompt, systemPrompt } = req.body;

		if (!prompt || !systemPrompt) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		const response = await axios.post(
			'https://openrouter.ai/api/v1/chat/completions',
			{
				model: 'google/gemini-2.0-flash-exp:free',
				messages: [{ role: 'user', content: systemPrompt }],
				temperature: 0.7,
				max_tokens: 4096
			},
			{
				headers: {
					'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
					'Content-Type': 'application/json',
					'HTTP-Referer': 'https://github.com/tissue-ai',
					'X-Title': 'Tissue AI Plugin'
				}
			}
		);

		if (response.data.choices && response.data.choices[0]) {
			const aiText = response.data.choices[0].message.content;
			res.json({
				success: true,
				data: aiText,
				usage: response.data.usage || null
			});
		} else {
			res.status(500).json({ error: 'Invalid AI response' });
		}
	} catch (error) {
		console.error('Script generation error:', error.message);
		res.status(500).json({
			error: error.response?.data?.error?.message || error.message
		});
	}
});

// Generate UI
app.post('/api/generate/ui', async (req, res) => {
	try {
		const { prompt, systemPrompt } = req.body;

		if (!prompt || !systemPrompt) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		const response = await axios.post(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
			{
				contents: [{ parts: [{ text: systemPrompt }] }],
				generationConfig: {
					temperature: 0.8,
					maxOutputTokens: 8192,
					topP: 0.95
				}
			},
			{
				headers: { 'Content-Type': 'application/json' }
			}
		);

		if (response.data.candidates && response.data.candidates[0]) {
			const aiText = response.data.candidates[0].content.parts[0].text;
			res.json({
				success: true,
				data: aiText,
				usage: response.data.usageMetadata || null
			});
		} else {
			res.status(500).json({ error: 'Invalid AI response' });
		}
	} catch (error) {
		console.error('UI generation error:', error.message);
		res.status(500).json({
			error: error.response?.data?.error?.message || error.message
		});
	}
});

// Firebase - Load Coins
app.get('/api/coins/:userId', async (req, res) => {
	try {
		const { userId } = req.params;

		const response = await axios.get(`${FIREBASE_URL}/users/${userId}.json`);

		if (response.data === null || response.data === '') {
			// New user
			res.json({ coins: 100, isNew: true });
		} else {
			res.json({ coins: response.data.coins || 100, isNew: false });
		}
	} catch (error) {
		console.error('Load coins error:', error.message);
		res.status(500).json({ error: error.message });
	}
});

// Firebase - Save Coins
app.put('/api/coins/:userId', async (req, res) => {
	try {
		const { userId } = req.params;
		const { coins } = req.body;

		if (typeof coins !== 'number') {
			return res.status(400).json({ error: 'Invalid coins value' });
		}

		const data = {
			coins,
			lastUpdated: Date.now(),
			userId: parseInt(userId)
		};

		await axios.put(
			`${FIREBASE_URL}/users/${userId}.json`,
			data,
			{ headers: { 'Content-Type': 'application/json' } }
		);

		res.json({ success: true, coins });
	} catch (error) {
		console.error('Save coins error:', error.message);
		res.status(500).json({ error: error.message });
	}
});

// Error handling
app.use((err, req, res, next) => {
	console.error('Unhandled error:', err);
	res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
	console.log(`╔═══════════════════════════════════════╗`);
	console.log(`║   TISSUE AI BACKEND SERVER           ║`);
	console.log(`╚═══════════════════════════════════════╝`);
	console.log(`Server running on port ${PORT}`);
	console.log(`Environment check:`);
	console.log(`  - Firebase URL: ${FIREBASE_URL ? '✓' : '✗'}`);
	console.log(`  - Gemini API Key: ${GEMINI_API_KEY ? '✓' : '✗'}`);
	console.log(`  - OpenRouter API Key: ${OPENROUTER_API_KEY ? '✓' : '✗'}`);
	console.log('');
});