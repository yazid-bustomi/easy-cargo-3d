const ProductService = require('../services/ProductService');

class ProductController {
  /**
   * GET /api/products
   */
  static async getAll(req, res) {
    try {
      const { groupId } = req.query;
      const products = await ProductService.getAllProducts(groupId ? parseInt(groupId) : null);
      res.json({ success: true, data: products });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/products/grouped
   */
  static async getGrouped(req, res) {
    try {
      const groups = await ProductService.getProductsGrouped();
      res.json({ success: true, data: groups });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/products/:id
   */
  static async getById(req, res) {
    try {
      const product = await ProductService.getProductById(parseInt(req.params.id));
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      res.json({ success: true, data: product });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/products
   */
  static async create(req, res) {
    try {
      const { name, sku, length_cm, width_cm, height_cm, weight_kg, qty, ...rest } = req.body;

      if (!name || !sku || !length_cm || !width_cm || !height_cm) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const product = await ProductService.createProduct(
        { name, sku, length_cm, width_cm, height_cm, weight_kg: weight_kg || 0, qty: qty || 0, ...rest },
        req.user?.id || 1
      );

      res.status(201).json({ success: true, data: product });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/products/:id
   */
  static async update(req, res) {
    try {
      const product = await ProductService.updateProduct(parseInt(req.params.id), req.body);
      res.json({ success: true, data: product });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/products/:id
   */
  static async delete(req, res) {
    try {
      await ProductService.deleteProduct(parseInt(req.params.id));
      res.json({ success: true, message: 'Product deleted' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/product-groups
   */
  static async createGroup(req, res) {
    try {
      const { name, color_hex, sort_order } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, error: 'Group name required' });
      }

      const group = await ProductService.createProductGroup(
        { name, color_hex: color_hex || '#3B82F6', sort_order: sort_order || 0 },
        req.user?.id || 1
      );

      res.status(201).json({ success: true, data: group });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/product-groups/:id
   */
  static async updateGroup(req, res) {
    try {
      const group = await ProductService.updateProductGroup(parseInt(req.params.id), req.body);
      res.json({ success: true, data: group });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/products/bulk-quantities
   */
  static async bulkUpdateQuantities(req, res) {
    try {
      const { updates } = req.body;
      if (!Array.isArray(updates)) {
        return res.status(400).json({ success: false, error: 'Updates must be array' });
      }

      const results = await ProductService.updateProductQuantities(updates);
      res.json({ success: true, data: results });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = ProductController;
