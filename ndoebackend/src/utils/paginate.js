const paginate = (query, page, limit) => {
  const p = parseInt(page, 10) || 1;
  const l = Math.min(parseInt(limit, 10) || 20, 100);
  const skip = (p - 1) * l;
  return { page: p, limit: l, skip };
};

const paginationMeta = (total, page, limit) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});

module.exports = { paginate, paginationMeta };
