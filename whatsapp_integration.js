// Configuração da integração com WhatsApp
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Inicialização do cliente WhatsApp
class WhatsAppClient {
  constructor() {
    this.client = null;
    this.ready = false;
    this.sessionDir = path.join(__dirname, '.wwebjs_auth');
  }

  initialize() {
    // Verifica se o diretório de sessão existe
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }

    // Inicializa o cliente WhatsApp
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    // Evento de QR Code
    this.client.on('qr', (qr) => {
      console.log('QR Code recebido, escaneie para autenticar:');
      qrcode.generate(qr, { small: true });
    });

    // Evento de autenticação
    this.client.on('authenticated', () => {
      console.log('WhatsApp autenticado com sucesso!');
    });

    // Evento de pronto
    this.client.on('ready', () => {
      console.log('Cliente WhatsApp pronto para uso!');
      this.ready = true;
    });

    // Inicializa o cliente
    this.client.initialize();
  }

  // Método para enviar mensagem
  async sendMessage(to, message) {
    if (!this.ready) {
      console.warn('Cliente WhatsApp não está pronto. Mensagem não enviada.');
      return false;
    }

    try {
      // Formata o número se necessário
      if (!to.endsWith('@c.us')) {
        to = `${to}@c.us`;
      }

      // Envia a mensagem
      await this.client.sendMessage(to, message);
      return true;
    } catch (error) {
      console.error('Erro ao enviar mensagem WhatsApp:', error);
      return false;
    }
  }

  // Método para enviar mensagem em massa
  async sendBulkMessages(numbers, message, rotationDelay = 5000) {
    if (!this.ready) {
      console.warn('Cliente WhatsApp não está pronto. Mensagens em massa não enviadas.');
      return { success: false, sent: 0, failed: numbers.length };
    }

    const results = {
      success: true,
      sent: 0,
      failed: 0,
      details: []
    };

    for (const number of numbers) {
      try {
        // Formata o número se necessário
        let to = number;
        if (!to.endsWith('@c.us')) {
          to = `${to}@c.us`;
        }

        // Envia a mensagem
        await this.client.sendMessage(to, message);
        
        results.sent++;
        results.details.push({
          number,
          status: 'sent',
          timestamp: new Date()
        });

        // Aguarda um tempo entre mensagens para evitar bloqueio
        await new Promise(resolve => setTimeout(resolve, rotationDelay));
      } catch (error) {
        console.error(`Erro ao enviar mensagem para ${number}:`, error);
        results.failed++;
        results.details.push({
          number,
          status: 'failed',
          error: error.message,
          timestamp: new Date()
        });
      }
    }

    return results;
  }

  // Método para extrair números de um grupo
  async extractGroupNumbers(groupId) {
    if (!this.ready) {
      console.warn('Cliente WhatsApp não está pronto. Extração de números não realizada.');
      return { success: false, numbers: [] };
    }

    try {
      // Formata o ID do grupo se necessário
      if (!groupId.endsWith('@g.us')) {
        groupId = `${groupId}@g.us`;
      }

      // Obtém informações do grupo
      const group = await this.client.getChatById(groupId);
      
      // Verifica se é um grupo
      if (!group.isGroup) {
        return { success: false, error: 'ID fornecido não é de um grupo', numbers: [] };
      }

      // Obtém participantes
      const participants = await group.participants;
      
      // Extrai os números
      const numbers = participants.map(p => p.id.user);
      
      return { 
        success: true, 
        groupName: group.name,
        participantCount: numbers.length,
        numbers 
      };
    } catch (error) {
      console.error('Erro ao extrair números do grupo:', error);
      return { success: false, error: error.message, numbers: [] };
    }
  }

  // Método para criar um grupo
  async createGroup(name, participants) {
    if (!this.ready) {
      console.warn('Cliente WhatsApp não está pronto. Criação de grupo não realizada.');
      return { success: false, error: 'Cliente não está pronto' };
    }

    try {
      // Formata os números dos participantes
      const formattedParticipants = participants.map(p => {
        if (!p.endsWith('@c.us')) {
          return `${p}@c.us`;
        }
        return p;
      });

      // Cria o grupo
      const result = await this.client.createGroup(name, formattedParticipants);
      
      return { 
        success: true, 
        groupId: result.gid._serialized,
        groupName: name,
        participantCount: formattedParticipants.length
      };
    } catch (error) {
      console.error('Erro ao criar grupo:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new WhatsAppClient();
