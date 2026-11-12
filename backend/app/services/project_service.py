from typing import List, Optional
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from app.core.exceptions import EntityNotFoundException
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.utils.logger import logger


class ProjectService:
    """Service layer handling project CRUD operations and business rules."""

    @staticmethod
    def get_projects(
        db: Session,
        user_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Project]:
        """Fetch a paginated list of projects, filtered by owner user_id at SQL level."""
        query = select(Project)
        if user_id:
            query = query.where(or_(Project.owner_id == user_id, Project.owner_id.is_(None)))
        query = query.order_by(Project.created_at.desc()).offset(skip).limit(limit)
        return list(db.scalars(query).all())

    @staticmethod
    def get_project_by_id(db: Session, project_id: str) -> Optional[Project]:
        """Fetch a single project by its primary UUID."""
        query = select(Project).where(Project.id == project_id)
        return db.scalars(query).first()

    @staticmethod
    def get_project_or_404(db: Session, project_id: str) -> Project:
        """Fetch project by ID or raise EntityNotFoundException."""
        project = ProjectService.get_project_by_id(db, project_id)
        if not project:
            raise EntityNotFoundException("Project", project_id)
        return project

    @staticmethod
    def create_project(
        db: Session,
        project_in: ProjectCreate,
        owner_id: Optional[str] = None,
    ) -> Project:
        """Create and persist a new project with persistent database owner_id."""
        project = Project(
            owner_id=owner_id,
            name=project_in.name,
            description=project_in.description,
            business_domain=project_in.business_domain,
            system_prompt=project_in.system_prompt,
            output_schema=project_in.output_schema,
            rubric=project_in.rubric,
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        logger.info(f"Created project: {project.id} ({project.name}) with owner {owner_id}")
        return project

    @staticmethod
    def update_project(
        db: Session, project_id: str, project_in: ProjectUpdate
    ) -> Project:
        """Update an existing project's fields."""
        project = ProjectService.get_project_or_404(db, project_id)

        update_data = project_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(project, field, value)

        db.add(project)
        db.commit()
        db.refresh(project)
        logger.info(f"Updated project: {project.id}")
        return project

    @staticmethod
    def delete_project(db: Session, project_id: str) -> None:
        """Delete a project and cascade delete associated records."""
        project = ProjectService.get_project_or_404(db, project_id)
        db.delete(project)
        db.commit()
        logger.info(f"Deleted project: {project_id}")
