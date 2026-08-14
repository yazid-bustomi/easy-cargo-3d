const ProjectService = require('../services/ProjectService');

class ProjectController {
  /**
   * GET /api/projects
   * List all saved projects (summary, no JSON blobs).
   */
  static async getAll(req, res) {
    try {
      const projects = await ProjectService.getAllProjects();
      res.json({ success: true, data: projects });
    } catch (error) {
      console.error('ProjectController.getAll error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/projects/:id
   * Load a single project with full state (products + layout items).
   */
  static async getById(req, res) {
    try {
      const project = await ProjectService.getProjectById(parseInt(req.params.id));
      if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }
      res.json({ success: true, data: project });
    } catch (error) {
      console.error('ProjectController.getById error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/projects/save
   * Save or update a project (used for both manual save and auto-save).
   */
  static async save(req, res) {
    try {
      const {
        id,
        name,
        containerType,
        products,
        layoutItems,
        itemCount,
        totalWeightKg,
        volumePercent,
      } = req.body;

      if (!name || !containerType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name and containerType',
        });
      }

      const project = await ProjectService.saveProject({
        id: id || null,
        name,
        containerType,
        products: products || [],
        layoutItems: layoutItems || [],
        itemCount: itemCount || 0,
        totalWeightKg: totalWeightKg || 0,
        volumePercent: volumePercent || 0,
      });

      res.json({
        success: true,
        data: {
          id: project.id,
          name: project.name,
          updatedAt: project.updated_at,
        },
      });
    } catch (error) {
      console.error('ProjectController.save error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/projects/:id
   */
  static async delete(req, res) {
    try {
      await ProjectService.deleteProject(parseInt(req.params.id));
      res.json({ success: true, message: 'Project deleted' });
    } catch (error) {
      console.error('ProjectController.delete error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = ProjectController;
