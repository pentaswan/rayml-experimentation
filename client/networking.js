const HOST = location.origin.replace(/^http/, 'ws');
let ws = new WebSocket(HOST);
ws.binaryType = "arraybuffer";

window.selfId = -1;

ws.addEventListener("message", function (data) {
    // const msg = new Uint8Array(data.data);

    // message: x, y, hps of both players 
    const msg = new Float32Array(data.data);
    player.x = msg[0];
    player.y = msg[1];
	player.angle = msg[2];
    player.hp = msg[3];

    enemy.x = msg[4];
    enemy.y = msg[5];
	enemy.angle = msg[6];
    enemy.hp = msg[7];

    changed = true;

    if(lastPlayerHp !== undefined){
        if(player.hp < lastPlayerHp){
            player.render.lastDamagedTime = performance.now();
			enemyScore++;
        }
        if(enemy.hp < lastEnemyHp){
            enemy.render.lastDamagedTime = performance.now();
			playerScore++;
        }
    }
    lastPlayerHp = player.hp;
    lastEnemyHp = enemy.hp;
});

let connected = false;
window.send = () => {};

ws.onopen = () => {
    connected = true;
    window.send = (data) => {
        ws.send(data);
    }
}

ws.onclose = () => {
    connected = false;
    console.error('disconnected from server!');
    // alert('disconnected from server.');
    window.send = () => {};
}

function resize(){
    canvas.width = canvas.w = window.innerWidth;
    canvas.height = canvas.h = window.innerHeight;
}

window.onresize = resize;
resize();


const memoizedColors = {};

function blendColor(color1, color2, t) {
	const memoizedIndex = color1 + '_' + color2 + '_' + t;
	if (memoizedColors[memoizedIndex] !== undefined) {
		return memoizedColors[memoizedIndex];
	}
	const rgb1 = {
		r: parseInt(color1.slice(1, 3), 16),
		g: parseInt(color1.slice(3, 5), 16),
		b: parseInt(color1.slice(5, 7), 16)
	}
	const rgb2 = {
		r: parseInt(color2.slice(1, 3), 16),
		g: parseInt(color2.slice(3, 5), 16),
		b: parseInt(color2.slice(5, 7), 16)
	}

	const result = rgbToHex(Math.floor(rgb1.r * (1 - t) + rgb2.r * t), Math.floor(rgb1.g * (1 - t) + rgb2.g * t), Math.floor(rgb1.b * (1 - t) + rgb2.b * t))
	memoizedColors[memoizedIndex] = result;
	return result;
}

function rgbToHex(r, g, b) {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function componentToHex(c) {
	var hex = c.toString(16);
	return hex.length == 1 ? "0" + hex : hex;
}

render();