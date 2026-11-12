"""Manual, one-request live smoke test for Gemini or Groq."""

import argparse
import asyncio
import math
from typing import Any, Dict, Optional

from app.providers import get_provider
from app.services.cost_service import CostService


PROMPT = "Reply with the word READY and nothing else."
MAX_OUTPUT_TOKENS = 32
API_KEY_ENV_VARS = {
    "gemini": "GEMINI_API_KEY",
    "groq": "GROQ_API_KEY",
}


def _usage_is_available(provider_name: str, metadata: Dict[str, Any]) -> bool:
    """Require both input and output usage values before claiming verification."""
    if provider_name == "gemini":
        usage = metadata.get("usage_metadata")
        required = ("promptTokenCount", "candidatesTokenCount")
    else:
        usage = metadata.get("usage")
        required = ("prompt_tokens", "completion_tokens")

    return (
        isinstance(usage, dict)
        and all(key in usage and usage[key] is not None for key in required)
    )


async def run_smoke_test(provider_name: str) -> int:
    provider = get_provider(provider_name)
    model = provider.default_model

    print(f"Provider: {provider.display_name}")
    print(f"Model: {model}")

    if not provider.is_configured():
        print(
            f"API key is not configured. Set {API_KEY_ENV_VARS[provider_name]} "
            "in the process environment or backend .env file."
        )
        return 2

    try:
        result = await provider.generate(
            prompt=PROMPT,
            model=model,
            mock=False,
            max_tokens=MAX_OUTPUT_TOKENS,
        )
    except Exception as exc:
        status_code: Optional[int] = getattr(
            getattr(exc, "response", None), "status_code", None
        )
        status_text = f", HTTP {status_code}" if status_code is not None else ""
        # Avoid printing exception text because HTTP libraries may include
        # request or response details that should not be copied into logs.
        print(f"API request failed ({type(exc).__name__}{status_text}); details suppressed.")
        print("Response: unavailable")
        print("Input tokens: unavailable")
        print("Output tokens: unavailable")
        print("Thinking tokens: unavailable")
        print("Total billable tokens: unavailable")
        print("Calculated cost: unavailable")
        print("Response latency: unavailable")
        return 1

    metadata = result.raw_metadata if isinstance(result.raw_metadata, dict) else {}
    usage_available = _usage_is_available(provider_name, metadata)

    if usage_available:
        input_tokens = result.prompt_tokens
        billable_output_tokens = result.completion_tokens
        total_billable_tokens = input_tokens + billable_output_tokens
        input_display = str(input_tokens)
        total_display = str(total_billable_tokens)
    else:
        input_tokens = result.prompt_tokens
        billable_output_tokens = result.completion_tokens
        total_billable_tokens = None
        input_display = "unavailable (usage metadata missing or incomplete)"
        total_display = "unavailable (usage metadata missing or incomplete)"

    if provider_name == "gemini":
        visible_output = metadata.get("visible_completion_tokens")
        thinking_tokens = metadata.get("thinking_tokens")
        output_display = (
            str(visible_output)
            if usage_available and visible_output is not None
            else "unavailable (usage metadata missing or incomplete)"
        )
        if usage_available and thinking_tokens is not None:
            usage = metadata.get("usage_metadata", {})
            if "thoughtsTokenCount" in usage:
                thinking_display = str(thinking_tokens)
            else:
                thinking_display = "0 (not separately reported)"
        else:
            thinking_display = "unavailable"
    else:
        output_display = (
            str(billable_output_tokens)
            if usage_available
            else "unavailable (usage metadata missing or incomplete)"
        )
        thinking_display = "not reported by this provider response"

    expected_cost = CostService.calculate_cost(
        model,
        input_tokens,
        billable_output_tokens,
    )
    reported_cost = result.cost_usd

    print(f"Response: {result.content}")
    print(f"Input tokens: {input_display}")
    print(f"Output tokens (visible): {output_display}")
    print(f"Thinking tokens: {thinking_display}")
    print(f"Total billable tokens: {total_display}")
    print(f"Provider-calculated cost: ${reported_cost:.8f}")

    if expected_cost is None:
        print("CostService expected cost: unavailable (model has no configured price)")
        print("Cost comparison: unavailable")
    else:
        print(f"CostService expected cost: ${expected_cost:.8f}")
        if usage_available:
            matches = math.isclose(
                reported_cost,
                expected_cost,
                rel_tol=0.0,
                abs_tol=1e-8,
            )
            print(f"Cost comparison: {'MATCH' if matches else 'MISMATCH'}")
        else:
            print("Cost comparison: not verified (usage metadata missing or incomplete)")

    print(f"Response latency: {result.latency_ms:.2f} ms")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Make one small live generation request to Gemini or Groq."
    )
    parser.add_argument(
        "--provider",
        required=True,
        choices=tuple(API_KEY_ENV_VARS),
        help="Provider to test.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    return asyncio.run(run_smoke_test(args.provider))


if __name__ == "__main__":
    raise SystemExit(main())
