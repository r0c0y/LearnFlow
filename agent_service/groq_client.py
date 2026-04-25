import os
from openai import OpenAI
from groq import Groq
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../.env"))

HEAVY_MODEL = "llama-3.3-70b-versatile"
FAST_MODEL  = "llama-3.1-8b-instant"
LONG_MODEL  = "llama-4-scout-17b-16e-instruct"
VOICE_MODEL = "whisper-large-v3"

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)

groq_sdk = Groq(api_key=os.getenv("GROQ_API_KEY"))


def call_llm(
    model_override,
    system_prompt,
    user_prompt,
    max_tokens=2000,
    json_mode=True,
):
    kwargs = {
        "model": model_override,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    try:
        response = client.chat.completions.create(**kwargs)
        return response.choices[0].message.content
    except Exception as e:
        error_str = str(e)
        # On rate limit (429), fall back to a smaller/faster model
        if "429" in error_str or "rate_limit" in error_str.lower():
            fallback = FAST_MODEL if model_override != FAST_MODEL else LONG_MODEL
            print(f"Rate limited on {model_override}, falling back to {fallback}")
            try:
                kwargs["model"] = fallback
                response = client.chat.completions.create(**kwargs)
                return response.choices[0].message.content
            except Exception as e2:
                print(f"Fallback model {fallback} also failed: {e2}")
                raise e2
        print(f"Error calling LLM on {model_override}: {e}")
        raise e


def choose_model(text: str) -> str:
    """Automatically pick model based on content length."""
    word_count = len(text.split())
    if word_count > 30000:
        return LONG_MODEL
    return HEAVY_MODEL
