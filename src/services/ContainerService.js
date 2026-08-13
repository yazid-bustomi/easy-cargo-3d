class ContainerService {
  static containers = [
    { id: 1, name: '20ft Standard', code: '20GP', length_cm: 589.8, width_cm: 235.2, height_cm: 239.3, max_payload_kg: 28200, is_system: true, is_custom: false },
    { id: 2, name: '40ft Standard', code: '40GP', length_cm: 1203.2, width_cm: 235.2, height_cm: 239.3, max_payload_kg: 28800, is_system: true, is_custom: false },
    { id: 3, name: '40ft High Cube', code: '40HC', length_cm: 1203.2, width_cm: 235.2, height_cm: 269.8, max_payload_kg: 28600, is_system: true, is_custom: false },
  ];
  static nextContainerId = 4;

  static async getAllContainers(includeCustom = true) {
    if (!includeCustom) return this.containers.filter(c => c.is_system);
    return this.containers;
  }

  static async getContainerById(containerId) {
    return this.containers.find(c => c.id == containerId);
  }

  static async getSystemContainers() {
    return this.containers.filter(c => c.is_system);
  }

  static async createCustomContainer(data, userId) {
    const newContainer = {
      ...data,
      id: this.nextContainerId++,
      is_custom: true,
      is_system: false,
      created_by: userId,
    };
    this.containers.push(newContainer);
    return newContainer;
  }

  static async updateContainer(containerId, data) {
    const idx = this.containers.findIndex(c => c.id == containerId);
    if (idx === -1) throw new Error('Container not found');
    if (this.containers[idx].is_system) throw new Error('Cannot modify system containers');

    this.containers[idx] = { ...this.containers[idx], ...data };
    return this.containers[idx];
  }

  static async deleteContainer(containerId) {
    const idx = this.containers.findIndex(c => c.id == containerId);
    if (idx === -1) throw new Error('Container not found');
    if (this.containers[idx].is_system) throw new Error('Cannot delete system containers');

    this.containers.splice(idx, 1);
    return { success: true };
  }

  static calculateVolume(container) {
    const volume = Number(container.length_cm) * Number(container.width_cm) * Number(container.height_cm);
    return Math.round(volume);
  }

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
