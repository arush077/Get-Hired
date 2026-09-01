from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request

limiter = Limiter(key_func=get_remote_address)


def _user_key(request: Request) -> str:
    user = getattr(request.state, "user", None)
    return f"user:{user['id']}" if user else get_remote_address(request)
