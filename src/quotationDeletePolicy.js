import { api, getSession } from './api.js';

const loadQuote = api.quote;

api.quote = async id => {
  const record = await loadQuote(id);
  const isAdmin = getSession()?.role === 'admin';
  const isAccepted = record?.current?.status === 'accepted';
  const isHistorical = !!record?.quote?.cancelled_at;

  if (isAdmin && isAccepted && !isHistorical) {
    record.lifecycle = {
      ...(record.lifecycle || {}),
      canDelete: true,
      deleteRequiresReason: true,
      deleteBlockReason: null,
    };
  }

  return record;
};
