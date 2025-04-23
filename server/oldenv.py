import gymnasium as gym
from ray.rllib.algorithms.ppo import PPOConfig
from ray.rllib.env import ExternalEnv
import ray
from ray.rllib.algorithms.ppo import PPO
import numpy as np
import zmq
import time
import queue
from pprint import pprint
import threading

# networking btwn node.js and python
ctx = zmq.Context()
socket = ctx.socket(zmq.REP)
socket.bind("tcp://127.0.0.1:5555")

print("connected")
print(ray.__version__)

# actionQueue = queue.Queue()

class MyEnv(gym.Env):
    def __init__(self, config=None):
        self.observation_space = gym.spaces.Box(low=0.0, high=1.0, shape=(12,), dtype=np.float32)

        # up, down, left, right, heavy
        self.action_space = gym.spaces.Box(low=0.0, high=1.0, shape=(5,), dtype=np.float32)

        self.queue = queue.Queue()

        super().__init__(self.action_space, self.observation_space)
    def step_env(self):
        arr = self.queue.get()

        reward = arr[12]
        terminated = arr[13] == 1
        obs = arr[:-2]
        truncated = False

        print('recieved')
        pprint(obs)
        print(reward)

        action = self.trainer.compute_single_action(self.obs)

        done = terminated or truncated

        self.episode_reward += reward
        return action, reward, obs, done

ray.init()

trainer = (
    PPOConfig()
    .environment(MyEnv)
    .framework("torch")
    .build()
)

while True:
    # len 14
    env.queue.put([0,0,0,0 , 0,0,0,0 , 0,0,0,0 , 0,0,0,0 , 0,0])
    # action, reward, obs, done = env.step_env()
    # action = trainer.compute_single_action(obs)
    # obs, reward, terminated, truncated, info = env.step_env(action)
    done = terminated or truncated

    time.sleep(1)

# # config.environment(MyEnv)
# # config.framework("torch")
# # config.num_workers = 0

# trainer = config.build()

# # .rollouts(num_rollout_workers=0)

# print('round 1, fight!')

# # env.step_env()

# # # python's job is [input, reward] -> action
# # try:
# #     while True:
# #         msg = socket.recv()
# #         arr = np.frombuffer(msg, dtype=np.float32)

# #         env.queue.put(arr)

# #         # now we wait
# #         action = actionQueue.get()

# #         socket.send(action.astype(np.float32).tobytes())

# #         time.sleep(0.005)
# # except KeyboardInterrupt:
# #     print("\nShutting down gracefully...")
# # finally:
# #     socket.close()
# #     ctx.term()