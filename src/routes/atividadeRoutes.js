const express = require('express');
const atividadeController = require('../controllers/atividadeController');
const autenticar = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(autenticar);

router.put('/:id', atividadeController.atualizar);
router.patch('/:id/conclusao', atividadeController.alterarConclusao);
router.delete('/:id', atividadeController.excluir);

module.exports = router;
