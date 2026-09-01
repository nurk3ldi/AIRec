import { HugeiconsIcon } from '@hugeicons/react'
import { AiScanIcon } from '@hugeicons/core-free-icons'
import { useT } from '../../lib/i18n'
import { chatState } from '../../lib/conversations'
import Skeleton, { SkeletonRegion } from '../Skeleton'
import { useSkeleton } from '../../lib/skeleton'

/**
 * Что ассистент делает прямо сейчас.
 *
 * **Данные приходят сверху.** Их читает страница и раздаёт обеим карточкам
 * ряда: два компонента, опрашивающих один эндпоинт каждые пятнадцать секунд, —
 * это два запроса там, где нужен один, и два ответа, которые могут разойтись
 * между собой. Что такое «сейчас», решает `lib/conversations.js`.
 *
 * **Четыре строки, и порядок в них — порядок вопросов.** Чья это карточка, что
 * он делает, с кем, по какому номеру. Крупная — вторая: карточка стоит ради
 * неё, а по правилу этого проекта громким на экране бывает что-то одно.
 *
 * **Счёт параллельных веток стоит в подписи, а не отдельной строкой.** Их у
 * ассистента может идти две-три сразу, и промолчать об этом — показать треть
 * происходящего. Но и выносить «и ещё 2» сноской не стоит: сами ветки строка за
 * строкой покажет широкая карточка рядом, а здесь число говорит, сколько он
 * держит, — то есть относится к нему, а не к разговору.
 *
 * **Текст реплики сюда не идёт.** Это содержание, а содержание — дело соседней
 * карточки; в колонке шириной в треть экрана чужое предложение на две строки
 * забивает всю композицию.
 */

export default function AssistantNow({ chats, live, className = '' }) {
  const t = useT()
  const bars = useSkeleton(chats === null)
  const current = live[0] ?? null
  const state = chatState(current)

  return (
    <section
      className={`relative flex flex-col rounded-2xl bg-surface-raised p-6 ${className}`}
    >
      {/* **Огонёк в противоположном от знака углу.** Он говорит одно: сейчас
          что-то идёт. В строке состояния ему не место — появляясь и исчезая, он
          сдвигал бы текст, ради которого карточка и стоит; в углу он не двигает
          ничего.

          Цвет — `--now`, тем же размечено настоящее время на сетке записей, так
          что «сейчас» во всём приложении одного цвета. Кольцо вокруг —
          единственное движение здесь, и означает оно ровно то, что означает:
          это идёт, пока вы смотрите. Под `prefers-reduced-motion` остаётся
          точка. */}
      {current && (
        <span aria-hidden="true" className="absolute top-6 right-6 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-now opacity-70 motion-reduce:hidden" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-now" />
        </span>
      )}

      {/* **Знак без подложки и без круга, в левом верхнем углу.** Тот же
          `AiScanIcon`, что у «Ассистента» в навигации — одна вещь называется
          одним знаком, иначе на двух экранах это два разных предмета. Середина
          осталась содержанию: знак говорит, чья карточка, и стоит там, откуда
          начинается чтение.

          Размер берётся от карточки, а карточка — от экрана, поэтому доля, а не
          число в пикселях: последнее было бы верным ровно для одного окна.

          **Обводка считается, а не подбирается на глаз.** `strokeWidth` — в
          единицах `viewBox` (24), поэтому на экране она умножается на то, во
          сколько раз знак больше: при высоте около 130px единица — это шесть
          пикселей, и `0.5` даёт линию примерно в три. Значение ходит обратно
          размеру: чем крупнее знак, тем меньше единиц нужно на ту же
          толщину. */}
      <div className="flex h-[34%] shrink-0 items-start">
        <HugeiconsIcon
          icon={AiScanIcon}
          strokeWidth={0.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-full w-auto text-ink"
        />
      </div>

      {chats === null ? (
        <SkeletonRegion
          label={t('nav.assistant')}
          visible={bars}
          className="mt-auto flex flex-col gap-2.5"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-[75%]" />
          <Skeleton className="h-4 w-[45%]" />
        </SkeletonRegion>
      ) : (
        // Прижато к низу: знак наверху, вывод внизу, воздух между ними. Это и
        // держит композицию, когда строк то три, то четыре.
        <div className="mt-auto flex min-w-0 flex-col">
          <p className="truncate text-[13px] text-muted">
            {t('nav.assistant')}
            {live.length > 1 && (
              <> · {t('home.assistant.threads', { count: live.length })}</>
            )}
          </p>

          {/* Самое громкое на карточке — и единственное громкое: правило «одно
              на экран в самом крупном кегле» здесь про эту строку.
              Отрицательный трекинг — крупный текст читается разреженным, если
              его не поджать. */}
          <p className="mt-1.5 font-display text-[26px] leading-[1.15] font-semibold tracking-[-0.02em] text-ink">
            {t(`home.assistant.${state}`)}
          </p>

          {current ? (
            <>
              <p className="mt-2 min-w-0 truncate text-[15px] text-ink">
                {current.client_name || current.client_phone}
              </p>
              {/* Номер — под именем и тише его: он опознаёт того же человека во
                  второй раз, а не называет второго. Показан только когда имя
                  есть, иначе строкой выше стоит он сам. */}
              {current.client_name && (
                <p className="mt-0.5 truncate text-[13px] text-muted">
                  {current.client_phone}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {t('home.assistant.idleHint')}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
