const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

// Configuração essencial
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Verificação do token do HubSpot
const getHubspotToken = () => {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) {
    console.error('ERRO: Token do HubSpot não encontrado nas variáveis de ambiente');
    return null;
  }
  return token.trim(); // Remove espaços extras, se houver
};

// Health Check
app.get('/api/health', (req, res) => {
  const token = getHubspotToken();
  res.json({ 
    status: 'online', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    hubspot_configured: !!token
  });
});

// Função para verificar se o input é um CNPJ (numérico ou formatado)
function isCNPJ(input) {
  // Remove caracteres não numéricos para verificação
  const cnpjNumerico = input.replace(/[^\d]/g, '');
  
  // Verifica se tem entre 8 e 14 dígitos (aceitamos CNPJs parciais também)
  return /^\d{8,14}$/.test(cnpjNumerico);
}

// Função para normalizar o CNPJ (remover formatação)
function normalizarCNPJ(cnpj) {
  return cnpj.replace(/[^\d]/g, '');
}

// Rota de busca aprimorada para nome ou CNPJ (formatado ou não)
app.post('/api/search', async (req, res) => {
  try {
    const token = getHubspotToken();
    if (!token) {
      return res.status(401).json({
        error: "Token do HubSpot não configurado. Configure a variável de ambiente HUBSPOT_TOKEN."
      });
    }

    const { searchTerm } = req.body;

    if (!searchTerm || searchTerm.trim().length < 3) {
      return res.status(400).json({
        error: "O termo de busca deve conter pelo menos 3 caracteres"
      });
    }

    // Determina se o termo de busca é um CNPJ ou nome
    const isCnpjSearch = isCNPJ(searchTerm);
    
    // Cria o filtro apropriado com base no tipo de busca
    let filterGroups = [];
    
    if (isCnpjSearch) {
      // Se for CNPJ, normaliza para buscar sem formatação
      const cnpjNormalizado = normalizarCNPJ(searchTerm);
      
      // Adiciona filtros para diferentes formatos de CNPJ
      filterGroups = [
        {
          // Busca pelo CNPJ sem formatação
          filters: [{
            propertyName: "cnpj_inteiro",
            operator: "CONTAINS_TOKEN",
            value: cnpjNormalizado
          }]
        },
        {
          // Busca pelo CNPJ formatado
          filters: [{
            propertyName: "cnpj",
            operator: "CONTAINS_TOKEN",
            value: searchTerm
          }]
        }
      ];
    } else {
      // Se for nome, usa o filtro padrão
      filterGroups = [{
        filters: [{
          propertyName: "name",
          operator: "CONTAINS_TOKEN",
          value: searchTerm
        }]
      }];
    }

    const hubspotResponse = await fetch('https://api.hubapi.com/crm/v3/objects/companies/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filterGroups: filterGroups,
        properties: ["name", "city", "state", "phone", "email", "cnpj_inteiro", "cnpj", "codigo_cliente","address","inscricao_estadual"],
        limit: 10
      })
    });

    if (!hubspotResponse.ok) {
      const error = await hubspotResponse.json();
      return res.status(hubspotResponse.status).json({
        source: 'hubspot',
        error: error.message || 'Erro desconhecido na API HubSpot'
      });
    }

    const data = await hubspotResponse.json();
    res.json(data.results || []);

  } catch (error) {
    console.error('Erro crítico:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
});

// Rota de detalhes com validação
app.get('/company/:id', async (req, res) => {
  try {
    const token = getHubspotToken();
    if (!token) {
      return res.status(401).json({
        error: "Token do HubSpot não configurado. Configure a variável de ambiente HUBSPOT_TOKEN."
      });
    }

    const companyId = req.params.id;

    if (!/^\d+$/.test(companyId)) {
      return res.status(400).json({
        error: "ID da empresa inválido"
      });
    }

    const hubspotResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/companies/${companyId}?properties=name,city,state,phone,email,cnpj_inteiro,cnpj,codigo_cliente,address,inscricao_estadual`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!hubspotResponse.ok) {
      const error = await hubspotResponse.json();
      return res.status(hubspotResponse.status).json({
        source: 'hubspot',
        error: error.message || 'Erro desconhecido na API HubSpot'
      });
    }

    const data = await hubspotResponse.json();
    res.json(data);

  } catch (error) {
    console.error('Erro crítico:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor operacional na porta ${PORT}`);
  console.log(`• Health Check: http://localhost:${PORT}/api/health`);
  console.log(`• Modo: ${process.env.NODE_ENV || 'desenvolvimento'}`);
  
  // Verificar se o token está configurado
  const token = getHubspotToken();
  if (!token) {
    console.warn('⚠️ AVISO: Token do HubSpot não encontrado nas variáveis de ambiente');
    console.warn('⚠️ Configure a variável de ambiente HUBSPOT_TOKEN para que a API funcione corretamente');
  } else {
    console.log('• Token do HubSpot: Configurado');
  }
});
