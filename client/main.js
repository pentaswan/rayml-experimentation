const canvas = document.getElementById("canvas");
const ctx = canvas.getContext('2d');

let lastPlayerHp, lastEnemyHp;

const mouse = {
    x: 0, y: 0,
    world: {
        x: 0, y: 0
    }
}

const player = {
    x: -220,
    y: 0,
    r: 120 / scaleFac,
    angle: 0,
}

player.render = {
    x: player.x,
    y: player.y, 
    angle: player.angle,
    lastDamagedTime: -1000
}

let loaded = false;
const dragImage = new Image();
dragImage.src = 'client/dragon.webp';
dragImage.onload = () => {
    loaded = true;
}

const enemy = structuredClone(player);
enemy.x = -player.x;
enemy.angle = Math.PI;

let playerScore, enemyScore;
playerScore = enemyScore = 0;

let time, lastTime, dt;
time = lastTime = performance.now();
dt = 0;
function render() {
    requestAnimationFrame(render);

    time = performance.now();
    dt = (time - lastTime) / 16.66;
    lastTime = time;

    let p = player;
    p.render.x = interpolate(p.render.x, p.x, 0.4);
    p.render.y = interpolate(p.render.y, p.y, 0.4);
    p.render.angle = interpolateDirection(p.render.angle, p.angle, 0.44);
    p = enemy;
    p.render.x = interpolate(p.render.x, p.x, 0.4);
    p.render.y = interpolate(p.render.y, p.y, 0.4);
    p.render.angle = interpolateDirection(p.render.angle, p.angle, 0.44);

    ctx.fillStyle = 'black';
    ctx.fillRect(0,0,canvas.w,canvas.h);

    ctx.beginPath();

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 7;

    ctx.translate(canvas.w/2 - player.render.x, canvas.h/2 - player.render.y);

    ctx.beginPath();
    ctx.arc(0,0,arenaRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.closePath();

    ctx.fillStyle = 'white';
    ctx.font = '84px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${playerScore} - ${enemyScore}`, 0, 0);

    ctx.font = '24px Inter';
    ctx.fillText(`Bite the other dragon's tail`, 0, -62);
    ctx.fillText(`while protecting your own!`, 0, 62);
    

    ctx.globalAlpha = 0.4;

    // Green / red circles

    // player's

    let t = Math.min(1, (time - player.render.lastDamagedTime) / 266);
    ctx.fillStyle = blendColor('#FF0000', '#00FF00', t);

    ctx.beginPath();
    ctx.arc(player.render.x, player.render.y, player.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();

    // enemy's

    t = Math.min(1, (time - enemy.render.lastDamagedTime) / 266);
    ctx.fillStyle = blendColor('#FF0000', '#00FF00', t);

    ctx.beginPath();
    ctx.arc(enemy.render.x, enemy.render.y, enemy.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
    ctx.globalAlpha = 1;
    
    ctx.fillStyle = 'black';
    if(loaded === true){
        ctx.globalCompositeOperation = 'difference';//'xor'//'color-burn'
        let a = ctx.getTransform();
        ctx.translate(player.render.x, player.render.y);
        ctx.rotate(player.render.angle-Math.PI/2);
        ctx.scale(scaleFac, scaleFac);
        ctx.drawImage(dragImage, -player.r, -player.r, player.r*2, player.r*2);
        ctx.setTransform(a);

        ctx.translate(enemy.render.x, enemy.render.y);
        ctx.rotate(enemy.render.angle-Math.PI/2);
        ctx.scale(scaleFac, scaleFac);
        ctx.drawImage(dragImage, -enemy.r, -enemy.r, enemy.r*2, enemy.r*2);
        ctx.setTransform(a);
        ctx.globalCompositeOperation = 'source-over'
    }

    ctx.translate(-(canvas.w/2 - player.render.x), -(canvas.h/2 - player.render.y));
}

window.onmousemove = (e) => {
    const d = canvas.getBoundingClientRect();
    mouse.x = ((e.pageX - d.x) / d.width) * canvas.width;
    mouse.y = ((e.pageY - d.y) / d.height) * canvas.height;

    mouse.x += player.x - canvas.w/2;
    mouse.y += player.y - canvas.h/2;

    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    let magnitude = Math.sqrt((mouse.y - player.y) ** 2 + (mouse.x - player.x) ** 2) / Math.min(canvas.w, canvas.h);

    magnitude *= 4;
    magnitude = Math.min(magnitude, 1);

    // set angle
    const f32 = new Float32Array(2);
    f32[0] = angle;
    f32[1] = magnitude;
    send(f32);
}

// angular velocity up to a max

let toBoost = false;
window.onmousedown = (e) => {
    if(toBoost === true) return;
    toBoost = true;
    const buf = new Uint8Array(1);
    buf[0] = 1;// boost = true
    send(buf);
}

window.onmouseup = (e) => {
    if(toBoost === false) return;
    toBoost = false;
    const buf = new Uint8Array(1);
    buf[0] = 2;// boost = false
    send(buf);
}