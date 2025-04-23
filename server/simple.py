from ray.rllib.algorithms.ppo import PPOConfig

# Create a config instance for the PPO algorithm.
config = (
    PPOConfig()
    .environment("Pendulum-v1")
)

ppo = config.build_algo()

from pprint import pprint

for _ in range(4):
    pprint(ppo.train())