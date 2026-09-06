"""remove_language_columns_from_users

Revision ID: a1b2c3d4e5f6
Revises: fd01f3dd0c6e
Create Date: 2026-09-06 23:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'fd01f3dd0c6e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    user_cols = [c['name'] for c in inspector.get_columns('users')]

    with op.batch_alter_table('users', schema=None) as batch_op:
        for col_name in ['native_language', 'target_language', 'default_source_lang', 'default_target_lang']:
            if col_name in user_cols:
                try:
                    batch_op.drop_column(col_name)
                except Exception:
                    pass


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('native_language', sa.String(10), server_default='ru', nullable=False))
        batch_op.add_column(sa.Column('target_language', sa.String(10), server_default='en', nullable=False))
        batch_op.add_column(sa.Column('default_source_lang', sa.String(10), server_default='ru', nullable=False))
        batch_op.add_column(sa.Column('default_target_lang', sa.String(10), server_default='en', nullable=False))
