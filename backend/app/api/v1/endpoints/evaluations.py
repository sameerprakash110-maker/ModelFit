from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_active_user
from app.core.database import get_db
from app.schemas.auth import UserResponse
from app.schemas.evaluation import (
    EvaluationCreate,
    EvaluationDetailResponse,
    EvaluationResponse,
)
from app.services.evaluation_service import EvaluationService
from app.services.ownership_service import OwnershipService

router = APIRouter()


@router.post(
    "",
    response_model=EvaluationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record an evaluation result",
)
def record_evaluation(
    evaluation_in: EvaluationCreate,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> EvaluationResponse:
    """Record an evaluation outcome for a test case execution, verifying parent benchmark ownership."""
    OwnershipService.verify_benchmark_access(db, evaluation_in.benchmark_id, current_user.id)
    return EvaluationService.record_evaluation(db, evaluation_in)


@router.get(
    "/benchmark/{benchmark_id}",
    response_model=List[EvaluationResponse],
    summary="List evaluations for a benchmark",
)
def list_benchmark_evaluations(
    benchmark_id: str,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> List[EvaluationResponse]:
    """Retrieve all evaluation records associated with a specific benchmark run, verifying ownership."""
    OwnershipService.verify_benchmark_access(db, benchmark_id, current_user.id)
    return EvaluationService.get_evaluations_for_benchmark(db, benchmark_id)


@router.get(
    "/{evaluation_id}",
    response_model=EvaluationDetailResponse,
    summary="Get evaluation details with attempts",
)
def get_evaluation(
    evaluation_id: str,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> EvaluationDetailResponse:
    """Retrieve an evaluation record along with all individual invocation attempts, verifying ownership."""
    OwnershipService.verify_evaluation_access(db, evaluation_id, current_user.id)
    return EvaluationService.get_evaluation_with_attempts(db, evaluation_id)
