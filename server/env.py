import gymnasium as gym
from ray.rllib.algorithms.ppo import PPOConfig
from ray.rllib.env import ExternalEnv
import numpy as np
import zmq
import time
import queue
from pprint import pprint

# networking btwn node.js and python
ctx = zmq.Context()
socket = ctx.socket(zmq.REP)
socket.bind("tcp://127.0.0.1:5555")

print("connected")

actionQueue = queue.Queue()

class MyEnv(ExternalEnv, gym.Env):
    def __init__(self, config=None):
        self.observation_space = gym.spaces.Box(low=0.0, high=1.0, shape=(12,), dtype=np.float32)

        # up, down, left, right, heavy
        self.action_space = gym.spaces.Box(low=0.0, high=1.0, shape=(5,), dtype=np.float32)

        self.reward = 0
        self.inputs = self.observation_space.sample()

        self.ep_id = None

        self.queue = queue.Queue()

        super().__init__(self.action_space, self.observation_space)
    # def begin_episode(self):
    #     print('beginning ep')
    #     self.episode_id = self.start_episode()
    
    # def finish_episode(self):
    #     print('ending ep')
    #     self.end_episode(self.episode_id, self.observation_space.sample())

    def step_env(self, obs, reward):
        # SUPER TEMP
        obs = self.observation_space.sample()
        # temp
        print('starting')
        self.ep_id = self.start_episode()

        print('getting')
        print(self.ep_id)
        action = self.get_action(self.ep_id, obs)

        print('logging')
        self.log_returns(self.ep_id, reward)

        # temp
        print('ending')
        self.end_episode(self.ep_id, self.observation_space.sample())
        print('returning')
        return action
    
    # Minimal stubs to satisfy gymnasium.Env checks
    def reset(self, *, seed=None, options=None):
        return self.observation_space.sample(), {}

    def step(self, action):
        return self.observation_space.sample(), 0.0, False, False, {}
    
    def run(self):
        # block execution until things are ready
        print('awaiting dinner')
        arr = self.queue.get()

        reward = arr[12]
        # ended = arr[13] == 1
        obs = arr[:-2]

        print('recieved')
        pprint(obs)
        print(reward)
        # print(ended)

        # if ended:
        #     print('new round!')
        #     self.finish_episode()
        #     self.begin_episode()

        print('getting action!')
        action = self.step_env(obs, reward)

        print('and... action')
        pprint(action)

        global actionQueue
        actionQueue.put(action)
    


# # Point your config to your custom env class:
# config = (
#     PPOConfig()
#     .environment(
#         MyEnv,
#     )
#     # .env_runners(num_env_runners=0)
# )

# alg = config.build_algo()

# instance.begin_episode()

instance = MyEnv()
instance.start()
# instance.begin_episode()

print('round 1, fight!')

# python's job is [input, reward] -> action
try:
    while True:
        msg = socket.recv()
        arr = np.frombuffer(msg, dtype=np.float32)

        instance.queue.put(arr)

        # now we wait
        action = actionQueue.get()

        socket.send(action.astype(np.float32).tobytes())

        time.sleep(0.005)
except KeyboardInterrupt:
    print("\nShutting down gracefully...")
finally:
    socket.close()
    ctx.term()