"""TheHive SDK exceptions."""


class TheHiveError(Exception):
    """Base exception for TheHive SDK errors."""
    pass


class AuthenticationError(TheHiveError):
    """Raised when authentication fails or API key is missing."""
    pass


class RateLimitError(TheHiveError):
    """Raised when rate limit is exceeded."""
    pass
