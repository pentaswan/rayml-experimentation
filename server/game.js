import { Request } from "zeromq";
import SAT from 'sat';

let connected = false;
const socket = new Request();

const w = 1600;
const h = 900;

const pw = w * 1/3;
const py = h * 3/5;
const platform = [
    {
        x: w / 2 - pw/2,
        y: py
    },
    {
        x: w / 2 + pw/2,
        y: py
    },
]

const minY = 300;
const maxY = 520;

const minX = 0;
const maxX = w;

const maxV = 10;
const res = new SAT.Response();

const platformSAT = new SAT.Polygon(new SAT.Vector(), [
    new SAT.Vector(platform[0].x, platform[0].y),
    new SAT.Vector(platform[1].x, platform[1].y),
])

function clamp(t, min, max){
    return Math.max(min, Math.min(max, t));
}

function between(t, min, max){
    return clamp((t - min) / (max - min), 0, 1);
    // (this.player.y - minY) / (maxY - minY)
}

class Game {
    constructor(){
        this.reset();

        this.reward = 0;

        this.updatePack = new Float32Array(8);
        this.scoreBuf = new Uint16Array(2);
        this.changedScore = false;
        this.episodeEnded = false;

        this.enemyScore = this.playerScore = 0;
    }

    reset(){
        let lastInputs;
        if(this.player !== undefined){
            lastInputs = this.player.input;
        }
        this.player = {
            x: w * 1/3 + 56, y: h * 1/2, r: 35, jumpCooldown: 0, maxJumpCooldown: 5,
            xv: 0, yv: 0, heavy: false, mass: 1, canJump: false,
            input: {
                up: false,
                down: false,
                left: false,
                right: false,
                heavy: false
            }
        }
        
        this.enemy = structuredClone(this.player);
    
        this.enemy.x = w - this.player.x;

        if(lastInputs !== undefined){
            this.player.input = structuredClone(lastInputs);
        }
    }

    sendUpdatePack(ws){
        this.updatePack[0] = this.player.x;
        this.updatePack[1] = this.player.y;
        this.updatePack[2] = this.player.heavy;

        this.updatePack[3] = this.enemy.x;
        this.updatePack[4] = this.enemy.y;
        this.updatePack[5] = this.enemy.heavy;

        send(ws, this.updatePack);

        if(this.changedScore){
            this.scoreBuf[0] = this.playerScore;
            this.scoreBuf[1] = this.enemyScore;
            send(ws, this.scoreBuf);
            this.changedScore = false;
        }
    }

    async simulate(){
        await this.getAIInputs();

        this.simulatePlayer(this.player);
        this.simulatePlayer(this.enemy);

        // this.reward += clamp((this.enemy.x - w / 2), platform[0].x, platform[1].x) / w;
        this.reward -= clamp((this.player.x - w / 2), platform[0].x, platform[1].x) / w * 1/2;

        this.collidePlayers();

        return true;
    }

    async getAIInputs(){
        if(connected === false){
            await socket.connect("tcp://127.0.0.1:5555");
            connected = true;
            console.log('socket connected!');
        }

        // send a message. When we recieve it we'll do simulation and reward (the below fn)
        await socket.send(this._getAIInputs());

        this.reward = 0;
        this.episodeEnded = false;

        const [msg] = await socket.receive();  // This gives you a Buffer
        const received = new Float32Array(msg.buffer, msg.byteOffset, msg.length / 4);

        console.log("Got:", received);
    }

    _getAIInputs(){
        // len=14
        return Buffer.from(new Float32Array([
            between(this.player.x, minX, maxX),
            between(this.player.y, minY, maxY),

            between(this.player.xv, -maxV, maxV),
            between(this.player.yv, -maxV, maxV),

            this.player.heavy ? 0 : 1,
            this.player.canJump ? 0 : 1,

            between(this.enemy.x, minX, maxX),
            between(this.enemy.y, minY, maxY),

            between(this.enemy.xv, -maxV, maxV),
            between(this.enemy.yv, -maxV, maxV),

            this.enemy.heavy ? 0 : 1,
            this.enemy.canJump ? 0 : 1,

            this.reward,// last reward
            this.episodeEnded ? 1 : 0
        ]).buffer);
    }

    simulatePlayer(p){
        const gravity = .2;
        const spd = .18;
        const jumpForce = 42;

        const i = p.input;
        
        p.mass = (i.heavy ? 1.8 : 1) / spd;
        p.heavy = i.heavy;

        p.xv += (i.right - i.left) / p.mass;

        p.yv += gravity;

        p.jumpCooldown--;
        if(p.canJump === true && p.jumpCooldown < 0 && p.yv >= 0.01){
            p.jumpCooldown = p.maxJumpCooldown;
            p.yv -= i.up * jumpForce / p.mass;
        }

        p.yv += (i.down * 3 - i.up) / p.mass / 3;

        p.x += p.xv;
        p.y += p.yv;
    }

    collidePlayers(){
        // with each other
        const p = this.player; const e = this.enemy;
        const dist = Math.sqrt((p.x - e.x) ** 2 + (p.y - e.y) ** 2);
        let col = false;
        if(dist < p.r + e.r){
            col = true;
            const angle = Math.atan2(p.y - e.y, p.x - e.x);


            const ratio = e.mass / (p.mass + e.mass);
            const distToMove = (p.r + e.r - dist);

            let dx = Math.cos(angle) * distToMove * ratio;
            let dy = Math.sin(angle) * distToMove * ratio;

            p.x += dx;
            p.y += dy;

            let tmpX = p.xv;
            let tmpY = p.yv;

            let heavyAdv = 'n';
            if(p.heavy && !e.heavy) heavyAdv = 'p';
            else if(!p.heavy && e.heavy) heavyAdv = 'e';

            p.xv = e.xv * (heavyAdv === 'e' ? 1.8 : 1);
            p.yv = e.yv * (heavyAdv === 'e' ? 1.8 : 1);

            e.xv = tmpX * (heavyAdv === 'p' ? 1.8 : 1);
            e.yv = tmpY * (heavyAdv === 'p' ? 1.8 : 1);

            dx = Math.cos(angle) * distToMove * (1 - ratio);
            dy = Math.sin(angle) * distToMove * (1 - ratio);

            e.x -= dx;
            e.y -= dy;

            this.reward += 0.01;
        }

        this.boundPlayerFloor(p);
        this.boundPlayerFloor(e);

        if(col === true){
            if(p.y > e.y) p.canJump = true;
            if(e.y > p.y) e.canJump = true;
        }

        if(p.y > 600 && p.yv > 0 || e.y > 600 && e.yv > 0){
            if(e.y > 600 && e.yv > 0){
                this.playerScore++;

                this.reward -= 10;
            }
            else if(p.y > 600 && p.yv > 0){
                this.enemyScore++;

                this.reward += 10;
            }
            this.reset()
            this.changedScore = this.episodeEnded = true;
        }
    }

    boundPlayerFloor(p){
        const playerSAT = new SAT.Circle(new SAT.Vector(p.x, p.y), p.r);

        let collided = SAT.testPolygonCircle(platformSAT, playerSAT, res);

        if(collided === true){
            p.x += res.overlapV.x;
            p.y += res.overlapV.y;

            p.xv *= 0.99;
            if(Math.abs(res.overlapV.x) < 0.01) p.yv = 0;
        }

        p.canJump = collided;

        res.clear();
    }
}

export default Game;