import { api, getSession } from './api.js';

const loadQuote = api.quote;

api.quote = async id => {
  const record = await loadQuote(id);
  const isAdmin = getSession()?.role === 'admin';
  const isHistorical = !!record?.quote?.cancelled_at;
  const isAccepted = record?.current?.status === 'accepted' || record?.lifecycle?.effectiveStatus === 'accepted';

  if (isAdmin && !isHistorical) {
    record.lifecycle = {
      ...(record.lifecycle || {}),
      canDelete: true,
      deleteRequiresReason: isAccepted,
      deleteBlockReason: null,
    };
  }

  return record;
};
