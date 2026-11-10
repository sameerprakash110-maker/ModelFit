import logging
import sys
from app.core.config import get_settings

settings = get_settings()


def setup_logger(name: str = "modelfit") -> logging.Logger:
    """Configure and return a structured logger instance."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        level = logging.DEBUG if settings.DEBUG else logging.INFO
        logger.setLevel(level)

        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)

        formatter = logging.Formatter(
            fmt="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logger()
