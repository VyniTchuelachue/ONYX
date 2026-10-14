'use client';

import { useRef, useState } from 'react';
import { Check, FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { DOCUMENT_KINDS, type DocumentKind } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { useAction, useProDocuments } from '@/lib/queries';
import { Spinner } from '../ui/spinner';

const MAX_BYTES = 5 * 1024 * 1024;

/** Verification documents, one per kind. Only the ONYX team can open them. */
export function DocumentsSection() {
  const { t } = useI18n();
  const docs = useProDocuments();
  return (
    <div>
      <p className="mb-3 text-[14px] text-ink-3">{t('onboarding.documentsHelp')}</p>
      <ul className="space-y-2">
        {DOCUMENT_KINDS.map((kind) => (
          <DocumentRow key={kind} kind={kind} uploaded={docs.data?.find((d) => d.kind === kind)?.fileName ?? null} />
        ))}
      </ul>
    </div>
  );
}

function DocumentRow({ kind, uploaded }: { kind: DocumentKind; uploaded: string | null }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);
  const upload = useAction((b, file: File) => b.pro.uploadDocument(kind, file, file.name), { success: t('onboarding.uploaded') });
  const shown = name ?? uploaded;

  return (
    <li className="flex items-center gap-3 rounded-lg border border-line bg-surface-1 px-4 py-3">
      <span className={shown ? 'text-ok' : 'text-ink-3'}>{shown ? <Check className="size-5" aria-hidden="true" /> : <FileText className="size-5" aria-hidden="true" />}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-ink">{t(`onboarding.documents.${kind}`)}</span>
        {shown && <span className="block truncate text-[13px] text-ink-3">{shown}</span>}
      </span>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        aria-label={t(`onboarding.documents.${kind}`)}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (file.size > MAX_BYTES) {
            toast.error(t('onboarding.fileTooLarge'));
            return;
          }
          upload.mutate(file, { onSuccess: () => setName(file.name) });
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={upload.isPending}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm font-medium text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-60"
      >
        {upload.isPending ? <Spinner className="size-4" /> : <Upload className="size-4" aria-hidden="true" />}
        {upload.isPending ? t('onboarding.uploading') : shown ? t('onboarding.replace') : t('onboarding.upload')}
      </button>
    </li>
  );
}
