import { component$, Slot } from '@builder.io/qwik'

export default component$(() => {
  return (
    <>
      <main class="relative h-screen w-full">
        <section>
          <Slot />
        </section>
      </main>
      <footer class="absolute bottom-4 right-4 text-slate-500">
        Made with ♡ by{' '}
        <a href="https://www.christiancodes.co/" target="_blank">
          Christian
        </a>
      </footer>
    </>
  )
})
