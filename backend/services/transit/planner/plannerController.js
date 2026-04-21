const { planJourneyFromRequest } = require('./plannerService');

async function handleTransitPlan(req, res) {
  try {
    const result = await planJourneyFromRequest(req.body || {});
    res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error('Transit planner error:', error);
    res.status(statusCode).json({
      ok: false,
      error: error.message || 'Transit planner failed',
      plan: null,
      options: [],
    });
  }
}

module.exports = {
  handleTransitPlan,
};
