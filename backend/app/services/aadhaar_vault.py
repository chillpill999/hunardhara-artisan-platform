import re
import hmac
import hashlib
from typing import Optional, NamedTuple
from app.core.config import settings

# Verhoeff Algorithm Tables for UIDAI Aadhaar Validation
VERHOEFF_D = (
    (0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
    (1, 2, 3, 4, 0, 6, 7, 8, 9, 5),
    (2, 3, 4, 0, 1, 7, 8, 9, 5, 6),
    (3, 4, 0, 1, 2, 8, 9, 5, 6, 7),
    (4, 0, 1, 2, 3, 9, 5, 6, 7, 8),
    (5, 9, 8, 7, 6, 0, 4, 3, 2, 1),
    (6, 5, 9, 8, 7, 1, 0, 4, 3, 2),
    (7, 6, 5, 9, 8, 2, 1, 0, 4, 3),
    (8, 7, 6, 5, 9, 3, 2, 1, 0, 4),
    (9, 8, 7, 6, 5, 4, 3, 2, 1, 0),
)

VERHOEFF_P = (
    (0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
    (1, 5, 7, 6, 2, 8, 3, 0, 9, 4),
    (5, 8, 0, 3, 7, 9, 6, 1, 4, 2),
    (8, 9, 1, 6, 0, 4, 3, 5, 2, 7),
    (9, 4, 5, 3, 1, 2, 6, 8, 7, 0),
    (4, 2, 8, 6, 5, 7, 3, 9, 0, 1),
    (2, 7, 9, 3, 8, 0, 6, 4, 1, 5),
    (7, 0, 4, 6, 9, 1, 3, 2, 5, 8),
)

VERHOEFF_INV = (0, 4, 3, 2, 1, 5, 6, 7, 8, 9)


class AadhaarVaultResult(NamedTuple):
    masked_aadhaar: str
    aadhaar_hash: str
    last_four: str


def validate_verhoeff(number_str: str) -> bool:
    """
    Validates a number string using the Verhoeff algorithm.
    """
    if not number_str or not number_str.isdigit():
        return False
    c = 0
    inverted = list(map(int, reversed(number_str)))
    for i, digit in enumerate(inverted):
        c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digit]]
    return c == 0


def compute_verhoeff_check_digit(number_str: str) -> int:
    """
    Computes the Verhoeff checksum digit for a given number string.
    """
    c = 0
    inverted = list(map(int, reversed(number_str)))
    for i, digit in enumerate(inverted):
        c = VERHOEFF_D[c][VERHOEFF_P[(i + 1) % 8][digit]]
    return VERHOEFF_INV[c]


def generate_valid_aadhaar(prefix_11_digits: Optional[str] = None) -> str:
    """
    Generates a valid 12-digit Aadhaar number that starts with 2-9 and satisfies Verhoeff check.
    Useful for generating seed data and automated test fixtures.
    """
    if prefix_11_digits is None:
        prefix_11_digits = "29471583092"
    else:
        prefix_11_digits = str(prefix_11_digits)[:11]
        if prefix_11_digits[0] not in "23456789":
            prefix_11_digits = "2" + prefix_11_digits[1:]
    
    check_digit = compute_verhoeff_check_digit(prefix_11_digits)
    aadhaar = f"{prefix_11_digits}{check_digit}"
    assert validate_verhoeff(aadhaar), "Verhoeff self-check failed in generator"
    return aadhaar


class MaskedAadhaarVault:
    """
    UIDAI & DPDP Act 2023 Compliant Masked Aadhaar Vault.
    Strict Sovereign Rules:
    1. NEVER store raw 12-digit Aadhaar number in application logs or persistence layers.
    2. Enforce Verhoeff check algorithm and format validation (12 digits, starts with 2-9).
    3. Store ONLY masked Aadhaar: 'XXXXXXXX' + last 4 digits.
    4. Provide deduplication and KYC match lookup via salted HMAC-SHA256 hash using master pepper.
    """

    @staticmethod
    def clean_aadhaar_string(raw: str) -> str:
        return re.sub(r"[\s\-]+", "", str(raw).strip())

    @classmethod
    def validate_aadhaar_format(cls, raw: str) -> str:
        clean = cls.clean_aadhaar_string(raw)
        if not re.match(r"^[2-9]\d{11}$", clean):
            raise ValueError("Invalid Aadhaar format: Must be exactly 12 digits and cannot start with 0 or 1.")
        if not validate_verhoeff(clean):
            raise ValueError("Invalid Aadhaar: Verhoeff checksum digit validation failed.")
        return clean

    @classmethod
    def process_and_mask(cls, raw_aadhaar: str, pepper: Optional[str] = None) -> AadhaarVaultResult:
        clean = cls.validate_aadhaar_format(raw_aadhaar)
        last_four = clean[-4:]
        masked = f"XXXXXXXX{last_four}"
        
        pepper_key = (pepper or settings.AADHAAR_PEPPER_KEY).encode("utf-8")
        aadhaar_hash = hmac.new(pepper_key, clean.encode("utf-8"), hashlib.sha256).hexdigest()
        
        return AadhaarVaultResult(
            masked_aadhaar=masked,
            aadhaar_hash=aadhaar_hash,
            last_four=last_four
        )
