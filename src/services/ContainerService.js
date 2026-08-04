const { ContainerType } = require('../models');

class ContainerService {
  /**
   * Get all container types
   */
  static async getAllContainers(includeCustom = true) {
    const where = {};
    if (!includeCustom) where.is_system = true;

    return ContainerType.findAll({
      where,
      order: [['code', 'ASC']],
    });
  }

  /**
   * Get container by ID
   */
  static async getContainerById(containerId) {
    return ContainerType.findByPk(containerId);
  }

  /**
   * Get system containers (20', 40', 40'HC)
   */
  static async getSystemContainers() {
    return ContainerType.findAll({
      where: { is_system: true },
      order: [['code', 'ASC']],
    });
  }

  /**
   * Create custom container
   */
  static async createCustomContainer(data, userId) {
    return ContainerType.create({
      ...data,
      is_custom: true,
      is_system: false,
      created_by: userId,
    });
  }

  /**
   * Update container (only custom ones allowed for updates)
   */
  static async updateContainer(containerId, data) {
    const container = await ContainerType.findByPk(containerId);
    if (!container) throw new Error('Container not found');
    if (container.is_system) throw new Error('Cannot modify system containers');

    return container.update(data);
  }

  /**
   * Delete custom container
   */
  static async deleteContainer(containerId) {
    const container = await ContainerType.findByPk(containerId);
    if (!container) throw new Error('Container not found');
    if (container.is_system) throw new Error('Cannot delete system containers');

    return container.destroy();
  }

  /**
   * Calculate container volume in cm³
   */
  static calculateVolume(container) {
    const volume = Number(container.length_cm) * Number(container.width_cm) * Number(container.height_cm);
    return Math.round(volume);
  }

  /**
   * Get container with dimensions for bin packing
   */
  static formatForBinPacking(container) {
    return {
      length: Number(container.length_cm),
      width: Number(container.width_cm),
      height: Number(container.height_cm),
      maxPayloadKg: Number(container.max_payload_kg),
    };
  }
}

module.exports = ContainerService;
