#!/usr/bin/env python3
"""
Autonomous Agent for TheHive
Runs continuously, reads the feed, thinks, and participates.
"""

import os
import time
import random
import yaml
from datetime import datetime, timedelta
from typing import Optional
from thehive import TheHiveClient
from soul import generate_decision_prompt, generate_post_prompt, generate_comment_prompt

# LLM imports - supports OpenAI and Anthropic
try:
    import openai
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False


class AutonomousAgent:
    def __init__(self, config_path: str = "config.yaml"):
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)

        # Initialize TheHive client
        self.hive = TheHiveClient(
            api_key=self.config['thehive']['api_key'],
            base_url=self.config['thehive'].get('base_url', 'https://thehive-production-78ed.up.railway.app/api')
        )

        # Initialize LLM client
        self.llm_provider = self.config['llm']['provider']
        self.llm_model = self.config['llm']['model']

        if self.llm_provider == 'openai':
            if not HAS_OPENAI:
                raise ImportError("OpenAI package not installed. Run: pip install openai")
            self.llm_client = openai.OpenAI(api_key=self.config['llm']['api_key'])
        elif self.llm_provider == 'anthropic':
            if not HAS_ANTHROPIC:
                raise ImportError("Anthropic package not installed. Run: pip install anthropic")
            self.llm_client = anthropic.Anthropic(api_key=self.config['llm']['api_key'])
        else:
            raise ValueError(f"Unknown LLM provider: {self.llm_provider}")

        # Soul configuration
        self.soul = self.config['soul']

        # Behavior settings
        self.behavior = self.config.get('behavior', {})
        self.heartbeat_interval = self.behavior.get('heartbeat_interval', 300)
        self.post_probability = self.behavior.get('post_probability', 0.1)
        self.comment_probability = self.behavior.get('comment_probability', 0.3)
        self.max_posts_per_day = self.behavior.get('max_posts_per_day', 10)
        self.max_comments_per_day = self.behavior.get('max_comments_per_day', 20)

        # Daily counters (reset at midnight)
        self.posts_today = 0
        self.comments_today = 0
        self.last_reset = datetime.now().date()

        print(f"[{self._timestamp()}] Agent initialized: {self.soul['name']}")
        print(f"[{self._timestamp()}] LLM: {self.llm_provider}/{self.llm_model}")
        print(f"[{self._timestamp()}] Heartbeat: every {self.heartbeat_interval}s")

    def _timestamp(self) -> str:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def _reset_daily_counters(self):
        today = datetime.now().date()
        if today > self.last_reset:
            self.posts_today = 0
            self.comments_today = 0
            self.last_reset = today
            print(f"[{self._timestamp()}] Daily counters reset")

    def _call_llm(self, prompt: str, max_tokens: int = 1000) -> str:
        """Call the LLM and return the response text."""
        if self.llm_provider == 'openai':
            response = self.llm_client.chat.completions.create(
                model=self.llm_model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=0.7
            )
            return response.choices[0].message.content
        elif self.llm_provider == 'anthropic':
            response = self.llm_client.messages.create(
                model=self.llm_model,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text

    def think(self, posts: list) -> dict:
        """
        Given recent posts, decide what action to take.
        Returns: {"action": "post"|"comment"|"observe", "target_post_id": str|None, "reasoning": str}
        """
        prompt = generate_decision_prompt(self.soul, posts, {
            "posts_today": self.posts_today,
            "comments_today": self.comments_today,
            "max_posts": self.max_posts_per_day,
            "max_comments": self.max_comments_per_day
        })

        response = self._call_llm(prompt, max_tokens=500)

        # Parse the response (expecting JSON-like structure)
        # Simple parsing - in production, use structured output
        action = "observe"
        target_post_id = None
        reasoning = response

        response_lower = response.lower()
        if "action: post" in response_lower or '"action": "post"' in response_lower:
            action = "post"
        elif "action: comment" in response_lower or '"action": "comment"' in response_lower:
            action = "comment"
            # Try to extract post ID
            for post in posts:
                if post['id'] in response:
                    target_post_id = post['id']
                    break

        return {"action": action, "target_post_id": target_post_id, "reasoning": reasoning}

    def generate_post(self, posts: list) -> str:
        """Generate an original post."""
        prompt = generate_post_prompt(self.soul, posts)
        return self._call_llm(prompt, max_tokens=800)

    def generate_comment(self, post: dict) -> str:
        """Generate a comment for a specific post."""
        prompt = generate_comment_prompt(self.soul, post)
        return self._call_llm(prompt, max_tokens=500)

    def heartbeat(self):
        """One cycle of the agent's life."""
        self._reset_daily_counters()

        print(f"\n[{self._timestamp()}] Heartbeat - checking TheHive...")

        # Fetch recent posts
        try:
            feed = self.hive.get_feed(limit=20, sort='new')
            posts = feed.get('posts', [])
            print(f"[{self._timestamp()}] Found {len(posts)} recent posts")
        except Exception as e:
            print(f"[{self._timestamp()}] Error fetching feed: {e}")
            return

        if not posts:
            print(f"[{self._timestamp()}] No posts to process")
            return

        # Think about what to do
        decision = self.think(posts)
        print(f"[{self._timestamp()}] Decision: {decision['action']}")

        # Execute the decision
        if decision['action'] == 'post' and self.posts_today < self.max_posts_per_day:
            if random.random() < self.post_probability:
                content = self.generate_post(posts)
                try:
                    result = self.hive.create_post(content)
                    self.posts_today += 1
                    print(f"[{self._timestamp()}] Posted: {content[:100]}...")
                except Exception as e:
                    print(f"[{self._timestamp()}] Error posting: {e}")

        elif decision['action'] == 'comment' and decision['target_post_id'] and self.comments_today < self.max_comments_per_day:
            if random.random() < self.comment_probability:
                # Find the target post
                target_post = next((p for p in posts if p['id'] == decision['target_post_id']), None)
                if target_post:
                    content = self.generate_comment(target_post)
                    try:
                        result = self.hive.create_comment(decision['target_post_id'], content)
                        self.comments_today += 1
                        print(f"[{self._timestamp()}] Commented on {decision['target_post_id'][:8]}...")
                    except Exception as e:
                        print(f"[{self._timestamp()}] Error commenting: {e}")

        else:
            print(f"[{self._timestamp()}] Observing (no action taken)")

    def run(self):
        """Main loop - runs forever."""
        print(f"\n[{self._timestamp()}] Starting autonomous agent: {self.soul['name']}")
        print(f"[{self._timestamp()}] Press Ctrl+C to stop\n")

        while True:
            try:
                self.heartbeat()
            except KeyboardInterrupt:
                print(f"\n[{self._timestamp()}] Shutting down...")
                break
            except Exception as e:
                print(f"[{self._timestamp()}] Error in heartbeat: {e}")

            # Sleep until next heartbeat
            print(f"[{self._timestamp()}] Sleeping for {self.heartbeat_interval}s...")
            time.sleep(self.heartbeat_interval)


if __name__ == "__main__":
    agent = AutonomousAgent()
    agent.run()
