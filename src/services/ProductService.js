class ProductService {
  static products = [];
  static groups = [
    { id: 1, name: 'General', color_hex: '#3B82F6', sort_order: 1, is_collapsed: false }
  ];
  static nextProductId = 1;
  static nextGroupId = 2;

  static async getAllProducts(groupId = null) {
    let filtered = this.products.filter(p => p.is_active !== false);
    if (groupId) filtered = filtered.filter(p => p.group_id == groupId);
    
    return filtered.map(p => ({
      ...p,
      group: this.groups.find(g => g.id == p.group_id)
    })).sort((a, b) => (a.sku || '').localeCompare(b.sku || ''));
  }

  static async getProductById(productId) {
    const product = this.products.find(p => p.id == productId);
    if (!product) return null;
    return {
      ...product,
      group: this.groups.find(g => g.id == product.group_id)
    };
  }

  static async createProduct(data, userId) {
    const newProduct = {
      ...data,
      id: this.nextProductId++,
      created_by: userId,
      is_active: true
    };
    this.products.push(newProduct);
    return newProduct;
  }

  static async updateProduct(productId, data) {
    const idx = this.products.findIndex(p => p.id == productId);
    if (idx === -1) throw new Error('Product not found');

    this.products[idx] = { ...this.products[idx], ...data };
    return this.products[idx];
  }

  static async deleteProduct(productId) {
    const idx = this.products.findIndex(p => p.id == productId);
    if (idx === -1) throw new Error('Product not found');

    this.products[idx].is_active = false;
    return this.products[idx];
  }

  static async getProductsGrouped() {
    return this.groups.map(g => ({
      ...g,
      products: this.products.filter(p => p.group_id == g.id && p.is_active !== false)
    })).sort((a, b) => a.sort_order - b.sort_order);
  }

  static async updateProductGroup(groupId, data) {
    const idx = this.groups.findIndex(g => g.id == groupId);
    if (idx === -1) throw new Error('Product group not found');

    this.groups[idx] = { ...this.groups[idx], ...data };
    return this.groups[idx];
  }

  static async createProductGroup(data, userId) {
    const newGroup = {
      ...data,
      id: this.nextGroupId++,
      created_by: userId,
      is_collapsed: false
    };
    this.groups.push(newGroup);
    return newGroup;
  }

  static async updateProductQuantities(updates) {
    const results = [];
    for (const { productId, qty } of updates) {
      const idx = this.products.findIndex(p => p.id == productId);
      if (idx !== -1) {
        this.products[idx].qty = qty;
        results.push(this.products[idx]);
      }
    }
    return results;
  }
}

module.exports = ProductService;
