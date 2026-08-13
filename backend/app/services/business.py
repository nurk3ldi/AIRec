from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.images import LOGO_STORE, delete_image, save_image
from app.models.business import Business
from app.models.user import User
from app.repositories.business import BusinessRepository
from app.schemas.business import UpdateBusinessRequest


class BusinessService:
    """The business behind one account, with no knowledge of HTTP."""

    def __init__(self, session: AsyncSession, businesses: BusinessRepository) -> None:
        self._session = session
        self._businesses = businesses

    async def get_or_create(self, user: User) -> Business:
        """The account's business, created empty on first access.

        Created lazily rather than at registration: signing up shouldn't decide
        anything about the company, and this way an account that never opens the
        page carries no half-filled row. Callers can always assume a business
        exists, which keeps every other endpoint free of a "not set up yet" branch.
        """
        business = await self._businesses.get_for_owner(user.id)
        if business is not None:
            return business

        business = Business(owner_id=user.id)
        self._businesses.add(business)
        await self._session.commit()
        return business

    async def update(self, user: User, data: UpdateBusinessRequest) -> Business:
        business = await self.get_or_create(user)

        # `exclude_unset` is what separates "field omitted" from "field set to
        # null" — only keys the client actually sent are touched.
        for field, value in data.model_dump(exclude_unset=True).items():
            if field == "timezone" and value is None:
                continue
            setattr(business, field, value)

        await self._session.commit()
        return business

    async def set_logo(self, user: User, raw: bytes) -> Business:
        business = await self.get_or_create(user)
        filename = await save_image(LOGO_STORE, raw)
        previous = business.logo_filename
        business.logo_filename = filename
        await self._session.commit()
        # Only after the row commits, so a failed write never orphans the
        # business's existing logo.
        await delete_image(LOGO_STORE, previous)
        return business

    async def clear_logo(self, user: User) -> Business:
        business = await self.get_or_create(user)
        previous = business.logo_filename
        business.logo_filename = None
        await self._session.commit()
        await delete_image(LOGO_STORE, previous)
        return business
