"""add_gender_to_words

Revision ID: f69b6a58988d
Revises: c3d4e5f6a7b8
Create Date: 2026-09-10 13:57:43.026236

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f69b6a58988d'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: add gender column to words table."""
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    word_cols = [c['name'] for c in inspector.get_columns('words')]

    if 'gender' not in word_cols:
        with op.batch_alter_table('words', schema=None) as batch_op:
            batch_op.add_column(sa.Column('gender', sa.String(length=20), nullable=True))


def downgrade() -> None:
    """Downgrade schema: drop gender column from words table."""
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    word_cols = [c['name'] for c in inspector.get_columns('words')]

    if 'gender' in word_cols:
        with op.batch_alter_table('words', schema=None) as batch_op:
            batch_op.drop_column('gender')
