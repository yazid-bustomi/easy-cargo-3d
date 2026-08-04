const express = require('express');
const ProductController = require('../controllers/ProductController');

const router = express.Router();

// Products
router.get('/', ProductController.getAll);
router.get('/grouped', ProductController.getGrouped);
router.get('/:id', ProductController.getById);
router.post('/', ProductController.create);
router.put('/:id', ProductController.update);
router.delete('/:id', ProductController.delete);

// Bulk operations
router.put('/bulk/quantities', ProductController.bulkUpdateQuantities);

// Product Groups
router.post('/groups', ProductController.createGroup);
router.put('/groups/:id', ProductController.updateGroup);

module.exports = router;
