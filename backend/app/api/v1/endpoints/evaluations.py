from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.exceptions import EntityNotFoundException
from app.schemas.evaluation import (
    EvaluationCreate,
    EvaluationDetailResponse,
    EvaluationResponse,
)
from app.services.evaluation_service import EvaluationService

router = APIRouter()


@router.post(
    "",
    response_model=EvaluationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record an evaluation result",
)
def record_evaluation(
    evaluation_in: EvaluationCreate,
    db: Session = Depends(get_db),
) -> EvaluationResponse:
    """Record an evaluation outcome for a test case execution."""
    return EvaluationService.record_evaluation(db, evaluation_in)


@router.get(
    "/benchmark/{benchmark_id}",
    response_model=List[EvaluationResponse],
    summary="List evaluations for a benchmark",
)
def list_benchmark_evaluations(
    benchmark_id: str,
    db: Session = Depends(get_db),
) -> List[EvaluationResponse]:
    """Retrieve all evaluation records associated with a specific benchmark run."""
    return EvaluationService.get_evaluations_for_benchmark(db, benchmark_id)


@router.get(
    "/{evaluation_id}",
    response_model=EvaluationDetailResponse,
    summary="Get evaluation details with attempts",
)
def get_evaluation(
    evaluation_id: str,
    db: Session = Depends(get_db),
) -> EvaluationDetailResponse:
    """Retrieve an evaluation record along with all individual invocation attempts."""
    evaluation = EvaluationService.get_evaluation_with_attempts(db, evaluation_id)
    if not evaluation:
        raise EntityNotFoundException("Evaluation", evaluation_id)
    return evaluation
