import { Request } from "zeromq";
import SAT from 'sat';
import { styleText } from 'node:util';

let connected = false;
const socket = new Request();

async function connect(){
    await socket.connect("tcp://127.0.0.1:5555");
    connected = true;
    console.log('socket connected!');
}

connect();

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

const minX = platform[0].x;// 0
const maxX = platform[1].x;// w
const halfX = w / 2;

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
    return clamp((t - min) / (max - min) * 2 - 1, -1, 1);
    // (this.player.y - minY) / (maxY - minY)
}

function dot(v1, v2){
    return v1[0] * v2[0] + v1[1] * v2[1];
}

function mag(v){
    return Math.sqrt(v[0] ** 2 + v[1] ** 2);
}

const cos = Math.cos; const sin = Math.sin;
function rotateVec(v, t){
    return [
        cos(t) * v[0] - sin(t) * v[1],
        sin(t) * v[0] + cos(t) * v[1]
    ]
    // const rotationMatrix = [
    //     [cos(t), -sin(t)],
    //     [sin(t), cos(t)]
    // ]
}

class Game {
    constructor(){
        this.reset();

        this.reward = 0;
        this.reward2 = 0;

        this.updatePack = new Float32Array(8);
        this.scoreBuf = new Uint16Array(2);
        this.changedScore = false;
        this.episodeEnded = false;

        this.enemyScore = this.playerScore = 0;

        this.cumulativeReward = 0;
        this.crTicks = 0;
        this.lastCR = 0;

        this.saveToFile = false;
    }

    reset(){
        this.tick = 0;
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
                heavy: false,
                inverted: false
            },
            agentType: 'ai',
            outsideBounds: false
        }
        
        this.enemy = structuredClone(this.player);
    
        this.enemy.x = w - this.player.x;

        if(lastInputs !== undefined){
            this.player.input = structuredClone(lastInputs);
        }
        this.playersTouched = false;

        this.player.agentType = 'human';
        // if(Math.random() < 0.7) this.player.agentType = 'ai'
        // else {
        //     const aiTypes = ['random','stationary','jump','slowright'];
        //     this.player.agentType = aiTypes[Math.floor(Math.random() * aiTypes.length)];
        // }
    }

    sendUpdatePack(ws){
        if(ws.connected === false) return;

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

        this.enemy.heavy = this.enemy.input.heavy = false;
    }

    async simulate(){
        // console.log(Math.round(this.reward * 100) / 100);// Math.round(this.reward2 * 100) / 100
        // this.tick++;
        // if(this.tick > 500) {
        //     this.reset();
        //     this.cumulativeReward = 0;
        //     this.episodeEnded = true;
        // }

        // this.cumulativeReward += /*this.reward +*/ this.reward2;
        // this.crTicks++;

        // if(this.crTicks === 500){
        //     // const reward = (this.cumulativeReward - this.lastCR) / 1000;
        //     // console.log(styleText(reward > 0 ? 'green' : 'red', reward.toString()));
        //     // console.log(this.cumulativeReward / 1000);
        //     this.lastCR = this.cumulativeReward;
        //     this.crTicks = 0;
        //     this.cumulativeReward = 0;
        // }

        // await this.getAIInputs(this.player);

        // if(this.episodeEnded) console.log('resetting ep!');
        // this.episodeEnded = false;// so that we only train once
        // this.saveToFile = false;

        await this.getAIInputs(this.enemy);

        // (move above for train), not anymore now we only train on player
        this.episodeEnded = false;// so that we only train once
        this.saveToFile = false;

        this.reward = this.reward2 = 0;

        if(this.player.outsideBounds){
            this.reward -= 100;
            this.player.outsideBounds = false;
        }

        if(this.enemy.outsideBounds){
            this.reward2 -= 100;
            this.enemy.outsideBounds = false;
        }

        this.simulatePlayer(this.player);
        this.simulatePlayer(this.enemy);

        this.reward -= Math.abs(w / 2 - this.player.x) / w * 4;
        this.reward2 -= Math.abs(w / 2 - this.enemy.x) / w * 4;

        this.reward += 1 + this.tick / 3000;
        this.reward2 += 1 + this.tick / 3000;


        // this.reward -= clamp((this.player.x - w / 2), platform[0].x, platform[1].x) / w * 1/2;

        // if(this.enemy.input.up){
        //     this.reward -= 100;
        // }

        this.collidePlayers();

        return true;
    }

    async getAIInputs(p=this.enemy){
        if(connected === false) return;

        // TODO: idea for further testing: train w/o heavy or canjump and provide reward for agents moving closer to each other + more on collision. Also setInterval change to 0 

        // send a message. When we recieve it we'll do simulation and reward (the below fn)

        if(p === this.enemy || p.agentType === 'ai'){
            const inputs = (p === this.player) ? this._getAIInputs(this.player, this.enemy) : this._getAIInputs(this.enemy, this.player);
            await socket.send(inputs);

            // console.log('sent', inputs, 'waiting to recieve!');

            const [msg] = await socket.receive();  // This gives you a Buffer
            const received = new Float32Array(msg.buffer, msg.byteOffset, msg.length / 4);

            // console.log('recieved inputs!', received[0]);

            let actionInd = received[0];

            // l/r, u/d
            let firstBit = (actionInd & 0x2) !== 0;
            let secondBit = (actionInd & 0x1) !== 0;

            p.input.right = p.input.left = p.input.up = p.input.down = false;

            if(firstBit) p.input.right = true;
            else p.input.left = true;

            if(secondBit) p.input.up = true;
            else p.input.down = true;

            if(p.x < minX){
                p.input.right = true;
                p.input.left = false;
                p.input.up = true;
                p.input.down = false;
                p.outsideBounds = true;
            } else if(p.x > maxX){
                p.input.left = true;
                p.input.right = false;
                p.input.up = true;
                p.input.down = false;
                p.outsideBounds = true;
            }
        } else {
            p.input.right = p.input.left = p.input.up = p.input.down = false;
            if(p.agentType === 'random'){
                if(Math.random() < 0.5) p.input.right = true;
                else p.input.left = true;

                if(Math.random() < 0.5) p.input.up = true;
                else p.input.down = true;
            } else if(p.agentType === 'jump'){
                if(Math.random() < 0.2) p.input.up = true;
            } else if(p.agentType === 'slowright'){
                if(Math.random() < 0.2) p.input.right = true;
            }// else if(p.agentType === 'stationary'){
                
            // }
        }
    }

    _getAIInputs(p=this.player, o=this.enemy){
        // len=8
        // let inverted = p.x > halfX;
        // p.input.inverted = inverted;
        let inverted = false;
        return Buffer.from(new Float32Array([
            between(inverted ? (w - p.x) : p.x, minX, maxX),
            between(p.y, minY, maxY),

            between(p.xv * (inverted ? -1 : 1), -maxV, maxV),
            between(p.yv, -maxV, maxV),

            between(inverted ? (w - o.x) : o.x, minX, maxX),
            between(o.y, minY, maxY),

            between(o.xv * (inverted ? -1 : 1), -maxV, maxV),
            between(o.yv, -maxV, maxV),

            inverted ? 1 : -1,

            p === this.player ? this.reward : this.reward2,// last reward
            this.episodeEnded && p === this.enemy ? 1 : 0,
            p === this.player ? 0 : 1,
            this.saveToFile ? 1 : 0
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
            /*if(p.agentType === 'ai')*/ //p.input.heavy = p.heavy = true;
            /*if(e.agentType === 'ai')*/ e.input.heavy = e.heavy = true;
                
            col = true;
            const angle = Math.atan2(p.y - e.y, p.x - e.x);

            const ratio = e.mass / (p.mass + e.mass);
            const distToMove = (p.r + e.r - dist);

            let dx = Math.cos(angle) * distToMove * ratio;
            let dy = Math.sin(angle) * distToMove * ratio;

            p.x += dx;
            p.y += dy;

            dx = Math.cos(angle) * distToMove * (1 - ratio);
            dy = Math.sin(angle) * distToMove * (1 - ratio);

            e.x -= dx;
            e.y -= dy;

            let m1 = p.heavy ? 1.8 : 1;
            let m2 = e.heavy ? 1.8 : 1;
            if(p.heavy && e.heavy) m1 = m2 = 1;

            const Pvec = [
                p.xv,
                p.yv
            ]
    
            const Evec = [
                e.xv,
                e.yv
            ]
    
            let [v_x1, v_y1] = rotateVec(Pvec, -angle);
            let [v_x2, v_y2] = rotateVec(Evec, -angle);
    
            const delta = this.computeDelta(m1, m2, v_x1, v_y1, v_x2, v_y2);
    
            v_x1 += delta * m2;
            v_x2 -= delta * m1;
    
            [v_x1, v_y1] = rotateVec([v_x1, v_y1], angle);
            [v_x2, v_y2] = rotateVec([v_x2, v_y2], angle);
    
            p.xv = v_x1;
            p.yv = v_y1;

            e.xv = v_x2;
            e.yv = v_y2;

            this.reward += 20;
            this.reward2 += 20;

            this.playersTouched = true;
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

                if(this.playersTouched) this.reward += 10;

                this.reward2 -= 10;
                if(!this.playersTouched) this.reward2 -= 20;
            }
            else if(p.y > 600 && p.yv > 0){
                this.enemyScore++;

                this.reward -= 10;
                if(!this.playersTouched) this.reward -= 20;

                if(this.playersTouched) this.reward2 += 10;
            }
            this.reset()
            this.changedScore = this.episodeEnded = true;
        }
    }

    computeDelta(m1, m2, v_x1, v_y1, v_x2, v_y2){
        const sqrt = Math.sqrt;

        const A = 2 * (m1 ** 2) * (m2 ** 2);

        const B = 2 * v_x1 * (m1 ** 2) * m2 - 2 * v_x2 * (m2 ** 2) * m1;

        const C = 2 * m1 * m2 * sqrt((v_x1 ** 2 + v_y1 ** 2) * (v_x2 ** 2 + v_y2 ** 2));

        return sqrt(C / A + B ** 2 / (4 * A ** 2)) - B / (2*A);

        // const bigSqrt = sqrt((v_x1 ** 2 + v_y1 ** 2) * (v_x2 ** 2 + v_y2 ** 2));

        // const A = bigSqrt;

        // const B = (v_x1 - v_x2);

        // return sqrt(A + (B ** 2) / 2) - B / 2;
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