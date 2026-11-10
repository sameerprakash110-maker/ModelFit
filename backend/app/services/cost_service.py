from typing import Dict, Tuple, Optional


class CostService:
    """
    Cost calculation engine for LLM providers.

    All prices are USD per million tokens.
    """

    PRICING_TABLE: Dict[str, Tuple[float, float]] = {

        # Google Gemini
        "gemini-1.5-pro": (1.25, 5.00),
        "gemini-1.5-flash": (0.075, 0.30),
        "gemini-2.5-flash": (0.30, 2.50),
        "gemini-3.1-flash-lite": (0.25, 1.50),

        # OpenAI
        "gpt-4o": (2.50, 10.00),
        "gpt-4o-mini": (0.15, 0.60),
        "o1-preview": (15.00, 60.00),
        "o1-mini": (3.00, 12.00),

        # Groq
        "qwen/qwen3.8-27b": (0.80, 4.00),
        "openai/gpt-oss-120b": (0.15, 0.60),
        "openai/gpt-oss-20b": (0.075, 0.30),
    }

    @classmethod
    def calculate_cost(
        cls,
        model_name: str,
        prompt_tokens: int,
        completion_tokens: int,
    ) -> Optional[float]:

        """
        Calculate estimated standard token cost in USD.

        Returns None when model pricing is unknown.
        """

        if prompt_tokens < 0 or completion_tokens < 0:
            raise ValueError("Token counts cannot be negative.")

        pricing = cls.PRICING_TABLE.get(model_name)

        if pricing is None:
            return None

        input_rate, output_rate = pricing

        input_cost = (
            prompt_tokens / 1_000_000
        ) * input_rate

        output_cost = (
            completion_tokens / 1_000_000
        ) * output_rate

        total_cost = input_cost + output_cost

        return round(total_cost, 8)