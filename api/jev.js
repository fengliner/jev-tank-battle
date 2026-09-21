
const QUESTIONS = {
  strategy: {
    type: 'choice',
    instructions:
      'Choose the best high-level tactic for the AI tank for the next 0.5 seconds. Prioritize survival, then useful pressure on the player.',
    criteria: {
      ATTACK: 'Use a clear firing line or immediate offensive opportunity',
      CHASE: 'Close distance or improve position toward the player',
      EVADE: 'Avoid an incoming projectile or immediate threat',
      FLANK: 'Move around cover to obtain a firing angle',
      RETREAT: 'Create space because the player is dangerously close'
    }
  },

  movement: {
    type: 'choice',
    instructions:
      'Choose one legal movement for the AI tank. Never intentionally choose a move marked false in state.legalMoves unless STOP is safest.',
    criteria: {
      UP: 'Move up',
      DOWN: 'Move down',
      LEFT: 'Move left',
      RIGHT: 'Move right',
      STOP: 'Hold position'
    }
  },

  fire: {
    type: 'noul',
    instructions:
      'Should the AI tank fire now? Prefer firing when aligned with the player and line of sight is clear.',
    criteria: {
      true: 'Fire now',
      false: 'Do not fire yet'
    }
  },

  danger: {
    type: 'score',
    instructions:
      'Rate the immediate tactical danger to the AI tank.',
    criteria: [
      'Safe',
      'Low danger',
      'Moderate danger',
      'High danger',
      'Immediate lethal danger'
    ]
  }
};

export default async function handler(req, res) {
  // 浏览器直接打开 /api/jev 时，用 GET 做安全诊断
  // 不会返回你的真实 Account ID 或 Token
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      endpoint: '/api/jev',
      accountIdConfigured: !!process.env.CLOUDFLARE_ACCOUNT_ID,
      tokenConfigured: !!process.env.CLOUDFLARE_API_TOKEN,
      model: 'typesafe/jev'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'POST only'
    });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !token) {
    return res.status(503).json({
      error: 'Jev credentials are not configured',
      accountIdConfigured: !!accountId,
      tokenConfigured: !!token
    });
  }

  try {
    const state =
      req.body && req.body.state
        ? req.body.state
        : req.body;

    if (!state || typeof state !== 'object') {
      return res.status(400).json({
        error: 'Missing or invalid game state'
      });
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 6000);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run`,
      {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          model: 'typesafe/jev',

          input: {
            state,
            questions: QUESTIONS
          }
        }),

        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    let data;

    try {
      data = await response.json();
    } catch {
      data = {
        success: false,
        error: 'Cloudflare returned a non-JSON response'
      };
    }

    if (!response.ok || data.success === false) {
      return res.status(response.status || 502).json({
        error: 'Cloudflare Jev request failed',
        cloudflareStatus: response.status,
        details: data
      });
    }

    const result = data.result || data;

    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).json(result);

  } catch (error) {
    const isAbort = error?.name === 'AbortError';

    return res.status(isAbort ? 504 : 500).json({
      error: isAbort
        ? 'Jev request timed out'
        : 'Jev proxy failed',

      message: String(
        error?.message || error
      )
    });
  }
}
