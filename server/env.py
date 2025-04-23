from ray.rllib.algorithms.ppo import PPOConfig
from ray.rllib.core.rl_module.rl_module import RLModuleSpec
from ray.rllib.models.catalog import ModelCatalog

import gymnasium as gym
from queue import Queue

from pprint import pprint
import torch.nn as nn
import numpy as np
import ray
import torch
import zmq
import time

class MyEnvSimulator:
    def __init__(self, trainer):
        self.trainer = trainer
        self.obs_queue = Queue()
        self.reward_queue = Queue()
        self.action_queue = Queue()
        self.reset()
        self.module = self.trainer.get_module()
        self.action_space = gym.spaces.Box(low=0.0, high=1.0, shape=(3,), dtype=np.float32)
        self.dist_cls = ModelCatalog.get_action_dist(self.action_space, framework="torch")

    def reset(self):
        self.total_reward = 0

    def run(self):
        while True:
            obs = self.obs_queue.get()
            reward = self.reward_queue.get()
            # terminated = False

            out = self.module.forward_inference({"obs": obs})

            action_dist = self.dist_cls(out["action_dist_inputs"], self.action_space)

            action = action_dist.sample()

            pprint(action)
            # action = out["action_dist_inputs"].sample()
            self.action_queue.put(action)

class DummyEnv(gym.Env):
    def __init__(self, observation_space=None, action_space=None, inference_only=None, model_config=None, catalog_class=None):
        self.observation_space = gym.spaces.Box(low=0.0, high=1.0, shape=(12,), dtype=np.float32)
        self.action_space = gym.spaces.Box(low=0.0, high=1.0, shape=(3,), dtype=np.float32)
    def reset(self):
        return self.observation_space.sample(), {}

    def step(self, action):
        return self.observation_space.sample(), 0.0, False, {}

ray.init()

config = (
    PPOConfig()
    .environment(DummyEnv)
    .rl_module(
        rl_module_spec=RLModuleSpec(
            observation_space=gym.spaces.Box(low=0.0, high=1.0, shape=(12,), dtype=np.float32),
            action_space=gym.spaces.Box(low=0.0, high=1.0, shape=(3,), dtype=np.float32),
            model_config={
                "fcnet_hiddens": [64, 64]
            }
        )
    )
)

trainer = config.build_algo()


sim = MyEnvSimulator(trainer)

import threading
threading.Thread(target=sim.run, daemon=True).start()

# external simulation:
obs = torch.tensor([[0.,0.,0.,0., 0.,0.,0.,0., 0.,0.,0.,0.]], dtype=torch.float32)#np.zeros((12,), dtype=np.float32)
done = False
reward = 0.5

sim.obs_queue.put(obs)
sim.reward_queue.put(reward)

action = sim.action_queue.get()

print('action!')
pprint(action)

# ctx = zmq.Context()
# socket = ctx.socket(zmq.REP)
# socket.bind("tcp://127.0.0.1:5555")

# print("connected")

# python's job is [input, reward] -> action
# try:
#     while True:
#         msg = socket.recv()
#         arr = np.frombuffer(msg, dtype=np.float32)

#         sim.queue.put(torch.from_numpy(arr))

#         # wait for action
#         action = sim.action_queue.get()

#         # print('action!')
#         # pprint(action)

#         # .astype(np.float32)
#         socket.send(action.numpy().astype(np.float32).tobytes())

#         time.sleep(0.005)
# except KeyboardInterrupt:
#     print("\nShutting down gracefully...")
# finally:
#     socket.close()
#     ctx.term()