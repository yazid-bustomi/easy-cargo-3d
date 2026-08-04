const LayoutService = require('../services/LayoutService');
const ContainerService = require('../services/ContainerService');

class LayoutController {
  /**
   * GET /api/layouts
   */
  static async getAll(req, res) {
    try {
      const { status } = req.query;
      const layouts = await LayoutService.getAllLayouts(status);
      res.json({ success: true, data: layouts });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/layouts/:id
   */
  static async getById(req, res) {
    try {
      const layout = await LayoutService.getLayoutById(parseInt(req.params.id));
      if (!layout) {
        return res.status(404).json({ success: false, error: 'Layout not found' });
      }

      // Enrich with statistics
      const stats = await LayoutService.calculateStats(layout.id);
      res.json({ success: true, data: { ...layout.toJSON(), stats } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/layouts
   */
  static async create(req, res) {
    try {
      const { name, container_type_id, odoo_sale_order_id } = req.body;

      if (!name || !container_type_id) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const layout = await LayoutService.createLayout(
        {
          name,
          container_type_id,
          odoo_sale_order_id: odoo_sale_order_id || null,
          status: 'draft',
        },
        req.user?.id || 1
      );

      res.status(201).json({ success: true, data: layout });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/layouts/:id
   */
  static async update(req, res) {
    try {
      const layout = await LayoutService.updateLayout(parseInt(req.params.id), req.body);
      res.json({ success: true, data: layout });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/layouts/:id
   */
  static async delete(req, res) {
    try {
      await LayoutService.deleteLayout(parseInt(req.params.id));
      res.json({ success: true, message: 'Layout deleted' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/layouts/:id/auto-pack
   */
  static async autoPack(req, res) {
    try {
      const result = await LayoutService.autoPack(parseInt(req.params.id));
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/layouts/:id/reset
   */
  static async reset(req, res) {
    try {
      const layout = await LayoutService.resetLayout(parseInt(req.params.id));
      res.json({ success: true, data: layout, message: 'Layout reset' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/layouts/:id/items
   */
  static async addItem(req, res) {
    try {
      const { product_id, position, rotation } = req.body;

      if (!product_id || !position || !rotation) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const item = await LayoutService.addLayoutItem(
        parseInt(req.params.id),
        product_id,
        position,
        rotation
      );

      res.status(201).json({ success: true, data: item });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/layout-items/:itemId
   */
  static async updateItem(req, res) {
    try {
      const item = await LayoutService.updateLayoutItem(parseInt(req.params.itemId), req.body);
      res.json({ success: true, data: item });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/layout-items/:itemId
   */
  static async removeItem(req, res) {
    try {
      await LayoutService.removeLayoutItem(parseInt(req.params.itemId));
      res.json({ success: true, message: 'Item removed' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/layouts/:id/stats
   */
  static async getStats(req, res) {
    try {
      const stats = await LayoutService.calculateStats(parseInt(req.params.id));
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = LayoutController;
