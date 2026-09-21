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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !token) {
    return res.status(503).json({
      error: 'Jev credentials are not configured'
    });
  }

  try {
    const state =
      req.body && req.body.state
        ? req.body.state
        : req.body;

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 4500);

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

    const data = await response.json();

    if (!response.ok || data.success === false) {
      return res.status(response.status || 502).json({
        error: 'Cloudflare Jev request failed',
        details: data
      });
    }

    const result = data.result || data;

    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({
      error: 'Jev proxy failed',
      message: String(error?.message || error)
    });
  }
}
