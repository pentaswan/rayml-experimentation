const HOST = location.origin.replace(/^http/, 'ws');
let ws = new WebSocket(HOST);
ws.binaryType = "arraybuffer";

ws.addEventListener("message", function (data) {
    const msg = new Float32Array(data.data);

    if(msg.byteLength === 4){
        const u16 = new Uint16Array(msg.buffer);

        playerScore = u16[0];
        enemyScore = u16[1];
        return;
    }

    player.x = msg[0];
    player.y = msg[1];
    player.heavy = msg[2] ? true : false;

    enemy.x = msg[3];
    enemy.y = msg[4];
    enemy.heavy = msg[5] ? true : false;
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
    alert('disconnected from server.');
    window.send = () => {};
}