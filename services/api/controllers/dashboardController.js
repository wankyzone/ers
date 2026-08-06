import { getDashboardOverview } from '../services/dashboardService.js';

export async function dashboardOverview(req, res) {
  try {
    const overview = await getDashboardOverview();

    return res.status(200).json({
      success: true,
      data: overview,
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load dashboard overview',
    });
  }
}
