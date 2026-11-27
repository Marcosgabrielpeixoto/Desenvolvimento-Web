const express = require('express');
const viagemController = require('../controllers/viagemController');
const atividadeController = require('../controllers/atividadeController');
const despesaController = require('../controllers/despesaController');
const autenticar = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(autenticar);

router.get('/', viagemController.listar);
router.post('/', viagemController.criar);
router.get('/:id', viagemController.buscarPorId);
router.put('/:id', viagemController.atualizar);
router.delete('/:id', viagemController.excluir);

router.get('/:id/atividades', atividadeController.listarPorViagem);
router.post('/:id/atividades', atividadeController.criar);

router.get('/:id/despesas', despesaController.listarPorViagem);
router.post('/:id/despesas', despesaController.criar);
router.get('/:id/resumo', despesaController.obterResumo);

module.exports = router;
