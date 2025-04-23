// frontend/src/components/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import apiService from '../api/apiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
  const [stats, setStats] = useState({
    total_conversations: 0,
    total_sales: 0,
    cart_recovery: 0,
    response_time_avg: 0,
    conversion_rate: 0,
    total_revenue: 0,
    revenue_growth: 0,
    products_sold: []
  });
  
  const [conversations, setConversations] = useState([]);
  const [abandonedCarts, setAbandonedCarts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leadForm, setLeadForm] = useState({ name: '', whatsapp: '' });
  const [csvFile, setCsvFile] = useState(null);
  const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Busca estatísticas
        const statsData = await apiService.getStats();
        setStats(statsData);
        
        // Busca conversas
        const conversationsData = await apiService.getConversations();
        setConversations(conversationsData);
        
        // Busca carrinhos abandonados
        const cartsData = await apiService.getAbandonedCarts();
        setAbandonedCarts(cartsData);
        
        // Busca pedidos
        const ordersData = await apiService.getOrders();
        setOrders(ordersData);
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiService.createLead(leadForm.name, leadForm.whatsapp);
      setLeadForm({ name: '', whatsapp: '' });
      setIsLeadDialogOpen(false);
      // Recarrega as conversas
      const conversationsData = await apiService.getConversations();
      setConversations(conversationsData);
    } catch (error) {
      console.error('Erro ao criar lead:', error);
    }
  };

  const handleCsvUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) return;
    
    const formData = new FormData();
    formData.append('csv', csvFile);
    
    try {
      await apiService.uploadCSV(formData);
      setCsvFile(null);
      // Recarrega os dados
      const conversationsData = await apiService.getConversations();
      setConversations(conversationsData);
    } catch (error) {
      console.error('Erro ao fazer upload de CSV:', error);
    }
  };

  const handleRecoverCart = async (id) => {
    try {
      await apiService.recoverCart(id);
      // Recarrega os carrinhos abandonados
      const cartsData = await apiService.getAbandonedCarts();
      setAbandonedCarts(cartsData);
      // Atualiza estatísticas
      const statsData = await apiService.getStats();
      setStats(statsData);
    } catch (error) {
      console.error(`Erro ao recuperar carrinho ${id}:`, error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_conversations}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_sales}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recuperações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cart_recovery}</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Gráfico de produtos mais vendidos */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Produtos Mais Vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.products_sold}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="product" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantity" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      {/* Tabs para diferentes seções */}
      <Tabs defaultValue="conversations" className="mb-6">
        <TabsList className="mb-4">
          <TabsTrigger value="conversations">Conversas</TabsTrigger>
          <TabsTrigger value="carts">Carrinhos Abandonados</TabsTrigger>
          <TabsTrigger value="orders">Pedidos</TabsTrigger>
        </TabsList>
        
        {/* Tab de Conversas */}
        <TabsContent value="conversations">
          <Card>
            <CardHeader>
              <CardTitle>Conversas Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Última Mensagem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversations.slice(0, 5).map((conversation) => (
                    <TableRow key={conversation.id}>
                      <TableCell>{conversation.customer}</TableCell>
                      <TableCell>
                        {conversation.messages.length > 0
                          ? conversation.messages[conversation.messages.length - 1].text.substring(0, 30) + '...'
                          : 'Sem mensagens'}
                      </TableCell>
                      <TableCell>{conversation.status === 'active' ? 'Ativa' : 'Fechada'}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">Ver Detalhes</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tab de Carrinhos Abandonados */}
        <TabsContent value="carts">
          <Card>
            <CardHeader>
              <CardTitle>Carrinhos Abandonados</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abandonedCarts.map((cart) => (
                    <TableRow key={cart.id}>
                      <TableCell>{cart.customer}</TableCell>
                      <TableCell>R$ {cart.total.toFixed(2)}</TableCell>
                      <TableCell>{cart.days_abandoned}</TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleRecoverCart(cart.id)}
                        >
                          Recuperar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tab de Pedidos */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Pedidos Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.slice(0, 5).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.customer}</TableCell>
                      <TableCell>{order.product}</TableCell>
                      <TableCell>R$ {order.price.toFixed(2)}</TableCell>
                      <TableCell>{order.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Seção de Captura de Leads */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Captura de Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <Dialog open={isLeadDialogOpen} onOpenChange={setIsLeadDialogOpen}>
            <DialogTrigger asChild>
              <Button>Adicionar Lead</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Lead</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleLeadSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={leadForm.name}
                    onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={leadForm.whatsapp}
                    onChange={(e) => setLeadForm({ ...leadForm, whatsapp: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit">Enviar</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      
      {/* Seção de Upload de CSV */}
      <Card>
        <CardHeader>
          <CardTitle>Upload de CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCsvUpload} className="space-y-4">
            <div>
              <Label htmlFor="csv">Arquivo CSV</Label>
              <Input
                id="csv"
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files[0])}
                required
              />
            </div>
            <Button type="submit">Enviar</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
