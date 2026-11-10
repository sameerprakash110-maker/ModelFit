from typing import Dict, Tuple


class CostService:
    """Cost calculation engine tracking token consumption and USD expenses across models."""

    # Model pricing table: (input_cost_per_million_tokens, output_cost_per_million_tokens)
    PRICING_TABLE: Dict[str, Tuple[float, float]] = {
        # Google Gemini 3.x
        "gemini-3.1-flash-lite": (0.075, 0.30),
        "gemini-3.8-flash": (0.15, 0.60),
        "gemini-3.5-flash": (0.15, 0.60),
        # Google Gemini 1.5 & 2.0
        "gemini-2.0-flash-exp": (0.00, 0.00),
        "gemini-1.5-pro": (1.25, 5.00),
        "gemini-1.5-flash": (0.075, 0.30),
        # OpenAI
        "gpt-4o": (2.50, 10.00),
        "gpt-4o-mini": (0.15, 0.60),
        "o1-preview": (15.00, 60.00),
        "o1-mini": (3.00, 12.00),
        # Groq
        "llama-3.3-70b-versatile": (0.59, 0.79),
        "llama-3.1-8b-instant": (0.05, 0.08),
        "mixtral-8x7b-32768": (0.24, 0.24),
    }

    # Default fallback pricing if an unlisted model is evaluated ($1.00 / 1M tokens)
    DEFAULT_INPUT_RATE = 1.00
    DEFAULT_OUTPUT_RATE = 2.00

    @classmethod
    def calculate_cost(
        cls,
        model_name: str,
        prompt_tokens: int,
        completion_tokens: int,
    ) -> float:
        """Calculate execution cost in USD based on input and output token counts.

        Args:
            model_name: Target model identifier.
            prompt_tokens: Number of prompt/input tokens.
            completion_tokens: Number of generated completion tokens.

        Returns:
            Calculated cost in USD (rounded to 6 decimal places).
        """
        input_rate, output_rate = cls.PRICING_TABLE.get(
            model_name,
            (cls.DEFAULT_INPUT_RATE, cls.DEFAULT_OUTPUT_RATE),
        )

        input_cost = (prompt_tokens / 1_000_000.0) * input_rate
        output_cost = (completion_tokens / 1_000_000.0) * output_rate
        total = input_cost + output_cost

        return round(total, 6)
