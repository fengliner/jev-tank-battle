'use strict';
/* ==========================================
   KILLER AI PATCH v4
   Jev + Intercept Aim + Cutoff + Finisher
========================================== */

AI.killMode = false;
AI.lastShotAt = 0;
AI.campFor = 0;
AI.lastPlayerMoveAt = performance.now();


/*
 * 预测 t 秒之后玩家的位置
 */
function predictPlayerAt(t){

  return {

    x: clamp(
      p.x +
      AI.playerVelocity.x * t,
      20,
      W - 20
    ),

    y: clamp(
      p.y +
      AI.playerVelocity.y * t,
      20,
      H - 20
    )

  };

}


/*
 * 自适应难度
 *
 * 如果玩家比分领先，
 * AI 自动进入更强状态。
 */
function killerDifficulty(){

  const lead =
    clamp(
      playerScore - aiScore,
      0,
      4
    );

  return {

    speed:
      198 +
      lead * 8,

    cooldown:
      Math.max(
        .125,
        .18 -
        lead * .012
      ),

    bulletSpeed:
      420 +
      lead * 15,

    bulletRadius:
      6 +
      lead * .35

  };

}


/*
 * 强化 AI 子弹
 *
 * 玩家：
 * 330 速度
 *
 * AI：
 * 420～480 左右
 */
shoot = function(
  t,
  owner
){

  if(
    t.cool > 0
    ||
    over
    ||
    !DIRS[t.dir]
  ){
    return;
  }


  const d =
    DIRS[t.dir];


  const diff =
    killerDifficulty();


  const isAI =
    owner === 'a';


  const speed =
    isAI
      ? diff.bulletSpeed
      : 330;


  bullets.push({

    x:
      t.x +
      d.x * 24,

    y:
      t.y +
      d.y * 24,

    vx:
      d.x * speed,

    vy:
      d.y * speed,

    r:
      isAI
        ? diff.bulletRadius
        : 4,

    owner,

    life:
      isAI
        ? 2.5
        : 3

  });


  t.cool =
    isAI
      ? diff.cooldown
      : (
          t.shotCooldown ||
          .42
        );


  t.flash =
    .08;


  if(isAI){

    AI.lastShotAt =
      performance.now();

  }

};


/*
 * =============================
 * 移动目标拦截射击
 * =============================
 *
 * 不再瞄准玩家当前位置。
 *
 * 计算：
 *
 * 炮弹多久到达
 * ↓
 * 玩家那时在哪里
 * ↓
 * 提前向交叉点开火
 */
function killerAimSolution(){

  const bulletSpeed =
    killerDifficulty()
      .bulletSpeed;


  const dirs = [
    'UP',
    'DOWN',
    'LEFT',
    'RIGHT'
  ];


  let best =
    null;


  for(
    const dir
    of dirs
  ){

    const d =
      DIRS[dir];


    /*
     * 初始估算飞行时间
     */
    let t =
      Math.hypot(
        p.x-a.x,
        p.y-a.y
      )
      /
      bulletSpeed;


    t =
      clamp(
        t,
        .04,
        .8
      );


    let pred =
      null;


    let along =
      0;


    /*
     * 两轮迭代足够预测
     * 线性移动玩家
     */
    for(
      let i=0;
      i<2;
      i++
    ){

      pred =
        predictPlayerAt(t);


      along =

        (
          pred.x -
          a.x
        ) * d.x

        +

        (
          pred.y -
          a.y
        ) * d.y;


      /*
       * 玩家不在炮口前方
       */
      if(
        along <= 18
      ){
        break;
      }


      t =
        clamp(
          along /
          bulletSpeed,
          .03,
          .85
        );

    }


    if(
      !pred
      ||
      along <= 18
    ){
      continue;
    }


    /*
     * 玩家距离炮弹轨迹的横向误差
     */
    const lateral =
      Math.abs(

        (
          pred.x -
          a.x
        ) * d.y

        -

        (
          pred.y -
          a.y
        ) * d.x

      );


    /*
     * 玩家高速移动时
     * 略微扩大预判窗口
     */
    const tolerance =

      24

      +

      Math.min(

        5,

        Math.hypot(
          AI.playerVelocity.x,
          AI.playerVelocity.y
        ) / 80

      );


    if(
      lateral >
      tolerance
    ){
      continue;
    }


    /*
     * 炮弹实际走的是水平/垂直直线
     */
    const endX =
      a.x +
      d.x * along;


    const endY =
      a.y +
      d.y * along;


    /*
     * 墙挡住了就不能直接命中
     */
    if(
      segmentHitsWall(
        a.x,
        a.y,
        endX,
        endY
      )
    ){
      continue;
    }


    const quality =
      clamp(
        1 -
        lateral /
        tolerance,
        0,
        1
      );


    const score =

      quality * 3

      -

      t * .55;


    if(
      !best
      ||
      score >
      best.score
    ){

      best = {

        dir,

        quality,

        dist:
          along,

        time:
          t,

        pred,

        score

      };

    }

  }


  return best;

}


/*
 * 用新的拦截瞄准
 * 覆盖旧 aimSolution
 */
aimSolution =
  killerAimSolution;


/*
 * =============================
 * 截断玩家路线
 * =============================
 *
 * 原来 AI 会追玩家。
 *
 * 现在 AI 会尽量跑到：
 *
 * 玩家前方
 * 玩家横向射击线
 * 玩家纵向射击线
 */
tacticalCandidates =
function(){

  const pred =
    predictPlayer();


  const out =
    [];


  const push =
  (x,y)=>{

    x =
      clamp(
        x,
        30,
        W-30
      );


    y =
      clamp(
        y,
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

  };


  /*
   * 直接生成玩家周围的
   * 横向 / 纵向火力线
   */
  for(
    const d
    of [
      105,
      145,
      185,
      225
    ]
  ){

    push(
      pred.x+d,
      pred.y
    );


    push(
      pred.x-d,
      pred.y
    );


    push(
      pred.x,
      pred.y+d
    );


    push(
      pred.x,
      pred.y-d
    );

  }


  /*
   * 预测玩家正在往哪里跑
   */
  const vx =
    AI.playerVelocity.x;


  const vy =
    AI.playerVelocity.y;


  const speed =
    Math.hypot(
      vx,
      vy
    );


  if(
    speed > 25
  ){

    const ux =
      vx / speed;


    const uy =
      vy / speed;


    /*
     * 玩家前方约 95px
     */
    const fx =
      clamp(
        pred.x +
        ux * 95,
        30,
        W-30
      );


    const fy =
      clamp(
        pred.y +
        uy * 95,
        30,
        H-30
      );


    /*
     * 垂直方向
     */
    const px =
      -uy;


    const py =
      ux;


    /*
     * 正面截断
     */
    push(
      fx,
      fy
    );


    /*
     * 两侧封堵
     */
    push(
      fx +
      px*120,

      fy +
      py*120
    );


    push(
      fx -
      px*120,

      fy -
      py*120
    );


    push(
      fx +
      px*175,

      fy +
      py*175
    );


    push(
      fx -
      px*175,

      fy -
      py*175
    );

  }


  /*
   * 保留几个本地脱困点
   */
  push(
    a.x+90,
    a.y
  );


  push(
    a.x-90,
    a.y
  );


  push(
    a.x,
    a.y+90
  );


  push(
    a.x,
    a.y-90
  );


  /*
   * 防止候选点太多
   */
  return out.slice(
    0,
    26
  );

};


/*
 * =============================
 * 战术位置评分
 * =============================
 *
 * 极度奖励：
 *
 * 和玩家在同一横线
 * 或同一竖线
 *
 * 因为那就是射击机会。
 */
scorePoint =
function(
  pt,
  strategy,
  target
){

  const dx =
    pt.x -
    target.x;


  const dy =
    pt.y -
    target.y;


  const dist =
    Math.hypot(
      dx,
      dy
    );


  const alignError =
    Math.min(
      Math.abs(dx),
      Math.abs(dy)
    );


  const aligned =
    alignError < 24;


  const clear =
    !segmentHitsWall(
      pt.x,
      pt.y,
      target.x,
      target.y
    );


  const cover =
    coverScore(pt);


  /*
   * 玩家只剩一格血
   * 强烈鼓励击杀
   */
  const killBonus =
    p.hp <= 1
      ? 180
      : 0;


  let score =
    0;


  /*
   * 清晰射击线
   * 是最高优先级
   */
  if(
    aligned &&
    clear
  ){

    score +=
      420 +
      killBonus;

  }

  else if(
    clear
  ){

    score +=
      100;

  }

  else{

    score -=
      45;

  }


  /*
   * 最佳交战距离
   */
  score -=

    Math.abs(

      dist

      -

      (
        p.hp<=1
          ?125
          :165
      )

    )

    *
    .55;


  /*
   * 少量利用掩体
   */
  score +=

    cover

    *

    (
      strategy==='RETREAT'
        ?80
        :18
    );


  if(
    strategy==='ATTACK'
    ||
    strategy==='CHASE'
  ){

    score +=
      90;

  }


  if(
    strategy==='FLANK'
  ){

    score +=

      aligned
        ?150
        :35;

  }


  if(
    strategy==='RETREAT'
  ){

    score +=
      dist*.28;

  }


  if(
    strategy==='EVADE'
  ){

    score +=
      cover*55;

  }


  return score;

};


/*
 * =============================
 * 强制破墙
 * =============================
 *
 * 玩家躲在墙后面时
 * AI 不再傻等。
 */
suppressiveShot =
function(){

  const pred =
    predictPlayerAt(
      .18
    );


  const dx =
    pred.x -
    a.x;


  const dy =
    pred.y -
    a.y;


  /*
   * 玩家大致处在一条射击线上
   */
  if(
    Math.min(
      Math.abs(dx),
      Math.abs(dy)
    ) > 48
  ){

    return false;

  }


  const dir =

    Math.abs(dx) <
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


  a.dir =
    dir;


  shoot(
    a,
    'a'
  );


  AI.fireProbability =
    .88;


  return true;

};


/*
 * =============================
 * 最终强战斗控制器
 * =============================
 */
localCombatControl =
function(){

  /*
   * 更新玩家速度
   */
  updatePlayerVelocity();


  /*
   * 自适应难度
   */
  const diff =
    killerDifficulty();


  a.speed =
    diff.speed;


  a.shotCooldown =
    diff.cooldown;


  const dist =
    Math.hypot(
      p.x-a.x,
      p.y-a.y
    );


  const playerSpeed =
    Math.hypot(
      AI.playerVelocity.x,
      AI.playerVelocity.y
    );


  /*
   * 判断玩家是否蹲守
   */
  if(
    playerSpeed < 18
  ){

    AI.campFor +=
      .10;

  }

  else{

    AI.campFor =
      0;

  }


  /*
   * ===========================
   * KILL MODE
   * ===========================
   *
   * 以下情况主动进入击杀模式：
   *
   * 玩家只剩一格血
   *
   * AI 血量领先且距离较近
   *
   * 玩家长时间不动
   */
  AI.killMode =

    p.hp <= 1

    ||

    (
      a.hp > p.hp
      &&
      dist < 260
    )

    ||

    AI.campFor > 1.1;


  if(
    AI.killMode
    &&
    AI.danger < .78
  ){

    AI.strategy =
      'ATTACK';


    AI.reason =

      p.hp <= 1

        ?
        'FINISHER：玩家仅剩一格生命，封锁逃跑路线并持续压制。'

        :
        'KILL MODE：主动截断移动路线并抢占射击线。';


    /*
     * 终结阶段更快重规划
     */
    pathTimer =
      Math.min(
        pathTimer,
        .18
      );

  }


  /*
   * 来弹检测
   */
  const threat =
    bulletThreat();


  /*
   * 寻找拦截射击机会
   */
  const shot =
    killerAimSolution();


  /*
   * ===========================
   * 先打后躲
   * ===========================
   *
   * 如果已经获得非常好的射击窗口，
   * 即使有玩家子弹过来，
   * 也先打一炮再闪。
   */
  if(
    shot
    &&
    shot.quality > .78
    &&
    a.cool <= 0
  ){

    a.dir =
      shot.dir;


    shoot(
      a,
      'a'
    );

  }


  /*
   * ===========================
   * 高危子弹
   * ===========================
   */
  const dodge =
    chooseDodge(
      threat
    );


  if(
    dodge
    &&
    threat
    &&
    threat.t < .48
  ){

    a.move =
      dodge;


    AI.fireProbability =

      shot
        ?.65
        :.08;


    AI.reason =

      shot

        ?
        '先开火后闪避：保持攻击压力的同时规避来弹。'

        :
        '检测到近距离来弹，立即侧移规避。';


    return;

  }


  /*
   * ===========================
   * 拦截射击
   * ===========================
   */
  if(shot){

    a.dir =
      shot.dir;


    AI.fireProbability =
      clamp(

        .78 +
        shot.quality*.22,

        0,
        1

      );


    if(
      a.cool <= 0
    ){

      shoot(
        a,
        'a'
      );

    }


    /*
     * 距离太近时
     * 开枪后拉开一点
     *
     * 避免站着跟玩家互换血。
     */
    if(
      dist < 95
    ){

      const awayX =
        a.x -
        p.x;


      const awayY =
        a.y -
        p.y;


      const retreatDir =

        Math.abs(awayX) >
        Math.abs(awayY)

          ?(
              awayX>0
                ?'RIGHT'
                :'LEFT'
            )

          :(
              awayY>0
                ?'DOWN'
                :'UP'
            );


      a.move =

        clearanceScore(
          retreatDir
        ) > 0

          ? retreatDir

          : followPath();

    }

    else{

      a.move =
        followPath();

    }


    return;

  }


  /*
   * ===========================
   * 玩家躲墙后
   * ===========================
   *
   * 不再随机 22% 开火。
   *
   * 现在只要有合理破墙线，
   * 就持续拆墙。
   */
  if(
    a.cool <= 0
    &&
    (
      AI.strategy==='ATTACK'
      ||
      AI.strategy==='CHASE'
      ||
      AI.killMode
    )
  ){

    if(
      suppressiveShot()
    ){

      planPath();


      a.move =
        followPath();


      return;

    }

  }


  /*
   * FINISHER
   * 快速重新计算封锁路线
   */
  if(
    AI.killMode
  ){

    pathTimer =
      Math.min(
        pathTimer,
        .18
      );

  }


  /*
   * 常规寻路
   */
  planPath();


  a.move =
    followPath();


  AI.fireProbability =
    .12;


  /*
   * ===========================
   * 最后一层保险
   * ===========================
   *
   * 如果 BFS 暂时找不到路线，
   * 不允许 AI 傻站着。
   *
   * 直接往玩家方向压。
   */
  if(
    a.move === 'STOP'
    &&
    dist > 90
  ){

    const dx =
      p.x -
      a.x;


    const dy =
      p.y -
      a.y;


    const direct =

      Math.abs(dx) >
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
        direct
      ) > 0
    ){

      a.move =
        direct;

    }

  }

};


/* ==========================================
   END KILLER AI PATCH
========================================== */

