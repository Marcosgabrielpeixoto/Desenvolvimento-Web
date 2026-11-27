const express = require('express');
const viagemController = require('../controllers/viagemController');
const autenticar = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(autenticar);

router.get('/', viagemController.listar);
router.post('/', viagemController.criar);
router.get('/:id', viagemController.buscarPorId);
router.put('/:id', viagemController.atualizar);
router.delete('/:id', viagemController.excluir);

module.exports = router;
