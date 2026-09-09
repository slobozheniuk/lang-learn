"""add_ilya_frank_data_to_lessons

Revision ID: c3d4e5f6a7b8
Revises: a1b2c3d4e5f6
Create Date: 2026-09-09 11:36:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = '1c2d89987821'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    lesson_cols = [c['name'] for c in inspector.get_columns('lessons')]

    if 'ilya_frank_data' not in lesson_cols:
        with op.batch_alter_table('lessons', schema=None) as batch_op:
            batch_op.add_column(sa.Column('ilya_frank_data', sa.Text(), nullable=True))


def downgrade() -> None:
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    lesson_cols = [c['name'] for c in inspector.get_columns('lessons')]

    if 'ilya_frank_data' in lesson_cols:
        with op.batch_alter_table('lessons', schema=None) as batch_op:
            batch_op.drop_column('ilya_frank_data')
