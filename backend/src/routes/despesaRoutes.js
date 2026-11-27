const express = require('express');
const despesaController = require('../controllers/despesaController');
const autenticar = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(autenticar);

router.put('/:id', despesaController.atualizar);
router.delete('/:id', despesaController.excluir);

module.exports = router;
