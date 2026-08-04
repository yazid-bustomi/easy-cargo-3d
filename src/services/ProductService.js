const { Product, ProductGroup } = require('../models');

class ProductService {
  /**
   * Get all products with optional group filtering
   */
  static async getAllProducts(groupId = null) {
    const where = { is_active: true };
    if (groupId) where.group_id = groupId;

    return Product.findAll({
      where,
      include: [
        { association: 'group', attributes: ['id', 'name', 'color_hex'] },
      ],
      order: [['sku', 'ASC']],
    });
  }

  /**
   * Get product by ID
   */
  static async getProductById(productId) {
    return Product.findByPk(productId, {
      include: [
        { association: 'group', attributes: ['id', 'name', 'color_hex'] },
      ],
    });
  }

  /**
   * Create new product
   */
  static async createProduct(data, userId) {
    return Product.create({
      ...data,
      created_by: userId,
    });
  }

  /**
   * Update product
   */
  static async updateProduct(productId, data) {
    const product = await Product.findByPk(productId);
    if (!product) throw new Error('Product not found');

    return product.update(data);
  }

  /**
   * Delete product (soft delete via is_active)
   */
  static async deleteProduct(productId) {
    const product = await Product.findByPk(productId);
    if (!product) throw new Error('Product not found');

    return product.update({ is_active: false });
  }

  /**
   * Get products grouped by ProductGroup
   */
  static async getProductsGrouped() {
    const groups = await ProductGroup.findAll({
      where: { is_collapsed: false },
      include: [
        {
          association: 'products',
          where: { is_active: true },
          required: false,
        },
      ],
      order: [['sort_order', 'ASC']],
    });
    return groups;
  }

  /**
   * Update product group (e.g., color change, collapse state)
   */
  static async updateProductGroup(groupId, data) {
    const group = await ProductGroup.findByPk(groupId);
    if (!group) throw new Error('Product group not found');

    return group.update(data);
  }

  /**
   * Create product group
   */
  static async createProductGroup(data, userId) {
    return ProductGroup.create({
      ...data,
      created_by: userId,
    });
  }

  /**
   * Bulk update product quantities (for planning)
   */
  static async updateProductQuantities(updates) {
    const results = [];
    for (const { productId, qty } of updates) {
      const product = await Product.findByPk(productId);
      if (product) {
        await product.update({ qty });
        results.push(product);
      }
    }
    return results;
  }
}

module.exports = ProductService;
