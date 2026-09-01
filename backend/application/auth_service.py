import os
from uuid import UUID

from dotenv import load_dotenv
from jose import JWTError, jwt
import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domain.user import User
from infrastructure.db.models import UserModel
from infrastructure.db.session import get_session_factory

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "gethired-dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_IN = "7d"


class AuthService:
    def __init__(self):
        self._get_session_factory = get_session_factory

    async def register(self, name: str, email: str, password: str) -> dict:
        async with self._get_session_factory()() as session:
            async with session.begin():
                existing = await session.execute(
                    select(UserModel).where(UserModel.email == email.lower().strip())
                )
                if existing.scalar_one_or_none():
                    raise ValueError("Email already registered")

                user = UserModel(
                    name=name.strip(),
                    email=email.lower().strip(),
                    password_hash=bcrypt.hashpw(password[:72].encode(), bcrypt.gensalt()).decode(),
                )
                session.add(user)

        token = self._sign_token(user.id, user.email)
        return {
            "token": token,
            "user": {"id": str(user.id), "name": user.name, "email": user.email},
        }

    async def login(self, email: str, password: str) -> dict:
        async with self._get_session_factory()() as session:
            result = await session.execute(
                select(UserModel).where(UserModel.email == email.lower().strip())
            )
            user = result.scalar_one_or_none()

            if not user or not bcrypt.checkpw(password[:72].encode(), user.password_hash.encode()):
                raise ValueError("Invalid credentials")

            token = self._sign_token(user.id, user.email)
            return {
                "token": token,
                "user": {"id": str(user.id), "name": user.name, "email": user.email},
            }

    async def get_user(self, user_id: UUID) -> dict | None:
        async with self._get_session_factory()() as session:
            result = await session.execute(
                select(UserModel).where(UserModel.id == user_id)
            )
            user = result.scalar_one_or_none()
            if not user:
                return None
            return {"id": str(user.id), "name": user.name, "email": user.email}

    def verify_token(self, token: str) -> dict | None:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("sub")
            email = payload.get("email")
            if user_id is None:
                return None
            return {"id": user_id, "email": email}
        except JWTError:
            return None

    async def ensure_user_exists(self, user_id: str, email: str | None = None) -> None:
        async with self._get_session_factory()() as session:
            result = await session.execute(
                select(UserModel).where(UserModel.id == UUID(user_id))
            )
            if result.scalar_one_or_none():
                return
            async with session.begin():
                user = UserModel(
                    id=UUID(user_id),
                    name="Local User",
                    email=email or f"{user_id}@local.dev",
                    password_hash="local-only",
                )
                session.add(user)

    def _sign_token(self, user_id: UUID, email: str) -> str:
        return jwt.encode(
            {"sub": str(user_id), "email": email},
            JWT_SECRET,
            algorithm=JWT_ALGORITHM,
        )
