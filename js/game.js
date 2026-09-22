'use strict';
/* =========================
   Tank
========================= */

function makeTank(
  x,
  y,
  color,
  label
){
  return {
    x,
    y,
    r:17,
    color,
    label,
    dir:'UP',
    speed:145,
    hp:3,
    cool:0,
    move:'STOP',
    flash:0,
    shotCooldown:.42
  };
}

let p;
let a;

function addWall(
  x,
  y,
  w,
  h,
  hp=3
){
  walls.push({
    x,y,w,h,
    hp,
    max:hp
  });
}


function reset(){

  over=false;

  bullets.length=0;
  particles.length=0;
  walls.length=0;

  jevTimer=.2;
  tacticalTimer=0;
  pathTimer=0;
  uiTimer=0;
  frameErrors=0;

  p=makeTank(
    W*.5,
    H*.82,
    '#58a9ff',
    'P'
  );

  a=makeTank(
    W*.5,
    H*.18,
    '#ff646d',
    'AI'
  );

  a.dir='DOWN';

  /*
   * AI 略强于玩家
   */
  a.speed=188;
  a.shotCooldown=.24;

  p.shotCooldown=.42;

  const bw=Math.min(
    78,
    W*.09
  );

  const bh=26;

  const presets=[
    [.18,.24],
    [.36,.31],
    [.62,.31],
    [.80,.24],

    [.26,.49],
    [.50,.46],
    [.74,.49],

    [.18,.69],
    [.39,.66],
    [.61,.66],
    [.82,.69]
  ];

  for(const [rx,ry] of presets){

    const x=
      rx*W-bw/2;

    const y=
      ry*H-bh/2;

    if(
      Math.hypot(
        x-p.x,
        y-p.y
      )>90
      &&
      Math.hypot(
        x-a.x,
        y-a.y
      )>90
    ){
      addWall(
        x,
        y,
        bw,
        bh,
        Math.random()<.35
          ?5
          :3
      );
    }
  }

  Object.assign(
    AI,
    {
      strategy:'CHASE',

      strategyUntil:0,

      confidence:.72,

      reason:
        '追踪玩家并寻找射击角度。',

      target:null,

      path:[],

      pathIndex:0,

      predicted:{
        x:p.x,
        y:p.y
      },

      threat:null,

      fireProbability:.1,

      danger:0,

      lastPlayer:{
        x:p.x,
        y:p.y,
        t:performance.now()
      },

      playerVelocity:{
        x:0,
        y:0
      },

      lastPos:{
        x:a.x,
        y:a.y
      },

      stuckFor:0,

      watchdogAt:
        performance.now(),

      lastUiMove:'',

      decisionNo:0
    }
  );

  $('overlay')
    .classList
    .remove('show');

  updateHud();

  addLog(
    'INIT',
    'Jev战略 + 轻量寻路 + 实时闪避 + 预判射击'
  );
}


/* =========================
   Collision
========================= */

function rectCircle(
  w,
  t,
  nx=t.x,
  ny=t.y
){
  const cx=
    clamp(
      nx,
      w.x,
      w.x+w.w
    );

  const cy=
    clamp(
      ny,
      w.y,
      w.y+w.h
    );

  return (
    (nx-cx)**2+
    (ny-cy)**2
  ) < t.r**2;
}


function canMove(
  t,
  nx,
  ny
){
  if(
    nx<t.r+5
    ||
    nx>W-t.r-5
    ||
    ny<t.r+5
    ||
    ny>H-t.r-5
  ){
    return false;
  }

  for(const w of walls){

    if(
      rectCircle(
        w,
        t,
        nx,
        ny
      )
    ){
      return false;
    }
  }

  return true;
}


/* =========================
   Movement
========================= */

function moveTank(
  t,
  dir,
  dt
){
  if(
    dir==='STOP'
    ||
    !DIRS[dir]
  ){
    return;
  }

  const d=
    DIRS[dir];

  t.dir=dir;

  const nx=
    t.x+
    d.x*
    t.speed*
    dt;

  const ny=
    t.y+
    d.y*
    t.speed*
    dt;

  if(
    canMove(
      t,
      nx,
      ny
    )
  ){
    t.x=nx;
    t.y=ny;

    return;
  }

  if(
    canMove(
      t,
      nx,
      t.y
    )
  ){
    t.x=nx;
  }

  else if(
    canMove(
      t,
      t.x,
      ny
    )
  ){
    t.y=ny;
  }
}


/* =========================
   Shooting
========================= */

function shoot(
  t,
  owner
){
  if(
    t.cool>0
    ||
    over
    ||
    !DIRS[t.dir]
  ){
    return;
  }

  const d=
    DIRS[t.dir];

  bullets.push({
    x:t.x+d.x*24,
    y:t.y+d.y*24,

    vx:d.x*330,
    vy:d.y*330,

    r:4,

    owner,

    life:3
  });

  t.cool=
    t.shotCooldown||
    .42;

  t.flash=.08;
}


function burst(
  x,
  y,
  c,
  n=9
){
  for(
    let i=0;
    i<n;
    i++
  ){
    particles.push({
      x,
      y,

      vx:rand(-90,90),

      vy:rand(-90,90),

      life:rand(.25,.65),

      c
    });
  }
}


function hitTank(
  b,
  t
){
  return (
    (b.x-t.x)**2+
    (b.y-t.y)**2
  ) < (b.r+t.r)**2;
}


function updateBullets(
  dt
){

  for(
    let i=
      bullets.length-1;

    i>=0;

    i--
  ){
    const b=
      bullets[i];

    b.x+=b.vx*dt;
    b.y+=b.vy*dt;
    b.life-=dt;

    let gone=
      b.life<=0
      ||
      b.x<0
      ||
      b.y<0
      ||
      b.x>W
      ||
      b.y>H;

    /*
     * Bullet vs wall
     */

    for(
      let j=
        walls.length-1;

      !gone&&j>=0;

      j--
    ){
      const w=
        walls[j];

      if(
        b.x>w.x
        &&
        b.x<w.x+w.w
        &&
        b.y>w.y
        &&
        b.y<w.y+w.h
      ){
        w.hp--;

        burst(
          b.x,
          b.y,
          '#d5a566',
          5
        );

        bullets.splice(
          i,
          1
        );

        gone=true;

        if(
          w.hp<=0
        ){
          burst(
            w.x+w.w/2,
            w.y+w.h/2,
            '#c6894f',
            15
          );

          walls.splice(
            j,
            1
          );

          pathTimer=0;
        }
      }
    }

    if(gone){
      continue;
    }

    const target=
      b.owner==='p'
        ?a
        :p;

    if(
      hitTank(
        b,
        target
      )
    ){
      target.hp--;

      target.flash=.18;

      burst(
        b.x,
        b.y,

        b.owner==='p'
          ?'#77bbff'
          :'#ff8088',

        13
      );

      bullets.splice(
        i,
        1
      );

      if(
        target.hp<=0
      ){
        endRound(
          b.owner
        );
      }
    }
  }
}


/* =========================
   End
========================= */

function endRound(
  winner
){
  over=true;

  if(
    winner==='p'
  ){
    playerScore++;

    $('overTitle')
      .textContent=
      'YOU WIN';

    $('overText')
      .textContent=
      '你击毁了 AI 坦克。';
  }

  else{
    aiScore++;

    $('overTitle')
      .textContent=
      'AI WINS';

    $('overText')
      .textContent=
      'AI 完成击毁：Jev 负责战略，本地控制器负责毫秒级执行。';
  }

  $('overlay')
    .classList
    .add('show');

  updateHud();
}


function updateHud(){

  $('pScore')
    .textContent=
    playerScore;

  $('aScore')
    .textContent=
    aiScore;

  $('pHp')
    .textContent=
    '♥'.repeat(
      Math.max(
        0,
        p.hp
      )
    )
    +
    '♡'.repeat(
      Math.max(
        0,
        3-p.hp
      )
    );

  $('aHp')
    .textContent=
    '♥'.repeat(
      Math.max(
        0,
        a.hp
      )
    )
    +
    '♡'.repeat(
      Math.max(
        0,
        3-a.hp
      )
    );
}


