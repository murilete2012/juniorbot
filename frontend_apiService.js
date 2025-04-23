// frontend/src/api/apiService.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiService = {
  // Configuração do axios com credenciais
  axiosInstance: axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json'
    }
  }),

  // Conversas
  async getConversations() {
    try {
      const response = await this.axiosInstance.get('/conversations');
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar conversas:', error);
      throw error;
    }
  },

  async getConversation(id) {
    try {
      const response = await this.axiosInstance.get(`/conversations/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Erro ao buscar conversa ${id}:`, error);
      throw error;
    }
  },

  async replyToConversation(id, message) {
    try {
      const response = await this.axiosInstance.post(`/conversations/${id}/reply`, { message });
      return response.data;
    } catch (error) {
      console.error(`Erro ao responder conversa ${id}:`, error);
      throw error;
    }
  },

  // Carrinhos abandonados
  async getAbandonedCarts() {
    try {
      const response = await this.axiosInstance.get('/carts/abandoned');
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar carrinhos abandonados:', error);
      throw error;
    }
  },

  async recoverCart(id) {
    try {
      const response = await this.axiosInstance.post(`/carts/recover/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Erro ao recuperar carrinho ${id}:`, error);
      throw error;
    }
  },

  // Pedidos
  async getOrders() {
    try {
      const response = await this.axiosInstance.get('/orders');
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
      throw error;
    }
  },

  // Estatísticas
  async getStats() {
    try {
      const response = await this.axiosInstance.get('/stats');
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  },

  // Captura de leads
  async createLead(name, phone) {
    try {
      const response = await this.axiosInstance.post('/leads', { name, phone });
      return response.data;
    } catch (error) {
      console.error('Erro ao criar lead:', error);
      throw error;
    }
  },

  // Upload de CSV
  async uploadCSV(formData) {
    try {
      const response = await this.axiosInstance.post('/upload-csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao fazer upload de CSV:', error);
      throw error;
    }
  }
};

export default apiService;
