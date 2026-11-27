function autenticar(req, res, next) {
  if (!req.session || !req.session.usuarioId) {
    return res.status(401).json({
      erro: {
        codigo: 'NAO_AUTENTICADO',
        mensagem: 'Autenticação necessária para acessar este recurso.',
      },
    });
  }
  return next();
}

module.exports = autenticar;
