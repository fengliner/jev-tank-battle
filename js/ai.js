'use strict';
/* =========================
   Line of sight
========================= */

function segmentHitsWall(
  x1,
  y1,
  x2,
  y2
){
  /*
   * 限制最大检测次数
   * 防止超长射线造成手机性能尖峰
   */
  const steps=
    Math.min(
      80,
      Math.ceil(
        Math.hypot(
          x2-x1,
          y2-y1
        )/14
      )
    );

  for(
    let i=1;
    i<steps;
    i++
  ){
    const x=
      x1+
      (x2-x1)*
      i/steps;

    const y=
      y1+
      (y2-y1)*
      i/steps;

    for(const w of walls){

      if(
        x>w.x
        &&
        x<w.x+w.w
        &&
        y>w.y
        &&
        y<w.y+w.h
      ){
        return true;
      }
    }
  }

  return false;
}


function los(
  from,
  to
){
  return !segmentHitsWall(
    from.x,
    from.y,
    to.x,
    to.y
  );
}


/* =========================
   Player prediction
========================= */

function updatePlayerVelocity(){

  const now=
    performance.now();

  const dt=
    Math.max(
      .04,
      (
        now-
        AI.lastPlayer.t
      )/1000
    );

  const vx=
    (
      p.x-
      AI.lastPlayer.x
    )/dt;

  const vy=
    (
      p.y-
      AI.lastPlayer.y
    )/dt;

  AI.playerVelocity.x=
    AI.playerVelocity.x*
    .72+
    vx*.28;

  AI.playerVelocity.y=
    AI.playerVelocity.y*
    .72+
    vy*.28;

  AI.lastPlayer={
    x:p.x,
    y:p.y,
    t:now
  };
}


function predictPlayer(){

  const dist=
    Math.hypot(
      p.x-a.x,
      p.y-a.y
    );

  const lead=
    clamp(
      dist/330,
      .08,
      .65
    );

  AI.predicted={
    x:clamp(
      p.x+
      AI.playerVelocity.x*
      lead,

      20,
      W-20
    ),

    y:clamp(
      p.y+
      AI.playerVelocity.y*
      lead,

      20,
      H-20
    )
  };

  return AI.predicted;
}


/* =========================
   Bullet threat
========================= */

function bulletThreat(){

  let best=null;

  for(const b of bullets){

    if(
      b.owner!=='p'
    ){
      continue;
    }

    const speed2=
      b.vx*b.vx+
      b.vy*b.vy;

    if(
      speed2<1
    ){
      continue;
    }

    const rx=
      a.x-b.x;

    const ry=
      a.y-b.y;

    let t=
      (
        rx*b.vx+
        ry*b.vy
      )/speed2;

    if(
      t<0
      ||
      t>.85
    ){
      continue;
    }

    const cx=
      b.x+
      b.vx*t;

    const cy=
      b.y+
      b.vy*t;

    const miss=
      Math.hypot(
        a.x-cx,
        a.y-cy
      );

    if(
      miss<
      a.r+17
    ){
      const score=
        (.85-t)*2
        +
        (
          a.r+
          17-
          miss
        )/30;

      if(
        !best
        ||
        score>
        best.score
      ){
        best={
          b,
          t,
          miss,
          score
        };
      }
    }
  }

  AI.threat=best;

  AI.danger=
    best
      ?clamp(
          1-
          best.t/.85,
          0,
          1
        )
      :0;

  return best;
}


function clearanceScore(
  dir
){
  if(
    !DIRS[dir]
  ){
    return 0;
  }

  const d=
    DIRS[dir];

  let score=0;

  for(
    const step
    of [
      26,
      50,
      74,
      98
    ]
  ){
    if(
      canMove(
        a,
        a.x+
        d.x*step,
        a.y+
        d.y*step
      )
    ){
      score++;
    }

    else{
      break;
    }
  }

  return score;
}


/* =========================
   Dodge
========================= */

function chooseDodge(
  threat
){
  if(
    !threat
  ){
    return null;
  }

  const b=
    threat.b;

  const candidates=
    Math.abs(b.vx)>
    Math.abs(b.vy)

      ?[
          'UP',
          'DOWN'
        ]

      :[
          'LEFT',
          'RIGHT'
        ];

  let best=null;
  let bestScore=-1e9;

  for(
    const dir
    of candidates
  ){
    if(
      clearanceScore(dir)<2
    ){
      continue;
    }

    const d=
      DIRS[dir];

    const fx=
      a.x+
      d.x*62;

    const fy=
      a.y+
      d.y*62;

    const bt=
      clamp(
        threat.t,
        0,
        .6
      );

    const bx=
      b.x+
      b.vx*bt;

    const by=
      b.y+
      b.vy*bt;

    const score=
      Math.hypot(
        fx-bx,
        fy-by
      )
      +
      clearanceScore(dir)*
      38;

    if(
      score>
      bestScore
    ){
      bestScore=score;
      best=dir;
    }
  }

  return best;
}


/* =========================
   Lightweight BFS
========================= */

function bfsPath(
  sx,
  sy,
  tx,
  ty
){
  /*
   * 原版本用 A* + open.sort
   * iPhone 长时间运行会产生性能尖峰。
   *
   * 这里改为有限 BFS。
   */

  const cell=40;

  const maxC=
    Math.floor(
      W/cell
    );

  const maxR=
    Math.floor(
      H/cell
    );

  const toGrid=
    (x,y)=>({
      c:clamp(
        Math.round(x/cell),
        1,
        maxC-1
      ),

      r:clamp(
        Math.round(y/cell),
        1,
        maxR-1
      )
    });

  const toPos=
    (c,r)=>({
      x:c*cell,
      y:r*cell
    });

  const key=
    (c,r)=>
      c+','+r;

  const s=
    toGrid(
      sx,
      sy
    );

  const rawG=
    toGrid(
      tx,
      ty
    );

  let g=
    rawG;

  /*
   * 如果目标格正好落在墙上，
   * 找附近最近可走格。
   */

  if(
    !canMove(
      a,
      g.c*cell,
      g.r*cell
    )
  ){
    let found=null;

    for(
      let radius=1;
      radius<=3&&!found;
      radius++
    ){
      for(
        let dc=-radius;
        dc<=radius&&!found;
        dc++
      ){
        for(
          let dr=-radius;
          dr<=radius;
          dr++
        ){
          const c=
            rawG.c+dc;

          const r=
            rawG.r+dr;

          if(
            c<1
            ||
            r<1
            ||
            c>=maxC
            ||
            r>=maxR
          ){
            continue;
          }

          if(
            canMove(
              a,
              c*cell,
              r*cell
            )
          ){
            found={
              c,
              r
            };

            break;
          }
        }
      }
    }

    if(found){
      g=found;
    }
  }

  const q=[s];

  const came=
    new Map();

  const seen=
    new Set([
      key(
        s.c,
        s.r
      )
    ]);

  let qi=0;

  let expanded=0;

  let found=null;

  /*
   * 最多探索 500 格，
   * 防止任何极端地图拖死主线程。
   */

  while(
    qi<q.length
    &&
    expanded++<500
  ){
    const cur=
      q[qi++];

    if(
      cur.c===g.c
      &&
      cur.r===g.r
    ){
      found=cur;
      break;
    }

    for(
      const [dc,dr]
      of [
        [1,0],
        [-1,0],
        [0,1],
        [0,-1]
      ]
    ){
      const c=
        cur.c+dc;

      const r=
        cur.r+dr;

      const k=
        key(
          c,
          r
        );

      if(
        c<1
        ||
        r<1
        ||
        c>=maxC
        ||
        r>=maxR
        ||
        seen.has(k)
        ||
        !canMove(
          a,
          c*cell,
          r*cell
        )
      ){
        continue;
      }

      seen.add(k);

      came.set(
        k,
        cur
      );

      q.push({
        c,
        r
      });
    }
  }

  if(
    !found
  ){
    return [];
  }

  const out=[];

  let cur=
    found;

  while(cur){

    out.push(
      toPos(
        cur.c,
        cur.r
      )
    );

    const prev=
      came.get(
        key(
          cur.c,
          cur.r
        )
      );

    cur=
      prev||null;
  }

  out.reverse();

  return out;
}


/* =========================
   Tactical position
========================= */

function tacticalCandidates(){

  const pred=
    predictPlayer();

  const out=[];

  /*
   * 只生成关键战术点。
   * 不再扫描全地图。
   */

  const rings=[
    120,
    180,
    240
  ];

  const angles=[
    0,
    Math.PI/2,
    Math.PI,
    Math.PI*1.5,

    Math.PI/4,
    Math.PI*3/4,
    Math.PI*5/4,
    Math.PI*7/4
  ];

  for(
    const r
    of rings
  ){
    for(
      const ang
      of angles
    ){
      const x=
        clamp(
          pred.x+
          Math.cos(ang)*r,

          30,
          W-30
        );

      const y=
        clamp(
          pred.y+
          Math.sin(ang)*r,

          30,
          H-30
        );

      if(
        canMove(
          a,
          x,
          y
        )
      ){
        out.push({
          x,
          y
        });
      }
    }
  }

  out.push({
    x:clamp(
      a.x,
      30,
      W-30
    ),

    y:clamp(
      a.y,
      30,
      H-30
    )
  });

  return out;
}


function coverScore(
  pt
){
  let score=0;

  for(
    const w
    of walls
  ){
    const cx=
      clamp(
        pt.x,
        w.x,
        w.x+w.w
      );

    const cy=
      clamp(
        pt.y,
        w.y,
        w.y+w.h
      );

    const d=
      Math.hypot(
        pt.x-cx,
        pt.y-cy
      );

    if(
      d<85
    ){
      score+=
        (85-d)/85;
    }
  }

  return score;
}


function scorePoint(
  pt,
  strategy,
  target
){
  const d=
    Math.hypot(
      pt.x-target.x,
      pt.y-target.y
    );

  const clear=
    !segmentHitsWall(
      pt.x,
      pt.y,
      target.x,
      target.y
    );

  const align=
    Math.max(
      0,

      1-
      Math.min(
        Math.abs(
          pt.x-target.x
        ),

        Math.abs(
          pt.y-target.y
        )
      )/75
    );

  const cover=
    coverScore(pt);

  let score=0;

  if(
    strategy==='ATTACK'
  ){
    score+=
      (
        clear
          ?270
          :-120
      )
      +
      align*290
      -
      Math.abs(
        d-175
      )*.55
      +
      cover*25;
  }

  else if(
    strategy==='FLANK'
  ){
    score+=
      (
        clear
          ?190
          :-35
      )
      +
      align*230
      -
      Math.abs(
        d-220
      )*.35
      +
      cover*50;
  }

  else if(
    strategy==='RETREAT'
  ){
    score+=
      d*.58
      +
      (
        clear
          ?-20
          :90
      )
      +
      cover*75;
  }

  else if(
    strategy==='EVADE'
  ){
    score+=
      d*.18
      +
      cover*95
      +
      (
        clear
          ?-10
          :30
      );
  }

  else{
    score+=
      (
        clear
          ?135
          :0
      )
      +
      align*155
      -
      Math.abs(
        d-160
      )*.42;
  }

  return score;
}


function chooseTacticalTarget(){

  const target=
    predictPlayer();

  let best={
    x:a.x,
    y:a.y
  };

  let bestScore=
    -1e9;

  for(
    const pt
    of tacticalCandidates()
  ){
    const score=
      scorePoint(
        pt,
        AI.strategy,
        target
      );

    if(
      score>
      bestScore
    ){
      bestScore=score;
      best=pt;
    }
  }

  return best;
}


function planPath(
  force=false
){
  if(
    !force
    &&
    pathTimer>0
  ){
    return;
  }

  /*
   * 最多约 0.75 秒重新规划一次。
   */

  pathTimer=.75;

  AI.target=
    chooseTacticalTarget();

  AI.path=
    bfsPath(
      a.x,
      a.y,
      AI.target.x,
      AI.target.y
    );

  AI.pathIndex=
    Math.min(
      1,
      Math.max(
        0,
        AI.path.length-1
      )
    );
}


function followPath(){

  if(
    !AI.path.length
  ){
    return 'STOP';
  }

  while(
    AI.pathIndex<
    AI.path.length
    &&
    Math.hypot(
      AI.path[
        AI.pathIndex
      ].x-a.x,

      AI.path[
        AI.pathIndex
      ].y-a.y
    )<20
  ){
    AI.pathIndex++;
  }

  if(
    AI.pathIndex>=
    AI.path.length
  ){
    return 'STOP';
  }

  const node=
    AI.path[
      AI.pathIndex
    ];

  const dx=
    node.x-a.x;

  const dy=
    node.y-a.y;

  const primary=
    Math.abs(dx)>
    Math.abs(dy)

      ?(
        dx>0
          ?'RIGHT'
          :'LEFT'
      )

      :(
        dy>0
          ?'DOWN'
          :'UP'
      );

  if(
    clearanceScore(
      primary
    )>0
  ){
    return primary;
  }

  const alt=
    Math.abs(dx)>
    Math.abs(dy)

      ?(
        dy>0
          ?'DOWN'
          :'UP'
      )

      :(
        dx>0
          ?'RIGHT'
          :'LEFT'
      );

  return
    clearanceScore(alt)>0
      ?alt
      :'STOP';
}


/* =========================
   Aim prediction
========================= */

function aimSolution(){

  const pred=
    predictPlayer();

  const dx=
    pred.x-a.x;

  const dy=
    pred.y-a.y;

  const ax=
    Math.abs(dx);

  const ay=
    Math.abs(dy);

  let dir=null;

  let quality=0;

  /*
   * 纵向火线
   */

  if(
    ax<52
  ){
    dir=
      dy>0
        ?'DOWN'
        :'UP';

    quality=
      1-ax/52;
  }

  /*
   * 横向火线
   */

  if(
    ay<52
  ){
    const q=
      1-ay/52;

    if(
      q>quality
    ){
      dir=
        dx>0
          ?'RIGHT'
          :'LEFT';

      quality=q;
    }
  }

  if(
    !dir
    ||
    !los(
      a,
      pred
    )
  ){
    return null;
  }

  return {
    dir,
    quality,

    dist:
      Math.hypot(
        dx,
        dy
      )
  };
}


/*
 * 如果玩家大致在同一条线，
 * 即使中间有可破坏墙，也主动开火破墙。
 */

function suppressiveShot(){

  const dx=
    p.x-a.x;

  const dy=
    p.y-a.y;

  if(
    Math.min(
      Math.abs(dx),
      Math.abs(dy)
    )>40
  ){
    return false;
  }

  const dir=
    Math.abs(dx)<
    Math.abs(dy)

      ?(
        dy>0
          ?'DOWN'
          :'UP'
      )

      :(
        dx>0
          ?'RIGHT'
          :'LEFT'
      );

  if(
    !DIRS[dir]
  ){
    return false;
  }

  a.dir=dir;

  shoot(
    a,
    'a'
  );

  return true;
}


/* =========================
   Real-time combat AI
========================= */

function localCombatControl(){

  updatePlayerVelocity();

  /*
   * 第一优先级：躲玩家子弹
   */

  const threat=
    bulletThreat();

  const dodge=
    chooseDodge(
      threat
    );

  if(dodge){

    a.move=dodge;

    AI.fireProbability=.04;

    AI.reason=
      '检测到危险弹道，立即闪避。';

    return;
  }

  /*
   * 第二优先级：
   * 一旦出现射击窗口立即开火
   */

  const shot=
    aimSolution();

  if(shot){

    a.dir=
      shot.dir;

    AI.fireProbability=
      clamp(
        .70+
        shot.quality*.29,
        0,
        1
      );

    if(
      a.cool<=0
    ){
      shoot(
        a,
        'a'
      );
    }

    a.move=
      (
        shot.dist<120
        &&
        AI.strategy!==
        'RETREAT'
      )

        ?'STOP'

        :followPath();

    return;
  }

  /*
   * 玩家躲在墙后，
   * ATTACK / CHASE 时尝试破墙压制。
   */

  if(
    (
      AI.strategy==='ATTACK'
      ||
      AI.strategy==='CHASE'
    )
    &&
    a.cool<=0
    &&
    Math.random()<.22
  ){
    suppressiveShot();
  }

  /*
   * 第三优先级：
   * 前往战术位置
   */

  planPath();

  a.move=
    followPath();

  AI.fireProbability=.08;
}


/* =========================
   Anti-stuck watchdog
========================= */

function watchdog(){

  const now=
    performance.now();

  if(
    now-
    AI.watchdogAt<
    550
  ){
    return;
  }

  AI.watchdogAt=
    now;

  const moved=
    Math.hypot(
      a.x-
      AI.lastPos.x,

      a.y-
      AI.lastPos.y
    );

  if(
    a.move!=='STOP'
    &&
    moved<5
  ){
    AI.stuckFor+=.55;
  }

  else{
    AI.stuckFor=0;
  }

  AI.lastPos={
    x:a.x,
    y:a.y
  };

  /*
   * 连续约 0.9 秒没有实际移动，
   * 强制清空路线并脱困。
   */

  if(
    AI.stuckFor>.9
  ){
    AI.path=[];
    AI.pathIndex=0;
    pathTimer=0;

    const dirs=[
      'UP',
      'DOWN',
      'LEFT',
      'RIGHT'
    ]
    .map(
      d=>({
        d,
        s:clearanceScore(d)
      })
    )
    .sort(
      (x,y)=>
        y.s-x.s
    );

    if(
      dirs[0]
      &&
      dirs[0].s>0
    ){
      a.move=
        dirs[0].d;
    }

    AI.stuckFor=0;

    AI.reason=
      '自动脱困：重新规划路线。';
  }
}


