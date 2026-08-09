/** `/profile` has no content of its own — Account is the landing section. */
export async function getServerSideProps() {
  return { redirect: { destination: '/profile/account', permanent: false } }
}

export default function ProfileIndexPage() {
  return null
}
