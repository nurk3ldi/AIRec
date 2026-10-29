"""корзина: убранный разговор, который ещё можно вернуть

**Отметка времени, а не удаление строки.** `DELETE /conversations/{id}` был
единственным способом убрать переписку с глаз, и он уносил её вместе со всеми
сообщениями — необратимо, и потому им никто не пользовался. Корзина — это то
же, чем для записи служит `appointments.archived_at`: строка на месте, из
списков ушла, вернуть — одно нажатие.

**Почему отдельная колонка, а не `archived_at`.** Архив — «я с этим разобрался»,
и он часть истории; корзина — «этого здесь быть не должно», и она из истории
убрана. Один столбец на два разных ответа означал бы, что разобранная переписка
и ошибочная лежат в одном ящике.

Nullable, и NULL — единственное значение, которое может означать «никогда не
убирали».

Revision ID: 0028
Revises: 0027
Create Date: 2026-09-12 12:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0028"
down_revision: str | None = "0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("conversations", "deleted_at")
