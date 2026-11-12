from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_active_user
from app.core.database import get_db
from app.schemas.auth import UserResponse
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services.ownership_service import OwnershipService
from app.services.project_service import ProjectService

router = APIRouter()


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project",
)
def create_project(
    project_in: ProjectCreate,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Create and persist a new benchmarking project owned by the authenticated user."""
    project = ProjectService.create_project(db, project_in, owner_id=current_user.id)
    OwnershipService.record_project_owner(project.id, current_user.id)
    return project


@router.get(
    "",
    response_model=List[ProjectResponse],
    summary="List all projects",
)
def list_projects(
    skip: int = Query(0, ge=0, description="Pagination skip offset"),
    limit: int = Query(100, ge=1, le=500, description="Max projects to return"),
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> List[ProjectResponse]:
    """Retrieve all benchmarking projects owned by the authenticated user."""
    projects = ProjectService.get_projects(db, skip=skip, limit=limit)
    return OwnershipService.filter_projects_for_user(projects, current_user.id)


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Get project by ID",
)
def get_project(
    project_id: str,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Retrieve details for a specific project by UUID, verifying ownership."""
    return OwnershipService.verify_project_access(db, project_id, current_user.id)


@router.put(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Update project",
)
def update_project(
    project_id: str,
    project_in: ProjectUpdate,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Update metadata for an existing project owned by the authenticated user."""
    OwnershipService.verify_project_access(db, project_id, current_user.id)
    return ProjectService.update_project(db, project_id, project_in)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete project",
)
def delete_project(
    project_id: str,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete a project and its associated benchmarks and test cases, verifying ownership."""
    OwnershipService.verify_project_access(db, project_id, current_user.id)
    ProjectService.delete_project(db, project_id)
