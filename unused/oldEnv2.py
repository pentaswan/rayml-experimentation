from ray.rllib.algorithms.ppo import PPOConfig
from ray.rllib.core.rl_module.rl_module import RLModuleSpec
from ray.rllib.policy.sample_batch import SampleBatch#, MultiAgentBatch

from ray.rllib.core.rl_module.rl_module import RLModule
from ray.rllib.policy.sample_batch import SampleBatch

import gymnasium as gym
from queue import Queue

from pprint import pprint
import torch.nn as nn
import numpy as np
import ray
import torch
import zmq
import time

from ray.rllib.core.learner.learner import Learner

class MyEnvSimulator:
    def __init__(self, trainer):
        self.trainer = trainer
        self.obs_queue = Queue()
        self.reward_queue = Queue()
        self.action_queue = Queue()
        self.ended_queue = Queue()
        self.reset()
        self.module = self.trainer.get_module()

        
        self.learner_group = self.trainer.learner_group
        self.action_space = gym.spaces.Box(low=0.0, high=1.0, shape=(3,), dtype=np.float32)
        self.module_id = "default_policy"

        self.dist_cls = self.module.get_train_action_dist_cls()
        print('DIST CLS')
        pprint(self.dist_cls)
    def reset(self):
        self.episode_batch = []

        # pprint("IN START")
        # pprint(action_dist_inputs)

        # pprint(self.dist_cls)

        # pprint(action_dist)
        # pprint("NO WAY")
        # pprint(action)

    def run(self):
        while True:
            obs = self.obs_queue.get()
            reward = self.reward_queue.get()
            ended = self.ended_queue.get()
            # terminated = False

            out = self.module.forward_train({"obs": obs})# forward_inference

            action_dist_inputs = out["action_dist_inputs"]

            action_dist = self.dist_cls.from_logits(action_dist_inputs)

            action = action_dist.sample()

            squashed_action = torch.sigmoid(action).squeeze(0).detach().numpy()

            # with torch.no_grad():
            #     encoder_out = self.module.encoder({"obs": obs})
            #     values = self.module.value_head(encoder_out).squeeze(-1).numpy()

            # give to js
            self.action_queue.put(squashed_action)

            # pprint(obs)
            # pprint(squashed_action)
            # pprint(torch.tensor(reward, dtype=torch.float32))
            # pprint(torch.tensor(ended, dtype=torch.bool))
            # pprint(action_dist.logp(action))

            # store for training
            self.episode_batch.append({
                "obs": obs,
                "action": action,
                "reward": reward,
                "terminated": ended,
                "truncated": False,
                "action_logp": action_dist.logp(action),
                "action_dist_inputs": action_dist_inputs,
                # "values": values
            })

            # # Track trajectory (below this point is all for training)
            # self.episode_obs.append(obs)
            # self.episode_actions.append(action.squeeze(0).detach())
            # self.episode_action_dist_inputs.append(action_dist_inputs.squeeze(0).detach())
            # self.episode_action_logps.append(action_logp.squeeze(0).detach())
            # self.episode_rewards.append(torch.tensor(reward, dtype=torch.float32))

            if ended:
                # print('done, training')

                obs = torch.stack([step["obs"] for step in self.episode_batch])
                final_next_obs = obs[-1]
                next_obs = torch.vstack((obs[1:], final_next_obs.unsqueeze(0)))

                batch = SampleBatch({
                    "obs": obs,
                    "actions": torch.stack([step["action"] for step in self.episode_batch]),
                    "rewards": torch.tensor([step["reward"] for step in self.episode_batch], dtype=torch.float32),
                    "terminateds": torch.tensor([step["terminated"] for step in self.episode_batch], dtype=torch.bool),
                    "truncateds": torch.tensor([step["truncated"] for step in self.episode_batch], dtype=torch.bool),
                    "new_obs": next_obs,
                    "action_dist_inputs": torch.stack([step["action_dist_inputs"] for step in self.episode_batch]),

                    "action_logp": torch.stack([step["action_logp"] for step in self.episode_batch])
                })

                pprint("B4")
                pprint(batch)

                self.postprocess_batch(batch, self.module, 0.99, 0.95)

                pprint("AFTER")
                pprint(batch)

                # postprocessed_batch = policy.postprocess_trajectory(batch)

                # pprint("KEYS")
                # pprint(SampleBatch.OBS)
                # pprint(SampleBatch.ACTIONS)
                # pprint(SampleBatch.REWARDS)
                # pprint(SampleBatch.TERMINATEDS)
                # pprint(SampleBatch.ACTION_DIST_INPUTS)
                # pprint(SampleBatch.NEXT_OBS)

                # pprint(batch)

                results = self.trainer.learner_group.update_from_batch(batch)

                print('finished learning')
                pprint(results)

                # Reset for next episode
                self.reset()

    def postprocess_batch(self, batch: SampleBatch, rl_module: RLModule, gamma=0.99, lambda_=0.95) -> SampleBatch:
        """
        Adds value predictions, log-probs, and GAE advantages to the batch.
        Works for PPO-style continuous control in Ray RLlib 2.44.1+.
        """

        # Forward pass through the module
        with torch.no_grad():
            fwd_out = rl_module(batch)
            pprint(fwd_out)
            values = fwd_out["value_preds"].squeeze(-1)  # Remove last dim if (B, 1)

        # GAE advantage computation
        def compute_gae(rewards, values, dones, gamma=0.99, lambda_=0.95):
            advantages = torch.zeros_like(rewards)
            last_gae = 0
            for t in reversed(range(len(rewards))):
                next_value = values[t + 1] if t + 1 < len(values) else 0.0
                delta = rewards[t] + gamma * next_value * (1 - dones[t]) - values[t]
                advantages[t] = last_gae = delta + gamma * lambda_ * (1 - dones[t]) * last_gae
            return advantages

        rewards = batch["rewards"]
        dones = batch["terminateds"].float()
        advantages = compute_gae(rewards, values, dones, gamma, lambda_)
        value_targets = advantages + values

        # Add new keys to batch
        # batch["action_logp"] = logp
        batch["advantages"] = advantages
        batch["value_preds"] = values
        batch["value_targets"] = value_targets

        return batch

class DummyEnv(gym.Env):
    def __init__(self, observation_space=None, action_space=None, inference_only=None, model_config=None, catalog_class=None):
        self.observation_space = gym.spaces.Box(low=0.0, high=1.0, shape=(12,), dtype=np.float32)
        self.action_space = gym.spaces.Box(low=0.0, high=1.0, shape=(3,), dtype=np.float32)
        self.inference_only = False
    def reset(self):
        return self.observation_space.sample(), {}

    def step(self, action):
        return self.observation_space.sample(), 0.0, False, {}

ray.init()

config = (
    PPOConfig()
    # .training(gamma=0.99, lambda_=0.95)
    .environment(DummyEnv)
    .rl_module(
        rl_module_spec=RLModuleSpec(
            observation_space=gym.spaces.Box(low=0.0, high=1.0, shape=(12,), dtype=np.float32),
            action_space=gym.spaces.Box(low=0.0, high=1.0, shape=(3,), dtype=np.float32),
            inference_only=False,
            model_config={
                "fcnet_hiddens": [64, 64],
            },
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
sim.ended_queue.put(done)

action = sim.action_queue.get()

print('action!')
pprint(action)

# train
obs = torch.tensor([[0.,0.,0.,0., 0.,0.,0.,0., 0.,0.,0.,0.]], dtype=torch.float32)#np.zeros((12,), dtype=np.float32)
done = True
reward = 0.5

sim.obs_queue.put(obs)
sim.reward_queue.put(reward)
sim.ended_queue.put(done)

action = sim.action_queue.get()

print('action 2!')
pprint(action)

# # IMPORTANT: add line inference_only = False in line 403 C:\Users\JoeIn\AppData\Local\Programs\Python\Python311\Lib\site-packages\ray\rllib\core\rl_module\rl_module.py

# ctx = zmq.Context()
# socket = ctx.socket(zmq.REP)
# socket.bind("tcp://127.0.0.1:5555")

# print("connected")

# python's job is [input, reward] -> action
# try:
#     while True:
#         if socket.poll(timeout=10):
#             msg = socket.recv()
#             arr = np.frombuffer(msg, dtype=np.float32)

#             reward = arr[12]
#             ended = arr[13]

#             arr = arr[0:12]

#             # print('recieved')
#             # pprint(arr)
#             # print(reward)

#             sim.obs_queue.put(torch.from_numpy(arr))
#             sim.reward_queue.put(reward)
#             sim.ended_queue.put(ended)

#             # wait for action
#             action = sim.action_queue.get()

#             # print('action!')
#             # pprint(action)

#             # .astype(np.float32)
#             socket.send(action.numpy().astype(np.float32).tobytes())

#             # time.sleep(0.005)
# except KeyboardInterrupt:
#     print("\nShutting down gracefully...")
# finally:
#     socket.close()
#     ctx.term()

ctx = zmq.Context()
socket = ctx.socket(zmq.REP)
socket.bind("tcp://127.0.0.1:5555")

while True:
    if socket.poll(timeout=10):
        msg = socket.recv()
        arr = np.frombuffer(msg, dtype=np.float32)

        # arr contains all the inputs, as well as what to do

        # some ml logic to compute the action, given observations, last reward, etc. in arr...

        # send back the action
        socket.send(action.numpy().astype(np.float32).tobytes())