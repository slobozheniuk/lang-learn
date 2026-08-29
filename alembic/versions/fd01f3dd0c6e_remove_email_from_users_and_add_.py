"""remove_email_from_users_and_add_learning_profiles

Revision ID: fd01f3dd0c6e
Revises: 9a8b7c6d5e4f
Create Date: 2026-08-29 14:26:38.566725

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fd01f3dd0c6e'
down_revision: Union[str, Sequence[str], None] = '9a8b7c6d5e4f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    user_cols = [c['name'] for c in inspector.get_columns('users')]
    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'email' in user_cols:
            try:
                batch_op.drop_index('ix_users_email')
            except Exception:
                pass
            batch_op.drop_column('email')

    tables = inspector.get_table_names()
    if 'learning_profiles' not in tables:
        op.create_table(
            'learning_profiles',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('source_language', sa.String(length=10), server_default='ru', nullable=False),
            sa.Column('target_language', sa.String(length=10), server_default='en', nullable=False),
            sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id', 'source_language', 'target_language', name='uq_user_learning_profile'),
        )
        with op.batch_alter_table('learning_profiles', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_learning_profiles_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('email', sa.String(length=255), nullable=True))
        batch_op.create_index('ix_users_email', ['email'], unique=True)

    op.drop_table('learning_profiles')
