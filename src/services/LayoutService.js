const ContainerService = require('./ContainerService');
const ProductService = require('./ProductService');
const { packContainer } = require('../utils/binpacking');

class LayoutService {
  static layouts = [];
  static layoutItems = [];
  static nextLayoutId = 1;
  static nextLayoutItemId = 1;

  static async createLayout(data, userId) {
    const layout = {
      ...data,
      id: this.nextLayoutId++,
      created_by: userId,
      created_at: new Date().toISOString()
    };
    this.layouts.push(layout);
    return layout;
  }

  static async getLayoutById(layoutId) {
    const layout = this.layouts.find(l => l.id == layoutId);
    if (!layout) return null;

    const items = this.layoutItems.filter(i => i.layout_id == layoutId).map(item => ({
      ...item,
      product: ProductService.products.find(p => p.id == item.product_id)
    }));

    return {
      ...layout,
      items,
      containerType: ContainerService.containers.find(c => c.id == layout.container_id)
    };
  }

  static async getAllLayouts(status = null) {
    let filtered = this.layouts;
    if (status) filtered = filtered.filter(l => l.status === status);

    return filtered.map(layout => ({
      ...layout,
      containerType: ContainerService.containers.find(c => c.id == layout.container_id)
    })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  static async updateLayout(layoutId, data) {
    const idx = this.layouts.findIndex(l => l.id == layoutId);
    if (idx === -1) throw new Error('Layout not found');

    this.layouts[idx] = { ...this.layouts[idx], ...data };
    return this.layouts[idx];
  }

  static async deleteLayout(layoutId) {
    const idx = this.layouts.findIndex(l => l.id == layoutId);
    if (idx === -1) throw new Error('Layout not found');

    this.layouts.splice(idx, 1);
    this.layoutItems = this.layoutItems.filter(i => i.layout_id != layoutId);
    return { success: true };
  }

  static async addLayoutItem(layoutId, productId, position, rotation) {
    const item = {
      id: this.nextLayoutItemId++,
      layout_id: layoutId,
      product_id: productId,
      pos_x: position.x,
      pos_y: position.y,
      pos_z: position.z,
      rot_x: rotation.x,
      rot_y: rotation.y,
      rot_z: rotation.z,
    };
    this.layoutItems.push(item);
    return item;
  }

  static async updateLayoutItem(itemId, data) {
    const idx = this.layoutItems.findIndex(i => i.id == itemId);
    if (idx === -1) throw new Error('Layout item not found');

    this.layoutItems[idx] = { ...this.layoutItems[idx], ...data };
    return this.layoutItems[idx];
  }

  static async removeLayoutItem(itemId) {
    const idx = this.layoutItems.findIndex(i => i.id == itemId);
    if (idx === -1) throw new Error('Layout item not found');

    this.layoutItems.splice(idx, 1);
    return { success: true };
  }

  static async autoPack(layoutId) {
    const layout = await this.getLayoutById(layoutId);
    if (!layout) throw new Error('Layout not found');

    const products = ProductService.products.filter(p => p.is_active !== false);

    const packItems = products
      .filter(p => p.qty > 0)
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
        qty: p.qty,
      }));

    const container = ContainerService.formatForBinPacking(layout.containerType);
    const packResult = packContainer(container, packItems);

    this.layoutItems = this.layoutItems.filter(i => i.layout_id != layoutId);

    for (const placed of packResult.placed) {
      this.layoutItems.push({
        id: this.nextLayoutItemId++,
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

    const containerVolume = ContainerService.calculateVolume(layout.containerType);
    const usagePercent = (packResult.usedVolume / containerVolume) * 100;

    await this.updateLayout(layoutId, {
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

  static async resetLayout(layoutId) {
    const layout = await this.getLayoutById(layoutId);
    if (!layout) throw new Error('Layout not found');

    this.layoutItems = this.layoutItems.filter(i => i.layout_id != layoutId);

    return this.updateLayout(layoutId, {
      total_weight_kg: 0,
      used_volume_cm3: 0,
      item_count: 0,
    });
  }

  static async calculateStats(layoutId) {
    const layout = await this.getLayoutById(layoutId);
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
