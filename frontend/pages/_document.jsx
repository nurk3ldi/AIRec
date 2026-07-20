import { Head, Html, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ru">
      <Head>
        <link rel="icon" href="/favicon.svg?v=3" type="image/svg+xml" sizes="any" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
