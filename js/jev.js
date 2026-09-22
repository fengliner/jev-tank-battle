'use strict';
/* =========================
   Jev state
========================= */

function buildJevState(){

  const dx=
    p.x-a.x;

  const dy=
    p.y-a.y;

  const threat=
    bulletThreat();

  return {
    arena:{
      width:
        Math.round(W),

      height:
        Math.round(H)
    },

    ai:{
      x:
        Math.round(a.x),

      y:
        Math.round(a.y),

      direction:
        a.dir,

      hp:
        a.hp,

      shotReady:
        a.cool<=0
    },

    player:{
      x:
        Math.round(p.x),

      y:
        Math.round(p.y),

      direction:
        p.dir,

      hp:
        p.hp,

      velocityX:
        Math.round(
          AI.playerVelocity.x
        ),

      velocityY:
        Math.round(
          AI.playerVelocity.y
        )
    },

    geometry:{
      dx:
        Math.round(dx),

      dy:
        Math.round(dy),

      distance:
        Math.round(
          Math.hypot(
            dx,
            dy
          )
        ),

      lineOfSight:
        los(a,p),

      alignedX:
        Math.abs(dx)<52,

      alignedY:
        Math.abs(dy)<52
    },

    danger:{
      incomingBullet:
        !!threat,

      timeToClosestApproach:
        threat
          ?Number(
              threat.t.toFixed(2)
            )
          :null,

      dangerScore:
        Number(
          AI.danger.toFixed(2)
        )
    },

    currentStrategy:
      AI.strategy,

    walls:
      walls
      .slice(0,14)
      .map(
        w=>({
          x:
            Math.round(w.x),

          y:
            Math.round(w.y),

          w:
            Math.round(w.w),

          h:
            Math.round(w.h),

          hp:
            w.hp
        })
      )
  };
}


/* =========================
   Jev response
========================= */

function mapJevResponse(
  raw
){
  const root=
    raw&&raw.result
      ?raw.result
      :raw;

  const ans=
    root&&
    root.answers;

  if(
    !ans
    ||
    !ans.strategy
  ){
    throw new Error(
      'Invalid Jev response'
    );
  }

  return {
    strategy:
      ans.strategy.choice
      ||
      'CHASE',

    confidence:
      Number(
        ans.strategy.confidence
        ||
        .5
      ),

    model:
      root.model
      ||
      'typesafe/jev'
  };
}


/* =========================
   Jev strategic brain
========================= */

async function decideStrategy(){

  if(
    jevInFlight
    ||
    Date.now()<
    jevRetryAt
  ){
    return;
  }

  const now=
    performance.now();

  /*
   * 保持战略，避免高频抖动。
   */

  if(
    now<
    AI.strategyUntil
    &&
    AI.danger<.78
  ){
    return;
  }

  jevInFlight=true;

  try{

    const res=
      await fetch(
        '/api/jev',
        {
          method:'POST',

          headers:{
            'content-type':
              'application/json'
          },

          body:
            JSON.stringify({
              state:
                buildJevState()
            })
        }
      );

    if(
      !res.ok
    ){
      throw new Error(
        'Jev API '+
        res.status
      );
    }

    const d=
      mapJevResponse(
        await res.json()
      );

    AI.strategy=
      d.strategy;

    AI.confidence=
      d.confidence;

    AI.strategyUntil=
      performance.now()
      +
      2800;

    AI.decisionNo++;

    AI.reason={
      ATTACK:
        'Jev 选择压制攻击，本地 AI 抢占射击线。',

      CHASE:
        'Jev 选择追击，本地 AI 持续逼近。',

      EVADE:
        'Jev 选择规避，本地 AI 优先躲弹。',

      FLANK:
        'Jev 选择绕侧翼，本地 AI 寻找侧向火线。',

      RETREAT:
        'Jev 选择拉开距离并保持反击。'
    }[
      AI.strategy
    ]
    ||
    'Jev 已更新战术。';

    pathTimer=0;

    jevFailures=0;

    jevRetryAt=0;

    $('modelStatus')
      .textContent=
      (
        d.model
        ||
        'typesafe/jev'
      )
      .toUpperCase()
      +
      ' · LIVE';

    $('engineChip')
      .textContent=
      'JEV + TACTICAL AI';

    addLog(
      'JEV',
      AI.strategy+
      ' · '+
      Math.round(
        AI.confidence*100
      )
      +
      '%'
    );
  }

  catch(err){

    jevFailures++;

    /*
     * Jev 暂时失败时，
     * 本地战斗 AI 仍继续运行。
     */

    AI.strategy=
      AI.danger>.55
        ?'EVADE'
        :'CHASE';

    AI.strategyUntil=
      performance.now()
      +
      1500;

    if(
      String(err)
      .includes('503')
    ){
      jevRetryAt=
        Date.now()
        +
        30000;
    }

    $('modelStatus')
      .textContent=
      'LOCAL FALLBACK · '
      +
      (
        jevFailures>1
          ?'API UNAVAILABLE'
          :'RETRYING'
      );

    $('engineChip')
      .textContent=
      'TACTICAL FALLBACK';
  }

  finally{
    jevInFlight=false;
  }
}


