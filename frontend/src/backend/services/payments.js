// payments.js — payment processing (checkout)

/**
 * @param {string} orderId
 * @param {string} paymentMethod
 * @param {number} amount
 * @returns {Promise<import('../models/payment.js').Payment>}
 */
export async function processPayment(orderId, paymentMethod, amount) {}

/**
 * @param {string} paymentId
 * @returns {Promise<import('../models/payment.js').Payment>}
 */
export async function getPayment(paymentId) {}
