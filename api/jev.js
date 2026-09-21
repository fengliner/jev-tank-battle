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

async function callJev(accountId, token, state, questions = QUESTIONS) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 6000);

  try {
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
            questions
          }
        }),

        signal: controller.signal
      }
    );

    let data;

    try {
      data = await response.json();
    } catch {
      data = {
        success: false,
        error: 'Cloudflare returned a non-JSON response'
      };
    }

    return {
      ok: response.ok,
      status: response.status,
      data
    };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  /*
   * GET /api/jev
   *
   * 普通诊断：
   * 只检查 Vercel 是否成功读取环境变量。
   * 不会暴露 Account ID 或 API Token。
   *
   * GET /api/jev?test=1
   *
   * 会实际向 Cloudflare Jev 发起一次测试请求，
   * 用来判断 Token 权限、Account ID、Jev 服务是否正常。
   */
  if (req.method === 'GET') {
    if (req.query?.test !== '1') {
      return res.status(200).json({
        ok: true,
        endpoint: '/api/jev',
        accountIdConfigured: !!accountId,
        tokenConfigured: !!token,
        model: 'typesafe/jev',
        hint: 'Open /api/jev?test=1 to test Cloudflare Jev'
      });
    }

    if (!accountId || !token) {
      return res.status(503).json({
        ok: false,
        error: 'Missing Cloudflare credentials',
        accountIdConfigured: !!accountId,
        tokenConfigured: !!token
      });
    }

    try {
      const testState = {
        player: {
          type: 'tank',
          x: 100,
          y: 100
        },

        enemy: {
          type: 'tank',
          x: 100,
          y: 220
        },

        distance: 120,

        lineOfSight: true,

        shotReady: true
      };

      const testQuestions = {
        attack: {
          type: 'noul',
          instructions:
            'Should the tank attack now? Consider distance, line of sight, and whether a shot is ready.',
          criteria: {
            true: 'Attack now',
            false: 'Do not attack'
          }
        }
      };

      const result = await callJev(
        accountId,
        token,
        testState,
        testQuestions
      );

      return res.status(200).json({
        ok: result.ok,
        cloudflareStatus: result.status,
        model: 'typesafe/jev',
        jevResponse: result.data
      });
    } catch (error) {
      const isAbort = error?.name === 'AbortError';

      return res.status(isAbort ? 504 : 500).json({
        ok: false,
        error: isAbort
          ? 'Jev test request timed out'
          : 'Cloudflare test request failed',

        message: String(
          error?.message || error
        )
      });
    }
  }

  /*
   * 游戏真正使用的是 POST /api/jev
   */
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'POST only'
    });
  }

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

    const result = await callJev(
      accountId,
      token,
      state,
      QUESTIONS
    );

    if (!result.ok || result.data?.success === false) {
      return res.status(result.status || 502).json({
        error: 'Cloudflare Jev request failed',
        cloudflareStatus: result.status,
        details: result.data
      });
    }

    const jevResult =
      result.data?.result || result.data;

    res.setHeader(
      'Cache-Control',
      'no-store'
    );

    return res.status(200).json(
      jevResult
    );

  } catch (error) {
    const isAbort =
      error?.name === 'AbortError';

    return res.status(
      isAbort ? 504 : 500
    ).json({
      error: isAbort
        ? 'Jev request timed out'
        : 'Jev proxy failed',

      message: String(
        error?.message || error
      )
    });
  }
}
