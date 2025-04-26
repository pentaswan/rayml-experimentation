import Game from './game.js';
import uWS from 'uWebSockets.js';
import fs from 'fs';

// idea: simple web server that lets u connect to rooms. When a room is created, creates a new python agent
// when we get input, ask the agent to predict and send it back.
// game will be mope 1v1s

let id = 0;
function generateId(){
    if(id > 2 ** 30) id = 0;
    return id++;
}

const clients = {};
const PORT = 3000;
const inputToArr = ['up','down','left','right','heavy'];

global.app = uWS.App().ws('/*', {
    compression: 0,
    maxPayloadLength: 4,//1,
    idleTimeout: 0,
    open: (ws) => {
        ws.game = new Game();

        ws.id = generateId();
        clients[ws.id] = ws;

        ws.connected = true;
    },
    message: (ws, data) => {
        const u8 = new Uint8Array(data);

        // only 1 message, and it's 1 byte long

        if(u8.byteLength !== 1) return;

        let byte = u8[0];
        const state = (byte & (1 << 6)) !== 0;
        byte = byte & (~(1 << 6));
        const input = inputToArr[byte];

        if(input !== undefined){
            ws.game.player.input[input] = state;
        }

        // const f32 = new Float32Array(data);

        // if(f32[0] < 0){
        //     ws.game.saveToFile = true;
        // } else {
        //     delay = f32[0];
        // }
    },
    close: (ws) => {
        ws.connected = false;
        delete clients[ws.id];
        delete ws.game;
    },
}).listen(PORT, (token) => {
    if (token) {
        console.log('Server Listening to Port ' + PORT);
    } else {
        console.log('Failed to Listen to Child Server ' + PORT);
    }
}, );

let lastDone = true;
// let delay = 0;
let lastUpdatePackTime = 0;
async function simulate(){
    lastDone = false;

    let promises = [];
    for(let key in clients){
        if(clients[key].connected === false) return;

        promises.push(new Promise(async (res) => {
            const g = clients[key].game;
            await g.simulate();
    
            if(clients[key] === undefined || clients[key].connected === false) {
                res();
                return;
            }
    
            let now = Date.now();
            if(now - lastUpdatePackTime > 1000 / 60){
                g.sendUpdatePack(clients[key]);
                lastUpdatePackTime = now;
            }

            res();
        }));
    }

    await Promise.all(promises);

    lastDone = true;

    // if(delay === 0){
    //     setImmediate(simulate);
    // } else {
    //     setTimeout(simulate, delay);
    // }
}

setInterval(() => {
    if(lastDone) simulate();
}, 1000 / 120)// 2x sim to update speed!

simulate();

global.send = (ws, msg) => {
    ws.send(msg, true, false);
}

// let servedIps = {};
// setInterval(() => {
//     servedIps = {};
//     fileServedIps = {};
// }, 20 * 1000)
app.get("/", (res, req) => {
    // const ip = getIp(res, req);
    // if(servedIps[ip] === undefined) servedIps[ip] = 0;
    
    // if(servedIps[ip] > 3 && isProd === true) {
    //     res.end('ratelimit. Try again in 20 seconds.');
    //     console.log('main site ratelimit from', ip);
    //     return;
    // }
    // servedIps[ip]++;
    res.end(fs.readFileSync('client/index.html'));
});

let fileServedIps = {};
app.get("/:filename/:filename2", (res, req) => {
    // const ip = getIp(res, req);
    // if(fileServedIps[ip] === undefined) fileServedIps[ip] = 0;
    // fileServedIps[ip]++;
    // if(fileServedIps[ip] > 25 && isProd === true){
    //     res.end('ratelimit. try again in 20 seconds.');
    //     console.log('file ratelimit', ip);
    //     return;
    // }

    if(req.getParameter(0) === 'server') {res.cork(()=>{res.end();});return;}
    let path = req.getParameter(0) + '/' + req.getParameter(1);
    if (fs.existsSync(path) && fs.statSync(path).isFile()) {
        const pathEnd = path.slice(path.length-3);
        if(pathEnd === 'css') res.writeHeader("Content-Type", "text/css");
        else res.writeHeader("Content-Type", "text/javascript");
        const file = fs.readFileSync(path);

        res.end(file);
    } else {
        res.cork(() => {
            res.writeStatus('404 Not Found');
            res.end();
        })
    }
});

// function getIp(res, req) {
//     // Try to get the real client IP from proxy headers
//     let forwardedIp = req.getHeader('cf-connecting-ip') ||  // Cloudflare
//         req.getHeader('x-forwarded-for') || 
//         req.getHeader('x-real-ip');
//     if (forwardedIp) {
//       return forwardedIp.split(',')[0].trim(); // Handle multiple IPs in X-Forwarded-For
//     }
  
//     // Fallback: Get the direct remote address
//     let rawIp = new TextDecoder().decode(res.getRemoteAddressAsText());
  
//     // Convert IPv6-mapped IPv4 (e.g., ::ffff:192.168.1.1) to IPv4
//     if (rawIp.startsWith('::ffff:')) {
//       return rawIp.substring(7);
//     }
  
//     return rawIp;
// }

// upgrade: (res, req, context) => {
//     let ip = getIp(res, req);

//     // if(isProd === false && (ip === '0000:0000:0000:0000:0000:0000:0000:0001' || ip === '0000:0000:0000:0000:0000:ffff:7f00:0001')) ip = undefined;

//     if(ip !== undefined){
//         if(connectedIps[ip] === true){
//             res.end("Connection rejected");
//             console.log('ws ratelimit', ip);
//             return;
//         }
//         connectedIps[ip] = true;
//     }

//     const origin = req.getHeader('origin') || req.getHeader('sec-websocket-origin');
//     if(origin && ['http://localhost:3000', 'https://chess.ytdraws.win', 'http://chess.ytdraws.win'].includes(origin) === false){
//         res.end("connection rejected");
//         console.log('connection from another domain', origin);
//         return;
//     }

//     res.upgrade(
//         { ip },  // Attach IP to the WebSocket object
//         req.getHeader('sec-websocket-key'),
//         req.getHeader('sec-websocket-protocol'),
//         req.getHeader('sec-websocket-extensions'),
//         context
//     );
// },