import re
import json
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger("artisan_platform.json_utils")


def extract_first_valid_json(text: str) -> Optional[Dict[str, Any]]:
    """
    Extracts the first valid JSON object from LLM response text without greedy span corruption.
    Prevents errors caused by trailing commentary or multiple {...} blocks.
    
    Handles:
    - Markdown code fences (```json ... ```)
    - Depth-balanced brace parser that finds the exact valid JSON object
    - Escaped characters and strings inside JSON
    - Trailing commentary or nested notes
    """
    if not text:
        return None

    # 1. Try markdown code block if present
    code_block_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if code_block_match:
        candidate = code_block_match.group(1).strip()
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

    # 2. Balanced brace scanner: Find outermost valid JSON object starting from '{'
    start_idx = 0
    text_len = len(text)
    while start_idx < text_len:
        open_pos = text.find("{", start_idx)
        if open_pos == -1:
            break

        depth = 0
        in_string = False
        escape = False
        close_pos = -1

        for i in range(open_pos, text_len):
            c = text[i]
            if escape:
                escape = False
                continue
            if c == "\\":
                escape = True
                continue
            if c == '"':
                in_string = not in_string
                continue
            if in_string:
                continue

            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    close_pos = i
                    break

        if close_pos != -1:
            candidate = text[open_pos:close_pos + 1].strip()
            try:
                parsed = json.loads(candidate)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass

        start_idx = open_pos + 1

    # 3. Fallback: try raw json.loads on entire text
    try:
        parsed = json.loads(text.strip())
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    return None
