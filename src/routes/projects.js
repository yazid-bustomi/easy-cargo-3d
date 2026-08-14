const express = require('express');
const ProjectController = require('../controllers/ProjectController');

const router = express.Router();

// List all projects
router.get('/', ProjectController.getAll);

// Save/upsert a project (must be before /:id to avoid conflict)
router.post('/save', ProjectController.save);

// Get single project by ID
router.get('/:id', ProjectController.getById);

// Delete a project
router.delete('/:id', ProjectController.delete);

module.exports = router;
