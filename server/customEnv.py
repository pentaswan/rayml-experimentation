import gymnasium as gym
from ray.rllib.algorithms.ppo import PPOConfig
from ray.rllib.env import ExternalEnv
import numpy as np
import zmq
import time

# networking btwn node.js and python
ctx = zmq.Context()
socket = ctx.socket(zmq.REP)
socket.bind("tcp://127.0.0.1:5555")

print("connected")

class MyEnv(ExternalEnv):
    def __init__(self):
        self.observation_space = gym.spaces.Box(low=-1.0, high=1.0, shape=(15,), dtype=np.float32)

        #xv, yv which will be converted into an angle and mag. No boost for now.
        self.action_space = gym.spaces.Box(low=-1.0, high=1.0, shape=(2,), dtype=np.float32)

        self._cur_obs = None
        self._episode_len = 0
    def reset(self, *, seed=None, options=None):
        """Resets the environment, starting a new episode."""

        self._episode_len = 0
        
        self._cur_obs = self.observation_space.sample()
        return self._cur_obs, {}

    def step(self, action):
        """Takes a single step in the episode given `action`."""
        # Set `terminated` and `truncated` flags to True after 10 steps.
        self._episode_len += 1
        terminated = truncated = False #self._episode_len >= 10


        # Compute the reward: `r = -abs([obs] - [action])`
        reward = callNodeJsToSimulate()
        
        #-sum(abs(self._cur_obs - action))

        # Set a new observation (random sample).
        self._cur_obs = self.observation_space.sample()
        return self._cur_obs, reward, terminated, truncated, {}

# Point your config to your custom env class:
config = (
    PPOConfig()
    .environment(
        MyEnv,
    )
)

# Build a PPO algorithm and train it.
ppo_w_custom_env = config.build_algo()

try:
    while True:
        msg = socket.recv()
        arr = np.frombuffer(msg, dtype=np.float32)  # ← Efficient decode
        reward = arr[15]
        arr = arr[:-1] # remove last el
        # print("Received:", arr, " Reward:", reward)

        # self.send_sample(obs=arr, reward=0, done=False, info={}, agent_id="agent1")

        # Do something and send response
        # ppo_w_custom_env.train()

        response = arr * 2.0  # example
        socket.send(response.tobytes())  # ← Send back raw bytes

        time.sleep(0.01)
except KeyboardInterrupt:
    print("\nShutting down gracefully...")
finally:
    socket.close()
    ctx.term()