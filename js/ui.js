'use strict';
/* =========================
   UI
========================= */

function updateDecisionUI(){

  $('strategy')
    .textContent=
    AI.strategy;

  $('strategyConf')
    .style.width=
    Math.round(
      AI.confidence*100
    )
    +
    '%';

  $('reason')
    .textContent=
    AI.reason;

  $('movement')
    .textContent=
    a.move;

  $('fire')
    .textContent=
    Math.round(
      AI.fireProbability*100
    )
    +
    '%';

  $('fireBar')
    .style.width=
    Math.round(
      AI.fireProbability*100
    )
    +
    '%';

  $('danger')
    .textContent=
    Math.round(
      AI.danger*100
    )
    +
    '%';

  $('dangerBar')
    .style.width=
    Math.round(
      AI.danger*100
    )
    +
    '%';

  $('decisionCount')
    .textContent=
    '#'+
    AI.decisionNo;

  /*
   * 只有方向变化时才重建 DOM。
   */

  if(
    AI.lastUiMove!==
    a.move
  ){
    AI.lastUiMove=
      a.move;

    const probs={
      UP:.04,
      DOWN:.04,
      LEFT:.04,
      RIGHT:.04,
      STOP:.04
    };

    probs[a.move]=.84;

    $('moveProbs')
      .innerHTML=
      names
      .map(
        n=>
        `<div class="prob">
          <span>${n}</span>
          <div class="bar">
            <div
              class="fill"
              style="width:${Math.round(probs[n]*100)}%"
            ></div>
          </div>
          <b>${Math.round(probs[n]*100)}%</b>
        </div>`
      )
      .join('');
  }
}


function addLog(
  tag,
  msg
){
  const el=
    document.createElement(
      'div'
    );

  el.className=
    'log';

  el.innerHTML=
    `<b>${tag}</b>
     <span>${msg}</span>`;

  $('decisionLog')
    .prepend(el);

  while(
    $('decisionLog')
    .children
    .length>7
  ){
    $('decisionLog')
      .lastChild
      .remove();
  }
}


/* =========================
   Player input
========================= */

function playerInput(){

  if(
    keys.has('ArrowUp')
    ||
    keys.has('KeyW')
  ){
    return 'UP';
  }

  if(
    keys.has('ArrowDown')
    ||
    keys.has('KeyS')
  ){
    return 'DOWN';
  }

  if(
    keys.has('ArrowLeft')
    ||
    keys.has('KeyA')
  ){
    return 'LEFT';
  }

  if(
    keys.has('ArrowRight')
    ||
    keys.has('KeyD')
  ){
    return 'RIGHT';
  }

  return 'STOP';
}


window.addEventListener(
  'keydown',
  e=>{
    if(
      [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Space'
      ]
      .includes(
        e.code
      )
    ){
      e.preventDefault();
    }

    keys.add(
      e.code
    );

    if(
      e.code==='Space'
    ){
      shoot(
        p,
        'p'
      );
    }

    if(
      e.code==='KeyR'
    ){
      reset();
    }
  },
  {
    passive:false
  }
);


window.addEventListener(
  'keyup',
  e=>
    keys.delete(
      e.code
    )
);


/*
 * 防止 Safari 切后台后
 * 某个按键永远停留在按下状态。
 */

window.addEventListener(
  'blur',
  ()=>{
    keys.clear();
  }
);


document.addEventListener(
  'visibilitychange',
  ()=>{
    if(
      document.hidden
    ){
      keys.clear();
    }
  }
);


/*
 * Mobile controls
 */

document
.querySelectorAll(
  '[data-k]'
)
.forEach(
  btn=>{

    const code=
      btn.dataset.k;

    const down=
      e=>{

        e.preventDefault();

        try{
          if(
            btn.setPointerCapture
          ){
            btn.setPointerCapture(
              e.pointerId
            );
          }
        }
        catch{}

        keys.add(
          code
        );

        if(
          code==='Space'
        ){
          shoot(
            p,
            'p'
          );
        }
      };

    const up=
      e=>{
        e.preventDefault();

        keys.delete(
          code
        );
      };

    btn.addEventListener(
      'pointerdown',
      down
    );

    btn.addEventListener(
      'pointerup',
      up
    );

    btn.addEventListener(
      'pointercancel',
      up
    );

    btn.addEventListener(
      'lostpointercapture',
      up
    );
  }
);


$('restart')
  .onclick=
  reset;

$('newRound')
  .onclick=
  reset;


