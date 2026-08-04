const express = require('express');
const LayoutController = require('../controllers/LayoutController');

const router = express.Router();

// Layouts
router.get('/', LayoutController.getAll);
router.get('/:id', LayoutController.getById);
router.post('/', LayoutController.create);
router.put('/:id', LayoutController.update);
router.delete('/:id', LayoutController.delete);

// Layout Operations
router.post('/:id/auto-pack', LayoutController.autoPack);
router.post('/:id/reset', LayoutController.reset);
router.get('/:id/stats', LayoutController.getStats);

// Layout Items
router.post('/:id/items', LayoutController.addItem);
router.put('/items/:itemId', LayoutController.updateItem);
router.delete('/items/:itemId', LayoutController.removeItem);

module.exports = router;
