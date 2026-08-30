from fastapi import APIRouter, Depends, HTTPException, Request

from api.contracts import RegisterRequest, LoginRequest, AuthResponse, UserResponse
from application.auth_service import AuthService
from api.dependencies import get_auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(
    payload: RegisterRequest,
    service: AuthService = Depends(get_auth_service),
):
    try:
        result = await service.register(
            name=payload.name,
            email=payload.email,
            password=payload.password,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    service: AuthService = Depends(get_auth_service),
):
    try:
        result = await service.login(
            email=payload.email,
            password=payload.password,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/me", response_model=UserResponse)
async def get_me(
    request: Request,
    service: AuthService = Depends(get_auth_service),
):
    user = request.state.user
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    result = await service.get_user(user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    return result
