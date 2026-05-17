from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import UserOut
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/subscription", tags=["Subscription"])

PLAN_TOKENS = {"free": 10, "pro": 500, "business": 2000}
VALID_PLANS = set(PLAN_TOKENS.keys())
CREDIT_PACKAGES = {50, 200, 500, 1000}


class UpgradePayload(BaseModel):
    plan: str


class PurchasePayload(BaseModel):
    tokens: int


@router.get("/plans")
def get_plans():
    return [
        {"key": "free",     "label": "Free",     "price": 0,     "tokens": 10,   "features": ["10 tokens/month", "Basic commands"]},
        {"key": "pro",      "label": "Pro",       "price": 9.99,  "tokens": 500,  "features": ["500 tokens/month", "Priority AI", "Full history"]},
        {"key": "business", "label": "Business",  "price": 29.99, "tokens": 2000, "features": ["2000 tokens/month", "API access", "Analytics"]},
    ]


@router.post("/upgrade", response_model=UserOut)
def upgrade_plan(
    payload: UpgradePayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.plan not in VALID_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")

    old_plan = user.plan or "free"
    user.credits = PLAN_TOKENS[payload.plan]

    # Grant token difference when upgrading
    new_tokens = PLAN_TOKENS[payload.plan]
    old_tokens = PLAN_TOKENS.get(old_plan, 10)
    if new_tokens > old_tokens:
        user.credits = (user.credits or 0) + (new_tokens - old_tokens)

    db.commit()
    db.refresh(user)
    return user


@router.post("/credits/purchase", response_model=UserOut)
def purchase_credits(
    payload: PurchasePayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.tokens not in CREDIT_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid credit package")

    user.credits = (user.credits or 0) + payload.tokens
    db.commit()
    db.refresh(user)
    return user
