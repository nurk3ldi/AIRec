"""What the model is told about filing a booking request.

Kept out of `app/services`, where the API-message inventory in
`app/core/i18n.py` looks for Russian strings: these are read by the model, never
returned to a person, and have nothing to be translated into.
"""

from __future__ import annotations

from typing import Any

NAME = "request_booking"

DESCRIPTION = (
    "Передать администратору заявку на запись клиента. Вызывай, когда известны "
    "услуга, день, время и имя клиента. Заявка ждёт подтверждения администратора."
)


def parameters(service_names: list[str]) -> dict[str, Any]:
    """The arguments, as the JSON Schema subset every provider accepts. The
    service is an enum of the price list, so the model cannot invent one."""
    service: dict[str, Any] = {
        "type": "string",
        "description": "Название услуги точно как в списке.",
    }
    if service_names:
        service["enum"] = service_names
    return {
        "type": "object",
        "properties": {
            "service": service,
            "date": {"type": "string", "description": "День визита, YYYY-MM-DD."},
            "time": {"type": "string", "description": "Время начала, HH:MM (24 часа)."},
            "client_name": {"type": "string", "description": "Имя клиента."},
            "client_phone": {
                "type": "string",
                "description": "Телефон, если клиент его назвал.",
            },
        },
        "required": ["service", "date", "time", "client_name"],
    }


UNKNOWN_SERVICE = "Такой услуги нет в списке. Уточни у клиента услугу."
BAD_MOMENT = "Дата должна быть YYYY-MM-DD, время — HH:MM."
NO_OWNER = "У бизнеса нет владельца."
