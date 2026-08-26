"""Translating the messages this API returns.

**Russian is the source language, and it lives in the code.** An `AppError`
carries its Russian text, a `field_validator` raises Russian prose, and both
read the way they were written. The dictionaries below are keyed by that
Russian string and hold only the other two languages — so a message with no
entry falls through to Russian rather than to a key or an empty string, which
is the same rule `frontend/src/lib/i18n.js` follows and the same reason: the
product is sold in Kazakhstan, where Russian is readable to every owner
whichever language they prefer.

Keying a catalogue by its source text is what gettext does, and it has the
failure mode gettext has: **edit the Russian and its translations stop
matching, silently.** `python -m app.core.i18n` reports every source string
with no `kk`/`en` entry — run it after touching any message.

Two messages take a parameter. They are `str.format` templates, and the
placeholder has to survive translation intact; the check below verifies that.
"""

from __future__ import annotations

DEFAULT_LANGUAGE = "ru"
SUPPORTED_LANGUAGES = ("ru", "kk", "en")

# Keyed by the Russian source string. Russian itself is absent on purpose — it
# is what `translate` returns when a lookup misses, so listing it would be the
# same text in two places, free to disagree.
MESSAGES: dict[str, dict[str, str]] = {
    "kk": {
        # --- app/core/errors.py -------------------------------------------
        "Не удалось обработать запрос.": "Сұрауды өңдеу мүмкін болмады.",
        "Этот email уже зарегистрирован.": "Бұл email тіркелген.",
        "Этот логин уже занят.": "Бұл логин бос емес.",
        "Неверный логин или пароль.": "Логин немесе құпиясөз қате.",
        "Сессия недействительна или истекла. Войдите заново.": (
            "Сеанс жарамсыз немесе мерзімі өткен. Қайта кіріңіз."
        ),
        "Аккаунт отключён.": "Аккаунт өшірілген.",
        "Аккаунт удалён.": "Аккаунт жойылды.",
        "Аккаунт удалён. Восстановить можно до {date}.": (
            "Аккаунт жойылды. {date} дейін қалпына келтіруге болады."
        ),
        "Требуется вход в систему.": "Жүйеге кіру қажет.",
        "Код неверный или истёк.": "Код қате немесе мерзімі өткен.",
        "Неверный текущий пароль.": "Ағымдағы құпиясөз қате.",
        "Нет запроса на смену email.": "Email ауыстыруға сұрау жоқ.",
        "Это ваш текущий email.": "Бұл сіздің қазіргі email-іңіз.",
        "Введите ваше имя пользователя, чтобы подтвердить удаление.": (
            "Жоюды растау үшін пайдаланушы атыңызды жазыңыз."
        ),
        "Сеанс не найден или уже завершён.": "Сеанс табылмады немесе аяқталған.",
        "Файл не является изображением.": "Файл сурет емес.",
        "Услуга не найдена.": "Қызмет табылмады.",
        "Услуга отключена и недоступна для записи.": (
            "Қызмет өшірілген, оған жазылу мүмкін емес."
        ),
        "Запись не найдена.": "Жазба табылмады.",
        "В это время бизнес не работает.": "Бұл уақытта бизнес жұмыс істемейді.",
        "Это время уже занято.": "Бұл уақыт бос емес.",
        "Слишком мало времени до начала записи.": (
            "Жазба басталуына тым аз уақыт қалды."
        ),
        "Так далеко записаться нельзя.": "Соншама алысқа жазылуға болмайды.",
        "Этот email не зарегистрирован.": "Бұл email тіркелмеген.",
        # --- app/core/images.py -------------------------------------------
        "Загруженный файл пуст.": "Жүктелген файл бос.",
        "Изображение должно быть меньше {size} МБ.": (
            "Сурет {size} МБ-тан кіші болуы керек."
        ),
        # --- app/main.py: Pydantic built-ins and the envelope --------------
        "Обязательное поле.": "Міндетті өріс.",
        "Ожидается текст.": "Мәтін күтіледі.",
        "Слишком короткое значение.": "Мән тым қысқа.",
        "Слишком длинное значение.": "Мән тым ұзын.",
        "Некорректный формат запроса.": "Сұрау форматы қате.",
        "Некорректный email.": "Email дұрыс емес.",
        "Некоторые поля заполнены неверно.": "Кейбір өрістер қате толтырылған.",
        "Что-то пошло не так.": "Бірдеңе дұрыс болмады.",
        # --- app/schemas/auth.py ------------------------------------------
        "Пароль должен быть от 8 до 128 символов.": (
            "Құпиясөз 8-ден 128 таңбаға дейін болуы керек."
        ),
        "Пароль может содержать только латинские буквы, цифры и символы.": (
            "Құпиясөзде тек латын әріптері, сандар және таңбалар болады."
        ),
        "Логин: только латинские буквы, цифры, _ . и -": (
            "Логин: тек латын әріптері, сандар, _ . және -"
        ),
        "Код состоит из 6 цифр.": "Код 6 саннан тұрады.",
        "Укажите текущий пароль или код из письма — что-то одно.": (
            "Ағымдағы құпиясөзді немесе хаттағы кодты көрсетіңіз — біреуін ғана."
        ),
        "Введите логин или email.": "Логин немесе email енгізіңіз.",
        # --- app/schemas/appointment.py -----------------------------------
        "Укажите время вместе с часовым поясом.": (
            "Уақытты сағаттық белдеумен бірге көрсетіңіз."
        ),
        "Время должно быть кратно 15 минутам.": "Уақыт 15 минутқа еселік болуы керек.",
        "Укажите имя клиента.": "Клиенттің атын көрсетіңіз.",
        "Укажите услугу.": "Қызметті көрсетіңіз.",
        "Укажите цену.": "Бағаны көрсетіңіз.",
        "Неизвестный цвет.": "Белгісіз түс.",
        # --- app/schemas/conversation.py ----------------------------------
        "Укажите номер телефона.": "Телефон нөмірін көрсетіңіз.",
        "Номер телефона должен содержать цифры.": (
            "Телефон нөмірінде сан болуы керек."
        ),
        "Введите текст сообщения.": "Хабарлама мәтінін жазыңыз.",
        "Сообщение клиента приходит из канала.": (
            "Клиенттің хабарламасы арнадан келеді."
        ),
        # --- app/core/errors.py -------------------------------------------
        "Диалог не найден.": "Диалог табылмады.",
        "Сообщение не найдено.": "Хабарлама табылмады.",
        # --- app/schemas/business.py --------------------------------------
        "Укажите часовой пояс.": "Сағаттық белдеуді көрсетіңіз.",
        "Неизвестный часовой пояс.": "Белгісіз сағаттық белдеу.",
        "Нужно принимать хотя бы одного клиента.": (
            "Кем дегенде бір клиент қабылдау керек."
        ),
        "Не больше 100 одновременно.": "Бір мезгілде 100-ден аспауы керек.",
        "Записываться можно хотя бы на сегодня.": (
            "Кем дегенде бүгінге жазылуға болуы керек."
        ),
        "Не больше 365 дней.": "365 күннен аспауы керек.",
        "Значение не может быть отрицательным.": "Мән теріс бола алмайды.",
        "Не больше 7 дней.": "7 күннен аспауы керек.",
        # --- app/schemas/service.py ---------------------------------------
        "Укажите название услуги.": "Қызметтің атауын көрсетіңіз.",
        "Укажите длительность.": "Ұзақтығын көрсетіңіз.",
        "Не больше 24 часов.": "24 сағаттан аспауы керек.",
        "Длительность должна быть кратна 15 минутам.": (
            "Ұзақтық 15 минутқа еселік болуы керек."
        ),
        "Цена не может быть отрицательной.": "Баға теріс бола алмайды.",
        "Слишком большая цена.": "Баға тым үлкен.",
        "Укажите начало и конец рабочего дня.": (
            "Жұмыс күнінің басы мен соңын көрсетіңіз."
        ),
        "Конец рабочего дня должен быть позже начала.": (
            "Жұмыс күнінің соңы басынан кейін болуы керек."
        ),
        "Укажите начало и конец перерыва.": "Үзілістің басы мен соңын көрсетіңіз.",
        "Конец перерыва должен быть позже начала.": (
            "Үзілістің соңы басынан кейін болуы керек."
        ),
        "Перерыв должен быть внутри рабочего дня.": (
            "Үзіліс жұмыс күнінің ішінде болуы керек."
        ),
    },
    "en": {
        # --- app/core/errors.py -------------------------------------------
        "Не удалось обработать запрос.": "Could not process the request.",
        "Этот email уже зарегистрирован.": "That email is already registered.",
        "Этот логин уже занят.": "That username is taken.",
        "Неверный логин или пароль.": "Wrong username or password.",
        "Сессия недействительна или истекла. Войдите заново.": (
            "Your session is invalid or has expired. Please log in again."
        ),
        "Аккаунт отключён.": "This account is disabled.",
        "Аккаунт удалён.": "This account has been deleted.",
        "Аккаунт удалён. Восстановить можно до {date}.": (
            "This account has been deleted. You can restore it until {date}."
        ),
        "Требуется вход в систему.": "You need to be logged in.",
        "Код неверный или истёк.": "That code is wrong or has expired.",
        "Неверный текущий пароль.": "That current password is wrong.",
        "Нет запроса на смену email.": "There is no pending email change.",
        "Это ваш текущий email.": "That is already your email.",
        "Введите ваше имя пользователя, чтобы подтвердить удаление.": (
            "Type your username to confirm the deletion."
        ),
        "Сеанс не найден или уже завершён.": (
            "That session was not found, or has already ended."
        ),
        "Файл не является изображением.": "That file is not an image.",
        "Услуга не найдена.": "Service not found.",
        "Услуга отключена и недоступна для записи.": (
            "That service is switched off and cannot be booked."
        ),
        "Запись не найдена.": "Booking not found.",
        "В это время бизнес не работает.": "The business is closed at that time.",
        "Это время уже занято.": "That time is already taken.",
        "Слишком мало времени до начала записи.": (
            "That is too soon before the booking starts."
        ),
        "Так далеко записаться нельзя.": "That is too far ahead to book.",
        "Этот email не зарегистрирован.": "That email is not registered.",
        # --- app/core/images.py -------------------------------------------
        "Загруженный файл пуст.": "The uploaded file is empty.",
        "Изображение должно быть меньше {size} МБ.": (
            "The image must be smaller than {size} MB."
        ),
        # --- app/main.py: Pydantic built-ins and the envelope --------------
        "Обязательное поле.": "This field is required.",
        "Ожидается текст.": "Text expected.",
        "Слишком короткое значение.": "That value is too short.",
        "Слишком длинное значение.": "That value is too long.",
        "Некорректный формат запроса.": "Malformed request.",
        "Некорректный email.": "That email is not valid.",
        "Некоторые поля заполнены неверно.": "Some fields are not filled in correctly.",
        "Что-то пошло не так.": "Something went wrong.",
        # --- app/schemas/auth.py ------------------------------------------
        "Пароль должен быть от 8 до 128 символов.": (
            "The password must be 8 to 128 characters."
        ),
        "Пароль может содержать только латинские буквы, цифры и символы.": (
            "The password may contain only Latin letters, digits and symbols."
        ),
        "Логин: только латинские буквы, цифры, _ . и -": (
            "Username: Latin letters, digits, _ . and - only"
        ),
        "Код состоит из 6 цифр.": "The code is 6 digits.",
        "Укажите текущий пароль или код из письма — что-то одно.": (
            "Give either your current password or the code from the email — not both."
        ),
        "Введите логин или email.": "Enter a username or an email.",
        # --- app/schemas/appointment.py -----------------------------------
        "Укажите время вместе с часовым поясом.": "Give the time with its time zone.",
        "Время должно быть кратно 15 минутам.": (
            "The time must fall on a 15-minute step."
        ),
        "Укажите имя клиента.": "Give the client's name.",
        "Укажите услугу.": "Give the service.",
        "Укажите цену.": "Give the price.",
        "Неизвестный цвет.": "Unknown colour.",
        # --- app/schemas/conversation.py ----------------------------------
        "Укажите номер телефона.": "Give a phone number.",
        "Номер телефона должен содержать цифры.": (
            "A phone number must contain digits."
        ),
        "Введите текст сообщения.": "Write the message.",
        "Сообщение клиента приходит из канала.": (
            "A client's message arrives from the channel."
        ),
        # --- app/core/errors.py -------------------------------------------
        "Диалог не найден.": "Conversation not found.",
        "Сообщение не найдено.": "Message not found.",
        # --- app/schemas/business.py --------------------------------------
        "Укажите часовой пояс.": "Give a time zone.",
        "Неизвестный часовой пояс.": "Unknown time zone.",
        "Нужно принимать хотя бы одного клиента.": (
            "You have to take at least one client."
        ),
        "Не больше 100 одновременно.": "No more than 100 at once.",
        "Записываться можно хотя бы на сегодня.": (
            "Bookings have to reach at least today."
        ),
        "Не больше 365 дней.": "No more than 365 days.",
        "Значение не может быть отрицательным.": "This value cannot be negative.",
        "Не больше 7 дней.": "No more than 7 days.",
        # --- app/schemas/service.py ---------------------------------------
        "Укажите название услуги.": "Give the service a name.",
        "Укажите длительность.": "Give a duration.",
        "Не больше 24 часов.": "No more than 24 hours.",
        "Длительность должна быть кратна 15 минутам.": (
            "The duration must be a multiple of 15 minutes."
        ),
        "Цена не может быть отрицательной.": "The price cannot be negative.",
        "Слишком большая цена.": "That price is too high.",
        "Укажите начало и конец рабочего дня.": (
            "Give both the opening and the closing time."
        ),
        "Конец рабочего дня должен быть позже начала.": (
            "Closing time has to be after opening time."
        ),
        "Укажите начало и конец перерыва.": "Give both the start and end of the break.",
        "Конец перерыва должен быть позже начала.": (
            "The break has to end after it starts."
        ),
        "Перерыв должен быть внутри рабочего дня.": (
            "The break has to fall inside the working day."
        ),
    },
}


def negotiate(accept_language: str | None) -> str:
    """Pick a language from an `Accept-Language` header.

    Deliberately small. The header can carry weights, regions and wildcards, and
    the only question here is which of three languages to answer in — so this
    sorts by `q` and takes the first primary subtag it recognises. Anything
    unparseable is skipped rather than raising: a malformed header is a reason
    to fall back to Russian, not to fail a request that is otherwise fine.
    """
    if not accept_language:
        return DEFAULT_LANGUAGE

    ranked: list[tuple[float, int, str]] = []
    for index, part in enumerate(accept_language.split(",")):
        tag, _, params = part.strip().partition(";")
        tag = tag.strip().lower()
        if not tag:
            continue

        quality = 1.0
        key, _, raw = params.strip().partition("=")
        if key.strip().lower() == "q":
            try:
                quality = float(raw)
            except ValueError:
                continue
        if quality <= 0:
            continue

        # `index` keeps the header's own order as the tie-break, so
        # "kk,en" prefers Kazakh even though both weigh 1.0.
        ranked.append((-quality, index, tag))

    for _, _, tag in sorted(ranked):
        primary = tag.split("-")[0]
        if primary in SUPPORTED_LANGUAGES:
            return primary

    return DEFAULT_LANGUAGE


def translate(message: str, language: str, **params: object) -> str:
    """Render a Russian source message in `language`.

    A miss returns the Russian, which is the whole point of keying by it: a
    message added without a translation still says something the reader can act
    on. `params` fills `{name}` placeholders in whichever language won.
    """
    text = MESSAGES.get(language, {}).get(message, message)
    if not params:
        return text
    try:
        return text.format(**params)
    except (KeyError, IndexError, ValueError):
        # A translation whose placeholder was mangled must not turn a 400 into a
        # 500. Fall back to the source, which the check below keeps correct.
        return message.format(**params)


def _sources() -> list[str]:
    """Every Russian message the API can return, read out of the code itself.

    Collected rather than listed, so the check cannot drift from reality the way
    a hand-maintained inventory would.
    """
    import ast
    import pathlib
    import re

    root = pathlib.Path(__file__).resolve().parent.parent
    cyrillic = re.compile("[А-Яа-яЁё]")
    found: list[str] = []

    def add(value: object) -> None:
        if isinstance(value, str) and cyrillic.search(value) and value not in found:
            found.append(value)

    from app.core import errors

    # Every place a message can enter a response: an error class raised or
    # constructed, a Pydantic type mapped, or a literal handed straight to
    # `translate`. Named rather than "any Russian string in the tree", so an
    # email body or a log line never lands in the catalogue by accident.
    senders = {"translate"} | {
        name
        for name, value in vars(errors).items()
        if isinstance(value, type) and issubclass(value, errors.AppError)
    }
    senders.add("ValueError")

    paths = [root / "core" / "errors.py", root / "core" / "images.py"]
    paths += [root / "main.py"]
    paths += sorted((root / "schemas").glob("*.py"))
    paths += sorted((root / "services").glob("*.py"))

    for path in paths:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            # `message = "..."` on an error class, and module constants.
            if isinstance(node, ast.Assign | ast.AnnAssign) and isinstance(
                node.value, ast.Constant
            ):
                add(node.value.value)
            elif isinstance(node, ast.Call):
                func = node.func
                name = getattr(func, "id", None) or getattr(func, "attr", None)
                if name in senders:
                    for arg in node.args:
                        if isinstance(arg, ast.Constant):
                            add(arg.value)
            # The Pydantic message map in `main.py`.
            elif isinstance(node, ast.Dict):
                for value in node.values:
                    if isinstance(value, ast.Constant):
                        add(value.value)

    # `PASSWORD_LENGTH_MESSAGE` is built from the two length constants, so its
    # value only exists at runtime and the tree above cannot see it.
    from app.schemas.auth import PASSWORD_LENGTH_MESSAGE

    add(PASSWORD_LENGTH_MESSAGE)
    return found


def check() -> int:
    """Report messages with no translation, and placeholders lost in one.

    Run as `python -m app.core.i18n`. Returns the number of problems, so it can
    gate a commit hook later without being rewritten.
    """
    import re

    sources = _sources()
    placeholder = re.compile(r"\{(\w+)\}")
    problems = 0

    for language in ("kk", "en"):
        missing = [s for s in sources if s not in MESSAGES[language]]
        if missing:
            problems += len(missing)
            print(f"\n{language}: {len(missing)} untranslated")
            for text in missing:
                print(f"  {text}")

        for source, translated in MESSAGES[language].items():
            if set(placeholder.findall(source)) != set(
                placeholder.findall(translated)
            ):
                problems += 1
                print(f"\n{language}: placeholders differ\n  {source}\n  {translated}")

    stale = [
        s
        for language in ("kk", "en")
        for s in MESSAGES[language]
        if s not in sources
    ]
    if stale:
        problems += len(stale)
        print(f"\n{len(stale)} translated messages no longer in the code:")
        for text in dict.fromkeys(stale):
            print(f"  {text}")

    if not problems:
        print(f"All {len(sources)} messages translated into kk and en.")
    return problems


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(1 if check() else 0)
