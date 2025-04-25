from gymnasium import spaces
import queue
import gymnasium as gym
import numpy as np

# async things
class AsyncQueueEnv(gym.Env):
    def __init__(self):
        super().__init__()
        self.observation_space = spaces.Box(low=-1, high=1, shape=(1,), dtype=np.float32)# 12
        self.action_space = spaces.Discrete(8)

        self.input_queue = queue.Queue()
        self.current_obs = np.zeros(1, dtype=np.float32)

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        self.current_obs = np.zeros(1, dtype=np.float32)
        return self.current_obs, {}

    def step(self, action):
        # wait for external signal or data

        # print('waiting for obs!')
        arr = self.input_queue.get()

        reward = arr[1]
        ended = arr[2]# 13

        if(ended):
            self.reset()

        next_obs = arr[0:1]

        self.current_obs = next_obs
        terminated = False
        truncated = False
        info = {}
        return self.current_obs, reward, terminated, truncated, info

    def external_feed(self, arr):
        """Call this from another thread or process to feed data"""
        # print('recieving external data!')
        # print(arr)

        self.input_queue.put(arr)