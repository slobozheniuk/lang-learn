"""add_native_and_target_language_to_users

Revision ID: 9a8b7c6d5e4f
Revises: beed1c2c710f
Create Date: 2026-08-28 07:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a8b7c6d5e4f'
down_revision: Union[str, Sequence[str], None] = 'beed1c2c710f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('native_language', sa.String(length=10), server_default='ru', nullable=False))
        batch_op.add_column(sa.Column('target_language', sa.String(length=10), server_default='en', nullable=False))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('target_language')
        batch_op.drop_column('native_language')
