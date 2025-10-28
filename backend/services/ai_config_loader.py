"""
AI Model Configuration Loader

This module loads and validates AI model configurations from ai_models.json.
API keys are stored securely in the config file and never exposed to the frontend.
"""

import json
import os
from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class AIModelConfig:
    """Configuration for a single AI model"""
    id: str
    display_name: str
    model: str
    base_url: str
    api_key: str


class AIConfigLoader:
    """Singleton loader for AI model configurations"""

    _instance = None
    _models: Dict[str, AIModelConfig] = {}
    _config_path: str = ""

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def load_config(self, config_path: str = None):
        """
        Load AI model configurations from JSON file

        Args:
            config_path: Path to ai_models.json (defaults to backend/ai_models.json)

        Raises:
            FileNotFoundError: If config file doesn't exist
            ValueError: If config file is invalid
        """
        if config_path is None:
            # Default to backend/ai_models.json
            backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            config_path = os.path.join(backend_dir, "ai_models.json")

        self._config_path = config_path

        if not os.path.exists(config_path):
            raise FileNotFoundError(
                f"AI models config file not found: {config_path}\n"
                f"Please create it from ai_models.example.json template"
            )

        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in ai_models.json: {e}")

        # Validate structure
        if "models" not in config_data:
            raise ValueError("ai_models.json must contain a 'models' array")

        models_list = config_data["models"]
        if not isinstance(models_list, list):
            raise ValueError("'models' must be an array")

        if len(models_list) == 0:
            raise ValueError("At least one AI model must be configured")

        # Parse and validate each model
        self._models.clear()
        for idx, model_data in enumerate(models_list):
            try:
                self._validate_and_add_model(model_data, idx)
            except Exception as e:
                raise ValueError(f"Invalid model at index {idx}: {e}")

        print(f"[OK] Loaded {len(self._models)} AI model configurations")
        for model_id, config in self._models.items():
            print(f"  - {config.display_name} ({model_id})")

    def _validate_and_add_model(self, model_data: dict, index: int):
        """Validate and add a single model configuration"""
        required_fields = ["id", "display_name", "model", "base_url", "api_key"]

        for field in required_fields:
            if field not in model_data:
                raise ValueError(f"Missing required field: {field}")
            if not isinstance(model_data[field], str):
                raise ValueError(f"Field '{field}' must be a string")
            if not model_data[field].strip():
                raise ValueError(f"Field '{field}' cannot be empty")

        model_id = model_data["id"]

        if model_id in self._models:
            raise ValueError(f"Duplicate model ID: {model_id}")

        # Create config object
        config = AIModelConfig(
            id=model_id,
            display_name=model_data["display_name"],
            model=model_data["model"],
            base_url=model_data["base_url"].rstrip('/'),  # Remove trailing slash
            api_key=model_data["api_key"]
        )

        self._models[model_id] = config

    def get_model_config(self, model_id: str) -> Optional[AIModelConfig]:
        """
        Get configuration for a specific model by ID

        Args:
            model_id: The model ID to look up

        Returns:
            AIModelConfig if found, None otherwise
        """
        return self._models.get(model_id)

    def get_all_models(self) -> List[Dict[str, str]]:
        """
        Get all available models (without API keys)

        Returns:
            List of dicts with id, display_name, model, base_url (NO api_key)
        """
        return [
            {
                "id": config.id,
                "display_name": config.display_name,
                "model": config.model,
                "base_url": config.base_url
                # NOTE: api_key intentionally excluded for security
            }
            for config in self._models.values()
        ]

    def get_model_ids(self) -> List[str]:
        """Get list of all available model IDs"""
        return list(self._models.keys())

    def is_valid_model_id(self, model_id: str) -> bool:
        """Check if a model ID exists in configuration"""
        return model_id in self._models

    def reload_config(self):
        """Reload configuration from disk (useful for runtime updates)"""
        if self._config_path:
            self.load_config(self._config_path)


# Global singleton instance
ai_config = AIConfigLoader()
