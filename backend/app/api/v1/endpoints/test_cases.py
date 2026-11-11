from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_active_user
from app.core.database import get_db
from app.schemas.auth import UserResponse
from app.schemas.test_case import TestCaseCreate, TestCaseResponse, TestCaseUpdate
from app.services.ownership_service import OwnershipService
from app.services.test_case_service import TestCaseService

router = APIRouter()


@router.post(
    "",
    response_model=TestCaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new test case",
)
def create_test_case(
    test_case_in: TestCaseCreate,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> TestCaseResponse:
    """Create and persist a new evaluation workload / test case, verifying parent project ownership."""
    OwnershipService.verify_project_access(db, test_case_in.project_id, current_user.id)
    return TestCaseService.create_test_case(db, test_case_in)


@router.get(
    "",
    response_model=List[TestCaseResponse],
    summary="List test cases",
)
def list_test_cases(
    project_id: Optional[str] = Query(None, description="Filter test cases by project UUID"),
    skip: int = Query(0, ge=0, description="Pagination skip offset"),
    limit: int = Query(100, ge=1, le=500, description="Max test cases to return"),
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> List[TestCaseResponse]:
    """Retrieve test cases belonging to user-owned projects."""
    if project_id:
        OwnershipService.verify_project_access(db, project_id, current_user.id)
        return TestCaseService.get_test_cases(db, project_id=project_id, skip=skip, limit=limit)

    test_cases = TestCaseService.get_test_cases(db, project_id=None, skip=skip, limit=limit)
    return OwnershipService.filter_test_cases_for_user(db, test_cases, current_user.id)


@router.get(
    "/{test_case_id}",
    response_model=TestCaseResponse,
    summary="Get test case by ID",
)
def get_test_case(
    test_case_id: str,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> TestCaseResponse:
    """Retrieve a specific test case by UUID, verifying parent project ownership."""
    return OwnershipService.verify_test_case_access(db, test_case_id, current_user.id)


@router.put(
    "/{test_case_id}",
    response_model=TestCaseResponse,
    summary="Update test case",
)
def update_test_case(
    test_case_id: str,
    test_case_in: TestCaseUpdate,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> TestCaseResponse:
    """Update an existing test case, verifying parent project ownership."""
    OwnershipService.verify_test_case_access(db, test_case_id, current_user.id)
    return TestCaseService.update_test_case(db, test_case_id, test_case_in)


@router.delete(
    "/{test_case_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete test case",
)
def delete_test_case(
    test_case_id: str,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete a test case by UUID, verifying parent project ownership."""
    OwnershipService.verify_test_case_access(db, test_case_id, current_user.id)
    TestCaseService.delete_test_case(db, test_case_id)
