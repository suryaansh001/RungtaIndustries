const success = (res, message, data, statusCode = 200) => {
  res.status(statusCode).json({ success: true, message, data });
};

const paginated = (res, data, pagination) => {
  res.status(200).json({ success: true, data, pagination });
};

const created = (res, message, data) => success(res, message, data, 201);

const badRequest = (res, message, errors = null) => {
  res.status(400).json({
    success: false,
    message,
    error_code: 'BAD_REQUEST',
    ...(errors && { errors }),
  });
};

const unauthorized = (res, message = 'Unauthorized') => {
  res.status(401).json({ success: false, message, error_code: 'UNAUTHORIZED' });
};

const forbidden = (res, message = 'Forbidden') => {
  res.status(403).json({ success: false, message, error_code: 'FORBIDDEN' });
};

const notFound = (res, message = 'Resource not found') => {
  res.status(404).json({ success: false, message, error_code: 'NOT_FOUND' });
};

const conflict = (res, message, error_code = 'CONFLICT') => {
  res.status(409).json({ success: false, message, error_code });
};

module.exports = { success, paginated, created, badRequest, unauthorized, forbidden, notFound, conflict };
