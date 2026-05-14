const defaultModel = process.env.OPENAI_MODEL || 'gpt-5-mini';

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGIN || '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function applyCors(request, response) {
  const origins = allowedOrigins();
  const requestOrigin = request.headers.origin;
  const allowAny = origins.includes('*');
  const matchedOrigin = requestOrigin && origins.includes(requestOrigin);

  if (allowAny) {
    response.setHeader('Access-Control-Allow-Origin', '*');
  } else if (matchedOrigin) {
    response.setHeader('Access-Control-Allow-Origin', requestOrigin);
  } else if (!requestOrigin && origins.length) {
    response.setHeader('Access-Control-Allow-Origin', origins[0]);
  }

  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function extractResponseText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === 'output_text' && part.text)
    .map((part) => part.text)
    .join('\n');
}

function parseCards(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(cleaned);
  const cards = Array.isArray(parsed) ? parsed : parsed.cards;
  if (!Array.isArray(cards)) return [];

  return cards
    .slice(0, 24)
    .map((card) => ({
      front: String(card.front || '').trim(),
      back: String(card.back || '').trim(),
      tags: Array.isArray(card.tags) ? card.tags.map((tag) => String(tag).trim()).filter(Boolean) : ['ai'],
      type: String(card.type || '').toLowerCase() === 'cloze' ? 'cloze' : 'basic',
      hint: String(card.hint || '').trim(),
    }))
    .filter((card) => card.front && card.back);
}

async function openAiError(apiResponse) {
  const fallback = 'RecallFlow AI could not generate cards right now.';
  const text = await apiResponse.text();
  try {
    const parsed = JSON.parse(text);
    const error = parsed.error || {};
    if (error.code === 'insufficient_quota') {
      return {
        status: 402,
        body: {
          code: 'insufficient_quota',
          error: 'OpenAI billing credits are required before RecallFlow AI can generate cards.',
        },
      };
    }
    if (error.code === 'invalid_api_key') {
      return {
        status: 401,
        body: {
          code: 'invalid_api_key',
          error: 'The configured OpenAI API key was rejected.',
        },
      };
    }
    return {
      status: apiResponse.status,
      body: { code: error.code || 'openai_error', error: error.message || fallback },
    };
  } catch {
    return {
      status: apiResponse.status,
      body: { code: 'openai_error', error: text || fallback },
    };
  }
}

export default async function handler(request, response) {
  applyCors(request, response);

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    response.status(500).json({ error: 'OPENAI_API_KEY is not configured on the backend.' });
    return;
  }

  let body = {};
  try {
    body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : request.body || {};
  } catch {
    response.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  const { notes = '', mode = 'basic', model = defaultModel } = body;
  const clippedNotes = String(notes).trim().slice(0, 12000);
  if (!clippedNotes) {
    response.status(400).json({ error: 'notes is required' });
    return;
  }

  try {
    const apiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || defaultModel,
        instructions: [
          'You turn study notes into high quality flashcards.',
          'Return only compact JSON matching {"cards":[{"front":"...","back":"...","tags":["..."],"type":"basic|cloze","hint":"..."}]}.',
          'Create 6 to 14 cards. Keep prompts atomic, answers specific, and hints short.',
          mode === 'cloze' ? 'Prefer cloze cards using {{c1::answer}} syntax in the front field.' : 'Prefer basic question and answer cards.',
        ].join(' '),
        input: clippedNotes,
        max_output_tokens: 2200,
      }),
    });

    if (!apiResponse.ok) {
      const failure = await openAiError(apiResponse);
      response.status(failure.status).json(failure.body);
      return;
    }

    const data = await apiResponse.json();
    const cards = parseCards(extractResponseText(data));
    if (!cards.length) {
      response.status(502).json({ error: 'The model response did not contain usable cards.' });
      return;
    }

    response.status(200).json({ cards, model: model || defaultModel });
  } catch (error) {
    response.status(500).json({ error: 'Failed to generate cards.' });
  }
}
