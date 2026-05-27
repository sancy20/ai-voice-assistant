from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import UserOut
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/subscription", tags=["Subscription"])

PLAN_TOKENS = {"free": 10, "pro": 500, "business": 2000}
PLAN_PRICES = { "free": 0.00, "pro": 9.99, "business": 29.99, }
VALID_PLANS = set(PLAN_TOKENS.keys())
CREDIT_PACKAGES = { 50: 0.99, 200: 2.99, 500: 5.99, 1000: 9.99, }


class UpgradePayload(BaseModel):
    plan: str


class PurchasePayload(BaseModel):
    tokens: int

class MockCheckoutPayload(BaseModel):
    purchase_type: str  # "plan" or "tokens"
    plan: str | None = None
    tokens: int | None = None


class MockPaymentConfirmPayload(MockCheckoutPayload):
    method: str = "card"
    reference: str | None = None
    card_last4: str | None = None

def apply_plan(user: User, plan: str):
    if plan not in VALID_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")

    if user.role == "admin":
        user.plan = "unlimited"
        user.credits = 999999
        return
    
    user.plan = plan
    user.credits = PLAN_TOKENS[plan]


def apply_token_purchase(user: User, tokens: int):
    if tokens not in CREDIT_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid token package")
    
    if user.role == "admin":
        user.plan = "unlimited"
        user.credits = 999999
        return

    user.credits = (user.credits or 0) + tokens


def validate_checkout(payload: MockCheckoutPayload):
    if payload.purchase_type == "plan":
        if payload.plan not in VALID_PLANS or payload.plan == "free":
            raise HTTPException(status_code=400, detail="Invalid paid plan")

        return {
            "purchase_type": "plan",
            "plan": payload.plan,
            "tokens": PLAN_TOKENS[payload.plan],
            "amount": PLAN_PRICES[payload.plan],
            "currency": "USD",
            "description": f"{payload.plan.title()} monthly plan",
        }

    if payload.purchase_type == "tokens":
        if payload.tokens not in CREDIT_PACKAGES:
            raise HTTPException(status_code=400, detail="Invalid token package")

        return {
            "purchase_type": "tokens",
            "tokens": payload.tokens,
            "amount": CREDIT_PACKAGES[payload.tokens],
            "currency": "USD",
            "description": f"{payload.tokens} one-time tokens",
        }

    raise HTTPException(status_code=400, detail="Invalid purchase type")


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

    if payload.plan != "free":
        raise HTTPException(
            status_code=402,
            detail="Paid plans require mock payment confirmation.",
        )

    apply_plan(user, payload.plan)
    db.commit()
    db.refresh(user)
    return user


@router.post("/credits/purchase", response_model=UserOut)
def purchase_credits(
    payload: PurchasePayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    raise HTTPException(
        status_code=402,
        detail="Token purchases require mock payment confirmation.",
    )

@router.post("/mock-checkout")
def create_mock_checkout(
    payload: MockCheckoutPayload,
    user: User = Depends(get_current_user),
):
    summary = validate_checkout(payload)

    return {
        **summary,
        "checkout_id": f"mock_{uuid4().hex[:12]}",
        "customer": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
        },
        "sandbox": True,
        "status": "requires_confirmation",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "message": "Mock checkout created. No real money is charged.",
    }


@router.post("/mock-payment/confirm", response_model=UserOut)
def confirm_mock_payment(
    payload: MockPaymentConfirmPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    
    if user.role == "admin":
        user.plan = "unlimited"
        user.credits = 999999
        db.commit()
        db.refresh(user)
        return user

    validate_checkout(payload)

    if payload.purchase_type == "plan":
        apply_plan(user, payload.plan)

    elif payload.purchase_type == "tokens":
        apply_token_purchase(user, payload.tokens)

    else:
        raise HTTPException(status_code=400, detail="Invalid purchase type")

    db.commit()
    db.refresh(user)
    return user

@router.post("/cancel", response_model=UserOut)
def cancel_subscription(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    
    if user.role == "admin":
        user.plan = "unlimited"
        user.credits = 999999
        db.commit()
        db.refresh(user)
        return user

    user.plan = "free"
    user.credits = 10

    db.commit()
    db.refresh(user)
    return user