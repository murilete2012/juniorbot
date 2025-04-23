// backend/server.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const { WebhookClient } = require('dialogflow-fulfillment');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Carrega variáveis de ambiente
dotenv.config();

// Inicializa o app Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração da sessão
app.use(session({
  secret: process.env.SESSION_SECRET || 'junior-bot-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Conexão com MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/junior-bot', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Conectado ao MongoDB'))
.catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// Modelos
const conversationSchema = new mongoose.Schema({
  customer: { type: String, required: true },
  phone: { type: String, required: true },
  messages: [{
    sender: { type: String, enum: ['customer', 'bot'], required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  created_at: { type: Date, default: Date.now }
});

const cartSchema = new mongoose.Schema({
  customer: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  items: [{
    product: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true }
  }],
  total: { type: Number, required: true },
  abandoned_at: { type: Date, default: Date.now },
  recovered: { type: Boolean, default: false }
});

const orderSchema = new mongoose.Schema({
  customer: { type: String, required: true },
  product: { type: String, required: true },
  price: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['Pendente', 'Concluída', 'Cancelada'], default: 'Pendente' }
});

const Conversation = mongoose.model('Conversation', conversationSchema);
const Cart = mongoose.model('Cart', cartSchema);
const Order = mongoose.model('Order', orderSchema);

// Inicialização do cliente WhatsApp
let whatsappClient;
let whatsappReady = false;

// Verifica se existe uma sessão salva
const SESSION_FILE_PATH = path.join(__dirname, 'whatsapp-session.json');
let sessionData;
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionData = require(SESSION_FILE_PATH);
}

// Inicializa o cliente WhatsApp
function initWhatsApp() {
  whatsappClient = new Client({
    session: sessionData,
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  whatsappClient.on('qr', (qr) => {
    console.log('QR Code recebido, escaneie para autenticar:');
    qrcode.generate(qr, { small: true });
  });

  whatsappClient.on('authenticated', (session) => {
    console.log('WhatsApp autenticado!');
    sessionData = session;
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session), 'utf8');
  });

  whatsappClient.on('ready', () => {
    console.log('Cliente WhatsApp pronto!');
    whatsappReady = true;
  });

  whatsappClient.on('message', async (message) => {
    if (message.body && message.from.endsWith('@c.us')) {
      const phone = message.from.replace('@c.us', '');
      
      // Busca ou cria uma conversa para este número
      let conversation = await Conversation.findOne({ phone });
      if (!conversation) {
        const contact = await whatsappClient.getContactById(message.from);
        const customerName = contact.name || phone;
        
        conversation = new Conversation({
          customer: customerName,
          phone,
          messages: []
        });
      }
      
      // Adiciona a mensagem do cliente
      conversation.messages.push({
        sender: 'customer',
        text: message.body,
        timestamp: new Date()
      });
      
      await conversation.save();
      
      // Processa a mensagem com Dialogflow (simulado aqui)
      const botResponse = await processWithDialogflow(message.body, phone);
      
      // Adiciona a resposta do bot
      conversation.messages.push({
        sender: 'bot',
        text: botResponse,
        timestamp: new Date()
      });
      
      await conversation.save();
      
      // Envia a resposta
      whatsappClient.sendMessage(message.from, botResponse);
    }
  });

  whatsappClient.initialize();
}

// Simulação de processamento com Dialogflow
async function processWithDialogflow(message, phone) {
  // Aqui você integraria com Dialogflow
  // Por enquanto, vamos simular respostas básicas
  
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('olá') || lowerMessage.includes('oi') || lowerMessage.includes('bom dia') || lowerMessage.includes('boa tarde')) {
    return `Olá! Como posso ajudar você hoje?`;
  }
  
  if (lowerMessage.includes('preço') || lowerMessage.includes('valor') || lowerMessage.includes('custo')) {
    return `Temos vários produtos com diferentes preços. Poderia me dizer qual produto específico você está interessado?`;
  }
  
  if (lowerMessage.includes('entrega') || lowerMessage.includes('prazo')) {
    return `Nosso prazo de entrega é de 3 a 5 dias úteis após a confirmação do pagamento.`;
  }
  
  if (lowerMessage.includes('pagamento') || lowerMessage.includes('pagar')) {
    return `Aceitamos cartão de crédito, boleto bancário e PIX. Qual forma de pagamento você prefere?`;
  }
  
  if (lowerMessage.includes('tamanho') || lowerMessage.includes('medida')) {
    return `Temos tamanhos P, M, G e GG disponíveis. Qual tamanho você precisa?`;
  }
  
  // Resposta padrão
  return `Obrigado pelo seu contato. Como posso ajudar com sua dúvida sobre "${message}"?`;
}

// Rotas da API
// Conversas
app.get('/api/conversations', async (req, res) => {
  try {
    const conversations = await Conversation.find().sort({ created_at: -1 });
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/conversations/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: 'Conversa não encontrada' });
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/conversations/:id/reply', async (req, res) => {
  try {
    const { message } = req.body;
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) return res.status(404).json({ message: 'Conversa não encontrada' });
    
    // Adiciona a mensagem do bot
    conversation.messages.push({
      sender: 'bot',
      text: message,
      timestamp: new Date()
    });
    
    await conversation.save();
    
    // Envia via WhatsApp se o cliente estiver pronto
    if (whatsappReady) {
      const to = `${conversation.phone}@c.us`;
      await whatsappClient.sendMessage(to, message);
    }
    
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Carrinhos abandonados
app.get('/api/carts/abandoned', async (req, res) => {
  try {
    const carts = await Cart.find({ recovered: false }).sort({ abandoned_at: -1 });
    
    // Calcula dias abandonados
    const cartsWithDays = carts.map(cart => {
      const days = Math.floor((new Date() - new Date(cart.abandoned_at)) / (1000 * 60 * 60 * 24));
      return {
        ...cart.toObject(),
        days_abandoned: days
      };
    });
    
    res.json(cartsWithDays);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/carts/recover/:id', async (req, res) => {
  try {
    const cart = await Cart.findById(req.params.id);
    
    if (!cart) return res.status(404).json({ message: 'Carrinho não encontrado' });
    
    cart.recovered = true;
    await cart.save();
    
    // Envia mensagem de recuperação via WhatsApp
    if (whatsappReady) {
      const to = `${cart.phone}@c.us`;
      const message = `Olá ${cart.customer}! Notamos que você deixou alguns itens no carrinho. Que tal finalizar sua compra? Seu carrinho está esperando por você!`;
      await whatsappClient.sendMessage(to, message);
    }
    
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Pedidos
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ date: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Estatísticas
app.get('/api/stats', async (req, res) => {
  try {
    const totalConversations = await Conversation.countDocuments();
    const totalOrders = await Order.countDocuments();
    const recoveredCarts = await Cart.countDocuments({ recovered: true });
    
    // Cálculo de taxa de conversão
    const conversionRate = totalOrders > 0 && totalConversations > 0 
      ? ((totalOrders / totalConversations) * 100).toFixed(1) 
      : 0;
    
    // Cálculo de receita total
    const orders = await Order.find();
    const totalRevenue = orders.reduce((sum, order) => sum + order.price, 0);
    
    // Produtos mais vendidos
    const productCounts = {};
    const productTotals = {};
    
    orders.forEach(order => {
      if (!productCounts[order.product]) {
        productCounts[order.product] = 0;
        productTotals[order.product] = 0;
      }
      productCounts[order.product]++;
      productTotals[order.product] += order.price;
    });
    
    const productsSold = Object.keys(productCounts).map(product => ({
      product,
      quantity: productCounts[product],
      total: productTotals[product]
    })).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    
    res.json({
      total_conversations: totalConversations,
      total_sales: totalOrders,
      cart_recovery: recoveredCarts,
      response_time_avg: 1.2, // Valor fixo para exemplo
      conversion_rate: parseFloat(conversionRate),
      total_revenue: totalRevenue,
      revenue_growth: 15, // Valor fixo para exemplo
      products_sold: productsSold
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Rota para captura de leads
app.post('/api/leads', async (req, res) => {
  try {
    const { name, phone } = req.body;
    
    // Cria uma nova conversa
    const conversation = new Conversation({
      customer: name,
      phone,
      messages: [{
        sender: 'bot',
        text: 'Olá! Como posso ajudar você hoje?',
        timestamp: new Date()
      }]
    });
    
    await conversation.save();
    
    // Envia mensagem inicial via WhatsApp
    if (whatsappReady) {
      const to = `${phone}@c.us`;
      const message = `Olá ${name}! Obrigado por entrar em contato. Como posso ajudar você hoje?`;
      await whatsappClient.sendMessage(to, message);
    }
    
    res.status(201).json(conversation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Rota para upload de CSV
app.post('/api/upload-csv', async (req, res) => {
  try {
    // Aqui você implementaria a lógica para processar o CSV
    // Por enquanto, vamos simular uma resposta de sucesso
    res.json({ success: true, message: 'CSV processado com sucesso' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Rota para servir o frontend em produção
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// Inicializa o WhatsApp se não estiver em modo de teste
if (process.env.NODE_ENV !== 'test') {
  initWhatsApp();
}

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app; // Para testes
