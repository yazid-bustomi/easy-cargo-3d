const ContainerService = require('../services/ContainerService');

class ContainerController {
  /**
   * GET /api/containers
   */
  static async getAll(req, res) {
    try {
      const { includeCustom = 'true' } = req.query;
      const containers = await ContainerService.getAllContainers(includeCustom === 'true');
      res.json({ success: true, data: containers });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/containers/system
   */
  static async getSystem(req, res) {
    try {
      const containers = await ContainerService.getSystemContainers();
      res.json({ success: true, data: containers });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/containers/:id
   */
  static async getById(req, res) {
    try {
      const container = await ContainerService.getContainerById(parseInt(req.params.id));
      if (!container) {
        return res.status(404).json({ success: false, error: 'Container not found' });
      }
      res.json({ success: true, data: container });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/containers/custom
   */
  static async createCustom(req, res) {
    try {
      const { code, name, length_cm, width_cm, height_cm, max_payload_kg, tare_weight_kg } = req.body;

      if (!code || !name || !length_cm || !width_cm || !height_cm) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const container = await ContainerService.createCustomContainer(
        {
          code,
          name,
          length_cm,
          width_cm,
          height_cm,
          max_payload_kg: max_payload_kg || 30000,
          tare_weight_kg: tare_weight_kg || 0,
        },
        req.user?.id || 1
      );

      res.status(201).json({ success: true, data: container });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/containers/:id
   */
  static async update(req, res) {
    try {
      const container = await ContainerService.updateContainer(parseInt(req.params.id), req.body);
      res.json({ success: true, data: container });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/containers/:id
   */
  static async delete(req, res) {
    try {
      await ContainerService.deleteContainer(parseInt(req.params.id));
      res.json({ success: true, message: 'Container deleted' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = ContainerController;
