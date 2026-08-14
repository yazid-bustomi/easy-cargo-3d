const Project = require('../models/Project');

class ProjectService {
  /**
   * Save or update a project.
   * If `id` is provided and exists, update it (auto-save / manual re-save).
   * Otherwise create a new project.
   */
  static async saveProject(data) {
    const {
      id,
      name,
      containerType,
      products,
      layoutItems,
      itemCount,
      totalWeightKg,
      volumePercent,
    } = data;

    const payload = {
      name,
      container_code: containerType.code || '',
      container_name: containerType.name || '',
      container_length: containerType.length_cm || 0,
      container_width: containerType.width_cm || 0,
      container_height: containerType.height_cm || 0,
      container_max_payload_kg: containerType.max_payload_kg || 0,
      container_tare_weight_kg: containerType.tare_weight_kg || 0,
      container_is_system: containerType.is_system || false,
      products_json: products || [],
      layout_items_json: layoutItems || [],
      item_count: itemCount || 0,
      total_weight_kg: totalWeightKg || 0,
      volume_percent: volumePercent || 0,
    };

    if (id) {
      // Try to update existing
      const existing = await Project.findByPk(id);
      if (existing) {
        await existing.update(payload);
        return existing;
      }
    }

    // Create new
    const project = await Project.create(payload);
    return project;
  }

  /**
   * Get a single project by ID, returning the full snapshot.
   */
  static async getProjectById(id) {
    const project = await Project.findByPk(id);
    if (!project) return null;

    return {
      id: project.id,
      name: project.name,
      containerType: {
        id: project.container_is_system ? 0 : 999,
        code: project.container_code,
        name: project.container_name,
        length_cm: Number(project.container_length),
        width_cm: Number(project.container_width),
        height_cm: Number(project.container_height),
        max_payload_kg: Number(project.container_max_payload_kg),
        tare_weight_kg: Number(project.container_tare_weight_kg),
        is_system: project.container_is_system,
      },
      products: project.products_json,
      layoutItems: project.layout_items_json,
      itemCount: project.item_count,
      totalWeightKg: Number(project.total_weight_kg),
      volumePercent: Number(project.volume_percent),
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    };
  }

  /**
   * List all projects (summary only, no JSON blobs for performance).
   */
  static async getAllProjects() {
    const projects = await Project.findAll({
      attributes: [
        'id',
        'name',
        'container_code',
        'container_name',
        'container_length',
        'container_width',
        'container_height',
        'item_count',
        'total_weight_kg',
        'volume_percent',
        'created_at',
        'updated_at',
      ],
      order: [['updated_at', 'DESC']],
    });

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      containerCode: p.container_code,
      containerName: p.container_name,
      containerSize: `${Number(p.container_length)} × ${Number(p.container_width)} × ${Number(p.container_height)} cm`,
      itemCount: p.item_count,
      totalWeightKg: Number(p.total_weight_kg),
      volumePercent: Number(p.volume_percent),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
  }

  /**
   * Delete a project by ID.
   */
  static async deleteProject(id) {
    const project = await Project.findByPk(id);
    if (!project) throw new Error('Project not found');
    await project.destroy();
    return { success: true };
  }
}

module.exports = ProjectService;
