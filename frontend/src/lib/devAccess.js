/**
 * Who may open the developer-only screens.
 *
 * **An allow-list of one, on purpose.** `/dev/client` writes messages into an
 * inbox as though a client had sent them, which is exactly the tool needed to
 * build and test the assistant — and exactly the thing no real business owner
 * should ever find in their panel. Gating it on the account rather than on
 * `import.meta.env.DEV` is deliberate: the assistant will be developed against
 * a deployed instance too, and a tool that only exists on `localhost` is not
 * there when it is wanted.
 *
 * Add an address to test from another account. Remove them all and the screen
 * is unreachable for everybody, which is the right end state once WhatsApp is
 * delivering real messages.
 */
const DEV_ACCOUNTS = ['ftnurkeldi@gmail.com']

export const isDevAccount = (user) =>
  Boolean(user?.email) && DEV_ACCOUNTS.includes(user.email.toLowerCase())
