const { Layout, LayoutItem, Product, ContainerType } = require('../models');
const ContainerService = require('./ContainerService');
const { packContainer } = require('../utils/binpacking');

class LayoutService {
  /**
   * Create new layout
   */
  static async createLayout(data, userId) {
    return Layout.create({
      ...data,
      created_by: userId,
    });
  }

  /**
   * Get layout by ID with items and container info
   */
  static async getLayoutById(layoutId) {
    return Layout.findByPk(layoutId, {
      include: [
        {
          association: 'items',
          include: [{ association: 'product' }],
        },
        { association: 'containerType' },
      ],
    });
  }

  /**
   * Get all layouts
   */
  static async getAllLayouts(status = null) {
    const where = {};
    if (status) where.status = status;

    return Layout.findAll({
      where,
      include: [{ association: 'containerType' }],
      order: [['created_at', 'DESC']],
    });
  }

  /**
   * Update layout metadata
   */
  static async updateLayout(layoutId, data) {
    const layout = await Layout.findByPk(layoutId);
    if (!layout) throw new Error('Layout not found');

    return layout.update(data);
  }

  /**
   * Delete layout
   */
  static async deleteLayout(layoutId) {
    const layout = await Layout.findByPk(layoutId);
    if (!layout) throw new Error('Layout not found');

    return layout.destroy();
  }

  /**
   * Add item to layout
   */
  static async addLayoutItem(layoutId, productId, position, rotation) {
    const layout = await Layout.findByPk(layoutId);
    if (!layout) throw new Error('Layout not found');

    const product = await Product.findByPk(productId);
    if (!product) throw new Error('Product not found');

    return LayoutItem.create({
      layout_id: layoutId,
      product_id: productId,
      pos_x: position.x,
      pos_y: position.y,
      pos_z: position.z,
      rot_x: rotation.x,
      rot_y: rotation.y,
      rot_z: rotation.z,
    });
  }

  /**
   * Update layout item position/rotation
   */
  static async updateLayoutItem(itemId, data) {
    const item = await LayoutItem.findByPk(itemId);
    if (!item) throw new Error('Layout item not found');

    return item.update(data);
  }

  /**
   * Remove layout item
   */
  static async removeLayoutItem(itemId) {
    const item = await LayoutItem.findByPk(itemId);
    if (!item) throw new Error('Layout item not found');

    return item.destroy();
  }

  /**
   * Auto pack: use bin packing algorithm to place all products into layout
   */
  static async autoPack(layoutId) {
    const layout = await Layout.findByPk(layoutId, {
      include: [
        { association: 'items' },
        { association: 'containerType' },
      ],
    });
    if (!layout) throw new Error('Layout not found');

    // Get all products and their quantities for bin packing
    const products = await Product.findAll({
      where: { is_active: true },
      attributes: ['id', 'length_cm', 'width_cm', 'height_cm', 'weight_kg', 'this_side_up', 'rotation_allowed', 'stackable', 'max_stack'],
    });

    // Format for bin packing algorithm
    const packItems = products
      .filter(p => p.dataValues.qty > 0) // Only products with qty
      .map(p => ({
        productId: p.id,
        length: Number(p.length_cm),
        width: Number(p.width_cm),
        height: Number(p.height_cm),
        weight: Number(p.weight_kg),
        thisSideUp: p.this_side_up,
        rotationAllowed: p.rotation_allowed,
        stackable: p.stackable,
        maxStack: p.max_stack,
        qty: p.dataValues.qty,
      }));

    // Run packing algorithm
    const container = ContainerService.formatForBinPacking(layout.containerType);
    const packResult = packContainer(container, packItems);

    // Clear existing items
    await LayoutItem.destroy({ where: { layout_id: layoutId } });

    // Insert packed items
    for (const placed of packResult.placed) {
      await LayoutItem.create({
        layout_id: layoutId,
        product_id: placed.productId,
        instance_no: placed.instanceNo,
        pos_x: placed.x,
        pos_y: placed.y,
        pos_z: placed.z,
        rot_x: placed.rotX,
        rot_y: placed.rotY,
        rot_z: placed.rotZ,
        stack_level: placed.stackLevel,
        is_valid: true,
      });
    }

    // Update layout statistics
    const containerVolume = ContainerService.calculateVolume(layout.containerType);
    const usagePercent = (packResult.usedVolume / containerVolume) * 100;

    await layout.update({
      total_weight_kg: packResult.totalWeight,
      used_volume_cm3: packResult.usedVolume,
      item_count: packResult.placed.length,
    });

    return {
      success: true,
      placed: packResult.placed.length,
      unplaced: packResult.unplaced,
      totalWeight: packResult.totalWeight,
      usedVolume: packResult.usedVolume,
      volumePercent: usagePercent.toFixed(2),
    };
  }

  /**
   * Reset layout (clear all items)
   */
  static async resetLayout(layoutId) {
    const layout = await Layout.findByPk(layoutId);
    if (!layout) throw new Error('Layout not found');

    await LayoutItem.destroy({ where: { layout_id: layoutId } });

    return layout.update({
      total_weight_kg: 0,
      used_volume_cm3: 0,
      item_count: 0,
    });
  }

  /**
   * Calculate layout statistics
   */
  static async calculateStats(layoutId) {
    const layout = await Layout.findByPk(layoutId, {
      include: [
        {
          association: 'items',
          include: [{ association: 'product' }],
        },
        { association: 'containerType' },
      ],
    });
    if (!layout) throw new Error('Layout not found');

    let totalWeight = 0;
    let usedVolume = 0;

    for (const item of layout.items) {
      const product = item.product;
      totalWeight += Number(product.weight_kg);
      usedVolume += Number(product.length_cm) * Number(product.width_cm) * Number(product.height_cm);
    }

    const containerVolume = ContainerService.calculateVolume(layout.containerType);
    const volumePercent = (usedVolume / containerVolume) * 100;
    const weightPercent = (totalWeight / Number(layout.containerType.max_payload_kg)) * 100;

    return {
      totalWeight: totalWeight.toFixed(3),
      usedVolume: Math.round(usedVolume),
      containerVolume: containerVolume,
      volumePercent: volumePercent.toFixed(2),
      weightPercent: weightPercent.toFixed(2),
      itemCount: layout.items.length,
    };
  }
}

module.exports = LayoutService;
