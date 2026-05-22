"""Shared SlowAPI Limiter instance.

Lives in its own module so any router can decorate endpoints with
``@limiter.limit("…/minute")`` without circular-importing main.py.

main.py is still responsible for binding the instance to the FastAPI
app (``app.state.limiter = limiter``) and registering the
``RateLimitExceeded`` exception handler — those are app-level concerns
that don't belong in a generic shared module.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address


limiter = Limiter(key_func=get_remote_address)
