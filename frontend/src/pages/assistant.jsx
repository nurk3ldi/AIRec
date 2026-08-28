import { useEffect, useState } from 'react'
import { getBusiness } from '../lib/api'
import { authed } from '../lib/auth'
import { useT } from '../lib/i18n'
import BusinessCard from '../components/assistant/BusinessCard'
import styles from '../styles/Assistant.module.css'

/**
 * Ассистент — what it knows and how it answers.
 *
 * Раньше это был «Бизнес». Переименовано вместе с маршрутом: владелец приходит
 * сюда не «настроить компанию», а посмотреть, что знает и как отвечает его
 * ассистент — а услуги, цены и часы работы это ровно то, что ему нужно знать.
 *
 * **Бэкенд не переименован, и это не упущение.** `Business` — это сам салон:
 * часовой пояс, вместимость, услуги, часы работы. Ассистент их *читает*, но не
 * является ими, так что `/business`, `/business/services` и
 * `/business/working-hours` остаются как есть.
 *
 * **Карточками, а не одной с разделителями.** Прайс-лист, неделя, правила и
 * данные бизнеса — четыре разных объекта, а не четыре грани одного, и каждый
 * сохраняется отдельным запросом: `PUT` для списков (целиком, одной
 * транзакцией) и `PATCH` для самого бизнеса. Одна общая кнопка «Сохранить»
 * послала бы три запроса, и падение одного из них оставило бы страницу
 * сохранённой наполовину.
 *
 * Пока готова одна карточка — «О бизнесе». Услуги, график и правила следующие.
 */
export default function AssistantPage() {
  const t = useT()
  const [business, setBusiness] = useState(null)
  // Bumped after a save. A counter rather than a boolean: two saves in a row
  // have to be two reloads, and `true → true` is no change at all.
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    authed(getBusiness)
      .then((row) => alive && setBusiness(row))
      // Swallowed: the card renders empty fields, which is also what a business
      // that has never been filled in looks like.
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [reload])

  return (
    <div className={styles.page} aria-label={t('nav.assistant')}>
      {/* One column of cards on a phone, two from `xl`. The cards are short
          lists and forms; across a wide screen a single column leaves half of
          it empty. */}
      <div className="mx-auto grid w-full max-w-[1100px] gap-6 p-4 sm:p-6 xl:grid-cols-2">
        <BusinessCard
          business={business}
          onSaved={() => setReload((n) => n + 1)}
        />
      </div>
    </div>
  )
}
