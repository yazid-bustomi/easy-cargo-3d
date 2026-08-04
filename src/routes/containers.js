const express = require('express');
const ContainerController = require('../controllers/ContainerController');

const router = express.Router();

router.get('/', ContainerController.getAll);
router.get('/system', ContainerController.getSystem);
router.get('/:id', ContainerController.getById);
router.post('/custom', ContainerController.createCustom);
router.put('/:id', ContainerController.update);
router.delete('/:id', ContainerController.delete);

module.exports = router;
