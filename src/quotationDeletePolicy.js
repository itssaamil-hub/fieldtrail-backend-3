import { api } from './api.js';

const loadQuote = api.quote;

api.quote = async id => {
  const record = await loadQuote(id);
  const isHistorical = !!record?.quote?.cancelled_at;
  const isAccepted = record?.current?.status === 'accepted' || record?.lifecycle?.effectiveStatus === 'accepted';

  if (!isHistorical) {
    record.lifecycle = {
      ...(record.lifecycle || {}),
      canDelete: true,
      deleteRequiresReason: isAccepted,
      deleteBlockReason: null,
    };
  }

  return record;
};
