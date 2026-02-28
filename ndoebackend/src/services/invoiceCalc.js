/**
 * Calculate invoice amounts from product data + GST settings
 * All calculations done server-side — never trust client-sent totals.
 */
const calculateInvoice = (product, gstPercentage) => {
  const subtotal = product.quantity * product.price_per_unit;
  const gst_amount = parseFloat((subtotal * (gstPercentage / 100)).toFixed(2));
  const total_amount = parseFloat((subtotal + gst_amount).toFixed(2));
  return { subtotal, gst_percentage: gstPercentage, gst_amount, total_amount };
};

module.exports = { calculateInvoice };
