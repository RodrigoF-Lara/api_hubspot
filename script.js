        // --- Configurações --- //
        const API_URL_HUBSPOT = 'https://api-hubspot.vercel.app'; // !!! SUBSTITUA PELO SEU ENDPOINT REAL !!!
        const API_URL_CNPJ = 'https://publica.cnpj.ws/cnpj/'; // API Pública

        // --- Elementos DOM --- //
        const hubspotSearchInput = document.getElementById('hubspot-search');
        const hubspotSearchButton = document.getElementById('hubspot-search-btn');
        const hubspotClearButton = document.getElementById('hubspot-clear-btn');
        const hubspotResultsList = document.getElementById('hubspot-results');
        const hubspotMessageElement = document.getElementById('hubspot-message');

        const cnpjSearchInput = document.getElementById('cnpj-search');
        const cnpjSearchButton = document.getElementById('cnpj-search-btn');
        const cnpjClearButton = document.getElementById('cnpj-clear-btn');
        const cnpjMessageElement = document.getElementById('cnpj-message');
        
        const companyDetailsSection = document.getElementById('company-details');

        // --- Event Listeners --- //
        let hubspotSearchTimeout;
        hubspotSearchInput.addEventListener('input', () => {
            clearTimeout(hubspotSearchTimeout);
            // Adiciona um pequeno delay para não buscar a cada tecla
            hubspotSearchTimeout = setTimeout(() => {
                 handleHubspotSearch();
            }, 300); 
        });

        hubspotSearchButton.addEventListener('click', handleHubspotSearch);
        hubspotClearButton.addEventListener('click', clearHubspotSearch);

        cnpjSearchButton.addEventListener('click', handleCnpjSearch);
        cnpjClearButton.addEventListener('click', clearCnpjSearch);
        cnpjSearchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                handleCnpjSearch();
            }
        });

        // --- Funções para Consulta HubSpot --- //
        async function handleHubspotSearch() {
            const searchTerm = hubspotSearchInput.value.trim();
            hubspotResultsList.innerHTML = '';
            hubspotResultsList.style.display = 'none';
            companyDetailsSection.style.display = 'none';
            hideMessage(hubspotMessageElement);

            if (searchTerm.length < 3) { // Não busca com menos de 3 caracteres
                if (searchTerm.length > 0) {
                    showMessage(hubspotMessageElement, 'Digite pelo menos 3 caracteres para buscar.', 'error');
                }
                return;
            }

            showMessage(hubspotMessageElement, 'Buscando no HubSpot...', 'loading');

            try {
                // !!! IMPORTANTE: Adapte esta chamada à sua API real !!!
                const response = await fetch(`${API_URL_HUBSPOT}/api/search`, { // Exemplo de endpoint
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // Adicione headers de autenticação se necessário
                    },
                    body: JSON.stringify({ searchTerm })
                });
    
                if (!response.ok) {
                    const errorText = await response.text();
                    let errorMessage = `Erro HTTP: ${response.status}`;
                    try { 
                        const errorData = JSON.parse(errorText);
                        errorMessage = errorData.error || errorData.message || errorMessage;
                    } catch (e) { /* Ignora se não for JSON */ }
                    throw new Error(errorMessage);
                }
                    
                const results = await response.json();
                displayHubspotResults(results);
                hideMessage(hubspotMessageElement);

            } catch (error) {
                console.error('Erro na busca HubSpot:', error);
                showMessage(hubspotMessageElement, `Erro na busca HubSpot: ${error.message}`, 'error');
                hubspotResultsList.style.display = 'none';
            }
        }
    
        // Exibe os resultados da busca HubSpot
        function displayHubspotResults(results) {
            hubspotResultsList.innerHTML = '';
            if (!results || results.length === 0) {
                const li = document.createElement('li');
                li.className = 'result-item';
                li.textContent = 'Nenhuma empresa encontrada no HubSpot.';
                hubspotResultsList.appendChild(li);
                hubspotResultsList.style.display = 'block';
                return;
            }

            results.forEach(company => {
                const li = document.createElement('li');
                li.className = 'result-item';
                
                // Adapte as propriedades conforme sua API HubSpot retorna
                const props = company.properties || company; 
                const name = props.name || 'Nome não disponível';
                const city = props.city || '';
                const state = props.state || '';
                const location = city || state ? ` - ${city}${state ? '/' + state : ''}` : '';
                const cnpj = props.cnpj_inteiro ? ` (CNPJ: ${formatCnpj(props.cnpj_inteiro)})` : ''; // Assumindo que tem CNPJ
                
                li.textContent = `${name}${location}${cnpj}`;
                
                // Adapte o ID ou a forma de carregar detalhes
                li.onclick = () => loadHubspotCompanyDetails(company.id || props.hs_object_id); 
                hubspotResultsList.appendChild(li);
            });
            hubspotResultsList.style.display = 'block';
        }
        
        // Carrega detalhes da empresa selecionada no HubSpot
        async function loadHubspotCompanyDetails(companyId) {
            showMessage(hubspotMessageElement, 'Carregando detalhes do HubSpot...', 'loading');
            companyDetailsSection.innerHTML = ''; // Limpa detalhes anteriores
            companyDetailsSection.style.display = 'none';

            try {
                 // !!! IMPORTANTE: Adapte esta chamada à sua API real !!!
                const response = await fetch(`${API_URL_HUBSPOT}/company/${companyId}`); // Exemplo
                
                if (!response.ok) {
                    const errorText = await response.text();
                    let errorMessage = `Erro HTTP: ${response.status}`;
                     try { 
                        const errorData = JSON.parse(errorText);
                        errorMessage = errorData.error || errorData.message || errorMessage;
                    } catch (e) { /* Ignora se não for JSON */ }
                    throw new Error(errorMessage);
                }
                
                const data = await response.json();
                displayCompanyDetails(data.properties || data, 'HubSpot'); // Passa 'HubSpot' como origem
                hideMessage(hubspotMessageElement);
                hubspotResultsList.innerHTML = '';
                hubspotResultsList.style.display = 'none';

            } catch (error) {
                console.error('Erro ao carregar detalhes HubSpot:', error);
                showMessage(hubspotMessageElement, `Erro ao carregar detalhes: ${error.message}`, 'error');
                companyDetailsSection.style.display = 'none';
            }
        }

        // Função para limpar a busca HubSpot
        function clearHubspotSearch() {
            hubspotSearchInput.value = '';
            hubspotResultsList.innerHTML = '';
            hubspotResultsList.style.display = 'none';
            companyDetailsSection.style.display = 'none';
            hideMessage(hubspotMessageElement);
        }

        // --- Funções para Consulta CNPJ (API Pública) --- //
        async function handleCnpjSearch() {
            const cnpjValue = cnpjSearchInput.value.replace(/\D/g, ''); // Remove não dígitos
            companyDetailsSection.innerHTML = ''; // Limpa detalhes anteriores
            companyDetailsSection.style.display = 'none';
            hideMessage(cnpjMessageElement);

            if (cnpjValue.length !== 14) {
                showMessage(cnpjMessageElement, 'Por favor, digite um CNPJ válido com 14 números.', 'error');
                return;
            }

            showMessage(cnpjMessageElement, 'Consultando CNPJ na Receita Federal...', 'loading');

            try {
                const response = await fetch(`${API_URL_CNPJ}${cnpjValue}`);

                if (response.status === 404) {
                     throw new Error('CNPJ não encontrado na base de dados.');
                } else if (response.status === 429) {
                    throw new Error('Muitas requisições. Tente novamente mais tarde.');
                } else if (!response.ok) {
                    let errorMsg = `Erro ${response.status}`; 
                    try {
                        const errorData = await response.json();
                        errorMsg += `: ${errorData?.message || response.statusText}`;
                    } catch(e) { errorMsg += `: ${response.statusText}`; }
                    throw new Error(errorMsg);
                }

                const data = await response.json();
                displayCompanyDetails(data, 'CNPJ'); // Passa 'CNPJ' como origem
                hideMessage(cnpjMessageElement);

            } catch (error) {
                console.error('Erro na consulta CNPJ:', error);
                showMessage(cnpjMessageElement, `Erro na consulta CNPJ: ${error.message}`, 'error');
                companyDetailsSection.style.display = 'none';
            }
        }

        // Função para limpar a busca CNPJ
        function clearCnpjSearch() {
            cnpjSearchInput.value = '';
            companyDetailsSection.style.display = 'none';
            hideMessage(cnpjMessageElement);
        }

        // --- Funções Comuns --- //

        // Exibe os detalhes da empresa (adaptado para ambas as fontes)
        function displayCompanyDetails(data, source) {
            companyDetailsSection.innerHTML = ''; // Limpa conteúdo anterior
            companyDetailsSection.style.display = 'block';

            const title = document.createElement('h2');
            title.innerHTML = `<i class="fas fa-building"></i> Detalhes da Empresa (${source})`;
            companyDetailsSection.appendChild(title);

            // Mapeamento de campos (exemplo, ajuste conforme necessário)
            const detailsMap = {
                'Informações Básicas': {
                    icon: 'fa-info-circle',
                    fields: {
                        'Razão Social': source === 'CNPJ' ? data.razao_social : data.name,
                        'Nome Fantasia': source === 'CNPJ' ? data.estabelecimento?.nome_fantasia : data.nome_fantasia, // Exemplo
                        'CNPJ': source === 'CNPJ' ? formatCnpj(data.estabelecimento?.cnpj) : formatCnpj(data.cnpj_inteiro),
                        'Situação': source === 'CNPJ' ? data.estabelecimento?.situacao_cadastral : data.situacao, // Exemplo
                        'Código Cliente (HubSpot)': source === 'HubSpot' ? data.codigo_cliente : null // Campo específico HubSpot
                    }
                },
                'Endereço': {
                    icon: 'fa-map-marker-alt',
                    fields: {
                        'Logradouro': source === 'CNPJ' ? data.estabelecimento?.logradouro : data.address,
                        'Número': source === 'CNPJ' ? data.estabelecimento?.numero : data.address_number,
                        'Complemento': source === 'CNPJ' ? data.estabelecimento?.complemento : data.address_complement,
                        'Bairro': source === 'CNPJ' ? data.estabelecimento?.bairro : data.address_district,
                        'Cidade': source === 'CNPJ' ? data.estabelecimento?.cidade?.nome : data.city,
                        'UF': source === 'CNPJ' ? data.estabelecimento?.estado?.sigla : data.state,
                        'CEP': source === 'CNPJ' ? formatCep(data.estabelecimento?.cep) : data.zip
                    }
                },
                'Contato': {
                    icon: 'fa-phone-alt',
                    fields: {
                        'Telefone': source === 'CNPJ' ? formatPhone(data.estabelecimento?.ddd1, data.estabelecimento?.telefone1) : data.phone,
                        'Email': source === 'CNPJ' ? data.estabelecimento?.email : data.email
                    }
                },
                'Atividades': {
                    icon: 'fa-briefcase',
                    fields: {
                        'Atividade Principal': source === 'CNPJ' ? data.estabelecimento?.atividade_principal?.descricao : data.industry,
                        'Atividades Secundárias': source === 'CNPJ' ? (data.estabelecimento?.atividades_secundarias?.map(a => a.descricao).join(', ') || null) : null
                    }
                },
                 'Sócios (QSA)': {
                    icon: 'fa-users',
                    isList: true,
                    source: 'CNPJ', // Sócios vêm apenas da API CNPJ
                    items: data.socios
                }
            };

            // Função auxiliar para criar e adicionar um item de informação ao grid
            function addInfoItem(grid, label, value) {
                if (value !== null && value !== undefined && value !== '') {
                    const infoItem = document.createElement('div');
                    infoItem.classList.add('info-item');
                    infoItem.innerHTML = `<span class="label">${label}</span><span class="value">${value}</span>`;
                    grid.appendChild(infoItem);
                }
            }

            // Renderiza as seções e campos
            for (const sectionTitle in detailsMap) {
                const sectionData = detailsMap[sectionTitle];
                
                // Pula seção se for específica de outra fonte
                if (sectionData.source && sectionData.source !== source) continue;
                
                // Verifica se há dados para a seção (exceto listas)
                let hasData = false;
                if (!sectionData.isList) {
                    for (const fieldLabel in sectionData.fields) {
                        if (sectionData.fields[fieldLabel] !== null && sectionData.fields[fieldLabel] !== undefined && sectionData.fields[fieldLabel] !== '') {
                            hasData = true;
                            break;
                        }
                    }
                } else {
                    hasData = sectionData.items && sectionData.items.length > 0;
                }

                if (hasData) {
                    const sectionHeader = document.createElement('h3');
                    sectionHeader.innerHTML = `<i class="fas ${sectionData.icon}"></i> ${sectionTitle}`;
                    companyDetailsSection.appendChild(sectionHeader);

                    const grid = document.createElement('div');
                    grid.className = 'info-grid';

                    if (!sectionData.isList) {
                        for (const fieldLabel in sectionData.fields) {
                            addInfoItem(grid, fieldLabel, sectionData.fields[fieldLabel]);
                        }
                    } else {
                        // Renderiza lista (ex: Sócios)
                        sectionData.items.forEach(item => {
                            const socioItem = document.createElement('div');
                            socioItem.classList.add('info-item');
                            const qualificacao = item.qualificacao_socio?.descricao || 'Sócio';
                            const nome = item.nome || 'Nome não informado';
                            const doc = formatCpfCnpjSocio(item.cpf_cnpj_socio) || 'Não informado';
                            const rep = item.nome_representante_legal ? `<div class="socio-details">Representante: ${item.nome_representante_legal} (${item.qualificacao_representante_legal?.descricao || ''})</div>` : '';
                            
                            socioItem.innerHTML = `
                                <span class="label">${qualificacao}:</span>
                                <span class="value">
                                    <div>${nome}</div>
                                    <div class="socio-details">CPF/CNPJ: ${doc}</div>
                                    ${rep}
                                </span>
                            `;
                            grid.appendChild(socioItem);
                        });
                    }
                    companyDetailsSection.appendChild(grid);
                }
            }
        }

        // Formata CNPJ: XX.XXX.XXX/XXXX-XX
        function formatCnpj(cnpj) {
            if (!cnpj) return null;
            cnpj = String(cnpj).replace(/\D/g, '');
            if (cnpj.length === 14) {
                return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
            }
            return cnpj; // Retorna sem formatação se não tiver 14 dígitos
        }

        // Formata CEP: XXXXX-XXX
        function formatCep(cep) {
            if (!cep) return null;
            const cepString = String(cep).replace(/\D/g, '');
            if (cepString.length === 8) {
                return cepString.replace(/(\d{5})(\d{3})/, '$1-$2');
            }
            return cep; // Retorna original se não tiver 8 dígitos
        }

        // Formata Telefone: (DD) XXXXX-XXXX ou (DD) XXXX-XXXX
        function formatPhone(ddd, phone) {
            if (!ddd || !phone) return null;
            const dddString = String(ddd).replace(/\D/g, '');
            const phoneString = String(phone).replace(/\D/g, '');
            if (phoneString.length === 8) {
                 return `(${dddString}) ${phoneString.substring(0, 4)}-${phoneString.substring(4)}`;
            } else if (phoneString.length === 9) {
                 return `(${dddString}) ${phoneString.substring(0, 5)}-${phoneString.substring(5)}`;
            }
            return `(${dddString}) ${phoneString}`; // Retorna sem formatação específica se não for 8 ou 9 dígitos
        }

        // Formata CPF/CNPJ do Sócio (com máscara simples)
        function formatCpfCnpjSocio(doc) {
            if (!doc) return null;
            const docString = String(doc).replace(/\D/g, '');
            if (docString.length === 11) { // CPF
                // Mostra apenas os 3 primeiros e 2 últimos dígitos
                return `${docString.substring(0, 3)}.***.***-${docString.substring(9, 11)}`;
            } else if (docString.length === 14) { // CNPJ
                return formatCnpj(docString);
            } else {
                return doc; // Retorna original se não for CPF ou CNPJ padrão
            }
        }

        // Mostra mensagens de status/erro
        function showMessage(element, text, type) {
            element.textContent = text;
            element.className = `message ${type}`;
            element.style.display = 'flex';
            let iconClass = '';
            if (type === 'loading') iconClass = 'fas fa-spinner fa-spin';
            else if (type === 'error') iconClass = 'fas fa-exclamation-circle';
            else if (type === 'success') iconClass = 'fas fa-check-circle';
            if (iconClass) {
                 element.innerHTML = `<i class="${iconClass}"></i> ${text}`;
            } else {
                 element.innerHTML = text; // Sem ícone para tipos não definidos
            }
        }

        // Oculta mensagens
        function hideMessage(element) {
            element.style.display = 'none';
            element.className = 'message'; // Reseta classes
            element.innerHTML = '';
        }

    