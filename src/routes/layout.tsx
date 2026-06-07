import { component$, Slot } from '@builder.io/qwik'

export default component$(() => {
  return (
    <>
      <main class="relative h-screen w-full">
        <section>
          <Slot />
        </section>
      </main>
    </>
  )
})
