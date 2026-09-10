"""
Adversarial Stress Test Suite for UIDAI Masked Aadhaar Vault.
Smart India Hackathon 2026 (SIH26090 - MoSJE)

Stress-tests:
1. All permutations of invalid lengths (0, 1-11, 13-100, malformed whitespace/hyphens)
2. Non-numeric characters (alpha, symbols, punctuation, control chars, null bytes, unicode)
3. Leading 0 or 1 rejection (including mathematically valid Verhoeff numbers with prefix 0 or 1)
4. Corrupt Verhoeff check digits (single-digit substitutions, adjacent transpositions)
5. SQL Injection & XSS payloads
"""

import pytest
import re
from app.services.aadhaar_vault import (
    MaskedAadhaarVault,
    validate_verhoeff,
    compute_verhoeff_check_digit,
    generate_valid_aadhaar,
)


class TestAadhaarVaultLengths:
    """Stress-test invalid and boundary lengths."""

    @pytest.mark.parametrize("invalid_len_str", [
        "",                     # Length 0
        " ",                    # Whitespace only
        "   \t\n  ",            # Multi-whitespace
        "2",                    # Length 1
        "29",                   # Length 2
        "294",                  # Length 3
        "2947",                 # Length 4
        "29471",                # Length 5
        "294715",               # Length 6
        "2947158",              # Length 7
        "29471583",             # Length 8
        "294715830",            # Length 9
        "2947158309",           # Length 10
        "29471583092",          # Length 11 (missing check digit)
        "2947158309271",        # Length 13 (1 extra digit)
        "29471583092712",       # Length 14
        "29471583092712345",    # Length 17
        "2" * 25,               # Length 25
        "2" * 100,              # Length 100
        "2345-6789",            # Formatted but only 8 digits
        "2345 6789 0123 4567",  # Formatted but 16 digits
    ])
    def test_invalid_lengths_rejected(self, invalid_len_str):
        with pytest.raises(ValueError, match="Invalid Aadhaar format: Must be exactly 12 digits"):
            MaskedAadhaarVault.validate_aadhaar_format(invalid_len_str)

    def test_exact_12_length_cleaning(self):
        """Spaces and hyphens in valid 12-digit numbers are cleaned correctly."""
        valid_raw = generate_valid_aadhaar("29471583092")
        # Format with spaces: "2947 1583 0927"
        spaced = f"{valid_raw[:4]} {valid_raw[4:8]} {valid_raw[8:]}"
        cleaned = MaskedAadhaarVault.clean_aadhaar_string(spaced)
        assert len(cleaned) == 12
        res = MaskedAadhaarVault.process_and_mask(spaced)
        assert res.masked_aadhaar == f"XXXXXXXX{valid_raw[-4:]}"

        # Format with hyphens: "2947-1583-0927"
        hyphenated = f"{valid_raw[:4]}-{valid_raw[4:8]}-{valid_raw[8:]}"
        res_hyphen = MaskedAadhaarVault.process_and_mask(hyphenated)
        assert res_hyphen.masked_aadhaar == f"XXXXXXXX{valid_raw[-4:]}"


class TestAadhaarVaultNonNumeric:
    """Stress-test non-numeric characters, symbols, and type violations."""

    @pytest.mark.parametrize("non_numeric_str", [
        "29471583092A",         # Single trailing letter
        "A94715830927",         # Single leading letter
        "2947A5830927",         # Mid-string letter
        "29471583092a",         # Lowercase letter
        "2947ABCD0927",         # Multiple letters
        "abcdefghijkl",         # All letters
        "29471583092!",         # Exclamation
        "2947@5830927",         # At symbol
        "2947#5830927",         # Hash
        "2947$5830927",         # Dollar
        "2947%5830927",         # Percent
        "2947^5830927",         # Caret
        "2947&5830927",         # Ampersand
        "2947*5830927",         # Asterisk
        "2947(5830927",         # Open paren
        "2947)5830927",         # Close paren
        "2947158.0927",         # Decimal point
        "+912947158309",        # Country code prefix
        "+29471583092",         # Leading plus
        "29471583092\x00",      # Null byte
        "\x0029471583092",      # Leading null byte
        "29471583092😀",        # Emoji
        "29471583092👍",        # Emoji
        "29471583092\u200b",    # Zero-width space
        "२९४७१५८३०९२७",         # Devanagari numerals
        "۲۹۴۷۱۵۸۳۰۱۲۳",         # Persian/Arabic numerals
        "২৯৪৭১৫৮৩০৯২৭",         # Bengali numerals
        "２９４７１５８３０９２７",     # Full-width Unicode digits
    ])
    def test_non_numeric_characters_rejected(self, non_numeric_str):
        with pytest.raises(ValueError):
            MaskedAadhaarVault.validate_aadhaar_format(non_numeric_str)

    @pytest.mark.parametrize("invalid_type", [
        None,
        ["294715830927"],
        {"aadhaar": "294715830927"},
    ])
    def test_invalid_types_rejected(self, invalid_type):
        with pytest.raises(ValueError):
            MaskedAadhaarVault.validate_aadhaar_format(invalid_type)


class TestAadhaarVaultLeadingDigits:
    """Stress-test rejection of leading 0 or 1."""

    @pytest.mark.parametrize("leading_zero_str", [
        "012345678901",
        "000000000000",
        "098765432104",
        "055544433322",
    ])
    def test_leading_zero_rejected(self, leading_zero_str):
        with pytest.raises(ValueError, match="cannot start with 0 or 1"):
            MaskedAadhaarVault.validate_aadhaar_format(leading_zero_str)

    @pytest.mark.parametrize("leading_one_str", [
        "123456789012",
        "111111111111",
        "198765432104",
        "155544433322",
    ])
    def test_leading_one_rejected(self, leading_one_str):
        with pytest.raises(ValueError, match="cannot start with 0 or 1"):
            MaskedAadhaarVault.validate_aadhaar_format(leading_one_str)

    def test_mathematically_valid_verhoeff_with_leading_zero_rejected(self):
        """Even if Verhoeff checksum passes, leading 0 must be rejected."""
        prefix_0 = "01234567890"
        check_digit = compute_verhoeff_check_digit(prefix_0)
        full_0 = f"{prefix_0}{check_digit}"
        assert validate_verhoeff(full_0) is True, "Sanity check: Verhoeff checksum is valid"
        with pytest.raises(ValueError, match="cannot start with 0 or 1"):
            MaskedAadhaarVault.validate_aadhaar_format(full_0)

    def test_mathematically_valid_verhoeff_with_leading_one_rejected(self):
        """Even if Verhoeff checksum passes, leading 1 must be rejected."""
        prefix_1 = "12345678901"
        check_digit = compute_verhoeff_check_digit(prefix_1)
        full_1 = f"{prefix_1}{check_digit}"
        assert validate_verhoeff(full_1) is True, "Sanity check: Verhoeff checksum is valid"
        with pytest.raises(ValueError, match="cannot start with 0 or 1"):
            MaskedAadhaarVault.validate_aadhaar_format(full_1)


class TestAadhaarVaultVerhoeffChecksumAdversarial:
    """Adversarial stress-testing of the Verhoeff checksum algorithm."""

    @pytest.fixture
    def valid_aadhaar_samples(self):
        """Generate valid Aadhaar numbers starting with digits 2 through 9."""
        prefixes = [
            "29471583092",
            "38562910471",
            "47192830561",
            "56381920475",
            "65492810372",
            "74829103651",
            "83910294857",
            "92837461052",
        ]
        return [generate_valid_aadhaar(p) for p in prefixes]

    def test_all_single_digit_check_digit_mutations_caught(self, valid_aadhaar_samples):
        """
        For each valid Aadhaar, corrupt the 12th digit to all other 9 possible digits.
        100% of these corruptions must fail Verhoeff checksum validation.
        """
        failures = 0
        total_tests = 0

        for valid in valid_aadhaar_samples:
            original_check = int(valid[-1])
            for corrupt_digit in range(10):
                if corrupt_digit == original_check:
                    continue
                corrupted = f"{valid[:-1]}{corrupt_digit}"
                total_tests += 1
                assert validate_verhoeff(corrupted) is False, (
                    f"Verhoeff failed to detect corrupted check digit: {corrupted}"
                )
                with pytest.raises(ValueError, match="Verhoeff checksum digit validation failed"):
                    MaskedAadhaarVault.validate_aadhaar_format(corrupted)

        assert total_tests == len(valid_aadhaar_samples) * 9

    def test_all_adjacent_transpositions_caught(self, valid_aadhaar_samples):
        """
        The Verhoeff dihedral group D5 algorithm mathematically detects 100% of adjacent transpositions.
        Swap every adjacent pair (i, i+1) for each valid Aadhaar and assert detection.
        """
        total_tests = 0
        for valid in valid_aadhaar_samples:
            chars = list(valid)
            for i in range(len(chars) - 1):
                # If adjacent digits are identical, transposition is identical string
                if chars[i] == chars[i + 1]:
                    continue
                # Swap
                swapped = list(chars)
                swapped[i], swapped[i + 1] = swapped[i + 1], swapped[i]
                swapped_str = "".join(swapped)

                total_tests += 1
                # If leading digit became 0 or 1, format validator catches it as format violation
                if swapped_str[0] in "01":
                    with pytest.raises(ValueError, match="cannot start with 0 or 1"):
                        MaskedAadhaarVault.validate_aadhaar_format(swapped_str)
                else:
                    assert validate_verhoeff(swapped_str) is False, (
                        f"Verhoeff failed to detect adjacent transposition at {i}: {swapped_str}"
                    )
                    with pytest.raises(ValueError, match="Verhoeff checksum digit validation failed"):
                        MaskedAadhaarVault.validate_aadhaar_format(swapped_str)

        assert total_tests > 50

    def test_all_single_digit_substitutions_across_all_positions(self, valid_aadhaar_samples):
        """
        Verhoeff detects 100% of single digit substitution errors across ALL 12 positions.
        """
        sample = valid_aadhaar_samples[0]  # Take first sample
        chars = list(sample)

        for pos in range(len(chars)):
            original_digit = int(chars[pos])
            for new_digit in range(10):
                if new_digit == original_digit:
                    continue
                mutated = list(chars)
                mutated[pos] = str(new_digit)
                mutated_str = "".join(mutated)

                if mutated_str[0] in "01":
                    with pytest.raises(ValueError, match="cannot start with 0 or 1"):
                        MaskedAadhaarVault.validate_aadhaar_format(mutated_str)
                else:
                    assert validate_verhoeff(mutated_str) is False, (
                        f"Failed to detect single substitution at pos {pos}: {mutated_str}"
                    )


class TestAadhaarVaultSQLInjection:
    """Stress-test SQL injection and malicious payloads."""

    @pytest.mark.parametrize("sql_payload", [
        "' OR '1'='1",
        "' OR 1=1 --",
        "admin' --",
        "\" OR \"\" = \"",
        "294715830927' OR '1'='1",
        "294715830927; DROP TABLE artisans; --",
        "294715830927'; DROP TABLE artisans; --",
        "294715830927 UNION SELECT * FROM craft_clusters --",
        "294715830927' UNION SELECT 1,2,3,4,5,6,7,8,9,10,11,12 --",
        "294715830927' AND 1=SLEEP(5) --",
        "294715830927' AND (SELECT * FROM (SELECT(SLEEP(5)))a) --",
        "1; EXEC xp_cmdshell('dir')",
        "'; SHUTDOWN; --",
        "294715830927' OR ''='",
        "294715830927' OR 'x'='x",
        "294715830927\" OR \"1\"=\"1",
        "' OR 'x'='x'; --",
        "294715830927/**/OR/**/1=1",
        "294715830927\x00' OR 1=1",
        "294715830927\\'; DROP TABLE artisans; --",
        "benchmark(10000000,MD5(1))",
        "pg_sleep(5)",
        "WAITFOR DELAY '0:0:5'",
        "{\"$ne\": null}",
        "<script>alert('XSS')</script>",
        "294715830927<script>",
        "294715830927'--",
    ])
    def test_sql_injection_payloads_strictly_rejected(self, sql_payload):
        with pytest.raises(ValueError):
            MaskedAadhaarVault.validate_aadhaar_format(sql_payload)

    def test_sovereign_masking_and_hashing_properties(self):
        """Verify the masking and HMAC hashing security guarantees."""
        valid_raw = generate_valid_aadhaar("29471583092")
        result = MaskedAadhaarVault.process_and_mask(valid_raw)

        # 1. Raw Aadhaar is never in masked string
        assert valid_raw not in result.masked_aadhaar
        # 2. Masked format is exactly XXXXXXXX + last 4 digits
        assert result.masked_aadhaar == f"XXXXXXXX{valid_raw[-4:]}"
        assert len(result.masked_aadhaar) == 12
        # 3. HMAC hash is 64 hex characters (SHA-256)
        assert len(result.aadhaar_hash) == 64
        assert re.match(r"^[0-9a-f]{64}$", result.aadhaar_hash)
        # 4. Deterministic with same pepper
        result2 = MaskedAadhaarVault.process_and_mask(valid_raw)
        assert result.aadhaar_hash == result2.aadhaar_hash
        # 5. Different with different pepper
        result_diff_pepper = MaskedAadhaarVault.process_and_mask(valid_raw, pepper="different_salt")
        assert result.aadhaar_hash != result_diff_pepper.aadhaar_hash
