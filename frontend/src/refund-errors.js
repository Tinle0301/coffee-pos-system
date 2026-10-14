// refund-errors.js — turn a process_refund() database error into a message a
// person can act on. The database function raises 'CODE: detail'
// (see backend/migrations/0009_process_refund.sql); we show our own wording,
// never the raw database text.
const MESSAGES = {
  UNAUTHORIZED: 'Only an admin can issue refunds.',
  PAYMENT_NOT_FOUND: 'No payment found with that ID.',
  ALREADY_REFUNDED: 'This payment has already been refunded.',
  INVALID_PAYMENT_STATUS: "This payment isn't completed, so it can't be refunded.",
  INVALID_REFUND_TYPE: 'Choose a full or partial refund.',
  INVALID_REFUND_AMOUNT: "That refund amount isn't valid for this payment.",
};

export function mapRefundError(rpcError) {
  const raised = (rpcError && rpcError.message) || '';
  const code = raised.includes(':') ? raised.slice(0, raised.indexOf(':')).trim() : '';
  if (MESSAGES[code]) return { code, message: MESSAGES[code] };
  return { code: 'REFUND_FAILED', message: 'The refund could not be processed. Try again.' };
}
