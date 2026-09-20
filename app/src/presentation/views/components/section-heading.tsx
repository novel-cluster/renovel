import type { FC } from 'hono/jsx'

/** Section heading with the syosetu-style primary underline + optional "more" link. */
export const SectionHeading: FC<{ title: string; moreHref?: string; moreLabel?: string }> = ({
  title,
  moreHref,
  moreLabel,
}) => (
  <div class="mb-3 flex items-center justify-between border-b-2 border-primary pb-2">
    <h2 class="text-lg font-bold">{title}</h2>
    {moreHref ? (
      <a class="text-sm text-primary hover:underline" href={moreHref}>
        {moreLabel ?? 'もっと見る'}
      </a>
    ) : null}
  </div>
)
