'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { REVIEW_TAGS, type ReviewTag } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useAction } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Chip } from '../ui/choice';
import { Textarea } from '../ui/field';
import { Button } from '../ui/button';

/** Rate the job: stars first (one tap), details optional. */
export function ReviewForm({ requestId }: { requestId: string }) {
  const { t, tp } = useI18n();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [comment, setComment] = useState('');
  const submit = useAction((b, _: void) => b.requests.review({ requestId, rating, tags, comment: comment || null }), {
    success: t('request.reviewThanks'),
  });

  const shown = hover || rating;
  return (
    <section className="rounded-xl border border-gold/40 bg-surface-1 p-5">
      <h2 className="font-wide text-[17px] font-semibold text-ink">{t('request.reviewTitle')}</h2>
      <div className="mt-4 flex gap-1" role="radiogroup" aria-label={t('request.reviewTitle')} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={tp('request.stars', n)}
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            className="grid size-12 place-items-center rounded-full transition-transform active:scale-90"
          >
            <Star className={cn('size-8 transition-colors', n <= shown ? 'fill-gold-bright text-gold-bright' : 'text-ink-3/60')} aria-hidden="true" />
          </button>
        ))}
      </div>

      {rating > 0 && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {REVIEW_TAGS.map((tag) => (
              <Chip key={tag} pressed={tags.includes(tag)} onClick={() => setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]))}>
                {t(`request.tags.${tag}`)}
              </Chip>
            ))}
          </div>
          <Textarea
            aria-label={t('request.reviewPlaceholder')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('request.reviewPlaceholder')}
            maxLength={1000}
            rows={3}
          />
          <Button className="w-full" size="lg" loading={submit.isPending} onClick={() => submit.mutate()}>
            {t('request.reviewSubmit')}
          </Button>
        </div>
      )}
    </section>
  );
}
