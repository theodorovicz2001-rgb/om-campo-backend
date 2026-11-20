const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/omcampo';
const ADMIN_SENHA = process.env.ADMIN_SENHA || 'dorvix2024';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => {
    console.error('Erro MongoDB:', err);
    process.exit(1);
  });

const AtivoSchema = new mongoose.Schema({
  codigo: { type: String, required: true },
  descricao: { type: String, required: true },
  cliente: String,
  local: String,
  serie: String
}, { timestamps: true });

const OmSchema = new mongoose.Schema({
  idLocal: Number,
  ativoId: Number,
  tipo: String,
  defeito: String,
  status: String,
  tecnico: String,
  data: String,
  servico: String,
  pecas: String,
  inicio: String,
  fim: String,
  fotos: [String],
  assinatura: String,
  sincronizadoEm: { type: Date, default: Date.now }
}, { timestamps: true });

const Ativo = mongoose.model('Ativo', AtivoSchema);
const OM = mongoose.model('OM', OmSchema);

function authAdmin(req, res, next) {
  const senha = req.headers['x-admin-senha'];
  if (senha !== ADMIN_SENHA) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }
  next();
}

app.post('/api/ativos', async (req, res) => {
  try {
    const ativos = req.body;
    if (!Array.isArray(ativos)) {
      return res.status(400).json({ erro: 'Esperado array de ativos' });
    }
    for (const a of ativos) {
      await Ativo.findOneAndUpdate(
        { codigo: a.codigo },
        { codigo: a.codigo, descricao: a.descricao, cliente: a.cliente, local: a.local, serie: a.serie },
        { upsert: true, new: true }
      );
    }
    res.json({ sucesso: true, importados: ativos.length });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/ativos', async (req, res) => {
  try {
    const ativos = await Ativo.find().sort({ codigo: 1 });
    res.json(ativos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/oms', async (req, res) => {
  try {
    const oms = req.body;
    if (!Array.isArray(oms)) {
      return res.status(400).json({ erro: 'Esperado array de OMs' });
    }
    const salvos = [];
    for (const om of oms) {
      const salvo = await OM.findOneAndUpdate(
        { idLocal: om.idLocal, tecnico: om.tecnico },
        { ...om, sincronizadoEm: new Date() },
        { upsert: true, new: true }
      );
      salvos.push(salvo);
    }
    res.json({ sucesso: true, sincronizadas: salvos.length });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/oms', authAdmin, async (req, res) => {
  try {
    const { tecnico, status, cliente, dataInicio, dataFim } = req.query;
    const filtro = {};
    if (tecnico) filtro.tecnico = new RegExp(tecnico, 'i');
    if (status) filtro.status = status;
    if (cliente) filtro.cliente = new RegExp(cliente, 'i');
    if (dataInicio || dataFim) {
      filtro.createdAt = {};
      if (dataInicio) filtro.createdAt.$gte = new Date(dataInicio);
      if (dataFim) filtro.createdAt.$lte = new Date(dataFim + 'T23:59:59');
    }
    const oms = await OM.find(filtro).sort({ createdAt: -1 });
    res.json(oms);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/dashboard', authAdmin, async (req, res) => {
  try {
    const total = await OM.countDocuments();
    const pendentes = await OM.countDocuments({ status: 'pendente' });
    const andamento = await OM.countDocuments({ status: 'andamento' });
    const concluidas = await OM.countDocuments({ status: 'concluida' });
    const tecnicos = await OM.distinct('tecnico');
    res.json({ total, pendentes, andamento, concluidas, tecnicos: tecnicos.length });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
